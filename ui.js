// ui.js - 컴포넌트 로더 및 상세 팝업 관리

// 1. 컴포넌트(헤더/푸터) 로더
async function loadComponent(id, file) {
    const el = document.getElementById(id);
    if (el) {
        try {
            const response = await fetch(file);
            const data = await response.text();
            el.innerHTML = data;
            
            // 현재 페이지 활성화 표시
            const links = el.querySelectorAll('.nav-link');
            const currPage = window.location.pathname.split('/').pop() || 'index.html';
            links.forEach(link => {
                if (link.getAttribute('href') === currPage) link.classList.add('active');
            });
        } catch (e) {
            console.error(file + " 로드 실패", e);
        }
    }
}

// 2. 상세 팝업(모달) 및 그래프 관리
let detailChartInstance = null; // 차트 중복 방지용 변수

function showDetail(name, district) {
    // api.js에서 생성된 allSummary 데이터 참조
    const item = allSummary[name + district];
    if (!item) return;

    // 모달 제목 업데이트
    document.getElementById('detailModalLabel').innerText = `${item.district} - ${item.name} (${item.party})`;
    
    // 테이블 상세 내용 작성
    let html = `
        <table class="table table-sm mt-3">
            <tbody>
                <tr><th width="40%">직위</th><td>${item.position}</td></tr>
                <tr><th>2025년 재산</th><td class="fw-bold text-primary">${item.y2025.toLocaleString()} 천원</td></tr>
                <tr><th>2024년 재산</th><td>${item.y2024.toLocaleString()} 천원</td></tr>
                <tr><th>2023년 재산</th><td>${item.y2023.toLocaleString()} 천원</td></tr>
            </tbody>
        </table>
    `;
    document.getElementById('detailContent').innerHTML = html;

    // --- 그래프 그리기 로직 ---
    const ctx = document.getElementById('detailChart').getContext('2d');
    
    // 기존에 그려진 그래프가 있다면 파괴 (새로 그릴 때 겹침 방지)
    if (detailChartInstance) {
        detailChartInstance.destroy();
    }

    // Chart.js 실행
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
                tension: 0.3, // 곡선 부드러움 정도
                pointRadius: 6,
                pointBackgroundColor: '#0d6efd'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false, // 데이터 범위에 맞춰서 Y축 최솟값 자동 조절
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString(); // 숫자에 콤마 표시
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false } // 상단 범례 숨김 (깔끔하게)
            }
        }
    });

    // 부트스트랩 모달 띄우기
    const modalElement = document.getElementById('detailModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();
}