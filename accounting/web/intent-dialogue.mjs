import {contextMoney as money} from './financial-context.mjs';
import {intentFacts,intentAvailable,intentTargetOptions,savingsPace,existingIntentPlan,goalGap,planningNow} from './intent-planning.mjs';

// Reviewed offline copy. These are source/rationale summaries, not model reasoning.
// Answers and evidence are captured on each turn; cards only render the next choice.
const dateLabel=date=>{const [,m,d]=date.split('-');return `${Number(m)}月${Number(d)}日`;};
const amount=n=>'¥'+(n/100).toLocaleString('zh-CN',{maximumFractionDigits:2});
const share=(n,r)=>Math.max(1,Math.min(n,Math.floor(n*r/10000)*10000||Math.floor(n*r)||1));
const choice=(value,label,recommended=false,action='wealth-choice')=>({value:String(value),label,recommended,action});
const cancel=()=>choice('cancel','暂不安排',false,'wealth-cancel');
const back=()=>choice('back-step','返回上一步');
export const intentInvestable=g=>Math.max(0,intentAvailable(g)-(g.fields.extra_minor||0));
export function extraAmountOptions(g){const available=intentAvailable(g),gap=g.fields.extra===g.memoryRecall.goalLabel?goalGap(g):0;return [...new Set(gap?[Math.min(gap,available),Math.min(Math.ceil(gap/2),available)]:[share(available,.1),share(available,.25)])].filter(n=>n>0);}
export function investmentAmountOptions(g){const max=intentInvestable(g),ratio=['随时','不确定'].includes(g.fields.horizon)?.1:.25;return [...new Set([share(max,ratio),share(max,ratio/2)])].filter(n=>n>0&&n<=max);}

export function intentDialogue(g,{now=planningNow(g),products=[],eligible=()=>false,riskLevel=null}={}){
 if(!g?.memoryRecall)return null;
 const r=g.memoryRecall,c=r.context,p=r.profile||{},f=intentFacts(g,{now}),pace=savingsPace(g,{now});
 const available=intentAvailable(g),investable=intentInvestable(g),gap=goalGap(g),stage=g.stage;
 const basis=[];
 const add=(label,text)=>basis.push({label,text});
 const relevantMemory=(r.evidence||[]).filter(x=>g.fields.direction!=='earn'||['cashflow','preference','obligation'].includes(x.key)||(x.key==='horizon'&&p.goal==='earn')||(x.key==='liquidity'&&p.liquidityScope!=='goal'));
 add('长期记忆',r.used?relevantMemory.map(x=>x.label).join('；')||'还没有适用于这笔闲钱的收益偏好，取用期限和风险承受力由你这次确认。':'没有可用的已确认画像，本轮先向你补充确认。');
 if(r.used&&relevantMemory.length)add('记忆来源',[...new Set(relevantMemory.map(x=>x.sourceLabel))].join('；'));
 add('当前财务',!c?.fresh?'财务资料待同步，旧金额不能用于新安排。':c.shortfallMinor?`生活预算、应急预留与待付事项合计超过现金 ${money(c.shortfallMinor)}。`:`现金 ${money(c.cashMinor)}，扣除生活预算、应急预留${c.billMinor?'、待付账单':''}${c.committedMinor?'、已确认计划首期预留':''}，可进一步规划 ${money(available)}。`);
 const selected=[g.fields.goal?`目标：${g.fields.goal}`:'',g.fields.target_minor?`本次再攒 ${money(g.fields.target_minor)}`:'',g.fields.daily_minor?`每天 ${money(g.fields.daily_minor)}`:'',g.fields.extra?`额外预留：${g.fields.extra} ${money(g.fields.extra_minor||0)}`:'',g.fields.horizon?`取用时间：${g.fields.horizon}`:''].filter(Boolean);
 if(selected.length)add('本轮已确认',selected.join('；'));
 const result=(reply,title,options,reason,{form=null,financial=false,chart=false}={})=>{
  if(reason)add('本轮建议依据',reason);
  return {reply,title,options,form,evidence:{summary:'记忆 · 当前财务 · 本轮选择',items:basis,asOf:c?.asOf,financial:financial?structuredClone(c):null,chartMonth:chart?g.allocation.month:null,settings:financial}};
 };
 const amounts=(values)=>values.map((n,i)=>choice(n,amount(n),i===0));
 const badContext=!c?.fresh||c.shortfallMinor>0||available===0;
 if((stage==='direction'||stage==='context_review')&&badContext){
  if(!c?.fresh)return result('你的目标还保留着，不过财务资料需要更新。我先核对最新账户和待付事项，再重新计算建议。','先同步财务？',[choice('refresh','同步当前财务（推荐）',false,'memory-context-refresh'),cancel()],'资料过期时暂停金额推荐，不使用旧快照。',{financial:true});
  return result(`${g.fields.direction==='earn'?'收益安排先缓一缓。':r.goalLabel?`你的${r.goalLabel}目标我还记得。`:'先把近期用钱留好。'}${c.billMinor?'刚同步的学费账单让近期预留还差 '+money(c.shortfallMinor):'当前已没有可进一步规划的资金'}。我建议先核对用钱需求，再继续安排。`,'先处理哪件事？',[choice('review-bill','核对近期用钱',true),choice('defer-goal',g.fields.direction==='earn'?'调整收益安排':'调整目标安排'),cancel()],'新增待付事项优先进入同一份财务快照，旧的储蓄或申购确认失效。',{financial:true,chart:true});
 }
 if(stage==='direction'){
  const goal=r.goalLabel;
  const canFundGoal=goal&&gap>0&&available>=gap;
  const reply=goal?`记得你在为${goal==='旅行'?'旅行攒钱':goal+'做准备'}。生活费和应急金已经留好，当前还有 ${money(available)} 可规划，${canFundGoal?'可以用这笔闲钱更快攒齐。':'我们结合这笔闲钱，重新安排存钱节奏。'}`:p.goal==='earn'?'你之前想把一年内用不到的钱安排好，也希望先看清风险和费用。结合当前账户，我建议先核对近期用钱，再看看剩余闲钱。':'生活费和应急金已经留好。先选一个方向，我们一步一步来。';
  return result(reply,'你更想先做哪件事？',[choice('save',goal?`继续为${goal}攒钱`:'为一个目标攒钱',!!goal),choice('earn','拿闲钱赚点收益',!goal&&p.goal==='earn'),choice('unsure',r.used?'我的计划有变化':'还没想好')],`当前可规划 ${money(available)}。${canFundGoal?'账户可规划资金足以覆盖剩余目标，优先建议增加本次投入、提前完成；也可选择收益安排。':'本轮方向由你选择，历史目标不限定这笔闲钱的用途。'}`,{financial:true,chart:true});
 }
 if(stage==='context_review')return result(g.contextNotice||'最新财务已经核对好了。你之前选过的目标会继续保留，我们按新金额重新确认下一步。','按新资料继续？',[choice('back','继续当前安排',true),choice('restart-direction','重新选方向'),cancel()],'恢复后重新计算金额与节奏，不沿用已经失效的确认。',{financial:true,chart:true});
 if(stage==='bill_review')return result(`${c.billMinor?'5天后有一笔 '+money(c.billMinor)+' 的待付学费，':'现有预留已占用可规划现金，'}生活预算和应急金仍需保留。${c.shortfallMinor?'目前缺口为 '+money(c.shortfallMinor)+'。':''}可以先查看本月实际支出，核对还有哪些用钱需求；账单本身尚未支付。`,'接下来怎么处理？',[choice('chart','查看本月支出',false,'intent-finance-overview'),choice('defer-goal',g.fields.direction==='earn'?'调整收益安排':'调整目标安排'),cancel()],'待付学费来自本次模拟同步；财务概览统计已发生支出，不会把待付账单当作已支付。',{financial:true});
 if(stage==='goal_defer')return result(`${g.fields.direction==='earn'?'这次的收益安排可以先缓一缓':(g.fields.goal||r.goalLabel||'原来的')+'目标可以保留'}。当前资金需要先覆盖近期用钱，我建议这次先缓一缓；等财务更新后，再重新安排金额和时间。`,'这次先怎么做？',[choice('pause-draft','先缓一缓',true),choice('review-bill','再核对用钱'),cancel()],'这里只调整本轮草案，不会删除长期目标，也不会自动暂停其他已确认的计划。',{financial:true});
 if(stage==='existing_goal'){
  const plan=existingIntentPlan(g);
  return result(`你已经有一份${g.fields.goal}计划：本罐目标 ${money(plan.targetMinor)}，实际已存 ${money(plan.savedMinor)}。${plan.status==='active'?'当前每天存 '+amount(plan.dailyMinor)+'。':'这份计划目前'+(plan.status==='completed'?'已完成':'已暂停或待核对')+'。'}可以先查看已有进度，避免重复安排。`,'怎么继续？',[choice('keep','保留已有计划',true,'wealth-keep-plan'),choice('jars','查看储蓄罐',false,'intent-finance-jars'),choice('change-goal','换一个目标')],`已有计划尚需预留 ${money(plan.committedMinor)}，已从当前可规划资金扣除。`);
 }
 if(stage==='goal')return result(r.used?'可以，我们按你这次的想法重新选目标。旧的金额和日期只用于原目标，换目标后会重新核对。':'还没有明确目标也没关系。可以先从旅行、应急备用或学习提升中选一个，再一起定金额。','想为哪个目标攒钱？',['旅行','应急备用','学习提升'].map(v=>choice(v,v)),'本次选择优先；不同目标不套用旧目标的金额、进度或日期。');
 if(stage==='goal_amount'){
  const done=f.previousTarget&&f.remaining===0;
  const reply=f.previousTarget?(done?`按你刚确认的进度，原来的${g.fields.goal}目标已经达到。可以换一个目标，也可以在已攒金额之外再加一点。`:`${g.fields.goal}目标 ${amount(f.previousTarget)}，${g.fields.progress_minor!=null?'这次确认已攒':'已攒'} ${amount(f.progress)}，还差 ${amount(f.remaining)}。${available>=f.remaining?'当前闲钱足够，建议尽快补齐。':'当前可规划 '+money(available)+'，需要按可负担的节奏分期攒。'}${intentTargetOptions(g).length>1?'或者这次再攒 '+amount(intentTargetOptions(g)[1].value)+'，把总目标提高到 '+amount(f.progress+intentTargetOptions(g)[1].value)+'。':''}`):g.fields.goal==='应急备用'?`当前已留好 ${money(c.reserveMinor)} 应急金，相当于一个月必要支出。你想多一点保障的话，可以再攒一个月，也可以把目标设为两个月。`:`这次先为${g.fields.goal}攒钱。结合当前可规划的 ${money(available)}，我先给你两个可调整的小目标；也可以自己定金额。`;
  const opts=done?[choice('change-goal','换一个目标',true),choice('custom-target','再攒一些'),cancel()]:[...amounts(intentTargetOptions(g).map(x=>x.value)),choice('custom-target','其他金额')];
  return result(reply,'目标先定多少？',opts,f.previousTarget?`总目标 ${money(f.previousTarget)} − ${g.fields.progress_minor!=null?'本次核对':'历史记录'}已攒 ${money(f.progress)} = 剩余 ${money(f.remaining)}。新计划只记新增部分。${g.fields.target_minor>f.remaining?'本次提高目标已经由你选择。':''}可规划余额 ${money(available)}，提高目标只作为可选项，不自动修改原预算。`:g.fields.goal==='应急备用'?'按上月必要支出确定一个月储备基准，不重复计算已经预留的应急金。':'没有这个目标的历史金额，先以可规划现金的10%和25%作为可修改的演示起点。');
 }
 if(stage==='goal_amount_custom')return result(`可以自己定。这次填写的是为${g.fields.goal}新增要攒的金额${f.progress?'，不包含已经攒好的 '+amount(f.progress):''}。后面会再核对每日节奏是否负担得起。`,'这次再攒多少？',[choice('goal-details','修改目标资料'),back()],'目标总额不等于立即扣款；真正确认前会核对首个30天的资金上限。',{form:{label:'金额（元）'}});
 if(stage==='goal_adjust')return result('可以更新已经攒好的金额，也可以换个目标。我会用你这次确认的信息重新计算。','想调整什么？',[...(f.previousTarget?[choice('edit-progress','更新已攒金额')]:[]),choice('change-goal','换一个目标'),back()],'账户余额不能代替目标进度；这次修正仅用于当前草案。');
 if(stage==='goal_progress')return result(`上次记录的进度是 ${money(p.progressMinor||0)}。请填入现在已经为${g.fields.goal}攒好的金额，我会据此重算剩余目标。`,'现在已攒多少？',[back()],'以本轮确认的已攒金额替代旧进度，但不创建存款流水，也不自动覆盖长期记忆。',{form:{label:'已攒金额（元）',zero:true}});
 if(stage==='saving_horizon'){
  const remembered=p.dueDate&&g.fields.goal===r.goalLabel&&p.dueDate>=f.start;
  return result(`本次为${g.fields.goal}再攒 ${amount(g.fields.target_minor)}。${remembered?'原来的目标时间是 '+dateLabel(p.dueDate)+'，可以沿用，也可以重新定时间。':'再定个大致时间，我就能结合当前财务算出每日金额。'}`,'希望什么时候攒好？',[choice(remembered?'remembered-date':'三个月',remembered?'原定 '+dateLabel(p.dueDate):'三个月左右',!!remembered),choice('半年','半年左右',!remembered),choice('不设期限','不设固定期限')],'完成时间由你选择；没有日期时，默认节奏只用于演示估算。');
 }
 if(stage==='daily'){
  if(!pace.values.length)return result('当前可规划资金不足以支持这个目标的每日存款安排。可以先降低目标金额，或等财务更新后再继续。','先调整这次目标？',[choice('edit-target','调整目标金额',true),cancel()],'暂不推荐无法负担或完成日期超出范围的节奏，不创建存款安排。',{financial:true});
  const daily=pace.values[0],alternative=pace.values[1],est=pace.estimate(daily);
  const reply=pace.accelerated?`存钱节奏可以加快一些。我建议每天存 ${amount(daily)}，约 ${est.days} 天攒齐本次金额${pace.days>est.days?`，比原计划提前 ${pace.days-est.days} 天`:""}。${alternative?`也可以每天存 ${amount(alternative)}，约 ${pace.estimate(alternative).days} 天完成。`:''}`:`按${g.fields.schedule_explicit?'你刚选的时间':'当前可负担的节奏'}，每天存 ${amount(daily)}，预计${dateLabel(est.finish)}攒齐。${alternative?`也可以每天存 ${amount(alternative)}，预计${dateLabel(pace.estimate(alternative).finish)}完成。`:''}${!pace.meetsDeadline?'当前资金不足以支持原日期的节奏，需要延后时间或降低目标。':''}`;
  return result(reply,'想用哪个存钱节奏？',[...pace.values.map((v,i)=>choice(v,'每天 '+amount(v),i===0)),choice('adjust-pace','调整金额或时间')],`${pace.accelerated?`本次闲钱足以覆盖 ${money(pace.target)} 的剩余目标，因此按30天加快完成，不再只按原日期摊薄每日金额。`:`本次目标 ${money(pace.target)}，按 ${pace.period} 天的参考节奏计算。`}首期上限 ${money(est.reviewCap)}，安排后仍有 ${money(available-est.reviewCap)} 可规划；生活预算和应急金已单独留好。${f.previousTarget&&g.fields.target_minor>f.remaining?`这次选择比历史缺口多攒 ${money(g.fields.target_minor-f.remaining)}，合计目标变为 ${money(f.progress+g.fields.target_minor)}。`:''}原目标日期 ${pace.dueDate||'未设定'}；预计完成 ${est.finish}。`);
 }
 if(stage==='pace_adjust'||stage==='saving_adjust')return result(`本次目标是 ${amount(g.fields.target_minor)}。可以改每日金额、完成时间${stage==='saving_adjust'?'或本次目标':''}，我会重新计算完成日期和首期预留。`,'想调整哪一项？',stage==='saving_adjust'?[choice('edit-target','调整目标金额'),choice('edit-horizon','调整完成时间'),choice('edit-daily','调整每日金额')]:[choice('custom-daily','自定每日金额'),choice('edit-horizon','调整完成时间'),back()],'调整后必须重新确认，不沿用旧授权。');
 if(stage==='daily_custom')return result(`可以按自己的节奏来。当前首期最多可使用 ${money(available)}；每天最多 ${amount(Math.min(200000,pace.maxDaily))}，确认前会再核对一次。`,'每天想存多少？',[back()],'每日金额不超过本次目标和演示每日上限；30天合计不得超过当前可规划资金。',{form:{label:'每日金额（元）'}});
 if(stage==='saving_confirm'){
  const est=pace.estimate(g.fields.daily_minor),start=f.start===new Date(now+8*3600000).toISOString().slice(0,10)?'今天':'明天';
  return result(`那就从${start}开始，每天存 ${amount(g.fields.daily_minor)}，${est.days<=30?'这期就能完成本次目标':'先安排30天'}。首期安排后还有 ${money(available-est.reviewCap)} 可规划，生活费和应急金继续留好${est.days>30?'，下一期再结合最新财务核对':''}。${f.dueDate&&est.finish>f.dueDate?'按这个节奏预计'+dateLabel(est.finish)+'完成，比原定时间晚一些。':''}`,'确认这次安排？',[choice('save','确认安排',false,'wealth-save'),choice('adjust-saving','调整计划'),cancel()],`本次再攒 ${money(g.fields.target_minor)}；首个30天上限 ${money(est.reviewCap)}，覆盖后可规划 ${money(available-est.reviewCap)}。生活账户1608，${f.start}起每天09:00，预计完成 ${est.finish}；${f.previousTarget?'历史总目标 '+money(f.previousTarget)+'，本次核对已攒 '+money(f.progress)+' 不计入新罐。':''}首期仅授权30天。`,{financial:true});
 }
 if(stage==='extra')return result(`可以，我们来看看这笔闲钱怎么争取收益。生活预算和应急金已留好，当前有 ${money(available)} 可规划。确认没有其他近期用钱后，就按取用时间和风险偏好比较安排。`,'还有额外用钱吗？',[choice('暂无','没有，继续看收益',true),choice('adjust-extra','有，先留一笔'),choice('chart','先看收支概览',false,'intent-finance-overview')],'本轮选择的是收益安排。已确认计划与待付事项已计入资金占用；历史愿望不自动变成本轮预留，额外用途由你确认。',{financial:true,chart:true});
 if(stage==='extra_kind')return result('好，我们把这笔额外用钱单独留出来。只填写生活预算、应急金和待付账单之外还需要的部分。','要为哪件事留钱？',['旅行','学费','其他'].map(x=>choice(x,x)),'本次补充优先于历史默认需求，同一笔账单不重复预留。');
 if(stage==='extra_amount')return result(`先为${g.fields.extra}留出一笔钱。${g.fields.extra===r.goalLabel&&gap?'结合历史目标，还需 '+money(gap)+'。':'还没有这笔需求的确定金额，可以先选一个起点，再调整。'}当前最多可额外预留 ${money(available)}。`,'这笔钱先留多少？',[...amounts(extraAmountOptions(g)),choice('custom-extra','其他金额')],'已知目标使用未覆盖的差额；未知需求以可规划现金的10%和25%作为可修改的起点。');
 if(stage==='extra_amount_custom')return result(`为${g.fields.extra}额外预留多少，由你确认。最多 ${money(available)}，其他生活预留会继续保留。`,'要预留多少？',[back()],'只计算额外需求，不能超过当前可规划现金。',{form:{label:'额外预留（元）'}});
 if(stage==='horizon'){
  if(!investable)return result('这次可规划的钱已经全部用于目标预留，没有剩余闲钱需要继续安排。可以调整预留，也可以到这里结束。','接下来怎么做？',[choice('edit-extra','调整额外预留'),cancel()],'没有剩余额度时，不继续推荐申购产品。');
  const remembered=g.fields.horizon||(p.liquidity==='flexible'&&p.liquidityScope!=='goal'?'随时':p.horizon);
  return result(`${g.fields.extra_minor?'额外留好'+g.fields.extra+' '+money(g.fields.extra_minor)+'后，':'沿用已经核对的预留，'}还剩 ${money(investable)} 可以讨论。${remembered?'你'+(g.fields.horizon?'这次选择过':'之前提过')+'「'+remembered+'」，这次仍然这样安排吗？':'剩余闲钱的取用时间还需要你补充。'}`,'这笔闲钱多久不用？',[...new Set([remembered||'随时',remembered==='半年'?'随时':'半年',remembered==='一年'?'不确定':'一年'])].map(x=>choice(x,x,x===remembered)),'只使用适用于这笔闲钱的取用偏好；其他目标的日期或偏好不代替本轮确认。');
 }
 if(['experience','loss','stability'].includes(stage)){
  const copy={experience:['可规划额度和取用时间已经有了。接下来确认一下你的投资经验，再缩小适合讨论的范围。','你有多少投资经验？',['没有经验','了解基金或理财','有多年投资经验']],loss:['了解了你的经验。还要确认你能接受多大的本金波动，这会影响后面的选择。','能接受怎样的波动？',['不能接受本金损失','可接受小幅亏损','能承受明显波动']],stability:[`${p.cashflow==='variable'?'记得你的收入有些波动。':'当前已经留好一个月必要支出。'}再确认一下现在的收入和备用金情况，避免安排得太满。`,'现在收入情况如何？',['收入不稳定','收入稳定但有压力','收入稳定且有充足备用金']]}[stage];
  return result(copy[0],copy[1],copy[2].map(x=>choice(x,x)),`可讨论金额 ${money(investable)}，取用安排「${g.fields.horizon}」。历史偏好和账户余额不能代替本人的风险回答。`);
 }
 if(stage==='products'){
  const suitable=products.filter(eligible);
  if(!suitable.length)return result('按你刚确认的条件，这两款演示产品都不适合。可以暂时保留现金；如果刚才填错了，也可以重新核对。','这次怎么继续？',[choice('edit-risk','重新核对风险回答'),choice('edit-investment-horizon','修改取用时间'),cancel()],'不能接受本金损失时，不推荐不保本产品；产品也必须满足取用期限。');
  for(const product of products)add(product.name+' · R'+product.risk,`${product.assets}；${product.fee}；${product.redemption}。${product.detail}${eligible(product)?'':' 不符合本次条件。'}`);
  return result(`结合「${g.fields.horizon}」的取用时间和本次风险回答，我建议先看看${suitable[0].name}。${suitable.length>1?'也可以比较另一款的持有期和费用。':'另一款不符合这次的期限或风险条件。'}这些演示产品都不保本，具体费用和赎回时间可以展开依据查看。`,'先了解哪一款？',[...suitable.map((x,i)=>choice(x.id,x.name,i===0)),...(suitable.length<2?[choice('edit-investment-horizon','调整取用时间')]:[]),cancel()],`本次确认的风险级别 R${riskLevel}，可投资 ${money(investable)}；只展示符合本次期限与风险范围的虚构产品。`);
 }
 if(stage==='amount')return result(`选了${products.find(x=>x.id===g.fields.product_id)?.name}。当前可讨论的额度是 ${money(investable)}，先安排 ${money(investmentAmountOptions(g)[0])}，其余继续保留；也可以选更小的金额。`,'这次安排多少？',[...amounts(investmentAmountOptions(g)),choice('custom-investment','其他金额')],`按取用时间以额度的${['随时','不确定'].includes(g.fields.horizon)?10:25}%作为可调整的演示起点；不是收益预测。`);
 if(stage==='amount_custom')return result(`可以，金额由你决定。这次最多 ${money(investable)}，生活费、应急金和已确认的额外预留不会动用。`,'这次安排多少？',[back()],'金额确认后仍需逐项核对和本人验证。',{form:{label:'本次金额（元）'}});
 if(['confirm','verifying'].includes(stage)){
  const product=products.find(x=>x.id===g.fields.product_id);
  add('产品条款',`${product.fee}；${product.redemption}；${product.detail}`);
  return result(stage==='verifying'?'这笔安排已由你确认，接下来验证身份。验证通过才会执行。':`这次为${product.name}安排 ${money(g.fields.amount_minor)}，剩余 ${money(investable-g.fields.amount_minor)} 继续保留。${g.fields.extra_minor?g.fields.extra+'预留 '+money(g.fields.extra_minor)+' 也已留好。':''}请再核对一次，确认后进入本人验证。`,stage==='verifying'?'等待本人验证':'确认这次安排？',stage==='verifying'?[]:[choice('confirm','确认并验证',false,'wealth-confirm'),choice('edit-investment-amount','调整金额'),cancel()],`生活账户1608，R${product.risk}，取用时间「${g.fields.horizon}」。仍保留生活预算、应急资金及待付账单；长期记忆不构成交易授权。`,{financial:true});
 }
 if(['done','cancelled'].includes(stage))return result(g.completionText||(stage==='cancelled'?'这次先不安排，钱没有动。':'本次安排已确认。'),' ',[],stage==='cancelled'?'本轮草案已结束，没有新增存款或申购。':g.fields.daily_minor?`本次新增目标 ${money(g.fields.target_minor)}，每天 ${money(g.fields.daily_minor)}，首期上限 ${money(Math.min(g.fields.target_minor,g.fields.daily_minor*30))}。历史已攒金额不会重复计入新罐。`:'以本次明确确认和实际执行回执为准。');
 return result('我们继续核对下一步。','怎么继续？',[cancel()],'仅使用当前已确认的信息。');
}

export function renderIntentQuestion(turn,g,{escape:e}){
 const options=turn.options.map(o=>`<button type="button" class="${o.action==='wealth-cancel'?'quiet':o.action==='wealth-save'||o.action==='wealth-confirm'?'primary':'secondary'} full" data-action="${e(o.action)}" data-value="${e(o.value)}" data-revision="${g.revision}" ${o.disabled?'disabled':''}>${e(o.label)}${o.recommended?'（推荐）':''}</button>`).join('');
 const form=turn.form?`<form id="wealth-amount-form" data-revision="${g.revision}"><label>${e(turn.form.label)}<input name="amount" type="number" min="${turn.form.zero?'0':'0.01'}" step="0.01" required></label><button class="secondary full" type="submit">使用这个金额</button></form>`:'';
 return {title:e(turn.title),html:form+options};
}
