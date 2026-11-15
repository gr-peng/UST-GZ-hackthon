import {DEMO_START_AT} from '../web/demo-calendar.mjs';
import {savingsGoalProgress,renderSavingsJarSnapshot,renderSavingsJar,savingsTotal} from '../web/savings-coach.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../web/engine.mjs';
import {freshMemory,recallMemory,decodeMemory,forgetMemory,stageMemory,confirmMemory,MEMORY_UPDATE} from '../web/long-term-memory.mjs';
import {buildFinancialContext,activeSavingsCommitments} from '../web/financial-context.mjs';
import {startWealthGuide,wealthChoice,allocation,renderWealthGuide,refreshWealthGuide,wealthOperation,parseWealthAmount,investable,wealthDialogue,recordWealthReply} from '../web/wealth-guide.mjs';
import {intentFacts,savingsPace,intentTargetOptions} from '../web/intent-planning.mjs';
import {memoryEscape,renderIntentEvidence} from '../web/memory-ui.mjs';
import {createCompanionController} from '../web/companion-controller.mjs';
import {intentReplayResetKeys} from '../web/intent-integration.mjs';
import {MEMORY_KEY,createMemoryStore} from '../web/long-term-memory.mjs';
import {FINANCIAL_CONTEXT_KEY,createFinancialContextController} from '../web/financial-context.mjs';
import {appStateKey} from '../web/desktop-session.mjs';
import {offlineResult,OFFLINE_PROMPTS} from '../web/offline-demo.mjs';

const NOW=Date.parse('2026-11-02T01:00:00Z');
const html=s=>renderWealthGuide(s,{esc:memoryEscape});
const dialogue=s=>wealthDialogue(s,{now:NOW});
const explanation=s=>dialogue(s).reply+' '+renderIntentEvidence(dialogue(s).evidence);
function setup(persona='travel',now=NOW){const s=fresh(),memory=freshMemory();memory.persona=persona;startWealthGuide(s,{now,id:'intent-test'});s.wealthGuide.memoryRecall=recallMemory(memory,buildFinancialContext(allocation(s,{now})));return s;}
function pick(s,value,now=NOW){return wealthChoice(s,String(value),{now,expectedRevision:s.wealthGuide.revision});}
function plan(s=setup()){pick(s,'save');pick(s,900000);pick(s,5400);return s;}

test('travel uses remembered goal, remaining target and date through the final card',()=>{
 const s=setup();pick(s,'save');assert.equal(s.wealthGuide.stage,'goal_amount');
 assert.doesNotMatch(html(s),/想为哪个目标攒钱|¥600<|¥3,000<|¥6,000</);
 assert.equal(intentTargetOptions(s.wealthGuide)[0].value,900000);
 pick(s,900000);assert.equal(s.wealthGuide.stage,'daily');
 const pace=savingsPace(s.wealthGuide);assert.equal(pace.start,'2026-11-03');assert.equal(pace.days,167);assert.equal(pace.recommended,30000);assert.deepEqual(pace.values,[30000,15000]);assert.deepEqual(pace.estimate(30000),{days:30,finish:"2026-12-02",reviewCap:900000});assert.deepEqual(pace.estimate(5400),{days:167,finish:'2027-04-18',reviewCap:162000});
 assert.match(explanation(s),/30 天攒齐/);assert.match(dialogue(s).reply,/比原计划提前 137 天/);assert.doesNotMatch(dialogue(s).reply,/12月2日/);pick(s,5400);assert.equal(s.wealthGuide.stage,'saving_confirm');
 for(const text of ['12,000','3,000','9,000','1,620','42,013.90','2027-04-18','首期仅授权30天'])assert.ok(explanation(s).includes(text),text);
 assert.equal(s.balance,50000);assert.equal(s.wealthSubscriptions,undefined);
});

test('corrected progress and a changed goal never borrow stale target facts',()=>{
 const s=setup();pick(s,'save');pick(s,'edit-progress');pick(s,0);assert.equal(intentTargetOptions(s.wealthGuide)[0].value,1200000);
 pick(s,1200000);pick(s,savingsPace(s.wealthGuide).recommended);assert.match(explanation(s),/本次核对已攒 ¥0.00/);
 pick(s,'edit-target');pick(s,'edit-progress');pick(s,350000);assert.equal(intentTargetOptions(s.wealthGuide)[0].value,850000);
 pick(s,'edit-progress');pick(s,1200000);assert.match(explanation(s),/目标已经达到/);assert.match(html(s),/custom-target/);
 pick(s,'change-goal');pick(s,'学习提升');pick(s,200000);assert.equal(s.wealthGuide.stage,'saving_horizon');assert.equal(intentFacts(s.wealthGuide).previousTarget,null);assert.equal(intentFacts(s.wealthGuide).dueDate,null);
});

test('explicit no deadline overrides the old date; 09:00 boundary matches scheduler',()=>{
 const s=setup();pick(s,'save');pick(s,900000);pick(s,'edit-horizon');pick(s,'不设期限');
 assert.equal(intentFacts(s.wealthGuide).dueDate,null);assert.equal(savingsPace(s.wealthGuide).period,90);assert.doesNotMatch(dialogue(s).reply,/提前/);
 for(const [time,start] of [['2026-11-02T00:59:59Z','2026-11-02'],['2026-11-02T01:00:00Z','2026-11-03']]){
  const now=Date.parse(time),n=setup('travel',now);pick(n,'save',now);pick(n,900000,now);assert.equal(intentFacts(n.wealthGuide,{now}).start,start);
 }
 s.wealthGuide.fields.goal_date='2027-99-99';s.wealthGuide.fields.no_deadline=false;s.wealthGuide.memoryRecall.profile.dueDate='2027-99-99';assert.doesNotThrow(()=>html(s));assert.equal(intentFacts(s.wealthGuide).dueDate,null);
});

test('reserve goal uses current necessary spending and only asks the missing deadline',()=>{
 const s=setup('reserve');pick(s,'save');assert.equal(s.wealthGuide.stage,'goal_amount');
 const target=intentTargetOptions(s.wealthGuide)[0].value;assert.equal(target,552093);assert.match(explanation(s),/再攒一个月/);
 pick(s,target);assert.equal(s.wealthGuide.stage,'saving_horizon');pick(s,'半年');assert.equal(savingsPace(s.wealthGuide).recommended,3100);assert.equal(savingsPace(s.wealthGuide).days,180);
});

test('new financial facts preserve chosen goal but invalidate the old confirmation',()=>{
 const s=plan(),oldRevision=s.wealthGuide.revision;s.savingsEditor={fields:{target_minor:900000,daily_minor:5400}};
 const latest=recallMemory(freshMemory(),buildFinancialContext(allocation(s,{now:NOW}),{extraBill:true}));
 assert.equal(refreshWealthGuide(s,{now:NOW,recall:latest}),true);assert.equal(s.wealthGuide.stage,'context_review');assert.equal(s.wealthGuide.fields.goal,'旅行');assert.equal(s.wealthGuide.fields.target_minor,900000);assert.equal(s.wealthGuide.fields.daily_minor,undefined);assert.equal(s.savingsEditor,null);
 assert.throws(()=>wealthChoice(s,'back',{now:NOW,expectedRevision:oldRevision}),/更新/);assert.throws(()=>pick(s,'back'),/补齐近期预留/);
 refreshWealthGuide(s,{now:NOW,recall:recallMemory(freshMemory(),buildFinancialContext(allocation(s,{now:NOW})))});pick(s,'back');assert.equal(s.wealthGuide.stage,'daily');assert.match(explanation(s),/9,000/);
});

test('investment uses goal reserve, confirmed horizon, formal risk and current available funds',()=>{
 const s=setup();pick(s,'earn');pick(s,'remembered-extra');assert.equal(investable(s.wealthGuide),3463390);
 assert.match(explanation(s),/剩余闲钱的取用时间还需要你补充/);assert.doesNotMatch(html(s),/沿用「随时」/);
 pick(s,'随时');assert.equal(s.wealthGuide.stage,'experience');assert.equal(s.wealthRiskProfile,undefined);
 for(const answer of ['了解基金或理财','可接受小幅亏损','收入稳定但有压力'])pick(s,answer);
 assert.match(explanation(s),/风险级别 R2/);assert.throws(()=>pick(s,'demo-bond'),/不匹配/);pick(s,'demo-flex');assert.match(html(s),/¥3,400（推荐）/);
 pick(s,340000);assert.match(explanation(s),/9,000.00/);assert.match(explanation(s),/31,233.90/);assert.equal(wealthOperation(s,{now:NOW}).amountMinor,340000);
 s.ledger.push({id:'unexpected-payable',date:'2026-11-02',title:'已付账单',category:'学费',amountMinor:4000000,direction:'expense',movement:'cashflow'});
 assert.throws(()=>wealthOperation(s,{now:NOW}),/变化/);assert.equal(s.wealthGuide.stage,'context_review');assert.equal(s.wealthGuide.fields.extra_minor,900000);assert.equal(s.wealthGuide.fields.amount_minor,undefined);
});

test('steady and reserve profiles recommend relevant extra reserves without inventing answers',()=>{
 const steady=setup('steady');pick(steady,'earn');assert.doesNotMatch(html(steady),/另行核对旅行/);pick(steady,'暂无');assert.match(html(steady),/一年（推荐）/);pick(steady,'一年');assert.equal(steady.wealthGuide.stage,'experience');
 const reserve=setup('reserve');pick(reserve,'earn');assert.match(html(reserve),/没有，继续看收益（推荐）/);assert.match(explanation(reserve),/5,520.93/);pick(reserve,'reserve-extra');assert.equal(investable(reserve.wealthGuide),3811297);
});

test('strict amount input and custom goal escaping protect every continuation',()=>{
 for(const bad of ['',null,'1e3','0x10','1.001','NaN','-1'])assert.throws(()=>parseWealthAmount(bad),/有效金额/);
 assert.equal(parseWealthAmount('54.01'),'5401');assert.equal(parseWealthAmount('0'),'0');
 const s=setup();pick(s,'save');for(const bad of ['', '1e3','0x10','-10'])assert.throws(()=>pick(s,bad),/有效金额/);
 pick(s,'change-goal');pick(s,'<img onerror=alert(1)>');assert.doesNotMatch(html(s),/<img onerror/);assert.match(explanation(s),/&lt;img/);assert.doesNotMatch(renderIntentEvidence(dialogue(s).evidence),/<img onerror/);
});

test('v1 migration enriches only unchanged source goals; replacement clears goal-specific preferences',()=>{
 const old=freshMemory();old.version=1;old.profiles.travel.facts=old.profiles.travel.facts.filter(f=>!['target_minor','goal_date'].includes(f.key));
 const migrated=decodeMemory(JSON.stringify(old));assert.equal(migrated.version,2);assert.equal(recallMemory(migrated).profile.targetMinor,1200000);
 forgetMemory(old,'goal');assert.equal(recallMemory(decodeMemory(JSON.stringify(old))).profile.targetMinor,null);
 const changed=freshMemory();stageMemory(changed,MEMORY_UPDATE);confirmMemory(changed);const r=recallMemory(changed);assert.equal(r.goalLabel,'应急备用');assert.equal(r.profile.targetMinor,null);assert.equal(r.profile.liquidity,null);
});

function harness(){
 let s=fresh(),scenario={},c;const memory=freshMemory(),errors=[];
 const recall=()=>recallMemory(memory,buildFinancialContext(allocation(s,{now:Date.parse(c?.clock.now()||'2026-11-02T01:00:00Z')}),{...scenario,...activeSavingsCommitments(s,NOW)}));
 c=createCompanionController({getState:()=>s,commit:n=>{s=structuredClone(n);},esc:memoryEscape,repaint(){},readWealthRecall:recall,disableSpeech:true,onError:e=>errors.push(e)});
 const start=()=>{c.applyModelResult(offlineResult({text:OFFLINE_PROMPTS.savings}).result);s.wealthGuide.memoryRecall=recall();};
 const action=(action,value)=>c.handleAction(action,{dataset:{value:String(value),revision:String(s.wealthGuide.revision)},textContent:String(value)},{});
 return {c,recall,start,errors,action,get s(){return s;},setScenario:value=>{scenario=value;}};
}
test('controller confirms only the new 9000 target, reserves its cap, and reuses the existing plan next time',async()=>{
 const h=harness();try{
  h.start();for(const v of ['save',900000,5400])await h.action('wealth-choice',v);
  assert.equal(h.s.savingsEditor.fields.target_minor,900000);const cash=h.s.balance,ledgerCount=h.s.ledger.length;
  await h.action('wealth-save');assert.equal(h.s.wealthGuide.stage,'done');const jar=Object.values(h.s.savingsJars)[0];
  assert.equal(jar.name,'旅行补充储蓄罐');assert.equal(jar.saved_minor,0);assert.equal(jar.target_minor,900000);assert.equal(jar.total_cap_minor,162000);assert.equal(jar.intent_goal,'旅行');assert.equal(h.s.balance,cash);assert.equal(h.s.ledger.length,ledgerCount);
  assert.equal(h.recall().context.availableMinor,4201390);assert.equal(h.recall().context.committedMinor,162000);
  h.start();await h.action('wealth-choice','save');assert.equal(h.s.wealthGuide.stage,'existing_goal');assert.match(h.s.messages.at(-1).text,/实际已存 ¥0.00/);
  await h.action('wealth-keep-plan');assert.equal(Object.values(h.s.savingsJars).length,1);assert.equal(h.s.balance,cash);assert.deepEqual(h.errors,[]);
 }finally{h.c.dispose();}
});
test('controller final click rechecks latest bill and cannot execute a previously valid plan',async()=>{
 const h=harness();try{
  h.start();for(const v of ['save',900000,5400])await h.action('wealth-choice',v);const cash=h.s.balance;
  h.setScenario({extraBill:true});await h.action('wealth-save');assert.equal(h.s.wealthGuide.stage,'context_review');assert.equal(Object.keys(h.s.savingsJars||{}).length,0);assert.equal(h.s.balance,cash);
  h.setScenario({});await h.action('wealth-choice','back');assert.equal(h.s.wealthGuide.stage,'context_review');await h.action('wealth-choice','back');assert.equal(h.s.wealthGuide.stage,'daily');await h.action('wealth-choice',5400);await h.action('wealth-save');assert.equal(h.s.wealthGuide.stage,'done');
 }finally{h.c.dispose();}
});
test('committed cash counts each jar once and excludes paused, expired or already deposited amounts',()=>{
 const jar={id:'j',status:'active',review_until:'2026-12-02',target_minor:900000,saved_minor:5400,total_cap_minor:162000,cycle_deposited_minor:5400};
 const state={savingsJars:{j:jar},savingsJar:jar};assert.equal(activeSavingsCommitments(state,NOW).committedMinor,156600);
 jar.status='paused';assert.equal(activeSavingsCommitments(state,NOW).committedMinor,0);jar.status='active';jar.review_until='2026-11-01';assert.equal(activeSavingsCommitments(state,NOW).committedMinor,0);
});

test('every contextual question has at most three choices including secondary actions',()=>{
 const check=s=>{const main=html(s);assert.ok((main.match(/<button\b/g)||[]).length<=3,s.wealthGuide.stage);assert.doesNotMatch(main,/<p>|<details>|plan-row/);};
 for(const persona of ['travel','reserve','steady']){
  const s=setup(persona);check(s);pick(s,'save');check(s);if(s.wealthGuide.stage==='goal'){pick(s,'学习提升');check(s);}pick(s,intentTargetOptions(s.wealthGuide)[0].value);check(s);if(s.wealthGuide.stage==='saving_horizon'){pick(s,'半年');check(s);}pick(s,savingsPace(s.wealthGuide).recommended);check(s);
  const n=setup(persona);pick(n,'earn');check(n);pick(n,persona==='travel'?'remembered-extra':persona==='reserve'?'reserve-extra':'暂无');check(n);pick(n,'一年');check(n);for(const v of ['了解基金或理财','可接受小幅亏损','收入稳定但有压力']){pick(n,v);check(n);}pick(n,'demo-flex');check(n);
 }
});
test('crossing the execution start time invalidates confirmation, and invalid amounts do not mutate choices',()=>{
 const before=Date.parse('2026-11-02T00:50:00Z'),s=setup('travel',before);for(const v of ['save',900000,5400])pick(s,v,before);
 assert.equal(s.wealthGuide.fields.confirmation_start,'2026-11-02');assert.equal(refreshWealthGuide(s,{now:NOW}),true);assert.equal(s.wealthGuide.stage,'context_review');assert.match(s.wealthGuide.contextNotice,/开始日/);pick(s,'back');assert.equal(s.wealthGuide.stage,'daily');assert.equal(savingsPace(s.wealthGuide).estimate(5400).finish,'2027-04-18');
 const fields=structuredClone(s.wealthGuide.fields),revision=s.wealthGuide.revision;assert.throws(()=>pick(s,200001),/2,000/);assert.deepEqual(s.wealthGuide.fields,fields);assert.equal(s.wealthGuide.revision,revision);
});
test('duplicate memory extraction preserves a different unconfirmed candidate',()=>{
 const memory=freshMemory();stageMemory(memory,MEMORY_UPDATE,'2026-11-02');const pending=structuredClone(memory.profiles.travel.pending),revision=memory.revision;
 assert.equal(stageMemory(memory,'我现在更在意随时能取。','2026-11-02'),false);assert.deepEqual(memory.profiles.travel.pending,pending);assert.equal(memory.revision,revision);
 const fact=memory.profiles.travel.facts.find(f=>f.key==='target_minor');fact.value='1000000';assert.match(recallMemory(memory).personalReply,/10,000/);assert.doesNotMatch(recallMemory(memory).personalReply,/12,000/);
});

test('explicit demo replay removes this run and temporary memory, then restarts from the same fixtures',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const memory=createMemoryStore(storage);memory.change(s=>{stageMemory(s,MEMORY_UPDATE,'2026-11-02');confirmMemory(s);});
 const finances=createFinancialContextController(storage);finances.change('bill');finances.change('stale');
 values.set(appStateKey('replay'),JSON.stringify({messages:['old answer'],savingsJars:{old:{intent_goal:'旅行'}}}));
 values.set(appStateKey('other'),'other-demo');values.set('unrelated-settings','untouched');
 const keys=intentReplayResetKeys([...values.keys()],'replay');assert.ok(keys.includes(MEMORY_KEY));assert.ok(keys.includes(FINANCIAL_CONTEXT_KEY));
 keys.forEach(k=>storage.removeItem(k));
 assert.equal(storage.getItem(appStateKey('replay')),null);assert.equal(storage.getItem(appStateKey('other')),'other-demo');assert.equal(storage.getItem('unrelated-settings'),'untouched');
 const restored=createMemoryStore(storage);assert.equal(restored.recall().goalLabel,'旅行');assert.equal(restored.recall().profile.targetMinor,1200000);assert.equal(restored.recall().profile.progressMinor,300000);
 const context=createFinancialContextController(storage).snapshot();assert.equal(context.availableMinor,4363390);assert.equal(context.billMinor,0);assert.equal(context.fresh,true);assert.deepEqual(context.goalPlans,[]);
 assert.deepEqual(intentReplayResetKeys([...values.keys()],'replay'),[]);
});

test('each button turn records one answer and a frozen expandable evidence snapshot',async()=>{
 const h=harness();try{
  h.start();const initial=recordWealthReply(h.s,{now:NOW});assert.match(initial.text,/记得你在为旅行攒钱/);
  const snapshot=JSON.stringify(initial);
  for(const v of ['save',450000,2700]){
   const before=h.s.messages.length;await h.action('wealth-choice',v);
   assert.equal(h.s.messages.length,before+2);assert.equal(h.s.messages.at(-2).role,'user');
   const last=h.s.messages.at(-1);assert.equal(last.role,'assistant');assert.ok(last.text.length>20);
   assert.match(renderIntentEvidence(last.intentEvidence),/<details[^>]*><summary>推荐依据/);
   assert.ok(last.intentEvidence.items.some(x=>x.label==='长期记忆'));assert.ok(last.intentEvidence.items.some(x=>x.label==='当前财务'));
   assert.equal(recordWealthReply(h.s,{now:NOW}),null);h.c.render();assert.equal(h.s.messages.length,before+2);
  }
  h.setScenario({extraBill:true});await h.action('wealth-save');
  assert.match(h.s.messages.at(-1).text,/1,366.10/);assert.equal(JSON.stringify(h.s.messages.find(m=>m.id===initial.id)),snapshot);
  assert.equal(h.s.wealthGuide.stage,'context_review');assert.equal(Object.keys(h.s.savingsJars||{}).length,0);
 }finally{h.c.dispose();}
});

test('other amounts, corrected progress and adjustable pace remain separate short questions',()=>{
 const s=setup();const check=()=>{assert.ok((html(s).match(/<button\b/g)||[]).length<=3,s.wealthGuide.stage);assert.doesNotMatch(html(s),/<p>|<details>|plan-row/);assert.ok(dialogue(s).reply);};
 for(const v of ['save','custom-target','goal-details','edit-progress',350000,'custom-target',700000,'adjust-pace','custom-daily',3000,'adjust-saving','edit-horizon','半年',3900]){pick(s,v);check();}
 assert.equal(s.wealthGuide.stage,'saving_confirm');assert.equal(s.wealthGuide.fields.target_minor,700000);assert.equal(s.wealthGuide.fields.progress_minor,350000);
 assert.equal(s.wealthGuide.fields.goal_date,'2027-05-01');assert.match(explanation(s),/10,500|7,000/);
 pick(s,'adjust-saving');pick(s,'edit-target');pick(s,'custom-target');pick(s,'back-step');assert.equal(s.wealthGuide.stage,'goal_amount');
});

test('custom amount submit appends a user answer followed by the next grounded assistant turn',async()=>{
 const h=harness(),original=globalThis.FormData;globalThis.FormData=class{constructor(f){this.fields=f.fields;}get(k){return this.fields[k];}};
 try{
  h.start();await h.action('wealth-choice','save');await h.action('wealth-choice','custom-target');
  const before=h.s.messages.length;
  await h.c.handleSubmit({target:{id:'wealth-amount-form',dataset:{revision:String(h.s.wealthGuide.revision)},fields:{amount:'10500'}},preventDefault(){}});
  assert.equal(h.s.messages.length,before+2);assert.match(h.s.messages.at(-2).text,/10,500/);assert.match(h.s.messages.at(-1).text,/每天存 ¥350/);
  assert.equal(h.s.wealthGuide.fields.target_minor,1050000);assert.ok(h.s.messages.at(-1).intentEvidence);
  assert.equal(h.s.balance,50000);
 }finally{globalThis.FormData=original;h.c.dispose();}
});

test('changed plans and all three goal choices calculate their own dates and amounts',()=>{
 for(const goal of ['旅行','应急备用','学习提升']){
  const s=setup();pick(s,'unsure');assert.equal(s.wealthGuide.stage,'goal');pick(s,goal);
  const target=intentTargetOptions(s.wealthGuide)[0].value;pick(s,target);
  if(goal==='旅行')assert.equal(s.wealthGuide.stage,'daily');
  else{assert.equal(intentFacts(s.wealthGuide).previousTarget,null);assert.equal(s.wealthGuide.stage,'saving_horizon');pick(s,'不设期限');}
  pick(s,savingsPace(s.wealthGuide).values.at(-1));assert.equal(s.wealthGuide.stage,'saving_confirm');assert.ok(dialogue(s).evidence.items.some(x=>x.text.includes(goal)));
 }
});

test('extra demand alternatives and custom purchase amount continue to a current confirmation',()=>{
 for(const demand of ['旅行','学费','其他']){
  const s=setup();for(const v of ['earn','adjust-extra',demand,'custom-extra',800000,'不确定','了解基金或理财','可接受小幅亏损','收入稳定但有压力','demo-flex','custom-investment',150000])pick(s,v);
  assert.equal(s.wealthGuide.stage,'confirm');assert.equal(s.wealthGuide.fields.extra,demand);assert.equal(s.wealthGuide.fields.extra_minor,800000);
  assert.equal(wealthOperation(s,{now:NOW}).amountMinor,150000);assert.match(explanation(s),/27,?133.90|34,133.90/);
  pick(s,'edit-investment-amount');assert.equal(s.wealthGuide.stage,'amount');
 }
});

test('all formal risk answers and liquidity alternatives produce appropriate product choices',()=>{
 for(const horizon of ['随时','一年','不确定'])for(const experience of ['没有经验','了解基金或理财','有多年投资经验'])for(const loss of ['不能接受本金损失','可接受小幅亏损','能承受明显波动'])for(const stability of ['收入不稳定','收入稳定但有压力','收入稳定且有充足备用金']){
  const s=setup();for(const v of ['earn','暂无',horizon,experience,loss,stability])pick(s,v);
  assert.equal(s.wealthGuide.stage,'products');const turn=dialogue(s);assert.ok(turn.options.length<=3);
  const shown=turn.options.filter(x=>x.value.startsWith('demo-')).map(x=>x.value);
  if(loss==='不能接受本金损失'){assert.deepEqual(shown,[]);assert.throws(()=>pick(s,'demo-flex'),/不匹配/);}
  else{assert.ok(shown.includes('demo-flex'));assert.equal(shown.includes('demo-bond'),horizon==='一年'&&s.wealthRiskProfile.level>=2);}
  if(horizon==='随时'||horizon==='不确定')assert.ok(!shown.includes('demo-bond'));
 }
});

test('bill review and deferral explain the gap without executing or erasing the long term goal',()=>{
 const s=plan();refreshWealthGuide(s,{now:NOW,recall:recallMemory(freshMemory(),buildFinancialContext(allocation(s,{now:NOW}),{extraBill:true}))});
 for(const v of ['review-bill','defer-goal','review-bill']){pick(s,v);assert.match(explanation(s),/1,366.10/);assert.ok(dialogue(s).options.length<=3);}
 assert.equal(dialogue(s).options[0].action,'intent-finance-overview');assert.equal(s.balance,50000);
 pick(s,'defer-goal');pick(s,'pause-draft');assert.equal(s.wealthGuide.stage,'cancelled');assert.equal(s.wealthGuide.memoryRecall.goalLabel,'旅行');assert.match(dialogue(s).reply,/长期目标仍保留/);
});

test('extreme custom pace shows a recoverable error instead of crashing date rendering',()=>{
 const s=setup();for(const v of ['save','custom-target',200000000,'adjust-pace','custom-daily'])pick(s,v);
 const previous=structuredClone(s.wealthGuide.fields);
 assert.throws(()=>pick(s,1),/完成时间太远/);assert.equal(s.wealthGuide.stage,'daily_custom');assert.deepEqual(s.wealthGuide.fields,previous);
 assert.doesNotThrow(()=>dialogue(s));pick(s,100000);assert.equal(s.wealthGuide.stage,'saving_confirm');assert.ok(dialogue(s).reply);
});

test('spare cash accelerates the goal and offers a larger target without changing the historical budget',()=>{
 const s=setup();assert.equal(dialogue(s).options[1].label,'拿闲钱赚点收益');pick(s,'save');
 assert.deepEqual(intentTargetOptions(s.wealthGuide).map(o=>o.value),[900000,1200000]);assert.doesNotMatch(dialogue(s).reply,/完成一半/);
 pick(s,1200000);assert.equal(savingsPace(s.wealthGuide).recommended,40000);assert.match(explanation(s),/15,000/);
 pick(s,40000);assert.match(dialogue(s).reply,/31,633.90/);assert.equal(s.wealthGuide.memoryRecall.profile.targetMinor,1200000);
});

test('acceleration follows real available cash and respects an explicit schedule choice',()=>{
 const latest=setup('travel',Date.parse(DEMO_START_AT));pick(latest,'save',Date.parse(DEMO_START_AT));pick(latest,900000,Date.parse(DEMO_START_AT));assert.match(wealthDialogue(latest,{now:Date.parse(DEMO_START_AT)}).reply,/比原计划提前 124 天/);
 const s=setup();pick(s,'save');pick(s,900000);assert.equal(savingsPace(s.wealthGuide).accelerated,true);
 s.wealthGuide.memoryRecall.context.availableMinor=100000;
 const pace=savingsPace(s.wealthGuide);assert.equal(pace.accelerated,false);assert.ok(pace.estimate(pace.recommended).reviewCap<=100000);
 const n=setup();pick(n,'save');pick(n,900000);pick(n,'edit-horizon');pick(n,'remembered-date');
 assert.equal(savingsPace(n.wealthGuide).accelerated,false);assert.equal(savingsPace(n.wealthGuide).recommended,5400);
});

test('yield route uses confirmed needs and liquidity without imposing travel on later rounds',()=>{
 for(const horizon of ['随时','半年','一年']){
  const s=setup();pick(s,'earn');
  assert.deepEqual(dialogue(s).options.map(x=>x.value),['暂无','adjust-extra','chart']);assert.doesNotMatch(explanation(s),/旅行/);
  for(const v of ['暂无',horizon,'了解基金或理财','可接受小幅亏损','收入稳定但有压力']){pick(s,v);assert.doesNotMatch(explanation(s),/旅行/);}
  assert.equal(investable(s.wealthGuide),4363390);assert.equal(dialogue(s).options.some(o=>o.value==='demo-bond'),horizon!=='随时');
  pick(s,horizon==='随时'?'demo-flex':'demo-bond');const value=Number(dialogue(s).options[0].value);pick(s,value);
  assert.equal(wealthOperation(s,{now:NOW}).amountMinor,value);assert.doesNotMatch(explanation(s),/旅行/);
 }
});

test('accelerated plan reserves the full remaining goal once and leaves the rest available',async()=>{
 const h=harness();try{
  h.start();for(const v of ['save',900000,30000])await h.action('wealth-choice',v);await h.action('wealth-save');
  const jar=Object.values(h.s.savingsJars)[0];assert.equal(jar.total_cap_minor,900000);assert.equal(jar.saved_minor,0);
  assert.equal(h.recall().context.availableMinor,3463390);assert.equal(h.s.balance,50000);
 }finally{h.c.dispose();}
});


test('confirmation snapshots historical progress without booking it as new savings',async()=>{
 for(const [target,progress,goal] of [[900000,300000,'旅行'],[1200000,300000,'旅行'],[850000,350000,'旅行'],[200000,0,'学习提升']]){
  const h=harness();try{
   h.start();await h.action('wealth-choice','save');
   if(progress===350000){await h.action('wealth-choice','edit-progress');await h.action('wealth-choice',progress);}
   if(goal!=='旅行'){await h.action('wealth-choice','change-goal');await h.action('wealth-choice',goal);}
   await h.action('wealth-choice',target);
   if(h.s.wealthGuide.stage==='saving_horizon')await h.action('wealth-choice','不设期限');
   await h.action('wealth-choice',savingsPace(h.s.wealthGuide).recommended);await h.action('wealth-save');
   const jar=Object.values(h.s.savingsJars)[0],receipt=h.s.messages.findLast(m=>m.savingsSnapshot);
   assert.equal(jar.historical_saved_minor,progress);assert.equal(savingsTotal(h.s),0);
   assert.deepEqual(savingsGoalProgress(jar),{historical:progress,saved:progress,target:target+progress,remaining:target});
   assert.deepEqual(receipt.savingsSnapshot,jar);
   const card=renderSavingsJarSnapshot(receipt.savingsSnapshot);
   assert.ok(card.includes(`value="${progress}" max="${target+progress}"`));assert.doesNotMatch(card,/<button/);
   assert.ok(renderSavingsJar(h.s).includes(`value="${progress}" max="${target+progress}"`));
   jar.saved_minor+=30000;assert.equal(savingsTotal(h.s),30000);assert.equal(savingsGoalProgress(jar).saved,progress+30000);
   assert.equal(receipt.savingsSnapshot.saved_minor,0);
  }finally{h.c.dispose();}
 }
});

test('canceling a funded goal retains deposits in subsequent recommendations without duplicate booking',async()=>{
 const {tickSavingsPlan,cancelJarPlan}=await import('../web/savings-coach.mjs');
 const h=harness();try{
  h.start();for(const v of ['save',900000,30000])await h.action('wealth-choice',v);
  await h.action('wealth-save');const jar=Object.values(h.s.savingsJars)[0];
  tickSavingsPlan(h.s,{now:Date.parse(jar.start_date+'T09:00:00+08:00')});
  assert.equal(h.s.savingsJars[jar.id].saved_minor,30000);
  cancelJarPlan(h.s,jar.id,{source:{kind:'user',method:'click'}});
  const cash=h.s.balance,ledgerCount=h.s.ledger.length;
  h.start();await h.action('wealth-choice','save');
  assert.equal(h.s.wealthGuide.stage,'goal_amount');
  assert.equal(intentFacts(h.s.wealthGuide).progress,330000);
  assert.equal(intentTargetOptions(h.s.wealthGuide)[0].value,870000);
  await h.action('wealth-choice',870000);await h.action('wealth-choice',30000);await h.action('wealth-save');
  assert.equal(h.s.balance,cash);assert.equal(h.s.ledger.length,ledgerCount);
  const next=Object.values(h.s.savingsJars).find(j=>j.id!==jar.id);
  assert.equal(next.historical_saved_minor,330000);assert.equal(next.target_minor,870000);
  assert.equal(savingsGoalProgress(next).remaining,870000);
  assert.deepEqual(h.errors,[]);
 }finally{h.c.dispose();}
});
test('tiny balances and impossible finish dates offer adjustments without crashing',()=>{
 for(const [available,target] of [[1,900000],[29,900000],[30,200000000]]){
  const s=setup();s.ledger.push({id:'tiny-cash',date:'2026-11-02',amountMinor:s.wealthGuide.allocation.available-available,direction:'expense',movement:'principal',category:'investments'});
  refreshWealthGuide(s,{now:NOW});
  pick(s,'save');pick(s,target);
  assert.equal(s.wealthGuide.stage,'daily');
  assert.doesNotThrow(()=>recordWealthReply(s,{now:NOW}));
  assert.match(dialogue(s).reply,/降低目标/);assert.doesNotMatch(html(s),/data-action="wealth-save"/);
  pick(s,'edit-target');assert.equal(s.wealthGuide.stage,'goal_amount');
 }
});
