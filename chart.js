// chart.js - 시각화 전용 엔진

// Chart.js가 로드되었는지 확인하고 에러를 미리 방지
function drawAllCharts(dStats, pStats) {
    if (typeof Chart === 'undefined') {
        console.error("Chart.js 라이브러리가 아직 로드되지 않았습니다.");
        return;
    }

    // 1. 자치구별 평균 재산액
    const barCan = document.getElementById('districtChart');
    if (barCan) {
        const sortedD = Object.keys(dStats)
            .map(name => ({ name, avg: dStats[name].total / dStats[name].count }))
            .sort((a, b) => b.avg - a.avg);
            
        // 전역 변수 대신 윈도우 객체에 담아 안전하게 관리
        if (window.myChartInstance) window.myChartInstance.destroy();
        window.myChartInstance = new Chart(barCan.getContext('2d'), {
            type: 'bar',
            data: {
                labels: sortedD.map(i => i.name),
                datasets: [{ label: '1인당 평균 재산액', data: sortedD.map(i => i.avg), backgroundColor: 'rgba(13, 110, 253, 0.7)', borderRadius: 5 }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
        });
    }

    // 2. 정당별 인원 비중
    const pieCan = document.getElementById('partyPieChart');
    if (pieCan) {
        const pLabels = Object.keys(pStats);
        const colors = (typeof partyColors !== 'undefined') ? pLabels.map(l => partyColors[l] || "#707070") : "#707070";
        
        if (window.myPieInstance) window.myPieInstance.destroy();
        window.myPieInstance = new Chart(pieCan.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: pLabels,
                datasets: [{ data: pLabels.map(l => pStats[l].count), backgroundColor: colors }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 3. 정당별 평균 재산액
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
                datasets: [{ label: '정당별 평균 재산', data: sortedP.map(i => i.avg), backgroundColor: colors, borderRadius: 5 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}
