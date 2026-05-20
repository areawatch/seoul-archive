#!/usr/bin/env python3
"""
서울특별시 25개 자치구 — 후보자 명부(예비·본)를
중앙선거관리위원회 선거통계시스템(info.nec.go.kr)에서 수집합니다.

- 구·시·군의회의원(구의원): electionCode 6
- 시·도의회의원(서울 = 시의원, 자치구 단위 선거구): electionCode 5
- 시장·군수·구청장(서울 자치구 단위 = 구청장): electionCode 4
- 광역의원비례대표(서울시의회 비례): electionCode 8
- 기초의원비례대표(서울 구의회 비례, 구별): electionCode 9

사용:
  pip install -r requirements-crawl.txt
  python3 crawl_candidates.py

데이터 구분(선거 + 예비/본):
  - 각 후보 JSON에 election_name(예: "2026지방선거"), candidate_status("preliminary"|"official"),
    표시용 candidate_stage_ko("예비후보"|"본후보")가 들어갑니다.

예비 전체를 고정 파일로 남긴 뒤 본후보로 갈아타기:
  1) python3 crawl_candidates.py --task export-preliminary
     → public/data/candidates-2026-preliminary.json (전원 preliminary + 예비후보 라벨)
  2) python3 crawl_candidates.py --candidate-status official
     → public/data/candidates.json 은 본후보 명부로 갱신,
       단 --preliminary-archive 파일이 있으면 같은 사람 키로 연락처 등을 상속합니다.
  (선택) --no-preliminary-merge 로 예비 고정본 상속을 끌 수 있습니다.
  (선택) --snapshot-existing-output 으로 덮어쓰기 직전에 public/data/archive/에 타임스탬프 복사본을 남길 수 있습니다.

진단(본·예비 POST 비교, HTML 저장):
  python3 crawl_candidates.py --task nec-probe --nec-probe-district 종로구
  → nec-probe-council-preliminary.html, nec-probe-council-official.html 및 stderr에 폼 필드·파싱 건수 출력

출력: public/data/candidates.json
  형식: {"updatedAt": "ISO8601(Asia/Seoul)", "candidates": [ ... ]}
  각 후보에 "office": "구의원" | "시의원" | "구청장" | "시의원비례" | "구의원비례" 필드가 붙습니다(없으면 화면에서 구의원으로 간주).

선거구명(constituency)·주소(address)는 이 스크립트가 넣는 필드입니다.
huboId는 선관위 예비·본후보 상세(전과 스캔 서류) 링크용입니다. 제9회 지방선거(0020260603) 명부 POST는 requestURI …/cp/cpri03.jsp 로 통일하고,
본후보는 statementId만 CPRI04_#N 으로 1차 POST하고, NEC가 빈 표만 줄 때는 같은 조건으로 CPRI03_#N 을 재요청합니다(화면 명부와 맞추기 위함).
시·도의회의원·구의원(electionCode 5·6)은 브라우저와 동일하게 sggCityCode=-1, sggTownCode=0 으로 자치구 단위 한 번에 조회합니다.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from html import unescape
from typing import Any, Optional
from urllib.parse import urlencode, urljoin

BASE = "https://info.nec.go.kr"
ELECTION_ID = "0020260603"
SEOUL_CITY_CODE = "1100"

# 구·시·군의회의원 (2026 지방선거: topMenuId CP, secondMenuId CPRI03 — 본후보는 statementId CPRI04_#6)
COUNCIL_ELECTION_CODE = "6"
COUNCIL_STATEMENT_ID = "CPRI03_#6"
COUNCIL_OFFICE = "구의원"

# 시장·군수·구청장 (서울 25구 → 구청장)
MAYOR_CLASS_ELECTION_CODE = "4"
MAYOR_CLASS_STATEMENT_ID = "CPRI03_#4"
MAYOR_OFFICE = "구청장"

# 시·도의회의원 (서울시의회 = 시의원, 구 단위 선거구)
METRO_COUNCIL_ELECTION_CODE = "5"
METRO_COUNCIL_STATEMENT_ID = "CPRI03_#5"
METRO_OFFICE = "시의원"

# 광역의원비례대표 (서울시의회 비례)
METRO_PROP_ELECTION_CODE = "8"
METRO_PROP_STATEMENT_ID = "CPRI03_#8"
METRO_PROP_OFFICE = "시의원비례"

# 기초의원비례대표 (자치구의회 비례, 구별 명부)
COUNCIL_PROP_ELECTION_CODE = "9"
COUNCIL_PROP_STATEMENT_ID = "CPRI03_#9"
COUNCIL_PROP_OFFICE = "구의원비례"

# 선거통계 후보 명부 공통 (지방선거 2026)
NEC_TOP_MENU_ID = "CP"
NEC_REPORT_JSP_DIR = "cp"  # requestURI 경로: .../electioninfo/{id}/cp/cpri03_ex.jsp

REPORT_PATH = "/electioninfo/electionInfo_report.xhtml"
TOWN_JSON = "/bizcommon/selectbox/selectbox_townCodeBySgJson.json"
SGG_JSON = "/bizcommon/selectbox/selectbox_getSggTownCodeJson.json"

DEFAULT_OUT = "public/data/candidates.json"
DEFAULT_ELECTION_NAME = "2026지방선거"
DEFAULT_CANDIDATE_STATUS = "preliminary"  # preliminary(예비후보) | official(본후보)
# 예비 명부 전체를 고정 저장한 뒤, 본후보 크롤 시 연락처 등을 이 파일에서 상속합니다.
DEFAULT_PRELIMINARY_ARCHIVE = "public/data/candidates-2026-preliminary.json"
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

# HTTP 크롤 시에만 requests 로드 (export-preliminary 등은 표준 라이브러리만으로 동작)
_SESSION: Any = None


def _http_session() -> Any:
    global _SESSION
    if _SESSION is None:
        import requests

        s = requests.Session()
        s.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "ko-KR,ko;q=0.9",
            }
        )
        _SESSION = s
    return _SESSION


def _request_with_retry(method: str, url: str, *, timeout: int, **kwargs) -> Any:
    import requests

    last_err: Exception | None = None
    for attempt in range(1, REQUEST_RETRY_COUNT + 1):
        try:
            r = _http_session().request(method, url, timeout=timeout, **kwargs)
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


def _nec_pc_report_menu() -> tuple[str, str]:
    """
    선거통계 지방선거(2026) 후보 명부: 예비·본 모두 동일하게 CPRI03 / cpri03.jsp.
    본후보 데이터는 _nec_statement_id_for_status 로 statementId만 CPRI04_#N 으로 바꿉니다.
    (secondMenuId=CPRI04 + cpri04.jsp 조합은 서버가 짧은 오류 HTML을 돌려주는 경우가 있음.)
    """
    return ("CPRI03", "cpri03.jsp")


def _nec_statement_id_for_status(statement_id: str, *, candidate_status: str) -> str:
    """CPRI03_#6 형태를 official일 때 CPRI04_#6으로 치환(POST 1차 시도)."""
    sid = str(statement_id or "").strip()
    if str(candidate_status or "").strip().lower() != "official":
        return sid
    if sid.startswith("CPRI03_"):
        return "CPRI04_" + sid[len("CPRI03_") :]
    # 구형 PCRI03_ 저장값 호환
    if sid.startswith("PCRI03_"):
        return "CPRI04_" + sid[len("PCRI03_") :]
    return sid


def _nec_official_report_empty(html: str) -> bool:
    """본후보( CPRI04 ) POST가 빈 표·오류인지(예비 명부로 폴백할지) 판별."""
    if "비정상적인 접근" in html or "서비스하고 있지 않은 페이지" in html or "This is error page" in html:
        return True
    return "검색된 결과가 없습니다" in html


def _nec_report_post_form(
    town_code: str,
    sgg_town_code: str,
    *,
    election_code: str,
    statement_id: str,
    candidate_status: str,
) -> dict[str, str]:
    """
    선거통계 electionInfo_report.xhtml POST 본문(dict).

    시·도의회의원(5)·구·시·군의회의원(6)은 브라우저와 같이 자치구만 선택 후 조회할 때
    sggCityCode=-1, sggTownCode=0 이어야 구 안 모든 기초선거구 행이 한 응답에 옵니다.
    (sgg 코드를 시도 코드에 넣으면 선거구별 1~2명만 오거나 본후보 분기와 맞지 않을 수 있음.)
    구·시·군의 장(4)은 JSON에서 받은 단일 선거구 코드를 sggCityCode·sggTownCode 모두에 넣습니다.
    """
    menu_id, jsp_name = _nec_pc_report_menu()
    stmt = _nec_statement_id_for_status(statement_id, candidate_status=candidate_status)
    ec = str(election_code or "").strip()
    if ec in (
        METRO_COUNCIL_ELECTION_CODE,
        COUNCIL_ELECTION_CODE,
        METRO_PROP_ELECTION_CODE,
        COUNCIL_PROP_ELECTION_CODE,
    ):
        sgg_city = "-1"
        sgg_town = "0"
    else:
        sgg_city = str(sgg_town_code or "").strip()
        sgg_town = sgg_city
    return {
        "electionId": ELECTION_ID,
        "requestURI": f"/electioninfo/{ELECTION_ID}/{NEC_REPORT_JSP_DIR}/{jsp_name}",
        "topMenuId": NEC_TOP_MENU_ID,
        "secondMenuId": menu_id,
        "menuId": menu_id,
        "statementId": stmt,
        "electionCode": election_code,
        "cityCode": SEOUL_CITY_CODE,
        "townCode": town_code,
        "sggTownCode": sgg_town,
        "sggCityCode": sgg_city,
        "dateCode": "0",
        "proportionalRepresentationCode": "-1",
    }


def post_report_html(
    town_code: str,
    sgg_town_code: str,
    *,
    election_code: str,
    statement_id: str,
    candidate_status: str,
    sgg_city_code: str | None = None,
) -> str:
    # electionCode=4(구청장 등): sggCityCode·sggTownCode에 선거구 JSON 코드 필요.
    # electionCode=5·6: _nec_report_post_form 이 sggCityCode=-1, sggTownCode=0 으로 맞춤.
    form = _nec_report_post_form(
        town_code,
        sgg_town_code,
        election_code=election_code,
        statement_id=statement_id,
        candidate_status=candidate_status,
    )
    if sgg_city_code is not None:
        form["sggCityCode"] = str(sgg_city_code).strip()
    menu_id = str(form.get("secondMenuId") or "")
    url = urljoin(BASE, REPORT_PATH)
    referer = urljoin(
        BASE,
        f"/main/showDocument.xhtml?electionId={ELECTION_ID}&topMenuId={NEC_TOP_MENU_ID}&secondMenuId={menu_id}",
    )

    def _post_once(data: dict[str, str]) -> str:
        r = _request_with_retry(
            "POST",
            url,
            timeout=90,
            data=data,
            headers={"Referer": referer, "Origin": BASE},
        )
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text

    html = _post_once(form)
    if (
        str(candidate_status or "").strip().lower() == "official"
        and _nec_official_report_empty(html)
    ):
        form_fb = _nec_report_post_form(
            town_code,
            sgg_town_code,
            election_code=election_code,
            statement_id=statement_id,
            candidate_status="preliminary",
        )
        html_fb = _post_once(form_fb)
        if not _nec_official_report_empty(html_fb):
            return html_fb
    return html


def run_nec_probe(
    *,
    district: str,
    output_dir: str,
    election_name: str,
) -> None:
    """구의원 한 구·첫 선거구에 대해 예비/본 POST 응답을 비교하고 HTML을 저장합니다."""
    d = str(district or "").strip() or "종로구"
    out = os.path.abspath(str(output_dir or ".").strip() or ".")
    os.makedirs(out, exist_ok=True)

    towns = fetch_seoul_towns(election_code=COUNCIL_ELECTION_CODE)
    town = next((t for t in towns if t["name"] == d), None)
    if not town:
        raise SystemExit(f"nec-probe: 구 이름을 찾을 수 없습니다: {d}")

    sggs = fetch_sgg_town_codes(town["code"], election_code=COUNCIL_ELECTION_CODE)
    if not sggs:
        raise SystemExit(f"nec-probe: {d} 선거구 코드 없음")
    sgg = sggs[0]

    post_url = urljoin(BASE, REPORT_PATH)
    for status in ("preliminary", "official"):
        form = _nec_report_post_form(
            town["code"],
            sgg["code"],
            election_code=COUNCIL_ELECTION_CODE,
            statement_id=COUNCIL_STATEMENT_ID,
            candidate_status=status,
        )
        print(f"\n[nec-probe] === 구의원 / {status} ===", file=sys.stderr)
        print(f"[nec-probe] POST {post_url}", file=sys.stderr)
        for k in sorted(form.keys()):
            print(f"  {k}={form[k]}", file=sys.stderr)

        html = post_report_html(
            town["code"],
            sgg["code"],
            election_code=COUNCIL_ELECTION_CODE,
            statement_id=COUNCIL_STATEMENT_ID,
            candidate_status=status,
        )
        path = os.path.join(out, f"nec-probe-council-{status}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)

        err_page = (
            "비정상적인 접근" in html
            or "서비스하고 있지 않은 페이지" in html
            or "This is error page" in html
        )
        empty_phrase = (
            "검색된 결과가 없습니다" in html
            or "조회된 자료가 없습니다" in html
            or "등록된 후보자가 없습니다" in html
        )
        parsed = parse_candidates_from_report(
            html,
            town["name"],
            office=COUNCIL_OFFICE,
            election_name=election_name,
            candidate_status=status,
        )
        print(
            f"[nec-probe] bytes={len(html)} err_page={err_page} empty_phrase={empty_phrase} "
            f"popupPreHBJ={html.count('popupPreHBJ')} parsed_rows={len(parsed)} → {path}",
            file=sys.stderr,
        )

    print(
        "\n[nec-probe] 브라우저 Network에서 본 명부 표가 보일 때의 electionInfo_report POST "
        "Form Data가 위와 다르면, 차이 나는 키·값을 알려 주시면 폼에 반영할 수 있습니다.",
        file=sys.stderr,
    )


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


def _td_has_report_photo_image(td) -> bool:
    """후보 명부 표에서 사진 열의 type=image 입력 여부."""
    return bool(td.find("input", attrs={"type": "image"}))


def _parse_party_cell(raw: str) -> tuple[str, str]:
    """「더불어민주당 (1)」→ (정당명, 기호)."""
    s = unescape(str(raw or "").strip())
    m = re.match(r"^(.+?)\s*\(([^)]*)\)\s*$", s)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return s, ""


def _is_proportional_table_layout(tds: list) -> bool:
    """비례대표 명부: 정당·기호(2)·추천순위(3)·성명(4) — 사진 열(1)은 지역구와 동일하게 존재."""
    n = len(tds)
    if n < 17:
        return False
    party_cell = tds[2].get_text(" ", strip=True)
    rank_cell = tds[3].get_text(" ", strip=True)
    if not party_cell or not rank_cell:
        return False
    # 지역구 18열: 기호(2)는 숫자만, 정당명은 (3)열
    if re.fullmatch(r"\d+", party_cell):
        return False
    if not re.fullmatch(r"\d{1,3}", rank_cell):
        return False
    return "당" in party_cell or "(" in party_cell


def _candidate_table_td_indices(tds: list) -> dict[str, int] | None:
    """
    NEC 후보 명부 table01 행 레이아웃(연도·메뉴별 열 순서)에 따른 td 인덱스.
    - 구형(예): 선거구, 정당, 사진, 성명, …, 전과, 등록일 (12열 전후)
    - 2026 구형 확장: 선거구, 사진, 기호, 정당, 성명, …, 전과, 입후보횟수 등 (18열 전후)
    - 비례대표: 선거구, 사진, 정당(기호), 추천순위, 성명, … (18열)
    """
    n = len(tds)
    if n < 12:
        return None
    if _is_proportional_table_layout(tds):
        return {
            "_proportional": 1,
            "constituency": 0,
            "photo": 1,
            "party": 2,
            "ballot": 3,
            "name": 4,
            "gender": 5,
            "age": 6,
            "address": 7,
            "job": 8,
            "education": 9,
            "career": 10,
            "property_declared": 11,
            "military": 12,
            "tax_paid": 13,
            "tax_arrears_5y": 14,
            "tax_arrears_current": 15,
            "criminal": 16,
            "candidacy_count": 17 if n >= 18 else -1,
            "reg_date": -1,
        }
    # 제9회 지방선거 등: 사진이 두 번째 열(인덱스 1)
    if _td_has_report_photo_image(tds[1]) and n >= 17:
        return {
            "constituency": 0,
            "party": 3,
            "photo": 1,
            "ballot": 2,
            "name": 4,
            "gender": 5,
            "age": 6,
            "address": 7,
            "job": 8,
            "education": 9,
            "career": 10,
            "property_declared": 11,
            "military": 12,
            "tax_paid": 13,
            "tax_arrears_5y": 14,
            "tax_arrears_current": 15,
            "criminal": 16,
            "candidacy_count": 17 if n >= 18 else -1,
            "reg_date": -1,  # 열 없음 → 빈 문자열
        }
    # 기존: 정당 다음에 사진
    if _td_has_report_photo_image(tds[2]):
        return {
            "constituency": 0,
            "party": 1,
            "photo": 2,
            "name": 3,
            "gender": 4,
            "age": 5,
            "address": 6,
            "job": 7,
            "education": 8,
            "career": 9,
            "criminal": 10,
            "reg_date": 11,
        }
    return None


def _td_cell_text(tds: list, ix: dict[str, int], key: str, *, multiline: bool = False) -> str:
    i = ix.get(key, -1)
    if i is None or i < 0 or i >= len(tds):
        return ""
    sep = "\n" if multiline else " "
    return tds[i].get_text(sep, strip=True)


def _hubo_id_from_cell(td) -> str | None:
    """예비·본 명부 모두 이름 셀의 링크에서 huboId 추출."""
    href_patterns = (
        re.compile(r"popupPreHBJ\s*\(\s*'[^']*'\s*,\s*'(\d+)'\s*\)"),
        re.compile(r"popupHBJ\s*\(\s*'[^']*'\s*,\s*'(\d+)'\s*\)", re.I),
        re.compile(r"popup\w*HBJ\s*\(\s*'[^']*'\s*,\s*'(\d+)'\s*\)", re.I),
    )
    for a in td.find_all("a", href=True):
        href = str(a.get("href") or "")
        if not href:
            continue
        for pat in href_patterns:
            m = pat.search(href)
            if m:
                return m.group(1)
    for a in td.find_all("a", onclick=True):
        oc = str(a.get("onclick") or "")
        for pat in href_patterns:
            m = pat.search(oc)
            if m:
                return m.group(1)
    return None


def _candidate_stage_ko_label(candidate_status: str) -> str:
    """시트/표시용: election_name(선거) + 이 필드(예비·본) 두 축으로 구분."""
    s = str(candidate_status or "").strip().lower()
    return "본후보" if s == "official" else "예비후보"


def parse_candidates_from_report(
    html: str,
    gu_name: str,
    *,
    office: str,
    election_name: str,
    candidate_status: str,
) -> list[dict[str, Any]]:
    from bs4 import BeautifulSoup

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
        if not tds:
            continue
        if tds[0].get("colspan"):
            continue
        ix = _candidate_table_td_indices(tds)
        if not ix:
            continue

        constituency = tds[ix["constituency"]].get_text(" ", strip=True)
        district = _district_from_constituency(constituency) or gu_name
        party_raw = _td_cell_text(tds, ix, "party")
        if ix.get("_proportional"):
            party, party_sym = _parse_party_cell(party_raw)
            rank = _td_cell_text(tds, ix, "ballot")
            ballot_label = ""
            if party_sym and rank:
                ballot_label = f"{party_sym}·{rank}순위"
            elif rank:
                ballot_label = f"{rank}순위"
            elif party_sym:
                ballot_label = party_sym
        else:
            party = party_raw
            ballot_label = ""
            rank = ""

        img = tds[ix["photo"]].find("input", attrs={"type": "image"})
        src = img.get("src") if img else None
        photo = _abs_photo_url(src)

        name = _name_from_cell(tds[ix["name"]])
        hubo_id = _hubo_id_from_cell(tds[ix["name"]])

        gender = _td_cell_text(tds, ix, "gender")
        age_block = _td_cell_text(tds, ix, "age", multiline=True)
        address = _td_cell_text(tds, ix, "address")
        job = _td_cell_text(tds, ix, "job")
        education = _td_cell_text(tds, ix, "education", multiline=True)
        career = _td_cell_text(tds, ix, "career", multiline=True)
        criminal = _td_cell_text(tds, ix, "criminal")
        ri = ix.get("reg_date", -1)
        reg_date = "" if ri is None or ri < 0 else tds[ri].get_text(" ", strip=True)

        row = {
            "election_name": election_name,
            "candidate_status": candidate_status,
            "candidate_stage_ko": _candidate_stage_ko_label(candidate_status),
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
        if ix.get("_proportional"):
            if ballot_label:
                row["ballot"] = ballot_label
            if rank:
                row["nominateRank"] = rank
        else:
            ballot = _td_cell_text(tds, ix, "ballot")
            if ballot:
                row["ballot"] = ballot
        prop = _td_cell_text(tds, ix, "property_declared")
        if prop:
            row["propertyDeclared"] = prop
        military = _td_cell_text(tds, ix, "military")
        if military:
            row["military"] = military
        tax_paid = _td_cell_text(tds, ix, "tax_paid")
        if tax_paid:
            row["taxPaid"] = tax_paid
        tax_a5 = _td_cell_text(tds, ix, "tax_arrears_5y")
        if tax_a5:
            row["taxArrears5y"] = tax_a5
        tax_cur = _td_cell_text(tds, ix, "tax_arrears_current")
        if tax_cur:
            row["taxArrearsCurrent"] = tax_cur
        run_ct = _td_cell_text(tds, ix, "candidacy_count")
        if run_ct != "":
            row["candidacyCount"] = run_ct
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
        if k in ("election_name", "candidate_status", "candidate_stage_ko"):
            continue
        if k in inherit_keys or k.startswith(inherit_prefixes):
            if k not in new or _is_empty(new.get(k)):
                if not _is_empty(ov):
                    new[k] = ov


def _load_candidates_list_from_file(path: str) -> list[dict[str, Any]]:
    if not path or not os.path.isfile(path):
        return []
    try:
        with open(path, encoding="utf-8") as f:
            payload = json.load(f)
    except Exception:
        return []
    if isinstance(payload, dict) and isinstance(payload.get("candidates"), list):
        return [c for c in payload["candidates"] if isinstance(c, dict)]
    if isinstance(payload, list):
        return [c for c in payload if isinstance(c, dict)]
    return []


def _merge_key_map_from_candidates(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    m: dict[str, dict[str, Any]] = {}
    for oc in rows:
        if not str(oc.get("election_name") or "").strip():
            oc["election_name"] = DEFAULT_ELECTION_NAME
        if not str(oc.get("candidate_status") or "").strip():
            oc["candidate_status"] = DEFAULT_CANDIDATE_STATUS
        if not str(oc.get("candidate_stage_ko") or "").strip():
            oc["candidate_stage_ko"] = _candidate_stage_ko_label(str(oc.get("candidate_status") or ""))
        m[_candidate_merge_key(oc)] = oc
    return m


def merge_with_existing_candidates(
    new_rows: list[dict[str, Any]],
    existing_path: str,
    *,
    preliminary_archive_path: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    new_rows: 이번 크롤 결과.
    existing_path: 직전에 쓰인 메인 출력(예: public/data/candidates.json).
    preliminary_archive_path: 예비 명부 고정본이 있으면, 키가 같을 때 연락처 등 상속에 사용(메인보다 먼저 적재 후 메인이 덮어씀).
    """
    old_map: dict[str, dict[str, Any]] = {}

    if preliminary_archive_path and os.path.isfile(preliminary_archive_path):
        prelim_rows = _load_candidates_list_from_file(preliminary_archive_path)
        old_map.update(_merge_key_map_from_candidates(prelim_rows))

    if existing_path and os.path.isfile(existing_path):
        exist_rows = _load_candidates_list_from_file(existing_path)
        old_map.update(_merge_key_map_from_candidates(exist_rows))

    if not old_map:
        # 이전 파일이 없으면 new_rows만 정규화해 반환
        out0: list[dict[str, Any]] = []
        for nc in new_rows:
            if not isinstance(nc, dict):
                continue
            if not str(nc.get("election_name") or "").strip():
                nc["election_name"] = DEFAULT_ELECTION_NAME
            if not str(nc.get("candidate_status") or "").strip():
                nc["candidate_status"] = DEFAULT_CANDIDATE_STATUS
            nc["candidate_stage_ko"] = _candidate_stage_ko_label(str(nc.get("candidate_status") or ""))
            out0.append(nc)
        return out0

    out: list[dict[str, Any]] = []
    for nc in new_rows:
        if not isinstance(nc, dict):
            continue
        if not str(nc.get("election_name") or "").strip():
            nc["election_name"] = DEFAULT_ELECTION_NAME
        if not str(nc.get("candidate_status") or "").strip():
            nc["candidate_status"] = DEFAULT_CANDIDATE_STATUS
        nc["candidate_stage_ko"] = _candidate_stage_ko_label(str(nc.get("candidate_status") or ""))

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
            nc["candidate_stage_ko"] = _candidate_stage_ko_label(nc["candidate_status"])
            _inherit_fields_from_old(nc, oc)
        out.append(nc)
    return out


def export_preliminary_archive(
    *,
    source_path: str,
    dest_path: str,
    election_name: str,
) -> int:
    """
    현재 메인 JSON(예비 명부)을 읽어 election_name + preliminary + candidate_stage_ko 로 고정 저장합니다.
    본후보 크롤 전에 한 번 실행해 두면 데이터 관리용 예비 전체 리스트가 남습니다.
    """
    rows = _load_candidates_list_from_file(source_path)
    if not rows:
        raise SystemExit(f"예비보내기 실패: 소스 파일이 없거나 후보가 없습니다: {source_path}")
    for c in rows:
        c["election_name"] = str(election_name or DEFAULT_ELECTION_NAME).strip() or DEFAULT_ELECTION_NAME
        c["candidate_status"] = "preliminary"
        c["candidate_stage_ko"] = "예비후보"
    os.makedirs(os.path.dirname(dest_path) or ".", exist_ok=True)
    updated_at = datetime.now(ZoneInfo("Asia/Seoul")).replace(microsecond=0)
    payload = {"updatedAt": updated_at.isoformat(), "candidates": rows}
    with open(dest_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return len(rows)


def snapshot_existing_output_file(output_path: str) -> Optional[str]:
    """
    덮어쓰기 전에 현재 candidates.json(등 출력 파일) 전체를 보관합니다.
    본후보 전환 시 예비 명부 스냅샷 용도.
    """
    if not output_path or not os.path.isfile(output_path):
        return None
    abs_out = os.path.abspath(output_path)
    parent = os.path.dirname(abs_out)
    archive_dir = os.path.join(parent, "archive")
    os.makedirs(archive_dir, exist_ok=True)
    ts = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%dT%H%M%S")
    stem, _ext = os.path.splitext(os.path.basename(abs_out))
    dest = os.path.join(archive_dir, f"{stem}-snapshot-{ts}.json")
    shutil.copy2(abs_out, dest)
    return dest


def _filter_batch_for_sgg(
    batch: list[dict[str, Any]],
    sgg: dict[str, str],
) -> list[dict[str, Any]]:
    """선거구명이 sgg['name']과 일치하는 행만 (본후보 통합 응답에 타 선거구가 섞이는 경우 제거)."""
    sgg_norm = _normalize_district_name(str(sgg.get("name") or ""))
    if not sgg_norm:
        return batch
    out: list[dict[str, Any]] = []
    for c in batch:
        cons = str(c.get("constituency") or "").strip()
        if _normalize_district_name(cons) != sgg_norm:
            continue
        dist = _district_from_constituency(cons)
        if dist:
            c["district"] = dist
        out.append(c)
    return out


def _fetch_parsed_batch_for_sgg(
    town: dict[str, str],
    sgg: dict[str, str],
    *,
    election_code: str,
    statement_id: str,
    office_label: str,
    election_name: str,
    candidate_status: str,
) -> list[dict[str, Any]]:
    """
    선거구(sgg) 단위 명부. 본후보 POST가 비었거나 타 선거구가 섞이면 예비 명부 HTML로 한 번 더 시도합니다.
    저장 라벨(candidate_status)은 호출자가 요청한 값(보통 official)을 유지합니다.
    """
    want_official = str(candidate_status or "").strip().lower() == "official"
    try_statuses = ("official", "preliminary") if want_official else (str(candidate_status or "preliminary"),)
    for st in try_statuses:
        html = post_report_html(
            town["code"],
            sgg["code"],
            election_code=election_code,
            statement_id=statement_id,
            candidate_status=st,
        )
        batch = parse_candidates_from_report(
            html,
            town["name"],
            office=office_label,
            election_name=election_name,
            candidate_status=candidate_status,
        )
        batch = _filter_batch_for_sgg(batch, sgg)
        if batch:
            return batch
    return []


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
                batch = _fetch_parsed_batch_for_sgg(
                    town,
                    sgg,
                    election_code=election_code,
                    statement_id=statement_id,
                    office_label=office_label,
                    election_name=election_name,
                    candidate_status=candidate_status,
                )
            except Exception as e:
                print(
                    f"[skip] [{office_label}] {town['name']} / {sgg['name']}: 본문 조회 실패 ({e})",
                    file=sys.stderr,
                )
                continue
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
                        str(c.get("constituency") or sgg["code"]),
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


def _finalize_proportional_row(
    row: dict[str, Any],
    *,
    office_label: str,
    query_gu: str | None = None,
) -> None:
    """비례 명부 표시용 district·constituency 정리."""
    if office_label == METRO_PROP_OFFICE:
        row["district"] = "서울특별시"
        row["constituency"] = "서울특별시비례대표"
        return
    if office_label == COUNCIL_PROP_OFFICE:
        gu = _district_from_constituency(str(row.get("constituency") or "")) or (
            query_gu or ""
        )
        if gu:
            row["district"] = gu
            row["constituency"] = f"{gu}비례대표"


def crawl_metro_proportional(
    *,
    dry_run: bool,
    election_name: str,
    candidate_status: str,
) -> tuple[list[dict[str, Any]], int]:
    """광역의원비례대표(서울시의회 비례) — 시도 단위 1회 조회."""
    if dry_run:
        print("[dry-run] [시의원비례] 서울특별시 명부 1회", file=sys.stderr)
        return [], 1
    towns = fetch_seoul_towns(election_code=METRO_PROP_ELECTION_CODE)
    town_code = towns[0]["code"] if towns else "1101"
    html = post_report_html(
        town_code,
        "0",
        election_code=METRO_PROP_ELECTION_CODE,
        statement_id=METRO_PROP_STATEMENT_ID,
        candidate_status=candidate_status,
    )
    batch = parse_candidates_from_report(
        html,
        "서울특별시",
        office=METRO_PROP_OFFICE,
        election_name=election_name,
        candidate_status=candidate_status,
    )
    for c in batch:
        _finalize_proportional_row(c, office_label=METRO_PROP_OFFICE)
    print(f"  [{METRO_PROP_OFFICE}] +{len(batch)}명", file=sys.stderr)
    return batch, 1


def crawl_council_proportional(
    *,
    towns_filter: set[str] | None,
    dry_run: bool,
    election_name: str,
    candidate_status: str,
) -> tuple[list[dict[str, Any]], int]:
    """
    기초의원비례대표 — 선관위 명부 1회(서울) + 구별 조회 병합.
    구별 POST가 동일 12명만 돌려주는 경우가 있어, 응답 행의 선거구명(소속 구)으로 district를 잡습니다.
  """
    if dry_run:
        n = len(towns_filter) if towns_filter else 25
        print(f"[dry-run] [{COUNCIL_PROP_OFFICE}] 자치구별 최대 {n}회 + 통합 1회", file=sys.stderr)
        return [], n + 1

    seen_ids: set[str] = set()
    merged: list[dict[str, Any]] = []
    request_count = 0

    def _merge_batch(batch: list[dict[str, Any]], query_gu: str | None) -> int:
        added = 0
        for c in batch:
            _finalize_proportional_row(
                c, office_label=COUNCIL_PROP_OFFICE, query_gu=query_gu
            )
            if towns_filter is not None and c.get("district") not in towns_filter:
                continue
            hid = c.get("huboId")
            if hid:
                key = f"{COUNCIL_PROP_OFFICE}:{hid}"
                if key in seen_ids:
                    continue
                seen_ids.add(key)
            merged.append(c)
            added += 1
        return added

    try:
        towns = fetch_seoul_towns(election_code=COUNCIL_PROP_ELECTION_CODE)
    except Exception as e:
        print(f"[error] [{COUNCIL_PROP_OFFICE}] 자치구 목록 조회 실패: {e}", file=sys.stderr)
        return [], 0
    if towns_filter is not None:
        towns = [t for t in towns if t["name"] in towns_filter]

    for town in towns:
        try:
            sggs = fetch_sgg_town_codes(town["code"], election_code=COUNCIL_PROP_ELECTION_CODE)
        except Exception as e:
            continue
        if not sggs:
            continue
        sgg = sggs[0]
        request_count += 1
        try:
            html = post_report_html(
                town["code"],
                "0",
                election_code=COUNCIL_PROP_ELECTION_CODE,
                statement_id=COUNCIL_PROP_STATEMENT_ID,
                candidate_status=candidate_status,
                sgg_city_code=sgg["code"],
            )
            batch = parse_candidates_from_report(
                html,
                town["name"],
                office=COUNCIL_PROP_OFFICE,
                election_name=election_name,
                candidate_status=candidate_status,
            )
            added = _merge_batch(batch, query_gu=town["name"])
            if added:
                print(
                    f"  [{COUNCIL_PROP_OFFICE}] {town['name']}: +{added}명",
                    file=sys.stderr,
                )
        except Exception as e:
            print(
                f"[skip] [{COUNCIL_PROP_OFFICE}] {town['name']}: 본문 조회 실패 ({e})",
                file=sys.stderr,
            )
        time.sleep(REQUEST_PAUSE_SEC)

    if not merged:
        request_count += 1
        try:
            html = post_report_html(
                "1101",
                "0",
                election_code=COUNCIL_PROP_ELECTION_CODE,
                statement_id=COUNCIL_PROP_STATEMENT_ID,
                candidate_status=candidate_status,
            )
            batch = parse_candidates_from_report(
                html,
                "서울특별시",
                office=COUNCIL_PROP_OFFICE,
                election_name=election_name,
                candidate_status=candidate_status,
            )
            added = _merge_batch(batch, query_gu=None)
            print(f"  [{COUNCIL_PROP_OFFICE}] 통합 조회: +{added}명", file=sys.stderr)
        except Exception as e:
            print(f"[skip] [{COUNCIL_PROP_OFFICE}] 통합 조회 실패: {e}", file=sys.stderr)

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

    if mode in ("all", "metro-prop"):
        batch, nreq = crawl_metro_proportional(
            dry_run=dry_run,
            election_name=election_name,
            candidate_status=candidate_status,
        )
        total_requests += nreq
        out.extend(batch)

    if mode in ("all", "council-prop"):
        batch, nreq = crawl_council_proportional(
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
    from bs4 import BeautifulSoup

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
        choices=("all", "council", "mayor", "metro", "metro-prop", "council-prop"),
        default="all",
        help="구의원·시의원·구청장·시의원비례·구의원비례 / 전체 (기본: all)",
    )
    parser.add_argument(
        "--task",
        choices=("all", "candidates", "news", "export-preliminary", "nec-probe"),
        default="all",
        help="실행 작업: all(기본) | candidates(선관위 명부만) | news(RED LINE 뉴스 OG만) | export-preliminary(현재 출력 JSON을 예비 고정본으로 저장) | nec-probe(구의원 1구·1선거구 예비/본 HTML·파싱 진단)",
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
    parser.add_argument(
        "--snapshot-existing-output",
        action="store_true",
        help="출력 파일이 이미 있으면, 덮어쓰기 전에 public/data/archive/ 아래에 타임스탬프 파일로 복사합니다(예비 명부 보존).",
    )
    parser.add_argument(
        "--preliminary-archive",
        default=DEFAULT_PRELIMINARY_ARCHIVE,
        help=f"예비 명부 고정 저장 경로(기본: {DEFAULT_PRELIMINARY_ARCHIVE}). export-preliminary 출력 및 본후보 크롤 시 상속 소스.",
    )
    parser.add_argument(
        "--no-preliminary-merge",
        action="store_true",
        help="본후보(또는 일반) 크롤 시 예비 고정본(--preliminary-archive)에서 상속하지 않습니다.",
    )
    parser.add_argument(
        "--nec-probe-district",
        default="종로구",
        help="--task nec-probe 시 조회할 자치구명 (기본: 종로구)",
    )
    parser.add_argument(
        "--nec-probe-output-dir",
        default=".",
        help="--task nec-probe 시 nec-probe-council-*.html 저장 디렉터리 (기본: 현재 디렉터리)",
    )
    args = parser.parse_args()

    filt = set(args.districts) if args.districts else None
    if args.task == "nec-probe":
        run_nec_probe(
            district=str(args.nec_probe_district or "종로구").strip(),
            output_dir=str(args.nec_probe_output_dir or ".").strip(),
            election_name=str(args.election_name or DEFAULT_ELECTION_NAME).strip() or DEFAULT_ELECTION_NAME,
        )
        return

    if args.task == "export-preliminary":
        n = export_preliminary_archive(
            source_path=args.output,
            dest_path=str(args.preliminary_archive or DEFAULT_PRELIMINARY_ARCHIVE).strip()
            or DEFAULT_PRELIMINARY_ARCHIVE,
            election_name=str(args.election_name or DEFAULT_ELECTION_NAME).strip() or DEFAULT_ELECTION_NAME,
        )
        dest = str(args.preliminary_archive or DEFAULT_PRELIMINARY_ARCHIVE).strip() or DEFAULT_PRELIMINARY_ARCHIVE
        print(f"예비 명부 고정 저장: {dest} ({n}명)", file=sys.stderr)
        return

    if args.task in ("all", "candidates"):
        rows = crawl(
            mode=args.only,
            towns_filter=filt,
            dry_run=args.dry_run,
            election_name=str(args.election_name or DEFAULT_ELECTION_NAME).strip() or DEFAULT_ELECTION_NAME,
            candidate_status=str(args.candidate_status or DEFAULT_CANDIDATE_STATUS).strip() or DEFAULT_CANDIDATE_STATUS,
        )
        if not args.dry_run:
            if args.snapshot_existing_output:
                snap = snapshot_existing_output_file(args.output)
                if snap:
                    print(f"기존 출력 스냅샷 저장: {snap}", file=sys.stderr)
                else:
                    print("스냅샷: 기존 출력 파일이 없어 건너뜁니다.", file=sys.stderr)
            # merge: preserve previously collected contact/photo/etc even if NEC updates status
            prelim_path = None if args.no_preliminary_merge else str(args.preliminary_archive or "").strip() or None
            rows = merge_with_existing_candidates(
                rows,
                args.output,
                preliminary_archive_path=prelim_path,
            )
            write_status = str(args.candidate_status or DEFAULT_CANDIDATE_STATUS).strip().lower()
            if write_status == "official" and len(rows) == 0:
                prev_n = len(_load_candidates_list_from_file(args.output))
                if prev_n > 0:
                    print(
                        f"[skip] 본후보 크롤 결과가 0명이라 기존 파일을 덮어쓰지 않습니다: {args.output} (기존 {prev_n}명 유지). "
                        "NEC가 아직 본후보를 등록하지 않았으면(표에 「검색된 결과가 없습니다」) 정상입니다. "
                        "그렇지 않다면 브라우저 Network의 electionInfo_report Form Data와 대조해 주세요.",
                        file=sys.stderr,
                    )
                else:
                    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
                    updated_at = datetime.now(ZoneInfo("Asia/Seoul")).replace(microsecond=0)
                    payload = {"updatedAt": updated_at.isoformat(), "candidates": rows}
                    with open(args.output, "w", encoding="utf-8") as f:
                        json.dump(payload, f, ensure_ascii=False, indent=2)
                    print(
                        f"저장 완료: {args.output} ({len(rows)}명, 갱신시각 {payload['updatedAt']})",
                        file=sys.stderr,
                    )
            else:
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
