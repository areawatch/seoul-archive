let currentFilter = "전체"; 

// 1. 항목명 변환 및 툴팁 설정
function formatItemType(type) {
    if (!type) return "";
    
    // 툴팁에 표시될 전체 문구 정의
    const longNameAutomobile = "부동산에 관한 규정이 준용되는 권리와 자동차·건설기계·선박 및 항공기";
    const longNameRefusal = "고지거부 및 등록제외사항";
    const longNameInvestment = "합명·합자·유한회사 출자지분";
    const longNameNonProfit = "비영리법인에 출연한 재산";

    // 판별 로직 (단어 포함 여부 및 정확한 일치 여부 체크)
    
    // 1. 자동차 등 (자동차, 항공기, 선박, 건설기계 포함 시)
    if (/자동차|항공기|선박|건설기계/.test(type)) {
        return `<span class="text-nowrap">자동차 등</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameAutomobile}"></i>`;
    }

    // 2. 고지거부
    if (type.includes("고지거부")) {
        return `<span class="text-nowrap">고지거부</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameRefusal}"></i>`;
    }

    // 3. 출자지분
    if (type.includes("출자지분") || type.includes("유한회사") || type.includes("합명")) {
        return `<span class="text-nowrap">출자지분</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameInvestment}"></i>`;
    }

    // 4. 비영리법인 (단어 포함 혹은 항목명이 정확히 "재산"인 경우 대응)
    if (type.includes("비영리법인") || type === "재산") {
        return `<span class="text-nowrap">비영리</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameNonProfit}"></i>`;
    }

    return type; 
}

window.onload = () => {
    if (typeof loadComponent === 'function') {
        loadComponent('header-plugin', 'header.html');
        loadComponent('footer-plugin', 'footer.html');
    }
    if (typeof sheetTabs !== 'undefined') {
        sheetTabs.forEach(tab => fetchTabData(tab));
    }
};

// [개선] 직위 필터 함수 (전)구청장 등 포함 처리
function filterPosition(pos) {
    currentFilter = pos;
    renderRouter();
}

function renderRouter() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    let summaryArray = Object.values(allSummary);
    if (summaryArray.length === 0) return;

    // [핵심] 필터 로직 개선: "구청장" 글자 포함 여부로 판별
    if (currentFilter === "구청장") {
        summaryArray = summaryArray.filter(item => item.position.includes("구청장"));
    } else if (currentFilter === "구의원") {
        summaryArray = summaryArray.filter(item => !item.position.includes("구청장"));
    }

    // 상단 하이라이트 업데이트 (필터링된 데이터 기준)
    updateHighlights(summaryArray);

    let listHtml = "";
    summaryArray.forEach(item => {
        const v26 = item.y2026 || 0;
        const v25 = item.y2025 || 0;
        const v24 = item.y2024 || 0;
        const v23 = item.y2023 || 0;
        const r2526 = v25 > 0 ? ((v26 - v25) / v25 * 100) : null;
        const r2425 = v24 > 0 ? ((v25 - v24) / v24 * 100) : null;
        const r2324 = v23 > 0 ? ((v24 - v23) / v23 * 100) : null;
        const pColor = (typeof partyColors !== 'undefined' && partyColors[item.party]) ? partyColors[item.party] : "#666";

        listHtml += `
            <tr onclick="showDetail('${item.name}', '${item.district}')" style="cursor:pointer;">
                <td>${item.district}</td>
                <td><small>${item.position}</small></td>
                <td>
                    <span class="fw-bold">${item.name}</span>
                    <span class="badge ms-1" style="background-color:${pColor}; font-size: 0.6rem;">${item.party}</span>
                </td>
                <td class="text-end fw-bold text-danger">${v26.toLocaleString()}</td>
                <td class="text-center">
                    <small class="fw-bold ${r2526 > 0 ? 'text-danger' : 'text-primary'}">
                        ${r2526 !== null ? (r2526 > 0 ? '+' : '') + r2526.toFixed(1) + '%' : '-'}
                    </small>
                </td>
                <td class="text-end text-muted small">${v25.toLocaleString()}</td>
                <td class="text-center">
                    <small class="text-muted">${r2425 !== null ? (r2425 > 0 ? '+' : '') + r2425.toFixed(1) + '%' : '-'}</small>
                </td>
                <td class="text-end text-muted small">${v24.toLocaleString()}</td>
                <td class="text-center">
                    <small class="text-muted">${r2324 !== null ? (r2324 > 0 ? '+' : '') + r2324.toFixed(1) + '%' : '-'}</small>
                </td>
                <td class="text-end text-muted small">${v23.toLocaleString()}</td>
            </tr>`;
    });

    // 기존 테이블 파괴
    if ($.fn.DataTable.isDataTable('#analysisTable')) {
        $('#analysisTable').DataTable().clear().destroy();
    }

    tableBody.innerHTML = listHtml;
    
    document.getElementById('loading').style.display = 'none';
    document.getElementById('list-section').style.display = 'block';
    if (document.getElementById('filter-section')) document.getElementById('filter-section').style.display = 'block';

    // [스타일 보정] DataTable 재생성 시 autoWidth 옵션 조정
    $('#analysisTable').DataTable({
        "order": [[3, "desc"]],
        "pageLength": 25,
        "autoWidth": false, // 너비 강제 고정 방지
        "responsive": true,
        "language": { "search": "검색:", "lengthMenu": "_MENU_ 개씩 보기" }
    });
}

// [나머지 showDetail, updateHighlights 함수는 이전과 동일하게 유지]
function showDetail(name, district) {
    const allYearsData = allRawData.filter(d => d.name === name && d.district === district);
    if (allYearsData.length === 0) return;
    const tableSummary = {};
    let t26=0, t25=0, t24=0, t23=0;
    allYearsData.forEach(item => {
        const type = item.type;
        if (!tableSummary[type]) tableSummary[type] = { y26:0, y25:0, y24:0, y23:0 };
        const yr = String(item.year);
        if (yr === "2026") { tableSummary[type].y26 += item.value; t26 += item.value; }
        else if (yr === "2025") { tableSummary[type].y25 += item.value; t25 += item.value; }
        else if (yr === "2024") { tableSummary[type].y24 += item.value; t24 += item.value; }
        else if (yr === "2023") { tableSummary[type].y23 += item.value; t23 += item.value; }
    });
    document.getElementById('detailModalLabel').innerHTML = `<span class="fw-bold">${allYearsData[0].district} ${name}</span> 상세`;
    let html = `<div class="table-responsive"><table class="table table-sm table-bordered align-middle mb-0 custom-detail-table"><thead class="table-light"><tr><th style="width:85px">항목</th><th class="text-end">2026</th><th class="text-end">2025</th><th class="text-end">2024</th><th class="text-end">2023</th></tr></thead><tbody>`;
    Object.keys(tableSummary).forEach(type => {
        const row = tableSummary[type];
        html += `<tr><td class="bg-light fw-bold text-truncate">${formatItemType(type)}</td><td class="text-end fw-bold text-danger">${row.y26.toLocaleString()}</td><td class="text-end text-muted small">${row.y25.toLocaleString()}</td><td class="text-end text-muted small">${row.y24.toLocaleString()}</td><td class="text-end text-muted small">${row.y23.toLocaleString()}</td></tr>`;
    });
    html += `</tbody><tfoot style="border-top: 1px solid #dee2e6;"><tr class="fw-bold"><td class="text-center bg-light">총계</td><td class="text-end text-danger">${t26.toLocaleString()}</td><td class="text-end text-muted small">${t25.toLocaleString()}</td><td class="text-end text-muted small">${t24.toLocaleString()}</td><td class="text-end text-muted small">${t23.toLocaleString()}</td></tr></tfoot></table></div>`;
    document.getElementById('detailContent').innerHTML = html;
    const modalEl = document.getElementById('detailModal');
    let myModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalEl.addEventListener('shown.bs.modal', function () {
        if (typeof updateDetailChart === 'function') updateDetailChart(allYearsData);
        [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]')).map(el => new bootstrap.Tooltip(el));
    }, { once: true });
    myModal.show();
}

function updateHighlights(filteredArray) {
    const topWealth = [...filteredArray].sort((a, b) => (b.y2026||0) - (a.y2026||0)).slice(0, 5);
    const topGrowth = [...filteredArray].filter(a => (a.y2025||0) > 0).sort((a, b) => ((b.y2026-b.y2025)/b.y2025) - ((a.y2026-a.y2025)/a.y2025)).slice(0, 5);
    const topLand = [...filteredArray].sort((a, b) => (b.land2026||0) - (a.land2026||0)).slice(0, 5);
    const topBuilding = [...filteredArray].sort((a, b) => (b.building2026||0) - (a.building2026||0)).slice(0, 5);
    const fillList = (id, items, type) => {
        const container = document.getElementById(id);
        if (!container) return;
        let html = "";
        if (items.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-3" style="font-size:0.8rem;">데이터가 없습니다.</div>`;
            return;
        }
        items.forEach((item, idx) => {
            let val = 0;
            if (type === 'wealth') val = item.y2026 || 0;
            else if (type === 'growth') val = item.y2025 > 0 ? ((item.y2026 - item.y2025)/item.y2025*100) : 0;
            else if (type === 'land') val = item.land2026 || 0;
            else if (type === 'building') val = item.building2026 || 0;
            const valText = type === 'growth' ? (val > 0 ? '+' : '') + val.toFixed(0) + "%" : (val / 100000).toFixed(1) + "억";
            html += `<div class="d-flex justify-content-between align-items-center py-1 border-bottom" style="font-size: 0.8rem; cursor:pointer;" onclick="showDetail('${item.name}', '${item.district}')"><span class="text-truncate" style="max-width: 100px;"><span class="text-muted me-1">${idx + 1}.</span><span class="fw-bold text-dark">${item.name}</span><small class="text-muted">(${item.district.substring(0,2)})</small></span><span class="fw-bold text-danger">${valText}</span></div>`;
        });
        container.innerHTML = html;
    };
    fillList('max-wealth-list', topWealth, 'wealth');
    fillList('max-growth-list', topGrowth, 'growth');
    fillList('max-land-list', topLand, 'land');
    fillList('max-building-list', topBuilding, 'building');
    const section = document.getElementById('highlight-section');
    if (section) section.style.display = 'flex';
}