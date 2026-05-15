#!/usr/bin/env python3
"""서울 25구 선거구별 의원정수를 선관위 BIGI05에서 수집해 JSON으로 저장합니다."""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from bs4 import BeautifulSoup  # noqa: E402

from crawl_candidates import (  # noqa: E402
    COUNCIL_ELECTION_CODE,
    ELECTION_ID,
    METRO_COUNCIL_ELECTION_CODE,
    fetch_seoul_towns,
)

BASE = "https://info.nec.go.kr"
DEFAULT_OUT = ROOT / "public/data/seoul-constituency-seats.json"
REQUEST_PAUSE_SEC = 0.25


def fetch_bigi05_rows(session, election_code: str, town_code: str) -> list[dict]:
    url = urljoin(BASE, "/electioninfo/electionInfo_report.xhtml")
    form = {
        "electionId": ELECTION_ID,
        "requestURI": f"/electioninfo/{ELECTION_ID}/bi/bigi05.jsp",
        "topMenuId": "BI",
        "secondMenuId": "BIGI05",
        "menuId": "BIGI05",
        "statementId": "BIGI05",
        "electionCode": election_code,
        "cityCode": "1100",
        "townCode": town_code,
        "sggTownCode": "0",
        "sggCityCode": "-1",
        "dateCode": "0",
        "proportionalRepresentationCode": "-1",
    }
    referer = (
        f"{BASE}/main/showDocument.xhtml?electionId={ELECTION_ID}"
        "&topMenuId=BI&secondMenuId=BIGI05"
    )
    r = session.post(url, data=form, timeout=60, headers={"Referer": referer})
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    out: list[dict] = []
    for tr in soup.select("table tr"):
        tds = [td.get_text(strip=True) for td in tr.select("td")]
        if len(tds) >= 3 and tds[2].isdigit():
            out.append(
                {
                    "district": tds[0],
                    "constituency": tds[1],
                    "seats": int(tds[2]),
                }
            )
    return out


def main() -> None:
    import requests

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "ko-KR,ko;q=0.9",
        }
    )

    towns = fetch_seoul_towns(election_code=COUNCIL_ELECTION_CODE)
    by_constituency: dict[str, int] = {}
    council: list[dict] = []
    metro: list[dict] = []

    for i, town in enumerate(towns):
        council_rows = fetch_bigi05_rows(session, COUNCIL_ELECTION_CODE, town["code"])
        metro_rows = fetch_bigi05_rows(session, METRO_COUNCIL_ELECTION_CODE, town["code"])
        council.extend(council_rows)
        metro.extend(metro_rows)
        for row in council_rows + metro_rows:
            by_constituency[row["constituency"]] = row["seats"]
        if i + 1 < len(towns):
            time.sleep(REQUEST_PAUSE_SEC)

    payload = {
        "updatedAt": datetime.now(ZoneInfo("Asia/Seoul")).isoformat(timespec="seconds"),
        "source": "info.nec.go.kr electionInfo_report.xhtml (BIGI05 / bigi05.jsp)",
        "electionId": ELECTION_ID,
        "byConstituency": by_constituency,
        "defaults": {"구청장": 1, "시의원": 1},
        "council": council,
        "metro": metro,
    }

    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote {len(by_constituency)} constituencies → {out_path}")


if __name__ == "__main__":
    main()
