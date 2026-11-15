import {STORY_DATE} from './demo-calendar.mjs';
// One read-only financial snapshot for the summary, explanation and direction choices.
// Values are integer fen. Assets that cannot be spent immediately are not available cash.
export const FINANCIAL_CONTEXT_KEY='finpilot-demo-financial-context-v1';
export const contextMoney=n=>'¥'+(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
export const PREVIEW_ALLOCATION=Object.freeze({cash:5000000,obligations:84517,buffer:552093,available:4363390});
export function activeSavingsCommitments(state,now=Date.now()) {
 const today=new Date(now+8*3600000).toISOString().slice(0,10);
 const jars=Object.values({...state.savingsJars,...(state.savingsJar?{[state.savingsJar.id]:state.savingsJar}:{})}).filter(j=>!state.savingsArchived?.[j.id]);
 const commitment=j=>j.status==='active'&&j.review_until>=today?Math.max(0,Math.min(j.target_minor-j.saved_minor,(j.total_cap_minor||0)-(j.cycle_deposited_minor||0))):0;
 return {committedMinor:jars.reduce((sum,j)=>sum+commitment(j),0),goalPlans:jars.filter(j=>j.intent_goal).map(j=>({id:j.id,goal:j.intent_goal,persona:j.intent_persona,status:j.status,targetMinor:j.target_minor,savedMinor:j.saved_minor,dailyMinor:j.daily_minor,committedMinor:commitment(j)}))};
}
export function buildFinancialContext(allocation,{extraBill=false,stale=false,invested=0,committedMinor=0,goalPlans=[]}={}) {
 const complete=['cash','obligations','buffer'].every(key=>Number.isSafeInteger(allocation?.[key])&&allocation[key]>=0);
 const a=complete?allocation:{cash:0,obligations:0,buffer:0};
 const committed=Number.isSafeInteger(committedMinor)&&committedMinor>=0?committedMinor:0;
 const billMinor=extraBill?4500000:0,protectedMinor=a.obligations+a.buffer+billMinor+committed;
 const availableMinor=Math.max(0,a.cash-protectedMinor),shortfallMinor=Math.max(0,protectedMinor-a.cash);
 return {id:`fc-${a.cash}-${a.obligations}-${a.buffer}-${billMinor}-${committed}-${JSON.stringify(goalPlans)}-${stale?'pending':'synced'}`,complete,fresh:complete&&!stale,committedMinor:committed,goalPlans,
  cashMinor:a.cash,budgetMinor:a.obligations,reserveMinor:a.buffer,billMinor,protectedMinor,availableMinor,shortfallMinor,
  investedMinor:Number.isSafeInteger(invested)&&invested>=0?invested:0,
  asOf:STORY_DATE+(extraBill?' 09:05':' 09:00'),source:'本地合成账户',
  sources:[{label:'账户余额',detail:'统一账本的当前现金余额'},{label:'近期生活预算',detail:'本月必要支出预算扣除已发生支出'},{label:'应急预留',detail:'按上月必要支出预留一个月'},{label:'待付事项',detail:extraBill?'新增一笔5天后到期的学费 ¥45,000（合成）':'此演示没有额外待付事项'}]};
}
export function withFinancialContext(recall,context) {
 if(!context)return recall;
 const result={...recall,context};let reply=recall.personalReply;
 if(!context.fresh){
  reply='当前财务资料还需要更新。先核对账户、近期账单和预留资金，再决定这笔钱怎么安排。';
  result.options=[{value:'refresh-context',label:'先更新财务信息',detail:'核对同一份最新快照后再推荐',recommended:true},{value:'unsure',label:'先聊聊我的目标'}];
  result.reason='财务快照未完成同步，暂不判断可安排金额。';
 }else if(context.shortfallMinor>0){
  const remembered=recall.goalLabel==='旅行'?'你的旅行目标我还记得。':recall.used?'你的长期目标还在。':'';
  reply=`${remembered}${context.billMinor?'刚同步的学费账单让近期预留还差':'核对当前账户后，近期预留还差'} ${contextMoney(context.shortfallMinor)}。先留足近期用钱，再讨论这笔闲钱怎么安排。`;
  result.options=[{value:'review-context',label:'先留足近期用钱',detail:`近期预留缺口 ${contextMoney(context.shortfallMinor)}`,recommended:true},{value:'unsure',label:'重新聊聊目标和节奏',detail:'长期目标可以保留，时间可以调整'}];
  result.reason='历史目标未改变，但新增的近期支出优先影响本次安排。可规划资金为零，先核对缺口。';
 }else{
  const intro=recall.goalLabel==='旅行'?'记得你在为旅行攒钱。':recall.goalLabel==='应急备用'?'记得你想先攒应急备用金。':recall.used?'记得你想了解闲钱安排，并先看清风险和费用。':'我们先看看当下的用钱安排。';
  reply=`${intro}结合当前账户，留好${context.billMinor?'近期账单、':''}生活预算和应急预留后，有 ${contextMoney(context.availableMinor)} 可进一步规划。${recall.goalLabel?'要先继续这个目标吗？':'先确认目标和用钱时间，再决定下一步。'}`;
  result.reason=(recall.reason||'先明确用户目标，再选择安排方向。')+` 本次可规划 ${contextMoney(context.availableMinor)}，并非自动建议全部投入。`;
 }
 result.personalReply=reply;result.reply=recall.mode==='evidence'?(context.fresh?'先选一个方向，我们一步一步来。':'先更新财务信息，我们再决定下一步。'):reply;
 return result;
}
export function createFinancialContextController(storage,readAllocation=()=>PREVIEW_ALLOCATION,{readInvested=()=>0,readCommitments=()=>({}),onError=()=>{}}={}) {
 let scenario={extraBill:false,stale:false};
 function reload(){try{const saved=JSON.parse(storage?.getItem(FINANCIAL_CONTEXT_KEY)||'null');if(saved&&typeof saved.extraBill==='boolean'&&typeof saved.stale==='boolean')scenario=saved;}catch{} }
 reload();
 const snapshot=()=>buildFinancialContext(readAllocation(),{...scenario,invested:readInvested(),...readCommitments()});
 return {snapshot,reload,change:action=>{if(action==='bill')scenario={extraBill:true,stale:false};else if(action==='reset')scenario={extraBill:false,stale:false};else if(action==='stale')scenario.stale=true;else if(action==='refresh')scenario.stale=false;else return snapshot();try{storage?.setItem(FINANCIAL_CONTEXT_KEY,JSON.stringify(scenario));}catch{onError('财务演示状态未保存，新窗口可能恢复初始快照。');}return snapshot();}};
}
