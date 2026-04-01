let currentFilter = "전체"; 

// 1. 항목명 변환 및 툴팁 설정
function formatItemType(type) {
    if (!type) return "";
    
    const longNameAutomobile = "부동산에 관한 규정이 준용되는 권리와 자동차·건설기계·선박 및 항공기";
    const longNameRefusal = "고지거부 및 등록제외사항";
    const longNameInvestment = "합명·합자·유한회사 출자지분";
    const longNameNonProfit = "비영리법인에 출연한 재산";
    const longNameGold = "금 및 백금";
    const longNamePoliticalFunds = "정치자금법에 따른 정치자금의 수입 및 지출을 위한 예금계좌의 예금";

    if (type.includes("정치자금법")) {
        return `<span class="text-nowrap">정치자금</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNamePoliticalFunds}"></i>`;
    }
    if (/자동차|항공기|선박|건설기계/.test(type)) {
        return `<span class="text-nowrap">자동차 등</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameAutomobile}"></i>`;
    }
    if (type.includes("고지거부") || type.includes("등록제외")) {
        return `<span class="text-nowrap">고지거부</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameRefusal}"></i>`;
    }
    if (type.includes("출자지분") || type.includes("유한회사") || type.includes("합명")) {
        return `<span class="text-nowrap">출자지분</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameInvestment}"></i>`;
    }
    if (type.includes("비영리법인") || type === "재산") {
        return `<span class="text-nowrap">비영리</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameNonProfit}"></i>`;
    }
    if (!/예금|적금|현금/.test(type) && (type.includes("금") || type.includes("백금"))) {
        return `<span class="text-nowrap">금</span><i class="bi bi-info-circle text-secondary ms-1" style="cursor: help; font-size: 0.8rem; opacity: 0.7;" data-bs-toggle="tooltip" data-bs-placement="top" title="${longNameGold}"></i>`;
    }

    return type; 
}

function isDebtType(type) {
    if (!type) return false;
    return /채무|부채/.test(String(type));
}

function sumRealEstate2026Item(p) {
    return (Number(p.land2026) || 0) + (Number(p.building2026) || 0);
}

function sumFinance2026Item(p) {
    return (Number(p.cash2026) || 0) + (Number(p.deposit2026) || 0) + (Number(p.stock2026) || 0);
}

function getSeoulDistrictNames() {
    if (typeof sheetTabs === "undefined") return [];
    return sheetTabs
        .filter((t) => t.name !== "구청장")
        .map((t) => t.name)
        .sort((a, b) => a.localeCompare(b, "ko"));
}

/** archive-district: 구청장·전)구청장 제외, 구의원·전)구의원만 */
function isArchiveDistrictCouncilMember(item) {
    const p = (item.position || "").trim();
    if (/구청장/.test(p)) return false;
    return /구의원/.test(p);
}

let currentDistrictFilter = "";

function formatSignedByType(type, value) {
    const v = Number(value) || 0;
    if (isDebtType(type)) return "-" + Math.abs(v).toLocaleString();
    return v.toLocaleString();
}

/** 상단 하이라이트: 송파구+구의원 → 송파구의원, 강남구+구청장 → 강남구청장 */
function formatDistrictPositionLabel(district, position) {
    const d = (district || "").trim();
    const pos = (position || "").trim();
    if (!pos) return d;
    if (d === "중구") return d + " " + pos;
    const base = d.length >= 2 && d.endsWith("구") ? d.slice(0, -1) : d;
    if (pos.startsWith("구")) return base + pos;
    return d + " " + pos;
}

/** 천원 합계 → 232억 138만원 (1억=100,000천원, 1만원=10천원). 앞자리 0·불필요 단위 생략 */
function formatCheonSumToEokManWon(cheon) {
    const n = Number(cheon) || 0;
    const neg = n < 0;
    const v = Math.abs(Math.floor(n));
    const CHEON_PER_EOK = 100000;
    const eok = Math.floor(v / CHEON_PER_EOK);
    const man = Math.floor((v % CHEON_PER_EOK) / 10);
    const parts = [];
    if (eok > 0) parts.push(eok.toLocaleString() + "억");
    if (man > 0) parts.push(man.toLocaleString() + "만원");
    if (parts.length === 0) return (neg ? "-" : "") + "0";
    return (neg ? "-" : "") + parts.join(" ");
}

/** 구의원만, 구별 총재산·부동산·금융 합계 배열 (차트·카드·순위 공통) */
function archiveDistrictBuildCouncilTotalsArrays() {
    const labels = getSeoulDistrictNames();
    const totals = labels.map(() => 0);
    const reTotals = labels.map(() => 0);
    const finTotals = labels.map(() => 0);
    const idx = Object.fromEntries(labels.map((n, i) => [n, i]));
    Object.values(allSummary).forEach((item) => {
        if (!isArchiveDistrictCouncilMember(item)) return;
        const d = (item.district || "").trim();
        const i = idx[d];
        if (i === undefined) return;
        totals[i] += Number(item.y2026) || 0;
        reTotals[i] += sumRealEstate2026Item(item);
        finTotals[i] += sumFinance2026Item(item);
    });
    return { labels, totals, reTotals, finTotals };
}

/** 값 큰 순 1위… 동률 시 동순위·다음 건너뜀 */
function archiveDistrictRanksAmongValues(values) {
    const sorted = values
        .map((v, i) => ({ v: Number(v) || 0, i }))
        .sort((a, b) => b.v - a.v || a.i - b.i);
    const ranks = new Array(values.length);
    let rank = 1;
    for (let k = 0; k < sorted.length; k++) {
        if (k > 0 && sorted[k].v !== sorted[k - 1].v) rank = k + 1;
        ranks[sorted[k].i] = rank;
    }
    return ranks;
}

/** 천원 단위 증감 → +33억 9,843만 (1억=100,000천원). 1만 미만은 N천원 */
function formatCheonDeltaEokMan(cheonDelta) {
    const n = Number(cheonDelta) || 0;
    const sign = n > 0 ? "+" : n < 0 ? "-" : "+";
    const v = Math.abs(Math.floor(n));
    const CHEON_PER_EOK = 100000;
    if (v === 0) return "+0";
    const eok = Math.floor(v / CHEON_PER_EOK);
    const man = Math.floor((v % CHEON_PER_EOK) / 10);
    if (eok === 0 && man === 0) return sign + v.toLocaleString() + "천원";
    const parts = [];
    if (eok > 0) parts.push(eok + "억");
    if (man > 0) parts.push(man.toLocaleString() + "만");
    return sign + parts.join(" ");
}

window.onload = () => {
    if (typeof loadComponent === 'function') {
        loadComponent('header-plugin', 'header.html');
        loadComponent('footer-plugin', 'footer.html');
    }
    if (typeof loadArchiveDataFromJson === 'function') {
        // data.json/detail.json 기반으로 1회 로드 후 라우터 렌더
        loadArchiveDataFromJson()
            .then(() => {
                if (document.body.id === "page-archive-district") initDistrictArchivePage();
                else renderRouter();
            })
            .catch(err => {
                console.error("데이터 로드 실패:", err);
                // detail.json이 아직 없거나 로드 실패하면 (구형 동작) CSV 로드로 폴백
                if (typeof sheetTabs !== 'undefined' && typeof fetchTabData === 'function') {
                    sheetTabs.forEach(tab => fetchTabData(tab));
                } else {
                    const loadingEl = document.getElementById('loading');
                    if (loadingEl) loadingEl.style.display = 'none';
                }
            });
    } else if (typeof sheetTabs !== 'undefined') {
        // (구형 동작) CSV fetch 방식
        sheetTabs.forEach(tab => fetchTabData(tab));
    }
};

function filterPosition(pos) {
    currentFilter = pos;
    renderRouter();
}

function initDistrictArchivePage() {
    const sel = document.getElementById("district-select");
    if (!sel) return;
    const names = getSeoulDistrictNames();
    sel.innerHTML = names.map((n) => `<option value="${n}">${n}</option>`).join("");
    currentDistrictFilter = names[0] || "";
    sel.value = currentDistrictFilter;
    sel.addEventListener("change", () => {
        currentDistrictFilter = sel.value;
        renderDistrictRouter();
    });
    renderDistrictRouter();
}

function updateDistrictSummaryCards(items) {
    const totalEl = document.getElementById("district-stat-total");
    const reEl = document.getElementById("district-stat-realestate");
    const finEl = document.getElementById("district-stat-finance");
    const totalRankEl = document.getElementById("district-stat-total-rank");
    const reRankEl = document.getElementById("district-stat-realestate-rank");
    const finRankEl = document.getElementById("district-stat-finance-rank");
    if (!totalEl || !reEl || !finEl) return;

    let sumY = 0;
    let sumRe = 0;
    let sumFin = 0;
    items.forEach((item) => {
        sumY += Number(item.y2026) || 0;
        sumRe += sumRealEstate2026Item(item);
        sumFin += sumFinance2026Item(item);
    });

    totalEl.textContent = formatCheonSumToEokManWon(sumY);
    reEl.textContent = formatCheonSumToEokManWon(sumRe);
    finEl.textContent = formatCheonSumToEokManWon(sumFin);

    const gu = (currentDistrictFilter || "").trim();
    const agg = archiveDistrictBuildCouncilTotalsArrays();
    const gi = agg.labels.indexOf(gu);
    const nGu = agg.labels.length;

    if (totalRankEl && reRankEl && finRankEl) {
        if (gi >= 0 && nGu > 0) {
            const rT = archiveDistrictRanksAmongValues(agg.totals)[gi];
            const rR = archiveDistrictRanksAmongValues(agg.reTotals)[gi];
            const rF = archiveDistrictRanksAmongValues(agg.finTotals)[gi];
            totalRankEl.textContent = nGu + "개 구 중 " + rT + "위";
            reRankEl.textContent = nGu + "개 구 중 " + rR + "위";
            finRankEl.textContent = nGu + "개 구 중 " + rF + "위";
        } else {
            totalRankEl.textContent = "—";
            reRankEl.textContent = "—";
            finRankEl.textContent = "—";
        }
    }
}

function renderDistrictRouter() {
    const tableBody = document.getElementById("tableBody");
    const districtSummarySection = document.getElementById("district-summary-section");
    if (!tableBody || !districtSummarySection) return;

    if (Object.keys(allSummary).length === 0) return;

    const chartSection = document.getElementById("district-chart-section");
    if (chartSection && typeof updateDistrictCompareChart === "function") {
        updateDistrictCompareChart();
        chartSection.style.display = "block";
    }

    const d = (currentDistrictFilter || "").trim();
    let summaryArray = Object.values(allSummary)
        .filter(isArchiveDistrictCouncilMember)
        .filter((item) => (item.district || "").trim() === d);

    updateDistrictSummaryCards(summaryArray);

    let listHtml = "";
    const orderVal = (rate) => (rate === null || Number.isNaN(rate)) ? -1e15 : rate;
    summaryArray.forEach((item) => {
        const v26 = item.y2026 || 0;
        const v25 = item.y2025 || 0;
        const v24 = item.y2024 || 0;
        const v23 = item.y2023 || 0;
        const r2526 = v25 > 0 ? ((v26 - v25) / v25 * 100) : null;
        const r2425 = v24 > 0 ? ((v25 - v24) / v24 * 100) : null;
        const r2324 = v23 > 0 ? ((v24 - v23) / v23 * 100) : null;
        const pColor = (typeof partyColors !== "undefined" && partyColors[item.party]) ? partyColors[item.party] : "#666";

        listHtml += `
            <tr onclick="showDetail('${item.name}', '${item.district}')" style="cursor:pointer;">
                <td>${item.district}</td>
                <td><small>${item.position}</small></td>
                <td>
                    <span class="fw-bold">${item.name}</span>
                    <span class="badge ms-1" style="background-color:${pColor}; font-size: 0.6rem;">${item.party}</span>
                </td>
                <td class="text-end fw-bold text-danger">${v26.toLocaleString()}</td>
                <td class="text-center" data-order="${orderVal(r2526)}" data-sort="${orderVal(r2526)}">
                    <small class="fw-bold ${r2526 > 0 ? "text-danger" : "text-primary"}">
                        ${r2526 !== null ? (r2526 > 0 ? "+" : "") + r2526.toFixed(1) + "%" : "-"}
                    </small>
                </td>
                <td class="text-end text-muted small">${v25.toLocaleString()}</td>
                <td class="text-center" data-order="${orderVal(r2425)}" data-sort="${orderVal(r2425)}">
                    <small class="text-muted">${r2425 !== null ? (r2425 > 0 ? "+" : "") + r2425.toFixed(1) + "%" : "-"}</small>
                </td>
                <td class="text-end text-muted small">${v24.toLocaleString()}</td>
                <td class="text-center" data-order="${orderVal(r2324)}" data-sort="${orderVal(r2324)}">
                    <small class="text-muted">${r2324 !== null ? (r2324 > 0 ? "+" : "") + r2324.toFixed(1) + "%" : "-"}</small>
                </td>
                <td class="text-end text-muted small">${v23.toLocaleString()}</td>
            </tr>`;
    });

    if ($.fn.DataTable.isDataTable("#analysisTable")) {
        $("#analysisTable").DataTable().clear().destroy();
    }

    tableBody.innerHTML = listHtml;

    document.getElementById("loading").style.display = "none";
    document.getElementById("list-section").style.display = "block";
    const filterEl = document.getElementById("district-filter-section");
    if (filterEl) filterEl.style.display = "flex";

    districtSummarySection.style.display = "flex";

    $("#analysisTable").DataTable({
        order: [[3, "desc"]],
        columnDefs: [{ targets: [4, 6, 8], type: "num" }],
        pageLength: 25,
        autoWidth: false,
        responsive: true,
        language: { search: "검색:", lengthMenu: "_MENU_ 개씩 보기" },
    });
}

function renderRouter() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    let summaryArray = Object.values(allSummary);
    if (summaryArray.length === 0) return;

    if (currentFilter === "구청장") {
        summaryArray = summaryArray.filter(item => item.position.includes("구청장"));
    } else if (currentFilter === "구의원") {
        summaryArray = summaryArray.filter(item => !item.position.includes("구청장"));
    }

    updateHighlights(summaryArray);

    let listHtml = "";
    const orderVal = (rate) => (rate === null || Number.isNaN(rate)) ? -1e15 : rate;
    summaryArray.forEach(item => {
        const v26 = item.y2026 || 0;
        const v25 = item.y2025 || 0;
        const v24 = item.y2024 || 0;
        const v23 = item.y2023 || 0;
        const r2526 = v25 > 0 ? ((v26 - v25) / v25 * 100) : null;
        const r2425 = v24 > 0 ? ((v25 - v24) / v24 * 100) : null;
        const r2324 = v23 > 0 ? ((v24 - v23) / v23 * 100) : null;
        const pColor = (typeof partyColors !== 'undefined' && partyColors[item.party]) ? partyColors[item.party] : "#666";

        listHtml += `
            <tr onclick="showDetail('${item.name}', '${item.district}')" style="cursor:pointer;">
                <td>${item.district}</td>
                <td><small>${item.position}</small></td>
                <td>
                    <span class="fw-bold">${item.name}</span>
                    <span class="badge ms-1" style="background-color:${pColor}; font-size: 0.6rem;">${item.party}</span>
                </td>
                <td class="text-end fw-bold text-danger">${v26.toLocaleString()}</td>
                <td class="text-center" data-order="${orderVal(r2526)}" data-sort="${orderVal(r2526)}">
                    <small class="fw-bold ${r2526 > 0 ? 'text-danger' : 'text-primary'}">
                        ${r2526 !== null ? (r2526 > 0 ? '+' : '') + r2526.toFixed(1) + '%' : '-'}
                    </small>
                </td>
                <td class="text-end text-muted small">${v25.toLocaleString()}</td>
                <td class="text-center" data-order="${orderVal(r2425)}" data-sort="${orderVal(r2425)}">
                    <small class="text-muted">${r2425 !== null ? (r2425 > 0 ? '+' : '') + r2425.toFixed(1) + '%' : '-'}</small>
                </td>
                <td class="text-end text-muted small">${v24.toLocaleString()}</td>
                <td class="text-center" data-order="${orderVal(r2324)}" data-sort="${orderVal(r2324)}">
                    <small class="text-muted">${r2324 !== null ? (r2324 > 0 ? '+' : '') + r2324.toFixed(1) + '%' : '-'}</small>
                </td>
                <td class="text-end text-muted small">${v23.toLocaleString()}</td>
            </tr>`;
    });

    if ($.fn.DataTable.isDataTable('#analysisTable')) {
        $('#analysisTable').DataTable().clear().destroy();
    }

    tableBody.innerHTML = listHtml;
    
    document.getElementById('loading').style.display = 'none';
    document.getElementById('list-section').style.display = 'block';
    if (document.getElementById('filter-section')) document.getElementById('filter-section').style.display = 'flex';

    $('#analysisTable').DataTable({
        "order": [[3, "desc"]],
        "columnDefs": [
            { "targets": [4, 6, 8], "type": "num" }
        ],
        "pageLength": 25,
        "autoWidth": false,
        "responsive": true,
        "language": { "search": "검색:", "lengthMenu": "_MENU_ 개씩 보기" }
    });
}

function showDetail(name, district) {
    const allYearsData = allRawData.filter(d => d.name === name && d.district === district);
    if (allYearsData.length === 0) return;

    const tableSummary = {};
    let t26=0, t25=0, t24=0, t23=0;

    allYearsData.forEach(item => {
        const type = item.type;
        if (!tableSummary[type]) {
            tableSummary[type] = { 
                y26:0, y25:0, y24:0, y23:0, 
                n26:"", n25:"", n24:"", n23:"",
                n26_2:"", n25_2:"", n24_2:"", n23_2:""
            };
        }
        const yr = String(item.year);
        const val = item.value;
        const signedVal = isDebtType(type) ? -val : val;
        const note = (item.note && item.note.trim() !== "") ? item.note : "";
        const note2 = (item.note2 && item.note2.trim() !== "") ? item.note2 : "";

        if (yr === "2026") { tableSummary[type].y26 += val; t26 += signedVal; tableSummary[type].n26 = note; tableSummary[type].n26_2 = note2; }
        else if (yr === "2025") { tableSummary[type].y25 += val; t25 += signedVal; tableSummary[type].n25 = note; tableSummary[type].n25_2 = note2; }
        else if (yr === "2024") { tableSummary[type].y24 += val; t24 += signedVal; tableSummary[type].n24 = note; tableSummary[type].n24_2 = note2; }
        else if (yr === "2023") { tableSummary[type].y23 += val; t23 += signedVal; tableSummary[type].n23 = note; tableSummary[type].n23_2 = note2; }
    });

    const posText = (allYearsData[0].position || "").trim();
    const partyText = (allYearsData[0].party || "").trim();
    const locLabel = formatDistrictPositionLabel(allYearsData[0].district, posText);
    const escTitle = (s) =>
        String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    const partyColor = (typeof partyColors !== 'undefined' && partyColors[partyText]) ? partyColors[partyText] : "#666";
    const partyBadge = partyText
        ? `<span class="badge ms-2 align-middle" style="background-color:${partyColor}; font-size: 0.75rem;">${escTitle(partyText)}</span>`
        : "";
    document.getElementById("detailModalLabel").innerHTML =
        `<span class="fw-bold" style="font-size:1.1rem; letter-spacing:-0.02em;">${escTitle(name)}</span>` +
        ` <span class="text-muted fw-light" style="font-size:0.82rem;">${escTitle(locLabel)}</span>` +
        partyBadge;

    const escapeAttr = (s) => String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // 비고1: 말풍선 / 비고2: ❗ 강조 아이콘
    const getNoteIcons = (note1, note2) => {
        const a = note1 ? escapeAttr(note1) : "";
        const b = note2 ? escapeAttr(note2) : "";
        const icon1 = a
            ? `<i class="bi bi-chat-left-dots me-1" style="cursor: help; font-size: 0.7rem; color: #555555; opacity: 0.85;" data-bs-toggle="tooltip" data-bs-placement="top" title="${a}"></i>`
            : "";
        const icon2 = b
            ? `<i class="bi bi-exclamation-circle-fill me-1" style="cursor: help; font-size: 0.75rem; color: #dc3545; opacity: 0.95;" data-bs-toggle="tooltip" data-bs-placement="top" title="❗ ${b}"></i>`
            : "";
        return icon2 + icon1;
    };

    let html = `
        <div class="table-responsive">
            <table class="table table-sm table-bordered align-middle mb-0 custom-detail-table">
                <thead class="table-light">
                    <tr>
                        <th style="width:85px">항목</th>
                        <th class="text-end">2026</th>
                        <th class="text-end">2025</th>
                        <th class="text-end">2024</th>
                        <th class="text-end">2023</th>
                    </tr>
                </thead>
                <tbody>`;

    Object.keys(tableSummary).forEach(type => {
        const row = tableSummary[type];
        html += `
            <tr>
                <td class="bg-light fw-bold" style="white-space: normal; min-width: 100px;">
                    ${formatItemType(type)}
                </td>
                <td class="text-end fw-bold text-danger">
                    ${getNoteIcons(row.n26, row.n26_2)}${formatSignedByType(type, row.y26)}
                </td>
                <td class="text-end text-muted small">
                    ${getNoteIcons(row.n25, row.n25_2)}${formatSignedByType(type, row.y25)}
                </td>
                <td class="text-end text-muted small">
                    ${getNoteIcons(row.n24, row.n24_2)}${formatSignedByType(type, row.y24)}
                </td>
                <td class="text-end text-muted small">
                    ${getNoteIcons(row.n23, row.n23_2)}${formatSignedByType(type, row.y23)}
                </td>
            </tr>`;
    });

    html += `</tbody>
                <tfoot style="border-top: 1px solid #dee2e6;">
                    <tr class="fw-bold">
                        <td class="text-center bg-light">총계</td>
                        <td class="text-end text-danger">${t26.toLocaleString()}</td>
                        <td class="text-end text-muted small">${t25.toLocaleString()}</td>
                        <td class="text-end text-muted small">${t24.toLocaleString()}</td>
                        <td class="text-end text-muted small">${t23.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table></div>`;
            
    document.getElementById('detailContent').innerHTML = html;

    const modalEl = document.getElementById('detailModal');
    let myModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalEl.addEventListener('shown.bs.modal', function () {
        if (typeof updateDetailChart === 'function') updateDetailChart(allYearsData);
        [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]')).map(el => new bootstrap.Tooltip(el));
    }, { once: true });
    myModal.show();
}

function updateHighlights(filteredArray) {
    const topN = 10;
    const topWealth = [...filteredArray].sort((a, b) => (b.y2026||0) - (a.y2026||0)).slice(0, topN);
    const topGrowth = [...filteredArray]
        .filter(a => (a.y2025 || 0) > 0)
        .sort((a, b) => ((b.y2026 || 0) - (b.y2025 || 0)) - ((a.y2026 || 0) - (a.y2025 || 0)))
        .slice(0, topN);
    const topRealEstate = [...filteredArray]
        .sort((a, b) => sumRealEstate2026Item(b) - sumRealEstate2026Item(a))
        .slice(0, topN);
    const topFinance = [...filteredArray]
        .sort((a, b) => sumFinance2026Item(b) - sumFinance2026Item(a))
        .slice(0, topN);

    const fillList = (id, items, type) => {
        const container = document.getElementById(id);
        if (!container) return;
        let html = "";
        if (items.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-3" style="font-size:0.8rem;">데이터가 없습니다.</div>`;
            return;
        }
        items.forEach((item, idx) => {
            let val = 0;
            if (type === 'wealth') val = item.y2026 || 0;
            else if (type === 'growth') val = (item.y2026 || 0) - (item.y2025 || 0);
            else if (type === 'realestate') val = sumRealEstate2026Item(item);
            else if (type === 'finance') val = sumFinance2026Item(item);
            const valText =
                type === 'growth'
                    ? formatCheonDeltaEokMan(val)
                    : (val / 100000).toFixed(1) + "억";
            const valClass =
                type === 'growth' ? (val >= 0 ? 'text-danger' : 'text-primary') : 'text-danger';
            const posText = (item.position || "").trim();
            const partyText = (item.party || "").trim();
            const partyColor = (typeof partyColors !== 'undefined' && partyColors[partyText]) ? partyColors[partyText] : "#666";
            const partyBadge = partyText
                ? `<span class="badge ms-1 align-middle flex-shrink-0 text-nowrap" style="background-color:${partyColor}; font-size: 0.6rem;">${partyText}</span>`
                : "";
            const locLabel = formatDistrictPositionLabel(item.district, posText);

            html += `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom gap-2" style="font-size: 0.8rem; cursor:pointer;" onclick="showDetail('${item.name}', '${item.district}')">
                    <div class="d-flex align-items-center flex-grow-1" style="min-width:0;">
                        <span class="flex-shrink-0 fw-bold text-dark me-2 text-end" style="width:2rem; font-variant-numeric: tabular-nums;">${idx + 1}</span>
                        <div class="d-flex align-items-center min-w-0 flex-grow-1" style="min-width:0;">
                            <span class="text-truncate" style="min-width:0;">
                                <span class="fw-bold text-dark">${item.name}</span>
                                <small class="text-muted ms-1">${locLabel}</small>
                            </span>
                            ${partyBadge}
                        </div>
                    </div>
                    <span class="fw-bold ${valClass} flex-shrink-0">${valText}</span>
                </div>`;
        });
        container.innerHTML = html;
    };
    fillList('max-wealth-list', topWealth, 'wealth');
    fillList('max-growth-list', topGrowth, 'growth');
    fillList('max-realestate-list', topRealEstate, 'realestate');
    fillList('max-finance-list', topFinance, 'finance');
    const section = document.getElementById('highlight-section');
    if (section) section.style.display = 'flex';
}