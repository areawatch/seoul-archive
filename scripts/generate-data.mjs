import fs from "node:fs/promises";

const sheetKey =
  "2PACX-1vSbGPniWhU5p7Lk2u5XP8GwljzzefLiV9aEIrO18zcANUEKVPVvabNUQMal2UMAZz2bAAAbVEKFUi2y";

const sheetTabs = [
  { name: "구청장", gid: "0" },
  { name: "강남구", gid: "518648633" },
  { name: "강동구", gid: "1323490210" },
  { name: "강북구", gid: "1934460641" },
  { name: "강서구", gid: "1178062280" },
  { name: "관악구", gid: "871169057" },
  { name: "광진구", gid: "134877668" },
  { name: "구로구", gid: "1764576351" },
  { name: "금천구", gid: "989163989" },
  { name: "노원구", gid: "2095622784" },
  { name: "도봉구", gid: "400936448" },
  { name: "동대문구", gid: "1115421476" },
  { name: "동작구", gid: "517245071" },
  { name: "마포구", gid: "2016119575" },
  { name: "서대문구", gid: "1183726382" },
  { name: "서초구", gid: "1858753569" },
  { name: "성동구", gid: "141844166" },
  { name: "성북구", gid: "411459863" },
  { name: "송파구", gid: "247934569" },
  { name: "양천구", gid: "1526704188" },
  { name: "영등포구", gid: "1710745572" },
  { name: "용산구", gid: "831935711" },
  { name: "은평구", gid: "853986253" },
  { name: "종로구", gid: "1393867186" },
  { name: "중구", gid: "718909410" },
  { name: "중랑구", gid: "226916490" }
];

function isDebtType(type) {
  return /채무|부채/.test(String(type || ""));
}

function clean(val) {
  if (val == null) return "";
  return String(val).replace(/^"|"$/g, "").trim();
}

function parseCsvLine(line) {
  // Simple CSV parser with quote handling.
  const cols = [];
  let curr = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      curr += ch;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cols.push(curr.trim());
      curr = "";
      continue;
    }
    curr += ch;
  }
  cols.push(curr.trim());
  return cols;
}

function parseValueToInt(val) {
  const n = parseInt(clean(val).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

async function fetchTabCsv(tab) {
  const url = `https://docs.google.com/spreadsheets/d/e/${sheetKey}/pub?gid=${tab.gid}&output=csv`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${tab.name} (${tab.gid}): ${res.status}`);
  }
  return await res.text();
}

async function main() {
  const allSummary = {};
  const detail = {};

  for (const tab of sheetTabs) {
    const csv = await fetchTabCsv(tab);
    const rows = csv.split(/\r?\n/).slice(1); // drop header

    for (const row of rows) {
      if (!row || !row.trim()) continue;
      const columns = parseCsvLine(row);

      // Required: K열(현재가액) index 10 exists
      if (columns.length < 11) continue;

      const item = {
        year: clean(columns[1]), // B열 (연도)
        district: clean(columns[2]), // C열 (자치구)
        position: clean(columns[3]), // D열 (직위)
        name: clean(columns[4]), // E열 (성명)
        party: clean(columns[5]), // F열 (소속정당)
        type: clean(columns[6]), // G열 (재산대분류)
        value: parseValueToInt(columns[10]), // K열 (현재가액)
        note1: clean(columns[12]), // M열 (비고1)
        note2: clean(columns[13]) // N열 (비고2)
      };

      if (!item.district || !item.name) continue;

      const key = `${item.district}_${item.name}`;
      if (!allSummary[key]) {
        allSummary[key] = {
          district: item.district,
          name: item.name,
          position: item.position,
          party: item.party,
          y2026: 0,
          y2025: 0,
          y2024: 0,
          y2023: 0,
          land2026: 0,
          building2026: 0
        };
      } else {
        // prefer non-empty meta if any tab had blanks
        if (!allSummary[key].position && item.position) allSummary[key].position = item.position;
        if (!allSummary[key].party && item.party) allSummary[key].party = item.party;
      }

      // ---- detail.json (모달 상세용) ----
      if (!detail[key]) {
        detail[key] = {
          district: item.district,
          name: item.name,
          position: item.position,
          party: item.party,
          types: {}
        };
      } else {
        // prefer non-empty meta if any tab had blanks
        if (!detail[key].position && item.position) detail[key].position = item.position;
        if (!detail[key].party && item.party) detail[key].party = item.party;
      }

      const typeKey = item.type || "";
      const yearKey = item.year || "";
      if (typeKey && yearKey) {
        if (!detail[key].types[typeKey]) detail[key].types[typeKey] = {};
        if (!detail[key].types[typeKey][yearKey]) {
          detail[key].types[typeKey][yearKey] = { valueRaw: 0, note1: "", note2: "" };
        }

        // 값은 원본(K열) 그대로 누적
        detail[key].types[typeKey][yearKey].valueRaw += item.value;
        // 비고는 현재 UI처럼 "마지막 값 덮어쓰기"와 동일하게 맞춤
        detail[key].types[typeKey][yearKey].note1 = item.note1 || "";
        detail[key].types[typeKey][yearKey].note2 = item.note2 || "";
      }

      const yr = String(item.year);
      const signedVal = isDebtType(item.type) ? -item.value : item.value;
      if (yr === "2026") allSummary[key].y2026 += signedVal;
      else if (yr === "2025") allSummary[key].y2025 += signedVal;
      else if (yr === "2024") allSummary[key].y2024 += signedVal;
      else if (yr === "2023") allSummary[key].y2023 += signedVal;

      // TOP5용 토지/건물 (2026년 기준) — 채무 감산과 무관하게 원 값으로 합산
      if (yr === "2026") {
        if (String(item.type).includes("토지")) allSummary[key].land2026 += item.value;
        if (String(item.type).includes("건물")) allSummary[key].building2026 += item.value;
      }
    }
  }

  // Stable key order for diffs
  const sorted = Object.fromEntries(Object.entries(allSummary).sort((a, b) => a[0].localeCompare(b[0], "ko")));
  await fs.writeFile("data.json", JSON.stringify(sorted, null, 2) + "\n", "utf8");
  console.log(`✅ data.json generated (${Object.keys(sorted).length} people)`);

  const sortedDetail = Object.fromEntries(
    Object.entries(detail).sort((a, b) => a[0].localeCompare(b[0], "ko"))
  );
  await fs.writeFile("detail.json", JSON.stringify(sortedDetail, null, 2) + "\n", "utf8");
  console.log(`✅ detail.json generated (${Object.keys(sortedDetail).length} people)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

