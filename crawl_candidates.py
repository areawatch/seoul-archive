#!/usr/bin/env python3
"""
서울특별시 25개 자치구 — 예비후보자 명부를
중앙선거관리위원회 선거통계시스템(info.nec.go.kr)에서 수집합니다.

- 구·시·군의회의원(구의원): electionCode 6
- 시·도의회의원(서울 = 시의원, 자치구 단위 선거구): electionCode 5
- 시장·군수·구청장(서울 자치구 단위 = 구청장): electionCode 4

사용:
  pip install -r requirements-crawl.txt
  python crawl_candidates.py

출력: public/data/candidates.json
  형식: {"updatedAt": "ISO8601(Asia/Seoul)", "candidates": [ ... ]}
  각 후보에 "office": "구의원" | "시의원" | "구청장" 필드가 붙습니다(없으면 화면에서 구의원으로 간주).

선거구명(constituency)·주소(address)는 이 스크립트가 넣는 필드입니다.
huboId는 선관위 예비후보 상세(전과 스캔 서류) 링크용입니다.
"""

from __future__ import annotations

import argparse
import csv
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

# 시·도의회의원 (서울시의회 = 시의원, 구 단위 선거구)
METRO_COUNCIL_ELECTION_CODE = "5"
METRO_COUNCIL_STATEMENT_ID = "PCRI03_#5"
METRO_OFFICE = "시의원"

REPORT_PATH = "/electioninfo/electionInfo_report.xhtml"
TOWN_JSON = "/bizcommon/selectbox/selectbox_townCodeBySgJson.json"
SGG_JSON = "/bizcommon/selectbox/selectbox_getSggTownCodeJson.json"

DEFAULT_OUT = "public/data/candidates.json"
DEFAULT_ELECTION_NAME = "2026지방선거"
DEFAULT_CANDIDATE_STATUS = "preliminary"  # preliminary(예비후보) | official(본후보)
DEFAULT_REDLINE_SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1HZOgA2XGNQe9RTyZsDDZdqfgdHIrUIfGqBKRs62cugA/gviz/tq?tqx=out:csv"
)
DEFAULT_NEWS_CACHE_OUT = "public/data/redline-news-cache.json"
REQUEST_PAUSE_SEC = 0.35
REQUEST_RETRY_COUNT = 4
REQUEST_BACKOFF_BASE_SEC = 1.2

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


def _request_with_retry(method: str, url: str, *, timeout: int, **kwargs) -> requests.Response:
    last_err: Exception | None = None
    for attempt in range(1, REQUEST_RETRY_COUNT + 1):
        try:
            r = SESSION.request(method, url, timeout=timeout, **kwargs)
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            last_err = e
            if attempt >= REQUEST_RETRY_COUNT:
                break
            sleep_s = REQUEST_BACKOFF_BASE_SEC * (2 ** (attempt - 1))
            print(
                f"[retry {attempt}/{REQUEST_RETRY_COUNT}] {method} {url} 실패: {e} (대기 {sleep_s:.1f}s)",
                file=sys.stderr,
            )
            time.sleep(sleep_s)
    raise RuntimeError(f"{method} {url} 요청 실패(재시도 소진): {last_err}")


def nec_get_json(path: str, params: dict[str, str]) -> list[dict[str, Any]]:
    url = urljoin(BASE, path) + "?" + urlencode(params)
    r = _request_with_retry("GET", url, timeout=60)
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
    r = _request_with_retry("POST", url, timeout=90, data=form)
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def _district_from_constituency(constituency: str) -> str:
    """선거구명에서 자치구명 추출. '종로구가선거구', '종로구제1선거구' 등."""
    c = constituency.strip()
    for gu in sorted(SEOUL_GU_ORDER, key=len, reverse=True):
        if c.startswith(gu):
            return gu
    m = re.match(r"^(.+구)[가-힣]선거구$", c)
    if m:
        return m.group(1)
    if c.endswith("구"):
        return c
    return c


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
    election_name: str,
    candidate_status: str,
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
            "election_name": election_name,
            "candidate_status": candidate_status,
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


def _normalize_loose_text(s: str) -> str:
    return re.sub(r"\s+", "", str(s or "").strip().lower())


def _normalize_district_name(s: str) -> str:
    return re.sub(r"\s+", "", str(s or "").strip())


def _primary_name(raw: str) -> str:
    t = str(raw or "").strip()
    if not t:
        return ""
    t = t.split("(")[0].strip()
    return re.split(r"\s+", t)[0].strip()


def _candidate_merge_key(c: dict[str, Any]) -> str:
    election = str(c.get("election_name") or DEFAULT_ELECTION_NAME).strip()
    district = _normalize_district_name(str(c.get("district") or ""))
    name = _normalize_loose_text(_primary_name(str(c.get("name") or "")))
    return f"{election}|{district}|{name}"


def _is_empty(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, str):
        return v.strip() == ""
    if isinstance(v, (list, dict, set, tuple)):
        return len(v) == 0
    return False


def _inherit_fields_from_old(new: dict[str, Any], old: dict[str, Any]) -> None:
    """
    선관위 크롤링 데이터가 업데이트되더라도, 기존에 제보/수집된 연락처·SNS·사진 URL 등은 유지(상속).
    - 상속 기준: election_name + district + name(정규화) 키가 동일할 때
    - 상속 대상: contact/sns/tip/photo 관련 키 + new 값이 비어있는 경우 old 값으로 채움
    """
    inherit_prefixes = ("contact", "sns", "social", "tip", "card")
    inherit_keys = {
        "contacts",
        "contact",
        "phone",
        "email",
        "facebook",
        "instagram",
        "twitter",
        "youtube",
        "blog",
        "homepage",
        "tipPhoto",
        "tipPhotos",
        "tip_photo",
        "cardPhoto",
        "cardPhotoUrl",
        "notes",
        "memo",
    }

    for k, ov in (old or {}).items():
        if k in ("election_name", "candidate_status"):
            continue
        if k in inherit_keys or k.startswith(inherit_prefixes):
            if k not in new or _is_empty(new.get(k)):
                if not _is_empty(ov):
                    new[k] = ov


def merge_with_existing_candidates(new_rows: list[dict[str, Any]], existing_path: str) -> list[dict[str, Any]]:
    if not existing_path or not os.path.exists(existing_path):
        return new_rows
    try:
        with open(existing_path, encoding="utf-8") as f:
            old_payload = json.load(f)
    except Exception:
        return new_rows

    old_list: list[dict[str, Any]] = []
    if isinstance(old_payload, dict) and isinstance(old_payload.get("candidates"), list):
        old_list = old_payload["candidates"]
    elif isinstance(old_payload, list):
        old_list = old_payload
    else:
        return new_rows

    old_map: dict[str, dict[str, Any]] = {}
    for oc in old_list:
        if not isinstance(oc, dict):
            continue
        if not str(oc.get("election_name") or "").strip():
            oc["election_name"] = DEFAULT_ELECTION_NAME
        if not str(oc.get("candidate_status") or "").strip():
            oc["candidate_status"] = DEFAULT_CANDIDATE_STATUS
        old_map[_candidate_merge_key(oc)] = oc

    out: list[dict[str, Any]] = []
    for nc in new_rows:
        if not isinstance(nc, dict):
            continue
        if not str(nc.get("election_name") or "").strip():
            nc["election_name"] = DEFAULT_ELECTION_NAME
        if not str(nc.get("candidate_status") or "").strip():
            nc["candidate_status"] = DEFAULT_CANDIDATE_STATUS

        key = _candidate_merge_key(nc)
        oc = old_map.get(key)
        if oc:
            # candidate_status는 official이 우선(승격 시 유지)
            old_status = str(oc.get("candidate_status") or DEFAULT_CANDIDATE_STATUS).strip().lower()
            new_status = str(nc.get("candidate_status") or DEFAULT_CANDIDATE_STATUS).strip().lower()
            if old_status == "official" or new_status == "official":
                nc["candidate_status"] = "official"
            else:
                nc["candidate_status"] = "preliminary"
            _inherit_fields_from_old(nc, oc)
        out.append(nc)
    return out


def crawl_office(
    *,
    election_code: str,
    statement_id: str,
    office_label: str,
    towns_filter: set[str] | None,
    dry_run: bool,
    election_name: str,
    candidate_status: str,
) -> tuple[list[dict[str, Any]], int]:
    try:
        towns = fetch_seoul_towns(election_code=election_code)
    except Exception as e:
        print(f"[error] [{office_label}] 자치구 목록 조회 실패: {e}", file=sys.stderr)
        return [], 0
    if towns_filter is not None:
        towns = [t for t in towns if t["name"] in towns_filter]

    seen_ids: set[str] = set()
    seen_fallback: set[tuple[str, str, str, str, str]] = set()
    merged: list[dict[str, Any]] = []
    request_count = 0

    for town in towns:
        try:
            sggs = fetch_sgg_town_codes(town["code"], election_code=election_code)
        except Exception as e:
            print(f"[skip] [{office_label}] {town['name']}: 선거구 조회 실패 ({e})", file=sys.stderr)
            continue
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

            try:
                html = post_report_html(
                    town["code"],
                    sgg["code"],
                    election_code=election_code,
                    statement_id=statement_id,
                )
            except Exception as e:
                print(
                    f"[skip] [{office_label}] {town['name']} / {sgg['name']}: 본문 조회 실패 ({e})",
                    file=sys.stderr,
                )
                continue
            batch = parse_candidates_from_report(html, town["name"], office=office_label)
            # enrich default schema fields
            for b in batch:
                b["election_name"] = election_name
                b["candidate_status"] = candidate_status
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
    election_name: str,
    candidate_status: str,
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
            election_name=election_name,
            candidate_status=candidate_status,
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
            election_name=election_name,
            candidate_status=candidate_status,
        )
        total_requests += nreq
        out.extend(batch)

    if mode in ("all", "metro"):
        batch, nreq = crawl_office(
            election_code=METRO_COUNCIL_ELECTION_CODE,
            statement_id=METRO_COUNCIL_STATEMENT_ID,
            office_label=METRO_OFFICE,
            towns_filter=towns_filter,
            dry_run=dry_run,
            election_name=election_name,
            candidate_status=candidate_status,
        )
        total_requests += nreq
        out.extend(batch)

    if dry_run:
        print(f"dry-run: 총 {total_requests}회 요청 예정", file=sys.stderr)
        return []

    return out


def _normalize_news_url(raw: str) -> str:
    return re.sub(r"\s+", "", str(raw or "").strip())


def _extract_sheet_news_urls(sheet_csv_url: str) -> set[str]:
    r = _request_with_retry("GET", sheet_csv_url, timeout=60)
    r.encoding = "utf-8"
    text = r.text
    rows = csv.DictReader(text.splitlines())
    out: set[str] = set()
    for row in rows:
        if not row:
            continue
        for key, value in row.items():
            k = str(key or "").strip()
            if not k.startswith("뉴스링크"):
                continue
            u = _normalize_news_url(str(value or ""))
            if u.startswith("http://") or u.startswith("https://"):
                out.add(u)
    return out


def _extract_og_title_from_html(html_text: str) -> str:
    soup = BeautifulSoup(html_text, "html.parser")
    for selector in (
        'meta[property="og:title"]',
        'meta[name="og:title"]',
        'meta[name="twitter:title"]',
    ):
        tag = soup.select_one(selector)
        if tag and tag.get("content"):
            t = str(tag.get("content")).strip()
            if t:
                return t
    if soup.title and soup.title.string:
        t = str(soup.title.string).strip()
        if t:
            return t
    return ""


def _fetch_og_title(url: str) -> str:
    try:
        r = _request_with_retry("GET", url, timeout=20, allow_redirects=True)
        if not r.encoding:
            r.encoding = r.apparent_encoding or "utf-8"
        return _extract_og_title_from_html(r.text)
    except Exception:
        return ""


def update_redline_news_cache(
    *,
    sheet_csv_url: str,
    cache_output_path: str,
) -> tuple[int, int]:
    urls = _extract_sheet_news_urls(sheet_csv_url)
    os.makedirs(os.path.dirname(cache_output_path) or ".", exist_ok=True)
    cache: dict[str, dict[str, str]] = {}
    if os.path.exists(cache_output_path):
        try:
            with open(cache_output_path, encoding="utf-8") as f:
                old = json.load(f)
            if isinstance(old, dict):
                for url, meta in old.items():
                    u = _normalize_news_url(url)
                    if not u:
                        continue
                    if isinstance(meta, dict):
                        title = str(meta.get("title") or "").strip()
                        fetched_at = str(meta.get("fetchedAt") or "").strip()
                    else:
                        title = str(meta or "").strip()
                        fetched_at = ""
                    cache[u] = {"title": title, "fetchedAt": fetched_at}
        except Exception:
            cache = {}

    now_iso = datetime.now(ZoneInfo("Asia/Seoul")).replace(microsecond=0).isoformat()
    miss_urls = sorted([u for u in urls if not cache.get(u, {}).get("title")])
    for u in miss_urls:
        title = _fetch_og_title(u)
        cache[u] = {"title": title, "fetchedAt": now_iso}
        time.sleep(0.15)

    # 현재 시트에 남아있는 URL만 유지 (증분 수집 + 정리)
    final_cache = {u: cache.get(u, {"title": "", "fetchedAt": ""}) for u in sorted(urls)}
    with open(cache_output_path, "w", encoding="utf-8") as f:
        json.dump(final_cache, f, ensure_ascii=False, indent=2)
    return len(urls), len(miss_urls)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="NEC 서울 구의원·시의원·구청장 예비후보 JSON 수집",
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
        choices=("all", "council", "mayor", "metro"),
        default="all",
        help="구의원만 / 시의원만 / 구청장만 / 전체 (기본: all)",
    )
    parser.add_argument(
        "--task",
        choices=("all", "candidates", "news"),
        default="all",
        help="실행 작업: all(기본) | candidates(선관위 명부만) | news(RED LINE 뉴스 OG만)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="HTTP 요청 없이 조회할 범위만 출력",
    )
    parser.add_argument(
        "--sheet-csv-url",
        default=DEFAULT_REDLINE_SHEET_CSV_URL,
        help="RED LINE 구글 시트 CSV URL",
    )
    parser.add_argument(
        "--news-cache-output",
        default=DEFAULT_NEWS_CACHE_OUT,
        help=f"RED LINE 뉴스 OG 제목 캐시 출력 경로 (기본: {DEFAULT_NEWS_CACHE_OUT})",
    )
    parser.add_argument(
        "--election-name",
        default=DEFAULT_ELECTION_NAME,
        help=f"선거 이름(다년도 구분용). 기본: {DEFAULT_ELECTION_NAME}",
    )
    parser.add_argument(
        "--candidate-status",
        choices=("preliminary", "official"),
        default=DEFAULT_CANDIDATE_STATUS,
        help="후보 상태: preliminary(예비후보, 기본) | official(본후보)",
    )
    args = parser.parse_args()

    filt = set(args.districts) if args.districts else None
    if args.task in ("all", "candidates"):
        rows = crawl(
            mode=args.only,
            towns_filter=filt,
            dry_run=args.dry_run,
            election_name=str(args.election_name or DEFAULT_ELECTION_NAME).strip() or DEFAULT_ELECTION_NAME,
            candidate_status=str(args.candidate_status or DEFAULT_CANDIDATE_STATUS).strip() or DEFAULT_CANDIDATE_STATUS,
        )
        if not args.dry_run:
            # merge: preserve previously collected contact/photo/etc even if NEC updates status
            rows = merge_with_existing_candidates(rows, args.output)
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

    if args.task in ("all", "news"):
        if args.dry_run:
            print("dry-run: 뉴스 OG 캐시 갱신은 건너뜁니다.", file=sys.stderr)
        else:
            try:
                total_urls, fetched_new = update_redline_news_cache(
                    sheet_csv_url=args.sheet_csv_url,
                    cache_output_path=args.news_cache_output,
                )
                print(
                    f"뉴스 OG 캐시 저장: {args.news_cache_output} (총 {total_urls}개, 신규 수집 {fetched_new}개)",
                    file=sys.stderr,
                )
            except Exception as e:
                print(f"[warn] 뉴스 OG 캐시 갱신 실패: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
