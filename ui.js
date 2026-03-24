// ui.js - 상세 리포트 및 공통 UI 제어

function showDetailFromHighlight(type) { 
    if (highlights[type]) showDetail(highlights[type].name, highlights[type].district); 
}

function showDetail(mName, dName) {
    let mDetail = {};
    allRawData.forEach(row => {
        if (row.name === mName && row.district === dName) {
            if (!mDetail[row.type]) mDetail[row.type] = { y2025: 0, y2024: 0, y2023: 0 };
            if (row.year == "2025") mDetail[row.type].y2025 += row.value;
            else if (row.year == "2024") mDetail[row.type].y2024 += row.value;
            else if (row.year == "2023") mDetail[row.type].y2023 += row.value;
        }
    });
    
    let dHtml = '';
    const order = ["토지", "건물", "부동산에 관한 규정이 준용되는 권리와 자동차·건설기계·선박 및 항공기", "현금", "예금", "정치자금의 수입 및 지출을 위한 예금계좌의 예금", "증권", "합명·합자·유한회사 출자지분", "채권", "채무", "가상자산", "합계", "고지거부 및 등록제외사항"];
    
    order.forEach(t => {
        if (mDetail[t]) {
            dHtml += `<tr class="${t.includes('합계') ? 'table-info-custom' : ''}"><td>${t}</td><td class="text-right">${mDetail[t].y2025.toLocaleString()}</td><td class="text-right">${mDetail[t].y2024.toLocaleString()}</td><td class="text-right">${mDetail[t].y2023.toLocaleString()}</td></tr>`;
            delete mDetail[t];
        }
    });
    
    for (let t in mDetail) dHtml += `<tr><td>${t}</td><td class="text-right">${mDetail[t].y2025.toLocaleString()}</td><td class="text-right">${mDetail[t].y2024.toLocaleString()}</td><td class="text-right">${mDetail[t].y2023.toLocaleString()}</td></tr>`;
    
    if(document.getElementById('detail-title')) document.getElementById('detail-title').innerText = `🏛️ ${dName} ${mName} 상세 리포트`;
    if(document.getElementById('detailTableBody')) document.getElementById('detailTableBody').innerHTML = dHtml;
    
    // 섹션 전환
    const sections = ['highlight-section', 'list-section', 'stat-section'];
    sections.forEach(s => {
        if (document.getElementById(s)) document.getElementById(s).style.display = 'none';
    });
    
    if (document.getElementById('detail-section')) document.getElementById('detail-section').style.display = 'block';
    window.scrollTo(0, 0);
}

function hideDetail() {
    if (document.getElementById('detail-section')) document.getElementById('detail-section').style.display = 'none';
    
    const sections = ['highlight-section', 'list-section', 'stat-section'];
    sections.forEach(s => {
        if (document.getElementById(s)) {
            // 하이라이트 섹션은 flex로, 나머지는 block으로 복구
            document.getElementById(s).style.display = (s === 'highlight-section') ? 'flex' : 'block';
        }
    });
}
