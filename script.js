// 1. 항목명 변환 및 툴팁 설정
function formatItemType(type) {
    const names = {
        automobile: {
            long: "부동산에 관한 규정이 준용되는 권리와 자동차·건설기계·선박 및 항공기",
            short: "자동차 등"
        },
        refusal: {
            long: "고지거부 및 등록제외사항",
            short: "고지거부"
        },
        investment: {
            long: "합명·합자·유한회사 출자지분",
            short: "출자지분"
        }
    };

    if (type) {
        let matched = null;
        if (type.includes("부동산에 관한") && type.includes("자동차")) matched = names.automobile;
        else if (type.includes("고지거부")) matched = names.refusal;
        else if (type.includes("합명") && (type.includes("출자지분") || type.includes("유한회사"))) matched = names.investment;

        if (matched) {
            return `
                <span class="text-nowrap">${matched.short}</span>
                <i class="bi bi-info-circle text-primary ms-1" 
                   style="cursor: help; font-size: 0.8rem;" 
                   data-bs-toggle="tooltip" 
                   data-bs-placement="top" 
                   title="${matched.long}"></i>
            `;
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

    updateHighlights(summaryArray);

    let listHtml = "";
    summaryArray.forEach(item => {
        const r2425 = item.y2024 > 0 ? ((item.y2025 - item.y2024) / item.y2024 * 100) : null;
        const r2324 = item.y2023 > 0 ? ((item.y2024 - item.y2023) / item.y2023 * 100) : null;
        const pColor = item.party.includes('더불어민주당') ? '#004ea2' : (item.party.includes('국민의힘') ? '#e61e2b' : '#666');

        listHtml += `
            <tr onclick="showDetail('${item.name}', '${item.district}')" style="cursor:pointer;">
                <td>${item.district}</td>
                <td><small>${item.position}</small></td>
                <td>
                    <span class="fw-bold">${item.name}</span>
                    <span class="badge ms-1" style="background-color:${pColor}; font-size: 0.7rem;">${item.party}</span>
                </td>
                <td class="text-end fw-bold text-primary">${item.y2025.toLocaleString()}</td>
                <td class="text-center">
                    <small class="fw-bold ${r2425 > 0 ? 'text-danger' : 'text-primary'}">
                        ${r2425 !== null ? (r2425 > 0 ? '+' : '') + r2425.toFixed(1) + '%' : '-'}
                    </small>
                </td>
                <td class="text-end text-muted">${item.y2024.toLocaleString()}</td>
                <td class="text-center">
                    <small class="${r2324 > 0 ? 'text-danger' : 'text-primary'}">
                        ${r2324 !== null ? (r2324 > 0 ? '+' : '') + r2324.toFixed(1) + '%' : '-'}
                    </small>
                </td>
                <td class="text-end text-muted">${item.y2023.toLocaleString()}</td>
            </tr>`;
    });

    tableBody.innerHTML = listHtml;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('list-section').style.display = 'block';

    if ($.fn.DataTable.isDataTable('#analysisTable')) {
        $('#analysisTable').DataTable().destroy();
    }
    $('#analysisTable').DataTable({
        "order": [[3, "desc"]],
        "language": { "search": "의원명/구 검색:", "lengthMenu": "_MENU_ 개씩 보기" },
        "pageLength": 25
    });
}

function showDetail(name, district) {
    const allYearsData = allRawData.filter(d => d.name === name && d.district === district);
    if (allYearsData.length === 0) return;

    const tableSummary = {};
    let total25 = 0, total24 = 0, total23 = 0;
    
    allYearsData.forEach(item => {
        const type = item.type;
        if (!tableSummary[type]) {
            tableSummary[type] = { y25: 0, y24: 0, y23: 0 };
        }
        if (String(item.year) === "2025") {
            tableSummary[type].y25 += item.value;
            total25 += item.value;
        }
        else if (String(item.year) === "2024") {
            tableSummary[type].y24 += item.value;
            total24 += item.value;
        }
        else if (String(item.year) === "2023") {
            tableSummary[type].y23 += item.value;
            total23 += item.value;
        }
    });

    const p = allYearsData[0];
    document.getElementById('detailModalLabel').innerHTML = `
        <span class="fw-bold">${p.district} ${p.name}</span> 
        <small class="text-muted" style="font-size: 0.8rem;">(${p.party}) 재산 상세</small>
    `;

    // 너비 조정: 항목(40%) + 연도별 3개(각 20%) = 100%
    let html = `
        <div class="table-responsive">
            <table class="table table-sm table-bordered align-middle mb-0" style="font-size: 0.85rem; table-layout: fixed; width: 100%;">
                <thead class="table-light">
                    <tr>
                        <th style="width:40%">항목</th>
                        <th style="width:20%" class="text-end">2025</th>
                        <th style="width:20%" class="text-end">2024</th>
                        <th style="width:20%" class="text-end">2023</th>
                    </tr>
                </thead>
                <tbody>`;

    Object.keys(tableSummary).forEach(type => {
        const row = tableSummary[type];
        html += `
            <tr>
                <td class="bg-light fw-bold text-truncate">${formatItemType(type)}</td>
                <td class="text-end fw-bold text-primary">${row.y25.toLocaleString()}</td>
                <td class="text-end text-muted small">${row.y24.toLocaleString()}</td>
                <td class="text-end text-muted small">${row.y23.toLocaleString()}</td>
            </tr>`;
    });

    html += `</tbody>
                <tfoot style="border-top: 1px solid #dee2e6;">
                    <tr class="fw-bold">
                        <td class="text-center bg-light">총계</td>
                        <td class="text-end text-primary">${total25.toLocaleString()}</td>
                        <td class="text-end text-muted small">${total24.toLocaleString()}</td>
                        <td class="text-end text-muted small">${total23.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table></div>`;
            
    document.getElementById('detailContent').innerHTML = html;

    const modalEl = document.getElementById('detailModal');
    let myModal = bootstrap.Modal.getOrCreateInstance(modalEl);

    modalEl.addEventListener('shown.bs.modal', function () {
        if (typeof updateDetailChart === 'function') {
            updateDetailChart(allYearsData);
        }
        
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }, { once: true });

    myModal.show();
}

function updateHighlights(summaryArray) {
    const topWealth = [...summaryArray].sort((a, b) => b.y2025 - a.y2025).slice(0, 5);
    const topGrowth = [...summaryArray].filter(a => a.y2024 > 0)
        .sort((a, b) => ((b.y2025 - b.y2024) / b.y2024) - ((a.y2025 - a.y2024) / a.y2024)).slice(0, 5);
    const topLand = [...summaryArray].sort((a, b) => b.land2025 - a.land2025).slice(0, 5);
    const topBuilding = [...summaryArray].sort((a, b) => b.building2025 - a.building2025).slice(0, 5);

    const fillList = (id, items, type) => {
        const container = document.getElementById(id);
        if (!container) return;
        let html = "";
        items.forEach((item, idx) => {
            let valText = "";
            if (type === 'wealth') valText = (item.y2025 / 100000).toFixed(1) + "억";
            else if (type === 'growth') {
                const growth = ((item.y2025 - item.y2024) / item.y2024 * 100);
                valText = (growth > 0 ? '+' : '') + growth.toFixed(0) + "%";
            }
            else if (type === 'land') valText = (item.land2025 / 100000).toFixed(1) + "억";
            else if (type === 'building') valText = (item.building2025 / 100000).toFixed(1) + "억";

            html += `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom" 
                     style="font-size: 0.8rem; cursor:pointer;" 
                     onclick="showDetail('${item.name}', '${item.district}')">
                    <span class="text-truncate" style="max-width: 100px;">
                        <span class="text-muted me-1">${idx + 1}.</span>
                        <span class="fw-bold text-dark">${item.name}</span>
                        <small class="text-muted">(${item.district.substring(0,2)})</small>
                    </span>
                    <span class="fw-bold text-primary">${valText}</span>
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