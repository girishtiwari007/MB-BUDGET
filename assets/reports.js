const DATA = window.REPORTS_DATA || {
  months: [],
  years: [],
  monthly: { pu: {}, demand: {}, dept: {} },
  budget: { pu: {}, demand: {} },
};

const colors = ["#1f4e79", "#b94b4b", "#78a641", "#735999", "#126a66", "#d19a2a"];
const REPORTS = {
  pu_month: {
    label: "PRIMARY UNIT MONTH-WISE",
    title: "PRIMARY UNIT MONTH-WISE EXPENDITURE",
    scope: "pu",
    metric: "ae_monthwise",
    chart: "grouped",
    note: "Four-year monthly comparison for individual Primary Unit heads.",
  },
  demand_budget: {
    label: "DEMAND / SUB MAJOR HEAD",
    title: "DEMAND / SUB MAJOR HEAD BUDGET AND ACTUAL EXPENDITURE",
    scope: "demand",
    metric: "bp_vs_ae",
    chart: "bar",
    note: "Demand / Sub Major Head budget, Budget Proportion and Actual Expenditure comparison. Older demand files provide annual/stage values, not month-wise breakup.",
  },
  dept_current: {
    label: "DEPARTMENT",
    title: "DEPARTMENT CURRENT-YEAR MONTH-WISE EXPENDITURE",
    scope: "dept",
    metric: "ae_monthwise",
    chart: "heatmap",
    note: "Department-wise month view is available for the current detailed actual file.",
  },
  yearly: {
    label: "YEARLY OVERVIEW",
    title: "YEARLY PRIMARY UNIT EXPENDITURE OVERVIEW",
    scope: "yearly",
    metric: "year_total",
    chart: "bar",
    note: "All Primary Unit yearly actual expenditure based on available month-wise Primary Unit files.",
  },
  bp_ae: {
    label: "BUDGET PROPORTION VS ACTUAL EXPENDITURE",
    title: "BUDGET PROPORTION VS ACTUAL EXPENDITURE UTILIZATION",
    scope: "pu",
    metric: "bp_vs_ae",
    chart: "bar",
    note: "Budget Proportion versus Actual Expenditure for the selected Primary Unit or Demand / Sub Major Head.",
  },
};

const state = { report: "pu_month", scope: "pu", item: "", metric: "ae_monthwise", month: "APR", chart: "grouped" };
const $ = (id) => document.getElementById(id);

function fmt(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/A";
  return Number(value).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function years() {
  return (DATA.years || []).map((year) => year.fy);
}

function itemsFor(scope) {
  if (scope === "yearly") return ["All"];
  return Object.keys(DATA.monthly?.[scope] || {}).filter((item) => item.toUpperCase() !== "TOTAL").sort();
}

function series(scope, item) {
  if (scope === "yearly") {
    const out = {};
    for (const fy of years()) {
      out[fy] = DATA.months.map((_, index) =>
        Object.values(DATA.monthly.pu || {}).reduce((sum, row) => sum + Number(row?.[fy]?.[index] || 0), 0),
      );
    }
    return out;
  }
  return DATA.monthly?.[scope]?.[item] || {};
}

function hasSeriesYear(s, fy) {
  return Array.isArray(s?.[fy]);
}

function monthValue(s, fy, index) {
  return hasSeriesYear(s, fy) ? Number(s[fy][index] || 0) : null;
}

function total(arr) {
  if (!Array.isArray(arr)) return null;
  return arr.reduce((sum, value) => sum + Number(value || 0), 0);
}

function budget(scope, item) {
  return DATA.budget?.[scope]?.[item] || {};
}

function setOptions(select, options, value) {
  select.innerHTML = options.map((option) => `<option value="${esc(option)}" ${option === value ? "selected" : ""}>${esc(optionLabel(option))}</option>`).join("");
  if (!options.includes(value)) select.value = options[0] || "";
}

function optionLabel(option) {
  const fixed = {
    pu: "PRIMARY UNIT",
    demand: "DEMAND / SUB MAJOR HEAD",
    dept: "DEPARTMENT",
    yearly: "YEARLY OVERVIEW",
    ae_monthwise: "MONTH-WISE ACTUAL EXPENDITURE",
    specific_month: "SPECIFIC MONTH ACTUAL EXPENDITURE",
    bp_vs_ae: "BUDGET PROPORTION VS ACTUAL EXPENDITURE",
    oba_vs_ae: "ORIGINAL BUDGET ALLOTMENT VS ACTUAL EXPENDITURE",
    year_total: "YEAR TOTAL",
    grouped: "GROUPED BAR CHART",
    bar: "BAR CHART",
    pie: "PIE CHART",
    heatmap: "HEATMAP",
    "11 - SnT": "11 - SIGNAL AND TELECOMMUNICATION",
    "03 - GEN. ADMN.": "03 - GENERAL ADMINISTRATION",
  }[option];
  if (fixed) return fixed;
  return String(option)
    .replace(/\bSnT\b/g, "SIGNAL AND TELECOMMUNICATION")
    .replace(/\bGEN\. ADMN\.\b/g, "GENERAL ADMINISTRATION");
}

function setControlVisibility() {
  const chartAllowed = state.report !== "demand_budget" || state.metric !== "ae_monthwise";
  $("monthWrap").classList.toggle("hide", state.metric !== "specific_month");
  $("itemWrap").classList.toggle("hide", state.scope === "yearly");
  $("scopeWrap").classList.toggle("hide", !["bp_ae"].includes(state.report));
  $("metricWrap").classList.toggle("hide", !["pu_month", "demand_budget", "bp_ae"].includes(state.report));
  $("chartWrap").classList.toggle("hide", !chartAllowed);
}

function reportMenuHtml() {
  return Object.entries(REPORTS).map(([key, report]) =>
    `<button type="button" data-report="${key}" class="${state.report === key ? "active" : ""}">${esc(report.label)}</button>`,
  ).join("");
}

function applyReportDefaults(reportKey) {
  const report = REPORTS[reportKey];
  state.report = reportKey;
  state.scope = report.scope;
  state.metric = report.metric;
  state.chart = report.chart;
  state.item = "";
}

function setup() {
  $("reportMenu").innerHTML = reportMenuHtml();
  $("reportMenu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-report]");
    if (!button) return;
    applyReportDefaults(button.dataset.report);
    render();
  });
  setOptions($("scope"), ["pu", "demand"], state.scope);
  setOptions($("metric"), ["ae_monthwise", "specific_month", "bp_vs_ae", "oba_vs_ae", "year_total"], state.metric);
  setOptions($("month"), DATA.months, state.month);
  setOptions($("chart"), ["grouped", "bar", "pie", "heatmap"], state.chart);
  ["scope", "item", "metric", "month", "chart"].forEach((id) =>
    $(id).addEventListener("change", (event) => {
      state[id] = event.target.value;
      if (id === "scope") state.item = "";
      render();
    }),
  );
  render();
}

function syncControls() {
  $("reportMenu").innerHTML = reportMenuHtml();
  setOptions($("scope"), ["pu", "demand"], state.scope);
  setOptions($("metric"), metricOptions(), state.metric);
  setOptions($("chart"), chartOptions(), state.chart);
  setOptions($("month"), DATA.months, state.month);
  const options = itemsFor(state.scope);
  if (!state.item || !options.includes(state.item)) state.item = options[0] || "";
  setOptions($("item"), options, state.item);
  setControlVisibility();
}

function metricOptions() {
  if (state.report === "pu_month") return ["ae_monthwise", "specific_month", "year_total"];
  if (state.report === "demand_budget") return ["bp_vs_ae", "oba_vs_ae", "year_total"];
  if (state.report === "bp_ae") return ["bp_vs_ae", "oba_vs_ae"];
  return ["ae_monthwise", "specific_month", "year_total"];
}

function chartOptions() {
  if (state.report === "dept_current") return ["heatmap", "bar"];
  if (state.report === "yearly" || state.report === "bp_ae" || state.report === "demand_budget") return ["bar", "pie"];
  return ["grouped", "bar", "pie", "heatmap"];
}

function metricLabel() {
  return {
    ae_monthwise: "MONTH-WISE ACTUAL EXPENDITURE",
    specific_month: `${state.month} ACTUAL EXPENDITURE`,
    bp_vs_ae: "BUDGET PROPORTION VS ACTUAL EXPENDITURE",
    oba_vs_ae: "ORIGINAL BUDGET ALLOTMENT VS ACTUAL EXPENDITURE",
    year_total: "YEAR TOTAL",
  }[state.metric] || state.metric;
}

function valuesForCurrent() {
  const fy = years();
  const s = series(state.scope, state.item);
  if (state.metric === "specific_month") {
    const index = DATA.months.indexOf(state.month);
    return fy.map((year) => ({ label: year, value: monthValue(s, year, index) }));
  }
  if (state.metric === "year_total") {
    return fy.map((year) => ({ label: year, value: total(s[year]) }));
  }
  if (state.metric === "bp_vs_ae" || state.metric === "oba_vs_ae") {
    const b = budget(state.scope, state.item);
    return fy.flatMap((year) => [
      { label: `${year} ${state.metric === "bp_vs_ae" ? "BUDGET PROPORTION" : "ORIGINAL BUDGET ALLOTMENT"}`, value: b[year] ? Number(b[year][state.metric === "bp_vs_ae" ? "bp" : "oba"] || 0) : null },
      { label: `${year} ACTUAL EXPENDITURE`, value: b[year] ? Number(b[year].ae || total(s[year]) || 0) : total(s[year]) },
    ]);
  }
  return fy.map((year) => ({ label: year, value: total(s[year]) }));
}

function summaryHtml() {
  const vals = valuesForCurrent().filter((item) => item.value !== null);
  const maxItem = vals.reduce((best, item) => !best || Math.abs(item.value) > Math.abs(best.value) ? item : best, null);
  const latestYear = years().at(-1);
  const s = series(state.scope, state.item);
  const latestTotal = total(s[latestYear]);
  const availableYears = years().filter((year) => hasSeriesYear(s, year)).length || vals.filter((item) => item.value !== null).length;
  return `<div class="summary">
    <div class="card"><span>Report Mode</span><strong>${esc(REPORTS[state.report].label)}</strong></div>
    <div class="card"><span>Selected Item</span><strong>${esc(state.scope === "yearly" ? "ALL PRIMARY UNIT" : optionLabel(state.item || "All"))}</strong></div>
    <div class="card"><span>Metric</span><strong>${esc(metricLabel())}</strong></div>
    <div class="card"><span>Latest Year Total</span><strong>${fmt(latestTotal)}</strong></div>
    <div class="card"><span>Highest Value</span><strong>${fmt(maxItem?.value)}</strong></div>
    <div class="card"><span>Years Available</span><strong>${availableYears}</strong></div>
  </div>`;
}

function availabilityNote() {
  const s = series(state.scope, state.item);
  const missing = years().filter((year) => !hasSeriesYear(s, year));
  if (!missing.length || state.metric === "bp_vs_ae" || state.metric === "oba_vs_ae") return "";
  return `<div class="warn">Month-wise data is not available for ${esc(missing.join(", "))} in this view. The page shows N/A instead of treating missing data as zero.</div>`;
}

function insightHtml() {
  const vals = valuesForCurrent().filter((item) => item.value !== null);
  const top = [...vals].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  return `<section class="insights"><div class="section-head"><h2>QUICK INSIGHTS</h2><span>${remarksText()}</span></div>${top.map((item) => `<div><strong>${esc(item.label)}</strong><span>${fmt(item.value)}</span></div>`).join("") || "<p>No values available for the selected report.</p>"}</section>`;
}

function groupedChart() {
  const fy = years();
  const s = series(state.scope, state.item);
  const max = Math.max(...fy.flatMap((year) => DATA.months.map((_, index) => Math.abs(monthValue(s, year, index) || 0))), 1);
  return `<section class="chart"><div class="section-head"><h2>MONTH-WISE EXPENDITURE</h2><span>${remarksText()}</span></div><div class="month-grid">${DATA.months.map((month, index) => `<div class="month-group"><div class="month-bars">${fy.map((year, colorIndex) => {
    const value = monthValue(s, year, index);
    return `<div class="vbar" title="${esc(year)} ${month}: ${fmt(value)}" style="height:${value === null ? 0 : Math.abs(value) / max * 100}%;background:${colors[colorIndex % colors.length]}"></div>`;
  }).join("")}</div><div class="month-label">${month}</div></div>`).join("")}</div>${legend(fy)}</section>`;
}

function barChart() {
  const vals = valuesForCurrent();
  const max = Math.max(...vals.map((item) => Math.abs(item.value || 0)), 1);
  return `<section class="chart"><div class="section-head"><h2>${esc(metricLabel())}</h2><span>${remarksText()}</span></div>${vals.map((item, index) => `<div class="bar-row"><strong>${esc(item.label)}</strong><div class="track"><div class="fill y${index % 4 + 1}" style="width:${item.value === null ? 0 : Math.abs(item.value) / max * 100}%"></div></div><span>${fmt(item.value)}</span></div>`).join("")}</section>`;
}

function pieChart() {
  const vals = valuesForCurrent().map((item) => ({ ...item, abs: Math.abs(item.value || 0) })).filter((item) => item.value !== null && item.abs > 0);
  const sum = vals.reduce((found, item) => found + item.abs, 0) || 1;
  let cursor = 0;
  const stops = vals.map((item, index) => {
    const start = cursor;
    cursor += item.abs / sum * 100;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  }).join(",");
  return `<section class="chart"><div class="section-head"><h2>SHARE VIEW</h2><span>${remarksText()}</span></div><div class="pie-wrap"><div class="pie" style="background:conic-gradient(${stops || "#edf4f8 0 100%"})"></div><div>${vals.map((item, index) => `<div class="legend"><span style="background:${colors[index % colors.length]}"></span>${esc(item.label)}: ${fmt(item.value)} (${fmt(item.abs / sum * 100, 1)}%)</div>`).join("") || "No available values for pie chart."}</div></div></section>`;
}

function heatmap() {
  const fy = years();
  const s = series(state.scope, state.item);
  const max = Math.max(...fy.flatMap((year) => DATA.months.map((_, index) => Math.abs(monthValue(s, year, index) || 0))), 1);
  return `<section class="chart"><div class="section-head"><h2>HEATMAP</h2><span>${remarksText()}</span></div><table class="heat"><thead><tr><th>FINANCIAL YEAR</th>${DATA.months.map((month) => `<th>${month}</th>`).join("")}<th>Total</th></tr></thead><tbody>${fy.map((year) => `<tr><td>${esc(year)}</td>${DATA.months.map((month, index) => {
    const value = monthValue(s, year, index);
    const cls = value === null ? "" : Math.abs(value) > max * .66 ? "veryhot" : Math.abs(value) > max * .33 ? "hot" : "";
    return `<td class="${cls}">${fmt(value)}</td>`;
  }).join("")}<td>${fmt(total(s[year]))}</td></tr>`).join("")}</tbody></table></section>`;
}

function legend(labels) {
  return `<div class="legend">${labels.map((label, index) => `<div><span style="background:${colors[index % colors.length]}"></span>${esc(label)}</div>`).join("")}</div>`;
}

function tableHtml() {
  const fy = years();
  const s = series(state.scope, state.item);
  return `<section class="tablebox"><div class="section-head"><h2>DATA TABLE</h2><span>${remarksText()}</span></div><table class="data-table"><thead><tr><th>FINANCIAL YEAR</th>${DATA.months.map((month) => `<th>${month}</th>`).join("")}<th>Total</th></tr></thead><tbody>${fy.map((year) => `<tr><td>${esc(year)}</td>${DATA.months.map((month, index) => `<td>${fmt(monthValue(s, year, index))}</td>`).join("")}<td>${fmt(total(s[year]))}</td></tr>`).join("")}</tbody></table></section>`;
}

function remarksText() {
  return "Remarks - Figures in '000' (thousands)";
}

function renderChart() {
  if (state.chart === "bar") return barChart();
  if (state.chart === "pie") return pieChart();
  if (state.chart === "heatmap") return heatmap();
  return groupedChart();
}

function render() {
  syncControls();
  const report = REPORTS[state.report];
  $("reportTitle").textContent = report.title;
  $("host").innerHTML = `<p class="note">${remarksText()}. ${esc(report.note)}</p>${availabilityNote()}${summaryHtml()}<div class="report-layout">${insightHtml()}${renderChart()}</div>${tableHtml()}`;
}

document.addEventListener("DOMContentLoaded", setup);
