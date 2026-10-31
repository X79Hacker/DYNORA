import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {SURFACES} from '../src/dynamics.js';
import {LAB_SURFACES,validateLabSettings,labSurface} from '../src/physics-test-settings.js';
import {LabExperiment} from '../src/physics-test-core.js';
async function complete(settings){const r=await new LabExperiment(settings).initialize();while(r.status!=='completed')r.step(120);return r}

test('the obstacle-track floors are lab surfaces with their own grip and rolling resistance',()=>{
 for(const id of ['asphalt','oak','tiles','concrete']){assert.ok(SURFACES[id],id);const s=labSurface(validateLabSettings({surface:id}));assert.equal(s.mu,SURFACES[id].mu);assert.equal(s.crr,SURFACES[id].crr);}
 for(const[id,s]of Object.entries(LAB_SURFACES)){assert.equal(s.mu,SURFACES[id].mu,id);assert.ok(s.mu>0&&s.mu<=1.5&&s.crr>=0&&s.crr<1,id);assert.match(s.color,/^#[0-9a-f]{6}$/,id);}
 assert.ok(SURFACES.asphalt.mu>SURFACES.oak.mu&&SURFACES.oak.mu>SURFACES.wet.mu);
});

test('the simulator surface picker offers every lab surface, so Apply keeps the choice',async()=>{
 const html=await readFile(new URL('../src/research.js',import.meta.url),'utf8');for(const id of Object.keys(LAB_SURFACES))assert.ok(html.includes(`<option value="${id}">`),id);
});

test('asphalt brakes in a shorter distance; oak wood coasts further',async()=>{
 const run=async(surface,brake)=>{const r=await complete({surface,drive:{duration:5,driveSeconds:2,brake}}),s=r.summary();r.dispose();return s.stopping_distance_m};
 assert.ok(await run('asphalt',true)<await run('oak',true),'more grip stops sooner');
 assert.ok(await run('oak',false)>await run('asphalt',false),'less rolling resistance coasts further');
});
