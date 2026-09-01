(function(){
  const DATA = window.CURRENT_PAYLOAD || {};
  const META = window.CURRENT_PAYLOAD_META || {};
  const importantPuCodes = new Set(["27", "28", "30", "32", "60"]);
  const $ = id => document.getElementById(id);

  function fmt(value){
    return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }

  function crore(value){
    return (Number(value || 0) / 10000).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function money(value){
    return `${fmt(value)} | Cr ${crore(value)}`;
  }

  function rows(key){
    return DATA[key]?.rows || [];
  }

  function rowName(row){
    return String(row?.Name || row?.PU || row?.Demand || "");
  }

  function detailRows(list){
    return (list || []).filter(row => rowName(row).trim().toLowerCase() !== "total");
  }

  function totalRow(key){
    return rows(key).find(row => rowName(row).trim().toLowerCase() === "total") || {};
  }

  function puCode(row){
    const match = rowName(row).match(/PU\s*-\s*([0-9A-Z]+)/i);
    return match ? match[1].padStart(2, "0").toUpperCase() : "";
  }

  function isSuspense(row){
    return /\b(12N|10N)\b/i.test(rowName(row)) || /suspense/i.test(String(row?.Department || ""));
  }

  function statusTone(value, highIsBad){
    const n = Number(value || 0);
    if (highIsBad && n > 100) return "bad";
    if (n >= 75) return "watch";
    return "good";
  }

  function setMetric(id, label, value, note, tone){
    const node = $(id);
    if (!node) return;
    node.classList.remove("good", "watch", "bad");
    if (tone) node.classList.add(tone);
    node.innerHTML = `<span>${label}</span><strong>${value}</strong>${note ? `<em>${note}</em>` : ""}`;
  }

  function dateText(value, dateOnly){
    if (!value) return "Not recorded";
    const text = String(value);
    const date = new Date(text.includes("T") ? text : `${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) return text;
    const options = {
      day: "2-digit",
      month: "short",
      year: "numeric"
    };
    if (!dateOnly) {
      options.hour = "2-digit";
      options.minute = "2-digit";
    }
    return date.toLocaleString("en-IN", options);
  }

  function exceptionItem(tone, title, text){
    return `<li class="${tone}"><strong>${title}</strong><span>${text}</span></li>`;
  }

  function buildExceptions(){
    const demandSuspense = detailRows(rows("demand")).filter(isSuspense);
    const allPu = detailRows(rows("staff")).concat(detailRows(rows("nonstaff")));
    const important = allPu.filter(row => importantPuCodes.has(puCode(row)));
    const overBp = allPu
      .filter(row => Number(row.BPPercent || 0) > 100 && !/^PU\s*-\s*98\b/i.test(rowName(row)))
      .sort((a, b) => Number(b.BPPercent || 0) - Number(a.BPPercent || 0))
      .slice(0, 3);
    const negative = allPu
      .filter(row => Number(row.Remaining || 0) < 0)
      .sort((a, b) => Math.abs(Number(b.Remaining || 0)) - Math.abs(Number(a.Remaining || 0)))
      .slice(0, 2);
    const nonstaffTotal = totalRow("nonstaff");
    const demandTotal = totalRow("demand");
    const items = [];

    if (demandSuspense.length) {
      const suspense = demandSuspense[0];
      items.push(exceptionItem("critical", "Demand 12N / 10N", `Separate suspense line. AE ${money(suspense.AE)} remains outside the main demand total.`));
    }

    negative.forEach(row => {
      items.push(exceptionItem("critical", rowName(row), `Budget remaining is negative by ${money(Math.abs(Number(row.Remaining || 0)))}.`));
    });

    overBp.forEach(row => {
      items.push(exceptionItem("watch", rowName(row), `Actual is ${Number(row.BPPercent || 0).toFixed(1)}% of BP. Variation ${money(row.Variation)}.`));
    });

    if (important.length) {
      const ae = important.reduce((sum, row) => sum + Number(row.AE || 0), 0);
      items.push(exceptionItem("watch", "Important PU Focus", `${important.length} important PU rows detected. Combined AE ${money(ae)}.`));
    }

    items.push(exceptionItem(
      statusTone(nonstaffTotal.BPPercent, true),
      "Non-Staff Utilization",
      `Total AE ${money(nonstaffTotal.AE)} is ${Number(nonstaffTotal.BPPercent || 0).toFixed(1)}% of BP.`
    ));
    items.push(exceptionItem(
      statusTone(demandTotal.BPPercent, true),
      "Demand Total",
      `Main demand AE ${money(demandTotal.AE)} is ${Number(demandTotal.BPPercent || 0).toFixed(1)}% of BP.`
    ));

    return items.slice(0, 7);
  }

  async function loadJson(url){
    try {
      const response = await fetch(`${url}?ts=${Date.now()}`, { cache: "no-store" });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }

  async function render(){
    const frManifest = await loadJson("data/fr/fr-upload-manifest.json");
    const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
    const mode = isLocal ? "Local Upload" : "Static View";
    const demandTotal = totalRow("demand");
    const completed = META.completedMonth || "AUG 2026";
    const running = META.runningMonth || "SEP 2026";

    setMetric("homeBasisMetric", "Reporting Basis", completed, "Completed actual month", "good");
    setMetric("homeRunningMetric", "Running Month", running, "Shown separately from completed basis", "watch");
    setMetric("homeDemandMetric", "Demand AE", money(demandTotal.AE), `${Number(demandTotal.BPPercent || 0).toFixed(1)}% of BP`, statusTone(demandTotal.BPPercent, true));
    setMetric("homeModeMetric", "Portal Mode", mode, isLocal ? "Upload and sync APIs available" : "Uploads need local server for permanent save", isLocal ? "good" : "watch");

    const statusParts = [
      `Current data uploaded: ${dateText(META.updatedAt)}`,
      `FR as on: ${dateText(frManifest?.dataAsOn, true)}`,
      `FR source: ${frManifest?.originalName || "not recorded"}`,
      `Backups: current ${META.backup || "not recorded"}; FR ${(frManifest?.backups || []).length}`
    ];
    $("homeStatusStrip").innerHTML = statusParts.map(part => `<span>${part}</span>`).join("");
    $("homeExceptionList").innerHTML = buildExceptions().join("");
    $("homeGeneratedNote").textContent = `Data basis ${completed}; running month ${running}. Last current-year upload ${dateText(META.updatedAt)}.`;
  }

  render();
})();
