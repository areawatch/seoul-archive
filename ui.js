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
    console.log("검색 시도:", name, district);
    
    // 1. 데이터 저장소 확인
    if (typeof allSummary === 'undefined' || Object.keys(allSummary).length === 0) {
        alert("데이터 로딩이 아직 완료되지 않았습니다. 잠시만 기다려주세요!");
        return;
    }

    // 2. 다양한 키 조합으로 데이터 찾기 (공백 문제 해결)
    const key1 = name + district;
    const key2 = name.trim() + district.trim();
    const item = allSummary[key1] || allSummary[key2];

    if (!item) {
        console.error("현재 로드된 데이터 목록:", allSummary);
        alert(`'${name}' 의원의 상세 데이터를 찾을 수 없습니다.\n(데이터 로드 상태를 확인해주세요)`);
        return;
    }

    // --- (이하 모달 띄우기 및 그래프 로직은 동일합니다) ---
    const titleEl = document.getElementById('detailModalLabel');
    if(titleEl) titleEl.innerText = `${item.district} - ${item.name} (${item.party})`;
    
    const contentEl = document.getElementById('detailContent');
    if(contentEl) {
        contentEl.innerHTML = `
            <table class="table table-sm mt-3">
                <tr><th width="40%">직위</th><td>${item.position}</td></tr>
                <tr><th>2025년 재산</th><td class="fw-bold text-primary">${item.y2025.toLocaleString()} 천원</td></tr>
                <tr><th>2024년 재산</th><td>${item.y2024.toLocaleString()} 천원</td></tr>
                <tr><th>2023년 재산</th><td>${item.y2023.toLocaleString()} 천원</td></tr>
            </table>`;
    }

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

    const modalElement = document.getElementById('detailModal');
    if (modalElement) {
        const myModal = bootstrap.Modal.getOrCreateInstance(modalElement);
        myModal.show();
    }
}