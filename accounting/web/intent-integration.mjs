import {demoResetKeys} from './desktop-session.mjs';
import {MEMORY_KEY,MEMORY_PERSONAS,MEMORY_UPDATE,createMemoryStore,recallMemory,setRecallMode,stageMemory,confirmMemory,clearMemory,extractMemory,extractUserMemory} from './long-term-memory.mjs';
import {FINANCIAL_CONTEXT_KEY,createFinancialContextController,activeSavingsCommitments} from './financial-context.mjs';
import {refreshWealthGuide,recordWealthReply} from './wealth-guide.mjs';
import {memoryEscape as escape,renderFinancialSummary} from './memory-ui.mjs';

// The original App always uses the selected presentation. A comparison preview's
// saved mode must not turn the integrated, personalized reply back into generic text.
export function recallIntegratedMemory(state,context) {
 return setRecallMode(recallMemory(state,context),'both');
}

// Explicit demo replay restores the synthetic fixtures; ordinary new-chat still keeps memory.
export function intentReplayResetKeys(keys,session) {
 const owned=new Set([MEMORY_KEY,FINANCIAL_CONTEXT_KEY]);
 return [...new Set([...demoResetKeys(keys,session),...keys.filter(key=>owned.has(key))])];
}

export function recommendationInputs(state) {
 return JSON.stringify([state.persona,state.enabled,state.profiles[state.persona].facts]);
}

function renderControls(state,context,status,error) {
 const profile=state.profiles[state.persona];
 return `<p class="intent-note">合成演示资料：长期画像跨对话保留，当前财务在提问时重新核对。</p>
 <label class="intent-field">长期画像<select data-intent-persona>${Object.entries(MEMORY_PERSONAS).map(([id,p])=>`<option value="${id}" ${state.persona===id?'selected':''}>${escape(state.profiles[id].facts.find(f=>f.key==='goal')?.value===p.sources[0].facts[0].value?p.subtitle:p.title+'（已更新）')}</option>`).join('')}</select></label>
 <label class="intent-toggle"><input type="checkbox" data-intent-enabled ${state.enabled?'checked':''}> 使用长期记忆</label>
 <p class="intent-facts">${profile.facts.length?profile.facts.map(f=>escape(f.label)).join(' · '):'当前没有已确认的记忆'}</p>
 <details class="intent-update"><summary>更新记住的目标${profile.pending.length?' · 待确认':''}</summary>
 <label class="intent-field">新的想法<textarea data-intent-input rows="2" maxlength="500">${MEMORY_UPDATE}</textarea></label>
 <button type="button" data-intent-action="extract" ${state.enabled?'':'disabled'}>提取新想法</button>
 ${profile.pending.length?`<div class="intent-pending"><p>待确认：${profile.pending.map(f=>`${escape(profile.facts.find(old=>old.key===f.key)?.label||'未记录')} → ${escape(f.label)}`).join('；')}</p><button type="button" data-intent-action="confirm">确认更新</button><button type="button" data-intent-action="reject">忽略</button></div>`:''}
 <div class="intent-tools-row"><button type="button" data-intent-action="clear">清空当前画像</button><button type="button" data-intent-action="restore">恢复演示画像</button></div></details>
 <p class="intent-section-title">当前财务 <span>${context.fresh?'已同步':'待更新'}</span></p>${renderFinancialSummary(context)}
 <p class="intent-note">${escape(context.asOf)}（演示时点）· 账户、预算、预留和待付事项使用同一份快照。</p>
 <div class="intent-tools-row"><button type="button" data-intent-action="${context.billMinor?'reset':'bill'}">${context.billMinor?'恢复原财务':'模拟新增学费账单'}</button><button type="button" data-intent-action="${context.fresh?'stale':'refresh'}">${context.fresh?'模拟资料待更新':'同步财务资料'}</button></div>
 <div class="intent-tools-row"><button type="button" data-intent-action="new">新对话，保留记忆</button><button type="button" data-intent-action="window">新窗口 ↗</button></div>
 ${status?`<p class="intent-note" role="status">${escape(status)}</p>`:''}${error?`<p class="intent-error" role="alert">${escape(error)}</p>`:''}`;
}

export function installMemoryDemo({getState,save,render,newChat,ask,readAllocation,readNow=()=>Date.now(),showModal,enabled=true}={}) {
 if(!enabled)return null;
 let storage,status='',error='';const roots=new Set(),events=new AbortController();
 const reportError=text=>{error=text;refresh();};
 try{storage=localStorage;}catch{error='浏览器存储不可用，记忆仅保留到本页关闭。';}
 const store=createMemoryStore(storage,{onError:reportError});
 const finances=createFinancialContextController(storage,readAllocation,{readInvested:()=>Math.round((getState().invested||0)*100),readCommitments:()=>activeSavingsCommitments(getState(),readNow()),onError:reportError});
 const outer=(()=>{try{return parent.document.querySelector('[data-intent-panel]')?parent:window;}catch{return window;}})();
 const sideRoot=outer.document.querySelector('[data-intent-panel]');
 const recall=()=>recallIntegratedMemory(store.snapshot(),finances.snapshot());
 function refresh(){
  for(const root of roots){
   if(!root.isConnected){roots.delete(root);continue;}
   const opened=!!root.querySelector('.intent-update[open]');
   root.innerHTML=renderControls(store.snapshot(),finances.snapshot(),status,error);
   if(opened||store.snapshot().profiles[store.snapshot().persona].pending.length)root.querySelector('.intent-update').open=true;
  }
 }
 function sync(){
  const state=getState(),guide=state.wealthGuide;
  // Completed messages keep their financial snapshot; only an active proposal changes.
  if(!guide||['done','cancelled'].includes(guide.stage))return;
  const next=recall();if(refreshWealthGuide(state,{now:readNow(),recall:next}))recordWealthReply(state,{now:readNow()});
  save();render();
 }
 function changed(message,{recommend=true}={}){status=message;refresh();if(recommend)sync();}
 function extract(text){
  let recognized=false;store.change(state=>{recognized=stageMemory(state,text,new Date(readNow()+8*3600000).toISOString().slice(0,10));});
  const pending=store.snapshot().profiles[store.snapshot().persona].pending.length;
  changed(recognized?(pending?'已提取候选记忆，核对并确认后生效。':'这条信息已在画像中，无需重复保存。'):'离线演示支持：我想去旅行、我想先攒应急备用金、我想了解长期闲钱安排、我更在意随时能取。',{recommend:false});
  return recognized;
 }
 function openTools(){
  if(sideRoot){sideRoot.closest('[data-intent-tools]').open=true;sideRoot.scrollIntoView({block:'nearest'});return;}
  showModal?.('演示资料','<div class="intent-controls" data-intent-dialog></div>');
  const root=document.querySelector('[data-intent-dialog]');if(root)mount(root);
 }
 function mount(root){
  roots.add(root);refresh();
  root.addEventListener('click',event=>{
   const action=event.target.closest('[data-intent-action]')?.dataset.intentAction;if(!action)return;
   if(['bill','reset','stale','refresh'].includes(action)){
    finances.change(action);changed(action==='bill'?'已同步学费账单；长期目标保留，推荐按当前财务更新。':action==='stale'?'资料待更新，先核对后再安排资金。':'已重新核对当前财务。');
   }else if(action==='extract')extract(root.querySelector('[data-intent-input]').value);
   else if(action==='confirm'){store.change(confirmMemory);changed('已确认新目标，下一次对话也会记得。');}
   else if(action==='reject'){store.change(state=>{state.profiles[state.persona].pending=[];});changed('已忽略，本次不更新画像。',{recommend:false});}
   else if(action==='clear'){store.change(clearMemory);changed('已清空当前画像，后续不再引用这些记忆。');}
   else if(action==='restore'){store.change(state=>{state.profiles[state.persona]={facts:extractMemory(MEMORY_PERSONAS[state.persona].sources),pending:[],updatedAt:'2026-11-02'};state.revision++;});changed('已恢复合成演示画像。');}
   else if(action==='new'){newChat();changed('已开启新对话，长期画像仍然保留。',{recommend:false});}
   else if(action==='window'){const url=new URL(outer.location.href);url.searchParams.set('offline','1');url.searchParams.set('session','intent-'+crypto.randomUUID());url.hash='/bot';outer.open(url.href,'_blank','noopener');}
  },{signal:events.signal});
  root.addEventListener('change',event=>{
   if(event.target.matches('[data-intent-persona]')){store.change(state=>{state.persona=event.target.value;state.revision++;});changed('已切换画像，当前推荐已重新整理。');}
   if(event.target.matches('[data-intent-enabled]')){store.change(state=>{state.enabled=event.target.checked;});changed(event.target.checked?'已启用长期记忆。':'已暂停使用长期记忆，仍核对当前财务。');}
  },{signal:events.signal});
 }
 if(sideRoot){sideRoot.closest('[data-intent-tools]').hidden=false;mount(sideRoot);}
 // Old comparison settings never change the selected 03 presentation in the App.
 for(const message of getState().messages||[])if(message.memoryRecall){message.memoryRecall=setRecallMode(message.memoryRecall,'both');message.text=message.memoryRecall.reply;}
 if(getState().wealthGuide?.memoryRecall)getState().wealthGuide.memoryRecall=setRecallMode(getState().wealthGuide.memoryRecall,'both');
 outer.addEventListener('storage',event=>{
  if(![MEMORY_KEY,FINANCIAL_CONTEXT_KEY].includes(event.key))return;
  const previousMemory=recommendationInputs(store.snapshot()),previousContext=finances.snapshot().id;
  store.reload();finances.reload();refresh();
  // Pending candidates and comparison modes do not invalidate an in-progress plan.
  if(previousMemory!==recommendationInputs(store.snapshot())||previousContext!==finances.snapshot().id)sync();
 },{signal:events.signal});
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-action="memory-details"]'))openTools();
  if(event.target.closest('[data-action="memory-context-refresh"]')){finances.change('refresh');changed('已同步财务资料，推荐已重新整理。');}
 },{signal:events.signal});
 window.addEventListener('pagehide',()=>events.abort(),{once:true});
 return {store,recall:()=>{store.reload();finances.reload();refresh();return recall();},observe:text=>{if(!store.snapshot().enabled||!extractUserMemory(text).length||!extract(text))return false;queueMicrotask(openTools);return true;}};
}
