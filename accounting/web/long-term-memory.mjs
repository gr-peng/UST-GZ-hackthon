import {withFinancialContext} from './financial-context.mjs';
// Browser-local, synthetic demonstration. No model, bank access or transaction authority.
export const MEMORY_KEY = 'finpilot-demo-long-term-memory-v1';
export const MEMORY_MODES = Object.freeze({answer:'回答中体现', evidence:'推荐依据中体现', both:'回答 + 推荐依据'});
export const MEMORY_PROMPT = '手里有点钱，想理一理。';
export const MEMORY_UPDATE = '旅行先不去了，我现在想先攒应急备用金。';
const copy = value => structuredClone(value);
const fact = (key,value,label) => ({key,value,label});
export const MEMORY_PERSONAS = Object.freeze({
 travel: {name:'小林', title:'有目标，慢慢攒', subtitle:'旅行计划 · 灵活用钱', sources:[
  {id:'travel-chat',kind:'conversation',label:'历史对话 · 10月18日',date:'2026-10-18',text:'我想半年后去旅行，目标是一万二，已经攒了三千。',facts:[fact('goal','travel','半年后旅行 · 目标 ¥12,000'),fact('progress','3000','旅行已攒 ¥3,000'),fact('target_minor','1200000','旅行总目标 ¥12,000'),fact('goal_date','2027-04-18','按10月18日的半年后估算：2027-04-18')]},
  {id:'travel-preference',kind:'conversation',label:'历史对话 · 10月25日',date:'2026-10-25',text:'这笔钱半年内可能要用，我更在意随时能取。',facts:[fact('liquidity','flexible','偏好灵活取用')]},
  {id:'travel-account',kind:'account',label:'合成账户摘要 · 11月2日',date:'2026-11-02',text:'每月固定房租 ¥3,500；旅行目标尚差 ¥9,000。',facts:[fact('obligation','rent','每月房租 ¥3,500')]}
 ]},
 reserve: {name:'小林',title:'先留一份安心',subtitle:'应急备用 · 收入波动',sources:[
  {id:'reserve-chat',kind:'conversation',label:'历史对话 · 10月20日',date:'2026-10-20',text:'我的收入不太稳定，想先攒一笔应急备用金。',facts:[fact('goal','reserve','优先建立应急备用金')]},
  {id:'reserve-preference',kind:'conversation',label:'历史对话 · 10月28日',date:'2026-10-28',text:'临时要用钱时，希望随时可以拿出来。',facts:[fact('liquidity','flexible','偏好灵活取用')]},
  {id:'reserve-account',kind:'account',label:'合成账户摘要 · 11月2日',date:'2026-11-02',text:'近三月月收入波动；现有备用金约覆盖一个月必要支出。',facts:[fact('cashflow','variable','收入波动 · 备用金约1个月')]}
 ]},
 steady: {name:'小林',title:'给闲钱一些时间',subtitle:'长期安排 · 先看风险',sources:[
  {id:'steady-chat',kind:'conversation',label:'历史对话 · 10月16日',date:'2026-10-16',text:'备用金留好了，剩下的闲钱一年内用不到，想先了解怎么安排。',facts:[fact('goal','earn','了解长期闲钱安排'),fact('horizon','一年','这笔闲钱一年内用不到')]},
  {id:'steady-preference',kind:'conversation',label:'历史对话 · 10月27日',date:'2026-10-27',text:'先把费用和风险说清楚，我再决定。',facts:[fact('preference','explain','偏好先了解风险与费用')]},
  {id:'steady-account',kind:'account',label:'过往账户分析 · 10月31日',date:'2026-10-31',text:'过去三个月有规律的固定收入；本次余额与预留仍需重新核对。',facts:[fact('cashflow','buffered','过去三个月收入规律')]}
 ]}
});

export function extractMemory(sources) {
 const latest = new Map();
 for (const source of [...sources].sort((a,b)=>a.date.localeCompare(b.date))) {
  if (!['conversation','account'].includes(source.kind)) continue;
  for (const item of source.facts || []) latest.set(item.key, {...copy(item),sourceId:source.id,sourceLabel:source.label,quote:source.text,asOf:source.date});
 }
 return [...latest.values()];
}
export function freshMemory() {
 return {version:2,persona:'travel',mode:'both',enabled:true,revision:1,profiles:Object.fromEntries(Object.entries(MEMORY_PERSONAS).map(([id,p])=>[id,{facts:extractMemory(p.sources),pending:[],updatedAt:'2026-11-02'}]))};
}
export function decodeMemory(raw) {
 try {
  const s=JSON.parse(raw);
  if (![1,2].includes(s?.version) || !Object.hasOwn(MEMORY_PERSONAS,s.persona) || !Object.hasOwn(MEMORY_MODES,s.mode) || typeof s.enabled!=='boolean' || !Number.isSafeInteger(s.revision)) return freshMemory();
  for (const id of Object.keys(MEMORY_PERSONAS)) {
   const p=s.profiles?.[id];
   if (!p || !Array.isArray(p.facts) || !Array.isArray(p.pending) || p.facts.length>12 || p.pending.length>12 || typeof p.updatedAt!=='string') return freshMemory();
   if ([...p.facts,...p.pending].some(f=>!['key','value','label','sourceId','sourceLabel','quote','asOf'].every(k=>typeof f[k]==='string'&&f[k].length<=600))) return freshMemory();
  }
  if(s.version===1){
   // Enrich only unchanged, known synthetic source records. Never restore a forgotten goal.
   for(const [id,p] of Object.entries(s.profiles)){
    const goal=p.facts.find(f=>f.key==='goal'),fixture=MEMORY_PERSONAS[id].sources[0];
    if(goal?.sourceId===fixture.id&&goal.value===fixture.facts[0].value&&goal.quote===fixture.text){
     for(const f of extractMemory([fixture]).filter(f=>['target_minor','goal_date','horizon'].includes(f.key)))if(!p.facts.some(old=>old.key===f.key))p.facts.push(f);
    }
   }
   s.version=2;
  }
  return s;
 } catch { return freshMemory(); }
}
// A finite phrase extractor for this offline demo; arbitrary conversation is not an LLM fallback.
export function extractUserMemory(text, date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())) {
 const value=String(text).trim().slice(0,500),facts=[];
 if (/^(旅行先不去了[，,]?)?我(现在)?想先攒(一笔)?应急备用金[。！!]?$/.test(value)) facts.push(fact('goal','reserve','优先建立应急备用金'));
 else if (/^我想(半年后)?去旅行[。！!]?$/.test(value)) facts.push(fact('goal','travel','为旅行目标攒钱'));
 else if (/^我想(先)?了解长期闲钱(怎么)?安排[。！!]?$/.test(value)) facts.push(fact('goal','earn','了解长期闲钱安排'));
 else if (/^我(现在)?更在意随时能取[。！!]?$/.test(value)) facts.push(fact('liquidity','flexible','偏好灵活取用'));
 return extractMemory([{id:'user-'+date,kind:'conversation',label:'新对话 · '+date,date,text:value,facts}]);
}
export function stageMemory(state,text,date) {
 const facts=extractUserMemory(text,date),p=state.profiles[state.persona];
 if (!facts.length || !state.enabled) return false;
 const updates=facts.filter(f=>!p.facts.some(old=>old.key===f.key&&old.value===f.value)&&!p.pending.some(old=>old.key===f.key&&old.value===f.value));
 if(!updates.length)return false;
 p.pending=p.pending.filter(f=>!updates.some(next=>next.key===f.key)).concat(updates);
 state.revision++;return true;
}
export function confirmMemory(state) {
 const p=state.profiles[state.persona];
 if (!p.pending.length) return false;
 const updates=new Map(p.pending.map(f=>[f.key,f]));
 // Goal-specific progress must not leak into a replacement goal.
 p.facts=p.facts.filter(f=>!updates.has(f.key)&&!(updates.has('goal')&&(['progress','target_minor','goal_date','horizon'].includes(f.key)||f.sourceId==='travel-preference'))).concat(p.pending);
 p.updatedAt=p.pending.at(-1).asOf;p.pending=[];state.revision++;return true;
}
export function forgetMemory(state,key) {
 const p=state.profiles[state.persona];p.facts=p.facts.filter(f=>f.key!==key&&!(key==='goal'&&(['progress','target_minor','goal_date','horizon'].includes(f.key)||f.sourceId==='travel-preference')));p.pending=p.pending.filter(f=>f.key!==key);state.revision++;
}
export function clearMemory(state) { const p=state.profiles[state.persona];p.facts=[];p.pending=[];p.updatedAt='';state.revision++; }

const positiveMemoryAmount=value=>Number.isSafeInteger(Number(value))&&Number(value)>0&&Number(value)<=200000000?Number(value):null;
const genericOptions = () => [{value:'save',label:'为一个目标攒钱'},{value:'earn',label:'让闲钱赚点收益'},{value:'unsure',label:'还没想好'}];
export function recallMemory(state,context=null) {
 const profile=state.profiles[state.persona],facts=state.enabled?copy(profile.facts):[],get=key=>facts.find(f=>f.key===key)?.value;
 const goal=get('goal'),mode=state.mode;
 let reply='先选一个方向，我们一步一步来。',reason='',options=genericOptions(),goalLabel=null,used=[];
 if (goal==='reserve') {
  reply='记得你想先留一笔应急备用金。我们先看看要留多少，再考虑其他安排，好吗？';
  reason='先确认应急备用金目标，保留资金灵活性。';goalLabel='应急备用';used=['goal','cashflow','liquidity'];
  options=[{value:'save',label:'先攒应急备用金',detail:'先确定目标，再决定存入节奏',recommended:true},{value:'earn',label:'了解闲钱的灵活安排',detail:'先核对近期用钱需求'},{value:'unsure',label:'我想先聊聊'}];
 } else if (goal==='travel') {
  const target=positiveMemoryAmount(get('target_minor')),progress=positiveMemoryAmount(Number(get('progress'))*100);
  reply=target?`记得你的旅行总目标是 ¥${(target/100).toLocaleString('zh-CN')}，历史记录已攒 ¥${((progress||0)/100).toLocaleString('zh-CN')}${get('goal_date')?`，计划日期 ${get('goal_date')}`:''}。我们先继续这个目标，也把近期用钱留好。`:'记得你想为旅行攒钱。我们先确认这次的目标和用钱时间，再决定怎么安排。';
  reason='先延续已表达的旅行目标；安排前重新核对金额与期限。';goalLabel='旅行';used=['goal','progress','target_minor','goal_date','liquidity','obligation'];
  options=[{value:'save',label:'继续为旅行攒钱',detail:'确认目标与每天存入金额',recommended:true},{value:'earn',label:'看看剩余闲钱怎么安排',detail:'先留好近期生活费'},{value:'unsure',label:'我的计划有变化'}];
 } else if (goal==='earn') {
  reply='记得你想了解长期闲钱怎么安排，也希望先看清风险和费用。我们先核对用钱时间，再比较合适的方向。';
  reason='先了解闲钱安排；历史偏好不替代本次风险测评或操作确认。';used=['goal','horizon','preference','cashflow'];
  options=[{value:'earn',label:'先了解闲钱安排',detail:'核对期限，再看风险与费用',recommended:true},{value:'save',label:'为新目标单独攒钱',detail:'先明确目标和金额'},{value:'unsure',label:'先聊聊我的顾虑'}];
 }
 const evidence=facts.filter(f=>used.includes(f.key));
 return withFinancialContext({persona:state.persona,revision:state.revision,mode,used:!!evidence.length,reply:mode==='evidence'?'先选一个方向，我们一步一步来。':reply,personalReply:reply,evidence,reason,options,goalLabel,profile:{goal,targetMinor:positiveMemoryAmount(get('target_minor')),progressMinor:positiveMemoryAmount(Number(get('progress'))*100),dueDate:get('goal_date')||null,horizon:get('horizon')||null,liquidity:get('liquidity')||null,liquidityScope:facts.find(f=>f.key==='liquidity')?.sourceId==='travel-preference'?'goal':'general',cashflow:get('cashflow')||null,preference:get('preference')||null},updatedAt:profile.updatedAt},context);
}
export function setRecallMode(recall,mode) {
 return {...recall,mode,reply:mode==='evidence'?(recall.context&&!recall.context.fresh?'先更新财务信息，我们再决定下一步。':'先选一个方向，我们一步一步来。'):recall.personalReply};
}
export function createMemoryStore(storage,{onError=()=>{}}={}) {
 let current;
 try {current=decodeMemory(storage?.getItem(MEMORY_KEY));} catch {current=freshMemory();onError('浏览器存储不可用，记忆仅保留到本页关闭。');}
 const save=()=>{try {if(!storage)throw Error();storage.setItem(MEMORY_KEY,JSON.stringify(current));return true;}catch {onError('记忆未能保存到浏览器；新窗口可能无法读取。');return false;}};
 return {snapshot:()=>copy(current),recall:context=>recallMemory(current,context),change:fn=>{fn(current);save();return copy(current);},reload:()=>{try{if(storage)current=decodeMemory(storage.getItem(MEMORY_KEY));}catch{}return copy(current);}};
}
