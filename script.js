let currentFilter = "전체"; 

// 1. 항목명 변환 및 툴팁 설정
function formatItemType(type) {
    if (!type) return "";
    
    const longNameAutomobile = "부동산에 관한 규정이 준용되는 권리와 자동차·건설기계·선박 및 항공기";
    const longNameRefusal = "고지거부 및 등록제외사항";
    const longNameInvestment = "합명·합자·유한회사 출자지분";
    const longNameNonProfit = "비영리법인에 출연한 재산";
    const longNameGold = "금 및 백금"; 

    if (/자동차|항공기|선박|건설기계/.test(type)) {
        return `<span class="text-nowrap">자동차 등</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameAutomobile}"></i>`;
    }
    if (type.includes("고지거부") || type.includes("등록제외")) {
        return `<span class="text-nowrap">고지거부</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameRefusal}"></i>`;
    }
    if (type.includes("출자지분") || type.includes("유한회사") || type.includes("합명")) {
        return `<span class="text-nowrap">출자지분</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameInvestment}"></i>`;
    }
    if (type.includes("비영리법인") || type === "재산") {
        return `<span class="text-nowrap">비영리</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameNonProfit}"></i>`;
    }
    if (!/예금|적금|현금/.test(type) && (type.includes("금") || type.includes("백금"))) {
        return `<span class="text-nowrap">금</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameGold}"></i>`;
    }

    return type; 
}

function isDebtType(type) {
    if (!type) return false;
    return /채무|부채/.test(String(type));
}

function formatSignedByType(type, value) {
    const v = Number(value) || 0;
    if (isDebtType(type)) return "-" + Math.abs(v).toLocaleString();
    return v.toLocaleString();
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

function filterPosition(pos) {
    currentFilter = pos;
    renderRouter();
}

function renderRouter() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    let summaryArray = Object.values(allSummary);
    if (summaryArray.length === 0) return;

    if (currentFilter === "구청장") {
        summaryArray = summaryArray.filter(item => item.position.includes("구청장"));
    } else if (currentFilter === "구의원") {
        summaryArray = summaryArray.filter(item => !item.position.includes("구청장"));
    }

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

    if ($.fn.DataTable.isDataTable('#analysisTable')) {
        $('#analysisTable').DataTable().clear().destroy();
    }

    tableBody.innerHTML = listHtml;
    
    document.getElementById('loading').style.display = 'none';
    document.getElementById('list-section').style.display = 'block';
    if (document.getElementById('filter-section')) document.getElementById('filter-section').style.display = 'block';

    $('#analysisTable').DataTable({
        "order": [[3, "desc"]],
        "pageLength": 25,
        "autoWidth": false,
        "responsive": true,
        "language": { "search": "검색:", "lengthMenu": "_MENU_ 개씩 보기" }
    });
}

function showDetail(name, district) {
    const allYearsData = allRawData.filter(d => d.name === name && d.district === district);
    if (allYearsData.length === 0) return;

    const tableSummary = {};
    let t26=0, t25=0, t24=0, t23=0;

    allYearsData.forEach(item => {
        const type = item.type;
        if (!tableSummary[type]) {
            tableSummary[type] = { 
                y26:0, y25:0, y24:0, y23:0, 
                n26:"", n25:"", n24:"", n23:"",
                n26_2:"", n25_2:"", n24_2:"", n23_2:""
            };
        }
        const yr = String(item.year);
        const val = item.value;
        const signedVal = isDebtType(type) ? -val : val;
        const note = (item.note && item.note.trim() !== "") ? item.note : "";
        const note2 = (item.note2 && item.note2.trim() !== "") ? item.note2 : "";

        if (yr === "2026") { tableSummary[type].y26 += val; t26 += signedVal; tableSummary[type].n26 = note; tableSummary[type].n26_2 = note2; }
        else if (yr === "2025") { tableSummary[type].y25 += val; t25 += signedVal; tableSummary[type].n25 = note; tableSummary[type].n25_2 = note2; }
        else if (yr === "2024") { tableSummary[type].y24 += val; t24 += signedVal; tableSummary[type].n24 = note; tableSummary[type].n24_2 = note2; }
        else if (yr === "2023") { tableSummary[type].y23 += val; t23 += signedVal; tableSummary[type].n23 = note; tableSummary[type].n23_2 = note2; }
    });

    const posText = (allYearsData[0].position || "").trim();
    const partyText = (allYearsData[0].party || "").trim();
    const titleMain = [allYearsData[0].district, posText, name].filter(Boolean).join(" ");
    const partyColor = (typeof partyColors !== 'undefined' && partyColors[partyText]) ? partyColors[partyText] : "#666";
    const partyBadge = partyText
        ? `<span class="badge ms-2 align-middle" style="background-color:${partyColor}; font-size: 0.75rem;">${partyText}</span>`
        : "";
    document.getElementById('detailModalLabel').innerHTML = `<span class="fw-bold">${titleMain}</span>${partyBadge}`;

    const escapeAttr = (s) => String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // 비고1: 말풍선 / 비고2: ❗ 강조 아이콘
    const getNoteIcons = (note1, note2) => {
        const a = note1 ? escapeAttr(note1) : "";
        const b = note2 ? escapeAttr(note2) : "";
        const icon1 = a
            ? `<i class="bi bi-chat-left-dots me-1" style="cursor: help; font-size: 0.7rem; color: #555555; opacity: 0.85;" data-bs-toggle="tooltip" data-bs-placement="top" title="${a}"></i>`
            : "";
        const icon2 = b
            ? `<i class="bi bi-exclamation-circle-fill me-1" style="cursor: help; font-size: 0.75rem; color: #dc3545; opacity: 0.95;" data-bs-toggle="tooltip" data-bs-placement="top" title="❗ ${b}"></i>`
            : "";
        return icon2 + icon1;
    };

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
                <td class="bg-light fw-bold" style="white-space: normal; min-width: 100px;">
                    ${formatItemType(type)}
                </td>
                <td class="text-end fw-bold text-danger">
                    ${getNoteIcons(row.n26, row.n26_2)}${formatSignedByType(type, row.y26)}
                </td>
                <td class="text-end text-muted small">
                    ${getNoteIcons(row.n25, row.n25_2)}${formatSignedByType(type, row.y25)}
                </td>
                <td class="text-end text-muted small">
                    ${getNoteIcons(row.n24, row.n24_2)}${formatSignedByType(type, row.y24)}
                </td>
                <td class="text-end text-muted small">
                    ${getNoteIcons(row.n23, row.n23_2)}${formatSignedByType(type, row.y23)}
                </td>
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
            const posText = (item.position || "").trim();
            const partyText = (item.party || "").trim();
            const partyColor = (typeof partyColors !== 'undefined' && partyColors[partyText]) ? partyColors[partyText] : "#666";
            const partyBadge = partyText
                ? `<span class="badge ms-1 align-middle" style="background-color:${partyColor}; font-size: 0.6rem;">${partyText}</span>`
                : "";
            
            html += `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom" style="font-size: 0.8rem; cursor:pointer;" onclick="showDetail('${item.name}', '${item.district}')">
                    <span class="text-truncate" style="max-width: 200px;">
                        <span class="text-muted me-1">${idx + 1}.</span>
                        <span class="fw-bold text-dark">${item.name}</span>
                        <small class="text-muted ms-1">${item.district}${posText ? " " + posText : ""}</small>
                        ${partyBadge}
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
    const section = document.getElementById('highlight-section');
    if (section) section.style.display = 'flex';
}