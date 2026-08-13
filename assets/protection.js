(function(){
  const ADMIN_PASSWORD = "Moradabad@2026";
  const KEY = "mbBudgetProtectionUnlocked";
  const BYPASS = "mbBudgetProtectionBypass";
  const lockedMessage = "Protected portal view. Enter admin password to continue this action.";
  const protectedSelector = [
    "a[download]",
    "a[href$='.pdf']",
    "a[href$='.xlsx']",
    "a[href$='.xls']",
    "a[href$='.pptx']",
    "#exportExcel",
    "#exportPdf",
    "#exportPptx",
    "#exportReportExcel",
    "#exportReportPdf",
    "#copyReviewPack"
  ].join(",");

  function unlocked(){
    return sessionStorage.getItem(KEY) === "1";
  }

  function setUnlocked(){
    sessionStorage.setItem(KEY, "1");
    updateBadge();
  }

  function askPassword(reason){
    if (unlocked()) return true;
    const entered = window.prompt(reason || lockedMessage);
    if (entered === null) return false;
    if (entered === ADMIN_PASSWORD) {
      setUnlocked();
      return true;
    }
    window.alert("Incorrect password.");
    return false;
  }

  function isTypingTarget(target){
    const tag = String(target?.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
  }

  function blockContextMenu(event){
    if (unlocked()) return;
    event.preventDefault();
    window.alert("Right click is disabled in protected view. Use admin password to unlock protected actions.");
  }

  function blockKeys(event){
    if (unlocked() || isTypingTarget(event.target)) return;
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

  function shouldProtectClick(target){
    return target?.closest?.(protectedSelector);
  }

  function protectClick(event){
    const target = shouldProtectClick(event.target);
    if (!target || target.dataset[BYPASS] === "1" || unlocked()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!askPassword("Enter admin password to download/export or copy protected data.")) return;
    target.dataset[BYPASS] = "1";
    setTimeout(() => {
      target.click();
      setTimeout(() => delete target.dataset[BYPASS], 0);
    }, 0);
  }

  function updateBadge(){
    document.body?.classList.toggle("protection-unlocked", unlocked());
    const badge = document.getElementById("protectionBadge");
    if (!badge) return;
    badge.querySelector("strong").textContent = unlocked() ? "Unlocked" : "Protected";
    const button = badge.querySelector("button");
    button.textContent = unlocked() ? "Lock" : "Unlock";
  }

  function lock(){
    sessionStorage.removeItem(KEY);
    updateBadge();
  }

  function buildUi(){
    document.body.classList.add("protection-active");
    if (!document.getElementById("protectionBadge")) {
      const badge = document.createElement("div");
      badge.className = "protection-badge";
      badge.id = "protectionBadge";
      badge.innerHTML = `<span>View: <strong>Protected</strong></span><button type="button">Unlock</button>`;
      badge.querySelector("button").addEventListener("click", () => unlocked() ? lock() : askPassword("Enter admin password to unlock protected view."));
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
