// api.js - 데이터 로딩 및 파싱 엔진

let allRawData = [];
let allSummary = {};
let highlights = {};
let loadedCount = 0;

function getStandardName(type) {
    const t = type.trim();
    if (t.includes("항공기") || t.includes("부동산에 관한") || t.includes("준용되는")) return "부동산에 관한 규정이 준용되는 권리와 자동차·건설기계·선박 및 항공기";
    if (t.includes("고지거부") || t.includes("등록제외")) return "고지거부 및 등록제외사항";
    if (t.includes("출자지분")) return "합명·합자·유한회사 출자지분";
    if (t.includes("정치자금")) return "정치자금의 수입 및 지출을 위한 예금계좌의 예금";
    return t;
}

function fetchTabData(tab) {
    const url = `https://docs.google.com/spreadsheets/d/e/${sheetKey}/pub?gid=${tab.gid}&output=csv`;
    fetch(url).then(res => res.text()).then(csvText => {
        const rows = csvText.split(/\r?\n/);
        rows.forEach((rowStr, index) => {
            if (index === 0 || !rowStr.trim()) return;
            const row = rowStr.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!row || row.length < 11) return;
            const clean = (str) => str ? str.replace(/^"|"$/g, '').trim() : "";
            
            const year = clean(row[1]);
            const pos = clean(row[3]);
            const name = clean(row[4]);
            const party = clean(row[5]);
            const type = getStandardName(clean(row[6]));
            const val = parseInt(clean(row[10]).replace(/[^0-9-]/g, '')) || 0;
            
            if (!name || name === "성명") return;

            allRawData.push({ district: tab.name, position: pos, name: name, party: party, year: year, type: type, value: val });
            const key = tab.name + "_" + name;
            
            if (!allSummary[key]) {
                allSummary[key] = { district: tab.name, name: name, party: party, position: pos, y2025: 0, y2024: 0, y2023: 0, land2025: 0, land2024: 0, building2025: 0, building2024: 0 };
            }
            
            if (year == "2025") {
                allSummary[key].y2025 += val;
                if (type.includes("토지") || type.includes("부동산에 관한")) allSummary[key].land2025 += val;
                else if (type.includes("건물")) allSummary[key].building2025 += val;
            } else if (year == "2024") {
                allSummary[key].y2024 += val;
                if (type.includes("토지") || type.includes("부동산에 관한")) allSummary[key].land2024 += val;
                else if (type.includes("건물")) allSummary[key].building2024 += val;
            } else if (year == "2023") allSummary[key].y2023 += val;
        });
        loadedCount++;
        if (document.getElementById('progress-bar')) document.getElementById('progress-bar').style.width = (loadedCount / sheetTabs.length) * 100 + "%";
        if (loadedCount === sheetTabs.length) renderRouter();
    }).catch(err => {
        console.error(tab.name + " 로드 실패", err);
        loadedCount++; 
        if (loadedCount === sheetTabs.length) renderRouter();
    });
}
