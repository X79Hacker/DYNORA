import test from 'node:test';
import assert from 'node:assert/strict';

test('comparison worker completes all 30 profile/case/controller trials and repeats a seed',async()=>{
 // Use an actual global-like worker surface so Rapier can access performance.
 const previousSelf=globalThis.self,previousPost=globalThis.postMessage;globalThis.self=globalThis;let report,error;
 globalThis.postMessage=data=>{if(data.type==='complete')report=data.report;if(data.type==='error')error=data.error};
 try{
  await import('../src/evaluation-worker.js');await self.onmessage({data:{command:'run',profiles:'all',seeds:1}});assert.equal(error,undefined);assert.equal(report.results.length,30);assert.ok(report.results.every(r=>['success','timeout'].includes(r.status)&&Number.isFinite(r.path_length_m)&&Number.isFinite(r.goal_distance_m)));const first=report.results.filter(r=>r.profile==='research');assert.ok(first.some(r=>r.test==='surface'&&r.status==='success'));await self.onmessage({data:{command:'run',profiles:'research',seeds:1}});assert.deepEqual(report.results,first);
 }finally{globalThis.self=previousSelf;globalThis.postMessage=previousPost;delete globalThis.onmessage}
});
