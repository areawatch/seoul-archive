// api.js - 데이터 정확도 보정, M열(비고) 추출 및 토지/건물 합산 복구

let allRawData = [];
let allSummary = {};
let loadedCount = 0;

function isDebtType(type) {
    if (!type) return false;
    return /채무|부채/.test(String(type));
}

async function fetchTabData(tab) {
    const url = `https://docs.google.com/spreadsheets/d/e/${sheetKey}/pub?gid=${tab.gid}&output=csv`;
    
    try {
        const response = await fetch(url);
        const data = await response.text();
        const rows = data.split(/\r?\n/).slice(1); 

        rows.forEach(row => {
            if (!row.trim()) return;

            // 빈 열(,,)을 정확히 인식하기 위한 파싱 로직
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
            columns.push(curr.trim()); 

            // K열(현재가액)=10, M열(비고1)=12, N열(비고2)=13 사용
            if (columns.length < 14) return;

            const clean = (val) => val ? val.replace(/^"|"$/g, "").trim() : "";

            const item = {
                year: clean(columns[1]),        // B열 (연도)
                district: clean(columns[2]),    // C열 (자치구)
                position: clean(columns[3]),    // D열 (직위)
                name: clean(columns[4]),        // E열 (성명)
                party: clean(columns[5]),       // F열 (소속정당)
                type: clean(columns[6]),        // G열 (재산대분류)
                value: parseInt(clean(columns[10]).replace(/[^0-9-]/g, "")) || 0, // K열 (현재가액)
                note: clean(columns[12]),       // M열 (비고1)
                note2: clean(columns[13])       // N열 (비고2)
            };

            allRawData.push(item);

            const key = `${item.district}_${item.name}`;
            if (!allSummary[key]) {
                allSummary[key] = {
                    district: item.district, name: item.name,
                    position: item.position, party: item.party,
                    y2026: 0, y2025: 0, y2024: 0, y2023: 0,
                    land2026: 0, building2026: 0 // 초기값 설정
                };
            }

            const val = item.value;
            const yr = String(item.year);
            const signedVal = isDebtType(item.type) ? -val : val;
            
            // 1. 연도별 전체 재산 합산
            if (yr === "2026") allSummary[key].y2026 += signedVal;
            else if (yr === "2025") allSummary[key].y2025 += signedVal;
            else if (yr === "2024") allSummary[key].y2024 += signedVal;
            else if (yr === "2023") allSummary[key].y2023 += signedVal;

            // 2. [복구 완료] 상단 TOP5용 토지/건물 개별 합산 (2026년 기준)
            if (yr === "2026") {
                if (item.type.includes("토지")) {
                    allSummary[key].land2026 += val;
                }
                if (item.type.includes("건물")) {
                    allSummary[key].building2026 += val;
                }
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

function checkAllLoaded() {
    loadedCount++;
    if (loadedCount === sheetTabs.length) {
        console.log("✅ 모든 시트 데이터 로드 완료!");
        
        // 데이터 로드 완료 후, 현재 페이지에 renderRouter 함수가 있다면 실행시킵니다.
        if (typeof renderRouter === 'function') {
            renderRouter();
        }
    }
}