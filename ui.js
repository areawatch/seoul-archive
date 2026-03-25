// ui.js - 컴포넌트 로더 및 상세 팝업 관리

// 1. 컴포넌트(헤더/푸터) 로더
async function loadComponent(id, file) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
        const response = await fetch(file);
        const data = await response.text();
        el.innerHTML = data;
        
        // 현재 페이지 활성화 표시 (메뉴 강조)
        const links = el.querySelectorAll('.nav-link');
        const currPage = window.location.pathname.split('/').pop() || 'index.html';
        links.forEach(link => {
            if (link.getAttribute('href') === currPage) link.classList.add('active');
        });
    } catch (e) { 
        console.error(file + " 로드 실패", e); 
    }
}

let detailChartInstance = null; // 차트 중복 생성 방지용

// 2. 상세 정보 팝업 및 그래프 출력
function showDetail(name, district) {
    console.log("상세보기 클릭:", name, district);
    
    // 데이터 저장소 확인
    if (typeof allSummary === 'undefined' || Object.keys(allSummary).length === 0) {
        alert("데이터 로딩 중입니다. 잠시 후 다시 시도해주세요!");
        return;
    }

    // 데이터 매칭 (이름 + 자치구 조합)
    const key = name + district;
    const item = allSummary[key];

    if (!item) {
        console.error("데이터 매칭 실패. 전체 목록:", allSummary);
        alert(`'${name}' 의원의 상세 데이터를 찾을 수 없습니다.`);
        return;
    }

    // 모달 제목 및 상세 테이블 채우기
    const titleEl = document.getElementById('detailModalLabel');
    if(titleEl) titleEl.innerText = `${item.district} - ${item.name} (${item.party})`;
    
    const contentEl = document.getElementById('detailContent');
    if(contentEl) {
        contentEl.innerHTML = `
            <table class="table table-sm mt-3">
                <tbody>
                    <tr><th width="40%">직위</th><td>${item.position}</td></tr>
                    <tr><th>2025년 재산</th><td class="fw-bold text-primary">${item.y2025.toLocaleString()} 천원</td></tr>
                    <tr><th>2024년 재산</th><td>${item.y2024.toLocaleString()} 천원</td></tr>
                    <tr><th>2023년 재산</th><td>${item.y2023.toLocaleString()} 천원</td></tr>
                </tbody>
            </table>`;
    }

    // 그래프 그리기
    const canvas = document.getElementById('detailChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (detailChartInstance) detailChartInstance.destroy(); // 기존 차트 삭제

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
                        beginAtZero: true, // ★ Y축을 0부터 시작하게 설정
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString(); // 숫자 콤마 표시
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false } // 상단 범례 숨김
                }
            }
        });
    }

    // 모달 실행
    const modalElement = document.getElementById('detailModal');
    if (modalElement) {
        const myModal = bootstrap.Modal.getOrCreateInstance(modalElement);
        myModal.show();
    }
}