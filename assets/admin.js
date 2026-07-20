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
  const divisionSetupLog = document.getElementById("divisionSetupLog");
  const divisionSetupPreview = document.getElementById("divisionSetupPreview");
  const setupFileRows = document.getElementById("setupFileRows");
  let lastMbrlrPreview = null;
  let lastDivisionSetup = null;
  const divisionFileRoles = [
    ["Primary Unit Budget", "OBA/BG_ISL/RG budget by PU", "PU Wise {YEAR} Budget.xls/.xlsx", "data/source-files/{YEAR}/pu-budget.xls"],
    ["Primary Unit Month-wise Actual", "Actual expenditure month-wise by PU", "PU Wise Month Wise {YEAR} Actual.xls/.xlsx", "data/source-files/{YEAR}/pu-month-actual.xls"],
    ["PU-Dept-Demand-SMH Budget", "Department, demand and SMH budget mapping by PU", "SMH-DEMAND Wise PU wise Dept wise Month Wise {YEAR} Budget.xls/.xlsx", "data/source-files/{YEAR}/pu-dept-demand-smh-budget.xls"],
    ["PU-Dept-Demand-SMH Actual", "Department, demand and SMH actual expenditure by PU", "SMH-DEMAND Wise PU wise Dept wise Month Wise {YEAR} Actual.xls/.xlsx", "data/source-files/{YEAR}/pu-dept-demand-smh-actual.xls"],
    ["Demand / SMH Budget", "Demand / SMH wise budget summary", "SMH-DEMAND Wise {YEAR} Budget.xls/.xlsx", "data/source-files/{YEAR}/demand-smh-budget.xls"],
    ["Demand / SMH Actual", "Demand / SMH wise actual expenditure", "SMH-DEMAND WISE {YEAR} ACTUAL.xls/.xlsx", "data/source-files/{YEAR}/demand-smh-actual.xls"],
    ["FR Budget Status", "Fund Review statement for Open Line / GSU", "FR Budget Status as-on-date.xls/.xlsx", "data/fr/FR_Budget_Status.xlsx"]
  ];
  function isLocalApiMode(){ return window.location.protocol === "file:" || ["localhost","127.0.0.1"].includes(window.location.hostname); }
  function localOnlyMessage(){ return "This action needs the local upload server. Open the portal at http://127.0.0.1:8000/ from scripts/local-upload-server.py, then try again."; }
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
    if(!isLocalApiMode()) throw new Error(localOnlyMessage());
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
    throw lastError || new Error(localOnlyMessage());
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
  function safeSlug(value){
    return String(value || "").trim().replace(/[^A-Za-z0-9]+/g,"-").replace(/^-+|-+$/g,"").toUpperCase() || "DIVISION-BUDGET";
  }
  function setupValue(id){ return document.getElementById(id)?.value?.trim() || ""; }
  function setupConfig(){
    const currentYear = setupValue("setupCurrentYear") || "2026-2027";
    const division = setupValue("setupDivision") || "New Division";
    const repoName = setupValue("setupRepo") || `${safeSlug(division)}-BUDGET`;
    return {
      generatedAt: new Date().toISOString(),
      portalTemplate: "MB-BUDGET",
      railway: setupValue("setupRailway") || "Railway",
      division,
      department: setupValue("setupDepartment") || "Accounts Department",
      repoName,
      currentYear,
      previousYear: setupValue("setupPreviousYear") || "",
      completedPeriod: {
        label: setupValue("setupCompletedMonth") || "JUN 2026",
        monthCount: Number(setupValue("setupCompletedCount") || 3)
      },
      runningPeriod: {
        label: setupValue("setupRunningMonth") || "JUL 2026",
        monthCount: Number(setupValue("setupRunningCount") || 4)
      },
      sourceFiles: divisionFileRoles.map(([role, purpose, pattern, target]) => ({
        role,
        purpose,
        expectedFileName: pattern.replaceAll("{YEAR}", currentYear),
        parserTarget: target.replaceAll("{YEAR}", currentYear)
      })),
      setupSteps: []
    };
  }
  function setupSteps(config){
    return [
      `1. Create or clone a new GitHub repository named ${config.repoName}.`,
      "2. Copy the MB-BUDGET portal files into the new repository as the starting template.",
      `3. Replace visible branding with ${config.railway} / ${config.division} / ${config.department}.`,
      `4. Place previous year static files under data/source-files/${config.previousYear || "PREVIOUS-YEAR"}/ using the parser target names shown below.`,
      `5. Upload current year files for ${config.currentYear} through Data Upload Centre, or place them under data/source-files/${config.currentYear}/ with the same target names.`,
      `6. Confirm completed actual basis: ${config.completedPeriod.label} / ${config.completedPeriod.monthCount} months. Running month remains ${config.runningPeriod.label} / ${config.runningPeriod.monthCount} months only in till-date views.`,
      "7. Open Data Health and confirm source availability, Demand 12N / 10N handling, important PU list and export readiness.",
      "8. Generate Current/Previous, FR and DRM exports, then review the Authority Review Pack before sharing.",
      "9. Commit only after local verification and user/admin confirmation."
    ];
  }
  function renderSetupFileRows(){
    if(!setupFileRows) return;
    const year = setupValue("setupCurrentYear") || "2026-2027";
    setupFileRows.innerHTML = divisionFileRoles.map(([role, purpose, pattern, target]) => `<tr><td>${role}</td><td>${purpose}</td><td>${pattern.replaceAll("{YEAR}", year)}</td><td>${target.replaceAll("{YEAR}", year)}</td></tr>`).join("");
  }
  function buildDivisionSetup(){
    const config = setupConfig();
    config.setupSteps = setupSteps(config);
    lastDivisionSetup = config;
    divisionSetupPreview.innerHTML = `
      <div class="setup-summary">
        <div class="backup-card"><strong>Portal Identity</strong><span>${config.railway}<br>${config.division}<br>${config.department}</span></div>
        <div class="backup-card"><strong>Repository</strong><span>${config.repoName}</span></div>
        <div class="backup-card"><strong>Reporting Basis</strong><span>Completed: ${config.completedPeriod.label} (${config.completedPeriod.monthCount})<br>Running: ${config.runningPeriod.label} (${config.runningPeriod.monthCount})</span></div>
      </div>
      <h3>Step Process</h3>
      <ol>${config.setupSteps.map(step => `<li>${step.replace(/^\d+\.\s*/,"")}</li>`).join("")}</ol>
      <h3>Parser Mapping</h3>
      <table><thead><tr><th>Role</th><th>Expected File</th><th>Target Path</th></tr></thead><tbody>${config.sourceFiles.map(file => `<tr><td>${file.role}</td><td>${file.expectedFileName}</td><td>${file.parserTarget}</td></tr>`).join("")}</tbody></table>
    `;
    divisionSetupLog.textContent = `Setup plan ready for ${config.division}. Download JSON or copy step process for the new division.`;
  }
  function downloadDivisionSetup(){
    if(!lastDivisionSetup) buildDivisionSetup();
    const blob = new Blob([JSON.stringify(lastDivisionSetup,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeSlug(lastDivisionSetup.division)}-portal-setup.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    divisionSetupLog.textContent = "Division setup JSON downloaded.";
  }
  async function copyDivisionSteps(){
    if(!lastDivisionSetup) buildDivisionSetup();
    const text = [
      `${lastDivisionSetup.railway} - ${lastDivisionSetup.division} Budget Portal Setup`,
      "",
      ...lastDivisionSetup.setupSteps,
      "",
      "Required source files:",
      ...lastDivisionSetup.sourceFiles.map(file => `- ${file.role}: ${file.expectedFileName} -> ${file.parserTarget}`)
    ].join("\n");
    try{
      await navigator.clipboard.writeText(text);
      divisionSetupLog.textContent = "Step process copied to clipboard.";
    }catch(_error){
      divisionSetupLog.textContent = text;
    }
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
  document.getElementById("buildDivisionSetup")?.addEventListener("click",buildDivisionSetup);
  document.getElementById("downloadDivisionSetup")?.addEventListener("click",downloadDivisionSetup);
  document.getElementById("copyDivisionSteps")?.addEventListener("click",copyDivisionSteps);
  document.getElementById("resetDivisionSetup")?.addEventListener("click",()=>{["setupRailway","setupDivision","setupDepartment","setupRepo","setupCurrentYear","setupPreviousYear","setupCompletedMonth","setupCompletedCount","setupRunningMonth","setupRunningCount"].forEach(id=>{const el=document.getElementById(id); if(el) el.value=el.defaultValue;}); renderSetupFileRows(); buildDivisionSetup();});
  document.querySelectorAll("#setup input").forEach(input=>input.addEventListener("input",()=>{lastDivisionSetup=null; renderSetupFileRows();}));
  mbrlrYear?.addEventListener("input",()=>{lastMbrlrPreview=null; confirmMbrlrSync.disabled=true;});
  fillControls();
  renderSetupFileRows();
  if(!isLocalApiMode()){
    backupLog.textContent = localOnlyMessage();
    mbrlrLog.textContent = localOnlyMessage();
  }
})();

