(function(){
  const DATA = window.CURRENT_PAYLOAD || {};
  const REPORTS = window.REPORTS_DATA || {};
  const SOURCES = window.YEAR_DATA_SOURCES || {};
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n || 0).toLocaleString("en-IN", {maximumFractionDigits:0});
  const crore = n => (Number(n || 0) / 10000).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
  const rows = key => DATA[key]?.rows || [];
  const detailRows = list => (list || []).filter(row => String(row.Name || row.PU || row.Demand || "").toLowerCase() !== "total");
  const totalRow = key => rows(key).find(row => String(row.Name || "").toLowerCase() === "total") || {};
  const suspenseRows = list => detailRows(list).filter(row => /\b(12N|10N)\b/i.test(row.Name || "") || /suspense/i.test(row.Department || ""));
  const importantPuRows = list => detailRows(list).filter(row => /PU\s*-\s*(27|28|30|32|60)\b/i.test(row.Name || ""));
  const latestYear = (REPORTS.years || []).at(-1)?.fy || "2026-27";
  const previousYear = (REPORTS.years || []).at(-2)?.fy || "2025-26";
  const mode = ["localhost","127.0.0.1"].includes(location.hostname) ? "Local admin mode" : "GitHub / static view";
  $("modePill").textContent = mode;

  function card(label, value, note){
    return `<article class="card"><span>${label}</span><strong>${value}</strong><em>${note || ""}</em></article>`;
  }
  function moneyPair(value){ return `${fmt(value)} | Cr ${crore(value)}`; }
  function renderSummary(manifest){
    const sourceCount = Object.keys(SOURCES.sources || {}).length;
    const currentTotal = totalRow("demand");
    $("summaryCards").innerHTML = [
      card("Portal Mode", mode, mode.includes("Local") ? "Upload and backup APIs should be available." : "Upload/backup actions need local server."),
      card("Data Basis", "JUN 2026", "Completed month projection. JUL remains running/till-date."),
      card("Current Demand AE", moneyPair(currentTotal.AE), `${latestYear}; main total excludes 12N / 10N.`),
      card("FR Data As On", manifest?.uploadedAt ? new Date(manifest.uploadedAt).toLocaleString("en-IN") : "Not recorded", manifest?.originalName || "FR manifest not available")
    ].join("");
    if(sourceCount) $("summaryCards").insertAdjacentHTML("beforeend", card("Year Sources", sourceCount, `${previousYear} previous and ${latestYear} current mappings loaded.`));
  }
  function renderTables(){
    const items = [
      ["Demand / SMH Current", "demand"],
      ["PU Staff Current", "staff"],
      ["PU Non-Staff Current", "nonstaff"],
      ["PU Previous Comparison", "pu_prev"],
      ["Demand Previous Comparison", "demand_prev"]
    ];
    $("tableHealth").innerHTML = `<table class="health-table"><thead><tr><th>Table</th><th>Rows</th><th>OBA / RG</th><th>BP</th><th>AE</th><th>Important PU</th><th>Suspense</th><th>Status</th></tr></thead><tbody>${items.map(([label,key])=>{
      const list = rows(key);
      const total = totalRow(key);
      const ae = total.AE ?? total.AECurrent ?? 0;
      const oba = total.OBA ?? total.PreviousOBA ?? 0;
      const status = list.length ? "OK" : "Missing";
      return `<tr><td>${label}</td><td>${detailRows(list).length}</td><td>${moneyPair(oba)}</td><td>${moneyPair(total.BP || total.PreviousBP || 0)}</td><td>${moneyPair(ae)}</td><td>${importantPuRows(list).length}</td><td>${suspenseRows(list).length}</td><td class="${status==="OK"?"ok":"bad"}">${status}</td></tr>`;
    }).join("")}</tbody></table>`;
  }
  function renderAttention(manifest){
    const demandSuspense = suspenseRows(rows("demand"));
    const nonstaffTotal = totalRow("nonstaff");
    const pu98 = detailRows(rows("nonstaff")).find(row => /^PU\s*-\s*98\b/i.test(row.Name || ""));
    const issues = [
      {tone:"warn", title:"Completed month rule", text:"Default report basis is JUN 2026; running JUL 2026 data must remain in Till Date / Running Month views."},
      {tone:"bad", title:"Demand 12N / 10N separate", text:`${demandSuspense.length} suspense row(s) detected and should stay outside main demand total.`},
      pu98 ? {tone:"bad", title:"PU - 98 Credit / Recoveries", text:`Remaining balance ${moneyPair(pu98.Remaining)}. Review separately due negative/recovery behavior.`} : null,
      {tone:"warn", title:"Important PU focus", text:`${importantPuRows(rows("nonstaff")).length} important non-staff PU rows detected: 27, 28, 30, 32, 60.`},
      manifest?.backups?.length ? {tone:"", title:"FR backup copies", text:`${manifest.backups.length} backup folder(s) listed in FR manifest.`} : {tone:"warn", title:"FR backup copies", text:"No FR backup copy is listed yet in the repository manifest."}
    ].filter(Boolean);
    $("attentionList").innerHTML = `<div class="list">${issues.map(item=>`<div class="item ${item.tone}"><strong>${item.title}</strong><span>${item.text}</span></div>`).join("")}</div>`;
  }
  function renderExports(){
    const exports = [
      ["Current / Previous PPTX", "../exports/Moradabad_Division_Current_Year_Budget_Analysis.pptx"],
      ["DRM PPTX", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis.pptx"],
      ["DRM Excel", "../exports/Moradabad_Division_DRM_Budget_FR_Analysis.xlsx"],
      ["Current / Previous PDF", "../exports/Current_Previous_Year_PU_Demand_Analysis.pdf"],
      ["FR Budget PDF", "../exports/FR_Budget_Status.pdf"]
    ];
    $("exportHealth").innerHTML = `<div class="export-grid">${exports.map(([label,href])=>`<div class="export-row"><a href="${href}" download>${label}</a><span>${href.split("/").pop()}</span></div>`).join("")}</div>`;
  }
  async function loadManifest(){
    try{
      const response = await fetch("../data/fr/fr-upload-manifest.json?ts=" + Date.now());
      return response.ok ? await response.json() : null;
    }catch{ return null; }
  }
  loadManifest().then(manifest => {
    renderSummary(manifest);
    renderTables();
    renderAttention(manifest);
    renderExports();
  });
})();
