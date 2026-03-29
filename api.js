// api.js - 데이터 정확도 보정 및 M열(비고) 추출 추가

let allRawData = [];
let allSummary = {};
let loadedCount = 0;

async function fetchTabData(tab) {
    const url = `https://docs.google.com/spreadsheets/d/e/${sheetKey}/pub?gid=${tab.gid}&output=csv`;
    
    try {
        const response = await fetch(url);
        const data = await response.text();
        const rows = data.split(/\r?\n/).slice(1); 

        rows.forEach(row => {
            if (!row.trim()) return;

            // [수정] 빈 열(,,)을 정확히 인식하기 위한 파싱 로직
            const columns = [];
            let curr = "";
            let inQuotes = false;
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    columns.push(curr.trim());
                    curr = "";
                } else {
                    curr += char;
                }
            }
            columns.push(curr.trim()); // 마지막 열 추가

            if (columns.length < 11) return;

            const clean = (val) => val ? val.replace(/^"|"$/g, "").trim() : "";

            const item = {
                year: clean(columns[1]),        // B열 (연도)
                district: clean(columns[2]),    // C열 (자치구)
                position: clean(columns[3]),    // D열 (직위)
                name: clean(columns[4]),        // E열 (성명)
                party: clean(columns[5]),       // F열 (소속정당)
                type: clean(columns[6]),        // G열 (재산대분류 - 실제 항목명)
                value: parseInt(clean(columns[10]).replace(/[^0-9-]/g, "")) || 0, // K열 (현재가액)
                note: clean(columns[12])        // M열 (비고1) - 인덱스 12 고정
            };

            allRawData.push(item);

            const key = `${item.district}_${item.name}`;
            if (!allSummary[key]) {
                allSummary[key] = {
                    district: item.district, name: item.name,
                    position: item.position, party: item.party,
                    y2026: 0, y2025: 0, y2024: 0, y2023: 0,
                    land2026: 0, building2026: 0
                };
            }

            const val = item.value;
            const yr = String(item.year);
            if (yr === "2026") allSummary[key].y2026 += val;
            else if (yr === "2025") allSummary[key].y2025 += val;
            else if (yr === "2024") allSummary[key].y2024 += val;
            else if (yr === "2023") allSummary[key].y2023 += val;
        });
        checkAllLoaded();
    } catch (error) {
        console.error(`${tab.name} 로드 실패:`, error);
        checkAllLoaded();
    }
}

function checkAllLoaded() {
    loadedCount++;
    if (loadedCount === sheetTabs.length) {
        if (typeof renderRouter === 'function') renderRouter();
    }
}