const SHEETJS_SRC = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    let DATA = window.CURRENT_PAYLOAD || {};
    const DATA_SOURCE_CONFIG = window.YEAR_DATA_SOURCES || {};
    let TAB_ORDER = ["demand", "staff", "nonstaff", "pu_prev", "demand_prev"].filter(key => DATA[key]);
    const STAFF_CODES = new Set(["01", "02", "03", "04", "07", "08", "10", "11", "12", "13", "14", "15", "16", "17", "20", "25", "26", "29", "34", "39", "40", "42", "43", "44", "53", "54", "63"]);
    const UPLOAD_PASSWORD = "Moradabad@2026";
    const UPLOAD_STATE = {};
    let activeTab = "demand";
    let prevPuMode = "all";
    const compareState = { entity:"pu", years:"1", metric:"ae", chart:"bar", item:"__total" };
    let uploadUnlocked = false;
    function formatNumber(value, decimals = 0) { return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
    function formatCell(value, format) { if (format === "money") return formatNumber(value); if (format === "int") return Math.round(Number(value || 0)).toLocaleString("en-IN"); return value ?? ""; }
    function splitHeader(label) {
      const parts = String(label || "").split("\n");
      if (parts.length > 1 && /^[A-Z]$/.test(parts[0])) return { letter: parts[0], text: parts.slice(1).join("\n") };
      return { letter: "", text: label || "" };
    }
    function render(tabKey) {
      activeTab = tabKey;
      if (tabKey === "upload") { renderUpload(); return; }
      if (tabKey === "analysis") { renderAnalysis(); return; }
      const tab = tableForView(tabKey);
      document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabKey));
      if (!tab || !tab.rows || !tab.rows.length) {
        document.getElementById("title").textContent = tab?.title || "Data Not Available";
        document.getElementById("tableHost").innerHTML = '<div class="empty-warning">Required table data is not available for this tab. Please upload or rebuild the source data.</div>';
        return;
      }
      document.getElementById("title").textContent = tab.title;
      const subMenu = tabKey === "pu_prev" ? renderPrevPuSubtabs() : null;
      const note = document.createElement("div"); note.className = "note"; note.textContent = tabKey === "pu_prev" || tabKey === "demand_prev" ? "Remarks - Figures in '000' (thousands). Previous year RG is treated as OBA; current year BG_ISL is treated as OBA until current-year RG is available." : "Remarks - Figures in '000' (thousands)";
      const table = document.createElement("table");
      if (tab.columns.length > 8) table.className = "wide";
      const thead = document.createElement("thead"); const letterRow = document.createElement("tr"); letterRow.className = "letter-row"; const labelRow = document.createElement("tr");
      tab.columns.forEach(col => { const split = splitHeader(col.label); const letterTh = document.createElement("th"); letterTh.textContent = split.letter; letterRow.appendChild(letterTh); const labelTh = document.createElement("th"); labelTh.textContent = split.text; labelRow.appendChild(labelTh); });
      thead.appendChild(letterRow); thead.appendChild(labelRow); table.appendChild(thead);
      const tbody = document.createElement("tbody");
      tab.rows.forEach(row => { const tr = document.createElement("tr"); if (String(row.Name).toLowerCase() === "total") tr.className = "total"; tab.columns.forEach(col => { const td = document.createElement("td"); if (col.key === "OBAPercent" || col.key === "BPPercent") { const dot = document.createElement("span"); dot.className = "dot " + utilizationClass(row[col.key]); td.appendChild(dot); td.append(document.createTextNode(formatCell(row[col.key], col.format))); } else { td.textContent = formatCell(row[col.key], col.format); } tr.appendChild(td); }); tbody.appendChild(tr); });
      table.appendChild(tbody);
      const children = subMenu ? [subMenu, note, table] : [note, table];
      document.getElementById("tableHost").replaceChildren(...children);
    }
    function puCode(row) { return codeFromLabel(rowName(row), "PU"); }
    function tableForView(tabKey) {
      const tab = DATA[tabKey];
      if (tabKey !== "pu_prev" || !tab?.rows) return tab;
      if (prevPuMode === "all") return tab;
      const detailRows = tab.rows.filter(row => String(rowName(row)).toLowerCase() !== "total");
      const rows = detailRows.filter(row => prevPuMode === "staff" ? STAFF_CODES.has(puCode(row)) : !STAFF_CODES.has(puCode(row)));
      const suffix = prevPuMode === "staff" ? " - Staff" : " - Non-Staff";
      return { ...tab, title: tab.title + suffix, rows: addTotal(rows, true) };
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
    function analysisMetric(label, value, format = "money") {
      const shown = format === "percent" ? formatNumber(value, 2) + "%" : format === "int" ? Math.round(Number(value || 0)).toLocaleString("en-IN") : formatNumber(value);
      return `<div class="metric-row"><span>${label}</span><strong>${shown}</strong></div>`;
    }
    function compactTable(title, rows, columns) {
      const body = rows.length ? rows.map(item => `<tr>${columns.map(col => `<td>${col.format === "percent" ? `<span class="dot ${utilizationClass(item[col.key])}"></span>` : ""}${htmlEscape(formatCell(item[col.key], col.format))}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}">No alert items found.</td></tr>`;
      return `<section class="analysis-panel"><h3>${title}</h3><table><thead><tr>${columns.map(col => `<th>${htmlEscape(col.label)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></section>`;
    }
    function renderAnalysis() {
      document.getElementById("title").textContent = "Analysis View";
      document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === "analysis"));
      const cards = TAB_ORDER.map(key => {
        const tab = DATA[key];
        const total = totalRow(tab);
        const oba = numericValue(total, ["OBA", "PreviousOBA"]);
        const bp = numericValue(total, ["BP"]);
        const ae = numericValue(total, ["AE", "CurrentAE"]);
        const obaPct = numericValue(total, ["OBAPercent"]);
        const bpPct = numericValue(total, ["BPPercent"]);
        const rows = Math.max(0, (tab.rows || []).length - 1);
        return `<article class="analysis-card"><h3>${htmlEscape(tab.title)}</h3>${
          analysisMetric("Rows", rows, "int") +
          analysisMetric("OBA / RG", oba) +
          (bp ? analysisMetric("BP", bp) : "") +
          analysisMetric("AE / Current Actual", ae) +
          (bpPct ? analysisMetric("% BP", bpPct, "percent") : "") +
          (obaPct ? analysisMetric("% OBA", obaPct, "percent") : "")
        }</article>`;
      }).join("");
      const allRows = TAB_ORDER.flatMap(key => (DATA[key].rows || []).filter(row => String(rowName(row)).toLowerCase() !== "total").map(row => ({ ...row, Source: DATA[key].title, DisplayName: rowName(row) })));
      const highOba = allRows.filter(row => Math.abs(numericValue(row, ["OBAPercent"])) >= 90).sort((a,b) => Math.abs(numericValue(b, ["OBAPercent"])) - Math.abs(numericValue(a, ["OBAPercent"]))).slice(0, 12);
      const highBp = allRows.filter(row => Math.abs(numericValue(row, ["BPPercent"])) >= 90).sort((a,b) => Math.abs(numericValue(b, ["BPPercent"])) - Math.abs(numericValue(a, ["BPPercent"]))).slice(0, 12);
      const negativeBalance = allRows.filter(row => numericValue(row, ["BudgetRemaining"]) < 0).sort((a,b) => numericValue(a, ["BudgetRemaining"]) - numericValue(b, ["BudgetRemaining"])).slice(0, 12);
      const previousVariation = allRows.filter(row => "ActualVariation" in row).sort((a,b) => Math.abs(numericValue(b, ["ActualVariation"])) - Math.abs(numericValue(a, ["ActualVariation"]))).slice(0, 12);
      const panels = [
        compactTable("High OBA / RG Utilization", highOba, [{label:"Table", key:"Source"}, {label:"Item", key:"DisplayName"}, {label:"% OBA", key:"OBAPercent", format:"percent"}, {label:"AE", key:"AE", format:"money"}]),
        compactTable("High BP Utilization", highBp, [{label:"Table", key:"Source"}, {label:"Item", key:"DisplayName"}, {label:"% BP", key:"BPPercent", format:"percent"}, {label:"BP", key:"BP", format:"money"}, {label:"AE", key:"AE", format:"money"}]),
        compactTable("Budget Remaining Alerts", negativeBalance, [{label:"Table", key:"Source"}, {label:"Item", key:"DisplayName"}, {label:"Remaining", key:"BudgetRemaining", format:"money"}, {label:"AE", key:"AE", format:"money"}, {label:"OBA", key:"OBA", format:"money"}]),
        compactTable("Previous Year Variation Focus", previousVariation, [{label:"Table", key:"Source"}, {label:"Item", key:"DisplayName"}, {label:"Variation", key:"ActualVariation", format:"money"}, {label:"Current AE", key:"CurrentAE", format:"money"}, {label:"Previous AE", key:"PreviousAE", format:"money"}])
      ].join("");
      document.getElementById("tableHost").innerHTML = `<div class="note">Remarks - Figures in '000' (thousands). This page is for screen review only; Excel and PDF export formats remain unchanged.</div><div class="analysis-grid">${cards}</div><div class="analysis-panels">${panels}</div>`;
    }
    function compareDataset() {
      const key = compareState.entity === "demand" ? "demand_prev" : "pu_prev";
      const tab = DATA[key] || { rows: [] };
      return { key, tab, rows: (tab.rows || []).filter(row => rowName(row)) };
    }
    function compareItems(rows) {
      const details = rows.filter(row => String(rowName(row)).toLowerCase() !== "total");
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
      return `<section class="chart-panel"><h3>Bar Chart</h3>${values.map(item => `<div class="bar-row"><strong>${htmlEscape(item.label)}</strong><div class="bar-track"><div class="bar-fill ${item.cls}" style="width:${Math.min(100, Math.abs(item.value) / max * 100)}%"></div></div><span>${formatNumber(item.value)}</span></div>`).join("")}</section>`;
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
      return `<section class="chart-panel"><h3>Pie Chart</h3><div class="pie-wrap"><div class="pie" style="background:conic-gradient(${stops})"></div><div class="legend">${parts.map((item, index) => `<div><span style="background:${colors[index]}"></span>${htmlEscape(item.label)}: ${formatNumber(item.value)} (${formatNumber(item.abs / total * 100, 1)}%)</div>`).join("")}</div></div></section>`;
    }
    function renderUpload() {
      document.getElementById("title").textContent = "Upload Data And Rebuild Tables";
      document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === "upload"));
      const panel = document.createElement("div");
      panel.className = "upload-panel";
      panel.innerHTML = `
        <div class="note">Upload each source file separately or sync from configured GitHub / Google Drive links. Every file is parsed and validated before tables are updated.</div>
        <div class="sync-box">
          <strong>Linked Data Source Sync</strong>
          <span>Reads URLs from data/year-sources.json. Use GitHub Raw links or CORS-enabled direct Google Drive links for Excel / HTML files.</span>
          <div class="sync-actions">
            <button class="export" id="syncRemote" type="button">Sync / Refresh From Link</button>
            <button class="export" id="showSourceConfig" type="button">Show Source Plan</button>
          </div>
        </div>
        <div class="upload-grid">
          <div class="upload-card"><strong>FR Analysis Excel / HTML</strong><span>FR workbook or HTML report.</span><input data-upload-role="fr" type="file" accept=".xls,.xlsx,.html,.htm"><em data-status-role="fr">Waiting</em></div>
          <div class="upload-card"><strong>PU Current Year Budget</strong><span>PU file with BG_ISL 2026-2027 and actuals.</span><input data-upload-role="currPuBudget" type="file" accept=".xls,.xlsx"><em data-status-role="currPuBudget">Waiting</em></div>
          <div class="upload-card"><strong>PU Previous Year Budget</strong><span>PU file with RG 2025-2026.</span><input data-upload-role="prevPuBudget" type="file" accept=".xls,.xlsx"><em data-status-role="prevPuBudget">Waiting</em></div>
          <div class="upload-card"><strong>PU Current Year Month</strong><span>PU month-wise actual file for current year.</span><input data-upload-role="currPuMonth" type="file" accept=".xls,.xlsx"><em data-status-role="currPuMonth">Optional</em></div>
          <div class="upload-card"><strong>PU Previous Year Month</strong><span>PU month-wise actual file for previous year.</span><input data-upload-role="prevPuMonth" type="file" accept=".xls,.xlsx"><em data-status-role="prevPuMonth">Optional</em></div>
          <div class="upload-card"><strong>SMH/Demand Current Year Budget</strong><span>SMH file with BG_ISL 2026-2027 and actuals.</span><input data-upload-role="currSmhBudget" type="file" accept=".xls,.xlsx"><em data-status-role="currSmhBudget">Waiting</em></div>
          <div class="upload-card"><strong>SMH/Demand Previous Year Budget</strong><span>SMH file with RG 2025-2026.</span><input data-upload-role="prevSmhBudget" type="file" accept=".xls,.xlsx"><em data-status-role="prevSmhBudget">Waiting</em></div>
          <div class="upload-card"><strong>SMH/Demand Current Year Month</strong><span>SMH month-wise actual file for current year.</span><input data-upload-role="currSmhMonth" type="file" accept=".xls,.xlsx"><em data-status-role="currSmhMonth">Optional</em></div>
          <div class="upload-card"><strong>SMH/Demand Previous Year Month</strong><span>SMH month-wise actual file for previous year.</span><input data-upload-role="prevSmhMonth" type="file" accept=".xls,.xlsx"><em data-status-role="prevSmhMonth">Optional</em></div>
        </div>
        <button class="export" id="applyUpload" type="button">Sense And Update Tables</button>
        <div id="uploadLog" class="log">Waiting for individual files...</div>`;
      document.getElementById("tableHost").replaceChildren(panel);
      document.querySelectorAll("[data-upload-role]").forEach(input => input.addEventListener("change", event => readUploadedFile(event.target.files[0], event.target.dataset.uploadRole)));
      document.getElementById("applyUpload").addEventListener("click", applyUploadedData);
      document.getElementById("syncRemote").addEventListener("click", syncRemoteSources);
      document.getElementById("showSourceConfig").addEventListener("click", showSourceConfig);
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
        prevPuBudget: files.prevPuBudget || legacy.previousPuBudget || "",
        currPuMonth: files.currPuMonth || "",
        prevPuMonth: files.prevPuMonth || "",
        currSmhBudget: files.currSmhBudget || legacy.currentSmhBudget || "",
        prevSmhBudget: files.prevSmhBudget || legacy.previousSmhBudget || "",
        currSmhMonth: files.currSmhMonth || "",
        prevSmhMonth: files.prevSmhMonth || "",
      };
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
    function showSourceConfig() {
      const { year } = syncYearEntry();
      const files = remoteFilesForSync();
      const lines = Object.entries(files).map(([role, url]) => `${role}: ${url ? normalizeRemoteUrl(url) : "Not configured"}`);
      const log = document.getElementById("uploadLog");
      if (log) log.textContent = `Remote source year: ${year || "Not set"}\n${lines.join("\n")}`;
    }
    async function syncRemoteSources() {
      const log = document.getElementById("uploadLog");
      if (log) log.textContent = "Remote sync started. Downloading configured files...";
      if (window.location.protocol === "file:") {
        logUpload("Note: this portal is open as a local file. Some browsers block Google Drive sync from file:// pages. If every file says Failed to fetch, open the portal from GitHub Pages or a local web server.");
      }
      const files = remoteFilesForSync();
      const required = ["currPuBudget", "prevPuBudget", "currSmhBudget", "prevSmhBudget"];
      const syncOrder = ["currPuBudget", "prevPuBudget", "currSmhBudget", "prevSmhBudget", "currPuMonth", "prevPuMonth", "currSmhMonth", "prevSmhMonth", "fr"];
      const roles = syncOrder.filter(role => String(files[role] || "").trim());
      if (!roles.length) {
        logUpload("No remote URLs configured. Add links in data/year-sources.json under years -> 2026-2027 -> files.");
        return;
      }
      const missingRequired = required.filter(role => !files[role] && !UPLOAD_STATE[role]);
      if (missingRequired.length) logUpload("Required remote links not configured yet: " + missingRequired.join(", "));
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
      logUpload("Remote sync finished. Rebuilding tables from synced files...");
      applyUploadedData();
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
    async function readUploadedFile(file, expectedRole) {
      if (!file) return;
      const log = document.getElementById("uploadLog");
      if (log && log.textContent === "Waiting for individual files...") log.textContent = "Validation log:";
      setUploadStatus(expectedRole, "Parsing...", null);
        const lower = file.name.toLowerCase();
        try {
          if (lower.endsWith(".html") || lower.endsWith(".htm")) {
            if (expectedRole !== "fr") throw new Error("HTML upload is allowed only for FR Analysis.");
            const html = await file.text();
            window.parent?.postMessage({ type: "fr-html", name: file.name, html }, "*");
            UPLOAD_STATE.fr = { fileName: file.name, type: "html" };
            setUploadStatus(expectedRole, `OK: ${file.name}`, true);
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
            setUploadStatus(expectedRole, `OK: ${file.name}`, true);
            logUpload(`FR Excel accepted: ${file.name}`);
            return;
          }
          const parsed = rowsFromWorkbook(workbook);
          const role = senseRole(file.name, parsed.headers);
          if (role !== expectedRole) throw new Error(`Sensed as ${role}, expected ${expectedRole}.`);
          UPLOAD_STATE[role] = parsed;
          setUploadStatus(expectedRole, `OK: ${file.name}`, true);
          logUpload(`${file.name} -> ${role}`);
        } catch (error) {
          delete UPLOAD_STATE[expectedRole];
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
    function summaryRow(label, oba, ae, months = 3) {
      const bp = oba / 12 * months;
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
      const oba = rows.reduce((sum, row) => sum + numberValue(row.OBA), 0);
      const months = rows[0]?.Months || 3;
      if (previous) return rows.concat(prevRow("Total", rows.reduce((sum, row) => sum + numberValue(row.PreviousOBA), 0), oba, rows.reduce((s, r) => s + numberValue(r.AECurrent), 0), rows.reduce((s, r) => s + numberValue(r.AEPrevious), 0), months));
      return rows.concat(summaryRow("Total", oba, rows.reduce((sum, row) => sum + numberValue(row.AE), 0), months));
    }
    function buildCurrentFromUpload(table, field, firstLabel, title, demand=false) {
      const nameIdx = colIndex(table.headers, [field]);
      const obaIdx = colIndex(table.headers, ["BG_ISL", "2026-2027"]);
      const period = detectActualPeriod(table.headers);
      const aeIdx = period.idx;
      const columns = [
        { key:"Name", label:firstLabel, format:"text" }, ...(demand ? [{ key:"Department", label:"Department", format:"text" }] : []), { key:"OBA", label:"A\nOBA\nBG_ISL 2026-27", format:"money" },
        { key:"BP", label:`B\nBP\nA / 12 * ${period.count}`, format:"money" }, { key:"AE", label:`C\nAE\nActuals Upto ${period.label}`, format:"money" },
        { key:"Variation", label:"D\nVariation\nC - B", format:"money" }, { key:"BPPercent", label:"E\n% BP\nC / B", format:"int" },
        { key:"Remaining", label:"F\nBudget Remaining\nA - C", format:"money" }, { key:"OBAPercent", label:"G\n% OBA Utilized\nC / A", format:"int" }
      ];
      const rows = table.rows.map(row => String(row[nameIdx] || "").trim()).filter(Boolean).map((name, i) => {
        const source = table.rows[i];
        const built = summaryRow(demand ? demandFromSmh(name) : name, numberValue(source[obaIdx]), numberValue(source[aeIdx]), period.count);
        built.Months = period.count;
        return demand ? withDemandDepartment(built) : built;
      }).filter(row => row.Name.toUpperCase() !== "TOTAL");
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
    function applyUploadedData() {
      try {
        const required = ["currPuBudget", "prevPuBudget", "currSmhBudget", "prevSmhBudget"];
        const missing = required.filter(role => !UPLOAD_STATE[role]);
        if (missing.length) {
          missing.forEach(role => setUploadStatus(role, "Required before update", false));
          throw new Error("Required uploads missing: " + missing.join(", "));
        }
        if (UPLOAD_STATE.currSmhBudget) DATA.demand = buildCurrentFromUpload(UPLOAD_STATE.currSmhBudget, "SMH", "Demand No. / SMH-Grant", "Demand / SMH Wise Current Year", true);
        if (UPLOAD_STATE.currPuBudget) {
          const all = buildCurrentFromUpload(UPLOAD_STATE.currPuBudget, "PUCODE", "PU", "PU Wise Current Year", false).rows.filter(row => row.Name !== "Total");
          DATA.staff = { ...DATA.staff, rows: addTotal(all.filter(row => STAFF_CODES.has(codeFromLabel(row.Name, "PU")))) };
          DATA.nonstaff = { ...DATA.nonstaff, rows: addTotal(all.filter(row => !STAFF_CODES.has(codeFromLabel(row.Name, "PU")))) };
        }
        if (UPLOAD_STATE.prevPuBudget && UPLOAD_STATE.currPuBudget) DATA.pu_prev = buildPreviousFromUpload(UPLOAD_STATE.prevPuBudget, UPLOAD_STATE.currPuBudget, "PUCODE", "PU", "PU Wise Previous Year Comparison");
        if (UPLOAD_STATE.prevSmhBudget && UPLOAD_STATE.currSmhBudget) DATA.demand_prev = buildPreviousFromUpload(UPLOAD_STATE.prevSmhBudget, UPLOAD_STATE.currSmhBudget, "SMH", "Demand No. / SMH-Grant", "Demand / SMH Wise Previous Year Comparison", true);
        TAB_ORDER = ["demand", "staff", "nonstaff", "pu_prev", "demand_prev"].filter(key => DATA[key]);
        logUpload("Tables updated in this browser session. Use Export buttons to save the updated tables.");
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
    function openTab(tabKey) {
      if (tabKey === "upload" && !requestUploadPassword()) return;
      render(tabKey);
    }
    document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => openTab(btn.dataset.tab)));
    window.addEventListener("message", event => { if (event.data?.type === "open-current-tab" && (DATA[event.data.tab] || event.data.tab === "analysis")) render(event.data.tab); });
    render(activeTab);
