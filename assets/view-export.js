(function(){
  const encoder = new TextEncoder();

  function clean(text){
    return String(text ?? "").replace(/\s+/g, " ").trim();
  }

  function xml(value){
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" }[ch]));
  }

  function html(value){
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[ch]));
  }

  function fileStamp(){
    return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  }

  function activeViewLabel(){
    const active = document.querySelector(".tabs button.active,.tabs [aria-selected=\"true\"],.report-menu button.active,.report-menu [aria-selected=\"true\"]");
    return clean(active?.textContent || document.querySelector(".panel.active h2")?.textContent || "");
  }

  function pageTitle(){
    const base = clean(document.querySelector("h1")?.textContent || document.querySelector("title")?.textContent || "MB Budget View");
    const active = activeViewLabel();
    return active && !base.includes(active) ? `${base} — ${active}` : base;
  }

  function visible(element){
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
  }

  function selectedControls(){
    const rows = [];
    document.querySelectorAll("select,input[type='checkbox'],input[type='radio'],input[type='search'],input[type='text']").forEach(control => {
      if (!visible(control)) return;
      const label = clean(control.closest("label")?.textContent || control.getAttribute("aria-label") || control.id || control.name);
      if (!label) return;
      if (control.type === "checkbox" || control.type === "radio") {
        rows.push([label, control.checked ? "Yes" : "No"]);
      } else if (control.tagName === "SELECT") {
        const selected = Array.from(control.selectedOptions || []).map(option => clean(option.textContent)).join(", ");
        rows.push([label.replace(selected, "").trim() || label, selected]);
      } else {
        rows.push([label, control.value || ""]);
      }
    });
    return rows;
  }

  function sortRows(){
    return Array.from(document.querySelectorAll("th.table-sort-active,[aria-sort=\"ascending\"],[aria-sort=\"descending\"]")).map(header => ["Sort order", `${clean(header.textContent)} (${header.getAttribute("aria-sort") || header.dataset.sortDirection || "applied"})`]);
  }

  function metaRows(extra = []){
    const stamp = clean(document.querySelector(".data-stamp")?.textContent || document.querySelector("#reportDataStamp")?.textContent || document.querySelector("#dataStamp")?.textContent || "");
    return [
      ["Report", pageTitle()],
      ["Generated", new Date().toLocaleString("en-IN")],
      ["Data basis", stamp || "As displayed on portal"],
      ...selectedControls(),
      ...sortRows(),
      ...extra
    ];
  }

  function visibleRoot(){
    return document.querySelector(".panel.active") || document.querySelector("#host") || document.querySelector("#tableHost") || document.querySelector("main") || document.body;
  }

  function cloneForExport(root = visibleRoot()){
    const clone = root.cloneNode(true);
    clone.querySelectorAll("table button").forEach(button => button.replaceWith(document.createTextNode(clean(button.textContent))));
    clone.querySelectorAll("script,style,input,select,textarea,.toolbar,.actions,.tabs,.topbar,.header-actions,.report-menu,.protection-badge,[data-view-export-ignore]").forEach(node => node.remove());
    clone.querySelectorAll("button").forEach(button => button.remove());
    clone.querySelectorAll("[style]").forEach(node => {
      node.style.maxHeight = "none";
      node.style.overflow = "visible";
    });
    return clone;
  }

  function appendixClones(activeRoot = visibleRoot()){
    const panels = Array.from(document.querySelectorAll(".panel,section.report-view,article.report-view,.tab-panel"));
    if (panels.length < 2) return [];
    return panels.filter(panel => panel !== activeRoot && !activeRoot.contains(panel) && clean(panel.innerText || panel.textContent).length > 25).slice(0, 6).map((panel, index) => {
      const clone = cloneForExport(panel);
      clone.style.display = "block";
      clone.style.visibility = "visible";
      clone.classList.remove("active");
      const title = clean(panel.querySelector("h1,h2,h3,.title")?.textContent || `Appendix View ${index + 1}`);
      return { title, html:`<section class="export-page-break appendix-view"><h2>${html(title)}</h2>${clone.outerHTML}</section>` };
    });
  }

  function exportStyles(){
    return `<style>
      @page{size:A4 landscape;margin:.25in}
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
      body{margin:0;background:#fff;color:#17212b;font-family:Arial,Helvetica,sans-serif}
      main{width:100%;padding:0}
      h1{margin:0 0 4px;text-align:center;color:#1f4e79;font:700 20px Arial,Helvetica,sans-serif}
      .view-meta{margin:0 0 8px;font:700 10px Arial,Helvetica,sans-serif;text-align:right;color:#405060}
      table{width:100%;border-collapse:collapse;font-size:8.5px;font-family:"Times New Roman",Times,serif;table-layout:auto}
      th,td{border:1px solid #000!important;padding:3px 4px;vertical-align:middle;white-space:normal;overflow-wrap:anywhere}
      th{background:#1f4e79!important;color:#fff!important;text-align:center}
      td{text-align:right}
      td:first-child,th:first-child{text-align:left}
      tr:nth-child(even) td{background:#e8f2f8}
      .dual-money{display:block;font-family:"Times New Roman",Times,serif;line-height:1.08}
      .dual-money span{display:block}
      .dual-money .thousand{font-size:11px;font-weight:700}
      .dual-money .crore{font-size:9px;color:#006f78}
      .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}
      .dot.green{background:#25a55b}.dot.yellow{background:#f2c230}.dot.red{background:#d92323}
      .card,.chart,.tablebox,.panel,.summary-grid,.grid,.freshness,.review-pack,.basis-guard,.refresh-proof,.export-board{border:1px solid #c8d6e2;margin:0 0 8px;padding:6px;background:#fff;box-shadow:none!important}
      .bar-track,.track{height:12px;border:1px solid #dbe6ee;background:#edf4f8}.bar-fill,.fill{height:100%;background:#1f4e79}
      .export-page-break{break-after:page;page-break-after:always}
    </style>`;
  }

  function currentViewHtml(){
    const active = visibleRoot();
    const clone = cloneForExport(active);
    const meta = metaRows().map(row => `${html(row[0])}: ${html(row[1])}`).join(" | ");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${html(pageTitle())}</title>${exportStyles()}</head><body><main><h1>${html(pageTitle())}</h1><p class="view-meta">${meta}</p>${clone.outerHTML}</main></body></html>`;
  }

  function printPdf(){
    const win = window.open("", "_blank");
    if (!win) { window.alert("Please allow popups to generate PDF."); return; }
    win.document.open();
    win.document.write(currentViewHtml("pdf"));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  }

  function tableToAoa(table){
    return Array.from(table.rows || []).map(row => Array.from(row.cells || []).map(cell => clean(cell.innerText || cell.textContent)));
  }

  function cardsAoa(root){
    const rows = [];
    root.querySelectorAll(".card,.metric,.stat,.export-card,.pack-card,.item,.finance-card,.risk-tile").forEach(card => {
      if (!visible(card)) return;
      const text = clean(card.innerText || card.textContent);
      if (text) rows.push([text]);
    });
    return rows;
  }

  function currentViewSheets(){
    const root = visibleRoot();
    const sheets = [];
    const intro = [["MB-BUDGET Current View Export"], ...metaRows(), []];
    const tables = Array.from(root.querySelectorAll("table")).filter(table => visible(table));
    if (tables.length) {
      tables.forEach((table, index) => {
        const title = clean(table.closest("section,article,div")?.querySelector("h2,h3")?.textContent || `${pageTitle()} Table ${index + 1}`);
        sheets.push({ name:title, rows:[...intro, [title], ...tableToAoa(table)] });
      });
    } else {
      const rows = cardsAoa(root);
      sheets.push({ name:pageTitle(), rows:[...intro, ["Visible content"], ...(rows.length ? rows : [[clean(root.innerText || root.textContent)]])] });
    }
    const controlRows = selectedControls();
    if (controlRows.length) sheets.push({ name:"Applied Filters", rows:[["Applied Filters"], ...controlRows] });
    return sheets;
  }

  function columnName(index){
    let text = "";
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) text = String.fromCharCode(65 + ((n - 1) % 26)) + text;
    return text;
  }

  function crc32(bytes){
    const table = crc32.table || (crc32.table = Array.from({ length:256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
    let crc = -1;
    for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
    return (crc ^ -1) >>> 0;
  }

  function zip(files, mime){
    const chunks = [];
    const central = [];
    let offset = 0;
    const u16 = value => [value & 255, value >>> 8 & 255];
    const u32 = value => [value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255];
    files.forEach(file => {
      const name = encoder.encode(file.name);
      const data = encoder.encode(file.content);
      const crc = crc32(data);
      const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name, ...data]);
      chunks.push(local);
      central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
      offset += local.length;
    });
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
    return new Blob([...chunks, ...central, end], { type:mime });
  }

  function sheetName(name){
    return clean(name || "Sheet").replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet";
  }

  function worksheetXml(rows){
    const maxCols = Math.max(1, ...rows.map(row => row.length));
    const cols = Array.from({ length:maxCols }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(42, Math.max(12, rows.reduce((m,row)=>Math.max(m, clean(row[i]).length), 0) + 2))}" customWidth="1"/>`).join("");
    const sheetData = rows.map((row, r) => `<row r="${r + 1}" ht="${r < 3 ? 22 : 28}" customHeight="1">${row.map((cell, c) => `<c r="${columnName(c)}${r + 1}" t="inlineStr" s="${r === 0 ? 2 : r < 4 ? 3 : r === 4 ? 1 : 0}"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`).join("")}</row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><cols>${cols}</cols><sheetData>${sheetData}</sheetData><pageMargins left="0.25" right="0.25" top="0.25" bottom="0.25" header="0.1" footer="0.1"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }

  function stylesXml(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Times New Roman"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Times New Roman"/></font><font><b/><color rgb="FF1F4E79"/><sz val="14"/><name val="Times New Roman"/></font><font><b/><color rgb="FF607080"/><sz val="10"/><name val="Times New Roman"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F2F8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FBFD"/></patternFill></fill></fills><borders count="1"><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf fontId="0" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }

  function xlsxBlob(){
    const sheets = currentViewSheets();
    const names = sheets.map(s => sheetName(s.name));
    const files = [
      { name:"[Content_Types].xml", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
      { name:"_rels/.rels", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name:"xl/workbook.xml", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
      { name:"xl/_rels/workbook.xml.rels", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name:"xl/styles.xml", content:stylesXml() },
      ...sheets.map((sheet, i) => ({ name:`xl/worksheets/sheet${i + 1}.xml`, content:worksheetXml(sheet.rows) }))
    ];
    return zip(files, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  function download(blob, name){
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    link.remove();
  }

  function exportExcel(){
    download(xlsxBlob(), `${pageTitle().replace(/[^A-Za-z0-9]+/g, "_")}_View_${fileStamp()}.xlsx`);
  }

  function exportPpt(){
    const active = visibleRoot();
    const body = cloneForExport(active).outerHTML;
    const meta = metaRows().map(row => `<p><b>${html(row[0])}:</b> ${html(row[1])}</p>`).join("");
    const ppt = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:p="urn:schemas-microsoft-com:office:powerpoint"><head><meta charset="utf-8"><meta name="ProgId" content="PowerPoint.Slide"><title>${html(pageTitle())}</title>${exportStyles()}<style>body{width:13.333in;min-height:7.5in}.slide{page-break-after:always;padding:.25in}.slide:last-child{page-break-after:auto}</style></head><body><section class="slide"><h1>${html(pageTitle())}</h1>${meta}</section><section class="slide">${body}</section></body></html>`;
    download(new Blob([ppt], { type:"application/vnd.ms-powerpoint" }), `${pageTitle().replace(/[^A-Za-z0-9]+/g, "_")}_View_${fileStamp()}.ppt`);
  }

  function fullExportLabel(node){
    const text = clean(node.textContent || "");
    const format = /ppt/i.test(text) ? "PowerPoint" : /pdf/i.test(text) ? "PDF" : "Excel";
    return `Download Full Dataset / Full Report (${format})`;
  }

  function addButtons(options = {}){
    const host = document.querySelector(options.host || ".actions,.header-actions,.hero,.pack-head") || document.body;
    if (document.getElementById("reportExportMenu")) return;
    const fullControls = Array.from(document.querySelectorAll("#exportExcel,#exportPdf,#exportPptx,#exportReportExcel,#exportReportPdf,#export-all,#export-pdf"));
    const menu = document.createElement("details");
    menu.id = "reportExportMenu";
    menu.className = "report-export-menu";
    menu.setAttribute("data-view-export-ignore", "1");
    menu.innerHTML = `<summary>Report / Export</summary><div class="report-export-popover"><p class="report-export-heading">Current visible view</p><button class="report-export-item" id="exportViewExcel" type="button">Excel</button><button class="report-export-item" id="exportViewPdf" type="button">PDF</button><button class="report-export-item" id="exportViewPpt" type="button">PowerPoint</button><div class="report-export-divider"></div><p class="report-export-heading">Master download</p><div class="report-export-full"></div></div>`;
    host.appendChild(menu);
    const fullHost = menu.querySelector(".report-export-full");
    fullControls.forEach(control => {
      control.classList.remove("export", "export-btn", "button-link");
      control.classList.add("report-export-item", "report-export-master");
      control.textContent = fullExportLabel(control);
      fullHost.appendChild(control);
    });
    document.getElementById("exportViewExcel").addEventListener("click", () => { menu.open = false; exportExcel(); });
    document.getElementById("exportViewPdf").addEventListener("click", () => { menu.open = false; printPdf(); });
    document.getElementById("exportViewPpt").addEventListener("click", () => { menu.open = false; exportPpt(); });
  }


  window.MBViewExport = { addButtons, exportExcel, exportPdf:printPdf, exportPpt };
  document.addEventListener("DOMContentLoaded", () => addButtons());
})();
