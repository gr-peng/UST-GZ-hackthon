import {createVisuals,normalizeSeries} from './baseline/visuals.js';

// Reuse the existing comparison chart and historical daily data.
export function createResearchComparison({getWatchlist,showModal,esc,money,prefs}){
 let period=30,selected=null,request=0;
 const cache=new Map();
 const visual=createVisuals({esc,money,prefs,number:(n,d=1)=>Number(n).toFixed(d),empty:text=>`<p>${esc(text)}</p>`});
 async function open({days,code}={}){
  if([10,30,90].includes(days))period=days;
  const version=++request;
  showModal('自选走势','<div id="research-comparison"><p class="muted">正在读取历史走势…</p></div>');
  const slot=document.querySelector('#research-comparison');
  try{
   const list=await getWatchlist();
   selected??=list.slice(0,3).map(row=>String(row.code));
   if(code&&list.some(row=>String(row.code)===code))selected=selected.includes(code)?selected.filter(item=>item!==code):[...selected,code];
   const chosen=list.filter(row=>selected.includes(String(row.code)));
   const results=await Promise.allSettled(chosen.map(async row=>{
    if(!cache.has(row.code))cache.set(row.code,fetch(`assets/research/${row.code}/daily.json`).then(response=>{if(!response.ok)throw Error('行情读取失败');return response.json();}).catch(error=>{cache.delete(row.code);throw error;}));
    return {...row,rows:(await cache.get(row.code)).slice(-period)};
   }));
   if(request!==version||!slot?.isConnected)return;
   const series=normalizeSeries(results.filter(result=>result.status==='fulfilled').map(result=>result.value));
   showModal('自选走势',`<div id="research-comparison"><p class="muted">历史收盘走势，起点统一为 100，便于比较变化。</p><div class="research-compare-options">${list.map(row=>`<button type="button" data-action="research-compare-stock" data-code="${esc(row.code)}" aria-pressed="${selected.includes(String(row.code))}">${esc(row.name)}</button>`).join('')}</div><div class="research-compare-options">${[10,30,90].map(n=>`<button type="button" data-action="research-compare-days" data-days="${n}" aria-pressed="${period===n}">${n} 日</button>`).join('')}</div><div class="research-trend-chart">${series.series.length?visual.lines(series):'<p>选择股票后查看走势。</p>'}</div>${series.labels.length?`<p class="muted">${esc(series.labels[0])} 至 ${esc(series.labels.at(-1))} · 腾讯财经前复权日线</p>`:''}${results.some(result=>result.status==='rejected')?'<p class="error-text">部分行情暂未读取，可以重新选择。</p>':''}</div>`);
  }catch{
   if(request===version&&slot?.isConnected)showModal('自选走势','<p class="error-text">走势暂未读取，请返回投资研究后重试。</p>');
  }
 }
 return {open};
}
