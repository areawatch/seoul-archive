// api.js - 데이터 정확도 보정 (CSV 쉼표 문제 해결)

let allRawData = [];
let allSummary = {};
let loadedCount = 0;

async function fetchTabData(tab) {
    const url = `https://docs.google.com/spreadsheets/d/e/${sheetKey}/pub?gid=${tab.gid}&output=csv`;
    
    try {
        const response = await fetch(url);
        const data = await response.text();
        
        // CSV의 한 줄씩 처리하되, 따옴표 안의 쉼표는 무시하는 정규식
        const rows = data.split(/\r?\n/).slice(1); 

        rows.forEach(row => {
            // [핵심 수정] 쉼표로 자르되, 따옴표 내부는 보호하는 정규식 파싱
            const columns = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!columns || columns.length < 11) return;

            // 따옴표 제거 및 클리닝
            const clean = (val) => val ? val.replace(/^"|"$/g, "").trim() : "";

            const item = {
                year: clean(columns[1]),        // B열
                district: clean(columns[2]),    // C열
                position: clean(columns[3]),    // D열
                name: clean(columns[4]),        // E열
                party: clean(columns[5]),       // F열
                type: clean(columns[6]),        // G열
                // K열(Index 10) 현재가액을 정확히 숫자로 변환
                value: parseInt(clean(columns[10]).replace(/[^0-9-]/g, "")) || 0
            };

            allRawData.push(item);

            const key = `${item.district}_${item.name}`;
            if (!allSummary[key]) {
                allSummary[key] = {
                    district: item.district,
                    name: item.name,
                    position: item.position,
                    party: item.party,
                    y2026: 0, y2025: 0, y2024: 0, y2023: 0,
                    land2026: 0, building2026: 0,
                    land2025: 0, building2025: 0
                };
            }

            const val = item.value;
            const yr = String(item.year);

            if (yr === "2026") allSummary[key].y2026 += val;
            else if (yr === "2025") allSummary[key].y2025 += val;
            else if (yr === "2024") allSummary[key].y2024 += val;
            else if (yr === "2023") allSummary[key].y2023 += val;

            // 하이라이트 데이터 (정확한 value 기반)
            if (item.type.includes("토지")) {
                if (yr === "2026") allSummary[key].land2026 += val;
                if (yr === "2025") allSummary[key].land2025 += val;
            }
            if (item.type.includes("건물")) {
                if (yr === "2026") allSummary[key].building2026 += val;
                if (yr === "2025") allSummary[key].building2025 += val;
            }
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