import {MEMORY_PROMPT,createMemoryStore,stageMemory,setRecallMode} from './long-term-memory.mjs';
import {memoryEscape,renderMemoryEvidence,renderMemoryOptions,renderFinancialSummary,mountMemoryPanel} from './memory-ui.mjs';
import {createFinancialContextController} from './financial-context.mjs';

// Lightweight file:// preview of the same memory engine used by the full App.
const phone=document.querySelector('#memory-phone-content');
const e=memoryEscape;let transcript=[],choice=null,recall=null,panel,storageError='';
let storage;try{storage=localStorage;}catch{}
const store=createMemoryStore(storage,{onError:text=>{storageError=text;panel?.error(text);}});
const contextController=createFinancialContextController(storage);
const currentRecall=()=>store.recall(contextController.snapshot());
function paintPhone(){
 phone.innerHTML=`<div class="mp-session"><span class="mp-live-dot"></span> 模糊理财意图 · ${contextController.snapshot().fresh?'财务已核对':'等待财务更新'}<span>合成演示</span></div>${transcript.length?transcript.map(m=>m.role==='user'?`<div class="mp-user">${e(m.text)}</div>`:`<div class="mp-assistant"><img src="web/assets/dot.png" alt="FinPilot"><div>${m.recall?renderMemoryEvidence(m.recall):''}<div class="mp-bubble">${e(m.text)}</div></div></div>`).join(''):'<div class="mp-empty"><span>从新的对话开始</span><h2>先把想法聊清楚。</h2><p>你的目标 + 当前财务，一起决定下一步。</p></div>'}${recall&&!choice?`<section class="mp-options wealth-guide"><h3>你更想先做哪件事？</h3>${renderMemoryOptions(recall,1)}<button class="mp-cancel" type="button" data-preview-choice="cancel">暂不安排</button></section>`:''}${choice?renderContinuation(choice):''}`;
}
function renderContinuation(value){
 if(value==='review-context')return `<div class="mp-followup"><span class="mp-step">下一步 / 核对近期用钱</span><h3>先把近期安排留足</h3>${renderFinancialSummary(recall.context)}<p>先核对账单金额与到期日，再讨论目标的节奏。这一步不移动资金。</p><button data-preview-choice="back">返回方向选择</button></div>`;
 if(value==='cancel')return '<div class="mp-followup"><h3>这次先放一放</h3><p>记住的目标仍在，下次想聊时再继续。</p><button data-preview-choice="back">回到方向选择</button></div>';
 if(value==='save')return `<div class="mp-followup"><span class="mp-step">下一步 / 确认目标</span><h3>${recall.goalLabel?`继续为「${e(recall.goalLabel)}」攒钱？`:'想为哪个目标攒钱？'}</h3><p>记忆只是起点。目标金额、每次存入多少，都由你重新确认。</p><div class="mp-goals">${['旅行','应急备用','学习提升'].map(t=>`<button data-preview-goal="${t}">${t}</button>`).join('')}</div><button class="mp-back" data-preview-choice="back">返回选择其他方向</button></div>`;
 if(value==='earn')return '<div class="mp-followup"><span class="mp-step">下一步 / 了解用钱计划</span><h3>这笔钱大概多久不用？</h3><p>先留好生活费与备用金，再了解风险、期限和费用。</p><div class="mp-goals"><button data-preview-horizon="随时可能用">随时可能用</button><button data-preview-horizon="半年后">半年后</button><button data-preview-horizon="一年以上">一年以上</button></div><button class="mp-back" data-preview-choice="back">返回选择其他方向</button></div>';
 if(value==='unsure')return '<div class="mp-followup"><h3>计划变了，也没关系。</h3><p>告诉我新的想法。例如「我想先攒应急备用金」，确认后我会记住；或先暂停使用长期记忆。</p><button data-preview-choice="back">返回方向选择</button></div>';
 return `<div class="mp-followup"><h3>${e(value)}</h3><p>已明确这一步的方向。接下来一起核对金额和日期，确认前不做任何资金安排。</p><button data-preview-choice="back">返回方向选择</button></div>`;
}
function newChat(){transcript=[];recall=null;choice=null;paintPhone();document.querySelector('#memory-chat-input').value='';}
function send(text){
 text=String(text).trim().slice(0,500);if(!text)return;
 transcript.push({role:'user',text});choice=null;
 let recognized=false;store.change(s=>{recognized=stageMemory(s,text);});
 if(recognized){recall=null;transcript.push({role:'assistant',text:'已提取你的新想法。请在左侧核对候选记忆，确认后我会在新对话里参考它。'});panel.notify('已提取候选记忆，请展开「试试目标如何更新」并确认。');}
 else if(/手里有点钱|想理一理|有点闲钱|想攒点钱/.test(text)){recall=currentRecall();transcript.push({role:'assistant',text:recall.reply,recall});}
 else {recall=null;transcript.push({role:'assistant',text:'这里是离线记忆演示。可以试问「手里有点钱，想理一理」，或使用左侧列出的新想法更新画像。'});}
 paintPhone();document.querySelector('#memory-chat-input').value='';
}
function updateRecommendation(type){
 if(type!=='pending'&&recall){recall=type==='mode'?setRecallMode(recall,store.snapshot().mode):currentRecall();const last=transcript.findLast(m=>m.recall);if(last){last.recall=recall;last.text=recall.reply;}choice=null;paintPhone();}
}
panel=mountMemoryPanel(document.querySelector('[data-memory-panel]'),{store,contextController,standalone:false,onWindow:()=>window.open(location.href,'_blank','noopener'),onNew:newChat,onAsk:()=>{newChat();send(MEMORY_PROMPT);},onChange:(_,type)=>{
 updateRecommendation(type);
},onExtract:text=>{transcript=[{role:'user',text},{role:'assistant',text:'已从这段新对话提取候选记忆。确认更新后，开启新对话再试问同一句话。'}];recall=null;choice=null;paintPhone();}});
if(storageError)panel.error(storageError);
document.querySelector('#memory-chat-form').addEventListener('submit',event=>{event.preventDefault();send(document.querySelector('#memory-chat-input').value);});
document.querySelector('#memory-new-chat').addEventListener('click',newChat);
phone.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.value==='refresh-context'){contextController.change('refresh');panel.notify('已同步财务资料，推荐已按当前快照重新整理。');updateRecommendation('context');return;}if(b.dataset.value)choice=b.dataset.value;else if(b.dataset.previewChoice)choice=b.dataset.previewChoice==='back'?null:b.dataset.previewChoice;else if(b.dataset.previewGoal)choice='目标：'+b.dataset.previewGoal;else if(b.dataset.previewHorizon)choice='用钱时间：'+b.dataset.previewHorizon;paintPhone();});
window.addEventListener('storage',()=>{store.reload();contextController.reload();panel.refresh();updateRecommendation('context');});
// Start with a complete example so the three versions are immediately comparable.
send(MEMORY_PROMPT);
