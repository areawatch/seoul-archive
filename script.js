// 1. 항목명 변환 및 툴팁 설정
function formatItemType(type) {
    const names = {
        automobile: { long: "부동산에 관한 규정이 준용되는 권리와 자동차·건설기계·선박 및 항공기", short: "자동차 등" },
        refusal: { long: "고지거부 및 등록제외사항", short: "고지거부" },
        investment: { long: "합명·합자·유한회사 출자지분", short: "출자지분" }
    };
    if (type) {
        let matched = null;
        if (type.includes("부동산에 관한") && type.includes("자동차")) matched = names.automobile;
        else if (type.includes("고지거부")) matched = names.refusal;
        else if (type.includes("합명") && (type.includes("출자지분") || type.includes("유한회사"))) matched = names.investment;

        if (matched) {
            return `<span class="text-nowrap">${matched.short}</span><i class="bi bi-info-circle text-primary ms-1" style="cursor: help; font-size: 0.8rem;" data-bs-toggle="tooltip" data-bs-placement="top" title="${matched.long}"></i>`;
        }
    }
    return type || "";
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

function renderRouter() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    const summaryArray = Object.values(allSummary);
    if (summaryArray.length === 0) return;

    // [복구] 상단 하이라이트 카드 데이터 업데이트 및 섹션 표시
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

    tableBody.innerHTML = listHtml;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('list-section').style.display = 'block';

    if ($.fn.DataTable.isDataTable('#analysisTable')) { $('#analysisTable').DataTable().destroy(); }
    $('#analysisTable').DataTable({ "order": [[3, "desc"]], "pageLength": 25 });
}

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

    let html = `
        <div class="table-responsive">
            <table class="table table-sm table-bordered align-middle mb-0 custom-detail-table">
                <thead class="table-light">
                    <tr>
                        <th style="width:85px">항목</th>
                        <th class="text-end">2026</th>
                        <th class="text-end">2025</th>
                        <th class="text-end">2024</th>
                        <th class="text-end">2023</th>
                    </tr>
                </thead>
                <tbody>`;

    Object.keys(tableSummary).forEach(type => {
        const row = tableSummary[type];
        html += `
            <tr>
                <td class="bg-light fw-bold">${formatItemType(type)}</td>
                <td class="text-end fw-bold text-danger">${row.y26.toLocaleString()}</td>
                <td class="text-end text-muted small">${row.y25.toLocaleString()}</td>
                <td class="text-end text-muted small">${row.y24.toLocaleString()}</td>
                <td class="text-end text-muted small">${row.y23.toLocaleString()}</td>
            </tr>`;
    });

    html += `</tbody>
                <tfoot style="border-top: 1px solid #dee2e6;">
                    <tr class="fw-bold">
                        <td class="text-center bg-light">총계</td>
                        <td class="text-end text-danger">${t26.toLocaleString()}</td>
                        <td class="text-end text-muted small">${t25.toLocaleString()}</td>
                        <td class="text-end text-muted small">${t24.toLocaleString()}</td>
                        <td class="text-end text-muted small">${t23.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table></div>`;
    document.getElementById('detailContent').innerHTML = html;

    const modalEl = document.getElementById('detailModal');
    let myModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalEl.addEventListener('shown.bs.modal', function () {
        if (typeof updateDetailChart === 'function') updateDetailChart(allYearsData);
        [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]')).map(el => new bootstrap.Tooltip(el));
    }, { once: true });
    myModal.show();
}

function updateHighlights(summaryArray) {
    // 2026년 데이터 기준으로 정렬
    const topWealth = [...summaryArray].sort((a, b) => (b.y2026||0) - (a.y2026||0)).slice(0, 5);
    const topGrowth = [...summaryArray].filter(a => (a.y2025||0) > 0)
        .sort((a, b) => ((b.y2026-b.y2025)/b.y2025) - ((a.y2026-a.y2025)/a.y2025)).slice(0, 5);
    const topLand = [...summaryArray].sort((a, b) => (b.land2026||0) - (a.land2026||0)).slice(0, 5);
    const topBuilding = [...summaryArray].sort((a, b) => (b.building2026||0) - (a.building2026||0)).slice(0, 5);

    const fillList = (id, items, type) => {
        const container = document.getElementById(id);
        if (!container) return;
        let html = "";
        items.forEach((item, idx) => {
            let val = 0;
            if (type === 'wealth') val = item.y2026 || 0;
            else if (type === 'growth') val = item.y2025 > 0 ? ((item.y2026 - item.y2025)/item.y2025*100) : 0;
            else if (type === 'land') val = item.land2026 || 0;
            else if (type === 'building') val = item.building2026 || 0;

            // 표시 텍스트 결정
            const valText = type === 'growth' ? (val > 0 ? '+' : '') + val.toFixed(0) + "%" : (val / 100000).toFixed(1) + "억";
            
            html += `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom" 
                     style="font-size: 0.8rem; cursor:pointer;" 
                     onclick="showDetail('${item.name}', '${item.district}')">
                    <span class="text-truncate" style="max-width: 100px;">
                        <span class="text-muted me-1">${idx + 1}.</span>
                        <span class="fw-bold text-dark">${item.name}</span>
                        <small class="text-muted">(${item.district.substring(0,2)})</small>
                    </span>
                    <span class="fw-bold text-danger">${valText}</span>
                </div>`;
        });
        container.innerHTML = html;
    };
    
    fillList('max-wealth-list', topWealth, 'wealth');
    fillList('max-growth-list', topGrowth, 'growth');
    fillList('max-land-list', topLand, 'land');
    fillList('max-building-list', topBuilding, 'building');

    // 하이라이트 섹션 보이기
    const section = document.getElementById('highlight-section');
    if (section) section.style.display = 'flex';
}