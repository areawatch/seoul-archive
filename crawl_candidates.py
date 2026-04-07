#!/usr/bin/env python3
"""
서울특별시 25개 자치구 — 예비후보자 명부를
중앙선거관리위원회 선거통계시스템(info.nec.go.kr)에서 수집합니다.

- 구·시·군의회의원(구의원): electionCode 6
- 시장·군수·구청장(서울 자치구 단위 = 구청장): electionCode 4

사용:
  pip install -r requirements-crawl.txt
  python crawl_candidates.py

출력: public/data/candidates.json
  형식: {"updatedAt": "ISO8601(Asia/Seoul)", "candidates": [ ... ]}
  각 후보에 "office": "구의원" | "구청장" 필드가 붙습니다(구의원만 있던 구버전 JSON은 화면에서 구의원으로 간주).

선거구명(constituency)·주소(address)는 이 스크립트가 넣는 필드입니다.
huboId는 선관위 예비후보 상세(전과 스캔 서류) 링크용입니다.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from html import unescape
from typing import Any
from urllib.parse import urlencode, urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://info.nec.go.kr"
ELECTION_ID = "0020260603"
SEOUL_CITY_CODE = "1100"

# 구·시·군의회의원
COUNCIL_ELECTION_CODE = "6"
COUNCIL_STATEMENT_ID = "PCRI03_#6"
COUNCIL_OFFICE = "구의원"

# 시장·군수·구청장 (서울 25구 → 구청장)
MAYOR_CLASS_ELECTION_CODE = "4"
MAYOR_CLASS_STATEMENT_ID = "PCRI03_#4"
MAYOR_OFFICE = "구청장"

REPORT_PATH = "/electioninfo/electionInfo_report.xhtml"
TOWN_JSON = "/bizcommon/selectbox/selectbox_townCodeBySgJson.json"
SGG_JSON = "/bizcommon/selectbox/selectbox_getSggTownCodeJson.json"

DEFAULT_OUT = "public/data/candidates.json"
REQUEST_PAUSE_SEC = 0.35

SEOUL_GU_ORDER = [
    "종로구",
    "중구",
    "용산구",
    "성동구",
    "광진구",
    "동대문구",
    "중랑구",
    "성북구",
    "강북구",
    "도봉구",
    "노원구",
    "은평구",
    "서대문구",
    "마포구",
    "양천구",
    "강서구",
    "구로구",
    "금천구",
    "영등포구",
    "동작구",
    "관악구",
    "서초구",
    "강남구",
    "송파구",
    "강동구",
]
_GU_ORDER_RANK = {n: i for i, n in enumerate(SEOUL_GU_ORDER)}

SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": "Mozilla/5.0 (compatible; seoul-archive-crawler/1.0)",
        "Accept-Language": "ko-KR,ko;q=0.9",
    }
)


def nec_get_json(path: str, params: dict[str, str]) -> list[dict[str, Any]]:
    url = urljoin(BASE, path) + "?" + urlencode(params)
    r = SESSION.get(url, timeout=60)
    r.raise_for_status()
    data = r.json()
    jr = data.get("jsonResult") or {}
    if jr.get("header", {}).get("result") != "ok":
        raise RuntimeError(f"NEC JSON error: {jr}")
    body = jr.get("body")
    if body is None:
        return []
    if not isinstance(body, list):
        return [body]
    return body


def fetch_seoul_towns(*, election_code: str) -> list[dict[str, str]]:
    rows = nec_get_json(
        TOWN_JSON,
        {
            "electionId": ELECTION_ID,
            "electionCode": election_code,
            "cityCode": SEOUL_CITY_CODE,
        },
    )
    towns = [{"code": str(r["CODE"]), "name": str(r["NAME"])} for r in rows]
    towns.sort(key=lambda t: (_GU_ORDER_RANK.get(t["name"], 999), t["name"]))
    return towns


def fetch_sgg_town_codes(town_code: str, *, election_code: str) -> list[dict[str, str]]:
    rows = nec_get_json(
        SGG_JSON,
        {
            "electionId": ELECTION_ID,
            "electionCode": election_code,
            "townCode": town_code,
        },
    )
    out = []
    for r in rows:
        code = str(r["CODE"])
        if code == "0":
            continue
        out.append({"code": code, "name": str(r["NAME"])})
    return out


def post_report_html(
    town_code: str,
    sgg_town_code: str,
    *,
    election_code: str,
    statement_id: str,
) -> str:
    # 선관위 폼은 electionCode=4(구·시·군의 장)일 때 sggCityCode 없이는
    # townCode+sggTownCode만으로는 표가 비어 「검색된 결과가 없습니다」만 온다.
    # 웹 화면은 sggCityCode(선거구)를 쓰므로, API에서 받은 코드를 동일 값으로 넣는다.
    form = {
        "electionId": ELECTION_ID,
        "requestURI": f"/electioninfo/{ELECTION_ID}/pc/pcri03_ex.jsp",
        "topMenuId": "PC",
        "secondMenuId": "PCRI03",
        "menuId": "PCRI03",
        "statementId": statement_id,
        "electionCode": election_code,
        "cityCode": SEOUL_CITY_CODE,
        "townCode": town_code,
        "sggTownCode": sgg_town_code,
        "sggCityCode": sgg_town_code,
    }
    url = urljoin(BASE, REPORT_PATH)
    r = SESSION.post(url, data=form, timeout=90)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def _district_from_constituency(constituency: str) -> str:
    """'종로구가선거구' -> '종로구'"""
    m = re.match(r"^(.+구)[가-힣]선거구$", constituency.strip())
    if m:
        return m.group(1)
    if constituency.endswith("구"):
        return constituency
    return constituency


def _abs_photo_url(src: str | None) -> str | None:
    if not src or not src.strip():
        return None
    s = src.strip()
    if s.startswith("//"):
        return "https:" + s
    return urljoin(BASE, s)


def _name_from_cell(td) -> str:
    a = td.find("a", href=True)
    if a:
        return a.get_text("\n", strip=True)
    return unescape(td.get_text("\n", strip=True))


def _hubo_id_from_cell(td) -> str | None:
    a = td.find("a", href=re.compile(r"popupPreHBJ"))
    if not a or not a.get("href"):
        return None
    m = re.search(r"popupPreHBJ\s*\(\s*'[^']*'\s*,\s*'(\d+)'\s*\)", a["href"])
    return m.group(1) if m else None


def parse_candidates_from_report(
    html: str,
    gu_name: str,
    *,
    office: str,
) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("table#table01")
    if not table:
        return []
    tbody = table.find("tbody")
    if not tbody:
        return []

    rows_out: list[dict[str, Any]] = []
    for tr in tbody.find_all("tr", recursive=False):
        tds = tr.find_all("td", recursive=False)
        if len(tds) < 12:
            continue
        if tds[0].get("colspan"):
            continue

        constituency = tds[0].get_text(" ", strip=True)
        district = gu_name or _district_from_constituency(constituency)
        party = tds[1].get_text(" ", strip=True)

        img = tds[2].find("input", attrs={"type": "image"})
        src = img.get("src") if img else None
        photo = _abs_photo_url(src)

        name = _name_from_cell(tds[3])
        hubo_id = _hubo_id_from_cell(tds[3])

        gender = tds[4].get_text(" ", strip=True)
        age_block = tds[5].get_text("\n", strip=True)
        address = tds[6].get_text(" ", strip=True)

        job = tds[7].get_text(" ", strip=True)
        education = tds[8].get_text("\n", strip=True)
        career = tds[9].get_text("\n", strip=True)
        criminal = tds[10].get_text(" ", strip=True)
        reg_date = tds[11].get_text(" ", strip=True)

        row = {
            "district": district,
            "constituency": constituency,
            "party": party,
            "name": name,
            "photo": photo or "",
            "gender": gender,
            "age": age_block,
            "address": address,
            "job": job,
            "education": education,
            "career": career,
            "criminal": criminal,
            "regDate": reg_date,
            "office": office,
        }
        if hubo_id:
            row["huboId"] = hubo_id
        rows_out.append(row)

    return rows_out


def crawl_office(
    *,
    election_code: str,
    statement_id: str,
    office_label: str,
    towns_filter: set[str] | None,
    dry_run: bool,
) -> tuple[list[dict[str, Any]], int]:
    towns = fetch_seoul_towns(election_code=election_code)
    if towns_filter is not None:
        towns = [t for t in towns if t["name"] in towns_filter]

    seen_ids: set[str] = set()
    seen_fallback: set[tuple[str, str, str, str, str]] = set()
    merged: list[dict[str, Any]] = []
    request_count = 0

    for town in towns:
        sggs = fetch_sgg_town_codes(town["code"], election_code=election_code)
        if not sggs:
            print(f"[skip] [{office_label}] {town['name']}: 선거구 코드 없음", file=sys.stderr)
            continue

        for sgg in sggs:
            request_count += 1
            if dry_run:
                print(
                    f"would fetch [{office_label}] {town['name']} / {sgg['name']} ({sgg['code']})",
                    file=sys.stderr,
                )
                continue

            html = post_report_html(
                town["code"],
                sgg["code"],
                election_code=election_code,
                statement_id=statement_id,
            )
            batch = parse_candidates_from_report(html, town["name"], office=office_label)
            added = 0
            for c in batch:
                hid = c.get("huboId")
                if hid:
                    key = f"{office_label}:{hid}"
                    if key in seen_ids:
                        continue
                    seen_ids.add(key)
                else:
                    fb = (
                        office_label,
                        c.get("name", ""),
                        c.get("party", ""),
                        c.get("regDate", ""),
                        sgg["code"],
                    )
                    if fb in seen_fallback:
                        continue
                    seen_fallback.add(fb)
                merged.append(c)
                added += 1
            print(
                f"  [{office_label}] {town['name']} / {sgg['name']}: +{added}명",
                file=sys.stderr,
            )
            time.sleep(REQUEST_PAUSE_SEC)

    return merged, request_count


def crawl(
    *,
    mode: str,
    towns_filter: set[str] | None,
    dry_run: bool,
) -> list[dict[str, Any]]:
    total_requests = 0
    out: list[dict[str, Any]] = []

    if mode in ("all", "council"):
        batch, nreq = crawl_office(
            election_code=COUNCIL_ELECTION_CODE,
            statement_id=COUNCIL_STATEMENT_ID,
            office_label=COUNCIL_OFFICE,
            towns_filter=towns_filter,
            dry_run=dry_run,
        )
        total_requests += nreq
        out.extend(batch)

    if mode in ("all", "mayor"):
        batch, nreq = crawl_office(
            election_code=MAYOR_CLASS_ELECTION_CODE,
            statement_id=MAYOR_CLASS_STATEMENT_ID,
            office_label=MAYOR_OFFICE,
            towns_filter=towns_filter,
            dry_run=dry_run,
        )
        total_requests += nreq
        out.extend(batch)

    if dry_run:
        print(f"dry-run: 총 {total_requests}회 요청 예정", file=sys.stderr)
        return []

    return out


def main() -> None:
    parser = argparse.ArgumentParser(
        description="NEC 서울 구의원·구청장 예비후보 JSON 수집",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=DEFAULT_OUT,
        help=f"출력 경로 (기본: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--district",
        action="append",
        dest="districts",
        metavar="구이름",
        help="해당 구만 수집 (여러 번 지정 가능). 예: --district 종로구",
    )
    parser.add_argument(
        "--only",
        choices=("all", "council", "mayor"),
        default="all",
        help="구의원만 / 구청장만 / 둘 다 (기본: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="HTTP 요청 없이 조회할 범위만 출력",
    )
    args = parser.parse_args()

    filt = set(args.districts) if args.districts else None
    rows = crawl(mode=args.only, towns_filter=filt, dry_run=args.dry_run)

    if args.dry_run:
        return

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    updated_at = datetime.now(ZoneInfo("Asia/Seoul")).replace(microsecond=0)
    payload = {
        "updatedAt": updated_at.isoformat(),
        "candidates": rows,
    }
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(
        f"저장 완료: {args.output} ({len(rows)}명, 갱신시각 {payload['updatedAt']})",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
