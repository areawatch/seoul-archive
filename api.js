// api.js - 데이터 정확도 보정, M열(비고) 추출 및 토지/건물 합산 복구

let allRawData = [];
let allSummary = {};
let loadedCount = 0;

async function loadArchiveDataFromJson() {
    // URL에 매번 다른 쿼리를 붙이면 CDN·브라우저 캐시가 무력화되어 트래픽 급증 시 불리함.
    // 배포 시 파일이 바뀌면 ETag가 달라져 304/신규 본문으로 갱신됨.
    const [summaryRes, detailRes] = await Promise.all([fetch("/data.json"), fetch("/detail.json")]);

    if (!summaryRes.ok) throw new Error("data.json 로드 실패");
    if (!detailRes.ok) throw new Error("detail.json 로드 실패");

    const summaryData = await summaryRes.json();
    const detailData = await detailRes.json();

    allSummary = summaryData || {};
    const raw = [];

    // detail.json -> showDetail/chart.js가 기대하는 allRawData 배열 형태로 변환
    Object.keys(detailData || {}).forEach(personKey => {
        const person = detailData[personKey];
        if (!person || !person.types) return;

        const district = person.district || "";
        const name = person.name || "";
        const position = person.position || "";
        const party = person.party || "";

        Object.keys(person.types).forEach(type => {
            const byYear = person.types[type] || {};
            Object.keys(byYear).forEach(yr => {
                const rec = byYear[yr] || {};
                const valueRaw = Number(rec.valueRaw) || 0;
                raw.push({
                    year: String(yr),
                    district,
                    position,
                    party,
                    name,
                    type,
                    value: valueRaw, // 원본 K열 값(천원)
                    note: rec.note1 || "",
                    note2: rec.note2 || ""
                });
            });
        });
    });

    allRawData = raw;
}

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

            // 필수: K열(현재가액)=10 까지는 있어야 함
            // M/N(비고1/2)은 비어있을 수 있어 columns 길이가 짧아도 스킵하면 안 됨
            if (columns.length < 11) return;

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
                    re2023: 0, re2024: 0, re2025: 0, re2026: 0,
                    fin2023: 0, fin2024: 0, fin2025: 0, fin2026: 0,
                    land2026: 0, building2026: 0,
                    cash2026: 0, deposit2026: 0, stock2026: 0,
                    bond2026: 0, virtual2026: 0
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

            // 2. 연도별 부동산·금융 (채무 감산과 무관, 원값)
            if (yr === "2023" || yr === "2024" || yr === "2025" || yr === "2026") {
                const t = String(item.type || "");
                if (t.includes("토지")) {
                    if (yr === "2026") allSummary[key].land2026 += val;
                    allSummary[key][`re${yr}`] += val;
                }
                if (t.includes("건물")) {
                    if (yr === "2026") allSummary[key].building2026 += val;
                    allSummary[key][`re${yr}`] += val;
                }
                if (t.includes("현금")) {
                    if (yr === "2026") allSummary[key].cash2026 += val;
                    allSummary[key][`fin${yr}`] += val;
                }
                if (t.includes("예금")) {
                    if (yr === "2026") allSummary[key].deposit2026 += val;
                    allSummary[key][`fin${yr}`] += val;
                }
                if (t.includes("증권")) {
                    if (yr === "2026") allSummary[key].stock2026 += val;
                    allSummary[key][`fin${yr}`] += val;
                }
                if (t.includes("채권")) {
                    if (yr === "2026") allSummary[key].bond2026 += val;
                    allSummary[key][`fin${yr}`] += val;
                }
                if (t.includes("가상자산")) {
                    if (yr === "2026") allSummary[key].virtual2026 += val;
                    allSummary[key][`fin${yr}`] += val;
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
        console.log("✅ 모든 시트 데이터 로드 완료!");
        if (typeof renderRouter === 'function') renderRouter();
    }
}