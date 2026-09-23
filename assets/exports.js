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
  const SCRIPT_TOKEN = (() => {
    const scripts = Array.from(document.scripts || []);
    const self = scripts.find(script => /assets\/exports\.js/i.test(script.src || ""));
    const match = self?.src?.match(/[?&]v=([^&]+)/);
    return match ? match[1] : String(META.updatedAt || META.statusAsOn || Date.now()).replace(/\W+/g, "");
  })();
  const groups = [
    {
      title: "Current / Previous Analysis",
      items: [
        ["Current / Previous PDF", "../exports/Current_Previous_Year_PU_Demand_Analysis.pdf", "Generated PDF snapshot refreshed by local sync/upload."],
        ["SMH PU / Department Matrix PDF", "../exports/SMH_PU_Department_Wise_Matrix_Report.pdf", "A3 PDF report: PU-wise and Department-wise ACT, BUD PROP and VAR across SMHs, in thousands and Crore."],
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
    return /\.(pptx|xlsx|pdf)(?:\?|$)/i.test(href) ? "Download" : "Open";
  }

  function fileDownloadAttr(href){
    return /\.(pptx|xlsx|pdf)(?:\?|$)/i.test(href) ? "download" : "";
  }

  function freshHref(href){
    if (!/\.(pptx|xlsx|pdf)$/i.test(href)) return href;
    return `${href}?v=${encodeURIComponent(SCRIPT_TOKEN)}`;
  }

  function renderExports(){
    document.getElementById("exportBoard").innerHTML = groups.map(group => `
      <section class="group">
        <h2>${esc(group.title)}</h2>
        <div class="group-body">
          ${group.items.map(([label, href, note]) => `
            <article class="export-card">
              <div><strong>${esc(label)}</strong><span>${esc(note)}</span></div>
              <a href="${esc(freshHref(href))}" ${fileDownloadAttr(href)}>${fileAction(href)}</a>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  renderExports();
})();
