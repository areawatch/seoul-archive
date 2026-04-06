#!/usr/bin/env python3
"""
서울특별시 25개 자치구 — 구·시·군의회의원(구의원) 예비후보자 명부를
중앙선거관리위원회 선거통계시스템(info.nec.go.kr)에서 수집합니다.

사용:
  pip install -r requirements-crawl.txt
  python crawl_candidates.py

출력: public/data/candidates.json

선거구명(constituency)·주소(address)는 이 스크립트가 넣는 필드입니다.
huboId는 선관위 예비후보 상세(전과 스캔 서류) 링크용입니다.
예전에 받은 JSON에는 없을 수 있으니, 화면에 '—'가 나오면 최신 스크립트로 다시 수집하세요.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from html import unescape
from typing import Any
from urllib.parse import urlencode, urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://info.nec.go.kr"
ELECTION_ID = "0020260603"
ELECTION_CODE = "6"  # 구·시·군의회의원선거
SEOUL_CITY_CODE = "1100"

REPORT_PATH = "/electioninfo/electionInfo_report.xhtml"
TOWN_JSON = "/bizcommon/selectbox/selectbox_townCodeBySgJson.json"
SGG_JSON = "/bizcommon/selectbox/selectbox_getSggTownCodeJson.json"

DEFAULT_OUT = "public/data/candidates.json"
REQUEST_PAUSE_SEC = 0.35

# 선관위 시도>구시군 드롭다운과 동일한 순서 (수집·진행 로그 정렬)
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


def fetch_seoul_towns() -> list[dict[str, str]]:
    rows = nec_get_json(
        TOWN_JSON,
        {
            "electionId": ELECTION_ID,
            "electionCode": ELECTION_CODE,
            "cityCode": SEOUL_CITY_CODE,
        },
    )
    towns = [{"code": str(r["CODE"]), "name": str(r["NAME"])} for r in rows]
    towns.sort(key=lambda t: (_GU_ORDER_RANK.get(t["name"], 999), t["name"]))
    return towns


def fetch_sgg_town_codes(town_code: str) -> list[dict[str, str]]:
    rows = nec_get_json(
        SGG_JSON,
        {
            "electionId": ELECTION_ID,
            "electionCode": ELECTION_CODE,
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
) -> str:
    form = {
        "electionId": ELECTION_ID,
        "requestURI": f"/electioninfo/{ELECTION_ID}/pc/pcri03_ex.jsp",
        "topMenuId": "PC",
        "secondMenuId": "PCRI03",
        "menuId": "PCRI03",
        "statementId": "PCRI03_#6",
        "electionCode": ELECTION_CODE,
        "cityCode": SEOUL_CITY_CODE,
        "townCode": town_code,
        "sggTownCode": sgg_town_code,
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


def parse_candidates_from_report(html: str, gu_name: str) -> list[dict[str, Any]]:
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
        }
        if hubo_id:
            row["huboId"] = hubo_id
        rows_out.append(row)

    return rows_out


def crawl(
    *,
    towns_filter: set[str] | None = None,
    dry_run: bool = False,
) -> list[dict[str, Any]]:
    towns = fetch_seoul_towns()
    if towns_filter is not None:
        towns = [t for t in towns if t["name"] in towns_filter]

    seen_ids: set[str] = set()
    seen_fallback: set[tuple[str, str, str, str]] = set()
    merged: list[dict[str, Any]] = []
    dry_count = 0

    for town in towns:
        sggs = fetch_sgg_town_codes(town["code"])
        if not sggs:
            print(f"[skip] {town['name']}: 선거구 코드 없음", file=sys.stderr)
            continue

        for sgg in sggs:
            if dry_run:
                dry_count += 1
                print(f"would fetch {town['name']} / {sgg['name']} ({sgg['code']})")
                continue

            html = post_report_html(town["code"], sgg["code"])
            batch = parse_candidates_from_report(html, town["name"])
            added = 0
            for c in batch:
                hid = c.get("huboId")
                if hid:
                    if hid in seen_ids:
                        continue
                    seen_ids.add(hid)
                else:
                    fb = (c.get("name", ""), c.get("party", ""), c.get("regDate", ""), sgg["code"])
                    if fb in seen_fallback:
                        continue
                    seen_fallback.add(fb)
                merged.append(c)
                added += 1
            print(f"  {town['name']} / {sgg['name']}: +{added}명", file=sys.stderr)
            time.sleep(REQUEST_PAUSE_SEC)

    if dry_run:
        print(f"dry-run: {dry_count}회 요청 예정", file=sys.stderr)
        return []

    return merged


def main() -> None:
    parser = argparse.ArgumentParser(description="NEC 서울 구의원 예비후보 JSON 수집")
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
        "--dry-run",
        action="store_true",
        help="HTTP 요청 없이 조회할 URL 범위만 출력",
    )
    args = parser.parse_args()

    filt = set(args.districts) if args.districts else None
    rows = crawl(towns_filter=filt, dry_run=args.dry_run)

    if args.dry_run:
        return

    import os

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"저장 완료: {args.output} ({len(rows)}명)", file=sys.stderr)


if __name__ == "__main__":
    main()
