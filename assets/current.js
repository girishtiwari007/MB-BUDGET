const SHEETJS_SRC = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    let DATA = window.CURRENT_PAYLOAD || {};
    const DATA_SOURCE_CONFIG = window.YEAR_DATA_SOURCES || {};
    let TAB_ORDER = ["demand", "staff", "nonstaff", "pu_prev", "demand_prev"].filter(key => DATA[key]);
    const STAFF_CODES = new Set(["01", "02", "03", "04", "07", "08", "10", "11", "12", "13", "14", "15", "16", "17", "20", "25", "26", "29", "34", "39", "40", "42", "43", "44", "53", "54", "63"]);
    const IMPORTANT_PU_CODES = new Set(["27", "28", "30", "32", "60"]);
    const UPLOAD_PASSWORD = "Moradabad@2026";
    const UPLOAD_STATE = {};
    const UPLOAD_FILES = {};
    let ORIGINAL_DATA = JSON.parse(JSON.stringify(DATA || {}));
    const REPORTS_DATA = window.REPORTS_DATA || {};
    const CURRENT_YEAR_UPLOAD_ROLES = [
      "currPuBudget",
      "currPuMonth",
      "currPuDeptDemandSmhBudget",
      "currPuDeptDemandSmhActual",
      "currSmhBudget",
      "currSmhMonth"
    ];
    const PREVIOUS_YEAR_REPO_ROLES = ["prevPuBudget", "prevPuMonth", "prevPuDeptDemandSmhBudget", "prevPuDeptDemandSmhActual", "prevSmhBudget", "prevSmhMonth"];
    const SOURCE_ROLE_LABELS = {
      currPuBudget: "PU Wise Budget",
      currPuMonth: "PU Wise Month Actual",
      currPuDeptDemandSmhBudget: "PU / Dept / Demand / SMH Budget",
      currPuDeptDemandSmhActual: "PU / Dept / Demand / SMH Actual",
      currSmhBudget: "Demand / SMH Budget",
      currSmhMonth: "Demand / SMH Actual",
      prevPuBudget: "Previous PU Wise Budget",
      prevPuMonth: "Previous PU Wise Month Actual",
      prevPuDeptDemandSmhBudget: "Previous PU / Dept / Demand / SMH Budget",
      prevPuDeptDemandSmhActual: "Previous PU / Dept / Demand / SMH Actual",
      prevSmhBudget: "Previous Demand / SMH Budget",
      prevSmhMonth: "Previous Demand / SMH Actual",
      fr: "FR Budget Status"
    };
    const CURRENT_YEAR_UPLOAD_REQUIRED = new Set(CURRENT_YEAR_UPLOAD_ROLES);
    const CALCULATION_UPLOAD_ROLES = new Set(["currPuBudget", "currSmhBudget", "prevPuBudget", "prevSmhBudget"]);
    let activeTab = "demand";
    let prevPuMode = "all";
    const puFocus = { mode:"all", item:"" };
    const compareState = { entity:"pu", years:"1", metric:"ae", chart:"bar", item:"__total" };
    const analysisState = { scope:"current", metric:"ae", attention:"all", pu:"all", view:"overview", logicUnlocked:false };
    let uploadUnlocked = false;
    const COMPLETED_PERIOD = { month:"JUN", year:2026, count:3, label:"JUN 2026", title:"Completed Month Projection - June 2026 (03 months)" };
    const RUNNING_PERIOD = { month:"JUL", year:2026, count:4, label:"JUL 2026", title:"Till Date / Running Month - July 2026 (04 months)" };
    const DATA_LOAD_TIMESTAMP = new Date().toLocaleString("en-IN");
    function normalizePuCurrentColumns() {
      ["staff", "nonstaff"].forEach(key => {
        const tab = DATA[key];
        if (!tab?.columns?.length) return;
        const shifted = tab.columns[1]?.key === "Department" && tab.columns[1]?.label?.includes("BG_ISL");
        if (!shifted) return;
        tab.columns = [
          { key:"Name", label:"PU", format:"text" },
          { key:"OBA", label:"A\nOBA\nBG_ISL 2026-27", format:"money" },
          { key:"BP", label:"B\nBP\nBP UPTO JUL 2026", format:"money" },
          { key:"AE", label:"C\nAE\nActuals Upto JUL 2026", format:"money" },
          { key:"Variation", label:"D\nVariation\nC - B", format:"money" },
          { key:"BPPercent", label:"E\n% BP\nC / B", format:"int" },
          { key:"Remaining", label:"F\nBudget Remaining\nA - C", format:"money" },
          { key:"OBAPercent", label:"G\n% OBA Utilized\nC / A", format:"int" }
        ];
      });
    }
    normalizePuCurrentColumns();
    function latestReportYear(offset = 0) {
      const list = REPORTS_DATA.years || [];
      return list[Math.max(0, list.length - 1 - offset)]?.fy || "";
    }
    function matchMonthlyKey(scope, label, bucket) {
      const keys = Object.keys(bucket || {});
      if (bucket[label]) return label;
      if (scope === "pu") {
        const code = codeFromLabel(label, "PU");
        return keys.find(key => codeFromLabel(key, "PU") === code) || "";
      }
      if (scope === "demand") {
        const demand = demandKey(label);
        const smh = String(label || "").match(/\/\s*([0-9A-Z]+)/i)?.[1]?.toUpperCase() || "";
        return keys.find(key => demandKey(key) === demand && (!smh || key.toUpperCase().includes(`SMH ${smh}`))) || "";
      }
      return keys.find(key => key === label) || "";
    }
    function monthActual(scope, label, fy, count) {
      const bucket = REPORTS_DATA.monthly?.[scope] || {};
      const key = matchMonthlyKey(scope, label, bucket);
      const arr = key ? bucket[key]?.[fy] : null;
      return Array.isArray(arr) ? arr.slice(0, count).reduce((sum, value) => sum + Number(value || 0), 0) : null;
    }
    function relabelPeriod(text, period) {
      return String(text || "")
        .replace(/JUL\s+2026/g, period.label)
        .replace(/JUL\s+2025/g, `${period.month} 2025`)
        .replace(/\/ 12 \* 4/g, `/ 12 * ${period.count}`)
        .replace(/BP UPTO JUL 2026/g, `BP UPTO ${period.label}`);
    }
    function relabelColumns(columns, period) {
      return (columns || []).map(col => ({ ...col, label: relabelPeriod(col.label, period) }));
    }
    function buildPeriodView(source, period) {
      const view = JSON.parse(JSON.stringify(source || {}));
      ["demand", "staff", "nonstaff"].forEach(key => adjustCurrentTab(view, key, period));
      ["pu_prev", "demand_prev"].forEach(key => adjustPreviousTab(view, key, period));
      return view;
    }
    function adjustCurrentTab(view, key, period) {
      const tab = view[key];
      if (!tab?.rows?.length) return;
      const scope = key === "demand" ? "demand" : "pu";
      const fy = latestReportYear();
      const detail = tab.rows.filter(row => String(rowName(row)).toLowerCase() !== "total").map(row => {
        const next = { ...row };
        const actual = monthActual(scope, rowName(row), fy, period.count);
        if (actual !== null) next.AE = actual;
        next.Months = period.count;
        next.BP = numberValue(next.OBA) / 12 * period.count;
        next.Variation = numberValue(next.AE) - numberValue(next.BP);
        next.BPPercent = numberValue(next.BP) ? numberValue(next.AE) / numberValue(next.BP) * 100 : 0;
        next.Remaining = numberValue(next.OBA) - numberValue(next.AE);
        next.BudgetRemaining = next.Remaining;
        next.OBAPercent = numberValue(next.OBA) ? numberValue(next.AE) / numberValue(next.OBA) * 100 : 0;
        return next;
      });
      tab.columns = relabelColumns(tab.columns, period);
      tab.title = `${tab.title} - ${period.title}`;
      tab.rows = addTotal(detail);
    }
    function adjustPreviousTab(view, key, period) {
      const tab = view[key];
      if (!tab?.rows?.length) return;
      const scope = key === "demand_prev" ? "demand" : "pu";
      const currentFy = latestReportYear();
      const previousFy = latestReportYear(1);
      const detail = tab.rows.filter(row => String(rowName(row)).toLowerCase() !== "total").map(row => {
        const next = { ...row };
        const currentActual = monthActual(scope, rowName(row), currentFy, period.count);
        const previousActual = monthActual(scope, rowName(row), previousFy, period.count);
        if (currentActual !== null) next.AECurrent = currentActual;
        if (previousActual !== null) next.AEPrevious = previousActual;
        next.Months = period.count;
        next.PreviousBP = numberValue(next.PreviousOBA) / 12 * period.count;
        next.BP = numberValue(next.OBA) / 12 * period.count;
        next.VariationBP = numberValue(next.AECurrent) - numberValue(next.BP);
        next.BPPercent = numberValue(next.BP) ? numberValue(next.AECurrent) / numberValue(next.BP) * 100 : 0;
        next.VariationActual = numberValue(next.AECurrent) - numberValue(next.AEPrevious);
        next.ActualVariation = next.VariationActual;
        next.OBAPercent = numberValue(next.OBA) ? numberValue(next.AECurrent) / numberValue(next.OBA) * 100 : 0;
        return next;
      });
      tab.columns = relabelColumns(tab.columns, period);
      tab.title = `${tab.title} - ${period.title}`;
      tab.rows = addTotal(detail, true);
    }
    function applyCompletedPeriodView() {
      DATA = buildPeriodView(ORIGINAL_DATA, COMPLETED_PERIOD);
      TAB_ORDER = ["demand", "staff", "nonstaff", "pu_prev", "demand_prev"].filter(key => DATA[key]);
    }
    applyCompletedPeriodView();
    function formatNumber(value, decimals = 0) { return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
    function formatCell(value, format) { if (format === "money") return formatNumber(value); if (format === "int") return Math.round(Number(value || 0)).toLocaleString("en-IN"); return value ?? ""; }
    function formatCrore(value) { return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function moneyCellHtml(value) { return `<span class="dual-money"><span class="thousand">${htmlEscape(formatNumber(value))}</span><span class="crore">${htmlEscape(formatCrore(Number(value || 0) / 10000))} Cr</span></span>`; }
    function formatCellHtml(value, format) {
      if (format === "money") return moneyCellHtml(value);
      return htmlEscape(formatCell(value, format));
    }
    function alertDotHtml(value) {
      return `<span class="dot ${utilizationClass(value)}"></span>`;
    }
    function splitHeader(label) {
      const parts = String(label || "").split("\n");
      if (parts.length > 1 && /^[A-Z]$/.test(parts[0])) return { letter: parts[0], text: parts.slice(1).join("\n") };
      return { letter: "", text: label || "" };
    }
    function render(tabKey) {
      activeTab = tabKey;
      if (tabKey === "upload") { renderUpload(); return; }
      if (tabKey === "analysis") { renderAnalysis(); return; }
      if (tabKey === "current_till") { renderTillDate(); return; }
      const tab = tableForView(tabKey);
      document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabKey));
      if (!tab || !tab.rows || !tab.rows.length) {
        document.getElementById("title").textContent = tab?.title || "Data Not Available";
        document.getElementById("tableHost").innerHTML = '<div class="empty-warning">Required table data is not available for this tab. Please upload or rebuild the source data.</div>';
        return;
      }
      document.getElementById("title").textContent = tab.title;
      const subMenu = tabKey === "pu_prev" ? renderPrevPuSubtabs() : null;
      const puTools = isPuTable(tabKey) ? renderPuFocusControls(tabKey) : null;
      const note = document.createElement("div"); note.className = "note"; note.textContent = tabKey === "pu_prev" || tabKey === "demand_prev" ? "Remarks - Figures in '000' (thousands). Default projection uses completed actuals up to JUN 2026 (03 months). Previous year RG is treated as OBA; current year BG_ISL is treated as OBA until current-year RG is available." : "Remarks - Figures in '000' (thousands). Default projection uses completed actuals up to JUN 2026 (03 months). July is shown separately in Till Date / Running Month.";
      const specialNote = isDemandTable(tabKey) ? renderDemandSuspenseNote(tab.rows) : null;
      const table = document.createElement("table");
      if (tab.columns.length > 8) table.className = "wide";
      const thead = document.createElement("thead"); const letterRow = document.createElement("tr"); letterRow.className = "letter-row"; const labelRow = document.createElement("tr");
      tab.columns.forEach(col => { const split = splitHeader(col.label); const letterTh = document.createElement("th"); letterTh.textContent = split.letter; letterRow.appendChild(letterTh); const labelTh = document.createElement("th"); labelTh.textContent = split.text; labelRow.appendChild(labelTh); });
      thead.appendChild(letterRow); thead.appendChild(labelRow); table.appendChild(thead);
      const tbody = document.createElement("tbody");
      tab.rows.forEach(row => { const tr = document.createElement("tr"); tr.className = rowClassName(row); tab.columns.forEach(col => { const td = document.createElement("td"); if (col.key === "OBAPercent" || col.key === "BPPercent") { const dot = document.createElement("span"); dot.className = "dot " + utilizationClass(row[col.key]); td.appendChild(dot); td.append(document.createTextNode(formatCell(row[col.key], col.format))); } else if (col.format === "money") { td.innerHTML = moneyCellHtml(row[col.key]); } else { td.textContent = formatCell(row[col.key], col.format); } tr.appendChild(td); }); tbody.appendChild(tr); });
      table.appendChild(tbody);
      const children = [subMenu, puTools, note, specialNote, table].filter(Boolean);
      document.getElementById("tableHost").replaceChildren(...children);
    }
    function renderTillDate() {
      document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === "current_till"));
      document.getElementById("title").textContent = RUNNING_PERIOD.title;
      const sections = ["demand", "staff", "nonstaff", "pu_prev", "demand_prev"].filter(key => ORIGINAL_DATA[key]).map(key => tillDateSection(key)).join("");
      document.getElementById("tableHost").innerHTML = `<div class="future-note"><strong>${RUNNING_PERIOD.title}</strong><br>Data load timestamp: ${htmlEscape(DATA_LOAD_TIMESTAMP)}. This tab keeps July as running/till-date data. Default analysis tabs use completed June actuals and 03-month BP projection.</div>${sections}`;
    }
    function tillDateSection(tabKey) {
      const tab = ORIGINAL_DATA[tabKey];
      if (!tab?.rows?.length) return "";
      const rows = isDemandTable(tabKey) ? addTotal(tab.rows.filter(row => !isTotalRow(row)), tabKey === "demand_prev") : tab.rows;
      const specialNote = isDemandTable(tabKey) ? demandSuspenseNoteHtml(rows) : "";
      const header = `<thead><tr>${tab.columns.map(col => `<th>${htmlEscape(String(col.label || "").replace(/\n/g, " "))}</th>`).join("")}</tr></thead>`;
      const body = rows.map(row => `<tr class="${rowClassName(row)}">${tab.columns.map(col => `<td>${formatCellHtml(row[col.key], col.format)}</td>`).join("")}</tr>`).join("");
      return `<section class="till-section"><h3>${htmlEscape(tab.title)} - ${RUNNING_PERIOD.title}</h3><div class="note">Remarks - Figures in '000' (thousands). July is running and shown only in this tab.</div>${specialNote}<table class="${tab.columns.length > 8 ? "wide" : ""}">${header}<tbody>${body}</tbody></table></section>`;
    }
    function puCode(row) { return codeFromLabel(rowName(row), "PU"); }
    function isImportantPuRow(row) { return IMPORTANT_PU_CODES.has(puCode(row)); }
    function isPuTable(tabKey) { return ["staff", "nonstaff", "pu_prev"].includes(tabKey); }
    function isDemandTable(tabKey) { return ["demand", "demand_prev"].includes(tabKey); }
    function isTotalRow(row) { return String(rowName(row)).toLowerCase() === "total"; }
    function isDemandSuspenseRow(row) {
      const name = String(rowName(row) || "").toUpperCase();
      const department = String(row.Department || "").toUpperCase();
      return /\b12N\b/.test(name) || /\b10N\b/.test(name) || department.includes("SUSPENSE");
    }
    function detailRows(rows) { return (rows || []).filter(row => !isTotalRow(row)); }
    function normalTotalRows(rows) { return detailRows(rows).filter(row => !isDemandSuspenseRow(row)); }
    function demandSuspenseRows(rows) { return detailRows(rows).filter(isDemandSuspenseRow); }
    function rowClassName(row) {
      const classes = [];
      if (isTotalRow(row)) classes.push("total");
      if (isDemandSuspenseRow(row)) classes.push("special-demand");
      if (isImportantPuRow(row)) classes.push("important-pu");
      return classes.join(" ");
    }
    function demandSuspenseNoteHtml(rows) {
      const suspense = demandSuspenseRows(rows);
      if (!suspense.length) return "";
      const row = suspense[0];
      const ae = numericValue(row, ["AE", "AECurrent", "CurrentAE"]);
      const remaining = Number.isFinite(Number(row.BudgetRemaining)) ? Number(row.BudgetRemaining) : Number.isFinite(Number(row.Remaining)) ? Number(row.Remaining) : numericValue(row, ["OBA", "PreviousOBA"]) - ae;
      return `<div class="special-demand-note"><strong>Separate Suspense Line:</strong> Demand 12N / 10N is shown below Total for verification only and is excluded from main total, analysis, comparison, and export summary figures. AE: ${formatNumber(ae)} | Remaining: ${formatNumber(remaining)}.</div>`;
    }
    function renderDemandSuspenseNote(rows) {
      const html = demandSuspenseNoteHtml(rows);
      if (!html) return null;
      const holder = document.createElement("div");
      holder.innerHTML = html;
      return holder.firstElementChild;
    }
    function applyPuFocus(rows) {
      if (puFocus.mode === "important") return rows.filter(isImportantPuRow);
      if (puFocus.mode === "specific" && puFocus.item) return rows.filter(row => rowName(row) === puFocus.item);
      return rows;
    }
    function puFocusOptions(tabKey) {
      const tab = tableForView(tabKey, { skipFocus:true });
      return (tab?.rows || []).filter(row => rowName(row) && String(rowName(row)).toLowerCase() !== "total").map(rowName);
    }
    function renderPuFocusControls(tabKey) {
      const wrap = document.createElement("div");
      wrap.className = "pu-focus";
      const label = document.createElement("span");
      label.textContent = "PU Filter";
      const mode = document.createElement("select");
      mode.innerHTML = '<option value="all">All PU</option><option value="important">Show Important PU only (27, 28, 30, 32, 60)</option><option value="specific">Select one PU</option>';
      mode.value = puFocus.mode;
      const item = document.createElement("select");
      item.innerHTML = puFocusOptions(tabKey).map(name => `<option value="${htmlEscape(name)}">${htmlEscape(name)}${IMPORTANT_PU_CODES.has(codeFromLabel(name, "PU")) ? " *" : ""}</option>`).join("");
      item.value = puFocus.item && Array.from(item.options).some(option => option.value === puFocus.item) ? puFocus.item : item.options[0]?.value || "";
      item.disabled = puFocus.mode !== "specific";
      mode.addEventListener("change", () => { puFocus.mode = mode.value; if (puFocus.mode === "specific") puFocus.item = item.value; render(tabKey); });
      item.addEventListener("change", () => { puFocus.item = item.value; render(tabKey); });
      wrap.append(label, mode, item);
      return wrap;
    }
    function tableForView(tabKey, options = {}) {
      const tab = DATA[tabKey];
      if (!tab?.rows) return tab;
      if (!isPuTable(tabKey)) return tab;
      const detailRows = tab.rows.filter(row => String(rowName(row)).toLowerCase() !== "total");
      const splitRows = tabKey === "pu_prev" && prevPuMode !== "all" ? detailRows.filter(row => prevPuMode === "staff" ? STAFF_CODES.has(puCode(row)) : !STAFF_CODES.has(puCode(row))) : detailRows;
      const rows = options.skipFocus ? splitRows : applyPuFocus(splitRows);
      const suffix = tabKey === "pu_prev" && prevPuMode !== "all" ? (prevPuMode === "staff" ? " - Staff" : " - Non-Staff") : "";
      return { ...tab, title: tab.title + suffix, rows: addTotal(rows, tabKey === "pu_prev") };
    }
    function renderPrevPuSubtabs() {
      const wrap = document.createElement("div");
      wrap.className = "subtabs";
      [
        ["all", "All PU"],
        ["staff", "Staff"],
        ["nonstaff", "Non-Staff"]
      ].forEach(([mode, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className = prevPuMode === mode ? "active" : "";
        button.addEventListener("click", () => { prevPuMode = mode; render("pu_prev"); });
        wrap.appendChild(button);
      });
      return wrap;
    }
    function utilizationClass(value) {
      const n = Number(value || 0);
      if (!Number.isFinite(n) || n < 0 || n > 100) return "red";
      if (n >= 75) return "yellow";
      return "green";
    }
    function rowName(row) { return row.Name || row.PU || row.SMH || row.Demand || ""; }
    function numericValue(row, keys) {
      for (const key of keys) {
        const value = Number(row[key]);
        if (Number.isFinite(value)) return value;
      }
      return 0;
    }
    function totalRow(tab) {
      return (tab.rows || []).find(row => String(rowName(row)).toLowerCase() === "total") || {};
    }
    function analysisMetric(label, value, format = "money", tone = "") {
      const shown = format === "percent" ? formatNumber(value, 2) + "%" : format === "int" ? Math.round(Number(value || 0)).toLocaleString("en-IN") : moneyCellHtml(value);
      return `<div class="metric-row ${tone}"><span>${label}</span><strong>${shown}</strong></div>`;
    }
    function analysisScopeLabel(value) {
      return { all:"All Current / Previous Tables", current:"Current Year Review", previous:"Previous Year Comparison", pu:"PU Wise Review", demand:"Demand / SMH Review", important:"Important PU only (27, 28, 30, 32, 60)" }[value] || value;
    }
    function analysisMetricLabel(value) {
      return { ae:"Actual Expenditure", bp:"Budget Proportion", oba:"OBA / RG Allotment", remaining:"Budget Remaining", bpPct:"% BP Utilized", obaPct:"% OBA Utilized", yoy:"Current vs Previous AE Variation" }[value] || value;
    }
    function analysisAttentionLabel(value) {
      return { all:"All items", overBp:"Over BP or beyond proportion", nearBp:"Near BP watch (75%-100%)", lowBp:"Low booking against BP (<50%)", negative:"Negative balance / excess", highOba:"High OBA utilization (75%+)", yoyRise:"Higher than previous year", yoyFall:"Lower than previous year" }[value] || value;
    }
    function compactTable(title, rows, columns) {
      const body = rows.length ? rows.map(item => `<tr class="${item.Important ? "important-pu" : ""}">${columns.map(col => `<td class="${col.num ? "num" : ""}">${col.format === "percent" ? `<span class="dot ${utilizationClass(item[col.key])}"></span>` : ""}${formatCellHtml(item[col.key], col.format)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}">No alert items found for selected filter.</td></tr>`;
      return `<section class="analysis-panel"><h3>${title}</h3><table><thead><tr>${columns.map(col => `<th>${htmlEscape(col.label)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></section>`;
    }
    function analysisRows() {
      return TAB_ORDER.flatMap(key => {
        const tab = DATA[key] || { rows: [] };
        const group = ["demand", "staff", "nonstaff"].includes(key) ? "current" : "previous";
        const entity = key.includes("demand") ? "demand" : "pu";
        return normalTotalRows(tab.rows || []).map(row => {
          const ae = numericValue(row, ["AE", "AECurrent", "CurrentAE"]);
          const oba = numericValue(row, ["OBA", "PreviousOBA"]);
          const bp = numericValue(row, ["BP"]);
          const previousAe = numericValue(row, ["AEPrevious", "PreviousAE"]);
          const remaining = Number.isFinite(Number(row.BudgetRemaining)) ? Number(row.BudgetRemaining) : Number.isFinite(Number(row.Remaining)) ? Number(row.Remaining) : oba - ae;
          return { ...row, Source: tab.title, DisplayName: rowName(row), Group: group, Entity: entity, Important: entity === "pu" && isImportantPuRow(row), AnalysisOBA: oba, AnalysisBP: bp, AnalysisAE: ae, AnalysisRemaining: remaining, AnalysisBPPct: numericValue(row, ["BPPercent"]), AnalysisOBAPct: numericValue(row, ["OBAPercent"]), AnalysisPreviousAE: previousAe, AnalysisYoY: numericValue(row, ["ActualVariation", "VariationActual"]), AnalysisVariationBP: numericValue(row, ["VariationBP", "Variation"]) };
        });
      });
    }
    function filterAnalysisRows(rows) {
      return rows.filter(row => {
        if (analysisState.scope === "current" && row.Group !== "current") return false;
        if (analysisState.scope === "previous" && row.Group !== "previous") return false;
        if (analysisState.scope === "pu" && row.Entity !== "pu") return false;
        if (analysisState.scope === "demand" && row.Entity !== "demand") return false;
        if (analysisState.scope === "important" && !row.Important) return false;
        if (analysisState.pu === "important" && row.Entity === "pu" && !row.Important) return false;
        if (analysisState.pu === "staff" && row.Entity === "pu" && !STAFF_CODES.has(codeFromLabel(row.DisplayName, "PU"))) return false;
        if (analysisState.pu === "nonstaff" && row.Entity === "pu" && STAFF_CODES.has(codeFromLabel(row.DisplayName, "PU"))) return false;
        if (analysisState.attention === "overBp") return row.AnalysisBPPct > 100 || row.AnalysisVariationBP > 0;
        if (analysisState.attention === "nearBp") return row.AnalysisBPPct >= 75 && row.AnalysisBPPct <= 100;
        if (analysisState.attention === "lowBp") return row.AnalysisBP > 0 && row.AnalysisBPPct < 50;
        if (analysisState.attention === "negative") return row.AnalysisRemaining < 0;
        if (analysisState.attention === "highOba") return row.AnalysisOBAPct >= 75;
        if (analysisState.attention === "yoyRise") return row.AnalysisYoY > 0;
        if (analysisState.attention === "yoyFall") return row.AnalysisYoY < 0;
        return true;
      });
    }
    function analysisMetricValue(row) {
      return { ae:row.AnalysisAE, bp:row.AnalysisBP, oba:row.AnalysisOBA, remaining:row.AnalysisRemaining, bpPct:row.AnalysisBPPct, obaPct:row.AnalysisOBAPct, yoy:row.AnalysisYoY }[analysisState.metric] || row.AnalysisAE;
    }
    function analysisTotals(rows) {
      const total = rows.reduce((sum, row) => { sum.oba += row.AnalysisOBA; sum.bp += row.AnalysisBP; sum.ae += row.AnalysisAE; sum.remaining += row.AnalysisRemaining; sum.previousAe += row.AnalysisPreviousAE; sum.yoy += row.AnalysisYoY; return sum; }, { oba:0, bp:0, ae:0, remaining:0, previousAe:0, yoy:0 });
      total.bpPct = total.bp ? total.ae / total.bp * 100 : 0;
      total.obaPct = total.oba ? total.ae / total.oba * 100 : 0;
      return total;
    }
    function renderAnalysisControls() {
      const option = (value, label, selected) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
      return `<div class="analysis-toolbar">
        <label>Review Scope<select data-analysis-filter="scope">${option("current", "Current Year Review", analysisState.scope)}${option("previous", "Previous Year Comparison", analysisState.scope)}${option("pu", "PU Wise Review", analysisState.scope)}${option("demand", "Demand / SMH Review", analysisState.scope)}${option("important", "Important PU only", analysisState.scope)}${option("all", "All tables", analysisState.scope)}</select></label>
        <label>Finance Focus<select data-analysis-filter="metric">${option("ae", "Actual Expenditure", analysisState.metric)}${option("bp", "Budget Proportion", analysisState.metric)}${option("oba", "OBA / RG Allotment", analysisState.metric)}${option("remaining", "Budget Remaining", analysisState.metric)}${option("bpPct", "% BP Utilized", analysisState.metric)}${option("obaPct", "% OBA Utilized", analysisState.metric)}${option("yoy", "Current vs Previous AE Variation", analysisState.metric)}</select></label>
        <label>Attention Filter<select data-analysis-filter="attention">${option("all", "All items", analysisState.attention)}${option("overBp", "Over BP / excess booking", analysisState.attention)}${option("nearBp", "Near BP watch 75%-100%", analysisState.attention)}${option("lowBp", "Low booking under 50%", analysisState.attention)}${option("negative", "Negative balance", analysisState.attention)}${option("highOba", "High OBA utilization", analysisState.attention)}${option("yoyRise", "Higher than previous year", analysisState.attention)}${option("yoyFall", "Lower than previous year", analysisState.attention)}</select></label>
        <label>PU Treatment<select data-analysis-filter="pu">${option("all", "All PU rows", analysisState.pu)}${option("important", "Important PU only when PU rows", analysisState.pu)}${option("staff", "Staff PU only", analysisState.pu)}${option("nonstaff", "Non-Staff PU only", analysisState.pu)}</select></label>
      </div>`;
    }
    function renderFinanceSummary(rows, totals) {
      const overBp = rows.filter(row => row.AnalysisBPPct > 100 || row.AnalysisVariationBP > 0).length;
      const negative = rows.filter(row => row.AnalysisRemaining < 0).length;
      const important = rows.filter(row => row.Important).length;
      return `<div class="finance-summary"><article class="finance-card"><span>Scope</span><strong>${htmlEscape(analysisScopeLabel(analysisState.scope))}</strong><em>${rows.length} review rows</em></article><article class="finance-card"><span>Actual Expenditure</span><strong>${moneyCellHtml(totals.ae)}</strong><em>${formatNumber(totals.bpPct, 1)}% of BP</em></article><article class="finance-card"><span>OBA / RG Allotment</span><strong>${moneyCellHtml(totals.oba)}</strong><em>${formatNumber(totals.obaPct, 1)}% utilized</em></article><article class="finance-card ${totals.remaining < 0 ? "danger" : "good"}"><span>Budget Remaining</span><strong>${moneyCellHtml(totals.remaining)}</strong><em>${negative} negative balance rows</em></article><article class="finance-card warn"><span>Attention</span><strong>${overBp}</strong><em>over BP / excess booking rows</em></article><article class="finance-card"><span>Important PU</span><strong>${important}</strong><em>PU 27, 28, 30, 32, 60 in view</em></article></div>`;
    }
    function renderAttentionStrip(rows) {
      const parts = [["Over BP", "overBp", rows.filter(row => row.AnalysisBPPct > 100 || row.AnalysisVariationBP > 0).length, "danger"], ["75%-100% BP", "nearBp", rows.filter(row => row.AnalysisBPPct >= 75 && row.AnalysisBPPct <= 100).length, "warn"], ["Low BP <50%", "lowBp", rows.filter(row => row.AnalysisBP > 0 && row.AnalysisBPPct < 50).length, "calm"], ["Negative Balance", "negative", rows.filter(row => row.AnalysisRemaining < 0).length, "danger"], ["YoY Increase", "yoyRise", rows.filter(row => row.AnalysisYoY > 0).length, "warn"], ["YoY Decrease", "yoyFall", rows.filter(row => row.AnalysisYoY < 0).length, "good"]];
      return `<div class="attention-strip">${parts.map(([label, key, count, tone]) => `<button type="button" class="attention-pill ${tone}" data-analysis-attention="${key}"><span>${label}</span><strong>${count}</strong></button>`).join("")}</div>`;
    }
    function renderMetricBars(rows) {
      const grouped = rows.reduce((map, row) => { map[row.Source] = (map[row.Source] || 0) + Number(analysisMetricValue(row) || 0); return map; }, {});
      const entries = Object.entries(grouped).sort((a,b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8);
      const max = Math.max(...entries.map(([, value]) => Math.abs(value)), 1);
      return `<section class="analysis-panel metric-focus"><h3>${htmlEscape(analysisMetricLabel(analysisState.metric))} by Report</h3>${entries.map(([label, value]) => `<div class="bar-row"><strong>${htmlEscape(label)}</strong><div class="bar-track"><div class="bar-fill ${value < 0 ? "prev" : ""}" style="width:${Math.min(100, Math.abs(value) / max * 100)}%"></div></div><span>${analysisState.metric.endsWith("Pct") ? formatNumber(value, 1) + "%" : moneyCellHtml(value)}</span></div>`).join("")}</section>`;
    }
    function renderAnalysisViewTabs() {
      const tabs = [["overview", "Overview"], ["alerts", "Attention Alerts"], ["drill", "PU / Demand Drilldown"], ["sources", "Protected Logic & Sources"]];
      return `<div class="analysis-view-tabs">${tabs.map(([key, label]) => `<button type="button" class="${analysisState.view === key ? "active" : ""}" data-analysis-view="${key}">${label}</button>`).join("")}</div>`;
    }
    function renderRiskRail(rows) {
      const groups = [
        ["Critical", rows.filter(row => row.AnalysisRemaining < 0 || row.AnalysisBPPct > 100).length, "danger"],
        ["Watch", rows.filter(row => row.AnalysisBPPct >= 75 && row.AnalysisBPPct <= 100).length, "warn"],
        ["Slow Booking", rows.filter(row => row.AnalysisBP > 0 && row.AnalysisBPPct < 50).length, "calm"],
        ["Important PU", rows.filter(row => row.Important).length, "good"]
      ];
      return `<div class="risk-rail">${groups.map(([label, count, tone]) => `<article class="risk-tile ${tone}"><span>${label}</span><strong>${count}</strong></article>`).join("")}</div>`;
    }
    function protectedAnalysisLogic() {
      if (!analysisState.logicUnlocked) return `<section class="protected-panel"><h3>Calculation Logic & Data Source Locked</h3><p>Enter the upload password to view source mapping and calculation logic from this Analysis page.</p><button class="export" type="button" data-unlock-analysis-logic>Unlock Logic & Sources</button></section>`;
      const logicRows = [
        ["OBA / RG", "Current year uses BG_ISL 2026-27 as OBA until current RG is available. Previous year comparison uses RG 2025-26."],
        ["BP", "Budget Proportion = OBA / 12 * completed month count. Default completed month count is 03 for APR-JUN 2026."],
        ["AE", "Actual Expenditure uses completed actuals up to JUN 2026 in default tabs. July running figures stay in Till Date / Running Month."],
        ["AE - BP", "Actual Expenditure minus Budget Proportion. Positive values need attention for excess booking pace."],
        ["Budget Remaining", "OBA minus Actual Expenditure. Negative values are highlighted as excess/low-balance risk."],
        ["% BP", "Actual Expenditure / Budget Proportion * 100."],
        ["% OBA", "Actual Expenditure / OBA * 100."],
        ["YoY Variation", "Current-year AE minus previous-year AE for the same completed month basis."]
      ];
      return `<section class="protected-panel unlocked"><h3>Protected Calculation Logic</h3><table class="source-table"><thead><tr><th>Column / Measure</th><th>Logic Being Used</th></tr></thead><tbody>${logicRows.map(row => `<tr><td>${htmlEscape(row[0])}</td><td>${htmlEscape(row[1])}</td></tr>`).join("")}</tbody></table><h3>Repository Data Source Plan</h3><div class="source-plan compact">${sourcePlanTableHtml("all")}</div></section>`;
    }
    function renderAnalysisBody(rows, ranked, overBp, negativeBalance, yoyMovement, importantRows) {
      const baseColumns = [{label:"Report", key:"Source"}, {label:"Item", key:"DisplayName"}];
      const metricKey = analysisState.metric === "ae" ? "AnalysisAE" : analysisState.metric === "bp" ? "AnalysisBP" : analysisState.metric === "oba" ? "AnalysisOBA" : analysisState.metric === "remaining" ? "AnalysisRemaining" : analysisState.metric === "bpPct" ? "AnalysisBPPct" : analysisState.metric === "obaPct" ? "AnalysisOBAPct" : "AnalysisYoY";
      const metricFormat = analysisState.metric.endsWith("Pct") ? "percent" : "money";
      if (analysisState.view === "sources") return protectedAnalysisLogic();
      if (analysisState.view === "alerts") return `<div class="analysis-panels finance-panels focus-mode">${compactTable("Over BP / Excess Booking", overBp, [...baseColumns, {label:"BP", key:"AnalysisBP", format:"money", num:true}, {label:"AE", key:"AnalysisAE", format:"money", num:true}, {label:"% BP", key:"AnalysisBPPct", format:"percent", num:true}, {label:"AE - BP", key:"AnalysisVariationBP", format:"money", num:true}])}${compactTable("Negative / Low Balance", negativeBalance, [...baseColumns, {label:"OBA", key:"AnalysisOBA", format:"money", num:true}, {label:"AE", key:"AnalysisAE", format:"money", num:true}, {label:"Remaining", key:"AnalysisRemaining", format:"money", num:true}, {label:"% OBA", key:"AnalysisOBAPct", format:"percent", num:true}])}</div>`;
      if (analysisState.view === "drill") return `<div class="analysis-panels finance-panels focus-mode">${compactTable("Important PU Watch", importantRows, [...baseColumns, {label:"OBA", key:"AnalysisOBA", format:"money", num:true}, {label:"AE", key:"AnalysisAE", format:"money", num:true}, {label:"% BP", key:"AnalysisBPPct", format:"percent", num:true}, {label:"Remaining", key:"AnalysisRemaining", format:"money", num:true}])}${compactTable("Previous Year Movement", yoyMovement, [...baseColumns, {label:"Current AE", key:"AnalysisAE", format:"money", num:true}, {label:"Previous AE", key:"AnalysisPreviousAE", format:"money", num:true}, {label:"Variation", key:"AnalysisYoY", format:"money", num:true}])}</div>`;
      return `<div class="analysis-hero-grid">${renderMetricBars(rows)}${compactTable(`Top ${htmlEscape(analysisMetricLabel(analysisState.metric))} Items`, ranked, [...baseColumns, {label:analysisMetricLabel(analysisState.metric), key:metricKey, format:metricFormat, num:true}, {label:"% BP", key:"AnalysisBPPct", format:"percent", num:true}, {label:"Remaining", key:"AnalysisRemaining", format:"money", num:true}])}</div>`;
    }
    function renderAnalysisSuspensePanel() {
      const rows = ["demand", "demand_prev"].flatMap(key => {
        const tab = DATA[key] || { rows: [] };
        return demandSuspenseRows(tab.rows || []).map(row => {
          const ae = numericValue(row, ["AE", "AECurrent", "CurrentAE"]);
          const bp = numericValue(row, ["BP"]);
          const oba = numericValue(row, ["OBA", "PreviousOBA"]);
          const remaining = Number.isFinite(Number(row.BudgetRemaining)) ? Number(row.BudgetRemaining) : Number.isFinite(Number(row.Remaining)) ? Number(row.Remaining) : oba - ae;
          return { source:tab.title, name:rowName(row), oba, bp, ae, remaining };
        });
      });
      if (!rows.length) return "";
      return `<section class="special-demand-panel"><h3>Demand 12N / 10N - Separate Suspense Verification</h3><p>This suspense/negative demand is not included in main totals, attention cards, comparison item list, or export summary totals.</p><table><thead><tr><th>Report</th><th>Demand</th><th>OBA / RG</th><th>BP</th><th>AE</th><th>Remaining</th></tr></thead><tbody>${rows.map(row => `<tr class="special-demand"><td>${htmlEscape(row.source)}</td><td>${htmlEscape(row.name)}</td><td>${moneyCellHtml(row.oba)}</td><td>${moneyCellHtml(row.bp)}</td><td>${moneyCellHtml(row.ae)}</td><td>${moneyCellHtml(row.remaining)}</td></tr>`).join("")}</tbody></table></section>`;
    }
    function renderAnalysis() {
      document.getElementById("title").textContent = "Finance Attention Analysis";
      document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === "analysis"));
      const rows = filterAnalysisRows(analysisRows());
      const totals = analysisTotals(rows);
      const ranked = [...rows].sort((a,b) => Math.abs(analysisMetricValue(b)) - Math.abs(analysisMetricValue(a))).slice(0, 15);
      const overBp = rows.filter(row => row.AnalysisBPPct > 100 || row.AnalysisVariationBP > 0).sort((a,b) => b.AnalysisBPPct - a.AnalysisBPPct).slice(0, 12);
      const negativeBalance = rows.filter(row => row.AnalysisRemaining < 0).sort((a,b) => a.AnalysisRemaining - b.AnalysisRemaining).slice(0, 12);
      const yoyMovement = rows.filter(row => row.AnalysisYoY).sort((a,b) => Math.abs(b.AnalysisYoY) - Math.abs(a.AnalysisYoY)).slice(0, 12);
      const importantRows = rows.filter(row => row.Important).sort((a,b) => Math.abs(analysisMetricValue(b)) - Math.abs(analysisMetricValue(a))).slice(0, 12);
      const body = renderAnalysisBody(rows, ranked, overBp, negativeBalance, yoyMovement, importantRows);
      document.getElementById("tableHost").innerHTML = `<div class="analysis-shell"><div class="analysis-top"><div><div class="note analysis-note">Remarks - Figures in '000' (thousands). Default period is completed JUN 2026 / 03-month BP projection.</div><div class="analysis-context"><strong>Selected View:</strong> ${htmlEscape(analysisScopeLabel(analysisState.scope))} | <strong>Finance Focus:</strong> ${htmlEscape(analysisMetricLabel(analysisState.metric))} | <strong>Attention:</strong> ${htmlEscape(analysisAttentionLabel(analysisState.attention))}</div></div>${renderAnalysisViewTabs()}</div>${renderAnalysisControls()}${renderAnalysisSuspensePanel()}${renderFinanceSummary(rows, totals)}${renderRiskRail(rows)}${renderAttentionStrip(rows)}${body}</div>`;
    }
    function compareDataset() {
      const key = compareState.entity === "demand" ? "demand_prev" : "pu_prev";
      const tab = DATA[key] || { rows: [] };
      return { key, tab, rows: (tab.rows || []).filter(row => rowName(row)) };
    }
    function compareItems(rows) {
      const details = rows.filter(row => !isTotalRow(row) && !isDemandSuspenseRow(row));
      return [["__total", "Total"], ...details.map(row => [rowName(row), rowName(row)])];
    }
    function selectedCompareRow(rows) {
      if (compareState.item === "__total") return totalRow({ rows });
      return rows.find(row => rowName(row) === compareState.item) || totalRow({ rows });
    }
    function compareValues(row) {
      return [
        { label:"BP", key:"bp", value:numericValue(row, ["BP"]), cls:"" },
        { label:"AE 06/2026", key:"current", value:numericValue(row, ["AECurrent", "CurrentAE", "AE"]), cls:"alt" },
        { label:"AE 06/2025", key:"previous", value:numericValue(row, ["AEPrevious", "PreviousAE"]), cls:"prev" }
      ];
    }
    function renderCompareControls(rows) {
      const items = compareItems(rows);
      if (!items.some(([value]) => value === compareState.item)) compareState.item = "__total";
      return `<div class="compare-toolbar">
        <label>Comparison Range<select id="compareYears">
          <option value="1" ${compareState.years === "1" ? "selected" : ""}>Previous Year</option>
          <option value="2" ${compareState.years === "2" ? "selected" : ""}>Previous 2 Years - source link required</option>
          <option value="3" ${compareState.years === "3" ? "selected" : ""}>Previous 3 Years - source link required</option>
        </select></label>
        <label>Analysis Type<select id="compareEntity">
          <option value="pu" ${compareState.entity === "pu" ? "selected" : ""}>Individual PU Wise Comparison</option>
          <option value="demand" ${compareState.entity === "demand" ? "selected" : ""}>Demand Wise Comparison</option>
        </select></label>
        <label>Item<select id="compareItem">${items.map(([value, label]) => `<option value="${htmlEscape(value)}" ${compareState.item === value ? "selected" : ""}>${htmlEscape(label)}</option>`).join("")}</select></label>
        <label>Metric Focus<select id="compareMetric">
          <option value="ae" ${compareState.metric === "ae" ? "selected" : ""}>AE Wise</option>
          <option value="bp" ${compareState.metric === "bp" ? "selected" : ""}>BP Wise</option>
        </select></label>
        <label>Chart View<select id="compareChart">
          <option value="bar" ${compareState.chart === "bar" ? "selected" : ""}>Bar Chart</option>
          <option value="pie" ${compareState.chart === "pie" ? "selected" : ""}>Pie Chart</option>
          <option value="both" ${compareState.chart === "both" ? "selected" : ""}>Bar + Pie</option>
        </select></label>
      </div>`;
    }
    function renderBarChart(values) {
      const max = Math.max(...values.map(item => Math.abs(item.value)), 1);
      return `<section class="chart-panel"><h3>Bar Chart</h3>${values.map(item => `<div class="bar-row"><strong>${htmlEscape(item.label)}</strong><div class="bar-track"><div class="bar-fill ${item.cls}" style="width:${Math.min(100, Math.abs(item.value) / max * 100)}%"></div></div><span>${moneyCellHtml(item.value)}</span></div>`).join("")}</section>`;
    }
    function renderPieChart(values) {
      const parts = values.map(item => ({ ...item, abs:Math.abs(item.value) }));
      const total = parts.reduce((sum, item) => sum + item.abs, 0) || 1;
      let cursor = 0;
      const colors = ["var(--blue)", "var(--teal)", "#7b8794"];
      const stops = parts.map((item, index) => {
        const start = cursor;
        cursor += item.abs / total * 100;
        return `${colors[index]} ${start}% ${cursor}%`;
      }).join(", ");
      return `<section class="chart-panel"><h3>Pie Chart</h3><div class="pie-wrap"><div class="pie" style="background:conic-gradient(${stops})"></div><div class="legend">${parts.map((item, index) => `<div><span style="background:${colors[index]}"></span>${htmlEscape(item.label)}: ${moneyCellHtml(item.value)} (${formatNumber(item.abs / total * 100, 1)}%)</div>`).join("")}</div></div></section>`;
    }
    function renderUpload() {
      const { year } = syncYearEntry();
      const currentRows = CURRENT_YEAR_UPLOAD_ROLES.map((role, index) => uploadCard(role, index + 1)).join("");
      document.getElementById("title").textContent = `Data Upload and Repository Sources - ${year || "Configured Year"}`;
      document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === "upload"));
      const panel = document.createElement("div");
      panel.className = "upload-panel";
      panel.innerHTML = `
        <div class="note upload-note">Use previous-year files as fixed repository reference. Upload only latest current-year files, verify, then confirm/store.</div>
        <section class="upload-section">
          <div class="upload-section-head">
            <div><strong>1. Previous Year Repository Reference</strong><span>Static comparison files already kept in GitHub/repo folders. Load them for verification; do not monthly overwrite here.</span></div>
            <div class="sync-actions">
              <button class="export" id="syncRemote" type="button">Load Repo Sources</button>
              <button class="export" id="showSourceConfig" type="button">Show Source Plan</button>
            </div>
          </div>
          <div class="source-plan compact">${sourcePlanTableHtml("previous")}</div>
        </section>
        <section class="upload-section current-update">
          <div class="upload-section-head">
            <div><strong>2. Current Year Monthly Update - ${htmlEscape(year || "2026-2027")}</strong><span>Upload latest six files first. Then Verify/Recalculate. Store only after figures are checked.</span></div>
            <div class="sync-actions">
              <button class="export" id="applyUpload" type="button">Verify / Recalculate</button>
              <button class="export confirm-store" id="storeCurrentUploads" type="button">Confirm & Store Current Year Files</button>
            </div>
          </div>
          <div class="upload-grid current-only">${currentRows}</div>
        </section>
        <section class="upload-section">
          <div class="upload-section-head"><div><strong>Repository Availability / Action Log</strong><span>Load Repo Sources shows what is available before download. Store keeps last two backup copies.</span></div></div>
          <div id="uploadLog" class="log">Waiting. Step 1: upload latest current-year files, or click Load Repo Sources to see repository availability.</div>
        </section>`;
      document.getElementById("tableHost").replaceChildren(panel);
      document.querySelectorAll("[data-upload-role]").forEach(input => input.addEventListener("change", event => readUploadedFile(event.target.files[0], event.target.dataset.uploadRole, { keepFile: true })));
      document.getElementById("applyUpload").addEventListener("click", applyUploadedData);
      document.getElementById("storeCurrentUploads").addEventListener("click", storeCurrentYearUploads);
      document.getElementById("syncRemote").addEventListener("click", syncRemoteSources);
      document.getElementById("showSourceConfig").addEventListener("click", showSourceConfig);
    }
    function roleLabel(role) {
      return SOURCE_ROLE_LABELS[role] || role;
    }
    function uploadCard(role, number) {
      const details = {
        currPuBudget: "Primary Unit wise current-year budget.",
        currPuMonth: "Primary Unit wise actual expense up to latest month/date.",
        currPuDeptDemandSmhBudget: "PU wise, department wise, demand/SMH wise budget.",
        currPuDeptDemandSmhActual: "PU wise, department wise, demand/SMH wise actual expense.",
        currSmhBudget: "Demand/SMH wise current-year budget.",
        currSmhMonth: "Demand/SMH wise current-year actual up to latest month/date."
      };
      return `<div class="upload-card"><strong>${number}. ${htmlEscape(roleLabel(role))}</strong><span>${htmlEscape(details[role] || "")}</span><input data-upload-role="${role}" type="file" accept=".xls,.xlsx"><em data-status-role="${role}">No latest file selected</em></div>`;
    }
    function logUpload(message) {
      const log = document.getElementById("uploadLog");
      if (log) log.textContent += "\n" + message;
    }
    function setUploadStatus(role, message, ok = null) {
      const status = document.querySelector(`[data-status-role="${role}"]`);
      if (!status) return;
      status.textContent = message;
      status.style.display = "block";
      status.style.marginTop = "6px";
      status.style.fontStyle = "normal";
      status.style.fontWeight = "700";
      status.style.color = ok === true ? "#126a66" : ok === false ? "#b42318" : "#607080";
    }
    function syncConfig() {
      return DATA_SOURCE_CONFIG || {};
    }
    function syncYearEntry() {
      const config = syncConfig();
      const years = config.years || {};
      const year = config.syncYear || Object.keys(years).sort().at(-1) || "";
      return { year, entry: years[year] || {} };
    }
    function remoteFilesForSync() {
      const { entry } = syncYearEntry();
      const files = entry.files || {};
      const legacy = entry.legacyKeys || entry;
      return {
        fr: files.fr || legacy.frBudgetStatus || "",
        currPuBudget: files.currPuBudget || legacy.currentPuBudget || "",
        currPuMonth: files.currPuMonth || "",
        currPuDeptDemandSmhBudget: files.currPuDeptDemandSmhBudget || "",
        currPuDeptDemandSmhActual: files.currPuDeptDemandSmhActual || "",
        currSmhBudget: files.currSmhBudget || files.currDemandSmhBudget || legacy.currentSmhBudget || "",
        currSmhMonth: files.currSmhMonth || files.currDemandSmhActual || "",
        prevPuBudget: files.prevPuBudget || legacy.previousPuBudget || "",
        prevPuMonth: files.prevPuMonth || "",
        prevPuDeptDemandSmhBudget: files.prevPuDeptDemandSmhBudget || "",
        prevPuDeptDemandSmhActual: files.prevPuDeptDemandSmhActual || "",
        prevSmhBudget: files.prevSmhBudget || files.prevDemandSmhBudget || legacy.previousSmhBudget || "",
        prevSmhMonth: files.prevSmhMonth || files.prevDemandSmhActual || "",
      };
    }
    function sourceRoles(mode = "all") {
      if (mode === "current") return CURRENT_YEAR_UPLOAD_ROLES;
      if (mode === "previous") return PREVIOUS_YEAR_REPO_ROLES;
      return [...PREVIOUS_YEAR_REPO_ROLES, ...CURRENT_YEAR_UPLOAD_ROLES];
    }
    function repoAvailabilityRows(mode = "all") {
      const files = remoteFilesForSync();
      return sourceRoles(mode).map(role => {
        const url = normalizeRemoteUrl(files[role]);
        return { role, label: roleLabel(role), available: !!url, url };
      });
    }
    function sourcePlanTableHtml(mode = "all") {
      const rows = repoAvailabilityRows(mode);
      return `<table class="source-table"><thead><tr><th>Data File</th><th>Repo Status</th><th>Configured Source</th></tr></thead><tbody>${rows.map(row => `<tr class="${row.available ? "available" : "missing"}"><td>${htmlEscape(row.label)}</td><td>${row.available ? "Available" : "Not configured"}</td><td>${row.url ? htmlEscape(row.url) : "Not configured"}</td></tr>`).join("")}</tbody></table>`;
    }
    function sourcePlanText(mode = "all") {
      const { year } = syncYearEntry();
      const rows = repoAvailabilityRows(mode);
      return [
        `Active upload/sync year: ${year || "not set"}`,
        `View: ${mode === "previous" ? "Previous year repository reference" : mode === "current" ? "Current year monthly update" : "All configured files"}`,
        "",
        ...rows.map(row => `${row.available ? "OK" : "MISSING"} - ${row.label}: ${row.url || "Not configured"}`)
      ].join("\n");
    }
    function normalizeRemoteUrl(url) {
      let text = String(url || "").trim();
      if (!text) return "";
      text = text.replace("github.com/", "raw.githubusercontent.com/").replace("/blob/", "/");
      const drive = text.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
      if (drive) text = `https://drive.usercontent.google.com/download?id=${drive[1]}&export=download`;
      const openDrive = text.match(/[?&]id=([^&]+)/i);
      if (/drive\.google\.com\/open/i.test(text) && openDrive) text = `https://drive.usercontent.google.com/download?id=${openDrive[1]}&export=download`;
      const ucDrive = text.match(/drive\.google\.com\/uc\?[^#]*[?&]id=([^&]+)/i);
      if (ucDrive) text = `https://drive.usercontent.google.com/download?id=${ucDrive[1]}&export=download`;
      return text;
    }
    function fileNameFromUrl(url, role) {
      try {
        const parsed = new URL(url, window.location.href);
        const name = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
        return name && /\.(xls|xlsx|html|htm)$/i.test(name) ? name : `${role}.xlsx`;
      } catch {
        return `${role}.xlsx`;
      }
    }
    function currentYearRoleTarget(role) {
      return {
        currPuBudget: "pu-budget.xls",
        currPuMonth: "pu-month-actual.xls",
        currPuDeptDemandSmhBudget: "pu-dept-demand-smh-budget.xls",
        currPuDeptDemandSmhActual: "pu-dept-demand-smh-actual.xls",
        currSmhBudget: "demand-smh-budget.xls",
        currSmhMonth: "demand-smh-actual.xls"
      }[role] || "";
    }
    function parsedRoleMatchesExpected(parsedRole, expectedRole) {
      if (parsedRole === expectedRole) return true;
      const compatible = {
        currPuDeptDemandSmhBudget: ["currPuBudget", "currSmhBudget"],
        currPuDeptDemandSmhActual: ["currPuMonth", "currSmhMonth"],
        currSmhMonth: ["currPuMonth"]
      };
      return (compatible[expectedRole] || []).includes(parsedRole);
    }
    async function fetchConfiguredRole(role) {
      const files = remoteFilesForSync();
      const url = normalizeRemoteUrl(files[role]);
      if (!url) throw new Error(`${role} is not configured in data/year-sources.json.`);
      setUploadStatus(role, "Loading static source...", null);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${role} fetch failed: HTTP ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], fileNameFromUrl(url, role), { type: blob.type || "application/octet-stream" });
      await readUploadedFile(file, role, { keepFile: false, quiet: true });
      logUpload(`${role} loaded from repository source.`);
    }
    async function ensureStaticPreviousSources() {
      const previousRoles = ["prevPuBudget", "prevSmhBudget"];
      for (const role of previousRoles) {
        if (!UPLOAD_STATE[role]) await fetchConfiguredRole(role);
      }
    }
    async function storeCurrentYearUploads() {
      const missing = CURRENT_YEAR_UPLOAD_ROLES.filter(role => !UPLOAD_FILES[role]);
      if (missing.length) {
        missing.forEach(role => setUploadStatus(role, "Upload latest file before store", false));
        logUpload("Store failed: missing current-year files: " + missing.map(roleLabel).join(", "));
        return;
      }
      const { year } = syncYearEntry();
      const fileList = CURRENT_YEAR_UPLOAD_ROLES.map(role => `${roleLabel(role)}: ${UPLOAD_FILES[role]?.name || currentYearRoleTarget(role)}`).join("\n");
      const ok = window.confirm(`Confirm store/update for current year ${year || "2026-2027"}?\n\nThis will overwrite current-year repo files after creating a backup snapshot.\nThe system keeps the latest two backup copies.\n\n${fileList}`);
      if (!ok) {
        logUpload("Store cancelled. Current-year files remain uploaded in browser only.");
        return;
      }
      const form = new FormData();
      form.append("year", year || "2026-2027");
      CURRENT_YEAR_UPLOAD_ROLES.forEach(role => form.append(role, UPLOAD_FILES[role], currentYearRoleTarget(role)));
      try {
        logUpload("Saving current-year files into repository folder...");
        const response = await fetch("/api/current-year-upload", { method: "POST", body: form });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
        logUpload(`Stored ${payload.saved?.length || CURRENT_YEAR_UPLOAD_ROLES.length} files for ${payload.year}. Backup: ${payload.backup || "not needed"}.`);
      } catch (error) {
        logUpload("Store failed: " + error.message + " Start the local upload server with scripts\\local-upload-server.py; GitHub Pages cannot write repository files directly.");
      }
    }
    function showSourceConfig() {
      const config = syncConfig();
      const years = config.years || {};
      const lines = [
        `Preferred source: ${config.preferredRemoteSource || "not set"}`,
        `Active upload/sync year: ${config.syncYear || "not set"}`,
        "",
        "Configured repository source files:"
      ];
      Object.keys(years).sort().forEach(year => {
        const entry = years[year] || {};
        const files = entry.files || {};
        lines.push("", `${year} - ${entry.status || "configured"}`);
        if (entry.updateCadence) lines.push(`  update: ${entry.updateCadence}`);
        Object.entries(files).forEach(([role, url]) => lines.push(`  ${role}: ${url ? normalizeRemoteUrl(url) : "Not configured"}`));
      });
      const log = document.getElementById("uploadLog");
      if (log) log.textContent = lines.join("\n");
      const plan = document.querySelector(".source-plan");
      if (plan) plan.innerHTML = sourcePlanTableHtml("all");
    }
    async function syncRemoteSources() {
      const log = document.getElementById("uploadLog");
      if (log) log.textContent = "Repository availability before load:\n\n" + sourcePlanText("all") + "\n\nDownloading configured files...";
      const plan = document.querySelector(".source-plan");
      if (plan) plan.innerHTML = sourcePlanTableHtml("all");
      if (window.location.protocol === "file:") {
        logUpload("Note: this portal is open as a local file. Some browsers block Google Drive sync from file:// pages. If every file says Failed to fetch, open the portal from GitHub Pages or a local web server.");
      }
      const files = remoteFilesForSync();
      const required = ["currPuBudget", "currSmhBudget"];
      const syncOrder = ["currPuBudget", "currPuMonth", "currPuDeptDemandSmhBudget", "currPuDeptDemandSmhActual", "currSmhBudget", "currSmhMonth", "prevPuBudget", "prevSmhBudget"];
      const roles = syncOrder.filter(role => String(files[role] || "").trim());
      if (!roles.length) {
        logUpload("No remote URLs configured. Add links in data/year-sources.json under years -> 2026-2027 -> files.");
        return;
      }
      const missingRequired = required.filter(role => !files[role] && !UPLOAD_STATE[role]);
      if (missingRequired.length) logUpload("Required remote links not configured yet: " + missingRequired.map(roleLabel).join(", "));
      for (const role of roles) {
        const url = normalizeRemoteUrl(files[role]);
        try {
          setUploadStatus(role, "Syncing...", null);
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
          const blob = await response.blob();
          const file = new File([blob], fileNameFromUrl(url, role), { type: blob.type || "application/octet-stream" });
          await readUploadedFile(file, role);
        } catch (error) {
          setUploadStatus(role, `SYNC ERROR: ${error.message}`, false);
          const localHint = window.location.protocol === "file:" ? " Try opening through GitHub Pages or a local web server instead of file://." : "";
          logUpload(`${role} sync failed: ${error.message}.${localHint}`);
        }
      }
      logUpload("Repo sources loaded. Refreshing calculation data while staying on Upload page...");
      await applyUploadedData({ stayOnUpload: true });
    }
    function ensureSheetJS() {
      if (window.XLSX) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = SHEETJS_SRC;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Excel parser could not load. Please keep internet available or use generated outputs."));
        document.head.appendChild(script);
      });
    }
    function cleanHeader(value) { return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase(); }
    function codeFromLabel(label, prefix) { const match = String(label || "").match(new RegExp(prefix + "\\s*-\\s*([0-9A-Z]+)", "i")); return match ? match[1].toUpperCase() : ""; }
    function demandFromSmh(label) { const code = codeFromLabel(label, "SMH"); const match = code.match(/^(\d+)([A-Z]*)$/); return match ? `Demand ${String(Number(match[1]) + 2).padStart(2, "0")}${match[2]} / ${code}` : (code || label); }
    const DEMAND_DEPARTMENT = {"03": "PERSONNEL / STORE And Office Staff", "04": "ENGINEERING / PWAY", "05": "Mechanical LOCO Shed Roza", "06": "Electrical General / Mech C&W", "07": "S&T / TRD", "08": "MECHANICAL / Running Staff", "09": "OPERATING / Commercial", "10": "Operating Expenses - Fuel / Traction", "11": "MEDICAL", "12": "SECURITY", "13": "Pension and Retirement", "12N": "Suspense Heads"};
    function demandKey(label) { const match = String(label || "").match(/Demand\s+([0-9A-Z]+)/i); return match ? match[1].toUpperCase() : ""; }
    function demandDepartment(label) { return DEMAND_DEPARTMENT[demandKey(label)] || ""; }
    function withDemandDepartment(row) { row.Department = demandDepartment(row.Name); return row; }
    const MONTHS = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"];
    function monthCount(month) { const idx = MONTHS.indexOf(cleanHeader(month).slice(0, 3)); return idx >= 0 ? idx + 1 : 3; }
    function detectActualPeriod(headers) {
      const matches = [];
      headers.forEach((header, idx) => {
        const match = header.match(/ACTUALS\s+UPTO\s+([A-Z]{3})\s+(20\d{2})/);
        if (match) matches.push({ idx, month: match[1], year: Number(match[2]), count: monthCount(match[1]), label: `${match[1]} ${match[2]}` });
      });
      if (!matches.length) return { idx: colIndex(headers, ["ACTUALS", "UPTO"]), month: "JUN", year: 2026, count: 3, label: "JUN 2026" };
      matches.sort((a, b) => (a.year - b.year) || (a.count - b.count));
      return matches[matches.length - 1];
    }
    function findCoppyForPeriod(headers, period) {
      const prevYear = String(period.year - 1);
      const exact = headers.findIndex(header => header.includes("COPPY") && header.includes("UPTO") && header.includes(period.month) && header.includes(prevYear));
      if (exact >= 0) return exact;
      return colIndex(headers, ["COPPY", "UPTO", period.month]);
    }
    function findBpForPeriod(headers, period) {
      const exact = headers.findIndex(header => header.includes("BP") && header.includes("UPTO") && header.includes(period.month) && header.includes(String(period.year)));
      if (exact >= 0) return exact;
      const monthOnly = headers.findIndex(header => header.includes("BP") && header.includes("UPTO") && header.includes(period.month));
      return monthOnly >= 0 ? monthOnly : -1;
    }
    function colIndex(headers, needles) {
      const upper = needles.map(cleanHeader);
      const idx = headers.findIndex(header => upper.every(needle => header.includes(needle)));
      if (idx < 0) throw new Error("Missing column: " + needles.join(" "));
      return idx;
    }
    function rowsFromWorkbook(workbook) {
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }).filter(row => row.some(cell => String(cell).trim()));
      const headerIndex = raw.findIndex(row => cleanHeader(row[0]) === "AU");
      if (headerIndex < 0) throw new Error("AU header row not found");
      return { headers: raw[headerIndex].map(cleanHeader), rows: raw.slice(headerIndex + 1) };
    }
    function rawRowsFromSheet(workbook, sheetName) {
      return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" }).filter(row => row.some(cell => String(cell).trim()));
    }
    function looksLikeFrWorkbook(fileName, workbook) {
      if (/\bfr\b|fund|plan/i.test(fileName)) return true;
      return workbook.SheetNames.some(name => rawRowsFromSheet(workbook, name).slice(0, 12).some(row => row.map(cleanHeader).join(" ").includes("PLAN")));
    }
    function htmlEscape(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
    }
    function buildFrHtmlFromWorkbook(workbook, fileName) {
      const sections = workbook.SheetNames.map(sheetName => {
        const rows = rawRowsFromSheet(workbook, sheetName);
        const tableRows = rows.map((row, index) => {
          const tag = index < 3 ? "th" : "td";
          return `<tr>${row.map(cell => `<${tag}>${htmlEscape(cell)}</${tag}>`).join("")}</tr>`;
        }).join("");
        return `<section class="fr-sheet"><h2>${htmlEscape(sheetName)}</h2><table>${tableRows}</table></section>`;
      }).join("");
      return `<!doctype html><html><head><meta charset="utf-8"><title>FR Budget Status - ${htmlEscape(fileName)}</title><style>
        body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#eef2f6;color:#17212b}
        .wrap{width:min(1500px,calc(100vw - 24px));margin:14px auto 28px}
        h1{margin:0 0 12px;text-align:center;color:#1f4e79}
        h2{margin:18px 0 8px;color:#1f4e79}
        .note{font-weight:700;margin:0 0 10px}
        table{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;table-layout:auto;font-size:12px;background:white}
        th,td{border:1px solid #aebdca;padding:5px 6px;text-align:left;vertical-align:middle;white-space:nowrap}
        th{position:sticky;top:0;z-index:3;background:#1f4e79;color:white;font-weight:700}
        tr:nth-child(even) td{background:#edf4f8}
      </style></head><body><main class="wrap"><h1>FR Budget Status</h1><div class="note">Source: ${htmlEscape(fileName)}. Figures as available in uploaded workbook.</div>${sections}</main></body></html>`;
    }
    function senseRole(fileName, headers) {
      const joined = headers.join(" | ");
      const hasPu = headers.includes("PUCODE");
      const hasSmh = headers.includes("SMH");
      if (hasPu && joined.includes("RG 2025-2026")) return "prevPuBudget";
      if (hasSmh && !hasPu && joined.includes("RG 2025-2026")) return "prevSmhBudget";
      if (hasPu && joined.includes("BG_ISL 2026-2027")) return "currPuBudget";
      if (hasSmh && !hasPu && joined.includes("BG_ISL 2026-2027")) return "currSmhBudget";
      if (hasPu && joined.includes("APR 2026")) return "currPuMonth";
      if (hasPu && joined.includes("APR 2025")) return "prevPuMonth";
      if (hasSmh && joined.includes("APR 2026")) return "currSmhMonth";
      if (hasSmh && joined.includes("APR 2025")) return "prevSmhMonth";
      return "unknown";
    }
    async function readUploadedFile(file, expectedRole, options = {}) {
      if (!file) return;
      const log = document.getElementById("uploadLog");
      if (log && /^Waiting/.test(log.textContent)) log.textContent = "Validation log:";
      setUploadStatus(expectedRole, "Parsing...", null);
        const lower = file.name.toLowerCase();
        try {
          if (lower.endsWith(".html") || lower.endsWith(".htm")) {
            if (expectedRole !== "fr") throw new Error("HTML upload is allowed only for FR Analysis.");
            const html = await file.text();
            window.parent?.postMessage({ type: "fr-html", name: file.name, html }, "*");
            UPLOAD_STATE.fr = { fileName: file.name, type: "html" };
            setUploadStatus(expectedRole, `Latest file selected: ${file.name}`, true);
            logUpload(`FR HTML accepted: ${file.name}`);
            return;
          }
          await ensureSheetJS();
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          if (looksLikeFrWorkbook(file.name, workbook)) {
            if (expectedRole !== "fr") throw new Error("This looks like an FR file. Please upload it in FR Analysis slot.");
            const html = buildFrHtmlFromWorkbook(workbook, file.name);
            window.parent?.postMessage({ type: "fr-html", name: file.name, html }, "*");
            UPLOAD_STATE.fr = { fileName: file.name, type: "excel" };
            setUploadStatus(expectedRole, `Latest file selected: ${file.name}`, true);
            logUpload(`FR Excel accepted: ${file.name}`);
            return;
          }
          let parsed = null;
          try {
            parsed = rowsFromWorkbook(workbook);
          } catch (parseError) {
            if (CALCULATION_UPLOAD_ROLES.has(expectedRole)) throw parseError;
            UPLOAD_STATE[expectedRole] = { fileName: file.name, type: "excel", storageOnly: true };
            if (options.keepFile && CURRENT_YEAR_UPLOAD_REQUIRED.has(expectedRole)) UPLOAD_FILES[expectedRole] = file;
            setUploadStatus(expectedRole, `Latest file selected for storage: ${file.name}`, true);
            if (!options.quiet) logUpload(`${file.name} -> ${expectedRole} stored for source archive; calculation parser not applied.`);
            return;
          }
          const role = senseRole(file.name, parsed.headers);
          if (!parsedRoleMatchesExpected(role, expectedRole)) throw new Error(`Sensed as ${role}, expected ${expectedRole}.`);
          UPLOAD_STATE[expectedRole] = parsed;
          if (options.keepFile && CURRENT_YEAR_UPLOAD_REQUIRED.has(expectedRole)) UPLOAD_FILES[expectedRole] = file;
          setUploadStatus(expectedRole, `Latest file selected: ${file.name}`, true);
          if (!options.quiet) logUpload(`${file.name} -> ${expectedRole}`);
        } catch (error) {
          delete UPLOAD_STATE[expectedRole];
          delete UPLOAD_FILES[expectedRole];
          setUploadStatus(expectedRole, `ERROR: ${error.message}`, false);
          logUpload(`${file.name} -> ERROR: ${error.message}`);
        }
    }
    function numberValue(value) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
    function rgMap(table, field) {
      const nameIdx = colIndex(table.headers, [field]);
      const rgIdx = colIndex(table.headers, ["RG", "2025-2026"]);
      const out = {};
      table.rows.forEach(row => { const name = String(row[nameIdx] || "").trim(); if (name && name.toUpperCase() !== "TOTAL") out[name] = numberValue(row[rgIdx]); });
      return out;
    }
    function actualMaps(table, field) {
      const nameIdx = colIndex(table.headers, [field]);
      const period = detectActualPeriod(table.headers);
      const currIdx = period.idx;
      const prevIdx = findCoppyForPeriod(table.headers, period);
      const current = {}, previous = {};
      table.rows.forEach(row => { const name = String(row[nameIdx] || "").trim(); if (name && name.toUpperCase() !== "TOTAL") { current[name] = numberValue(row[currIdx]); previous[name] = numberValue(row[prevIdx]); } });
      return { current, previous, period };
    }
    function monthMap(table, field, months) {
      const nameIdx = colIndex(table.headers, [field]);
      const monthIdx = months.map(month => colIndex(table.headers, [month]));
      const out = {};
      table.rows.forEach(row => { const name = String(row[nameIdx] || "").trim(); if (name && name.toUpperCase() !== "TOTAL") out[name] = monthIdx.reduce((sum, idx) => sum + numberValue(row[idx]), 0); });
      return out;
    }
    function summaryRow(label, oba, ae, months = 3, bpOverride = null) {
      const bp = bpOverride === null || bpOverride === undefined ? oba / 12 * months : numberValue(bpOverride);
      return { Name: label, OBA: oba, BP: bp, AE: ae, Variation: ae - bp, BPPercent: bp ? ae / bp * 100 : 0, Remaining: oba - ae, OBAPercent: oba ? ae / oba * 100 : 0 };
    }
    function bgIslMap(table, field) {
      const nameIdx = colIndex(table.headers, [field]);
      const bgIdx = colIndex(table.headers, ["BG_ISL", "2026-2027"]);
      const out = {};
      table.rows.forEach(row => { const name = String(row[nameIdx] || "").trim(); if (name && name.toUpperCase() !== "TOTAL") out[name] = numberValue(row[bgIdx]); });
      return out;
    }
    function prevRow(label, previousOba, currentOba, aeCurrent, aePrevious, months = 3) {
      const previousBp = previousOba / 12 * months;
      const bp = currentOba / 12 * months;
      return { Name: label, PreviousOBA: previousOba, PreviousBP: previousBp, AEPrevious: aePrevious, OBA: currentOba, BP: bp, AECurrent: aeCurrent, VariationBP: aeCurrent - bp, BPPercent: bp ? aeCurrent / bp * 100 : 0, VariationActual: aeCurrent - aePrevious, OBAPercent: currentOba ? aeCurrent / currentOba * 100 : 0 };
    }
    function addTotal(rows, previous=false) {
      const normalRows = normalTotalRows(rows);
      const suspenseRows = demandSuspenseRows(rows);
      const months = normalRows[0]?.Months || rows[0]?.Months || 3;
      const oba = normalRows.reduce((sum, row) => sum + numberValue(row.OBA), 0);
      if (previous) return normalRows.concat(prevRow("Total", normalRows.reduce((sum, row) => sum + numberValue(row.PreviousOBA), 0), oba, normalRows.reduce((s, r) => s + numberValue(r.AECurrent), 0), normalRows.reduce((s, r) => s + numberValue(r.AEPrevious), 0), months), suspenseRows);
      return normalRows.concat(summaryRow("Total", oba, normalRows.reduce((sum, row) => sum + numberValue(row.AE), 0), months, normalRows.reduce((sum, row) => sum + numberValue(row.BP), 0)), suspenseRows);
    }
    function buildCurrentFromUpload(table, field, firstLabel, title, demand=false) {
      const nameIdx = colIndex(table.headers, [field]);
      const obaIdx = colIndex(table.headers, ["BG_ISL", "2026-2027"]);
      const period = detectActualPeriod(table.headers);
      const aeIdx = period.idx;
      const bpIdx = findBpForPeriod(table.headers, period);
      const bpLabel = bpIdx >= 0 ? `B\nBP\n${table.headers[bpIdx]}` : `B\nBP\nA / 12 * ${period.count}`;
      const columns = [
        { key:"Name", label:firstLabel, format:"text" }, ...(demand ? [{ key:"Department", label:"Department", format:"text" }] : []), { key:"OBA", label:"A\nOBA\nBG_ISL 2026-27", format:"money" },
        { key:"BP", label:bpLabel, format:"money" }, { key:"AE", label:`C\nAE\nActuals Upto ${period.label}`, format:"money" },
        { key:"Variation", label:"D\nVariation\nC - B", format:"money" }, { key:"BPPercent", label:"E\n% BP\nC / B", format:"int" },
        { key:"Remaining", label:"F\nBudget Remaining\nA - C", format:"money" }, { key:"OBAPercent", label:"G\n% OBA Utilized\nC / A", format:"int" }
      ];
      const rows = table.rows.map(row => {
        const name = String(row[nameIdx] || "").trim();
        if (!name || name.toUpperCase() === "TOTAL") return null;
        const built = summaryRow(demand ? demandFromSmh(name) : name, numberValue(row[obaIdx]), numberValue(row[aeIdx]), period.count, bpIdx >= 0 ? row[bpIdx] : null);
        built.Months = period.count;
        return demand ? withDemandDepartment(built) : built;
      }).filter(Boolean);
      return { title, columns, rows: addTotal(rows) };
    }
    function buildPreviousFromUpload(prevBudget, currBudget, field, firstLabel, title, demand=false) {
      const rg = rgMap(prevBudget, field);
      const bg = bgIslMap(currBudget, field);
      const actual = actualMaps(currBudget, field);
      const period = actual.period;
      const previousLabel = `${period.month} ${period.year - 1}`;
      const columns = [
        { key:"Name", label:firstLabel, format:"text" }, ...(demand ? [{ key:"Department", label:"Department", format:"text" }] : []), { key:"PreviousOBA", label:"A\nPrevious OBA\nRG 2025-26", format:"money" },
        { key:"PreviousBP", label:`B\nPrevious Budget Proportion\nA / 12 * ${period.count}`, format:"money" }, { key:"AEPrevious", label:`C\nPrevious Actual Expenditure\nUpto ${previousLabel}`, format:"money" },
        { key:"OBA", label:"D\nCurrent OBA\nBG_ISL 2026-27", format:"money" }, { key:"BP", label:`E\nCurrent Budget Proportion\nD / 12 * ${period.count}`, format:"money" },
        { key:"AECurrent", label:`F\nCurrent Actual Expenditure\nUpto ${period.label}`, format:"money" }, { key:"VariationBP", label:"G\nBudget Variation\nF - E", format:"money" },
        { key:"BPPercent", label:"H\nCurrent Budget Proportion %\nF / E", format:"int" }, { key:"VariationActual", label:"I\nActual Expenditure Variation\nF - C", format:"money" },
        { key:"OBAPercent", label:"J\nCurrent OBA Utilization %\nF / D", format:"int" }
      ];
      const rows = Object.keys(rg).map(name => {
        const built = prevRow(demand ? demandFromSmh(name) : name, rg[name], bg[name] || 0, actual.current[name] || 0, actual.previous[name] || 0, period.count);
        built.Months = period.count;
        return demand ? withDemandDepartment(built) : built;
      });
      return { title, columns, rows: addTotal(rows, true) };
    }
    async function applyUploadedData(options = {}) {
      try {
        const requiredCurrent = ["currPuBudget", "currSmhBudget"];
        const missingCurrent = requiredCurrent.filter(role => !UPLOAD_STATE[role]);
        if (missingCurrent.length) {
          missingCurrent.forEach(role => setUploadStatus(role, "Upload latest file before verify", false));
          throw new Error("Required current-year uploads missing: " + missingCurrent.map(roleLabel).join(", "));
        }
        await ensureStaticPreviousSources();
        if (UPLOAD_STATE.currSmhBudget) DATA.demand = buildCurrentFromUpload(UPLOAD_STATE.currSmhBudget, "SMH", "Demand No. / SMH-Grant", "Demand / SMH Wise Current Year", true);
        if (UPLOAD_STATE.currPuBudget) {
          const puCurrent = buildCurrentFromUpload(UPLOAD_STATE.currPuBudget, "PUCODE", "PU", "PU Wise Current Year", false);
          const all = puCurrent.rows.filter(row => row.Name !== "Total");
          DATA.staff = { title: "PU Staff Current Year", columns: puCurrent.columns, rows: addTotal(all.filter(row => STAFF_CODES.has(codeFromLabel(row.Name, "PU")))) };
          DATA.nonstaff = { title: "PU Non-Staff Current Year", columns: puCurrent.columns, rows: addTotal(all.filter(row => !STAFF_CODES.has(codeFromLabel(row.Name, "PU")))) };
        }
        if (UPLOAD_STATE.prevPuBudget && UPLOAD_STATE.currPuBudget) DATA.pu_prev = buildPreviousFromUpload(UPLOAD_STATE.prevPuBudget, UPLOAD_STATE.currPuBudget, "PUCODE", "PU", "PU Wise Previous Year Comparison");
        if (UPLOAD_STATE.prevSmhBudget && UPLOAD_STATE.currSmhBudget) DATA.demand_prev = buildPreviousFromUpload(UPLOAD_STATE.prevSmhBudget, UPLOAD_STATE.currSmhBudget, "SMH", "Demand No. / SMH-Grant", "Demand / SMH Wise Previous Year Comparison", true);
        ORIGINAL_DATA = JSON.parse(JSON.stringify(DATA || {}));
        applyCompletedPeriodView();
        logUpload("Tables updated in this browser session. Default view now uses completed JUN 2026 actuals with 03-month BP projection. July running data is available in Till Date / Running Month.");
        if (options.stayOnUpload) {
          document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === "upload"));
          return;
        }
        render("demand");
      } catch (error) {
        logUpload("Update failed: " + error.message);
      }
    }
    function requestUploadPassword() {
      if (uploadUnlocked) return true;
      const entered = window.prompt("Enter password to open Upload Data");
      if (entered === UPLOAD_PASSWORD) { uploadUnlocked = true; return true; }
      if (entered !== null) window.alert("Incorrect password.");
      return false;
    }
    function exportFileName(prefix, extension) {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      return `${prefix}_${stamp}.${extension}`;
    }
    function downloadHtmlFile(html, fileName, mimeType) {
      const blob = new Blob([html], { type: mimeType });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(link.href);
      link.remove();
    }
    function exportTableHtml(tabKey) {
      const tab = tableForView(tabKey, { skipFocus: true });
      if (!tab?.rows?.length) return "";
      const headers = tab.columns.map(col => `<th>${htmlEscape(String(col.label || "").replace(/\n/g, " "))}</th>`).join("");
      const note = isDemandTable(tabKey) ? demandSuspenseNoteHtml(tab.rows) : "";
      const rows = tab.rows.map(row => `<tr class="${rowClassName(row)}">${tab.columns.map(col => `<td>${col.key === "OBAPercent" || col.key === "BPPercent" ? alertDotHtml(row[col.key]) : ""}${formatCellHtml(row[col.key], col.format)}</td>`).join("")}</tr>`).join("");
      return `<section class="export-section"><h2>${htmlEscape(tab.title)}</h2>${note}<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></section>`;
    }
    function sheetName(name, fallback = "Sheet") {
      const cleaned = String(name || fallback).replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim();
      return (cleaned || fallback).slice(0, 31);
    }
    function cellValue(row, col) {
      if (col.format === "money" || col.format === "int" || col.format === "percent") {
        const n = Number(row[col.key]);
        return Number.isFinite(n) ? n : "";
      }
      return row[col.key] ?? "";
    }
    function exportNote() {
      return "Remarks - Figures in '000' (thousands). Default basis: completed actuals up to JUN 2026; Till Date / Running Month keeps running-month data separately. Demand 12N / 10N is shown separately and excluded from main totals.";
    }
    function exportTableAoa(tabKey) {
      const tab = tableForView(tabKey, { skipFocus: true });
      if (!tab?.rows?.length) return null;
      return {
        title: tab.title,
        rows: [
          [tab.title],
          [exportNote()],
          ["Source view follows portal sequence and formatting for PPT verification."],
          tab.columns.map(col => String(col.label || "").replace(/\n/g, " ")),
          ...tab.rows.map(row => tab.columns.map(col => cellValue(row, col))),
        ],
      };
    }
    function analysisExportAoa() {
      const rows = [["Analysis View"], [exportNote()], ["Summary of all Current / Previous Analysis portal tables."], ["Table", "Rows", "OBA / RG", "BP", "AE / Current Actual", "% OBA", "% BP"]];
      TAB_ORDER.forEach(key => {
        const tab = DATA[key];
        const total = totalRow(tab);
        rows.push([
          tab.title,
          normalTotalRows(tab.rows || []).length,
          numericValue(total, ["OBA", "PreviousOBA"]),
          numericValue(total, ["BP"]),
          numericValue(total, ["AE", "CurrentAE"]),
          numericValue(total, ["OBAPercent"]),
          numericValue(total, ["BPPercent"]),
        ]);
      });
      return rows;
    }
    function columnLetter(index) {
      let text = "";
      for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) text = String.fromCharCode(65 + ((n - 1) % 26)) + text;
      return text;
    }
    function exportColumnWidth(rows, index) {
      const maxLength = rows.reduce((max, row) => Math.max(max, String(row?.[index] ?? "").length), 0);
      return Math.max(index === 0 ? 28 : 11, Math.min(index === 0 ? 42 : 22, maxLength + 2));
    }
    function decorateAoaSheet(sheet, rows, headerRowIndex = 3) {
      const colCount = Math.max(1, ...rows.map(row => row.length));
      const lastCol = columnLetter(colCount - 1);
      const lastRow = Math.max(rows.length, headerRowIndex + 1);
      sheet["!cols"] = Array.from({ length: colCount }, (_, index) => ({ wch: exportColumnWidth(rows, index) }));
      sheet["!rows"] = rows.map((_, index) => ({ hpt: index === 0 ? 24 : index === headerRowIndex ? 21 : 18 }));
      sheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
      ];
      sheet["!autofilter"] = { ref: `A${headerRowIndex + 1}:${lastCol}${lastRow}` };
      sheet["!freeze"] = { xSplit: 0, ySplit: headerRowIndex + 1 };
    }
    function appendAoaSheet(workbook, name, rows) {
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      decorateAoaSheet(sheet, rows);
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName(name));
    }
    function currentExportStyles(mode) {
      return `<style>
        @page{size:A4 landscape;margin:.25in}
        *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:Arial,sans-serif;color:#17212b;margin:0;background:#fff}
        main{width:100%;margin:0 auto}
        h1{font-size:20px;text-align:center;margin:0 0 4px;color:#1f4e79}
        h2{font-size:14px;margin:8px 0 5px;color:#1f4e79}
        .meta{font-size:9.5px;text-align:right;margin:0 0 7px;font-weight:700}
        .export-cover{min-height:180mm;display:grid;place-items:center;text-align:center;break-after:page;page-break-after:always;border:2px solid #1f4e79;padding:14mm;box-sizing:border-box}
        .export-cover h1{font-size:24px;margin:0 0 8px;color:#1f4e79}
        .cover-meta{font-size:12px;line-height:1.5;font-weight:700;color:#17212b}
        .cover-list{font-size:11px;line-height:1.45;color:#405060;margin-top:10px}
        .export-section{break-after:page;page-break-after:always;padding-top:1mm}
        .export-section:last-child{break-after:auto;page-break-after:auto}
        table{width:100%;border-collapse:collapse;font-size:8.2px;table-layout:fixed}
        thead{display:table-header-group}
        tfoot{display:table-footer-group}
        tr{break-inside:avoid;page-break-inside:avoid}
        th,td{border:1px solid #000000;padding:2px 3px;vertical-align:middle;white-space:normal;word-break:break-word;overflow-wrap:anywhere}
        th{background:#1f4e79;color:#fff;text-align:center}
        td{text-align:right}
        td:first-child,th:first-child{text-align:left}
        tbody tr:nth-child(even) td{background:#e8f2f8}
        tr.total td{background:#c8d6e8;font-weight:700}
        tr.important td,tr.important-pu td{background:#fff4cc;font-weight:700}
        tr.special-demand td{background:#fff1f1!important;color:#7a1f1f;font-weight:700}
        .dual-money{display:block;text-align:right;line-height:1.08;font-family:"Times New Roman",Times,serif;font-variant-numeric:tabular-nums}
        .dual-money span{display:block}
        .dual-money .thousand{font-size:12px;font-weight:700;font-family:"Times New Roman",Times,serif}
        .dual-money .crore{margin-top:1px;font-size:9.5px;font-family:"Times New Roman",Times,serif;opacity:.82}
        .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle;box-shadow:0 0 0 1px rgba(0,0,0,.12)}
        .dot.green{background:#25a55b}.dot.yellow{background:#f2c230}.dot.red{background:#d92323}
        .finance-summary,.risk-rail{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0 0 7px}
        .finance-card,.risk-tile,.analysis-panel,.protected-panel,.special-demand-panel{border:1px solid #c8d6e2;background:#fff;padding:6px;margin:0 0 7px}
        .finance-card span,.risk-tile span{display:block;color:#607080;font-size:9px;font-weight:700;text-transform:uppercase}
        .finance-card strong,.risk-tile strong{display:block;color:#1f4e79;font-size:12px}
        .finance-card .dual-money,.metric-row .dual-money{text-align:left}
        .bar-track,.track{height:10px;background:#edf4f8;border:1px solid #dbe6ee}
        .bar-fill,.fill{height:100%;background:#1f4e79}
        .analysis-toolbar,.analysis-view-tabs,.attention-strip,.pu-focus,.compare-toolbar,.actions,.tabs,.topbar,.note.analysis-note{display:none!important}
        .analysis-copy{margin-top:0;break-before:page;page-break-before:always}
        .analysis-copy .note{display:none}
        .analysis-copy table{margin-bottom:10px}
        ${mode === "excel" ? ".export-cover{display:none}.export-section{page-break-after:auto}.analysis-copy{page-break-before:auto}" : ""}
      </style>`;
    }
    function currentExportDocument(mode) {
      const tables = TAB_ORDER.map(exportTableHtml).join("");
      const currentTab = activeTab;
      renderAnalysis();
      const analysisHtml = document.getElementById("tableHost").innerHTML;
      render(currentTab);
      const generatedAt = new Date().toLocaleString("en-IN");
      const cover = `<section class="export-cover"><div><h1>Current / Previous Year PU and Demand Analysis</h1><div class="cover-meta">${exportNote()}<br>Generated ${generatedAt}</div><div class="cover-list">Includes Demand / SMH, PU Staff, PU Non-Staff, previous-year comparisons, current-year tables and Analysis View in portal sequence.</div></div></section>`;
      return `<!doctype html><html><head><meta charset="utf-8"><title>Current Previous Analysis Export</title>${currentExportStyles(mode)}</head><body><main>${cover}<h1>Current / Previous Year PU and Demand Analysis</h1><p class="meta">${exportNote()} Generated ${generatedAt}.</p>${tables}<section class="analysis-copy"><h2>Analysis View</h2>${analysisHtml}</section></main></body></html>`;
    }
    function xlsxText(value) { return String(value ?? ""); }
    function xlsxMoneyText(value) { return `${formatNumber(value)}\n${formatCrore(Number(value || 0) / 10000)} Cr`; }
    function xlsxCell(value, style = "normal", rich = null) { return { value: value ?? "", style, rich }; }
    function xlsxRunColor(style) {
      if (String(style).includes("Bad") || style === "bad" || style === "special") return "FFA13131";
      if (String(style).includes("Good") || style === "good") return "FF126A3A";
      return "";
    }
    function xlsxAlertColor(value) {
      return { green:"FF25A55B", yellow:"FFF2C230", red:"FFD92323" }[utilizationClass(value)] || "FF25A55B";
    }
    function xlsxMoneyCell(value, style = "normal") {
      const main = formatNumber(value);
      const cr = `${formatCrore(Number(value || 0) / 10000)} Cr`;
      const color = xlsxRunColor(style);
      return xlsxCell(`${main}\n${cr}`, style, [
        { text: main, size: 11, color },
        { text: "\n" },
        { text: cr, size: 9, color }
      ]);
    }
    function xlsxAlertCell(value, style = "normal", format = "int") {
      const shown = formatCell(value, format);
      return xlsxCell(`● ${shown}`, style, [
        { text: "●", size: 11, color: xlsxAlertColor(value) },
        { text: ` ${shown}`, size: 11 }
      ]);
    }
    function xlsxFinancialStyle(value, base = "normal") {
      if (Number(value || 0) < 0) return base === "total" ? "totalBad" : "bad";
      if (Number(value || 0) > 0) return base === "total" ? "totalGood" : "good";
      return base;
    }
    function currentTableRows(tabKey) {
      const tab = tableForView(tabKey, { skipFocus: true });
      if (!tab?.rows?.length) return null;
      const rows = [
        [xlsxCell(tab.title, "title")],
        [xlsxCell(exportNote(), "meta")],
        [xlsxCell("Source view follows portal display: values in '000 with Crore below.", "meta")],
        tab.columns.map(col => xlsxCell(String(col.label || "").replace(/\n/g, " "), "header"))
      ];
      tab.rows.forEach((row, index) => {
        const isTotal = isTotalRow(row);
        const isImportant = isImportantPuRow(row);
        const isSpecial = isDemandSuspenseRow(row);
        const base = isTotal ? "total" : isSpecial ? "special" : isImportant ? "important" : index % 2 ? "alt" : "normal";
        rows.push(tab.columns.map(col => {
          const value = row[col.key];
          if (col.format === "money") return xlsxMoneyCell(value, xlsxFinancialStyle(value, base));
          if (col.key === "OBAPercent" || col.key === "BPPercent") return xlsxAlertCell(value, base, col.format);
          if (col.format === "int" || col.format === "percent") return xlsxCell(formatCell(value, col.format), base);
          return xlsxCell(xlsxText(value), base);
        }));
      });
      return { title: tab.title, rows };
    }
    function analysisSummaryRows() {
      const rows = [[xlsxCell("Analysis View", "title")], [xlsxCell(exportNote(), "meta")], [xlsxCell("Summary of all Current / Previous Analysis portal tables.", "meta")], ["Table", "Rows", "OBA / RG", "BP", "AE / Current Actual", "% OBA", "% BP"].map(label => xlsxCell(label, "header"))];
      TAB_ORDER.forEach((key, index) => {
        const tab = DATA[key];
        const total = totalRow(tab);
        const base = index % 2 ? "alt" : "normal";
        rows.push([
          xlsxCell(tab.title, base),
          xlsxCell(normalTotalRows(tab.rows || []).length, base),
          xlsxMoneyCell(numericValue(total, ["OBA", "PreviousOBA"]), base),
          xlsxMoneyCell(numericValue(total, ["BP"]), base),
          xlsxMoneyCell(numericValue(total, ["AE", "CurrentAE"]), base),
          xlsxAlertCell(numericValue(total, ["OBAPercent"]), base, "percent"),
          xlsxAlertCell(numericValue(total, ["BPPercent"]), base, "percent")
        ]);
      });
      return rows;
    }
    function xmlEscape(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" }[char])); }
    function xlsxSheetName(name) { return String(name || "Sheet").replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet"; }
    function xlsxColumnName(index) {
      let text = "";
      for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) text = String.fromCharCode(65 + ((n - 1) % 26)) + text;
      return text;
    }
    const xlsxStyleIndex = { normal:0, header:1, title:2, meta:3, alt:4, total:5, important:6, special:7, good:8, bad:9, totalGood:10, totalBad:11 };
    function xlsxCellWidth(cell) { return Math.max(...String(cell?.value ?? "").split("\n").map(part => part.length), 4); }
    function xlsxWorksheetCols(rows) {
      const maxCols = Math.max(1, ...rows.map(row => row.length));
      return Array.from({ length:maxCols }, (_, index) => {
        const maxText = rows.reduce((max, row) => Math.max(max, xlsxCellWidth(row[index])), 0);
        const width = Math.max(index === 0 ? 18 : 11, Math.min(index === 0 ? 42 : 18, maxText + 2));
        return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
      }).join("");
    }
    function xlsxRichTextXml(cell) {
      if (!cell.rich) return `<is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is>`;
      const runs = cell.rich.map(run => {
        const props = [run.size ? `<sz val="${run.size}"/>` : "", run.color ? `<color rgb="${run.color}"/>` : "", `<rFont val="Times New Roman"/>`].join("");
        return `<r><rPr>${props}</rPr><t xml:space="preserve">${xmlEscape(run.text)}</t></r>`;
      }).join("");
      return `<is>${runs}</is>`;
    }
    function xlsxWorksheetXml(rows) {
      const cols = xlsxWorksheetCols(rows);
      const sheetRows = rows.map((row, rIndex) => {
        const cells = row.map((cell, cIndex) => {
          const ref = `${xlsxColumnName(cIndex)}${rIndex + 1}`;
          return `<c r="${ref}" t="inlineStr" s="${xlsxStyleIndex[cell.style] ?? 0}">${xlsxRichTextXml(cell)}</c>`;
        }).join("");
        const height = rIndex < 4 ? 22 : 30;
        return `<row r="${rIndex + 1}" ht="${height}" customHeight="1">${cells}</row>`;
      }).join("");
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><cols>${cols}</cols><sheetData>${sheetRows}</sheetData><pageMargins left="0.25" right="0.25" top="0.25" bottom="0.25" header="0.1" footer="0.1"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    }
    function xlsxStylesXml() {
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="7"><font><sz val="11"/><name val="Times New Roman"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Times New Roman"/></font><font><b/><color rgb="FF1F4E79"/><sz val="14"/><name val="Times New Roman"/></font><font><b/><color rgb="FF607080"/><sz val="10"/><name val="Times New Roman"/></font><font><b/><sz val="11"/><name val="Times New Roman"/></font><font><color rgb="FF126A3A"/><sz val="11"/><name val="Times New Roman"/></font><font><color rgb="FFA13131"/><sz val="11"/><name val="Times New Roman"/></font></fonts><fills count="9"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F2F8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC8D6E8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4CC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1F1"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FBFD"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF163B5C"/></patternFill></fill></fills><borders count="1"><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="12"><xf fontId="0" fillId="7" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf><xf fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="4" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="4" fillId="5" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="6" fillId="6" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="5" fillId="7" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="6" fillId="7" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="5" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="6" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    }
    function xlsxCrc32(bytes) {
      const table = xlsxCrc32.table || (xlsxCrc32.table = Array.from({ length:256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
      let crc = -1;
      for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
      return (crc ^ -1) >>> 0;
    }
    function xlsxZip(files) {
      const encoder = new TextEncoder();
      const chunks = [];
      const central = [];
      let offset = 0;
      const u16 = value => [value & 255, value >>> 8 & 255];
      const u32 = value => [value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255];
      files.forEach(file => {
        const name = encoder.encode(file.name);
        const data = encoder.encode(file.content);
        const crc = xlsxCrc32(data);
        const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name, ...data]);
        chunks.push(local);
        central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
        offset += local.length;
      });
      const centralSize = central.reduce((sum, part) => sum + part.length, 0);
      const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
      return new Blob([...chunks, ...central, end], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    }
    function xlsxWorkbookXml(sheetNames) {
      const sheets = sheetNames.map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
    }
    function xlsxWorkbookRelsXml(sheetNames) {
      const sheetRels = sheetNames.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheetNames.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    }
    function xlsxContentTypesXml(sheetNames) {
      const sheets = sheetNames.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets}</Types>`;
    }
    function currentWorkbookBlob() {
      const sections = TAB_ORDER.map(currentTableRows).filter(Boolean);
      sections.push({ title:"Analysis View", rows:analysisSummaryRows() });
      const sheetNames = sections.map(section => xlsxSheetName(section.title));
      const files = [
        { name:"[Content_Types].xml", content:xlsxContentTypesXml(sheetNames) },
        { name:"_rels/.rels", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
        { name:"xl/workbook.xml", content:xlsxWorkbookXml(sheetNames) },
        { name:"xl/_rels/workbook.xml.rels", content:xlsxWorkbookRelsXml(sheetNames) },
        { name:"xl/styles.xml", content:xlsxStylesXml() },
        ...sections.map((section, index) => ({ name:`xl/worksheets/sheet${index + 1}.xml`, content:xlsxWorksheetXml(section.rows) }))
      ];
      return xlsxZip(files);
    }
    async function exportCurrentExcel() {
      const blob = currentWorkbookBlob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = exportFileName("Current_Previous_Year_PU_Demand_Analysis", "xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    }
    function exportCurrentPdf() {
      const win = window.open("", "_blank");
      if (!win) { window.alert("Please allow popups to generate PDF."); return; }
      win.document.open();
      win.document.write(currentExportDocument("pdf"));
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 350);
    }
    function openTab(tabKey) {
      if (tabKey === "upload" && !requestUploadPassword()) return;
      render(tabKey);
    }
    document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => openTab(btn.dataset.tab)));
    document.getElementById("exportExcel")?.addEventListener("click", exportCurrentExcel);
    document.getElementById("exportPdf")?.addEventListener("click", exportCurrentPdf);
    document.getElementById("tableHost")?.addEventListener("change", event => {
      const control = event.target.closest("[data-analysis-filter]");
      if (!control) return;
      analysisState[control.dataset.analysisFilter] = control.value;
      renderAnalysis();
    });
    document.getElementById("tableHost")?.addEventListener("click", event => {
      const viewButton = event.target.closest("[data-analysis-view]");
      if (viewButton) {
        analysisState.view = viewButton.dataset.analysisView;
        renderAnalysis();
        return;
      }
      const unlockButton = event.target.closest("[data-unlock-analysis-logic]");
      if (unlockButton) {
        if (requestUploadPassword()) {
          analysisState.logicUnlocked = true;
          analysisState.view = "sources";
          renderAnalysis();
        }
        return;
      }
      const pill = event.target.closest("[data-analysis-attention]");
      if (!pill) return;
      analysisState.attention = pill.dataset.analysisAttention;
      analysisState.view = "alerts";
      renderAnalysis();
    });
    window.addEventListener("message", event => { if (event.data?.type === "open-current-tab" && (DATA[event.data.tab] || event.data.tab === "analysis")) render(event.data.tab); });
    render(activeTab);











