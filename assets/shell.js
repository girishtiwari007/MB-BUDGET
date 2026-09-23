const frame=document.getElementById("contentFrame");
const home=document.getElementById("home");
const pages={fr:"pages/fr.html",current:"pages/current.html",reports:"pages/reports.html",yearly:"pages/yearly-review.html",status:"pages/status.html",exports:"pages/exports.html",ai:"pages/ai-insight.html",admin:"pages/admin.html"};
const externalPages={owe:"https://girishtiwari007.github.io/MBRLR/"};
function hardUrl(url){return `${url}${url.includes("?")?"&":"?"}fresh=${Date.now()}`;}
function applyFrameCustom(){
  try { if (frame.contentWindow?.MBBudgetCustom) frame.contentWindow.MBBudgetCustom.apply(frame.contentDocument); }
  catch {}
}
function showPage(page){
  if(externalPages[page]){
    window.open(externalPages[page],"_blank","noopener");
    return;
  }
  document.querySelectorAll("[data-page]").forEach(btn=>btn.classList.toggle("active",btn.dataset.page===page));
  if(page==="home"){
    home.style.display="block";
    frame.classList.remove("active");
    frame.removeAttribute("src");
    return;
  }
  home.style.display="none";
  frame.src=hardUrl(pages[page]);
  frame.classList.add("active");
}
frame.addEventListener("load",applyFrameCustom);
document.querySelectorAll("[data-page]").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));
document.querySelectorAll("[data-open]").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.open)));
window.addEventListener("storage",event=>{if(event.key==="mbBudgetPortalStyle")applyFrameCustom();});
showPage("home");
