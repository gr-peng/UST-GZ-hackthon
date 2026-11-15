import test from 'node:test';
import assert from 'node:assert/strict';
import {AppGlass} from '../web/material/renderer.mjs';

function fixture(run){
 const previous={document:globalThis.document,raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame};
 const callbacks=new Map(),statuses=[];let id=0,cardDraws=0,cardFallbacks=0;
 globalThis.document={hidden:false,visibilityState:'visible',hasFocus:()=>true,body:{dataset:{}}};
 globalThis.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};
 globalThis.cancelAnimationFrame=key=>callbacks.delete(key);
 const renderer=Object.assign(Object.create(AppGlass.prototype),{
  app:{style:{background:'rendered glass'}},canvas:{hidden:false},originalBackground:'original CSS',
  cap:1,dpr:1,gl:{},resources:true,enabled:true,lost:false,disposed:false,terminal:false,
  glassBudgetFallback:false,lastBudgetFrame:0,raf:0,frames:0,cpu:[],painted:new Set(),targets:[],
  gpu:{result:()=>({samples:20,p95Ms:10})},
  metal:{active:false,frames:0,render(){cardDraws++;return true;},fallback(){cardFallbacks++;this.active=false;}},
  onStatus:status=>statuses.push(status),
 });
 const tick=time=>{const ready=[...callbacks.values()];callbacks.clear();for(const callback of ready)callback(time);};
 try{run({renderer,tick,callbacks,statuses,cardDraws:()=>cardDraws,cardFallbacks:()=>cardFallbacks});}
 finally{
  if(previous.document===undefined)delete globalThis.document;else globalThis.document=previous.document;
  if(previous.raf===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previous.raf;
  if(previous.cancel===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=previous.cancel;
 }
}

test('a measured rendering budget fallback preserves the card renderer instead of permanently shutting it down',()=>fixture(({renderer,tick,cardDraws,cardFallbacks,statuses,callbacks})=>{
 renderer.checkQuality();
 assert.equal(renderer.glassBudgetFallback,true);assert.equal(renderer.terminal,false);
 assert.equal(renderer.canvas.hidden,true);assert.equal(renderer.app.style.background,'original CSS');
 assert.equal(cardFallbacks(),0);tick(100);
 assert.equal(cardDraws(),1);assert.equal(callbacks.size,0);
 assert.equal(statuses.at(-1).bankMetal.targetFps,30);
 // Settling to idle must not revoke the ability to wake on the next pointer move.
 renderer.requestDraw();tick(150);assert.equal(cardDraws(),2);
}));

test('degraded card animation is paced, stops in the background and can resume with the same renderer',()=>fixture(({renderer,tick,callbacks,cardDraws})=>{
 renderer.checkQuality();renderer.metal.active=true;
 for(const time of [100,116,134,150,168])tick(time);
 assert.equal(cardDraws(),3);assert.equal(callbacks.size,1);
 renderer.cancel();document.hidden=true;renderer.requestDraw();assert.equal(callbacks.size,0);
 document.hidden=false;renderer.requestDraw();tick(250);assert.equal(cardDraws(),4);
 renderer.metal.active=false;renderer.cancel();
 renderer.setEnabled(false);assert.equal(callbacks.size,0);
 renderer.setEnabled(true);tick(300);assert.equal(cardDraws(),5);
 assert.equal(renderer.terminal,false);assert.equal(renderer.reason,'measured-render-budget');
}));

test('actual rendering failures still stop GPU work instead of silently claiming working animation',()=>fixture(({renderer,callbacks,cardFallbacks})=>{
 renderer.fallback('shader failure',true);
 assert.equal(renderer.terminal,true);assert.equal(cardFallbacks(),1);
 renderer.requestDraw();assert.equal(callbacks.size,0);
}));
