const REPORT_LOGIC = {
  current_demand: {
    title: "Demand / SMH Wise Current Year",
    basis: "GUI synced basis is completed actual expenditure up to AUG 2026. September is treated as running/till-date and shown separately.",
    columns: [
      ["Demand No. / SMH-Grant", "Demand and Sub Major Head grouping from source file."],
      ["Department", "Department mapped from Demand / SMH."],
      ["OBA", "Original Budget Allotment from BG_ISL 2026-27."],
      ["BP", "OBA / 12 * completed month count. Default month count is 05 for APR-AUG."],
      ["AE", "Actual Expenditure up to completed month. Default is actual up to AUG 2026."],
      ["Variation", "AE - BP."],
      ["% BP", "AE / BP * 100."],
      ["Budget Remaining", "OBA - AE."],
      ["% OBA Utilized", "AE / OBA * 100."]
    ],
    steps: ["Load current-year budget and actual source files.", "Use completed month basis by default.", "Calculate BP from OBA and month count.", "Compare actual expenditure against BP and OBA."]
  },
  current_pu_staff: {
    title: "PU Staff Current Year",
    basis: "GUI synced basis is completed actual expenditure up to AUG 2026. Staff PUs are filtered by staff PU code list.",
    columns: [
      ["PU", "Primary Unit name/code."],
      ["OBA", "Original Budget Allotment from BG_ISL 2026-27."],
      ["BP", "OBA / 12 * completed month count from GUI sync basis."],
      ["AE", "Actual expenditure up to AUG 2026."],
      ["Variation", "AE - BP."],
      ["% BP", "AE / BP * 100."],
      ["Budget Remaining", "OBA - AE."],
      ["% OBA Utilized", "AE / OBA * 100."]
    ],
    steps: ["Read all PU budget rows.", "Keep staff PU codes only.", "Use completed month actuals up to July.", "Add total row from filtered rows."]
  },
  current_pu_nonstaff: {
    title: "PU Non-Staff Current Year",
    basis: "GUI synced basis is completed actual expenditure up to AUG 2026. Non-staff PUs are all PUs outside staff PU code list.",
    columns: [
      ["PU", "Primary Unit name/code."],
      ["OBA", "Original Budget Allotment from BG_ISL 2026-27."],
      ["BP", "OBA / 12 * completed month count from GUI sync basis."],
      ["AE", "Actual expenditure up to AUG 2026."],
      ["Variation", "AE - BP."],
      ["% BP", "AE / BP * 100."],
      ["Budget Remaining", "OBA - AE."],
      ["% OBA Utilized", "AE / OBA * 100."]
    ],
    steps: ["Read all PU budget rows.", "Exclude staff PU codes.", "Apply Important PU filter when selected.", "Add total row from visible rows."]
  },
  previous_pu: {
    title: "PU Wise Previous Year Comparison",
    basis: "Previous year OBA uses RG 2025-26. Current year OBA uses BG_ISL 2026-27 until current RG is available.",
    columns: [
      ["Previous OBA", "Previous-year RG 2025-26."],
      ["Previous BP", "Previous OBA / 12 * completed month count."],
      ["Previous Actual", "Previous-year actual expenditure up to same completed month."],
      ["Current OBA", "Current-year BG_ISL 2026-27."],
      ["Current BP", "Current OBA / 12 * completed month count."],
      ["Current Actual", "Current-year actual expenditure up to completed month."],
      ["Budget Variation", "Current Actual - Current BP."],
      ["% Current BP", "Current Actual / Current BP * 100."],
      ["Actual Variation", "Current Actual - Previous Actual."],
      ["% Current OBA", "Current Actual / Current OBA * 100."]
    ],
    steps: ["Match PU codes across previous and current files.", "Use same completed month count for both years.", "Compare current actual to current BP and previous actual."]
  },
  till_date: {
    title: "Till Date / Running Month",
    basis: "This page keeps September as running/till-date data. It is separate from default completed-actual calculation.",
    columns: [
      ["OBA", "Original Budget Allotment as available in source."],
      ["BP", "OBA / 12 * 06 when September running month is included."],
      ["AE", "Actual expenditure up to AUG 2026 as loaded/uploaded."],
      ["Variation", "AE - BP."],
      ["Budget Remaining", "OBA - AE."],
      ["Utilization", "AE divided by BP or OBA depending on column."]
    ],
    steps: ["Preserve original uploaded August-running values.", "Show timestamp of data load.", "Do not mix these values into default June-completed projection."]
  },
  advanced_monthly: {
    title: "Advanced Report - Month-Wise Expenditure",
    basis: "Actual Basis selector controls latest-year active months: completed AUG 2026 (05) or till-date SEP 2026 (06).",
    columns: [
      ["Month columns", "Actual expenditure booked in each month."],
      ["N/A months", "Months beyond selected basis are shown as N/A for latest year."],
      ["Total", "Sum of visible/active month columns for selected basis."]
    ],
    steps: ["Select report title and item.", "Choose Actual Basis.", "Chart and table use the same month basis.", "Important PU filter limits visible PU rows/items."]
  },
  advanced_utilization: {
    title: "Advanced Report - Budget Proportion vs Actual Expenditure",
    basis: "GUI synced basis is completed AUG 2026 (05). Till-date option uses SEP 2026 running month (06).",
    columns: [
      ["OBA", "Original Budget Allotment."],
      ["BP", "OBA / 12 * active month count for latest year; source BP is used for older years where available."],
      ["AE", "Actual Expenditure up to selected Actual Basis month."],
      ["AE - BP", "Actual Expenditure minus Budget Proportion."],
      ["% BP Utilized", "AE / BP * 100."],
      ["% OBA Utilized", "AE / OBA * 100."]
    ],
    steps: ["Choose report scope: PU or Demand.", "Choose selected item.", "Apply Important PU filter if needed.", "Compare OBA, BP and AE using selected basis."]
  },
  upload: {
    title: "Upload Data Workflow",
    basis: "Previous-year data remains static repository reference. Current-year data is the monthly update target.",
    columns: [
      ["Load Repo Sources", "Shows configured repo files and loads available sources for verification."],
      ["Verify / Recalculate", "Parses uploaded latest current-year files and refreshes browser calculations."],
      ["Confirm & Store", "Writes current-year files to data/source-files/current-year folder after confirmation."],
      ["Backups", "Before overwrite, current files are copied to backup folder; latest two backups are retained."]
    ],
    steps: ["Upload latest six current-year files.", "Verify / Recalculate first.", "Review tables and formulas.", "Confirm & Store only after verification.", "Commit/push changed repo files from GitHub Desktop."]
  }
};

const META = window.CURRENT_PAYLOAD_META || {};
const MONTH_ORDER = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"];
const completedLabel = String(META.completedMonth || "AUG 2026").toUpperCase();
const runningLabel = String(META.runningMonth || "SEP 2026").toUpperCase();
const completedMonth = completedLabel.split(/\s+/)[0] || "JUL";
const runningMonth = runningLabel.split(/\s+/)[0] || "AUG";
const completedCount = Math.max(1, MONTH_ORDER.indexOf(completedMonth) + 1) || 4;
const runningCount = Math.max(completedCount, MONTH_ORDER.indexOf(runningMonth) + 1) || completedCount + 1;
const completedCountText = String(completedCount).padStart(2, "0");
const runningCountText = String(runningCount).padStart(2, "0");

const select = document.getElementById("logicReport");
const host = document.getElementById("logicHost");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function renderOptions() {
  select.innerHTML = Object.entries(REPORT_LOGIC).map(([key, item]) => `<option value="${key}">${esc(item.title)}</option>`).join("");
}

function periodText(value) {
  return String(value ?? "")
    .replace(/JUL 2026/g, completedLabel)
    .replace(/AUG 2026/g, runningLabel)
    .replace(/July/g, completedMonth)
    .replace(/August/g, runningMonth)
    .replace(/APR-JUN/g, `APR-${completedMonth}`)
    .replace(/GUI synced basis is completed JUL 2026/g, `GUI synced basis is completed ${completedLabel}`)
    .replace(/completed month count is 04/g, `completed month count is ${completedCountText}`)
    .replace(/\* 04/g, `* ${completedCountText}`)
    .replace(/\* 05/g, `* ${runningCountText}`)
    .replace(/Default completed month: JUL 2026/g, `Default completed month: ${completedLabel}`)
    .replace(/Running month: AUG 2026/g, `Running month: ${runningLabel}`)
    .replace(/completed JUL 2026 \(04\)/g, `completed ${completedLabel} (${completedCountText})`)
    .replace(/till-date AUG 2026 \(05\)/g, `till-date ${runningLabel} (${runningCountText})`);
}

function renderLogic() {
  const item = REPORT_LOGIC[select.value] || REPORT_LOGIC.current_demand;
  host.innerHTML = `<article class="logic-page">
    <div class="note">Remarks - Figures in '000' (thousands). ${esc(periodText(item.basis))}</div>
    <section class="section"><h2>Calculation Basis</h2><div class="section-body"><div class="chips"><span class="chip">Selected report: ${esc(item.title)}</span><span class="chip">Default completed month: ${esc(completedLabel)}</span><span class="chip">Running month: ${esc(runningLabel)}</span></div></div></section>
    <section class="section"><h2>Column Formulas</h2><div class="section-body"><table class="formula-table"><thead><tr><th>Column / Control</th><th>Logic Being Used</th></tr></thead><tbody>${item.columns.map(row => `<tr><td>${esc(row[0])}</td><td>${esc(periodText(row[1]))}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="section"><h2>Calculation Flow</h2><div class="section-body"><ol class="steps">${item.steps.map(step => `<li>${esc(periodText(step))}</li>`).join("")}</ol></div></section>
  </article>`;
}

function exportPdf() {
  window.print();
}

renderOptions();
select.addEventListener("change", renderLogic);
document.getElementById("exportLogicPdf").addEventListener("click", exportPdf);
renderLogic();
