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

// 정당별 색상 정의
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
            const party = clean(row[5]); // 정당 정보
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
    let maxWealth = { name: '', value: -Infinity, district: '' };
    let maxGrowth = { name: '', rate: -Infinity, district: '' };
    let maxLandGrowth = { name: '', rate: -Infinity, district: '' };
    let maxBuildingGrowth = { name: '', rate: -Infinity, district: '' };

    for (let key in allSummary) {
        const item = allSummary[key];
        if (!districtStats[item.district]) districtStats[item.district] = { count: 0, total: 0 };
        districtStats[item.district].count += 1;
        districtStats[item.district].total += item.y2025;

        if (item.y2025 > maxWealth.value) maxWealth = { name: item.name, value: item.y2025, district: item.district };
        if (item.y2024 > 0) {
            const rate = ((item.y2025 - item.y2024) / Math.abs(item.y2024)) * 100;
            if (rate > maxGrowth.rate) maxGrowth = { name: item.name, rate: rate, district: item.district };
        }
        if (item.land2024 > 0) {
            const lRate = ((item.land2025 - item.land2024) / Math.abs(item.land2024)) * 100;
            if (lRate > maxLandGrowth.rate) maxLandGrowth = { name: item.name, rate: lRate, district: item.district };
        }
        if (item.building2024 > 0) {
            const bRate = ((item.building2025 - item.building2024) / Math.abs(item.building2024)) * 100;
            if (bRate > maxBuildingGrowth.rate) maxBuildingGrowth = { name: item.name, rate: bRate, district: item.district };
        }

        const r2425 = item.y2024 > 0 ? ((item.y2025 - item.y2024) / Math.abs(item.y2024)) * 100 : null;
        const r2324 = item.y2023 > 0 ? ((item.y2024 - item.y2023) / Math.abs(item.y2023)) * 100 : null;

        // 정당별 색상 배지 생성
        const pColor = partyColors[item.party] || "#707070";

        listHtml += `<tr>
            <td>${item.district}</td>
            <td>${item.position}</td>
            <td>
                <span class="clickable-name" onclick="showDetail('${item.name}', '${item.district}')">${item.name}</span>
                <span class="badge ms-1" style="background-color:${pColor}; font-size: 0.7rem; vertical-align: middle;">${item.party}</span>
            </td>
            <td class="text-right fw-bold text-primary" data-order="${item.y2025}">${item.y2025.toLocaleString()}</td>
            <td class="text-center" data-order="${r2425 ?? -999}"><span class="${r2425 > 0 ? 'up' : 'down'}">${r2425 !== null ? (r2425 > 0 ? '+' : '') + r2425.toFixed(1) + '%' : '-'}</span></td>
            <td class="text-right">${item.y2024.toLocaleString()}</td>
            <td class="text-center" data-order="${r2324 ?? -999}"><span class="${r2324 > 0 ? 'up' : 'down'}">${r2324 !== null ? (r2324 > 0 ? '+' : '') + r2324.toFixed(1) + '%' : '-'}</span></td>
            <td class="text-right">${item.y2023.toLocaleString()}</td>
        </tr>`;
    }

    highlights = { wealth: maxWealth, growth: maxGrowth, land: maxLandGrowth, building: maxBuildingGrowth };

    // 총 의원 수 및 업데이트 시각 반영
    const totalCount = Object.keys(allSummary).length;
    const totalElem = document.getElementById('total-members');
    const timeElem = document.getElementById('update-time');

    if (totalElem) totalElem.innerText = totalCount.toLocaleString();
    if (timeElem) {
        const now = new Date();
        const formattedTime = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        timeElem.innerText = formattedTime;
    }

    if (document.getElementById('districtChart')) {
        drawDistrictChart(districtStats);
        document.getElementById('loading').style.display = 'none';
        if (document.getElementById('stat-section')) document.getElementById('stat-section').style.display = 'block';
    }
    
    if (document.getElementById('analysisTable')) {
        const fmtH = (m) => `<span class="highlight-name">${m.district} ${m.name}</span><br>${m.value ? m.value.toLocaleString() + ' 천원' : m.rate.toFixed(1) + '%'}`;
        document.getElementById('max-wealth').innerHTML = fmtH(maxWealth);
        document.getElementById('max-growth').innerHTML = fmtH(maxGrowth);
        document.getElementById('max-land-growth').innerHTML = fmtH(maxLandGrowth);
        document.getElementById('max-building-growth').innerHTML = fmtH(maxBuildingGrowth);
        
        document.getElementById('tableBody').innerHTML = listHtml;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('highlight-section').style.display = 'flex';
        document.getElementById('list-section').style.display = 'block';
        $('#analysisTable').DataTable({ pageLength: 50, order: [[3, "desc"]], language: { search: "의원 검색:", lengthMenu: "_MENU_명씩" } });
    }
}

function drawDistrictChart(stats) {
    const canvas = document.getElementById('districtChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sorted = Object.keys(stats).map(name => ({ name, avg: stats[name].total / stats[name].count })).sort((a, b) => b.avg - a.avg);
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(i => i.name),
            datasets: [{ label: '1인당 평균 재산액', data: sorted.map(i => i.avg), backgroundColor: 'rgba(13, 110, 253, 0.7)', borderRadius: 5 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function showDetailFromHighlight(type) { if (highlights[type]) showDetail(highlights[type].name, highlights[type].district); }

function showDetail(mName, dName) {
    let mDetail = {};
    allRawData.forEach(row => {
        if (row.name === mName && row.district === dName) {
            if (!mDetail[row.type]) mDetail[row.type] = { y2025: 0, y2024: 0, y2023: 0 };
            if (row.year == "2025") mDetail[row.type].y2025 += row.value;
            else if (row.year == "2024") mDetail[row.type].y2024 += row.value;
            else if (row.year == "2023") mDetail[row.type].y2023 += row.value;
        }
    });
    let dHtml = '';
    const order = ["토지", "건물", "부동산에 관한 규정이 준용되는 권리와 자동차·건설기계·선박 및 항공기", "현금", "예금", "정치자금의 수입 및 지출을 위한 예금계좌의 예금", "증권", "합명·합자·유한회사 출자지분", "채권", "채무", "가상자산", "합계", "고지거부 및 등록제외사항"];
    order.forEach(t => {
        if (mDetail[t]) {
            dHtml += `<tr class="${t.includes('합계') ? 'table-info-custom' : ''}"><td>${t}</td><td class="text-right">${mDetail[t].y2025.toLocaleString()}</td><td class="text-right">${mDetail[t].y2024.toLocaleString()}</td><td class="text-right">${mDetail[t].y2023.toLocaleString()}</td></tr>`;
            delete mDetail[t];
        }
    });
    for (let t in mDetail) dHtml += `<tr><td>${t}</td><td class="text-right">${mDetail[t].y2025.toLocaleString()}</td><td class="text-right">${mDetail[t].y2024.toLocaleString()}</td><td class="text-right">${mDetail[t].y2023.toLocaleString()}</td></tr>`;
    
    document.getElementById('detail-title').innerText = `🏛️ ${dName} ${mName} 상세 리포트`;
    document.getElementById('detailTableBody').innerHTML = dHtml;
    
    if (document.getElementById('highlight-section')) document.getElementById('highlight-section').style.display = 'none';
    if (document.getElementById('list-section')) document.getElementById('list-section').style.display = 'none';
    if (document.getElementById('stat-section')) document.getElementById('stat-section').style.display = 'none';
    
    document.getElementById('detail-section').style.display = 'block';
    window.scrollTo(0, 0);
}

function hideDetail() {
    document.getElementById('detail-section').style.display = 'none';
    if (document.getElementById('highlight-section')) document.getElementById('highlight-section').style.display = 'flex';
    if (document.getElementById('list-section')) document.getElementById('list-section').style.display = 'block';
    if (document.getElementById('stat-section')) document.getElementById('stat-section').style.display = 'block';
}
