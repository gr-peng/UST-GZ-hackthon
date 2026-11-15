import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFinancialContext,createFinancialContextController,PREVIEW_ALLOCATION,FINANCIAL_CONTEXT_KEY} from '../web/financial-context.mjs';
import {freshMemory,recallMemory} from '../web/long-term-memory.mjs';
import {renderMemoryEvidence,renderFinancialSummary,memoryEscape} from '../web/memory-ui.mjs';
import {fresh} from '../web/engine.mjs';
import {startWealthGuide,wealthChoice,allocation,renderWealthGuide,wealthDialogue} from '../web/wealth-guide.mjs';

test('all visible amounts reconcile to one snapshot; investments are excluded from spendable cash',()=>{
 const c=buildFinancialContext(PREVIEW_ALLOCATION,{invested:1000000});
 assert.equal(c.availableMinor,4363390);assert.equal(c.cashMinor,c.availableMinor+c.protectedMinor);assert.equal(c.shortfallMinor,0);
 const r=recallMemory(freshMemory(),c);assert.strictEqual(r.context,c);assert.match(r.reply,/43,633.9/);assert.match(renderFinancialSummary(c),/43,633.9/);assert.match(renderMemoryEvidence(r),/43,633.9/);
 assert.equal(c.sources.length,4);
});
test('a new payable changes the recommended direction without changing long-term memory',()=>{
 const memory=freshMemory(),before=structuredClone(memory),c=buildFinancialContext(PREVIEW_ALLOCATION,{extraBill:true});
 assert.equal(c.availableMinor,0);assert.equal(c.shortfallMinor,136610);
 const first=recallMemory(memory,buildFinancialContext(PREVIEW_ALLOCATION)),next=recallMemory(memory,c);
 assert.equal(first.options[0].value,'save');assert.equal(next.options[0].value,'review-context');assert.match(next.reply,/1,366.1/);assert.match(next.reply,/旅行/);assert.deepEqual(memory,before);
 for(const mode of ['answer','evidence','both']){memory.mode=mode;const r=recallMemory(memory,c);assert.equal(r.options[0].value,'review-context');assert.equal(r.context.id,c.id);}
});
test('stale or incomplete context never recommends allocating an old balance',()=>{
 for(const c of [buildFinancialContext(PREVIEW_ALLOCATION,{stale:true}),buildFinancialContext({cash:1})]){
  const r=recallMemory(freshMemory(),c);assert.equal(r.options[0].value,'refresh-context');assert.doesNotMatch(r.reply,/43,633/);assert.equal(r.options.some(o=>o.value==='earn'),false);
 }
});
test('new question reads current App financial source, independent from persistent profile',()=>{
 const state=fresh(),controller=createFinancialContextController(null,()=>allocation(state,{now:Date.parse('2026-11-02T01:00:00Z')}));
 assert.equal(controller.snapshot().availableMinor,4363390);
 state.ledger.push({id:'context-test-income',date:'2026-11-02',amountMinor:10000,direction:'income',movement:'cashflow',category:'工资'});
 assert.equal(controller.snapshot().availableMinor,4373390);
});
test('financial simulation state survives a new window in its own namespace',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},controller=createFinancialContextController(storage);
 controller.change('bill');controller.change('stale');const restored=createFinancialContextController(storage);assert.equal(restored.snapshot().fresh,false);assert.equal(restored.snapshot().billMinor,4500000);
 restored.change('refresh');assert.equal(restored.snapshot().fresh,true);assert.equal(restored.snapshot().shortfallMinor,136610);assert.deepEqual([...data.keys()],[FINANCIAL_CONTEXT_KEY]);
});
test('context review is a read-only continuation and cannot jump into saving/investment with a shortfall',()=>{
 const app=fresh(),now=Date.parse('2026-11-02T01:00:00Z'),balance=app.balance;startWealthGuide(app,{now});
 assert.throws(()=>wealthChoice(app,'review-context',{now,expectedRevision:1}),/没有待核对/);
 wealthChoice(app,'unsure',{now,expectedRevision:1});assert.doesNotMatch(renderWealthGuide(app,{esc:memoryEscape}),/演示资料/);
 app.wealthGuide.memoryRecall=recallMemory(freshMemory(),buildFinancialContext(PREVIEW_ALLOCATION,{extraBill:true}));
 assert.throws(()=>wealthChoice(app,'earn',{now,expectedRevision:1}),/先核对/);
 wealthChoice(app,'review-context',{now,expectedRevision:1});assert.equal(app.wealthGuide.stage,'context_review');assert.match(wealthDialogue(app,{now}).reply,/1,366.10/);assert.equal(app.balance,balance);assert.equal(app.wealthSubscriptions,undefined);
 assert.throws(()=>wealthChoice(app,'back',{now,expectedRevision:2}),/补齐近期预留/);assert.equal(app.wealthGuide.stage,'context_review');
});
