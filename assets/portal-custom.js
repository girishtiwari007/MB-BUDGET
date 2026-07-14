(function(){
  const key = "mbBudgetPortalStyle";
  function settings(){
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  }
  function cssFrom(s){
    const page = s.page || {};
    const table = s.table || {};
    const headings = s.headings || {};
    const font = s.font || {};
    return `
      :root { --admin-accent:${page.accent || "#1f4e79"}; --admin-danger:${page.danger || "#b71c1c"}; }
      body { font-family:${font.family || "Calibri, Arial, sans-serif"} !important; font-size:${font.base || "14"}px !important; background:${page.background || ""}; }
      h1, h2.division-title, .hero h1 { font-size:${headings.main || "21"}px !important; color:${headings.color || ""}; text-align:${headings.align || "center"} !important; }
      table { font-size:${table.size || "12"}px !important; }
      th { background:${table.header || ""} !important; color:${table.headerText || "#ffffff"} !important; }
      td, th { padding:${table.padding || "4"}px ${Number(table.padding || 4)+1}px !important; }
      tbody tr:nth-child(even) td { background:${table.alt || ""} !important; }
      tr.total td { background:${table.total || ""} !important; }
    `;
  }
  function apply(doc){
    try {
      const target = doc || document;
      let tag = target.getElementById("adminPortalCustomStyle");
      if (!tag) { tag = target.createElement("style"); tag.id = "adminPortalCustomStyle"; target.head.appendChild(tag); }
      tag.textContent = cssFrom(settings());
    } catch {}
  }
  window.MBBudgetCustom = { key, settings, cssFrom, apply };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => apply(document)); else apply(document);
  window.addEventListener("storage", event => { if (event.key === key) apply(document); });
})();
