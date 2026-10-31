import test from 'node:test';import assert from 'node:assert/strict';
import {LabExperiment} from '../src/physics-test-core.js';
import {validateLabSettings,liveResetReasons,transferableTerrain} from '../src/physics-test-settings.js';
async function manual(settings={}){return new LabExperiment({...settings,control:{mode:'manual'}}).initialize()}
test('manual lab remains still without input, supports forward, reverse and turn beyond the scripted duration',async()=>{
 const r=await manual({drive:{duration:2,driveSeconds:1}});r.step(120);assert.ok(Math.abs(r.drive.pose.x+1.2)<.0001);
 r.setControl({forward:.7});r.step(240);assert.ok(r.drive.pose.x>-.8);assert.notEqual(r.status,'completed');assert.ok(r.time>2);
 r.setControl({forward:0,turn:.65});const yaw=r.drive.pose.yaw;r.step(120);assert.ok(Math.abs(r.drive.pose.yaw-yaw)>.05);
 r.setControl({forward:-.7});r.step(120);assert.ok(r.drive.v<-.02);assert.ok(r.report().events.some(e=>e.type==='manual_input'));assert.ok(r.samples.some(s=>s.input_left_duty<0));r.dispose();
});
test('braking reduces manual speed and command validation cannot inject NaN or excess duty',async()=>{
 const r=await manual();r.setControl({forward:5});assert.equal(r.command.forward,1);r.step(120);const before=Math.abs(r.drive.v);r.setControl({brake:true});r.step(80);assert.ok(Math.abs(r.drive.v)<before/2);
 assert.throws(()=>r.setControl({forward:NaN}));assert.throws(()=>r.setControl({brake:'yes'}));assert.ok(r.samples.every(s=>Number.isFinite(s.speed_mps)));r.dispose();
});
test('live grip, mass, motors and ride tuning preserves pose, velocity, clock and contact world',async()=>{
 const r=await manual({case:'collision'});r.setControl({forward:.6});r.step(90);const pose={...r.drive.pose},v=r.drive.v,time=r.time,world=r.physics.world;
 const next=validateLabSettings({...r.settings,surface:'wet',robot:{...r.settings.robot,mass:7,stallTorque:.5},ride:{...r.settings.ride,damping:1.1},collision:{...r.settings.collision,target:'custom',mass:3}});r.updateSettings(next);
 assert.deepEqual(r.drive.pose,pose);assert.equal(r.drive.v,v);assert.equal(r.time,time);assert.equal(r.physics.world,world);assert.equal(r.drive.p.mass,7);assert.equal(r.surface.mu,.12);assert.equal(r.physics.items.get('target').mass,3);assert.equal(r.ride.p.damping,1.1);r.step(12);assert.ok(r.time>time);r.dispose();
});
test('structural live edits are rejected atomically and custom start / target poses really enter the world',async()=>{
 const r=await manual({case:'collision',spawn:{x:-2,z:.4,yaw:25},collision:{x:.5,z:-.3,yaw:40}});assert.equal(r.robot.position.x,-2);assert.equal(r.robot.position.z,.4);assert.ok(Math.abs(r.drive.pose.yaw-25*Math.PI/180)<1e-9);assert.equal(r.target.object.position.z,-.3);
 const before=r.settings,next=validateLabSettings({...before,robot:{...before.robot,mass:9,radius:.1}});assert.ok(liveResetReasons(before,next).includes('robot.radius'));assert.throws(()=>r.updateSettings(next),/reset/);assert.equal(r.settings,before);assert.notEqual(r.drive.p.mass,9);r.dispose();
});
test('live airflow and balloon tuning preserves the existing field and motion, and impulses are measured',async()=>{
 const r=await manual({case:'air',air:{quality:'low'}});r.step(24);const flow=r.flow,x=r.balloon.position.x,time=r.time;
 r.updateSettings({...r.settings,air:{...r.settings.air,wind:5,angle:30,density:1.1},balloon:{...r.settings.balloon,tether:false,payload:.02}});assert.equal(r.flow,flow);assert.equal(r.flow.wind,5);assert.equal(r.balloon.position.x,x);assert.equal(r.time,time);assert.equal(r.balloon.p.tether,false);
 const vx=r.balloon.velocity.x;r.impulseBalloon({x:.02,y:0});assert.ok(r.balloon.velocity.x>vx);assert.throws(()=>r.impulseBalloon({x:1}));assert.ok(r.report().events.some(e=>e.type==='balloon_impulse'));r.dispose();
});
test('manual reports use a bounded rolling sample window with explicit dropped counts',async()=>{
 const r=await manual();r.step(9606);const report=r.report();assert.equal(report.samples.length,1600);assert.equal(report.sample_window.dropped_old_samples,1);assert.ok(report.samples[0].t_s>.05);assert.equal(report.samples.at(-1).sample_sequence,1601);assert.ok(report.columns.includes('manual_forward_duty'));r.dispose();
});
test('track transfer rejects unsupported or oversized geometry before any main simulator mutation',()=>{
 assert.throws(()=>transferableTerrain({case:'terrain',terrain:{kind:'ramp'}}),/Ramps/);
 assert.throws(()=>transferableTerrain({case:'terrain',terrain:{kind:'pothole',r:.65,aspect:1.3}}),/wider/);
 const bumps=transferableTerrain({case:'terrain',terrain:{kind:'bumps',bumpCount:4,bumpH:.04}});assert.equal(bumps.terrain.holes[0].enabled,false);assert.equal(bumps.terrain.bumps[0].n,4);
});
