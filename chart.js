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

function districtChartEscHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** 천원 합계 → 표시용 억 문자열 (1억=100,000천원) */
function districtChartCheonToEokLabel(cheon) {
    const v = Number(cheon) || 0;
    if (v <= 0) return "";
    return (v / 100000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "억";
}

/** 1위 pill용 구명·금액 (동률 시 구·구) */
function districtChartRankPillParts(labels, values, topSet) {
    const maxV = Math.max(0, ...values);
    if (maxV <= 0) return { names: "—", amount: "—" };
    const nameStr = [...topSet]
        .sort((a, b) => a - b)
        .map((i) => labels[i])
        .join("·");
    const amount = districtChartCheonToEokLabel(maxV) || "—";
    return { names: nameStr, amount };
}

function districtChartRankPillHtml(labels, values, topSet, title, modClass) {
    const { names, amount } = districtChartRankPillParts(labels, values, topSet);
    return (
        '<div class="district-rank1-pill ' +
        modClass +
        '" role="group">' +
        '<span class="district-rank1-pill-k">' +
        districtChartEscHtml(title) +
        "</span>" +
        '<span class="district-rank1-pill-district">' +
        districtChartEscHtml(names) +
        "</span>" +
        '<span class="district-rank1-pill-v">' +
        districtChartEscHtml(amount) +
        "</span>" +
        "</div>"
    );
}

/** 자치구별 비교 차트: 항목별 최댓값 인덱스(동률 포함) */
function districtChartTopRankIndices(values) {
    const max = Math.max(0, ...values);
    const s = new Set();
    if (max <= 0) return s;
    values.forEach((v, i) => {
        if (v === max) s.add(i);
    });
    return s;
}

/** 구별 값 배열 → 각 인덱스의 순위(1=최대, 동률이면 동순위·다음은 건너뜀) */
function districtChartRanksAmongDistricts(values) {
    const n = values.length;
    const sorted = values
        .map((v, i) => ({ v: Number(v) || 0, i }))
        .sort((a, b) => b.v - a.v || a.i - b.i);
    const ranks = new Array(n);
    let rank = 1;
    for (let k = 0; k < sorted.length; k++) {
        if (k > 0 && sorted[k].v !== sorted[k - 1].v) rank = k + 1;
        ranks[sorted[k].i] = rank;
    }
    return ranks;
}

/** 막대 채우기: 선택 구=원래 농도, 그 외(1위 포함)=동일 흐림 */
function districtChartBarFill(dataIndex, selectedIdx, rgb, baseAlpha, dimOthers) {
    const sel = selectedIdx >= 0 && dataIndex === selectedIdx;
    let a;
    if (dimOthers) {
        a = sel ? baseAlpha : 0.28;
    } else {
        a = baseAlpha;
    }
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function districtChartDatasetFills(values, selectedIdx, dimOthers, rgb, baseAlpha) {
    return values.map((_, i) => districtChartBarFill(i, selectedIdx, rgb, baseAlpha, dimOthers));
}

/** 막대 위 1위 표시용 노란 별 (캔버스, bi-star-fill 느낌) */
function districtChartDrawRankStar(ctx, cx, cy, outerR) {
    const spikes = 5;
    const innerR = outerR * 0.42;
    const step = Math.PI / spikes;
    let rot = -Math.PI / 2;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const sx = cx + Math.cos(rot) * r;
        const sy = cy + Math.sin(rot) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
        rot += step;
    }
    ctx.closePath();
    ctx.fillStyle = "#ffc107";
    ctx.strokeStyle = "#e0a800";
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
}

/**
 * 자치구별 페이지: 25개 구 × (총재산·부동산·금융) 합계 비교 (그룹 막대, Y=천원)
 * 1위 막대 상단 노란 별 · 선택 구만 원래 색
 */
function updateDistrictCompareChart() {
    const ctx = document.getElementById("districtCompareChart");
    if (!ctx || typeof Chart === "undefined") return;
    if (typeof getSeoulDistrictNames !== "function" || typeof allSummary === "undefined") return;

    const labels = getSeoulDistrictNames();
    if (labels.length === 0) return;

    const totals = labels.map(() => 0);
    const reTotals = labels.map(() => 0);
    const finTotals = labels.map(() => 0);
    const idx = Object.fromEntries(labels.map((n, i) => [n, i]));

    const sumRe = (p) => (Number(p.land2026) || 0) + (Number(p.building2026) || 0);
    const sumFin = (p) =>
        (Number(p.cash2026) || 0) + (Number(p.deposit2026) || 0) + (Number(p.stock2026) || 0);

    Object.values(allSummary).forEach((item) => {
        if (typeof isArchiveDistrictCouncilMember === "function" && !isArchiveDistrictCouncilMember(item)) {
            return;
        }
        const d = (item.district || "").trim();
        const i = idx[d];
        if (i === undefined) return;
        totals[i] += Number(item.y2026) || 0;
        reTotals[i] += sumRe(item);
        finTotals[i] += sumFin(item);
    });

    const selected = (typeof currentDistrictFilter !== "undefined" ? String(currentDistrictFilter) : "").trim();
    const selectedIdx = selected ? labels.indexOf(selected) : -1;
    const dimOthers = selectedIdx >= 0;

    const topTot = districtChartTopRankIndices(totals);
    const topRe = districtChartTopRankIndices(reTotals);
    const topFin = districtChartTopRankIndices(finTotals);
    const topSets = [topTot, topRe, topFin];

    const rankTotArr = districtChartRanksAmongDistricts(totals);
    const rankReArr = districtChartRanksAmongDistricts(reTotals);
    const rankFinArr = districtChartRanksAmongDistricts(finTotals);
    const rankRowsByDataset = [rankTotArr, rankReArr, rankFinArr];
    const districtCount = labels.length;

    const capEl = document.getElementById("district-chart-rank1-caption");
    if (capEl) {
        capEl.innerHTML =
            '<div class="district-rank1-strip">' +
            districtChartRankPillHtml(labels, totals, topTot, "총재산", "district-rank1-pill--total") +
            districtChartRankPillHtml(labels, reTotals, topRe, "부동산", "district-rank1-pill--re") +
            districtChartRankPillHtml(labels, finTotals, topFin, "금융", "district-rank1-pill--fin") +
            "</div>";
    }

    const fill0 = districtChartDatasetFills(totals, selectedIdx, dimOthers, [230, 30, 43], 0.78);
    const fill1 = districtChartDatasetFills(reTotals, selectedIdx, dimOthers, [13, 110, 253], 0.72);
    const fill2 = districtChartDatasetFills(finTotals, selectedIdx, dimOthers, [25, 135, 84], 0.72);

    const rankStarPlugin = {
        id: "districtCompareRankStar",
        afterDatasetsDraw(chart) {
            if (chart.canvas.id !== "districtCompareChart") return;
            const { ctx } = chart;
            const topsList = [topTot, topRe, topFin];
            const starR = 6.5;
            ctx.save();

            chart.data.datasets.forEach((_, dsIndex) => {
                const meta = chart.getDatasetMeta(dsIndex);
                if (meta.hidden) return;
                const topSet = topsList[dsIndex];
                topSet.forEach((dataIndex) => {
                    const el = meta.data[dataIndex];
                    if (!el) return;
                    const props = el.getProps(["x", "y", "base"], true);
                    const topY = Math.min(props.y, props.base);
                    const x = props.x;
                    const cy = topY - starR - 3;
                    districtChartDrawRankStar(ctx, x, cy, starR);
                });
            });
            ctx.restore();
        },
    };

    if (window.districtCompareChartInstance instanceof Chart) {
        window.districtCompareChartInstance.destroy();
    }
    const prevTip = document.getElementById("district-chart-tooltip-el");
    if (prevTip) {
        prevTip.style.opacity = "0";
        prevTip.style.visibility = "hidden";
    }

    const districtAmountColors = ["#e63946", "#2563eb", "#198754"];

    function districtCompareExternalTooltip(context) {
        const tooltip = context.tooltip;
        let el = document.getElementById("district-chart-tooltip-el");
        if (!el) {
            el = document.createElement("div");
            el.id = "district-chart-tooltip-el";
            el.className = "district-chart-tooltip";
            el.setAttribute("role", "tooltip");
            document.body.appendChild(el);
        }

        if (tooltip.opacity === 0) {
            el.style.opacity = "0";
            el.style.visibility = "hidden";
            return;
        }

        const dps = tooltip.dataPoints;
        if (!dps || dps.length === 0) {
            el.style.opacity = "0";
            el.style.visibility = "hidden";
            return;
        }

        const dataIndex = dps[0].dataIndex;
        const titleText =
            tooltip.title && tooltip.title.length ? tooltip.title[0] : labels[dataIndex] ?? "";
        const isSelectedCol = selectedIdx >= 0 && dataIndex === selectedIdx;

        let rows = "";
        dps.forEach((dp) => {
            const v = Number(dp.parsed.y) || 0;
            const eok = v === 0 ? "0" : (v / 100000).toFixed(2) + "억";
            const amountPlain = eok + " (" + v.toLocaleString() + "천원)";
            const dsLab = dp.dataset.label || "";
            const tops = topSets[dp.datasetIndex];
            const rankNote = tops.has(dataIndex) ? " · 1위" : "";

            const ds = context.chart.data.datasets[dp.datasetIndex];
            const swatch =
                typeof ds.borderColor === "string" ? ds.borderColor : "rgba(255,255,255,0.5)";

            const labelPart = districtChartEscHtml(dsLab) + ": ";
            let amountHtml;
            if (isSelectedCol) {
                const c = districtAmountColors[dp.datasetIndex] || "#ffffff";
                const posR = rankRowsByDataset[dp.datasetIndex][dataIndex];
                const rankAmong =
                    " · " + districtCount + "개 구 중 " + posR + "위";
                amountHtml =
                    '<span class="district-chart-tooltip-amount" style="color:' +
                    districtChartEscHtml(c) +
                    ';font-weight:700">' +
                    districtChartEscHtml(amountPlain) +
                    '<span class="district-chart-tooltip-posrank">' +
                    districtChartEscHtml(rankAmong) +
                    "</span></span>";
            } else {
                amountHtml = districtChartEscHtml(amountPlain);
            }

            rows +=
                '<div class="district-chart-tooltip-row">' +
                '<span class="district-chart-tooltip-swatch" style="background:' +
                districtChartEscHtml(swatch) +
                '"></span>' +
                '<span class="district-chart-tooltip-line">' +
                labelPart +
                amountHtml +
                (rankNote
                    ? '<span class="district-chart-tooltip-rank">' + districtChartEscHtml(rankNote) + "</span>"
                    : "") +
                "</span></div>";
        });

        el.innerHTML =
            '<div class="district-chart-tooltip-title">' +
            districtChartEscHtml(titleText) +
            "</div>" +
            rows;

        const rect = context.chart.canvas.getBoundingClientRect();
        el.style.opacity = "1";
        el.style.visibility = "visible";
        el.style.position = "fixed";
        el.style.left = rect.left + tooltip.caretX + "px";
        el.style.top = rect.top + tooltip.caretY + "px";
        el.style.transform = "translate(-50%, calc(-100% - 10px))";
        el.style.pointerEvents = "none";
        el.style.zIndex = "1080";
    }

    window.districtCompareChartInstance = new Chart(ctx.getContext("2d"), {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "총재산 합계",
                    data: totals,
                    backgroundColor: fill0,
                    borderColor: "rgb(200, 20, 35)",
                    borderWidth: 1,
                    borderRadius: 3,
                },
                {
                    label: "부동산 합계 (토지+건물)",
                    data: reTotals,
                    backgroundColor: fill1,
                    borderColor: "rgb(10, 88, 202)",
                    borderWidth: 1,
                    borderRadius: 3,
                },
                {
                    label: "금융자산 합계 (현금·예금·증권)",
                    data: finTotals,
                    backgroundColor: fill2,
                    borderColor: "rgb(20, 108, 67)",
                    borderWidth: 1,
                    borderRadius: 3,
                },
            ],
        },
        plugins: [rankStarPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            scales: {
                x: {
                    stacked: false,
                    ticks: {
                        maxRotation: 55,
                        minRotation: 45,
                        font: { size: 9 },
                        callback: function (value, index) {
                            const label = labels[index] ?? (typeof value === "string" ? value : "");
                            if (!dimOthers || selectedIdx < 0) return label;
                            if (index === selectedIdx) return "▶ " + label;
                            return label;
                        },
                    },
                    grid: { display: false },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            const v = Number(value) || 0;
                            if (v === 0) return "0";
                            return (v / 100000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "억";
                        },
                        font: { size: 10 },
                    },
                    grid: { color: "rgba(0,0,0,0.06)" },
                },
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    labels: { boxWidth: 12, padding: 12, font: { size: 11 } },
                },
                tooltip: {
                    enabled: false,
                    external: districtCompareExternalTooltip,
                },
            },
        },
    });
}