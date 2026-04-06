/**
 * 예비후보(candidates/) 등에서 재산 목록(archive)과 동일한 상세 모달을 띄우기 위한 스크립트.
 * data.json/detail.json을 로드하고 script.js의 showDetail과 동일한 표·차트를 표시합니다.
 */
(function () {
  "use strict";

  let archiveWealthRawData = [];
  let archiveWealthLoadPromise = null;

  function archiveJsonPath(filename) {
    const p = window.location.pathname || "";
    if (/\/candidates\//.test(p)) return "../" + filename;
    return filename;
  }

  function isDebtType(type) {
    if (!type) return false;
    return /채무|부채/.test(String(type));
  }

  function formatSignedByType(type, value) {
    const v = Number(value) || 0;
    if (isDebtType(type)) return "-" + Math.abs(v).toLocaleString();
    return v.toLocaleString();
  }

  function formatDistrictPositionLabel(district, position) {
    const d = (district || "").trim();
    const pos = (position || "").trim();
    if (!pos) return d;
    if (d === "중구") return d + " " + pos;
    const base = d.length >= 2 && d.endsWith("구") ? d.slice(0, -1) : d;
    if (pos.startsWith("구")) return base + pos;
    return d + " " + pos;
  }

  function formatItemType(type) {
    if (!type) return "";
    const longNameAutomobile =
      "부동산에 관한 규정이 준용되는 권리와 자동차·건설기계·선박 및 항공기";
    const longNameRefusal = "고지거부 및 등록제외사항";
    const longNameInvestment = "합명·합자·유한회사 출자지분";
    const longNameNonProfit = "비영리법인에 출연한 재산";
    const longNameGold = "금 및 백금";
    const longNamePoliticalFunds =
      "정치자금법에 따른 정치자금의 수입 및 지출을 위한 예금계좌의 예금";

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

  function loadArchiveWealthData() {
    if (archiveWealthLoadPromise) return archiveWealthLoadPromise;
    archiveWealthLoadPromise = (async () => {
      const detailRes = await fetch(archiveJsonPath("detail.json"));
      if (!detailRes.ok) throw new Error("detail.json 로드 실패");
      const detailData = await detailRes.json();
      const raw = [];
      Object.keys(detailData || {}).forEach(function (personKey) {
        const person = detailData[personKey];
        if (!person || !person.types) return;
        const district = person.district || "";
        const name = person.name || "";
        const position = person.position || "";
        const party = person.party || "";
        Object.keys(person.types).forEach(function (type) {
          const byYear = person.types[type] || {};
          Object.keys(byYear).forEach(function (yr) {
            const rec = byYear[yr] || {};
            const valueRaw = Number(rec.valueRaw) || 0;
            raw.push({
              year: String(yr),
              district: district,
              position: position,
              party: party,
              name: name,
              type: type,
              value: valueRaw,
              note: rec.note1 || "",
              note2: rec.note2 || "",
            });
          });
        });
      });
      archiveWealthRawData = raw;
      return raw;
    })();
    return archiveWealthLoadPromise;
  }

  function updateArchiveWealthChart(allPersonData) {
    const ctx = document.getElementById("archiveWealthChart");
    if (!ctx || typeof Chart === "undefined") return;
    if (window.archiveWealthChartModalInstance instanceof Chart) {
      window.archiveWealthChartModalInstance.destroy();
    }
    const yearlyTotals = { 2023: 0, 2024: 0, 2025: 0, 2026: 0 };
    allPersonData.forEach(function (d) {
      const yr = String(d.year);
      if (Object.prototype.hasOwnProperty.call(yearlyTotals, yr)) {
        const raw = Number(d.value) || 0;
        const signed = /채무|부채/.test(String(d.type || "")) ? -raw : raw;
        yearlyTotals[yr] += signed;
      }
    });
    const labels = ["2023년", "2024년", "2025년", "2026년"];
    const dataValues = [
      yearlyTotals["2023"],
      yearlyTotals["2024"],
      yearlyTotals["2025"],
      yearlyTotals["2026"],
    ];
    window.archiveWealthChartModalInstance = new Chart(ctx.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "재산 총액 (천원)",
            data: dataValues,
            borderColor: "#e61e2b",
            backgroundColor: "rgba(230, 30, 43, 0.1)",
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: "#e61e2b",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            ticks: {
              callback: function (value) {
                const v = Number(value) || 0;
                if (v === 0) return "0";
                return (v / 100000).toFixed(1) + "억";
              },
              font: { size: 10 },
            },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          x: {
            ticks: { font: { size: 11, fontWeight: "bold" } },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.8)",
            callbacks: {
              label: function (context) {
                const v = Number(context.parsed.y) || 0;
                const pretty = v === 0 ? "0" : (v / 100000).toFixed(2) + "억";
                return " 총액: " + pretty;
              },
            },
          },
        },
      },
    });
  }

  function openArchiveWealthDetailImpl(name, district) {
    const allYearsData = archiveWealthRawData.filter(function (d) {
      return d.name === name && d.district === district;
    });
    if (allYearsData.length === 0) {
      alert("재산 세부 데이터를 찾을 수 없습니다.");
      return;
    }

    const tableSummary = {};
    let t26 = 0,
      t25 = 0,
      t24 = 0,
      t23 = 0;

    allYearsData.forEach(function (item) {
      const type = item.type;
      if (!tableSummary[type]) {
        tableSummary[type] = {
          y26: 0,
          y25: 0,
          y24: 0,
          y23: 0,
          n26: "",
          n25: "",
          n24: "",
          n23: "",
          n26_2: "",
          n25_2: "",
          n24_2: "",
          n23_2: "",
        };
      }
      const yr = String(item.year);
      const val = item.value;
      const signedVal = isDebtType(type) ? -val : val;
      const note = item.note && item.note.trim() !== "" ? item.note : "";
      const note2 = item.note2 && item.note2.trim() !== "" ? item.note2 : "";

      if (yr === "2026") {
        tableSummary[type].y26 += val;
        t26 += signedVal;
        tableSummary[type].n26 = note;
        tableSummary[type].n26_2 = note2;
      } else if (yr === "2025") {
        tableSummary[type].y25 += val;
        t25 += signedVal;
        tableSummary[type].n25 = note;
        tableSummary[type].n25_2 = note2;
      } else if (yr === "2024") {
        tableSummary[type].y24 += val;
        t24 += signedVal;
        tableSummary[type].n24 = note;
        tableSummary[type].n24_2 = note2;
      } else if (yr === "2023") {
        tableSummary[type].y23 += val;
        t23 += signedVal;
        tableSummary[type].n23 = note;
        tableSummary[type].n23_2 = note2;
      }
    });

    const posText = (allYearsData[0].position || "").trim();
    const partyText = (allYearsData[0].party || "").trim();
    const locLabel = formatDistrictPositionLabel(allYearsData[0].district, posText);
    const escTitle = function (s) {
      return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    };
    const partyColor =
      typeof partyColors !== "undefined" && partyColors[partyText]
        ? partyColors[partyText]
        : "#666";
    const partyBadge = partyText
      ? `<span class="badge ms-2 align-middle" style="background-color:${partyColor}; font-size: 0.75rem;">${escTitle(partyText)}</span>`
      : "";

    const labelEl = document.getElementById("archiveWealthModalLabel");
    if (labelEl) {
      labelEl.innerHTML =
        `<span class="fw-bold" style="font-size:1.1rem; letter-spacing:-0.02em;">${escTitle(name)}</span>` +
        ` <span class="text-muted fw-light" style="font-size:0.82rem;">${escTitle(locLabel)}</span>` +
        partyBadge;
    }

    const escapeAttr = function (s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    const getNoteIcons = function (note1, note2) {
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

    let html =
      '<div class="table-responsive">' +
      '<table class="table table-sm table-bordered align-middle mb-0 custom-detail-table">' +
      "<thead class=\"table-light\"><tr>" +
      '<th style="width:85px">항목</th>' +
      '<th class="text-end">2026</th>' +
      '<th class="text-end">2025</th>' +
      '<th class="text-end">2024</th>' +
      '<th class="text-end">2023</th>' +
      "</tr></thead><tbody>";

    Object.keys(tableSummary).forEach(function (type) {
      const row = tableSummary[type];
      html +=
        "<tr>" +
        '<td class="bg-light fw-bold" style="white-space: normal; min-width: 100px;">' +
        formatItemType(type) +
        "</td>" +
        '<td class="text-end fw-bold text-danger">' +
        getNoteIcons(row.n26, row.n26_2) +
        formatSignedByType(type, row.y26) +
        "</td>" +
        '<td class="text-end text-muted small">' +
        getNoteIcons(row.n25, row.n25_2) +
        formatSignedByType(type, row.y25) +
        "</td>" +
        '<td class="text-end text-muted small">' +
        getNoteIcons(row.n24, row.n24_2) +
        formatSignedByType(type, row.y24) +
        "</td>" +
        '<td class="text-end text-muted small">' +
        getNoteIcons(row.n23, row.n23_2) +
        formatSignedByType(type, row.y23) +
        "</td>" +
        "</tr>";
    });

    html +=
      "</tbody><tfoot style=\"border-top: 1px solid #dee2e6;\"><tr class=\"fw-bold\">" +
      '<td class="text-center bg-light">총계</td>' +
      '<td class="text-end text-danger">' +
      t26.toLocaleString() +
      "</td>" +
      '<td class="text-end text-muted small">' +
      t25.toLocaleString() +
      "</td>" +
      '<td class="text-end text-muted small">' +
      t24.toLocaleString() +
      "</td>" +
      '<td class="text-end text-muted small">' +
      t23.toLocaleString() +
      "</td>" +
      "</tr></tfoot></table></div>";

    const contentEl = document.getElementById("archiveWealthContent");
    if (contentEl) contentEl.innerHTML = html;

    const modalEl = document.getElementById("archiveWealthModal");
    if (!modalEl || typeof bootstrap === "undefined") return;

    const myModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalEl.addEventListener(
      "shown.bs.modal",
      function () {
        updateArchiveWealthChart(allYearsData);
        modalEl.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
          try {
            new bootstrap.Tooltip(el);
          } catch (_) {}
        });
      },
      { once: true }
    );
    myModal.show();
  }

  async function openArchiveWealthDetail(name, district) {
    try {
      await loadArchiveWealthData();
      openArchiveWealthDetailImpl(name, district);
    } catch (e) {
      console.error(e);
      alert("재산 데이터를 불러오지 못했습니다. detail.json·data.json 경로를 확인해 주세요.");
    }
  }

  window.openArchiveWealthDetail = openArchiveWealthDetail;

  document.body.addEventListener("click", function (e) {
    const b = e.target.closest("[data-open-archive-wealth]");
    if (!b) return;
    e.preventDefault();
    const name = b.getAttribute("data-archive-wealth") || "";
    const district = b.getAttribute("data-archive-district") || "";
    if (name && district) openArchiveWealthDetail(name, district);
  });
})();
