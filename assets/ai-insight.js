(function(){
  const current=window.CURRENT_PAYLOAD||{}, reports=window.REPORTS_DATA||{}, meta=window.CURRENT_PAYLOAD_META||{};
  const $=id=>document.getElementById(id), num=value=>Number(value||0), fmt=value=>num(value).toLocaleString("en-IN"), money=value=>`${fmt(value)} (${(num(value)/10000).toLocaleString("en-IN",{maximumFractionDigits:2})} Cr)`;
  const tabs={current:[["demand","Demand / SMH"],["staff","PU Staff"],["nonstaff","PU Non-Staff"],["pu_prev","PU Previous-Year Comparison"],["demand_prev","Demand / SMH Previous-Year Comparison"]],fouryear:[["pu","Primary Unit"],["demand","Demand / SMH"],["dept","Department"]],fr:[["fr","FR plan-head and fund review"]],yearly:[["yearly","Month / Quarter / Year review"]]};
  const label=(options,key)=>options.find(([value])=>value===key)?.[1]||key;
  const clean=rows=>(rows||[]).filter(row=>!/^total$/i.test(String(row.Name||""))&&!/12N|10N|suspense/i.test(String(row.Name||"")));
  const top=(rows,key,count=5)=>[...rows].sort((a,b)=>num(b[key])-num(a[key])).slice(0,count);
  const metric=(name,value,tone="")=>`<article class="metric ${tone}"><span>${name}</span><strong>${value}</strong></article>`;
  const signal=(tone,title,text)=>`<article class="signal ${tone}"><span>${tone==="critical"?"Attention":tone==="watch"?"Watch":"On track"}</span><h3>${title}</h3><p>${text}</p></article>`;
  const evidence=(title,rows,key,text)=>`<section class="evidence"><div class="section-title"><h2>${title}</h2><span>Ranked from the synced portal view</span></div><ol>${rows.map((row,index)=>{const value=key==="BPPercent"?`${num(row[key]).toFixed(1)}%`:key?money(row[key]):row.value;return `<li><b>${index+1}</b><strong>${row.Name||row.label||"Item"}</strong><span>${text||"Value"}: ${value}</span></li>`;}).join("")||"<li>No source rows are available for this selection.</li>"}</ol></section>`;
  const reviewFrame=(title,sub,metrics,signals,evidenceHtml)=>`<section class="review-title"><div><h2>${title}</h2><p>${sub}</p></div><span>Rule-based review</span></section><section class="insight-metrics">${metrics}</section><section class="signal-board">${signals}</section>${evidenceHtml}`;

  function currentReview(key){
    const rows=current[key]?.rows||[], visible=clean(rows), total=rows.find(row=>/^total$/i.test(String(row.Name||"")))||{};
    const actualKey=key.includes("prev")?"AECurrent":"AE", budgetKey=key.includes("prev")?"BP":"BP";
    const largest=top(visible,actualKey), attention=top(visible.filter(row=>num(row.BPPercent)>100),"BPPercent"), basis=meta.basis||"Completed actual month";
    const largestText=largest[0]?`${largest[0].Name} is the largest visible actual-expenditure item at ${money(largest[0][actualKey])}.`:"No visible expenditure item is available.";
    return reviewFrame(
      `${label(tabs.current,key)} review`,
      `Active portal tab only · ${basis}. Rankings exclude Total and suspense rows.`,
      metric("Visible rows",visible.length)+metric("Actual expenditure",money(total[actualKey]),"value")+metric("Budget proportion",money(total[budgetKey]),"value")+metric("Utilisation",`${num(total.BPPercent).toFixed(1)}%`,num(total.BPPercent)>100?"alert":""),
      signal("info","Largest visible item",largestText)+signal(attention.length?"critical":"good",attention.length?`${attention.length} item(s) above budget proportion`:"No visible item above budget proportion",attention.length?`${attention[0].Name} is at ${num(attention[0].BPPercent).toFixed(1)}% budget proportion.`:"The displayed rows remain within the available budget proportion.")+signal("watch","Reporting basis",`${basis}. Use the current page filters before exporting a view.`),
      evidence("Largest visible actual expenditure",largest,actualKey,"Actual")+evidence("Budget-proportion attention",attention,"BPPercent","BP utilisation")
    );
  }

  function fourYearReview(scope){
    const years=reports.years||[], latest=years.at(-1)?.fy, source=reports.monthly?.[scope]||{};
    const rows=Object.entries(source).filter(([name])=>!/^total$/i.test(name)).map(([Name,series])=>({Name,AE:(series?.[latest]||[]).reduce((sum,value)=>sum+num(value),0)}));
    const largest=top(rows,"AE",7), leading=largest[0];
    return reviewFrame(
      `${label(tabs.fouryear,scope)} four-year review`,
      `Annual values are calculated from the available monthly series. Latest financial year: ${latest||"not loaded"}.`,
      metric("Years available",years.length)+metric("Latest financial year",latest||"Not loaded")+metric("Items reviewed",rows.length)+metric("Largest annual item",leading?money(leading.AE):"N/A","value"),
      signal("info","Largest latest-year item",leading?`${leading.Name} totals ${money(leading.AE)} in ${latest}.`:"No latest-year series is available.")+signal("good","Comparison coverage",`${years.length} financial year(s) are available in this report area.`)+signal("watch","Interpretation",`Use the page chart and its selected item for the month-by-month movement behind this ranking.`),
      evidence("Largest annual actual expenditure",largest,"AE","Latest-year actual")
    );
  }

  function sourceLink(title,text,href){return reviewFrame(title,text,metric("Source status","Available","value")+metric("Review method","Filtered portal view"),signal("info","Open source analysis",text)+signal("watch","Export discipline","Apply filters and sort on the source page before exporting the current view."),`<p class="source-link"><a href="${href}">Open ${title}</a></p>`)}
  function overview(){
    const stamp=meta.lastUpload||meta.dataAsOf||"Synced portal data";
    return `<section class="overview-head"><h2>Portfolio review</h2><p>Precise, source-backed highlights across the portal. Generated from the synced data loaded in this browser.</p></section><section class="insight-metrics">${metric("Current basis",meta.basis||"Completed actual month","value")}${metric("Portal areas",4)}${metric("Data status",stamp)}${metric("Review rule","Visible source data")}</section><section class="overview-grid"><div>${currentReview("demand")}</div><div>${fourYearReview("pu")}</div><div>${sourceLink("FR Budget Status","Plan-head and fund review is available in the FR Budget Status page.","fr.html")}</div><div>${sourceLink("Yearly Review","Month, quarter and financial-year review is available in Yearly Review.","yearly-review.html")}</div></section>`;
  }
  function syncTabs(){const mode=$("insightSource").value, options=tabs[mode]||[];$("insightTabWrap").hidden=mode==="overview";$("insightTab").innerHTML=options.map(([value,text])=>`<option value="${value}">${text}</option>`).join("");}
  function render(){const mode=$("insightSource").value,key=$("insightTab").value;if(mode==="overview")$("insightHost").innerHTML=overview();else if(mode==="current")$("insightHost").innerHTML=currentReview(key);else if(mode==="fouryear")$("insightHost").innerHTML=fourYearReview(key);else if(mode==="fr")$("insightHost").innerHTML=sourceLink("FR Budget Status","Plan-head and fund review is available in the FR Budget Status page.","fr.html");else $("insightHost").innerHTML=sourceLink("Yearly Review","Month, quarter and financial-year review is available in Yearly Review.","yearly-review.html");}
  $("insightSource").addEventListener("change",()=>{syncTabs();render();});$("insightTab").addEventListener("change",render);syncTabs();render();
})();