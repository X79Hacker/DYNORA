import test from 'node:test';import assert from 'node:assert/strict';import JSZip from 'jszip';
import {csvText,datasetZip,verifyDatasetZip} from '../src/dataset-export.js';
import {wireRecordingControls} from '../src/recording-controls.js';
test('CSV escapes commas, quotes and embedded line breaks',()=>{assert.equal(csvText(['operator','note'],[['a,b','he said "yes"\nnext']]),'\ufeffoperator,note\n"a,b","he said ""yes""\nnext"');});
test('dataset ZIP preserves binary images, physics schema and records',async()=>{const data=await datasetZip({csv:csvText(['slip_left_ratio'],[[.25]]),metadata:{schema_version:2,physics:{fixed_step_s:1/120}},annotations:[],events:[],eventCSV:'type',images:[['images/test.bin',new Blob([new Uint8Array([0,3,255,8])])]]});const zip=await JSZip.loadAsync(data);assert.deepEqual([...await zip.file('images/test.bin').async('uint8array')],[0,3,255,8]);const meta=JSON.parse(await zip.file('metadata.json').async('string'));assert.equal(meta.physics.fixed_step_s,1/120);assert.ok((await zip.file('data.csv').async('string')).includes('slip_left_ratio\n0.25'));});
test('reopened recording ZIP validates every manifest hash and rejects tampered or missing files',async()=>{
 const data=await datasetZip({csv:csvText(['run_id','frame_id','sim_time_s','image'],[['qa','frame0',0,'images/f.png']]),metadata:{sample_rate_hz:4},images:[['images/f.png',new Uint8Array([137,80,78,71,0,1,2])]]});
 const result=await verifyDatasetZip(data);assert.equal(result.verified,true);assert.equal(result.images,1);assert.ok(result.files>=10);
 const zip=await JSZip.loadAsync(data);zip.file('images/f.png',new Uint8Array([0]));await assert.rejects(verifyDatasetZip(await zip.generateAsync({type:'uint8array'})),/verification failed/);zip.remove('images/f.png');await assert.rejects(verifyDatasetZip(await zip.generateAsync({type:'uint8array'})),/missing/);
});
test('record icon and label clicks stop recording before one automatic export; failed export preserves buffers',async()=>{
 let recording=false,busy=false,cleared=0,exported=0,ok=true;const record={},exportButton={},clear={},order=[];
 wireRecordingControls({record,exportButton,clear,isRecording:()=>recording,isBusy:()=>busy,setRecording:on=>{recording=on;order.push(on?'start':'stop')},exportData:async()=>{assert.equal(recording,false);exported++;order.push('export');return ok},clearData:()=>cleared++});
 await record.onclick({target:{tagName:'I'}});assert.equal(recording,true);await record.onclick({target:{tagName:'B'}});assert.deepEqual(order,['start','stop','export']);assert.equal(exported,1);
 await record.onclick();await exportButton.onclick();assert.equal(exported,2);assert.equal(recording,false);
 await record.onclick();const beforeClear=cleared;ok=false;await clear.onclick();assert.equal(cleared,beforeClear);assert.equal(recording,false);busy=true;await record.onclick();assert.equal(recording,false);
});
