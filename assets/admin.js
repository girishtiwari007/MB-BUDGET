(function(){
  const defaults = {
    font:{family:"Calibri, Arial, sans-serif",base:"14"},
    headings:{main:"21",align:"center",color:"#1f4e79"},
    page:{background:"#eef3f7",accent:"#1f4e79",danger:"#b71c1c"},
    table:{size:"12",padding:"4",header:"#1f4e79",headerText:"#ffffff",alt:"#e8f2f8",total:"#c8d6e8"}
  };
  let unlocked = false;
  let password = "";
  const app = document.getElementById("adminApp");
  const locked = document.getElementById("lockedPanel");
  const lockState = document.getElementById("lockState");
  const backupLog = document.getElementById("backupLog");
  const mbrlrYear = document.getElementById("mbrlrYear");
  const mbrlrSummary = document.getElementById("mbrlrSummary");
  const mbrlrPreview = document.getElementById("mbrlrPreview");
  const mbrlrLog = document.getElementById("mbrlrLog");
  const confirmMbrlrSync = document.getElementById("confirmMbrlrSync");
  let lastMbrlrPreview = null;
  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function readSettings(){ return Object.assign(clone(defaults), window.MBBudgetCustom?.settings() || {}); }
  function getPath(obj,path){ return path.split(".").reduce((acc,key)=>acc?.[key],obj); }
  function setPath(obj,path,value){ const parts=path.split("."); let cur=obj; parts.slice(0,-1).forEach(key=>cur=cur[key]||(cur[key]={})); cur[parts.at(-1)]=String(value); }
  function fillControls(){ const s=readSettings(); document.querySelectorAll("[data-setting]").forEach(input=>{ input.value=getPath(s,input.dataset.setting) || ""; }); applyPreview(s); }
  function collect(){ const s=clone(defaults); document.querySelectorAll("[data-setting]").forEach(input=>setPath(s,input.dataset.setting,input.value)); return s; }
  function save(){ const s=collect(); localStorage.setItem(window.MBBudgetCustom.key,JSON.stringify(s)); window.MBBudgetCustom.apply(document); applyPreview(s); backupLog.textContent="Style applied locally. Open or reload portal tabs to see updated look."; }
  function applyPreview(s){ const box=document.getElementById("previewBox"); let tag=document.getElementById("previewStyle"); if(!tag){tag=document.createElement("style");tag.id="previewStyle";document.head.appendChild(tag);} tag.textContent=`#previewBox{font-family:${s.font.family};font-size:${s.font.base}px;background:${s.page.background}}#previewBox h1{font-size:${s.headings.main}px;color:${s.headings.color};text-align:${s.headings.align}}#previewBox th{background:${s.table.header};color:${s.table.headerText}}#previewBox table{font-size:${s.table.size}px}#previewBox td,#previewBox th{padding:${s.table.padding}px ${Number(s.table.padding)+1}px}#previewBox tbody tr:nth-child(even) td{background:${s.table.alt}}#previewBox tr.total td{background:${s.table.total}}`; }
  function apiUrl(path){
    const localApi = "http://127.0.0.1:8000";
    if (window.location.protocol === "file:") return `${localApi}${path}`;
    if (!window.location.origin || window.location.origin === "null") return `${localApi}${path}`;
    return `${window.location.origin}${path}`;
  }
  async function postForm(path, form){
    const localApi = "http://127.0.0.1:8000";
    const urls = [apiUrl(path), `${localApi}${path}`, path, `..${path}`];
    let lastError = null;
    for (const url of urls) {
      try {
        return await fetch(url,{method:"POST",body:form});
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Local API unavailable. Open portal through http://127.0.0.1:8000/.");
  }
  async function auth(){
    if(unlocked) return true;
    const entered = window.prompt("Enter admin password");
    if(entered === null) return false;
    const form = new FormData(); form.append("password",entered);
    try{
      const response = await postForm("/api/upload-auth", form);
      if(!response.ok) throw new Error("Incorrect password.");
      unlocked=true; password=entered; app.hidden=false; locked.hidden=true; lockState.textContent="Admin Unlocked"; fillControls(); return true;
    }catch(error){ window.alert(error.message || "Incorrect password."); return false; }
  }
  function showTab(tab){ document.querySelectorAll("[data-admin-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.adminTab===tab)); document.querySelectorAll(".admin-panel").forEach(panel=>panel.classList.toggle("active",panel.id===tab)); }
  async function downloadBackup(){
    if(!await auth()) return;
    backupLog.textContent="Preparing complete portal backup zip...";
    const form = new FormData(); form.append("password",password);
    try{
      const response = await postForm("/api/portal-backup", form);
      if(!response.ok){ const payload=await response.json().catch(()=>({error:"Backup failed"})); throw new Error(payload.error || "Backup failed"); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href=url; a.download=`MB-BUDGET-portal-backup-${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      backupLog.textContent="Backup zip generated and downloaded.";
    }catch(error){ backupLog.textContent=error.message; }
  }
  function fmtSize(bytes){
    if(!Number.isFinite(Number(bytes))) return "";
    const value = Number(bytes);
    if(value >= 1024*1024) return `${(value/1024/1024).toFixed(1)} MB`;
    if(value >= 1024) return `${(value/1024).toFixed(1)} KB`;
    return `${value} B`;
  }
  function isDefaultMbrlrFile(row){
    const target = row.targetPath || row.target || "";
    return target.includes("processed/current_payload.js") || target.includes("processed/reports-data.json") || target.includes("processed/year-sources.json") || target.includes("source-files/");
  }
  function selectedMbrlrTargets(){
    return Array.from(document.querySelectorAll("[data-sync-target]:checked")).map(input=>input.dataset.syncTarget);
  }
  function updateMbrlrSelectionState(){
    const selected = selectedMbrlrTargets();
    confirmMbrlrSync.disabled = !lastMbrlrPreview || selected.length === 0;
    const count = document.getElementById("mbrlrSelectedCount");
    if(count) count.textContent = `${selected.length} selected`;
  }
  function setMbrlrSelection(mode){
    document.querySelectorAll("[data-sync-target]").forEach(input=>{
      if(mode === "all") input.checked = true;
      if(mode === "none") input.checked = false;
      if(mode === "essentials") input.checked = input.dataset.syncDefault === "1";
    });
    updateMbrlrSelectionState();
  }
  function renderSyncGroup(title, rows){
    if(!rows || !rows.length) return `<section><h3>${title}</h3><p class="hint">No files found.</p></section>`;
    return `<section><h3>${title}</h3><table><thead><tr><th>Sync</th><th>File</th><th>Target</th><th>Size</th></tr></thead><tbody>${rows.map(row=>{const target=row.targetPath || row.target || ""; const checked=isDefaultMbrlrFile(row) ? "checked" : ""; const def=isDefaultMbrlrFile(row) ? "1" : "0"; return `<tr><td><input type="checkbox" data-sync-target="${target}" data-sync-default="${def}" ${checked}></td><td>${row.name || row.source || "File"}</td><td>${target}</td><td>${fmtSize(row.size)}</td></tr>`;}).join("")}</tbody></table></section>`;
  }
  function renderMbrlrPlan(plan){
    lastMbrlrPreview = plan;
    confirmMbrlrSync.disabled = true;
    mbrlrSummary.innerHTML = `
      <div class="backup-card"><strong>Source</strong><span>${plan.sourceRepo}</span></div>
      <div class="backup-card"><strong>Target</strong><span>${plan.targetFolder}</span></div>
      <div class="backup-card"><strong>Files</strong><span>${plan.counts.totalFiles} total: ${plan.counts.sourceFiles} source, ${plan.counts.processedFiles} processed, ${plan.counts.frFiles} FR, 2 manifest/log</span></div>`;
    const warnings = plan.warnings?.length ? `<div class="sync-warning"><strong>Warnings</strong><ul>${plan.warnings.map(w=>`<li>${w}</li>`).join("")}</ul></div>` : "";
    mbrlrPreview.innerHTML = `${warnings}<div class="sync-selectbar"><strong id="mbrlrSelectedCount">0 selected</strong><button class="secondary" type="button" data-sync-select="essentials">MBRLR Essentials</button><button class="secondary" type="button" data-sync-select="all">Select All</button><button class="secondary" type="button" data-sync-select="none">Clear</button></div>${renderSyncGroup("Current year source files", plan.sourceFiles)}${renderSyncGroup("Processed portal data", plan.processedFiles)}${renderSyncGroup("FR data", plan.frFiles)}<section><h3>Generated audit files</h3><p class="hint">sync-manifest.json and sync-log.json are always updated for whichever files you select.</p></section>`;
    mbrlrPreview.querySelectorAll("[data-sync-target]").forEach(input=>input.addEventListener("change",updateMbrlrSelectionState));
    mbrlrPreview.querySelectorAll("[data-sync-select]").forEach(btn=>btn.addEventListener("click",()=>setMbrlrSelection(btn.dataset.syncSelect)));
    updateMbrlrSelectionState();
    mbrlrLog.textContent = `Preview ready for ${plan.financialYear}. Select only files MBRLR needs, then Confirm Sync. It will not commit or push to GitHub.`;
  }
  async function previewMbrlrSync(){
    if(!await auth()) return;
    confirmMbrlrSync.disabled = true;
    mbrlrLog.textContent = "Preparing MBRLR sync preview...";
    const form = new FormData();
    form.append("password", password);
    form.append("year", mbrlrYear.value || "2026-2027");
    try{
      const response = await postForm("/api/mbrlr-sync-preview", form);
      const payload = await response.json().catch(()=>({error:"Preview failed"}));
      if(!response.ok) throw new Error(payload.error || "Preview failed");
      renderMbrlrPlan(payload);
    }catch(error){
      lastMbrlrPreview = null;
      confirmMbrlrSync.disabled = true;
      mbrlrLog.textContent = error.message || "Preview failed.";
    }
  }
  async function confirmMbrlrSyncRun(){
    if(!lastMbrlrPreview) { await previewMbrlrSync(); if(!lastMbrlrPreview) return; }
    if(!await auth()) return;
    const selectedTargets = selectedMbrlrTargets();
    if(!selectedTargets.length){ mbrlrLog.textContent = "Select at least one file to sync."; return; }
    const ok = window.confirm(`Copy ${selectedTargets.length} selected files into MBRLR data folder now? This will not commit or push.`);
    if(!ok) return;
    mbrlrLog.textContent = "Copying files to MBRLR...";
    const form = new FormData();
    form.append("password", password);
    form.append("year", mbrlrYear.value || "2026-2027");
    form.append("selectedTargets", JSON.stringify(selectedTargets));
    try{
      const response = await postForm("/api/mbrlr-sync-confirm", form);
      const payload = await response.json().catch(()=>({error:"Sync failed"}));
      if(!response.ok) throw new Error(payload.error || "Sync failed");
      confirmMbrlrSync.disabled = true;
      mbrlrLog.textContent = `Sync complete. Copied ${payload.copiedFiles.length} files.\nTarget: ${payload.targetFolder}\nManifest: ${payload.manifest}\nLog: ${payload.log}${payload.warnings?.length ? "\nWarnings: " + payload.warnings.join("; ") : ""}`;
      mbrlrPreview.innerHTML = renderSyncGroup("Copied files", payload.copiedFiles);
    }catch(error){
      mbrlrLog.textContent = error.message || "Sync failed.";
    }
  }
  document.getElementById("unlockAdmin").addEventListener("click",auth);
  lockState.addEventListener("click",auth);
  document.querySelectorAll("[data-admin-tab]").forEach(btn=>btn.addEventListener("click",()=>showTab(btn.dataset.adminTab)));
  document.querySelectorAll("[data-setting]").forEach(input=>input.addEventListener("input",()=>applyPreview(collect())));
  document.getElementById("saveStyle").addEventListener("click",save);
  document.getElementById("resetStyle").addEventListener("click",()=>{localStorage.removeItem(window.MBBudgetCustom.key); fillControls(); window.MBBudgetCustom.apply(document);});
  document.getElementById("exportStyle").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(collect(),null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="portal-style-settings.json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);});
  document.getElementById("downloadBackup").addEventListener("click",downloadBackup);
  document.getElementById("previewMbrlrSync")?.addEventListener("click",previewMbrlrSync);
  document.getElementById("confirmMbrlrSync")?.addEventListener("click",confirmMbrlrSyncRun);
  mbrlrYear?.addEventListener("input",()=>{lastMbrlrPreview=null; confirmMbrlrSync.disabled=true;});
  fillControls();
})();

