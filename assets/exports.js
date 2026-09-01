(function(){
  const META = window.CURRENT_PAYLOAD_META || {};
  const PERIOD_MONTHS = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"];
  function period(label, fallback) {
    const text = String(label || fallback || "AUG 2026").trim().toUpperCase();
    const month = (text.match(/([A-Z]{3})\s+20\d{2}/) || [null, text.slice(0, 3)])[1];
    const count = Math.max(1, PERIOD_MONTHS.indexOf(month) + 1 || 4);
    return { label: text, count };
  }
  const COMPLETED = period(META.completedMonth, "AUG 2026");
  const RUNNING = period(META.runningMonth, "SEP 2026");
  const BASIS_SOURCE = META.basisSource || "auto-sensed from uploaded file";
  const EXPECTED = { month: COMPLETED.label, months: COMPLETED.count };
  const committedFiles = [
    ["Current / Previous PDF", "../exports/Current_Previous_Year_PU_Demand_Analysis.pdf", "PDF", `Completed ${COMPLETED.label}`],
    ["Current / Previous Excel", "../exports/Current_Previous_Year_PU_Demand_Analysis.xlsx", "XLSX", `Completed ${COMPLETED.label}`],
    ["Current / Previous PPTX", "../exports/Moradabad_Division_Current_Year_Budget_Analysis.pptx", "PPTX", `Completed ${COMPLETED.label}`],
    ["DRM Existing Current-Year PPTX", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis.pptx", "PPTX", `Completed ${COMPLETED.label} + H full FY 2025-26`],
    ["DRM H Till Actual Month PPTX", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis_H_Till_Actual_Month.pptx", "PPTX", `Completed ${COMPLETED.label} + H up to ${COMPLETED.label.replace("2026", "2025")}`],
    ["DRM Full Previous-Year PPTX", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis_H_Full_FY_2025_26_Actual.pptx", "PPTX", `Completed ${COMPLETED.label} + H full FY 2025-26`],
    ["DRM Yearly Comparison PPTX", "../exports/Moradabad_Division_DRM_PPT_With_Yearly_Comparison.pptx", "PPTX", "Yearly comparison"],
    ["DRM Excel", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis.xlsx", "XLSX", `Completed ${COMPLETED.label}`],
    ["FR Budget PDF", "../exports/FR_Budget_Status.pdf", "PDF", "FR as uploaded"],
    ["FR Budget Excel", "../exports/FR_Budget_Status.xlsx", "XLSX", "FR as uploaded"]
  ];
  const groups = [
    {
      title: "Current / Previous Analysis",
      items: [
        ["Current / Previous PDF", "../exports/Current_Previous_Year_PU_Demand_Analysis.pdf", "Generated PDF snapshot refreshed by local sync/upload."],
        ["Current / Previous Excel (.xlsx)", "../exports/Current_Previous_Year_PU_Demand_Analysis.xlsx", "Generated .xlsx snapshot refreshed by local sync/upload."],
        ["Current / Previous PPTX", "../exports/Moradabad_Division_Current_Year_Budget_Analysis.pptx", `Presentation deck. Completed month basis: ${COMPLETED.label}.`]
      ]
    },
    {
      title: "DRM Presentation Package",
      items: [
        ["Existing Current-Year PPTX", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis.pptx", "Editable PowerPoint table deck for DRM review, refreshed from latest portal data."],
        ["Till Actual Month PPTX", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis_H_Till_Actual_Month.pptx", `H column shows corresponding previous-year actuals up to ${COMPLETED.label.replace("2026", "2025")}.`],
        ["Full Previous-Year PPTX", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis_H_Full_FY_2025_26_Actual.pptx", "H column shows final actual expenditure for FY 2025-26."],
        ["Export-DRM(Excel)", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis.xlsx", "Workbook matching the DRM package sections."],
        ["Data Health", "status.html", "Verify completed/running month, suspense rows and export readiness."]
      ]
    },
    {
      title: "DRM PPT With Yearly Comparison",
      items: [
        ["Yearly Comparison PPTX", "../exports/Moradabad_Division_DRM_PPT_With_Yearly_Comparison.pptx", "Editable DRM comparison deck imported into the portal and refreshed with every local sync/upload export cycle."]
      ]
    },
    {
      title: "FR Budget Status",
      items: [
        ["FR Budget PDF", "../exports/FR_Budget_Status.pdf", "Generated FR PDF snapshot refreshed by FR sync/upload."],
        ["FR Budget Excel (.xlsx)", "../exports/FR_Budget_Status.xlsx", "Generated .xlsx snapshot refreshed by FR sync/upload."],
        ["Local FR Sync", "fr.html", "Open FR page local sync status and launcher instructions."]
      ]
    },
    {
      title: "Verification",
      items: [
        ["Formula / Column Remarks", "logic.html", "Formula and column logic reference."],
        ["Admin Portal", "admin.html", "Local-only customization, backup and MBRLR sync controls."],
        ["Portal Status", "status.html", "Loaded source health and exception checks."]
      ]
    }
  ];

  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }

  function fileAction(href){
    return /\.(pptx|xlsx|pdf)$/i.test(href) ? "Download" : "Open";
  }

  function fileDownloadAttr(href){
    return /\.(pptx|xlsx|pdf)$/i.test(href) ? "download" : "";
  }

  function firstCurrentTable(){
    const payload = window.CURRENT_PAYLOAD || {};
    return payload.demand || payload.staff || payload.nonstaff || {};
  }

  function payloadBasis(){
    const table = firstCurrentTable();
    const labels = (table.columns || []).map(col => String(col.label || "")).join(" | ");
    const rowMonths = (table.rows || []).map(row => Number(row.Months || 0)).filter(Boolean);
    const maxMonths = rowMonths.length ? Math.max(...rowMonths) : 0;
    const hasRunning = labels.toUpperCase().includes(RUNNING.label);
    const hasCompleted = labels.toUpperCase().includes(COMPLETED.label);
    return { labels, maxMonths, hasRunning, hasCompleted };
  }

  function renderBasisGuard(){
    const basis = payloadBasis();
    const mismatch = basis.hasRunning || basis.maxMonths > EXPECTED.months;
    const tone = mismatch ? "warn" : "ok";
    const title = mismatch ? "Source Payload Contains Running-Month Data" : "GUI Basis Looks Aligned";
    const detail = mismatch
      ? `Loaded source mentions ${RUNNING.label} / ${basis.maxMonths || "?"} months. Portal default reports should continue to present completed ${COMPLETED.label} / ${String(COMPLETED.count).padStart(2, "0")}-month basis, with ${RUNNING.label} only in running-month views.`
      : `Loaded source appears aligned with completed ${COMPLETED.label} / ${String(COMPLETED.count).padStart(2, "0")}-month basis.`;
    document.getElementById("basisGuard").innerHTML = `
      <div class="guard ${tone}">
        <div><strong>${esc(title)}</strong><span>${esc(detail)}</span></div>
        <a href="status.html">Open Data Health</a>
      </div>
    `;
  }

  function renderExports(){
    document.getElementById("exportBoard").innerHTML = groups.map(group => `
      <section class="group">
        <h2>${esc(group.title)}</h2>
        <div class="group-body">
          ${group.items.map(([label, href, note]) => `
            <article class="export-card">
              <div><strong>${esc(label)}</strong><span>${esc(note)}</span></div>
              <a href="${esc(href)}" ${fileDownloadAttr(href)}>${fileAction(href)}</a>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  function reviewPackText(){
    return [
      "MB Budget Authority Review Pack",
      "",
      `GUI synced basis: Completed actuals up to ${COMPLETED.label} with ${String(COMPLETED.count).padStart(2, "0")}-month BP projection.`,
      `Basis source: ${BASIS_SOURCE}.`,
      `Running month: ${RUNNING.label} data should be reviewed only in Till Date / Running Month views.`,
      "Attention: Important PU 27, 28, 30, 32 and 60 should be checked separately.",
      "Suspense: Demand 12N / 10N remains separate and excluded from normal demand totals.",
      "",
      "Files / pages:",
      "- Current / Previous Analysis PDF: exports/Current_Previous_Year_PU_Demand_Analysis.pdf",
      "- Current / Previous Analysis Excel: exports/Current_Previous_Year_PU_Demand_Analysis.xlsx",
      "- DRM Existing Current-Year PPTX: exports/Moradabad_Division_DRM_Budget_FR_Analysis.pptx",
      "- DRM Till Actual Month PPTX: exports/Moradabad_Division_DRM_Budget_FR_Analysis_H_Till_Actual_Month.pptx",
      "- DRM Full Previous-Year PPTX: exports/Moradabad_Division_DRM_Budget_FR_Analysis_H_Full_FY_2025_26_Actual.pptx",
      "- DRM Yearly Comparison PPTX: exports/Moradabad_Division_DRM_PPT_With_Yearly_Comparison.pptx",
      "- DRM Excel: exports/Moradabad_Division_DRM_Budget_FR_Analysis.xlsx",
      "- FR PDF: exports/FR_Budget_Status.pdf",
      "- FR Excel: exports/FR_Budget_Status.xlsx",
      "- Data Health: pages/status.html"
    ].join("\n");
  }

  function renderReviewPack(){
    const items = [
      ["Current Review", "PDF, .xlsx and PPTX snapshot for Current / Previous Analysis."],
      ["DRM Review", "Editable PPTX and Excel package for presentation work."],
      ["FR Review", "PDF and .xlsx snapshot from FR Budget Status."],
      ["Audit Checks", "Data Health, Formula Remarks, Demand 12N / 10N and important PU checks."]
    ];
    document.getElementById("reviewPack").innerHTML = items.map(([title, text]) => `
      <article class="pack-card"><strong>${esc(title)}</strong><span>${esc(text)}</span></article>
    `).join("");
    document.getElementById("reviewPackText").textContent = reviewPackText();
  }

  function statusFor(file, modified){
    if (/legacy/i.test(file[2])) return "Legacy";
    if (!modified) return "Check";
    const ageDays = (Date.now() - modified.getTime()) / 86400000;
    return ageDays > 14 ? "Old" : "Fresh";
  }

  async function headInfo(href){
    try {
      const response = await fetch(href, { method: "HEAD", cache: "no-store" });
      if (!response.ok) return { exists: false, modified: null };
      const raw = response.headers.get("Last-Modified");
      return { exists: true, modified: raw ? new Date(raw) : null };
    } catch (_error) {
      return { exists: null, modified: null };
    }
  }

  async function renderRefreshProof(){
    const host = document.getElementById("refreshProof");
    if (!host) return;
    try {
      const response = await fetch("../data/export-refresh-manifest.json?ts=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("Manifest not available");
      const manifest = await response.json();
      const missing = manifest.missing?.length ? `Missing: ${manifest.missing.join(", ")}` : "All expected export files present.";
      const tone = manifest.status === "success" ? "ok" : "warn";
      host.innerHTML = `<div class="guard ${tone}"><div><strong>${esc(manifest.status === "success" ? "Exports Refreshed" : "Export Refresh Needs Review")}</strong><span>Refreshed ${esc(new Date(manifest.refreshedAt).toLocaleString("en-IN"))} by ${esc(manifest.trigger || "unknown")}. ${esc(missing)}</span></div><a href="status.html">Open Status</a></div>`;
    } catch (_error) {
      host.innerHTML = `<div class="guard warn"><div><strong>Export Refresh Manifest Not Found</strong><span>Run local sync/upload once to generate the export refresh manifest.</span></div><a href="status.html">Open Status</a></div>`;
    }
  }

  async function renderFreshness(){
    const rows = await Promise.all(committedFiles.map(async file => {
      const info = await headInfo(file[1]);
      const status = info.exists === false ? "Missing" : statusFor(file, info.modified);
      const modified = info.modified ? info.modified.toLocaleString("en-IN") : (info.exists === null ? "Open via local/server to check" : "Not available");
      return { file, status, modified };
    }));
    document.getElementById("freshnessStamp").textContent = `Checked ${new Date().toLocaleString("en-IN")}`;
    document.getElementById("freshnessTable").innerHTML = `
      <table>
        <thead><tr><th>Export</th><th>Type</th><th>Basis</th><th>Last Modified</th><th>Status</th></tr></thead>
        <tbody>${rows.map(({file, status, modified}) => `
          <tr class="${status.toLowerCase()}">
            <td><a href="${esc(file[1])}" ${fileDownloadAttr(file[1])}>${esc(file[0])}</a></td>
            <td>${esc(file[2])}</td>
            <td>${esc(file[3])}</td>
            <td>${esc(modified)}</td>
            <td>${esc(status)}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    `;
  }

  document.getElementById("copyReviewPack")?.addEventListener("click", async () => {
    const text = reviewPackText();
    document.getElementById("reviewPackText").textContent = text;
    try {
      await navigator.clipboard.writeText(text);
      document.getElementById("reviewPackText").textContent = `${text}\n\nCopied review pack summary to clipboard.`;
    } catch (_error) {
      document.getElementById("reviewPackText").textContent = `${text}\n\nClipboard copy was blocked. Select this text and copy manually.`;
    }
  });

  renderBasisGuard();
  renderRefreshProof();
  renderExports();
  renderReviewPack();
  renderFreshness();
})();
