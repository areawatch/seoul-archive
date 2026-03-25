// ui.js - 컴포넌트 로더 및 상세 팝업 관리

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

function showDetail(name, district) {
    console.log("클릭됨:", name, district); // 디버깅용 로그

    // 1. 데이터 찾기 (allSummary가 전역변수인지 확인)
    const key = name + district;
    const item = (typeof allSummary !== 'undefined') ? allSummary[key] : null;

    if (!item) {
        alert("데이터를 찾을 수 없습니다: " + name);
        return;
    }

    // 2. 모달 제목 및 내용 채우기
    const titleEl = document.getElementById('detailModalLabel');
    const contentEl = document.getElementById('detailContent');
    if(titleEl) titleEl.innerText = `${item.district} - ${item.name} (${item.party})`;
    
    if(contentEl) {
        contentEl.innerHTML = `
            <table class="table table-sm mt-3">
                <tr><th width="40%">직위</th><td>${item.position}</td></tr>
                <tr><th>2025년 재산</th><td class="fw-bold text-primary">${item.y2025.toLocaleString()} 천원</td></tr>
                <tr><th>2024년 재산</th><td>${item.y2024.toLocaleString()} 천원</td></tr>
                <tr><th>2023년 재산</th><td>${item.y2023.toLocaleString()} 천원</td></tr>
            </table>`;
    }

    // 3. 그래프 그리기 (Canvas 확인 후 실행)
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
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 4. 모달 강제 실행
    const modalElement = document.getElementById('detailModal');
    if (modalElement) {
        const myModal = new bootstrap.Modal(modalElement);
        myModal.show();
    } else {
        alert("HTML에 detailModal이 없습니다. index.html을 확인해주세요.");
    }
}