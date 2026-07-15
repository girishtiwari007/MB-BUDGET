(function(){
  const groups = [
    {
      title: "Current / Previous Analysis",
      items: [
        ["Current / Previous PPTX", "../exports/Moradabad_Division_Current_Year_Budget_Analysis.pptx", "Presentation deck. Completed month basis: JUN 2026."],
        ["Current / Previous PDF", "../exports/Current_Previous_Year_PU_Demand_Analysis.pdf", "Legacy committed PDF export for quick reference."],
        ["Current / Previous Excel", "current.html", "Open Current / Previous page and use Export Excel for live browser-generated .xlsx."]
      ]
    },
    {
      title: "DRM Presentation Package",
      items: [
        ["Export-DRM(PPTX)", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis.pptx", "Editable PowerPoint table deck for DRM review."],
        ["Export-DRM(Excel)", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis.xlsx", "Workbook matching the DRM package sections."],
        ["Sample basis", "status.html", "Open Data Health to verify completed/running month and row filters."]
      ]
    },
    {
      title: "FR Budget Status",
      items: [
        ["FR Budget PDF", "../exports/FR_Budget_Status.pdf", "Committed FR PDF snapshot."],
        ["FR Budget Excel", "fr.html", "Open FR Budget Status and use Export Excel for current display .xlsx."],
        ["FR Upload", "fr.html", "Open FR page upload tab when local server is running."]
      ]
    },
    {
      title: "Verification",
      items: [
        ["Data Health", "status.html", "Loaded sources, suspense rows, FR as-on date and export readiness."],
        ["Calculation Logic", "logic.html", "Formula and column logic reference."],
        ["Admin Portal", "admin.html", "Local-only customization, backup and MBRLR sync controls."]
      ]
    }
  ];
  document.getElementById("exportBoard").innerHTML = groups.map(group => `
    <section class="group">
      <h2>${group.title}</h2>
      <div class="group-body">
        ${group.items.map(([label, href, note]) => `
          <article class="export-card">
            <div><strong>${label}</strong><span>${note}</span></div>
            <a href="${href}" ${/\.(pptx|xlsx|pdf)$/i.test(href) ? "download" : ""}>Open</a>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
})();
