import {MEMORY_PERSONAS,MEMORY_MODES,MEMORY_UPDATE,stageMemory,confirmMemory,forgetMemory,clearMemory} from './long-term-memory.mjs';
import {contextMoney} from './financial-context.mjs';

export const memoryEscape = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderIntentEvidence(evidence){
 if(!evidence)return '';
 const e=memoryEscape;
 return `<details class="memory-evidence intent-turn-evidence"><summary>推荐依据 <span class="memory-count">${e(evidence.summary)}</span></summary><div class="memory-evidence-body">${evidence.items.map(item=>`<p class="memory-evidence-label">${e(item.label)}</p><p class="memory-reason">${e(item.text)}</p>`).join('')}${evidence.financial?renderFinancialSummary(evidence.financial):''}${evidence.asOf?`<p class="memory-caption">${e(evidence.asOf)} · 本轮使用的合成财务快照</p>`:''}${evidence.chartMonth?`<button type="button" class="intent-settings" data-action="intent-finance-overview" data-month="${e(evidence.chartMonth)}">查看本月支出概览 ↗</button><p class="memory-caption">图表展示已发生支出；可规划余额另按现金和预留计算。</p>`:''}${evidence.settings?'<button type="button" class="intent-settings" data-action="memory-details">查看或更新演示资料</button>':''}</div></details>`;
}
export function renderMemoryEvidence(recall,{settings=false}={}) {
 if (!recall || (!recall.used&&!recall.context) || recall.mode==='answer') return '';
 const e=memoryEscape;
 return `<details class="memory-evidence"><summary><span class="memory-spark" aria-hidden="true">✧</span> 推荐依据 <span class="memory-count">${recall.context?'目标 + 当前财务':recall.evidence.length+' 条记忆'}</span></summary><div class="memory-evidence-body"><p class="memory-evidence-label">01 / 你在意什么</p>${recall.used?`<ol>${recall.evidence.map(f=>`<li><strong>${e(f.label)}</strong><small>${e(f.sourceLabel)}</small><p>“${e(f.quote)}”</p></li>`).join('')}</ol>`:'<p class="memory-caption">未使用长期画像，需要向你确认目标。</p>'}${recall.context?`<p class="memory-evidence-label">02 / 现在能安排多少</p>${renderFinancialSummary(recall.context)}<p class="memory-caption">同一份本地合成快照 · ${e(recall.context.asOf)}（演示时点）</p>`:''}<p class="memory-evidence-label">03 / 为什么推荐这个方向</p><p class="memory-reason">${e(recall.reason)}</p>${settings?'<button type="button" class="intent-settings" data-action="memory-details">查看或更新演示资料</button>':''}</div></details>`;
}
export function renderFinancialSummary(c) {
 if(!c.complete)return '<p class="memory-caption">账户或预算资料缺失，待补齐后再计算。</p>';
 return `<dl class="context-summary"><div><dt>当前现金</dt><dd>${contextMoney(c.cashMinor)}</dd></div><div><dt>本月剩余生活预算</dt><dd>− ${contextMoney(c.budgetMinor)}</dd></div><div><dt>应急预留</dt><dd>− ${contextMoney(c.reserveMinor)}</dd></div>${c.billMinor?`<div class="context-new-bill"><dt>5天后待付学费</dt><dd>− ${contextMoney(c.billMinor)}</dd></div>`:''}${c.committedMinor?`<div><dt>已确认储蓄计划首期预留</dt><dd>− ${contextMoney(c.committedMinor)}</dd></div>`:''}<div class="context-total"><dt>${c.shortfallMinor?'近期预留缺口':'可进一步规划'}</dt><dd>${c.fresh?contextMoney(c.shortfallMinor||c.availableMinor):'待更新'}</dd></div></dl>`;
}
export function renderFinancialPanel(context) {
 if(!context)return '';
 return `<section class="financial-context-panel" aria-label="统一财务上下文"><div class="context-heading"><strong>当前财务 · 一份共同快照</strong><span class="context-status ${context.fresh?'':'is-stale'}">${context.fresh?'已同步':'待更新'}</span></div><p class="memory-caption">${context.asOf}（演示时点） · 每次提问重新核对</p>${renderFinancialSummary(context)}<details class="context-sources"><summary>现金、预算、预留与待付事项来自哪里？</summary>${context.sources.map(s=>`<p><b>${s.label}</b> · ${s.detail}</p>`).join('')}<p>理财持仓 ${contextMoney(context.investedMinor)}，未计入可用现金。本页展示本地合成范围。</p></details><div class="context-controls"><button type="button" data-context-action="${context.billMinor?'reset':'bill'}">${context.billMinor?'恢复原财务快照':'模拟新增学费账单'}</button><button type="button" data-context-action="${context.fresh?'stale':'refresh'}">${context.fresh?'模拟资料待更新':'同步最新上下文'}</button></div><p class="context-hint">目标不变，财务一变，推荐也应跟着变。</p></section>`;
}
export function renderMemoryOptions(recall,revision,{compact=false}={}) {
 const e=memoryEscape;
 return recall.options.map(o=>`<button type="button" class="secondary full memory-option ${o.recommended?'is-recommended':''}" data-action="${o.value==='refresh-context'?'memory-context-refresh':'wealth-choice'}" data-value="${e(o.value)}" data-revision="${revision}"><span>${e(o.label)}${o.recommended?'<b class="memory-recommended">（推荐）</b>':''}</span>${o.detail&&!compact?`<small>${e(o.detail)}</small>`:''}</button>`).join('');
}
export function renderMemoryPanel(state,{status='',error='',standalone=false,context=null}={}) {
 const e=memoryEscape,p=state.profiles[state.persona];
 return `<div class="memory-panel-head"><span class="memory-eyebrow">FINPILOT / INTENT CLARIFICATION</span><span class="memory-demo-tag">模糊理财意图 · Demo</span></div>
 <h2>把「想理一理」，变成下一步。</h2><p class="memory-panel-lede">记住你的目标，也看清当下的财务。把模糊想法，变成有依据、可选择的方向。</p>
 <fieldset class="memory-modes"><legend>比较三种推荐呈现方式</legend><div>${Object.entries(MEMORY_MODES).map(([k,v],i)=>`<button type="button" data-memory-mode="${k}" aria-pressed="${state.mode===k}"><span>0${i+1}</span>${v}</button>`).join('')}</div></fieldset>
 <p class="memory-mode-note">${{answer:'在回答中自然提起记忆，推荐选项更容易理解。',evidence:'回答保持简洁；展开「推荐依据」查看信息来源。',both:'回答给出重点，折叠的推荐依据保留详细出处。'}[state.mode]}</p>
 <div class="memory-actions"><button type="button" class="memory-primary" data-memory-command="ask">试问：手里有点钱</button><button type="button" class="memory-outline" data-memory-command="new">新对话</button>${standalone?'':'<button type="button" class="memory-text" data-memory-command="window">新窗口 ↗</button>'}</div>
 <p class="memory-feedback" role="status">${e(status||'同一句问题：换个目标，或更新财务，再看推荐如何变化。')}</p>
 ${renderFinancialPanel(context)}
 <div class="memory-profile-heading"><label for="memory-persona">长期记忆 · 你想要什么</label><label class="memory-toggle"><input type="checkbox" id="memory-enabled" ${state.enabled?'checked':''}> 使用长期记忆</label></div>
 <select id="memory-persona">${Object.entries(MEMORY_PERSONAS).map(([id,p])=>`<option value="${id}" ${state.persona===id?'selected':''}>${e(p.title)} · ${e(p.subtitle)}</option>`).join('')}</select>
 <div class="memory-profile-card"><div class="memory-profile-title"><span class="memory-avatar">林</span><div><strong>小林的长期画像</strong><small>${p.facts.length?`${p.facts.length} 条已确认 · ${e(p.updatedAt)}`:'还没有已确认的记忆'}</small></div><span class="memory-status-dot ${state.enabled?'':'is-off'}"></span></div>
 ${!state.enabled?'<p class="memory-paused">已暂停使用记忆，新回答使用通用选项。</p>':''}
 <ul class="memory-facts">${p.facts.map(f=>`<li><span>${e(f.label)}</span><button type="button" data-memory-forget="${e(f.key)}" aria-label="忘记：${e(f.label)}">×</button></li>`).join('')}</ul>
 <details class="memory-sources"><summary>查看画像来源</summary>${p.facts.length?p.facts.filter((f,i,a)=>a.findIndex(x=>x.sourceId===f.sourceId)===i).map(f=>`<article><small>${e(f.sourceLabel)}</small><p>“${e(f.quote)}”</p></article>`).join(''):'<p>没有保留的来源。可重新载入演示画像。</p>'}</details></div>
 <details class="memory-update-panel" ${p.pending.length?'open':''}><summary>试试目标如何更新${p.pending.length?' · 有待确认更新':''}</summary>
 <p>发送一句新想法，自动提取候选记忆；确认后用于下一次对话。</p><form id="memory-update-form"><label for="memory-update-text">这次的新想法</label><textarea id="memory-update-text" rows="2" maxlength="500">${MEMORY_UPDATE}</textarea><button type="submit" class="memory-outline" ${!state.enabled?'disabled':''}>提取这条新对话</button></form>
 <p class="memory-caption">也支持「我想去旅行」「我想了解长期闲钱安排」「我更在意随时能取」。离线规则演示。</p>
 ${p.pending.length?`<div class="memory-pending"><strong>待确认的画像变化</strong>${p.pending.map(f=>`<p>${e(p.facts.find(old=>old.key===f.key)?.label||'未记录')} → <b>${e(f.label)}</b></p>`).join('')}<div><button type="button" class="memory-primary" data-memory-command="confirm">确认更新</button><button type="button" class="memory-text" data-memory-command="reject">忽略这次</button></div></div>`:''}
 <div class="memory-maintenance"><button type="button" data-memory-command="restore">重新载入演示画像</button><button type="button" data-memory-command="clear">清空当前画像</button></div></details>
 ${error?`<p class="memory-storage-error" role="alert">${e(error)}</p>`:''}
 <p class="memory-footnote">长期画像跨对话保留，财务快照每次重新核对。均为本地合成资料，不连接真实账户。</p>`;
}
export function mountMemoryPanel(root,{store,contextController=null,onChange=()=>{},onAsk=()=>{},onNew=()=>{},onWindow=()=>{},onExtract=()=>{},standalone=false}={}) {
 let status='',error='';
 const render=()=>{const opened=!!root.querySelector('.memory-update-panel[open]');const sources=!!root.querySelector('.memory-sources[open]');root.innerHTML=renderMemoryPanel(store.snapshot(),{status,error,standalone,context:contextController?.snapshot()});if(opened)root.querySelector('.memory-update-panel').open=true;if(sources)root.querySelector('.memory-sources').open=true;};
 const changed=type=>{render();onChange(store.snapshot(),type);};
 root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.contextAction){contextController?.change(b.dataset.contextAction);status=b.dataset.contextAction==='bill'?'已同步新增账单。目标没有变，推荐已按当前财务重新整理。':b.dataset.contextAction==='stale'?'资料待更新时，先同步，不沿用旧金额做推荐。':'已重新核对统一财务快照。';changed('context');}
  else if(b.dataset.memoryMode){store.change(s=>{s.mode=b.dataset.memoryMode;});status='已切换展示位置，画像与推荐排序保持一致。';changed('mode');}
  else if(b.dataset.memoryForget){store.change(s=>forgetMemory(s,b.dataset.memoryForget));status='已忘记这条信息，后续推荐会重新整理。';changed('profile');}
  else if(b.dataset.memoryCommand){switch(b.dataset.memoryCommand){
   case 'ask':onAsk();break;
   case 'new':onNew();status='已开启新对话，长期画像仍然保留。';render();break;
   case 'window':onWindow();break;
   case 'confirm':store.change(s=>confirmMemory(s));status='画像已更新。试问同一句话，看看新的推荐。';changed('profile');break;
   case 'reject':store.change(s=>{s.profiles[s.persona].pending=[];});status='已忽略，原画像保持不变。';changed('pending');break;
   case 'clear':store.change(s=>clearMemory(s));status='当前画像已清空，不再引用其中的信息。';changed('profile');break;
   case 'restore':store.change(s=>{const fixture=MEMORY_PERSONAS[s.persona];s.profiles[s.persona]={facts:fixture.sources.flatMap(source=>source.facts.map(f=>({...f,sourceId:source.id,sourceLabel:source.label,quote:source.text,asOf:source.date}))),pending:[],updatedAt:'2026-11-02'};s.revision++;});status='已重新载入合成画像。';changed('profile');break;
  }}
 });
 root.addEventListener('change',event=>{if(event.target.id==='memory-persona'){store.change(s=>{s.persona=event.target.value;s.revision++;});status='已切换画像，试问同一句话即可比较推荐。';changed('profile');}if(event.target.id==='memory-enabled'){store.change(s=>{s.enabled=event.target.checked;});status=event.target.checked?'已启用长期记忆。':'已暂停使用长期记忆。';changed('profile');}});
 root.addEventListener('submit',event=>{if(event.target.id!=='memory-update-form')return;event.preventDefault();const text=root.querySelector('#memory-update-text').value;let recognized=false;store.change(s=>{recognized=stageMemory(s,text);});status=recognized?(store.snapshot().profiles[store.snapshot().persona].pending.length?'已提取候选记忆，请核对后确认。':'这条信息已在画像中，无需重复保存。'):'这段话不在离线演示规则内，画像未改变。';changed('pending');if(recognized)onExtract(text);});
 render();return {refresh:render,notify:text=>{status=text;render();},error:text=>{error=text;render();}};
}
