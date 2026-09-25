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


  function cellText(cell){
    const dual = cell.querySelector?.(".dual-money");
    if (dual) {
      const thousand = clean(dual.querySelector(".thousand")?.textContent || "");
      const crore = clean(dual.querySelector(".crore")?.textContent || "");
      return [thousand, crore].filter(Boolean).join("\n");
    }
    const clone = cell.cloneNode(true);
    clone.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
    clone.querySelectorAll("small,.crore").forEach(node => node.before("\n"));
    return String(clone.textContent || "").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").replace(/\n{2,}/g, "\n").trim();
  }

  function safeRows(rows){
    return rows.map(row => row.map(cell => String(cell ?? "")));
  }

  function analysisRows(root = visibleRoot()){
    const selectors = [".remark-list li", ".ai-cell", ".note", ".subtitle", ".data-stamp", ".finance-guide article", ".analysis-context", ".ai-review li"];
    const seen = new Set();
    const rows = [["Remarks / Analysis"]];
    selectors.forEach(selector => {
      root.querySelectorAll(selector).forEach(node => {
        if (!visible(node)) return;
        const text = clean(node.textContent || "");
        if (text && text.length > 8 && !seen.has(text)) { seen.add(text); rows.push([text]); }
      });
    });
    if (rows.length === 1) rows.push([remarksText(root)]);
    return rows;
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
    return document.querySelector("#tableHost") || document.querySelector("#host") || document.querySelector("#reviewHost") || document.querySelector(".panel.active") || document.querySelector("main") || document.body;
  }

  function dataBasisText(){
    const candidates = [
      document.querySelector("#dataStamp"),
      document.querySelector("#reportDataStamp"),
      document.querySelector("#reviewStamp"),
      document.querySelector(".data-stamp")
    ];
    const text = clean(candidates.map(node => node?.textContent || "").find(Boolean) || "");
    return text || "Data basis: As displayed on portal";
  }

  function remarksText(root = visibleRoot()){
    const remarks = Array.from(root.querySelectorAll(".note,.small,.subtitle,p,div,span"))
      .map(node => clean(node.textContent || ""))
      .find(text => /Remarks\s*-\s*Figures/i.test(text));
    return remarks || "Remarks - Figures in '000' (thousands). Crore values are shown below where available.";
  }

  function compactContextRows(root = visibleRoot()){
    return [
      [pageTitle()],
      [dataBasisText()],
      [remarksText(root)],
      []
    ].filter(row => clean(row[0]));
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
    const basis = dataBasisText();
    const remarks = remarksText(active);
    return `<!doctype html><html><head><meta charset="utf-8"><title>${html(pageTitle())}</title>${exportStyles()}</head><body><main><h1>${html(pageTitle())}</h1><p class="view-meta">${html(basis)}<br>${html(remarks)}</p>${clone.outerHTML}</main></body></html>`;
  }

  function pdfEscape(value){ return String(value ?? "").replace(/[\\()]/g,"\\$&").replace(/[^\x20-\x7E]/g,"?"); }
  function pdfTextAt(x,y,text,size=8,bold=false){ return `BT /${bold?"F2":"F1"} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(text)}) Tj ET\n`; }
  function pdfLine(x1,y1,x2,y2){ return `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`; }
  function pdfRect(x,y,w,h,fill){ return fill ? `q ${fill} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f Q\n${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S\n` : `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S\n`; }
  function pdfWrap(text, maxChars, maxLines=3){ const raw=String(text||"").split(/\n/), out=[]; raw.forEach(part=>{ const words=part.split(/\s+/).filter(Boolean); let line=""; words.forEach(word=>{ if((line+" "+word).trim().length>maxChars){ if(line) out.push(line); line=word; } else line=(line+" "+word).trim(); }); out.push(line||""); }); return out.slice(0,maxLines); }
  function isRemarksSheet(sheet){
    return /remarks|analysis/i.test(sheet?.name || "") && Math.max(1, ...(sheet.rows || []).map(row => row.length)) <= 1;
  }

  function pdfNotePages(sheet){
    const rows = safeRows(sheet.rows || []), pages = [], pageW = 842, pageH = 595, margin = 18, lineH = 11, blockGap = 7;
    let y = pageH - margin - 42, content = "0 0 0 RG 0.6 w\n";
    function header(cont=false){
      content += pdfTextAt(margin, pageH - margin - 9, cont ? `${sheet.name} continued` : sheet.name, 14, true);
      content += pdfTextAt(margin, pageH - margin - 24, dataBasisText(), 7, false);
      content += pdfTextAt(margin, pageH - margin - 35, "Figures in '000 with Crore value below where shown. Current visible view export.", 7, false);
      y = pageH - margin - 52;
    }
    function close(){ pages.push(content); content = "0 0 0 RG 0.6 w\n"; header(true); }
    header(false);
    rows.forEach((row, index) => {
      const text = clean(row.join(" "));
      if (!text) return;
      const isHead = index === 0;
      const maxChars = isHead ? 88 : 118;
      const lines = pdfWrap(text, maxChars, isHead ? 2 : 6);
      const h = Math.max(18, lines.length * lineH + 8);
      if (y - h < margin) close();
      content += pdfRect(margin, y - h, pageW - margin * 2, h, isHead ? "0.122 0.306 0.475" : "0.91 0.95 0.98");
      content += isHead ? "1 1 1 rg\n" : "0 0 0 rg\n";
      lines.forEach((line, i) => { content += pdfTextAt(margin + 6, y - 12 - i * lineH, line, isHead ? 9 : 8, isHead); });
      y -= h + blockGap;
    });
    pages.push(content);
    return pages;
  }

  function pdfTablePages(sheet){
    if (isRemarksSheet(sheet)) return pdfNotePages(sheet);
    const rows=safeRows(sheet.rows||[]), pages=[], pageW=842, pageH=595, margin=18, tableW=pageW-margin*2, titleH=38;
    if(!rows.length) return [];
    const maxCols=Math.max(1,...rows.map(r=>r.length));
    const colW=Array.from({length:maxCols},(_,i)=>Math.max(44, Math.min(i===0?170:132, rows.reduce((m,r)=>Math.max(m, clean(r[i]).length), 0)*3.3+20)));
    const totalW=colW.reduce((a,b)=>a+b,0), scale=Math.min(1, tableW/totalW), widths=colW.map(w=>w*scale);
    const font=maxCols>10?5.6:maxCols>7?6.4:7.2, rowH=maxCols>9?22:24;
    let y=pageH-margin-titleH, content="";
    function startPage(cont=false){ content="0 0 0 RG 0.6 w\n"; content+=pdfTextAt(margin,pageH-margin-8,cont?`${sheet.name} continued`:sheet.name,13,true); content+=pdfTextAt(margin,pageH-margin-23,dataBasisText(),7,false); content+=pdfTextAt(margin,pageH-margin-34,"Figures in '000 with Crore value below where shown. Current visible view export.",7,false); y=pageH-margin-titleH; }
    function closePage(){ pages.push(content); }
    startPage(false);
    rows.forEach((row,rIndex)=>{
      if(y-rowH<margin){ closePage(); startPage(true); }
      let x=margin; const isHeader=rIndex===4 || rIndex===0 && rows.length>6;
      row.forEach((cell,c)=>{ const w=widths[c]||widths[0]; const fill=isHeader?"0.122 0.306 0.475":(rIndex%2?"0.91 0.95 0.98":"1 1 1"); content+=pdfRect(x,y-rowH,w,rowH,fill); const lines=pdfWrap(cell,Math.max(8,Math.floor(w/(font*0.50)))); content+=isHeader?"1 1 1 rg\n":"0 0 0 rg\n"; lines.forEach((line,i)=>{ content+=pdfTextAt(x+2,y-8-i*(font+1.7),line,i&&/Cr$/i.test(line)?Math.max(5,font-1):font,isHeader); }); x+=w; });
      y-=rowH;
    });
    closePage();
    return pages;
  }
  function pdfBlob(){
    const sheets=currentViewSheets(), pageStreams=[];
    sheets.forEach(sheet=>pageStreams.push(...pdfTablePages(sheet)));
    if(!pageStreams.length) pageStreams.push(pdfTextAt(40,560,pageTitle(),14,true));
    const objects=[], add=(body)=>{objects.push(body);return objects.length;}, catalog=add(""), pagesRef=add(""), font=add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>"), fontB=add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>"), pageRefs=[];
    pageStreams.forEach(content=>{const contentRef=add(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);pageRefs.push(add(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${font} 0 R /F2 ${fontB} 0 R >> >> /Contents ${contentRef} 0 R >>`));});
    objects[0]=`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;objects[1]=`<< /Type /Pages /Kids [${pageRefs.map(ref=>`${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;let out="%PDF-1.4\n", offsets=[0];objects.forEach((body,index)=>{offsets.push(encoder.encode(out).length);out+=`${index+1} 0 obj\n${body}\nendobj\n`;});const xref=encoder.encode(out).length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Blob([out],{type:"application/pdf"});
  }
  function printPdf(){download(pdfBlob(),`${pageTitle().replace(/[^A-Za-z0-9]+/g,"_")}_View_${fileStamp()}.pdf`);}
  function tableToAoa(table){
    return Array.from(table.rows || []).map(row => Array.from(row.cells || []).map(cell => cellText(cell)));
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
    const intro = compactContextRows(root);
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
    const remarks = analysisRows(root);
    if (remarks.length > 1) sheets.push({ name:"Remarks and Analysis", rows:[...compactContextRows(root), ...remarks] });
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

  function xlsxStyleFor(row, r, c){
    const rowText = clean((row || []).join(" ")).toLowerCase();
    const cellText = clean(row?.[c] || "").toLowerCase();
    if (r === 0) return 2;
    if (r < 4) return 3;
    if (r === 4) return 1;
    if (/total|grand total|subtotal/.test(rowText)) return 5;
    if (/remarks|analysis/.test(rowText) || /adverse|excess|risk|shortfall|surrender/.test(cellText)) return 8;
    if (c === 0) return 6;
    return r % 2 ? 4 : 0;
  }

  function worksheetXml(rows){
    const maxCols = Math.max(1, ...rows.map(row => row.length));
    const cols = Array.from({ length:maxCols }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(i === 0 ? 34 : 26, Math.max(i === 0 ? 16 : 12, rows.reduce((m,row)=>Math.max(m, clean(row[i]).length), 0) + 2))}" customWidth="1"/>`).join("");
    const sheetData = rows.map((row, r) => { const hasLines=row.some(cell=>String(cell||"").includes("\n")); return `<row r="${r + 1}" ht="${r < 3 ? 22 : hasLines ? 34 : 28}" customHeight="1">${row.map((cell, c) => `<c r="${columnName(c)}${r + 1}" t="inlineStr" s="${xlsxStyleFor(row,r,c)}"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`).join("")}</row>`; }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><cols>${cols}</cols><sheetData>${sheetData}</sheetData><pageMargins left="0.25" right="0.25" top="0.25" bottom="0.25" header="0.1" footer="0.1"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }

  function stylesXml(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><name val="Times New Roman"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Times New Roman"/></font><font><b/><color rgb="FF1F4E79"/><sz val="14"/><name val="Times New Roman"/></font><font><b/><color rgb="FF607080"/><sz val="10"/><name val="Times New Roman"/></font><font><b/><color rgb="FF7A1F00"/><sz val="11"/><name val="Times New Roman"/></font></fonts><fills count="10"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F2F8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FBFD"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAD3"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE7A8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFCE4D6"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/></patternFill></fill></fills><borders count="1"><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf fontId="0" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="1" fillId="5" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="0" fillId="6" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="4" fillId="7" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="4" fillId="8" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
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

  let pptShapeId = 2;
  function pptTextShape(text,x,y,w,h,size,bold,fill="FFFFFF",line="FFFFFF",color="17212B"){
    const paras=String(text||"").split("\n").map(lineText=>`<a:p><a:r><a:rPr lang="en-US" sz="${size}" b="${bold?1:0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Times New Roman"/></a:rPr><a:t>${xml(lineText)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`).join("");
    return `<p:sp><p:nvSpPr><p:cNvPr id="${pptShapeId++}" name="Text"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="45720" rIns="45720" tIns="22860" bIns="22860"/><a:lstStyle/>${paras}</p:txBody></p:sp>`;
  }

  function pptTableSlide(title, rows, part){
    const slideW=12192000, margin=320000, titleH=420000, top=780000, usableW=slideW-margin*2;
    const maxCols=Math.max(1,...rows.map(r=>r.length));
    const maxRows=maxCols>8?11:13;
    const shown=rows.slice(part*maxRows,(part+1)*maxRows);
    const cols=Math.max(1,...shown.map(r=>r.length));
    const colW=Math.floor(usableW/cols), rowH=Math.floor(5300000/Math.max(1,shown.length));
    let shapes=pptTextShape(part?`${title} (${part+1})`:title,margin,150000,usableW,titleH,2000,true,"FFFFFF","FFFFFF","1F4E79");
    shown.forEach((row,r)=>{ row.forEach((cell,c)=>{ const header=r===0 || (part===0 && r===4); const total=/total/i.test(row.join(" ")); const first=c===0&&!header; const fill=header?"1F4E79":total?"D9EAD3":first?"FFE7A8":(r%2?"E8F2F8":"FFFFFF"); const color=header?"FFFFFF":"17212B"; shapes+=pptTextShape(String(cell||""),margin+c*colW,top+r*rowH,colW,rowH,cols>8?680:800,header||total,fill,"000000",color); }); });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  }

  function pptThemeXml(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="MB Budget"><a:themeElements><a:clrScheme name="MB Budget"><a:dk1><a:srgbClr val="17212B"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F4E79"/></a:dk2><a:lt2><a:srgbClr val="E8F2F8"/></a:lt2><a:accent1><a:srgbClr val="1F4E79"/></a:accent1><a:accent2><a:srgbClr val="007C7C"/></a:accent2><a:accent3><a:srgbClr val="D9EAD3"/></a:accent3><a:accent4><a:srgbClr val="FFE7A8"/></a:accent4><a:accent5><a:srgbClr val="C00000"/></a:accent5><a:accent6><a:srgbClr val="607080"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Times"><a:majorFont><a:latin typeface="Times New Roman"/></a:majorFont><a:minorFont><a:latin typeface="Times New Roman"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
  }

  function pptLayoutXml(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  }

  function pptMasterXml(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
  }

  function pptxBlob(){
    pptShapeId = 2;
    const sheets=currentViewSheets(),slides=[];
    sheets.forEach(sheet=>{const rows=safeRows(sheet.rows||[]);const maxCols=Math.max(1,...rows.map(r=>r.length));const chunk=maxCols>8?11:13;const chunks=Math.max(1,Math.ceil(rows.length/chunk));for(let i=0;i<chunks;i++)slides.push({title:sheet.name,rows,part:i});});
    if(!slides.length)slides.push({title:pageTitle(),rows:[[dataBasisText()],[remarksText()]],part:0});
    const files=[
      {name:"[Content_Types].xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`},
      {name:"_rels/.rels",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`},
      {name:"ppt/presentation.xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+1}"/>`).join("")}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>`},
      {name:"ppt/_rels/presentation.xml.rels",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slides.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i+1}.xml"/>`).join("")}</Relationships>`},
      {name:"ppt/slideMasters/slideMaster1.xml",content:pptMasterXml()},
      {name:"ppt/slideMasters/_rels/slideMaster1.xml.rels",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`},
      {name:"ppt/slideLayouts/slideLayout1.xml",content:pptLayoutXml()},
      {name:"ppt/slideLayouts/_rels/slideLayout1.xml.rels",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`},
      {name:"ppt/theme/theme1.xml",content:pptThemeXml()},
      ...slides.map((slide,i)=>({name:`ppt/slides/slide${i+1}.xml`,content:pptTableSlide(slide.title,slide.rows,slide.part)})),
      ...slides.map((_,i)=>({name:`ppt/slides/_rels/slide${i+1}.xml.rels`,content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`}))
    ];
    return zip(files,"application/vnd.openxmlformats-officedocument.presentationml.presentation");
  }
  function exportPpt(){download(pptxBlob(),`${pageTitle().replace(/[^A-Za-z0-9]+/g,"_")}_View_${fileStamp()}.pptx`);}
  function fullExportTargets(){
    return {
      excel: document.querySelector("#exportExcel,#exportReportExcel,#export-all"),
      pdf: document.querySelector("#exportPdf,#exportReportPdf,#export-pdf"),
      ppt: document.querySelector("#exportPptx")
    };
  }

  function forwardFullExport(kind){
    const target = fullExportTargets()[kind];
    if (!target) return;
    target.dataset.mbBudgetProtectionBypass = "1";
    target.click();
    setTimeout(() => delete target.dataset.mbBudgetProtectionBypass, 0);
  }

  function exportMenuHtml(targets){
    const fullRows = [
      targets.excel ? `<button class="view-export-menu-item" type="button" data-export-menu="full-excel">Excel - full dataset</button>` : "",
      targets.pdf ? `<button class="view-export-menu-item" type="button" data-export-menu="full-pdf">PDF - full report</button>` : "",
      targets.ppt ? `<button class="view-export-menu-item" type="button" data-export-menu="full-ppt">PowerPoint - full report</button>` : ""
    ].filter(Boolean).join("");
    return `<span class="view-export-label">REPORT / EXPORT</span>
      <details class="view-export-menu">
        <summary>Select export...</summary>
        <div class="view-export-popover">
          <div class="view-export-heading">Current visible view</div>
          <button class="view-export-menu-item view-export" id="exportViewExcel" type="button" data-export-menu="view-excel">Excel - current visible view</button>
          <button class="view-export-menu-item view-export" id="exportViewPdf" type="button" data-export-menu="view-pdf">PDF - current visible view</button>
          <button class="view-export-menu-item view-export" id="exportViewPpt" type="button" data-export-menu="view-ppt">PowerPoint - current visible view</button>
          ${fullRows ? `<div class="view-export-heading">Download Full Dataset / Full Report</div>${fullRows.replace(/class="view-export-menu-item"/g, 'class="view-export-menu-item view-export"')}` : ""}
        </div>
      </details>`;
  }

  function addButtons(options = {}){
    if (document.getElementById("exportViewPdf") || document.getElementById("exportBoard")) return;
    const host = document.querySelector(options.host || ".actions,.header-actions,.hero,.pack-head") || document.body;
    const targets = fullExportTargets();
    const masters = Object.values(targets).filter(Boolean);
    masters.forEach(control => { control.hidden = true; control.setAttribute("aria-hidden", "true"); });
    const wrap = document.createElement("span");
    wrap.className = "view-export-actions";
    wrap.setAttribute("data-view-export-ignore", "1");
    wrap.innerHTML = exportMenuHtml(targets);
    host.appendChild(wrap);
    wrap.addEventListener("click", (event) => {
      const item = event.target.closest("[data-export-menu]");
      if (!item) return;
      const menu = wrap.querySelector(".view-export-menu");
      if (menu) menu.open = false;
      const action = item.dataset.exportMenu;
      if (action === "view-excel") exportExcel();
      if (action === "view-pdf") printPdf();
      if (action === "view-ppt") exportPpt();
      if (action === "full-excel") forwardFullExport("excel");
      if (action === "full-pdf") forwardFullExport("pdf");
      if (action === "full-ppt") forwardFullExport("ppt");
    });
  }


  window.MBViewExport = { addButtons, exportExcel, exportPdf:printPdf, exportPpt };
  document.addEventListener("DOMContentLoaded", () => addButtons());
})();
