(function(){
  const ADMIN_KEY = "mbBudgetProtectionUnlocked";
  const BYPASS = "mbBudgetProtectionBypass";
  const EXPORT_PASSWORD = "#1";
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
    "#exportViewExcel",
    "#exportViewPdf",
    "#exportViewPpt",
    "#export-all",
    "#export-pdf",
    "#copyReviewPack",
    ".view-export",
    "[data-quarter-export]"
  ].join(",");

  function adminUnlocked(){
    return sessionStorage.getItem(ADMIN_KEY) === "1";
  }

  function exportUnlocked(){
    return adminUnlocked();
  }

  function setAdminUnlocked(){
    sessionStorage.setItem(ADMIN_KEY, "1");
    updateProtectionState();
  }

  function askAdminPassword(){
    if (adminUnlocked()) return true;
    window.alert("Protected actions require local Admin Portal authentication. Open this portal through the local upload server and unlock Admin Portal.");
    return false;
  }

  function askExportPassword(){
    if (exportUnlocked()) return true;
    const entered = window.prompt("Exports/downloads are protected. Enter export password.");
    if (entered === EXPORT_PASSWORD) return true;
    window.alert("Export cancelled. Wrong export password.");
    return false;
  }

  function isTypingTarget(target){
    const tag = String(target?.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
  }

  function blockContextMenu(event){
    if (adminUnlocked()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.alert("Right click is disabled in protected view.");
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
    event.stopImmediatePropagation();
  }

  function exportTarget(target){
    return target?.closest?.(exportSelector);
  }

  function protectClick(event){
    const target = exportTarget(event.target);
    if (!target || target.dataset[BYPASS] === "1" || exportUnlocked()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!askExportPassword()) return;
    target.dataset[BYPASS] = "1";
    setTimeout(() => {
      target.click();
      setTimeout(() => delete target.dataset[BYPASS], 0);
    }, 0);
  }

  function removeProtectionBadges(){
    document.querySelectorAll("#protectionBadge,.protection-badge").forEach((node) => node.remove());
  }

  function updateProtectionState(){
    document.body?.classList.toggle("protection-unlocked", adminUnlocked());
    removeProtectionBadges();
  }

  function lock(){
    sessionStorage.removeItem(ADMIN_KEY);
    updateProtectionState();
  }

  function buildUi(){
    document.body.classList.add("protection-active");
    updateProtectionState();
  }

  window.MBBudgetProtection = Object.assign(window.MBBudgetProtection || {}, {
    askAdminPassword,
    askExportPassword,
    lock,
    setAdminUnlocked,
    updateProtectionState
  });

  document.addEventListener("contextmenu", blockContextMenu, true);
  document.addEventListener("keydown", blockKeys, true);
  document.addEventListener("click", protectClick, true);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUi);
  } else {
    buildUi();
  }
})();
