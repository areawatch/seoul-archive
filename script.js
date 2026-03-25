// script.js - 데이터 렌더링 및 페이지 제어 메인 로직

// 페이지 로드 시 컴포넌트 로드 및 데이터 페칭 시작
window.onload = () => {
    loadComponent('header-plugin', 'header.html');
    loadComponent('footer-plugin', 'footer.html');
    
    // config.js에 정의된 sheetTabs를 순회하며 데이터 로드
    sheetTabs.forEach(tab => fetchTabData(tab));
};

function renderRouter() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;

    // 1. 데이터를 배열로 변환
    const summaryArray = Object.values(allSummary);
    
    // 2. 상단 하이라이트 섹션 계산 및 반영
    updateHighlights(summaryArray);

    // 3. 메인 테이블 리스트 렌더링
    let listHtml = "";
    summaryArray.forEach(item => {
        // 증감율 계산 (2024 -> 2025)
        const r2425 = item.y2024 > 0 ? ((item.y2025 - item.y2024) / item.y2024 * 100) : null;
        // 증감율 계산 (2023 -> 2024)
        const r2324 = item.y2023 > 0 ? ((item.y2024 - item.y2023) / item.y2023 * 100) : null;
        
        // 정당별 색상 (예시)
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
                    <span class="badge ${r2425 > 0 ? 'bg-danger' : 'bg-primary'}" style="font-size: 0.75rem;">
                        ${r2425 !== null ? (r2425 > 0 ? '+' : '') + r2425.toFixed(1) + '%' : '-'}
                    </span>
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

    // 로딩 숨기고 리스트 표시
    document.getElementById('loading').style.display = 'none';
    document.getElementById('list-section').style.display = 'block';

    // DataTable 초기화 (기존 인스턴스 파괴 후 재설정)
    if ($.fn.DataTable.isDataTable('#analysisTable')) {
        $('#analysisTable').DataTable().destroy();
    }
    $('#analysisTable').DataTable({
        "order": [[3, "desc"]], // 2025년 재산순 정렬
        "language": { "search": "의원명/구 검색:", "lengthMenu": "_MENU_ 개씩 보기" },
        "pageLength": 25
    });
}

// 하이라이트 카드 업데이트 함수
function updateHighlights(summaryArray) {
    if (summaryArray.length === 0) return;

    // 각 항목별 1위 추출
    const topWealth = [...summaryArray].sort((a, b) => b.y2025 - a.y2025)[0];
    const topGrowth = [...summaryArray].filter(a => a.y2024 > 0).sort((a, b) => ((b.y2025 - b.y2024) / b.y2024) - ((a.y2025 - a.y2024) / a.y2024))[0];
    const topLand = [...summaryArray].sort((a, b) => b.land2025 - a.land2025)[0];
    const topBuilding = [...summaryArray].sort((a, b) => b.building2025 - a.building2025)[0];

    // 카드 셋업 헬퍼 함수
    const setCard = (id, item, valueText, titleText) => {
        const card = document.getElementById(id);
        if (!card) return;
        
        if (titleText) card.querySelector('small').innerText = titleText;
        
        const linkEl = card.querySelector('.highlight-link') || card.querySelector('.fw-bold');
        if (linkEl && item) {
            linkEl.innerText = `${item.district} ${item.name}`;
            linkEl.classList.add('text-primary', 'text-decoration-underline');
            linkEl.style.cursor = "pointer";
            linkEl.onclick = (e) => {
                e.preventDefault();
                showDetail(item.name, item.district);
            };
        }
        
        const valEl = card.querySelector('.highlight-value') || card.querySelectorAll('div')[1];
        if (valEl) valEl.innerText = valueText;
    };

    const growthRate = topGrowth ? ((topGrowth.y2025 - topGrowth.y2024) / topGrowth.y2024 * 100).toFixed(1) + "%" : "-";

    setCard('max-wealth', topWealth, `${topWealth.y2025.toLocaleString()} 천원`, "최고 재산가");
    setCard('max-growth', topGrowth, growthRate, "최고 증감률");
    setCard('max-land-growth', topLand, `${topLand.land2025.toLocaleString()} 천원`, "토지 재산 1위");
    setCard('max-building-growth', topBuilding, `${topBuilding.building2025.toLocaleString()} 천원`, "건물 재산 1위");

    document.getElementById('highlight-section').style.display = 'flex';
}