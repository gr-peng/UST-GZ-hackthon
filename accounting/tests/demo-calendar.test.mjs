import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,createTask} from '../web/engine.mjs';
import {buildAgentFacts} from '../web/agent-tools.mjs';
import {taskParameters,validateTaskParameters} from '../web/task-parameters.mjs';
import {clarificationFields} from '../web/agent-cards.mjs';
import {offlineResult,OFFLINE_PROMPTS} from '../web/offline-demo.mjs';
import {PROACTIVE_DEMO_FIXTURES} from '../web/proactive-demo.mjs';
import {appStateKey} from '../web/desktop-session.mjs';
import {readFileSync} from 'node:fs';
import {BIRTHDAY_DATE,BIRTHDAY_CLOCK_AT,DEMO_START_AT} from '../web/demo-calendar.mjs';

test('facts, transfer confirmation and date input use the same November 15 business day',()=>{
 const state=fresh(),task=createTask(state,'salary');
 assert.equal(buildAgentFacts(state).as_of,'2026-11-15');
 assert.equal(taskParameters(task).scheduled_date,'2026-11-15');
 assert.doesNotThrow(()=>validateTaskParameters(task));
 const form=clarificationFields({missing:['scheduled_date'],fields:{}},String);
 assert.match(form,/value="2026-11-15"/);
 for(const scheduledDate of ['2026-11-02','2026-11-16'])assert.throws(()=>validateTaskParameters({...task,scheduledDate}),/只执行当天安排/);
 assert.notEqual(appStateKey('demo'),'finpilot-companion-v1-demo');
});

test('offline examples remain future tasks and the Saturday wording matches the ride date',()=>{
 const ride=offlineResult({text:OFFLINE_PROMPTS.ride}).result.fields.items.find(x=>x.kind==='ride');
 assert.equal(ride.date,'2026-11-21');
 assert.equal(new Date(ride.date+'T09:00:00+08:00').getUTCDay(),6);
 const birthday=offlineResult({text:OFFLINE_PROMPTS.birthday}).result.fields;
 assert.equal(birthday.birthday_date,'2026-11-18');
 assert.equal(PROACTIVE_DEMO_FIXTURES.birthday.birthday_date,birthday.birthday_date);
 assert.equal(PROACTIVE_DEMO_FIXTURES.rent_email.due_date,'2026-11-16');
 assert.equal(PROACTIVE_DEMO_FIXTURES.start_at,'2026-11-15T01:00:00.000Z');
});

test('November 18 birthday uses the same China 13:14 target in live and static demos',()=>{
 const birthday=offlineResult({text:OFFLINE_PROMPTS.birthday}).result.fields;
 assert.match(OFFLINE_PROMPTS.birthday,/11月18日生日/);
 assert.equal(birthday.birthday_date,BIRTHDAY_DATE);
 assert.equal(new Date(BIRTHDAY_DATE+'T13:14:00+08:00').toISOString(),new Date(BIRTHDAY_CLOCK_AT).toISOString());
 assert.equal(new Date(BIRTHDAY_CLOCK_AT).toISOString(),'2026-11-18T05:14:00.000Z');
 assert.equal(new Date(BIRTHDAY_CLOCK_AT).getUTCDay(),3);
 assert.ok(Date.parse(BIRTHDAY_CLOCK_AT)>Date.parse(DEMO_START_AT));
 const fixtures=JSON.parse(readFileSync(new URL('../demo/static-site-fixtures.json',import.meta.url),'utf8'));
 assert.deepEqual(fixtures.events.advance_birthday_clock,['birthday-clock-20261118',{target_at:BIRTHDAY_CLOCK_AT}]);
});
