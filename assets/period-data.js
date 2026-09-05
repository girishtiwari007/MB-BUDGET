(function () {
  const months = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"];
  const nameOf = row => String(row.Name || row.PU || row.Demand || "");
  const suspense = row => /\b(?:12N|10N)\b/i.test(nameOf(row)) || /suspense/i.test(row.Department || "");
  const num = value => Number(value || 0);

  function identity(scope, label) {
    const text = String(label).toUpperCase();
    if (scope === "pu") return text.match(/PU\s*-\s*([0-9A-Z]+)/)?.[1] || text;
    const demand = text.match(/DEMAND\s+([0-9A-Z]+)/)?.[1];
    const smh = text.match(/\/\s*(?:SMH\s*)?([0-9A-Z]+)/)?.[1];
    return demand && smh ? `${demand}/${smh}` : text;
  }

  function actual(reports, scope, label, year, count) {
    const bucket = reports.monthly?.[scope] || {};
    // An exact label can contain only the current year. Look up aliases for the requested year.
    const keys = [label, ...Object.keys(bucket).filter(key => key !== label && identity(scope, key) === identity(scope, label))];
    for (const key of keys) {
      const values = bucket[key]?.[year];
      if (Array.isArray(values)) return values.slice(0, count).reduce((sum, value) => sum + num(value), 0);
    }
    return null;
  }

  function period(label) {
    const [month, year] = String(label).trim().toUpperCase().split(/\s+/);
    return { label: `${month} ${year}`, month, year: Number(year), count: months.indexOf(month) + 1 };
  }

  function relabel(text, basis) {
    return String(text || "")
      .replace(/\b(?:APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JAN|FEB|MAR)\s+(20\d{2})\b/g,
        (_, year) => `${basis.month} ${year}`)
      .replace(/\/ 12 \* \d+/g, `/ 12 * ${basis.count}`);
  }

  function calculate(row, count, previous) {
    const result = { ...row, Months: count };
    const oba = num(row.OBA);
    const ae = num(previous ? row.AECurrent : row.AE);
    result.BP = oba / 12 * count;
    result.BPPercent = result.BP ? ae / result.BP * 100 : 0;
    result.OBAPercent = oba ? ae / oba * 100 : 0;
    result.Remaining = result.BudgetRemaining = oba - ae;
    if (previous) {
      result.PreviousBP = num(row.PreviousOBA) / 12 * count;
      result.VariationBP = ae - result.BP;
      result.VariationActual = result.ActualVariation = ae - num(row.AEPrevious);
    } else {
      result.Variation = ae - result.BP;
    }
    return result;
  }

  function build(source, reports, basis) {
    const view = JSON.parse(JSON.stringify(source || {}));
    const years = reports.years || [];
    const currentYear = years.at(-1)?.fy;
    const previousYear = years.at(-2)?.fy;
    for (const key of ["demand", "staff", "nonstaff", "pu_prev", "demand_prev"]) {
      const tab = view[key];
      if (!tab?.rows?.length) continue;
      const previous = key.endsWith("_prev");
      const scope = key.startsWith("demand") ? "demand" : "pu";
      const rows = tab.rows.filter(row => nameOf(row).toLowerCase() !== "total").map(row => {
        const current = actual(reports, scope, nameOf(row), currentYear, basis.count);
        if (current !== null) row[previous ? "AECurrent" : "AE"] = current;
        if (previous) {
          const prior = actual(reports, scope, nameOf(row), previousYear, basis.count);
          if (prior !== null) row.AEPrevious = prior;
        }
        return calculate(row, basis.count, previous);
      });
      const normal = rows.filter(row => !suspense(row));
      const total = { Name: "Total" };
      for (const field of previous ? ["OBA", "PreviousOBA", "AECurrent", "AEPrevious"] : ["OBA", "AE"]) {
        total[field] = normal.reduce((sum, row) => sum + num(row[field]), 0);
      }
      tab.rows = [...normal, calculate(total, basis.count, previous), ...rows.filter(suspense)];
      tab.columns = (tab.columns || []).map(column => ({ ...column, label: relabel(column.label, basis) }));
      if (basis.title) tab.title += ` - ${basis.title}`;
    }
    return view;
  }

  window.BudgetPeriods = { build, period, actual, relabel };
})();
