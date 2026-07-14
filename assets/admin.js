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
  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function readSettings(){ return Object.assign(clone(defaults), window.MBBudgetCustom?.settings() || {}); }
  function getPath(obj,path){ return path.split(".").reduce((acc,key)=>acc?.[key],obj); }
  function setPath(obj,path,value){ const parts=path.split("."); let cur=obj; parts.slice(0,-1).forEach(key=>cur=cur[key]||(cur[key]={})); cur[parts.at(-1)]=String(value); }
  function fillControls(){ const s=readSettings(); document.querySelectorAll("[data-setting]").forEach(input=>{ input.value=getPath(s,input.dataset.setting) || ""; }); applyPreview(s); }
  function collect(){ const s=clone(defaults); document.querySelectorAll("[data-setting]").forEach(input=>setPath(s,input.dataset.setting,input.value)); return s; }
  function save(){ const s=collect(); localStorage.setItem(window.MBBudgetCustom.key,JSON.stringify(s)); window.MBBudgetCustom.apply(document); applyPreview(s); backupLog.textContent="Style applied locally. Open or reload portal tabs to see updated look."; }
  function applyPreview(s){ const box=document.getElementById("previewBox"); let tag=document.getElementById("previewStyle"); if(!tag){tag=document.createElement("style");tag.id="previewStyle";document.head.appendChild(tag);} tag.textContent=`#previewBox{font-family:${s.font.family};font-size:${s.font.base}px;background:${s.page.background}}#previewBox h1{font-size:${s.headings.main}px;color:${s.headings.color};text-align:${s.headings.align}}#previewBox th{background:${s.table.header};color:${s.table.headerText}}#previewBox table{font-size:${s.table.size}px}#previewBox td,#previewBox th{padding:${s.table.padding}px ${Number(s.table.padding)+1}px}#previewBox tbody tr:nth-child(even) td{background:${s.table.alt}}#previewBox tr.total td{background:${s.table.total}}`; }
  function apiUrl(path){
    return `${window.location.origin}${path}`;
  }
  async function postForm(path, form){
    const urls = [apiUrl(path), path, `..${path}`];
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
  document.getElementById("unlockAdmin").addEventListener("click",auth);
  lockState.addEventListener("click",auth);
  document.querySelectorAll("[data-admin-tab]").forEach(btn=>btn.addEventListener("click",()=>showTab(btn.dataset.adminTab)));
  document.querySelectorAll("[data-setting]").forEach(input=>input.addEventListener("input",()=>applyPreview(collect())));
  document.getElementById("saveStyle").addEventListener("click",save);
  document.getElementById("resetStyle").addEventListener("click",()=>{localStorage.removeItem(window.MBBudgetCustom.key); fillControls(); window.MBBudgetCustom.apply(document);});
  document.getElementById("exportStyle").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(collect(),null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="portal-style-settings.json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);});
  document.getElementById("downloadBackup").addEventListener("click",downloadBackup);
  fillControls();
})();

