// chart.js - 시각화 전용 엔진

// 모달 내 2023~2025 재산 변동 추이 그래프를 그리는 함수
function updateDetailChart(allPersonData) {
    const ctx = document.getElementById('detailChart');
    if (!ctx) return;

    // 기존 차트 인스턴스가 있다면 파괴
    if (window.myDetailInstance instanceof Chart) {
        window.myDetailInstance.destroy();
    }

    // 1. 연도별로 데이터 합산 (2023, 2024, 2025)
    const yearlyTotals = { "2023": 0, "2024": 0, "2025": 0 };
    
    // [중요] 채무(negative value) 등을 고려하여 순자산을 정확히 계산해야 합니다.
    // 시트 데이터 구조상 채무가 음수로 들어있는지, 
    // 아니면 '채무'라는 항목으로 양수로 들어있는지에 따라 계산 방식이 달라집니다.
    // 여기서는 일단 모든 가액을 더합니다. (채무가 음수로 들어있다고 가정)
    allPersonData.forEach(d => {
        if (yearlyTotals.hasOwnProperty(d.year)) {
            yearlyTotals[d.year] += d.value;
        }
    });

    const labels = ["2023년", "2024년", "2025년"];
    const dataValues = [yearlyTotals["2023"], yearlyTotals["2024"], yearlyTotals["2025"]];

    // 2. 선 그래프(Line Chart) 생성
    window.myDetailInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '재산 총액 (천원)',
                data: dataValues,
                borderColor: '#004ea2',
                backgroundColor: 'rgba(0, 78, 162, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3, // 선을 부드럽게
                pointRadius: 5,
                pointBackgroundColor: '#004ea2'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    // beginAtZero: false, // 이 속성은 제거하거나 false로 둡니다.
                    // [수정] y축의 최소값을 0으로 고정합니다.
                    min: 0, 
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + '원';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false } // 단일 데이터이므로 범례 생략
            }
        }
    });
}

// 메인 화면용 통계 차트 (이전과 동일)
function drawAllCharts(dStats, pStats) {
    if (typeof Chart === 'undefined') return;
    // ... (자치구별/정당별 차트 로직은 그대로 유지) ...
}