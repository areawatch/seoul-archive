// chart.js - 시각화 전용 엔진 (보강 버전)

let myChart = null;
let myPieChart = null;
let myPartyAvgChart = null;

function drawAllCharts(dStats, pStats) {
    // 데이터가 아직 안 왔으면 실행 안 함
    if (!dStats || Object.keys(dStats).length === 0) return;

    // 1. 자치구별 평균 재산액
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
                datasets: [{ label: '1인당 평균 재산액 (천원)', data: sortedD.map(i => i.avg), backgroundColor: 'rgba(13, 110, 253, 0.7)', borderRadius: 5 }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
        });
    }

    // 2. 정당별 인원 비중
    const pieCan = document.getElementById('partyPieChart');
    if (pieCan) {
        const pLabels = Object.keys(pStats);
        if (myPieChart) myPieChart.destroy();
        myPieChart = new Chart(pieCan.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: pLabels,
                datasets: [{ 
                    data: pLabels.map(l => pStats[l].count), 
                    backgroundColor: pLabels.map(l => partyColors[l] || "#707070"),
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 3. 정당별 평균 재산액
    const avgCan = document.getElementById('partyAvgChart');
    if (avgCan) {
        const pLabels = Object.keys(pStats);
        const sortedP = pLabels.map(l => ({ l, avg: pStats[l].total / pStats[l].count }))
            .sort((a, b) => b.avg - a.avg);
            
        if (myPartyAvgChart) myPartyAvgChart.destroy();
        myPartyAvgChart = new Chart(avgCan.getContext('2d'), {
            type: 'bar',
            data: {
                labels: sortedP.map(i => i.l),
                datasets: [{ 
                    label: '정당별 평균 재산 (천원)', 
                    data: sortedP.map(i => i.avg), 
                    backgroundColor: sortedP.map(i => partyColors[i.l] || "#707070"), 
                    borderRadius: 5 
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}
