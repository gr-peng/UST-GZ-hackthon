import {contextMoney as money} from './financial-context.mjs';

// Deterministic demo suggestions. Profile facts, this conversation's choices and
// the current financial snapshot stay separate; none grants transaction authority.
const DAY=86400000;
const dateAt=now=>new Date(now+8*3600000).toISOString().slice(0,10);
const addDays=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*DAY).toISOString().slice(0,10);
const validDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
const minor=(value,{zero=false}={})=>{const text=typeof value==='number'?String(value):typeof value==='string'?value.trim():'';const n=/^\d{1,9}$/.test(text)?Number(text):NaN;if(!Number.isSafeInteger(n)||n<(zero?0:1)||n>200000000)throw Error('请输入有效金额。');return n;};
const roundYuan=n=>Math.max(1,Math.ceil(n/100)*100);
const share=(amount,ratio)=>amount<=0?0:Math.max(1,Math.min(amount,Math.floor(amount*ratio/10000)*10000||Math.floor(amount*ratio)||1));
export const planningNow=g=>g.checkedAt||g.createdAt;
export const intentAvailable=g=>g.memoryRecall?.context?(g.memoryRecall.context.fresh&&g.memoryRecall.context.complete&&g.memoryRecall.context.shortfallMinor===0?g.memoryRecall.context.availableMinor:0):g.allocation.available;

export const existingIntentPlan=g=>g.memoryRecall?.context?.goalPlans?.find(j=>j.status!=='cancelled'&&j.persona===g.memoryRecall.persona&&j.goal===g.fields.goal);
export const goalGap=g=>Math.max(0,(g.memoryRecall.profile?.targetMinor||0)-(g.memoryRecall.profile?.progressMinor||0)-(g.memoryRecall.context?.goalPlans||[]).filter(j=>j.goal===g.memoryRecall.goalLabel&&j.persona===g.memoryRecall.persona).reduce((n,j)=>n+j.savedMinor+j.committedMinor,0));
export function intentFacts(g,{now=planningNow(g)}={}) {
 const p=g.memoryRecall?.profile||{},sameGoal=g.fields.goal===g.memoryRecall?.goalLabel;
 const deposited=(g.memoryRecall?.context?.goalPlans||[]).filter(j=>j.persona===g.memoryRecall.persona&&j.goal===g.fields.goal).reduce((sum,j)=>sum+j.savedMinor,0);
 const progress=sameGoal?(g.fields.progress_minor??((p.progressMinor||0)+deposited)):deposited;
 const previousTarget=sameGoal?p.targetMinor:null;
 const today=dateAt(now),start=now<Date.parse(today+'T09:00:00+08:00')?today:addDays(today,1);
 const due=g.fields.no_deadline?null:g.fields.goal_date??(sameGoal?p.dueDate:null);
 const dueDate=validDate(due)&&due>=start?due:null;
 const days=dueDate?Math.round((Date.parse(dueDate+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/DAY)+1:null;
 return {profile:p,progress,previousTarget,remaining:previousTarget?Math.max(0,previousTarget-progress):null,start,dueDate,days,available:intentAvailable(g)};
}

export function intentTargetOptions(g) {
 const f=intentFacts(g),available=f.available,reserve=g.memoryRecall.context?.reserveMinor||0;
 if(f.remaining>0){
  const larger=f.remaining+roundYuan(f.remaining/3);
  return [{value:f.remaining,label:`补齐剩余 ${money(f.remaining)}`,recommended:true},...(larger<=available?[{value:larger,label:`多留一点：${money(larger)}`}]:[])];
 }
 if(g.fields.goal==='应急备用'&&reserve>0)return [{value:reserve,label:`再攒一个月必要支出：${money(reserve)}`,recommended:true},{value:reserve*2,label:`再攒两个月：${money(reserve*2)}`}];
 return [0.1,0.25].map((ratio,i)=>({value:share(available,ratio),label:`先设一个 ${money(share(available,ratio))} 的目标`,recommended:i===0}));
}

export function savingsPace(g,{now=planningNow(g)}={}) {
 const f=intentFacts(g,{now}),target=g.fields.target_minor||0;
 const period=f.days||(g.fields.goal==='应急备用'?180:90);
 const maxDaily=Math.max(0,Math.min(200000,target,target<=f.available?f.available:Math.floor(f.available/30)));
 const required=roundYuan(target/period);
 // Spare cash can fund an earlier finish. An explicitly chosen deadline still wins.
 const accelerated=!g.fields.schedule_explicit&&f.available>=target&&period>30&&Math.min(roundYuan(target/30),maxDaily)>required;
 const recommended=Math.min(roundYuan(target/(accelerated?30:period)),maxDaily);
 const alternative=accelerated?Math.min(maxDaily,roundYuan(target/Math.min(period,60))):Math.min(maxDaily,roundYuan(recommended*0.75));
 const values=[recommended,alternative].filter((v,i,a)=>{
  const finish=new Date(Date.parse(f.start+'T00:00:00Z')+(Math.ceil(target/v)-1)*DAY);
  return v>0&&a.indexOf(v)===i&&Number.isFinite(finish.getTime())&&finish.getUTCFullYear()<=9999;
 });
 const estimate=daily=>({days:Math.ceil(target/daily),finish:addDays(f.start,Math.ceil(target/daily)-1),reviewCap:Math.min(target,daily*30)});
 return {...f,target,period,maxDaily,required,recommended,values,estimate,accelerated,meetsDeadline:!f.days||recommended>=target/f.days};
}

export function validateIntentSaving(g,{now=planningNow(g)}={}) {
 if(!g.memoryRecall)return;
 const c=g.memoryRecall.context,pace=savingsPace(g,{now});
 if(existingIntentPlan(g))throw Error('这个目标已有储蓄计划，请先查看已有计划。');
 if(!c?.fresh||c.shortfallMinor>0)throw Error('当前财务需要重新核对，暂不确认储蓄安排。');
 const daily=minor(g.fields.daily_minor),target=minor(g.fields.target_minor);
 if(daily>200000||daily>target)throw Error('每日金额须不超过 ¥2,000，且不能超过本次目标。');
 if(Math.min(target,daily*30)>pace.available)throw Error('首个30天的计划金额超过当前可规划资金，请降低每日金额或先更新财务。');
 const finish=new Date(Date.parse(pace.start+'T00:00:00Z')+(Math.ceil(target/daily)-1)*DAY);
 if(!Number.isFinite(finish.getTime())||finish.getUTCFullYear()>9999)throw Error('这个每日金额对应的完成时间太远，请提高每日金额或降低目标。');
}

export function applyIntentChoice(g,value,{now}) {
 if(!g.memoryRecall)return false;
 const rawStage=g.stage,stage=({goal_amount_custom:'goal_amount',daily_custom:'daily',extra_amount_custom:'extra_amount'})[rawStage]||rawStage,p=g.memoryRecall.profile||{},rememberedDue=g.fields.goal===g.memoryRecall.goalLabel?p.dueDate:null;
 if(value==='back-step'){
  const previous={goal_amount_custom:'goal_amount',goal_adjust:'goal_amount_custom',goal_progress:'goal_adjust',pace_adjust:'daily',daily_custom:'pace_adjust',extra_amount_custom:'extra_amount',amount_custom:'amount'}[rawStage];
  if(!previous)throw Error('请使用当前问题的选项。');g.stage=previous;return true;
 }
 const links={goal_amount:{'custom-target':'goal_amount_custom'},goal_amount_custom:{'goal-details':'goal_adjust'},daily:{'adjust-pace':'pace_adjust'},pace_adjust:{'custom-daily':'daily_custom'},saving_confirm:{'adjust-saving':'saving_adjust'},saving_adjust:{'edit-daily':'daily'},extra_amount:{'custom-extra':'extra_amount_custom'},amount:{'custom-investment':'amount_custom'},products:{'edit-risk':'experience','edit-investment-horizon':'horizon'},confirm:{'edit-investment-amount':'amount'}};
 if(links[rawStage]?.[value]){g.stage=links[rawStage][value];return true;}
 if(['direction','context_review','bill_review','goal_defer'].includes(stage)){
  if(value==='review-bill'){g.stage='bill_review';return true;}
  if(value==='defer-goal'){g.stage='goal_defer';return true;}
  if(stage==='goal_defer'&&value==='pause-draft'){g.stage='cancelled';g.completionText='这次先缓一缓，原来的长期目标仍保留。等近期用钱核对好，再重新安排；现在没有新增存款或申购。';return true;}
  if(value==='restart-direction'){g.fields={};g.stage='direction';return true;}
 }
 if(stage==='direction'&&value==='unsure'){g.fields={direction:'save'};g.stage='goal';return true;}
 if(value==='change-goal'&&['goal_amount','goal_progress','goal_adjust','saving_horizon','daily','pace_adjust','saving_adjust','saving_confirm','existing_goal'].includes(stage)){g.fields={direction:'save'};g.stage='goal';return true;}
 if(value==='edit-target'&&['daily','pace_adjust','saving_adjust','saving_confirm','existing_goal'].includes(stage)){delete g.fields.daily_minor;g.stage='goal_amount';return true;}
 if(value==='edit-horizon'&&['daily','pace_adjust','saving_adjust','saving_confirm','existing_goal'].includes(stage)){g.stage='saving_horizon';return true;}
 if(value==='edit-extra'&&['horizon','products','amount','confirm'].includes(stage)){delete g.fields.extra_minor;delete g.fields.product_id;delete g.fields.amount_minor;g.stage='extra';return true;}
 if(stage==='direction'&&value==='save'&&g.memoryRecall.goalLabel){g.fields={direction:'save',goal:g.memoryRecall.goalLabel,goal_source:'memory'};g.stage=existingIntentPlan(g)?'existing_goal':'goal_amount';return true;}
 if(stage==='goal'&&value===g.memoryRecall.goalLabel){g.fields={direction:'save',goal:value};g.stage=existingIntentPlan(g)?'existing_goal':'goal_amount';return true;}
 if(['goal_amount','goal_adjust'].includes(stage)&&value==='edit-progress'){if(g.fields.goal!==g.memoryRecall.goalLabel||!p.targetMinor)throw Error('当前目标没有可核对的历史进度。');g.stage='goal_progress';return true;}
 if(stage==='goal_progress'){
  const progress=minor(value,{zero:true});
  if(p.targetMinor&&progress>p.targetMinor)throw Error('已攒金额高于历史总目标，请先核对目标或换一个目标。');
  g.fields.progress_minor=progress;g.stage='goal_amount';return true;
 }
 if(stage==='goal_amount'){
  g.fields.target_minor=minor(value);delete g.fields.daily_minor;
  const f=intentFacts(g,{now});g.fields.overall_target_minor=f.progress+g.fields.target_minor;
  if(f.dueDate)g.fields.goal_date=f.dueDate;
  g.stage=f.dueDate||g.fields.no_deadline?'daily':'saving_horizon';return true;
 }
 if(stage==='saving_horizon'){
  if(value==='remembered-date'&&validDate(rememberedDue)&&rememberedDue>=intentFacts(g,{now}).start){g.fields.goal_date=rememberedDue;g.fields.no_deadline=false;}
  else if(value==='不设期限'){g.fields.no_deadline=true;g.fields.goal_date=null;}
  else {const days={'一个月':30,'三个月':90,'半年':180,'一年':365}[value];if(!days)throw Error('请选择本次完成时间。');g.fields.goal_date=addDays(intentFacts(g,{now}).start,days-1);g.fields.no_deadline=false;}
  g.fields.schedule_explicit=true;g.stage='daily';return true;
 }
 if(stage==='daily'){const daily=minor(value);validateIntentSaving({...g,fields:{...g.fields,daily_minor:daily}},{now});g.fields.daily_minor=daily;g.fields.confirmation_start=intentFacts(g,{now}).start;g.stage='saving_confirm';return true;}
 if(stage==='extra'&&value==='remembered-extra'){
  const gap=goalGap(g);
  if(!gap||gap>intentAvailable(g))throw Error('当前可规划资金不足以一次留足历史目标，请先调整目标或补充财务资料。');
  g.fields.extra=g.memoryRecall.goalLabel;g.fields.extra_minor=gap;g.stage='horizon';return true;
 }
 if(stage==='extra'&&value==='adjust-extra'){g.stage='extra_kind';return true;}
 if(stage==='extra_kind'){if(!['旅行','学费','其他'].includes(value))throw Error('请选择当前的用钱需求。');g.fields.extra=value;delete g.fields.extra_minor;g.stage='extra_amount';return true;}
 if(stage==='extra'&&value==='reserve-extra'){if(g.memoryRecall.context.reserveMinor>intentAvailable(g))throw Error('当前资金不足以额外留一个月，请核对预留金额。');g.fields.extra='应急备用';g.fields.extra_minor=g.memoryRecall.context.reserveMinor;g.stage='horizon';return true;}
 if(stage==='extra_amount'){
  const amount=minor(value);if(amount>intentAvailable(g))throw Error('额外预留不能超过扣除生活预算和应急预留后的资金。');
  g.fields.extra_minor=amount;g.stage='horizon';return true;
 }
 if(stage==='amount_custom'){
  const amount=minor(value);if(amount>Math.max(0,intentAvailable(g)-(g.fields.extra_minor||0)))throw Error('申购金额不能超过可投资资金。');
  g.fields.amount_minor=amount;g.stage='confirm';g.expiresAt=now+300000;return true;
 }
 return false;
}

