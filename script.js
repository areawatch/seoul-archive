// script.js - 메인 컨트롤러 (페이지 구동부)

$(document).ready(function() {
    // 1. 헤더와 푸터 먼저 조립
    loadComponent('header-plugin', 'header.html');
    loadComponent('footer-plugin', 'footer.html');

    // 2. 기존 데이터 로드 시작
    if (typeof sheetTabs !== 'undefined') {
        sheetTabs.forEach(tab => fetchTabData(tab));
    }
});

function renderRouter() {
    let listHtml = '';
    let districtStats = {};
    let partyWealthStats = {};

    let maxWealth = { name: '', value: -Infinity, district: '' };
    let maxGrowth = { name: '', rate: -Infinity, district: '' };
    let maxLandGrowth = { name: '', rate: -Infinity, district: '' };
    let maxBuildingGrowth = { name: '', rate: -Infinity, district: '' };

    // api.js에서 수집된 allSummary 데이터를 가공
    for (let key in allSummary) {
        const item = allSummary[key];
        
        // 자치구 집계
        if (!districtStats[item.district]) districtStats[item.district] = { count: 0, total: 0 };
        districtStats[item.district].count += 1;
        districtStats[item.district].total += item.y2025;

        // 정당 집계
        const pName = item.party || "무소속";
        if (!partyWealthStats[pName]) partyWealthStats[pName] = { count: 0, total: 0 };
        partyWealthStats[pName].count += 1;
        partyWealthStats[pName].total += item.y2025;

        // 하이라이트 계산
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

        // 목록용 HTML
        const r2425 = item.y2024 > 0 ? ((item.y2025 - item.y2024) / Math.abs(item.y2024)) * 100 : null;
        const r2324 = item.y2023 > 0 ? ((item.y2024 - item.y2023) / Math.abs(item.y2023)) * 100 : null;
        const pColor = (typeof partyColors !== 'undefined') ? (partyColors[item.party] || "#707070") : "#707070";

        listHtml += `<tr onclick="showDetail('${item.name}', '${item.district}')" style="cursor:pointer;">
            <td>${item.district}</td><td>${item.position}</td>
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

    // 하이라이트 전역 변수 업데이트 (ui.js 등에서 참조)
    highlights = { wealth: maxWealth, growth: maxGrowth, land: maxLandGrowth, building: maxBuildingGrowth };

    // 상단 요약 정보 반영
    if (document.getElementById('total-members')) {
        document.getElementById('total-members').innerText = Object.keys(allSummary).length.toLocaleString();
    }
    if (document.getElementById('update-time')) {
        const now = new Date();
        document.getElementById('update-time').innerText = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    // 1. 차트 처리 (분석 페이지일 때)
    if (document.getElementById('districtChart')) {
        if (typeof drawAllCharts === 'function') {
            drawAllCharts(districtStats, partyWealthStats);
        }
        if (document.getElementById('stat-section')) document.getElementById('stat-section').style.display = 'block';
    }
    
    // 2. 리스트 처리 (메인 페이지일 때)
    if (document.getElementById('analysisTable')) {
        const fmtH = (m) => `<span class="highlight-name">${m.district} ${m.name}</span><br>${m.value ? m.value.toLocaleString() + ' 천원' : (m.rate ? m.rate.toFixed(1) + '%' : '-')}`;
        
        if(document.getElementById('max-wealth')) document.getElementById('max-wealth').innerHTML = fmtH(maxWealth);
        if(document.getElementById('max-growth')) document.getElementById('max-growth').innerHTML = fmtH(maxGrowth);
        if(document.getElementById('max-land-growth')) document.getElementById('max-land-growth').innerHTML = fmtH(maxLandGrowth);
        if(document.getElementById('max-building-growth')) document.getElementById('max-building-growth').innerHTML = fmtH(maxBuildingGrowth);
        
        document.getElementById('tableBody').innerHTML = listHtml;
        if(document.getElementById('highlight-section')) document.getElementById('highlight-section').style.display = 'flex';
        if(document.getElementById('list-section')) document.getElementById('list-section').style.display = 'block';
        
        // 데이터테이블 초기화
        $('#analysisTable').DataTable({ 
            pageLength: 50, 
            order: [[3, "desc"]], 
            destroy: true, // 중복 방지
            language: { search: "의원 검색:", lengthMenu: "_MENU_명씩" } 
        });
    }

    // 공통: 로딩 제거
    const loadingElem = document.getElementById('loading');
    if (loadingElem) {
        loadingElem.style.display = 'none';
    }
}
