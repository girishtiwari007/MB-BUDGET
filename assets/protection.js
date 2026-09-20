(function(){
  const ADMIN_KEY = "mbBudgetProtectionUnlocked";
  const EXPORT_KEY = "mbBudgetExportUnlocked";
  const BYPASS = "mbBudgetProtectionBypass";
  const lockedMessage = "Protected portal view. Enter admin password to continue this action.";
  const exportSelector = [
    "a[href*='.pdf']",
    "a[href*='.xlsx']",
    "a[href*='.xls']",
    "a[href*='.pptx']",
    "#exportExcel",
    "#exportPdf",
    "#exportPptx",
    "#exportReportExcel",
    "#exportReportPdf",
    "#exportLogicPdf",
    "#export-all",
    "#export-pdf",
    "#copyReviewPack"
  ].join(",");

  function adminUnlocked(){
    return sessionStorage.getItem(ADMIN_KEY) === "1";
  }

  function exportUnlocked(){
    return sessionStorage.getItem(EXPORT_KEY) === "1" || adminUnlocked();
  }

  function isHostedPortal(){
    return !["localhost", "127.0.0.1"].includes(location.hostname) && location.protocol !== "file:";
  }

  function setAdminUnlocked(){
    sessionStorage.setItem(ADMIN_KEY, "1");
    updateBadge();
  }

  function setExportUnlocked(){
    sessionStorage.setItem(EXPORT_KEY, "1");
  }

  function askAdminPassword(reason){
    if (adminUnlocked()) return true;
    window.alert("Protected actions require local Admin Portal authentication. Open this portal through the local upload server and unlock Admin Portal.");
    return false;
  }

  function askExportPassword(reason){
    // Generated reports are published portal artefacts. GitHub Pages cannot
    // perform local-admin authentication, so hosted visitors may download them.
    if (isHostedPortal()) return true;
    if (exportUnlocked()) return true;
    window.alert("Exports require local Admin Portal authentication.");
    return false;
  }

  function isTypingTarget(target){
    const tag = String(target?.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
  }

  function blockContextMenu(event){
    if (adminUnlocked()) return;
    event.preventDefault();
    window.alert("Right click is disabled in protected view. Use admin password to unlock protected actions.");
  }

  function blockKeys(event){
    if (adminUnlocked() || isTypingTarget(event.target)) return;
    const key = String(event.key || "").toLowerCase();
    const blocked =
      key === "f12" ||
      (event.ctrlKey && key === "s") ||
      (event.ctrlKey && key === "u") ||
      (event.ctrlKey && key === "p") ||
      (event.ctrlKey && event.shiftKey && ["i","j","c"].includes(key));
    if (!blocked) return;
    event.preventDefault();
    window.alert("This shortcut is disabled in protected view.");
  }

  function exportTarget(target){
    return target?.closest?.(exportSelector);
  }

  function protectClick(event){
    const target = exportTarget(event.target);
    if (!target || isHostedPortal() || target.dataset[BYPASS] === "1" || exportUnlocked()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!askExportPassword("Enter export password to download/export files.")) return;
    target.dataset[BYPASS] = "1";
    setTimeout(() => {
      target.click();
      setTimeout(() => delete target.dataset[BYPASS], 0);
    }, 0);
  }

  function updateBadge(){
    document.body?.classList.toggle("protection-unlocked", adminUnlocked());
    const badge = document.getElementById("protectionBadge");
    if (!badge) return;
    badge.querySelector("strong").textContent = adminUnlocked() ? "Unlocked" : "Protected";
    const button = badge.querySelector("button");
    button.textContent = adminUnlocked() ? "Lock" : "Unlock";
  }

  function lock(){
    sessionStorage.removeItem(ADMIN_KEY);
    updateBadge();
  }

  function buildUi(){
    document.body.classList.add("protection-active");
    if (!document.getElementById("protectionBadge")) {
      const badge = document.createElement("div");
      badge.className = "protection-badge";
      badge.id = "protectionBadge";
      badge.innerHTML = `<span>View: <strong>Protected</strong></span><button type="button">Unlock</button>`;
      badge.querySelector("button").addEventListener("click", () => adminUnlocked() ? lock() : askAdminPassword("Enter admin password to unlock protected view."));
      document.body.appendChild(badge);
    }
    updateBadge();
  }

  document.addEventListener("contextmenu", blockContextMenu, true);
  document.addEventListener("keydown", blockKeys, true);
  document.addEventListener("click", protectClick, true);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUi);
  } else {
    buildUi();
  }
})();
