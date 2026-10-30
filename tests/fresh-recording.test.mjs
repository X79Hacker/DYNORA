import test from 'node:test';import assert from 'node:assert/strict';
import {wireRecordingControls} from '../src/recording-controls.js';
function fixture(clearGate=()=>Promise.resolve()){
 const record={},exportButton={},clear={},saved=[],errors=[];let on=false,rows=['old'],starts=0,resets=0;
 wireRecordingControls({record,exportButton,clear,isRecording:()=>on,isBusy:()=>false,setRecording:value=>{on=value;if(value)starts++},exportData:async()=>{saved.push([...rows]);return true},clearData:async()=>{await clearGate();rows=[]},onNewRecording:()=>resets++,onError:e=>errors.push(e)});
 return{record,exportButton,clear,saved,errors,append:value=>rows.push(value),state:()=>({on,rows,starts,resets})};
}
test('a second Record exports only its new data through both stop and Export buttons',async()=>{const f=fixture();await f.record.onclick();f.append('first run');await f.record.onclick();await f.record.onclick();assert.deepEqual(f.state().rows,[]);f.append('second run');await f.exportButton.onclick();assert.deepEqual(f.saved,[['first run'],['second run']]);assert.equal(f.state().resets,2);assert.deepEqual(f.errors,[]);});
test('double-clicking Record while the previous buffer is settling starts only one fresh run',async()=>{let release;const f=fixture(()=>new Promise(r=>release=r)),a=f.record.onclick();await f.record.onclick();assert.equal(f.record.disabled,true);release();await a;assert.equal(f.state().starts,1);assert.equal(f.record.disabled,false);});
test('Clear during recording exports the current data before clearing it',async()=>{const f=fixture();await f.record.onclick();f.append('current');await f.clear.onclick();assert.deepEqual(f.saved,[['current']]);assert.deepEqual(f.state().rows,[]);assert.equal(f.state().on,false);});
