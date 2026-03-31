// chart.js - 시각화 전용 엔진

/**
 * [수정] 모달 내 2023~2026 재산 변동 추이 그래프 (Line Chart)
 * @param {Array} allPersonData - 해당 인물의 전 연도 데이터 배열
 */
function updateDetailChart(allPersonData) {
    const ctx = document.getElementById('detailChart');
    if (!ctx) return;

    // 기존 차트 인스턴스가 있다면 파괴하여 메모리 누수 방지 및 겹침 방지
    if (window.myDetailInstance instanceof Chart) {
        window.myDetailInstance.destroy();
    }

    // 1. 연도별 데이터 합산 (2023 ~ 2026)
    const yearlyTotals = { "2023": 0, "2024": 0, "2025": 0, "2026": 0 };
    
    allPersonData.forEach(d => {
        const yr = String(d.year);
        if (yearlyTotals.hasOwnProperty(yr)) {
            const raw = (Number(d.value) || 0);
            const signed = /채무|부채/.test(String(d.type || "")) ? -raw : raw;
            yearlyTotals[yr] += signed;
        }
    });

    const labels = ["2023년", "2024년", "2025년", "2026년"];
    const dataValues = [
        yearlyTotals["2023"], 
        yearlyTotals["2024"], 
        yearlyTotals["2025"], 
        yearlyTotals["2026"]
    ];

    // 2. 선 그래프 생성
    window.myDetailInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '재산 총액 (천원)',
                data: dataValues,
                borderColor: '#e61e2b', // 최신 연도 강조를 위해 붉은 계열 포인트
                backgroundColor: 'rgba(230, 30, 43, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3, // 곡선 처리
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#e61e2b',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0, // [요청사항] y축 최소값 0 고정
                    ticks: {
                        callback: function(value) {
                            // value 단위: 천원. 1억 원 = 100,000(천원) → 축은 전 구간 '억'으로 통일
                            const v = Number(value) || 0;
                            if (v === 0) return '0';
                            return (v / 100000).toFixed(1) + '억';
                        },
                        font: { size: 10 }
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    ticks: { font: { size: 11, fontWeight: 'bold' } },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    callbacks: {
                        label: function(context) {
                            const v = Number(context.parsed.y) || 0;
                            const pretty = v === 0 ? '0' : (v / 100000).toFixed(2) + '억';
                            return ' 총액: ' + pretty;
                        }
                    }
                }
            }
        }
    });
}

/**
 * 메인 화면용 통계 차트 (자치구별/정당별)
 */
function drawAllCharts(dStats, pStats) {
    if (typeof Chart === 'undefined') {
        console.error("Chart.js 라이브러리가 로드되지 않았습니다.");
        return;
    }

    // 1. 자치구별 평균 재산액 (가로 막대 그래프)
    const barCan = document.getElementById('districtChart');
    if (barCan) {
        const sortedD = Object.keys(dStats)
            .map(name => ({ name, avg: dStats[name].total / dStats[name].count }))
            .sort((a, b) => b.avg - a.avg);
            
        if (window.myChartInstance) window.myChartInstance.destroy();
        window.myChartInstance = new Chart(barCan.getContext('2d'), {
            type: 'bar',
            data: {
                labels: sortedD.map(i => i.name),
                datasets: [{ 
                    label: '1인당 평균 재산액', 
                    data: sortedD.map(i => i.avg), 
                    backgroundColor: 'rgba(13, 110, 253, 0.7)', 
                    borderRadius: 5 
                }]
            },
            options: { 
                indexAxis: 'y', 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    // 2. 정당별 인원 비중 (도넛 그래프)
    const pieCan = document.getElementById('partyPieChart');
    if (pieCan) {
        const pLabels = Object.keys(pStats);
        const colors = (typeof partyColors !== 'undefined') ? pLabels.map(l => partyColors[l] || "#707070") : "#707070";
        
        if (window.myPieInstance) window.myPieInstance.destroy();
        window.myPieInstance = new Chart(pieCan.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: pLabels,
                datasets: [{ 
                    data: pLabels.map(l => pStats[l].count), 
                    backgroundColor: colors,
                    hoverOffset: 10
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }
            }
        });
    }

    // 3. 정당별 평균 재산액 (세로 막대 그래프)
    const avgCan = document.getElementById('partyAvgChart');
    if (avgCan) {
        const pLabels = Object.keys(pStats);
        const sortedP = pLabels.map(l => ({ l, avg: pStats[l].total / pStats[l].count })).sort((a, b) => b.avg - a.avg);
        const colors = (typeof partyColors !== 'undefined') ? sortedP.map(i => partyColors[i.l] || "#707070") : "#707070";
        
        if (window.myAvgInstance) window.myAvgInstance.destroy();
        window.myAvgInstance = new Chart(avgCan.getContext('2d'), {
            type: 'bar',
            data: {
                labels: sortedP.map(i => i.l),
                datasets: [{ 
                    label: '정당별 평균 재산', 
                    data: sortedP.map(i => i.avg), 
                    backgroundColor: colors, 
                    borderRadius: 5 
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}