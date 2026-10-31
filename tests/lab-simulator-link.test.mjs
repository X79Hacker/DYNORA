import test from 'node:test';import assert from 'node:assert/strict';
import {labTransfer,validateTransfer,initSimulatorLabLink,LAB_TRANSFER_KEY,LAB_ACK_KEY} from '../src/lab-simulator-link.js';
function fixture(extra={}){const data=new Map(),calls=[],storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};const PX={applyCalibration:p=>calls.push(['robot',p]),setSurface:s=>calls.push(['surface',s]),setBrake:s=>calls.push(['brake',s])};const link=initSimulatorLabLink({environment:'apartment',ready:Promise.resolve(),PX,guard:()=>{},storage,eventTarget:new EventTarget(),now:()=>10000,...extra});return{link,data,calls,storage}}
test('explicit profile transfer applies validated values and acknowledges the exact request once',async()=>{
 const f=fixture({applyRide:p=>f.calls.push(['ride',p])}),packet=labTransfer({surface:'wet',robot:{mass:6}},'apartment','profile',10000);await f.link.receive(packet);
 assert.equal(f.calls[0][1].mass,6);assert.equal(f.calls[0][1].mu,.12);assert.ok(f.calls.some(([k])=>k==='ride'));assert.equal(JSON.parse(f.data.get(LAB_ACK_KEY)).id,packet.id);assert.equal(JSON.parse(f.data.get(LAB_ACK_KEY)).status,'applied');const count=f.calls.length;await f.link.receive(packet);assert.equal(f.calls.length,count);f.link.dispose();
});
test('a recording guard rejects a transfer without changing runtime settings or claiming success',async()=>{
 const f=fixture({guard:()=>{throw Error('Stop recording before applying settings')}}),packet=labTransfer({},'apartment','profile',10000);await f.link.receive(packet);assert.equal(f.calls.length,0);assert.equal(JSON.parse(f.data.get(LAB_ACK_KEY)).status,'rejected');assert.match(JSON.parse(f.data.get(LAB_ACK_KEY)).detail,/recording/);f.link.dispose();
});
test('environment routing, expiry and invalid values cannot mutate another simulator',async()=>{
 const f=fixture();await f.link.receive(labTransfer({},'canteen','profile',10000));assert.equal(f.calls.length,0);assert.equal(f.data.has(LAB_ACK_KEY),false);
 const packet=labTransfer({},'apartment','profile',10000);assert.throws(()=>validateTransfer(packet,'apartment',400001),/expired/);await f.link.receive({...packet,settings:{robot:{mass:NaN}}});assert.equal(f.calls.length,0);assert.equal(JSON.parse(f.data.get(LAB_ACK_KEY)).status,'rejected');f.link.dispose();
});
test('terrain and selected-model transfers call only their requested destination operation',async()=>{
 let contact=0;const f=fixture({applyContact:()=>{contact++;return 'Model contact applied'}});await f.link.receive(labTransfer({case:'collision'},'apartment','contact',10000));assert.equal(contact,1);assert.equal(f.calls.length,0);assert.equal(JSON.parse(f.data.get(LAB_ACK_KEY)).status,'applied');
 assert.throws(()=>labTransfer({case:'terrain'},'apartment','terrain',10000),/Obstacle track/);f.link.dispose();
 const g=fixture({environment:'obstacle track',applyTerrain:(s,t)=>{assert.equal(t.track.id,'bench');assert.equal(s.case,'terrain')}});await g.link.receive(labTransfer({case:'terrain'},'obstacle track','terrain',10000));assert.equal(JSON.parse(g.data.get(LAB_ACK_KEY)).status,'applied');g.link.dispose();
});
test('a newly opened matching environment picks up an explicit recent pending request',async()=>{
 const packet=labTransfer({},'apartment','profile',10000),data=new Map([[LAB_TRANSFER_KEY,JSON.stringify(packet)]]),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};let applied=0;
 const f=fixture({storage,PX:{applyCalibration:()=>applied++,setSurface:()=>{},setBrake:()=>{}}});await f.link.receive(packet);assert.equal(applied,1);assert.equal(JSON.parse(data.get(LAB_ACK_KEY)).id,packet.id);f.link.dispose();
});
test('reloading a simulator does not replay an already acknowledged transfer',async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},packet=labTransfer({},'apartment','profile',10000);data.set(LAB_TRANSFER_KEY,JSON.stringify(packet));
 const first=fixture({storage});await first.link.receive(packet);assert.equal(first.calls.filter(([k])=>k==='robot').length,1);first.link.dispose();
 const second=fixture({storage});await second.link.receive(packet);assert.equal(second.calls.length,0);second.link.dispose();
});
