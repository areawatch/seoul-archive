// chart.js - 시각화 전용 엔진

// 변수 중복 선언 및 에러 방지
if (typeof myChart === 'undefined') var myChart = null;
if (typeof myPieChart === 'undefined') var myPieChart = null;
if (typeof myPartyAvgChart === 'undefined') var myPartyAvgChart = null;

function drawAllCharts(dStats, pStats) {
    // 1. 자치구별 평균 재산액 (막대)
    const barCan = document.getElementById('districtChart');
    if (barCan) {
        const sortedD = Object.keys(dStats)
            .map(name => ({ name, avg: dStats[name].total / dStats[name].count }))
            .sort((a, b) => b.avg - a.avg);
            
        if (myChart) myChart.destroy();
        myChart = new Chart(barCan.getContext('2d'), {
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

    // 2. 정당별 인원 비중 (도넛)
    const pieCan = document.getElementById('partyPieChart');
    if (pieCan) {
        const pLabels = Object.keys(pStats);
        // config.js의 partyColors 참조, 없을 시 회색 처리
        const colors = typeof partyColors !== 'undefined' ? pLabels.map(l => partyColors[l] || "#707070") : "#707070";
        
        if (myPieChart) myPieChart.destroy();
        myPieChart = new Chart(pieCan.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: pLabels,
                datasets: [{ 
                    data: pLabels.map(l => pStats[l].count), 
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // 3. 정당별 평균 재산액 (가로 막대)
    const avgCan = document.getElementById('partyAvgChart');
    if (avgCan) {
        const pLabels = Object.keys(pStats);
        const sortedP = pLabels.map(l => ({ l, avg: pStats[l].total / pStats[l].count }))
            .sort((a, b) => b.avg - a.avg);
        const colors = typeof partyColors !== 'undefined' ? sortedP.map(i => partyColors[i.l] || "#707070") : "#707070";
        
        if (myPartyAvgChart) myPartyAvgChart.destroy();
        myPartyAvgChart = new Chart(avgCan.getContext('2d'), {
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
                plugins: { legend: { display: false } } 
            }
        });
    }
}
