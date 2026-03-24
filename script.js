const sheetKey = '2PACX-1vSbGPniWhU5p7Lk2u5XP8GwljzzefLiV9aEIrO18zcANUEKVPVvabNUQMal2UMAZz2bAAAbVEKFUi2y';
const sheetTabs = [
    { name: "강남구", gid: "518648633" }, { name: "강동구", gid: "1323490210" }, { name: "강북구", gid: "1934460641" },
    { name: "강서구", gid: "1178062280" }, { name: "관악구", gid: "871169057" }, { name: "광진구", gid: "134877668" },
    { name: "구로구", gid: "1764576351" }, { name: "금천구", gid: "989163989" }, { name: "노원구", gid: "2095622784" },
    { name: "도봉구", gid: "400936448" }, { name: "동대문구", gid: "1115421476" }, { name: "동작구", gid: "517245071" },
    { name: "마포구", gid: "2016119575" }, { name: "서대문구", gid: "1183726382" }, { name: "서초구", gid: "1858753569" },
    { name: "성동구", gid: "141844166" }, { name: "성북구", gid: "411459863" }, { name: "송파구", gid: "247934569" },
    { name: "양천구", gid: "1526704188" }, { name: "영등포구", gid: "1710745572" }, { name: "용산구", gid: "831935711" },
    { name: "은평구", gid: "853986253" }, { name: "종로구", gid: "1393867186" }, { name: "중구", gid: "718909410" },
    { name: "중랑구", gid: "226916490" }
];

let allRawData = [];
let allSummary = {};
let highlights = {};
let loadedCount = 0;
let myChart = null;
let myPieChart = null;
let myPartyAvgChart = null;

const partyColors = {
    "국민의힘": "#E61E2B",
    "더불어민주당": "#004EA2",
    "정의당": "#FFCA05",
    "진보당": "#D6001C",
    "무소속": "#707070",
    "기본소득당": "#00D2C3",
    "개혁신당": "#FF7F32"
};

$(document).ready(function() {
    sheetTabs.forEach(tab => fetchTabData(tab));
});

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
    }).catch(err => console.error(tab.name + " 로드 실패", err));
}

function renderRouter() {
    let listHtml = '';
    let districtStats = {};
    let partyWealthStats = {}; // { "국민의힘": { count: 0, total: 0 }, ... }

    for (let key in allSummary) {
        const item = allSummary[key];
        
        // 자치구 집계
        if (!districtStats[item.district]) districtStats[item.district] = { count: 0, total: 0 };
        districtStats[item.district].count += 1;
        districtStats[item.district].total += item.y2025;

        // 정당 집계 (인원수 + 재산총액)
        const pName = item.party || "무소속";
        if (!partyWealthStats[pName]) partyWealthStats[pName] = { count: 0, total: 0 };
        partyWealthStats[pName].count += 1;
        partyWealthStats[pName].total += item.y2025;

        // 목록 생성 등 생략(index.html 용)
    }

    // 상단 정보 업데이트
    const totalCount = Object.keys(allSummary).length;
    const totalElem = document.getElementById('total-members');
    if (totalElem) totalElem.innerText = totalCount.toLocaleString();

    // 차트 그리기
    if (document.getElementById('districtChart')) {
        drawAllCharts(districtStats, partyWealthStats);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('stat-section').style.display = 'block';
    }
}

function drawAllCharts(dStats, pStats) {
    // 1. 자치구별 평균 재산액 (막대)
    const ctxBar = document.getElementById('districtChart').getContext('2d');
    const sortedD = Object.keys(dStats).map(name => ({ name, avg: dStats[name].total / dStats[name].count })).sort((a, b) => b.avg - a.avg);
    if (myChart) myChart.destroy();
    myChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: sortedD.map(i => i.name),
            datasets: [{ label: '1인당 평균 재산액', data: sortedD.map(i => i.avg), backgroundColor: 'rgba(13, 110, 253, 0.7)', borderRadius: 5 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
    });

    // 2. 정당별 인원 비중 (도넛)
    const ctxPie = document.getElementById('partyPieChart').getContext('2d');
    const pLabels = Object.keys(pStats);
    const pCounts = pLabels.map(label => pStats[label].count);
    const pColors = pLabels.map(label => partyColors[label] || "#707070");

    if (myPieChart) myPieChart.destroy();
    myPieChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: pLabels,
            datasets: [{ data: pCounts, backgroundColor: pColors }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // 3. 정당별 평균 재산액 (세로 막대)
    const ctxPartyAvg = document.getElementById('partyAvgChart').getContext('2d');
    const sortedP = pLabels.map(label => ({ label, avg: pStats[label].total / pStats[label].count })).sort((a, b) => b.avg - a.avg);

    if (myPartyAvgChart) myPartyAvgChart.destroy();
    myPartyAvgChart = new Chart(ctxPartyAvg, {
        type: 'bar',
        data: {
            labels: sortedP.map(i => i.label),
            datasets: [{ label: '정당별 평균 재산', data: sortedP.map(i => i.avg), backgroundColor: sortedP.map(i => partyColors[i.label] || "#707070"), borderRadius: 5 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}
