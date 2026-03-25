window.onload = () => {
    loadComponent('header-plugin', 'header.html');
    loadComponent('footer-plugin', 'footer.html');
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

function updateHighlights(summaryArray) {
    // 5등까지 정렬해서 자르기
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
            else if (type === 'growth') valText = ((item.y2025 - item.y2024) / item.y2024 * 100).toFixed(0) + "%";
            else if (type === 'land') valText = (item.land2025 / 100000).toFixed(1) + "억";
            else if (type === 'building') valText = (item.building2025 / 100000).toFixed(1) + "억";

            html += `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom-dashed" 
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