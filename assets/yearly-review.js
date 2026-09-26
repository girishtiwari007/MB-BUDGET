(function () {
  const data = window.REPORTS_DATA || {}, meta = window.CURRENT_PAYLOAD_META || {};
  const months = data.months || ["APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC","JAN","FEB","MAR"];
  const quarters = { Q1:[0,1,2], Q2:[3,4,5], Q3:[6,7,8], Q4:[9,10,11] };
  const quarterNames = { Q1:"Q1 - Apr to Jun", Q2:"Q2 - Jul to Sep", Q3:"Q3 - Oct to Dec", Q4:"Q4 - Jan to Mar" };
  const rules = [
    { re:/PU\s*-\s*03|PLB|BONUS/i, title:"PU 03 - PLB / Bonus", note:"PLB/Bonus normally starts booking from OCT onward. Low or nil booking before OCT is generally not adverse; OCT-MAR movement needs close watch." },
    { re:/PU\s*-\s*25|CHILDREN/i, title:"PU 25 - Children Education", note:"Children Education Allowance generally starts from APR-MAY onward. Review cumulative and same-period previous-year movement, not only equal monthly proportion." },
    { re:/PU\s*-\s*26|MEDICAL/i, title:"PU 26 - Medical Expenses", note:"Medical expenses are claim/bill driven and not evenly spread. Spikes should be checked against bill batches, reimbursements and pending liabilities." }
  ];
  const $ = (id) => document.getElementById(id);
  const years = () => (data.years || []).map((row) => row.fy).filter(Boolean);
  const state = { mode:"review", scope:"pu", period:"year", month:"APR", quarter:"Q1", compareYear:"", compareMonth:"", compareQuarter:"", targetYear:"", targetMonth:"", targetQuarter:"", selectedYears:new Set(years()), selectedMonths:new Set(), compareMonths:new Set(), targetMonths:new Set(), openPicker:"", selectedItems:null, selectedDeptPus:null };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const fmt = (v) => Number(v || 0).toLocaleString("en-IN");
  const money = (v) => `${fmt(v)}<small>${(Number(v || 0) / 10000).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})} Cr</small>`;
  const pct = (v) => Number.isFinite(v) ? `${v.toFixed(1)}%` : "NA";
  const scopeName = () => state.scope === "pu" ? "Primary Unit" : state.scope === "demand" ? "Demand / SMH" : "Department";
  const source = () => data.monthly?.[state.scope] || {};
  const budgetSource = () => data.budget?.[state.scope] || {};
  const puItems = () => Object.keys(data.monthly?.pu || {}).filter((n) => n.toUpperCase() !== "TOTAL").sort((a,b) => a.localeCompare(b,"en-IN",{numeric:true}));
  const items = () => Object.keys(source()).filter((n) => n.toUpperCase() !== "TOTAL").sort((a,b) => a.localeCompare(b,"en-IN",{numeric:true}));
  const selected = (all, set) => all.filter((v) => set.has(v));
  const label = (all, set, plural) => set.size === all.length ? `All ${plural}` : set.size === 1 ? [...set][0] : set.size ? `${set.size} ${plural} selected` : `No ${plural} selected`;
  const currentYear = () => years().at(-1) || "";
  const completedCount = () => Math.max(1, months.indexOf(String(meta.completedMonth || "AUG").slice(0,3).toUpperCase()) + 1);
  const currentMonth = () => String(meta.completedMonth || months[completedCount() - 1] || months[0]).slice(0,3).toUpperCase();
  const monthIndex = (m) => Math.max(0, months.indexOf(String(m || months[0]).slice(0,3).toUpperCase()));
  const quarterForMonth = (m) => Object.keys(quarters).find((q) => quarters[q].includes(monthIndex(m))) || "Q1";
  const ruleFor = (name) => rules.find((rule) => rule.re.test(name || ""));

  function indexesForPeriod(period, month, quarter){
    if(period === "month") return [monthIndex(month)];
    if(period === "quarter") return quarters[quarter] || quarters.Q1;
    return months.map((_,i) => i);
  }
  function usableIndexes(year, indexes){ return year === currentYear() ? indexes.filter((i) => i < completedCount()) : indexes; }
  function periodIndexes(){ return indexesForPeriod(state.period, state.month, state.quarter); }
  function reviewIndexes(){ return state.period === "month" ? months.map((_, i) => i).filter((i) => state.selectedMonths.has(months[i])) : periodIndexes(); }
  function selectedMonthLabel(){ const all = months, picked = selected(all, state.selectedMonths); return picked.length === all.length ? "All months" : picked.length === 1 ? picked[0] : picked.length ? `${picked.join(", ")} (${picked.length} months)` : "No months selected"; }
  function periodLabel(){ return state.period === "month" ? selectedMonthLabel() : state.period === "quarter" ? `${state.quarter} (${periodIndexes().map((i) => months[i]).join("-")})` : "Financial Year"; }
  function comparisonMonthLabel(set){ const picked=selected(months,set); return picked.length===months.length ? "All months" : picked.length===1 ? picked[0] : picked.length ? picked.join(", ") : "No months"; }
  function compareIndexes(){ return state.period === "month" ? months.map((_,i)=>i).filter(i=>state.compareMonths.has(months[i])) : indexesForPeriod(state.period,state.compareMonth,state.compareQuarter); }
  function targetIndexes(){ return state.period === "month" ? months.map((_,i)=>i).filter(i=>state.targetMonths.has(months[i])) : indexesForPeriod(state.period,state.targetMonth,state.targetQuarter); }
  function comparisonLabel(){
    if(state.period === "month") return `${state.compareYear} ${comparisonMonthLabel(state.compareMonths)} to ${state.targetYear} ${comparisonMonthLabel(state.targetMonths)}`;
    if(state.period === "quarter") return `${state.compareYear} ${state.compareQuarter} to ${state.targetYear} ${state.targetQuarter}`;
    return `${state.compareYear} full year to ${state.targetYear} full year`;
  }
  function periodUnit(){ return state.period === "month" ? "Month" : state.period === "quarter" ? "Quarter" : "Year"; }
  function value(values, year){ const indexes = usableIndexes(year, reviewIndexes()); return indexes.reduce((total,i) => total + Number(values?.[year]?.[i] || 0),0); }
  function monthValue(names, year, index, dataSource=source()){ if(year === currentYear() && index >= completedCount()) return null; return names.reduce((total,name) => total + Number(dataSource[name]?.[year]?.[index] || 0),0); }
  function periodValue(names, year, indexes, dataSource=source()){ const use = usableIndexes(year, indexes); if(!use.length) return null; return names.reduce((total,name) => total + use.reduce((sum,i) => sum + Number(dataSource[name]?.[year]?.[i] || 0),0),0); }
  function cumulativeValue(name, year, uptoIndex, dataSource=source()){ const last = year === currentYear() ? Math.min(uptoIndex, completedCount() - 1) : uptoIndex; return months.slice(0, last + 1).reduce((sum, _m, i) => sum + Number(dataSource[name]?.[year]?.[i] || 0), 0); }
  function cumulativeEndIndex(year, indexes){ const use = usableIndexes(year, indexes); return use.length ? Math.max(...use) : Math.min(completedCount() - 1, Math.max(...indexes)); }
  function budgetRow(name, year){ return budgetSource()[name]?.[year] || {}; }

  function checkboxList(host, all, set, type, allText){
    host.innerHTML = `<label class="check-all"><input type="checkbox" data-type="${type}" data-all="true" ${set.size === all.length ? "checked" : ""}> <span>${esc(allText)}</span></label>${all.map((v) => `<label><input type="checkbox" data-type="${type}" value="${esc(v)}" ${set.has(v) ? "checked" : ""}> <span>${esc(v)}</span></label>`).join("")}`;
  }
  function sync(){
    const allYears=years(), allItems=items(), allPus=puItems();
    if(!state.compareYear) state.compareYear = allYears.length > 1 ? allYears.at(-2) : allYears.at(-1);
    if(!state.compareMonth) state.compareMonth = currentMonth();
    if(!state.compareQuarter) state.compareQuarter = quarterForMonth(state.compareMonth);
    if(!state.targetYear) state.targetYear = currentYear();
    if(!state.targetMonth) state.targetMonth = currentMonth();
    if(!state.targetQuarter) state.targetQuarter = quarterForMonth(state.targetMonth);
    $("reviewMode").value=state.mode; $("reviewScope").value=state.scope; $("reviewPeriod").value=state.period;
    $("reviewMonth").innerHTML=months.map((m) => `<option ${m===state.month?"selected":""}>${m}</option>`).join("");
    $("reviewQuarter").value=state.quarter;
    $("compareYear").innerHTML=allYears.map((y) => `<option ${y===state.compareYear?"selected":""}>${esc(y)}</option>`).join("");
    $("compareMonth").innerHTML=months.map((m) => `<option ${m===state.compareMonth?"selected":""}>${m}</option>`).join("");
    $("compareQuarter").innerHTML=Object.keys(quarters).map((q) => `<option value="${q}" ${q===state.compareQuarter?"selected":""}>${quarterNames[q]}</option>`).join("");
    $("targetYear").innerHTML=allYears.map((y) => `<option ${y===state.targetYear?"selected":""}>${esc(y)}</option>`).join("");
    $("targetMonth").innerHTML=months.map((m) => `<option ${m===state.targetMonth?"selected":""}>${m}</option>`).join("");
    $("targetQuarter").innerHTML=Object.keys(quarters).map((q) => `<option value="${q}" ${q===state.targetQuarter?"selected":""}>${quarterNames[q]}</option>`).join("");
    const isReview = state.mode === "review", isAi = state.mode === "ai";
    $("reviewPeriod").querySelector('option[value="month"]').textContent=isReview ? "Custom Months" : "Single / Multiple Months";
    $("reviewScopeWrap").hidden=isAi;
    $("reviewPeriodWrap").hidden=isAi;
    $("monthWrap").hidden=state.period!=="month" || !isReview;
    $("monthChoiceWrap").hidden=state.period!=="month" || !isReview;
    $("quarterWrap").hidden=state.period!=="quarter" || !isReview;
    $("compareYearWrap").hidden=isReview || isAi;
    $("targetYearWrap").hidden=isReview || isAi;
    $("compareMonthWrap").hidden=true;
    $("targetMonthWrap").hidden=true;
    $("fromMonthChoiceWrap").hidden=isReview || isAi || state.period!=="month";
    $("toMonthChoiceWrap").hidden=isReview || isAi || state.period!=="month";
    $("compareQuarterWrap").hidden=isReview || isAi || state.period!=="quarter";
    $("targetQuarterWrap").hidden=isReview || isAi || state.period!=="quarter";
    if($("yearChoiceWrap")) $("yearChoiceWrap").hidden=!isReview;
    state.selectedYears=new Set([...state.selectedYears].filter((y) => allYears.includes(y))); if(!state.selectedYears.size) allYears.forEach((y) => state.selectedYears.add(y));
    state.selectedMonths=new Set([...state.selectedMonths].filter((m) => months.includes(m))); if(!state.selectedMonths.size) { state.month=currentMonth(); state.selectedMonths.add(state.month); }
    state.compareMonths=new Set([...state.compareMonths].filter((m) => months.includes(m))); if(!state.compareMonths.size) state.compareMonths.add(state.compareMonth || currentMonth());
    state.targetMonths=new Set([...state.targetMonths].filter((m) => months.includes(m))); if(!state.targetMonths.size) state.targetMonths.add(state.targetMonth || currentMonth());
    checkboxList($("monthChecks"),months,state.selectedMonths,"month-choice","All months");
    checkboxList($("fromMonthChecks"),months,state.compareMonths,"from-month","All months");
    checkboxList($("toMonthChecks"),months,state.targetMonths,"to-month","All months");
    $("monthPickerLabel").textContent=selectedMonthLabel();
    $("fromMonthPickerLabel").textContent=comparisonMonthLabel(state.compareMonths);
    $("toMonthPickerLabel").textContent=comparisonMonthLabel(state.targetMonths);
    const pickerId={year:"yearPicker","month-choice":"monthPicker","from-month":"fromMonthPicker","to-month":"toMonthPicker",item:"itemPicker","dept-pu":"deptPuPicker"}[state.openPicker];
    if(pickerId) $(pickerId).open=true;
    if(state.selectedItems===null) state.selectedItems=new Set(allItems); else state.selectedItems=new Set([...state.selectedItems].filter((i) => allItems.includes(i)));
    if(state.selectedDeptPus===null) state.selectedDeptPus=new Set(allPus); else state.selectedDeptPus=new Set([...state.selectedDeptPus].filter((i) => allPus.includes(i)));
    checkboxList($("yearChecks"),allYears,state.selectedYears,"year","All available years");
    checkboxList($("itemChecks"),allItems,state.selectedItems,"item",`All ${scopeName()}s`);
    $("yearPickerLabel").textContent=label(allYears,state.selectedYears,"years");
    $("itemPickerTitle").textContent=`Specific ${scopeName()}s`; $("itemPickerLabel").textContent=label(allItems,state.selectedItems,`${scopeName()}s`);
    $("itemChoiceWrap").hidden=isAi;
    $("deptPuWrap").hidden=state.scope!=="dept" || isAi; checkboxList($("deptPuChecks"),allPus,state.selectedDeptPus,"dept-pu","All Primary Units"); $("deptPuPickerLabel").textContent=label(allPus,state.selectedDeptPus,"Primary Units");
  }
  function chart(names, chosenYears, dataSource=source()){
    if(!chosenYears.length || !names.length) return `<p class="empty-chart">Select at least one year and one item to view the trend.</p>`;
    const width=920, height=270, left=58, right=20, top=22, bottom=42, plotW=width-left-right, plotH=height-top-bottom;
    const series=chosenYears.map((year,index) => ({year,color:["#1f4e79","#0a8a82","#a66321","#8b3f65"][index%4], values:months.map((_,i) => monthValue(names,year,i,dataSource))}));
    const max=Math.max(1,...series.flatMap((s) => s.values.filter((v) => v!==null))); const x=(i) => left+(plotW*i/(months.length-1)), y=(v) => top+plotH-(v/max*plotH);
    const lines=[0,.25,.5,.75,1].map((r) => `<line x1="${left}" y1="${top+plotH*(1-r)}" x2="${width-right}" y2="${top+plotH*(1-r)}" class="grid"/><text x="4" y="${top+plotH*(1-r)+4}" class="axis">${(max*r/10000).toFixed(0)} Cr</text>`).join("");
    const paths=series.map((s) => { const points=s.values.map((v,i) => v===null ? null : `${x(i)},${y(v)}`); let d=""; points.forEach((p,i) => { if(!p) return; d += (!i || !points[i-1] ? "M" : "L")+p; }); return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="3"/>${s.values.map((v,i) => v===null ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}"><title>${esc(s.year)} · ${months[i]}: ${fmt(v)}</title></circle>`).join("")}`; }).join("");
    return `<svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly trend">${lines}${months.map((m,i) => `<text x="${x(i)}" y="${height-13}" text-anchor="middle" class="axis">${m}</text>`).join("")}${paths}</svg><div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.year)}</span>`).join("")}</div>`;
  }
  function attentionClass(row,total){ const share=total ? Math.abs(row.total)/Math.abs(total)*100 : 0; const values=row.values.map((v)=>Number(v||0)); const latest=values.at(-1)||0, previous=values.length>1 ? values.at(-2)||0 : 0; const jump=previous ? (latest-previous)/Math.abs(previous)*100 : 0; if(row.total<0 || share>=25 || jump>=25) return "attn-red"; if(share>=12 || jump>=10) return "attn-amber"; return "attn-green"; }
  function remarks(rows,total,names,chosenYears){
    if(!rows.length || !chosenYears.length) return ["Choose one or more financial years and items to generate review remarks."];
    const top=rows[0], latest=chosenYears.at(-1), latestValue=rows.reduce((sum,row) => sum+row.values.at(-1),0), previous=chosenYears.length>1?rows.reduce((sum,row) => sum+row.values.at(-2),0):0;
    const change=previous ? ((latestValue-previous)/Math.abs(previous))*100 : null;
    return [`${top.name} is the highest selected ${scopeName().toLowerCase()}, contributing ${total ? ((top.total/total)*100).toFixed(1) : "0.0"}% of the selected review total.`, `${names.length} selected ${scopeName().toLowerCase()}${names.length===1?" is":"s are"} reviewed across ${chosenYears.length} financial year${chosenYears.length===1?"":"s"}.`, change===null ? `${latest} is the only selected year; select another year to view comparative movement.` : `${latest} is ${change>=0?"higher":"lower"} by ${Math.abs(change).toFixed(1)}% than the preceding selected year for this period.`, ...(state.scope==="dept" ? [`PU cross-review is active for ${label(puItems(),state.selectedDeptPus,"Primary Units")}.`] : [])];
  }
  function trendRows(){
    const names=selected(items(),state.selectedItems), fromYear=state.compareYear || years().at(-2) || currentYear(), toYear=state.targetYear || currentYear();
    const fromIndexes=compareIndexes(), toIndexes=targetIndexes();
    const fromEnd=cumulativeEndIndex(fromYear,fromIndexes), toEnd=cumulativeEndIndex(toYear,toIndexes);
    return names.map((name)=>{ const fromPeriodValue=periodValue([name],fromYear,fromIndexes), toPeriodValue=periodValue([name],toYear,toIndexes), fromCum=cumulativeValue(name,fromYear,fromEnd), toCum=cumulativeValue(name,toYear,toEnd); const budget=budgetRow(name,toYear), bp=Number(budget.bp || 0), oba=Number(budget.oba || 0); const change=fromCum ? ((toCum-fromCum)/Math.abs(fromCum))*100 : null, bpPct=bp ? toCum/bp*100 : null; return {name, fromYear, toYear, fromPeriodValue, toPeriodValue, fromCum, toCum, bp, oba, change, bpPct, rule:ruleFor(name), fromLabel:fromPeriodLabel("from"), toLabel:toPeriodLabel("to")}; }).sort((a,b)=>Math.abs(b.toCum)-Math.abs(a.toCum));
  }
  function fromPeriodLabel(){ return state.period === "month" ? `${state.compareYear} ${comparisonMonthLabel(state.compareMonths)}` : state.period === "quarter" ? `${state.compareYear} ${state.compareQuarter}` : `${state.compareYear} FY`; }
  function toPeriodLabel(){ return state.period === "month" ? `${state.targetYear} ${comparisonMonthLabel(state.targetMonths)}` : state.period === "quarter" ? `${state.targetYear} ${state.targetQuarter}` : `${state.targetYear} FY`; }
  function movementClass(row){ if(row.rule && /PLB/.test(row.rule.title) && state.period !== "year" && cumulativeEndIndex(row.toYear,targetIndexes()) < 6) return "attn-green"; if((row.change || 0) >= 25 || (row.bpPct || 0) >= 115) return "attn-red"; if((row.change || 0) >= 10 || (row.bpPct || 0) >= 90) return "attn-amber"; return "attn-green"; }
  function aiRemark(row){
    const basis = `${fromPeriodLabel()} is compared with ${toPeriodLabel()} on ${state.period === "year" ? "full-year actual expenditure" : `${periodUnit().toLowerCase()} AE and cumulative AE`}.`;
    const movement = row.change === null ? "Comparable cumulative base is not available, so percentage movement is not shown." : `Cumulative expenditure is ${row.change >= 0 ? "higher" : "lower"} by ${Math.abs(row.change).toFixed(1)}%.`;
    const budget = row.bpPct === null ? "Budget proportion reference is not available for this selection." : `Against budget proportion, utilization is ${row.bpPct.toFixed(1)}%.`;
    const rule = row.rule ? ` Finance rule: ${row.rule.note}` : " Finance view: read this with period AE, cumulative trend, budget proportion and the nature of expenditure.";
    if(row.bpPct !== null && row.bpPct > 115) return `${basis} ${movement} ${budget} This needs attention because booking is faster than the expected budget proportion.${rule}`;
    if(row.change !== null && row.change > 25) return `${basis} ${movement} ${budget} Please verify whether arrears, bill batches, claim settlement or one-time booking caused the increase.${rule}`;
    if(row.bpPct !== null && row.bpPct < 55 && cumulativeEndIndex(row.toYear,targetIndexes()) >= 5) return `${basis} ${movement} ${budget} This may indicate slow booking or possible surrender risk, subject to pending liabilities.${rule}`;
    return `${basis} ${movement} ${budget} Position is within normal review range, but should still be watched with next upload.${rule}`;
  }
  function trendTable(rows){
    const unit=periodUnit(), showCum=state.period !== "year", toYear=state.targetYear || currentYear();
    const fromCumLabel = state.period === "quarter" ? state.compareQuarter : state.period === "month" ? comparisonMonthLabel(state.compareMonths) : state.compareMonth;
    const toCumLabel = state.period === "quarter" ? state.targetQuarter : state.period === "month" ? comparisonMonthLabel(state.targetMonths) : state.targetMonth;
    const empty = `<tr><td colspan="${showCum ? 9 : 7}" class="ai-cell">No item selected. Select one or more ${esc(scopeName())}s from the Specific ${esc(scopeName())}s menu.</td></tr>`;
    return `<div class="table-wrap"><table><thead><tr><th>${scopeName()}</th><th>OBA/RG<br>${esc(toYear)}</th><th>BP<br>${esc(toYear)}</th><th>From ${unit} AE<br>${esc(fromPeriodLabel())}</th>${showCum?`<th>From Cumulative AE<br>up to ${esc(fromCumLabel)}</th>`:""}<th>To ${unit} AE<br>${esc(toPeriodLabel())}</th>${showCum?`<th>To Cumulative AE<br>up to ${esc(toCumLabel)}</th>`:""}<th>Movement</th><th>AI finance remark</th></tr></thead><tbody>${rows.length?rows.map((r)=>`<tr class="${movementClass(r)}"><td>${esc(r.name)}</td><td>${money(r.oba)}</td><td>${money(r.bp)}</td><td>${r.fromPeriodValue===null?"NA":money(r.fromPeriodValue)}</td>${showCum?`<td>${money(r.fromCum)}</td>`:""}<td>${r.toPeriodValue===null?"Running/NA":money(r.toPeriodValue)}</td>${showCum?`<td>${money(r.toCum)}</td>`:""}<td>${r.change===null?"NA":pct(r.change)}<small>BP ${r.bpPct===null?"NA":pct(r.bpPct)}</small></td><td class="ai-cell">${esc(aiRemark(r))}</td></tr>`).join(""):empty}</tbody></table></div>`;
  }
  function financeGuide(){
    return `<section class="finance-guide"><div class="section-head"><h2>Finance Reading Guide</h2><span>Use this note while reading trend and AI remarks</span></div><div class="guide-grid"><article><strong>Month AE</strong><span>Actual expenditure booked in only the selected month. Useful for finding sudden one-month booking.</span></article><article><strong>Quarter AE</strong><span>Actual expenditure booked in the selected quarter only, such as Q2 = JUL + AUG + SEP.</span></article><article><strong>Year AE</strong><span>Actual expenditure for the full selected financial year where full-year data is available.</span></article><article><strong>Cumulative AE</strong><span>Total expenditure from APR up to the selected month or quarter end. Example: SEP cumulative means APR to SEP.</span></article><article><strong>BP</strong><span>Budget Proportion up to the selected period. It is the expected budget use for the selected month, quarter or cumulative point.</span></article><article><strong>AE over BP</strong><span>May indicate fast booking, excess trend, arrear booking or one-time bill impact. It needs verification before conclusion.</span></article><article><strong>AE below BP</strong><span>May indicate slow booking or likely surrender risk, subject to pending liabilities and known seasonal expenditure.</span></article></div></section>`;
  }
  function renderTrend(){
    const rows=trendRows(), names=selected(items(),state.selectedItems), trendYears=[...new Set([state.compareYear, state.targetYear].filter(Boolean))]; const total=rows.reduce((sum,row)=>sum+row.toCum,0), high=rows[0];
    $("reviewTitle").textContent="Yearly Review / PU Trend Analysis"; $("reviewTitle").dataset.exportTitle=`PU Trend Analysis | ${scopeName()} | ${comparisonLabel()} | ${label(items(),state.selectedItems,`${scopeName()}s`)}`; $("reviewStamp").textContent=`Compare ${comparisonLabel()} | Completed actuals through ${meta.completedMonth || "latest completed month"}`;
    $("reviewHost").innerHTML=`<section class="summary"><article><span>Trend Mode</span><strong>${esc(scopeName())}</strong></article><article><span>Comparison Period</span><strong>${esc(periodUnit())}</strong></article><article><span>To cumulative</span><strong>${money(total)}</strong></article><article><span>Highest item</span><strong>${esc(high?.name||"N/A")}</strong></article></section><section class="review-panel"><div class="section-head"><h2>Expense / Budget Trend</h2><span>${esc(comparisonLabel())} · Figures in '000 with Crore below</span></div>${trendTable(rows)}</section><section class="insight-grid"><article class="review-panel"><div class="section-head"><h2>AI Budget Analysis</h2><span>Plain-language finance remarks</span></div><ul class="remark-list">${rows.slice(0,6).map((r)=>`<li><strong>${esc(r.name)}:</strong> ${esc(aiRemark(r))}</li>`).join("")}</ul></article><article class="review-panel"><div class="section-head"><h2>Monthly Trend Graph</h2><span>${esc(label(items(),state.selectedItems,`${scopeName()}s`))}</span></div>${chart(names,trendYears)}</article></section>${financeGuide()}`;
  }
  function renderAi(){
    const rows=trendRows(), risk=rows.filter((r)=>movementClass(r)==="attn-red"), watch=rows.filter((r)=>movementClass(r)==="attn-amber"), special=rows.filter((r)=>r.rule);
    $("reviewTitle").textContent="Yearly Review / PU Trend Analysis"; $("reviewTitle").dataset.exportTitle=`AI Budget Analysis | ${scopeName()} | ${comparisonLabel()} | ${label(items(),state.selectedItems,`${scopeName()}s`)}`; $("reviewStamp").textContent=`AI Budget Analysis | Compare ${comparisonLabel()} | Static rule engine refreshed with GUI data sync`;
    $("reviewHost").innerHTML=`<section class="analysis-context"><div><strong>Analysis context</strong><span>${esc(scopeName())} · ${esc(comparisonLabel())} · ${esc(label(items(),state.selectedItems,`${scopeName()}s`))}</span></div><button type="button" id="changeAnalysisSelection">Change analysis selection</button></section><section class="summary"><article><span>AI Review Rows</span><strong>${rows.length}</strong></article><article><span>High Attention</span><strong>${risk.length}</strong></article><article><span>Watch</span><strong>${watch.length}</strong></article><article><span>Rule Based PU</span><strong>${special.length}</strong></article></section><section class="review-panel ai-review"><div class="section-head"><h2>Elaborative AI Budget Analysis</h2><span>Auto-generated from current synced monthly data, BP/OBA and finance rules</span></div><ul class="remark-list">${rows.map((r)=>`<li class="${movementClass(r)}"><strong>${esc(r.name)}:</strong> ${esc(aiRemark(r))}</li>`).join("")}</ul></section><section class="review-panel"><div class="section-head"><h2>AI Trend Evidence Table</h2><span>Use this with the remarks above for authority review</span></div>${trendTable(rows)}</section>${financeGuide()}`;
  }
  function puCrossReport(chosenYears){
    const names=selected(puItems(),state.selectedDeptPus), puSource=data.monthly?.pu||{};
    const rows=names.map((name)=>{const values=chosenYears.map((year)=>value(puSource[name],year));return {name,values,total:values.reduce((a,b)=>a+b,0)};}).filter((row)=>row.total||names.length).sort((a,b)=>b.total-a.total);
    const total=rows.reduce((sum,row)=>sum+row.total,0), top=rows[0];
    return `<section class="cross-report"><section class="summary"><article><span>PU cross-review</span><strong>${names.length} selected</strong></article><article><span>Review total</span><strong>${money(total)}</strong></article><article><span>Highest PU</span><strong>${esc(top?.name||"N/A")}</strong></article><article><span>Years compared</span><strong>${chosenYears.length}</strong></article></section><section class="review-panel"><div class="section-head"><h2>PU cross-review report</h2><span>Separate from the Department review above</span></div><div class="table-wrap"><table><thead><tr><th>Primary Unit</th>${chosenYears.map((y)=>`<th>${esc(y)}</th>`).join("")}<th>Total</th></tr></thead><tbody>${rows.map((r)=>`<tr class="${attentionClass(r,total)}"><td>${esc(r.name)}</td>${r.values.map((v)=>`<td>${money(v)}</td>`).join("")}<td>${money(r.total)}</td></tr>`).join("")||`<tr><td colspan="${chosenYears.length+2}">No Primary Units selected.</td></tr>`}</tbody></table></div></section><section class="insight-grid"><article class="review-panel"><div class="section-head"><h2>PU selection insights</h2><span>Derived from the PU cross-review</span></div><ul class="remark-list"><li>${esc(top?.name||"No Primary Unit")} is the highest selected PU, contributing ${total?((top.total/total)*100).toFixed(1):"0.0"}% of the PU review total.</li></ul></article><article class="review-panel"><div class="section-head"><h2>PU monthly completed-actual trend</h2><span>Markers show monthly values</span></div>${chart(names,chosenYears,puSource)}</article></section></section>`;
  }
  function renderReview(){
    const chosenYears=selected(years(),state.selectedYears), names=selected(items(),state.selectedItems);
    const rows=names.map((name) => { const values=chosenYears.map((year) => value(source()[name],year)); return {name,values,total:values.reduce((a,b) => a+b,0)}; }).filter((row) => row.total || state.selectedItems.size).sort((a,b) => b.total-a.total);
    const total=rows.reduce((a,row) => a+row.total,0), top=rows[0], reviewTitle=`Yearly Review / PU Trend Analysis - ${scopeName()}`, exportTitle=`${reviewTitle} | ${periodLabel()} | ${label(years(),state.selectedYears,"years")} | ${label(items(),state.selectedItems,`${scopeName()}s`)}`; $("reviewTitle").textContent=reviewTitle; $("reviewTitle").dataset.exportTitle=exportTitle; $("reviewStamp").textContent=`${periodLabel()} | ${label(years(),state.selectedYears,"years")} | ${label(items(),state.selectedItems,`${scopeName()}s`)} | Completed actuals through ${meta.completedMonth || "latest completed month"}`;
    $("reviewHost").innerHTML=`<section class="summary"><article><span>Period</span><strong>${esc(periodLabel())}</strong></article><article><span>Selected rows</span><strong>${rows.length}</strong></article><article><span>Review total</span><strong>${money(total)}</strong></article><article><span>Highest item</span><strong>${esc(top?.name||"N/A")}</strong></article></section><section class="review-panel"><div class="section-head"><h2>${esc(periodLabel())} expenditure review</h2><span>Completed actuals only · Figures in '000 with Crore below</span></div><div class="table-wrap"><table><thead><tr><th>${scopeName()}</th>${chosenYears.map((y)=>`<th>${esc(y)}</th>`).join("")}<th>Total</th></tr></thead><tbody>${rows.map((r)=>`<tr class="${attentionClass(r,total)}"><td>${esc(r.name)}</td>${r.values.map((v)=>`<td>${money(v)}</td>`).join("")}<td>${money(r.total)}</td></tr>`).join("")||`<tr><td colspan="${chosenYears.length+2}">No data available for this selection.</td></tr>`}</tbody></table></div></section><section class="insight-grid"><article class="review-panel"><div class="section-head"><h2>Selection insights</h2><span>Derived from the displayed review</span></div><ul class="remark-list">${remarks(rows,total,names,chosenYears).map((remark)=>`<li>${esc(remark)}</li>`).join("")}</ul></article><article class="review-panel"><div class="section-head"><h2>Monthly completed-actual trend</h2><span>Markers show monthly values</span></div>${chart(names,chosenYears)}</article></section>${state.scope==="dept"?puCrossReport(chosenYears):""}${financeGuide()}`;
  }
  function render(){ sync(); if(state.mode==="trend") renderTrend(); else if(state.mode==="ai") renderAi(); else renderReview(); window.MBTableHighlight?.refresh?.(); }
  ["reviewMode","reviewScope","reviewPeriod","reviewMonth","reviewQuarter","compareYear","compareMonth","compareQuarter","targetYear","targetMonth","targetQuarter"].forEach((id)=>$(id).addEventListener("change",(event)=>{ const keys={reviewMode:"mode",reviewScope:"scope",reviewPeriod:"period",reviewMonth:"month",reviewQuarter:"quarter",compareYear:"compareYear",compareMonth:"compareMonth",compareQuarter:"compareQuarter",targetYear:"targetYear",targetMonth:"targetMonth",targetQuarter:"targetQuarter"}; state[keys[id]]=event.target.value; if(id==="reviewMonth") state.selectedMonths=new Set([state.month]); if(id==="reviewScope"){state.selectedItems=null;state.selectedDeptPus=null;} render(); }));
  document.addEventListener("change",(event)=>{ const input=event.target; if(!input.matches("input[data-type]"))return; const type=input.dataset.type, all=type==="year"?years():["month-choice","from-month","to-month"].includes(type)?months:type==="dept-pu"?puItems():items(), set=type==="year"?state.selectedYears:type==="month-choice"?state.selectedMonths:type==="from-month"?state.compareMonths:type==="to-month"?state.targetMonths:type==="dept-pu"?state.selectedDeptPus:state.selectedItems; if(input.dataset.all){set.clear();if(input.checked)all.forEach((v)=>set.add(v));}else if(input.checked)set.add(input.value);else set.delete(input.value); if(type==="month-choice" && set.size===1) state.month=[...set][0]; if(type==="from-month" && set.size===1) state.compareMonth=[...set][0]; if(type==="to-month" && set.size===1) state.targetMonth=[...set][0]; state.openPicker=type; render(); });
  ["yearPicker","monthPicker","fromMonthPicker","toMonthPicker","itemPicker","deptPuPicker"].forEach((id)=>$(id).addEventListener("mouseleave",()=>{ $(id).open=false; state.openPicker=""; }));
  document.addEventListener("click",(event)=>{ if(event.target.closest("#changeAnalysisSelection")){ state.mode="trend"; render(); } });
  render();
}());
