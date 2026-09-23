(function () {
  const data = window.REPORTS_DATA || {};
  const meta = window.CURRENT_PAYLOAD_META || {};
  const months = data.months || ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"];
  const quarters = { Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11] };
  const $ = (id) => document.getElementById(id);
  const state = { scope: "pu", period: "quarter", month: "APR", quarter: "Q1", selectedYears: new Set((data.years || []).map((row) => row.fy).filter(Boolean)), selectedItems: null };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const fmt = (value) => Number(value || 0).toLocaleString("en-IN");
  const money = (value) => `${fmt(value)}<small>${(Number(value || 0) / 10000).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr</small>`;
  const years = () => (data.years || []).map((row) => row.fy).filter(Boolean);
  const completedMonthCount = () => Math.max(1, months.indexOf(String(meta.completedMonth || "AUG").slice(0, 3).toUpperCase()) + 1);
  const scopeName = () => state.scope === "pu" ? "Primary Unit" : state.scope === "demand" ? "Demand / SMH" : "Department";
  const source = () => data.monthly?.[state.scope] || {};
  const items = () => Object.keys(source()).filter((name) => name.toUpperCase() !== "TOTAL").sort((a, b) => a.localeCompare(b, "en-IN", { numeric: true }));
  const chosen = (all, selection) => all.filter((value) => selection.has(value));
  const selectionLabel = (all, selection, plural) => selection.size === all.length ? `All ${plural}` : selection.size === 1 ? [...selection][0] : selection.size ? `${selection.size} ${plural} selected` : `No ${plural} selected`;

  function periodIndexes() {
    if (state.period === "month") return [months.indexOf(state.month)];
    if (state.period === "quarter") return quarters[state.quarter] || quarters.Q1;
    return months.map((_, index) => index);
  }
  function periodLabel() {
    if (state.period === "month") return state.month;
    if (state.period === "quarter") return `${state.quarter} (${periodIndexes().map((index) => months[index]).join("–")})`;
    return "Financial Year";
  }
  function value(values, year) {
    let indexes = periodIndexes();
    if (year === years().at(-1)) indexes = indexes.filter((index) => index < completedMonthCount());
    return indexes.reduce((sum, index) => sum + Number(values?.[year]?.[index] || 0), 0);
  }
  function checkboxList(host, all, selected, type, allLabel) {
    host.innerHTML = `<label class="check-all"><input type="checkbox" data-type="${type}" data-all="true" ${!selected.size || selected.size === all.length ? "checked" : ""}> ${esc(allLabel)}</label>${all.map((value) => `<label><input type="checkbox" data-type="${type}" value="${esc(value)}" ${selected.has(value) ? "checked" : ""}> ${esc(value)}</label>`).join("")}`;
  }
  function sync() {
    $("reviewScope").value = state.scope;
    $("reviewPeriod").value = state.period;
    $("reviewMonth").innerHTML = months.map((month) => `<option ${month === state.month ? "selected" : ""}>${month}</option>`).join("");
    $("reviewQuarter").value = state.quarter;
    $("monthWrap").hidden = state.period !== "month";
    $("quarterWrap").hidden = state.period !== "quarter";
    const allYears = years();
    const allItems = items();
    state.selectedYears = new Set([...state.selectedYears].filter((year) => allYears.includes(year)));
    if (state.selectedItems === null) state.selectedItems = new Set(allItems);
    else state.selectedItems = new Set([...state.selectedItems].filter((item) => allItems.includes(item)));
    checkboxList($("yearChecks"), allYears, state.selectedYears, "year", "All available years");
    checkboxList($("itemChecks"), allItems, state.selectedItems, "item", `All ${scopeName()}s`);
    $("yearPickerLabel").textContent = selectionLabel(allYears, state.selectedYears, "years");
    $("itemPickerTitle").textContent = `Specific ${scopeName()}s`;
    $("itemPickerLabel").textContent = selectionLabel(allItems, state.selectedItems, `${scopeName()}s`);
  }
  function render() {
    sync();
    const selectedYears = chosen(years(), state.selectedYears);
    const selectedItems = chosen(items(), state.selectedItems);
    const rows = selectedItems.map((name) => {
      const values = selectedYears.map((year) => value(source()[name], year));
      return { name, values, total: values.reduce((sum, current) => sum + current, 0) };
    }).filter((row) => row.total || state.selectedItems.size).sort((a, b) => b.total - a.total);
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const top = rows[0];
    $("reviewTitle").textContent = `Yearly Review — ${scopeName()}`;
    $("reviewStamp").textContent = `${periodLabel()} | ${selectionLabel(years(), state.selectedYears, "years")} | Completed actuals through ${meta.completedMonth || "latest completed month"}`;
    $("reviewHost").innerHTML = `<section class="summary"><article><span>Period</span><strong>${esc(periodLabel())}</strong></article><article><span>Selected rows</span><strong>${rows.length}</strong></article><article><span>Review total</span><strong>${money(total)}</strong></article><article><span>Highest item</span><strong>${esc(top?.name || "N/A")}</strong></article></section><section class="review-panel"><div class="section-head"><h2>${esc(periodLabel())} expenditure review</h2><span>Completed actuals only · Figures in '000' with Crore below</span></div><div class="table-wrap"><table><thead><tr><th>${scopeName()}</th>${selectedYears.map((year) => `<th>${esc(year)}</th>`).join("")}<th>Total</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${esc(row.name)}</td>${row.values.map((current) => `<td>${money(current)}</td>`).join("")}<td>${money(row.total)}</td></tr>`).join("") || `<tr><td colspan="${selectedYears.length + 2}">No data available for this selection.</td></tr>`}</tbody></table></div></section>`;
  }
  ["reviewScope", "reviewPeriod", "reviewMonth", "reviewQuarter"].forEach((id) => $(id).addEventListener("change", (event) => {
    const keys = { reviewScope: "scope", reviewPeriod: "period", reviewMonth: "month", reviewQuarter: "quarter" };
    state[keys[id]] = event.target.value;
    if (id === "reviewScope") state.selectedItems = null;
    render();
  }));
  document.addEventListener("change", (event) => {
    const input = event.target;
    if (!input.matches("input[data-type]")) return;
    const all = input.dataset.type === "year" ? years() : items();
    const selection = input.dataset.type === "year" ? state.selectedYears : state.selectedItems;
    if (input.dataset.all) {
      selection.clear();
      if (input.checked) all.forEach((value) => selection.add(value));
    } else if (input.checked) selection.add(input.value); else selection.delete(input.value);    render();
  });
  render();
}());