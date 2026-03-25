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
    } catch (e) { 
        console.error(file + " 로드 실패", e); 
    }
}

let detailChartInstance = null;

// 2. 상세 정보 팝업 및 그래프 출력
function showDetail(name, district) {
    console.log("상세보기 클릭:", name, district);
    
    // 데이터 로드 확인
    if (typeof allSummary === 'undefined' || Object.keys(allSummary).length === 0) {
        alert("데이터 로딩 중입니다. 잠시 후 다시 시도해주세요!");
        return;
    }

    // 데이터 매칭 (이름 + 자치구 조합)
    const key = name + district;
    const item = allSummary[key];

    if (!item) {
        alert(`'${name}' 의원의 데이터를 찾을 수 없습니다.`);
        return;
    }

    // 모달 제목 설정
    const titleEl = document.getElementById('detailModalLabel');
    if(titleEl) titleEl.innerText = `${item.district} - ${item.name} (${item.party})`;
    
    // --- [내용 구성 시작] ---
    
    // A. 상단 3개년 총액 요약 테이블
    let summaryHtml = `
        <table class="table table-sm border-bottom mb-4" style="font-size: 0.9rem;">
            <thead class="table-light">
                <tr><th>연도</th><th>직위</th><th class="text-end">총 재산(천원)</th></tr>
            </thead>
            <tbody>
                <tr class="table-primary"><td>2025</td><td>${item.position}</td><td class="text-end fw-bold">${item.y2025.toLocaleString()}</td></tr>
                <tr><td>2024</td><td>${item.position}</td><td class="text-end">${item.y2024.toLocaleString()}</td></tr>
                <tr><td>2023</td><td>${item.position}</td><td class="text-end">${item.y2023.toLocaleString()}</td></tr>
            </tbody>
        </table>
        <h6 class="fw-bold mb-3">연도별 세부 자산 내역</h6>
    `;

    // B. 연도별 상세 데이터 리스트 (2025 -> 2024 -> 2023 순)
    let detailTableHtml = "";
    const years = ["2025", "2024", "2023"];

    years.forEach(year => {
        const yearDetails = allRawData.filter(d => d.name === name && d.district === district && d.year === year);
        
        detailTableHtml += `
            <div class="mb-3">
                <div class="badge bg-secondary mb-2">${year}년 상세 내역</div>
                <table class="table table-hover table-sm mb-0" style="font-size: 0.82rem;">
                    <tbody>`;
        
        if (yearDetails.length > 0) {
            yearDetails.forEach(d => {
                detailTableHtml += `
                    <tr>
                        <td class="text-muted" width="65%">${d.type}</td>
                        <td class="text-end fw-bold">${d.value.toLocaleString()}</td>
                    </tr>`;
            });
        } else {
            detailTableHtml += `<tr><td colspan="2" class="text-center text-muted small">해당 연도 상세 데이터가 없습니다.</td></tr>`;
        }
        
        detailTableHtml += `</tbody></table></div>`;
    });

    const contentEl = document.getElementById('detailContent');
    if(contentEl) contentEl.innerHTML = summaryHtml + detailTableHtml;

    // C. 그래프 그리기 (Y축 0부터 시작)
    const canvas = document.getElementById('detailChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (detailChartInstance) detailChartInstance.destroy();

        detailChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['2023년', '2024년', '2025년'],
                datasets: [{
                    label: '재산 추이 (천원)',
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
                        beginAtZero: true, // Y축 0부터 시작
                        ticks: { callback: v => v.toLocaleString() }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // D. 모달 실행
    const modalElement = document.getElementById('detailModal');
    if (modalElement) {
        const myModal = bootstrap.Modal.getOrCreateInstance(modalElement);
        myModal.show();
    }
}