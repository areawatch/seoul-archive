// ui.js - 컴포넌트 로더 및 상세 팝업 관리

// 1. 공통 컴포넌트(헤더/푸터) 로더
async function loadComponent(id, file) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
        const response = await fetch(file);
        const data = await response.text();
        el.innerHTML = data;
        const links = el.querySelectorAll('.nav-link');
        const currPage = window.location.pathname.split('/').pop() || 'index.html';
        links.forEach(link => {
            if (link.getAttribute('href') === currPage) link.classList.add('active');
        });
    } catch (e) { console.error(file + " 로드 실패", e); }
}

let detailChartInstance = null;

// 2. 상세 정보 팝업 및 그래프 출력
function showDetail(name, district) {
    console.log("상세보기 클릭:", name, district);
    
    if (typeof allSummary === 'undefined' || Object.keys(allSummary).length === 0) {
        alert("데이터 로딩 중입니다. 잠시 후 다시 시도해주세요!");
        return;
    }

    const key = name + district;
    const item = allSummary[key];

    if (!item) {
        alert(`'${name}' 의원의 데이터를 찾을 수 없습니다.`);
        return;
    }

    // 모달 제목 설정
    const titleEl = document.getElementById('detailModalLabel');
    if(titleEl) titleEl.innerText = `${item.district} - ${item.name} (${item.party})`;
    
    // --- [데이터 통합 표 로직] ---
    const allDetailTypes = Array.from(new Set(allRawData
        .filter(d => d.name === name && d.district === district)
        .map(d => d.type)));

    let tableHtml = `
        <div class="table-responsive">
            <table class="table table-hover table-sm mt-3" style="font-size: 0.8rem; min-width: 450px;">
                <thead class="table-light text-center">
                    <tr>
                        <th class="text-start" width="40%">자산 항목</th>
                        <th>2025</th>
                        <th>2024</th>
                        <th>2023</th>
                    </tr>
                </thead>
                <tbody>`;

    allDetailTypes.forEach(type => {
        const getVal = (year) => {
            const found = allRawData.find(d => d.name === name && d.district === district && d.year === year && d.type === type);
            return found ? found.value.toLocaleString() : "-";
        };

        tableHtml += `
            <tr>
                <td class="text-muted small">${type}</td>
                <td class="text-end fw-bold">${getVal("2025")}</td>
                <td class="text-end">${getVal("2024")}</td>
                <td class="text-end">${getVal("2023")}</td>
            </tr>`;
    });

    tableHtml += `
            <tr class="table-primary fw-bold">
                <td>합계 (총액)</td>
                <td class="text-end">${item.y2025.toLocaleString()}</td>
                <td class="text-end">${item.y2024.toLocaleString()}</td>
                <td class="text-end">${item.y2023.toLocaleString()}</td>
            </tr>
        </tbody>
    </table>
    <p class="text-muted mt-2" style="font-size: 0.75rem;">* 단위: 천원 / 가로로 스와이프하여 전체 내용을 볼 수 있습니다.</p>
    </div>`;

    const contentEl = document.getElementById('detailContent');
    if(contentEl) contentEl.innerHTML = tableHtml;

    // --- [그래프 그리기 - Y축 0부터 시작 옵션 포함] ---
    const canvas = document.getElementById('detailChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (detailChartInstance) detailChartInstance.destroy();
        detailChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['2023', '2024', '2025'],
                datasets: [{
                    label: '재산 추이',
                    data: [item.y2023, item.y2024, item.y2025],
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 6,
                    pointBackgroundColor: '#0d6efd'
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: { 
                    y: { 
                        beginAtZero: true, // ★ Y축 0부터 시작 (image_1.png의 왜곡 해결)
                        ticks: { callback: v => v.toLocaleString() } 
                    } 
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    const modalElement = document.getElementById('detailModal');
    if (modalElement) {
        const myModal = bootstrap.Modal.getOrCreateInstance(modalElement);
        myModal.show();
    }
}