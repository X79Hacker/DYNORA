import * as T from 'three';
import {DepthSnapshot,cameraForViewport,insidePolygon} from './depth-core.js';
import {PATCH_COUNT,patchGrid,patchAt,PatchSelection,parsePatchIds,patchCalibration,regionPatchSelections,patchCSV,patchSamplesCSV} from './depth-patch-core.js';
import {DepthBoundaryRenderer} from './depth-boundaries.js';
import {ImageDepthRecorder} from './image-depth-recording.js';
import {depthSnapPNG,SNAP_DEFAULTS,snapOptions,snapPath} from './depth-snap-image.js';
import {projectedBounds,followedRegionTest,heatColor,partIds} from './depth-region-core.js';
import {visibleSnapContours,snapPixelBounds,dominantSnapPart} from './depth-snap-contours.js';
import {reducedBoundaryPreview} from './depth-boundaries.js';
import {DepthRegions} from './depth-regions.js';
import {visibleSelectionOutline} from './depth-visibility.js';
import {prepareRegions,sampleRegions} from './depth-region-capture.js';
import {projectSelectionOutline} from './depth-selection-outline.js';
const SNAP_FIELDS=[['patchSnapScope','scope'],['patchSnapGeometry','geometry'],['patchSnapDashed','dashed'],['patchSnapSelection','showSelection'],['patchSnapLineWidth','lineWidth'],['patchSnapDepthEdges','depthEdges'],['patchSnapClipPatches','clipPatches'],['patchSnapShowOutline','showOutline'],['patchSnapShowGrid','showGrid'],['patchSnapBackground','background'],['patchSnapOutline','outline'],['patchSnapGrid','grid']];
const KEY='dynora-depth-selection-2',PAGE_SIZE=24,MAX_HISTORY_ROWS=10000,MAX_HISTORY_BATCHES=50;
const defaults={mode:'9',hz:5,live:true,showGrid:false,showValues:true,heatmap:true,boundaries:true,boundaryDetail:256,record:true,snap:{...SNAP_DEFAULTS},selectionOutlineVersion:1,calibration:{enabled:false,width_cm:54.4,height_cm:54.4}};
export function initDepthPatches({mount,scene,camera,renderer,exclude=[],clock,range,format,redraw,pause,imageSize,cameraMode=()=>{},frameIndex=()=>0,onObjectMode=()=>{},onClear=()=>{},onRegionSelected=()=>{},isRecording=()=>false}){
 let settings;try{const p=JSON.parse(localStorage.getItem(KEY)||'{}');settings={...defaults,...p,snap:snapOptions(p.selectionOutlineVersion===1?p.snap:{...p.snap,geometry:'selection',scope:'region',dashed:true,showGrid:false,showSelection:false,depthEdges:false,clipPatches:false}),selectionOutlineVersion:1,calibration:patchCalibration(p.calibration)};if(settings.mode!=='adaptive'&&(!Number.isInteger(Number(settings.mode))||Number(settings.mode)<1||Number(settings.mode)>64)||!Number.isInteger(settings.hz)||settings.hz<1||settings.hz>10||![0,128,256,384,768].includes(settings.boundaryDetail))throw Error();}catch{settings={...defaults,calibration:patchCalibration()};}
 mount.innerHTML=`<section class="depth-patches" aria-label="Region first depth measurements"><div class="patch-heading"><strong>Selected region depth</strong><span id="patchCount">Choose a shape first</span></div>
 <p id="patchRegionHint">1. Click an object/part, or draw a Rectangle or Polygon above. 2. Optionally choose patches inside it. The camera stays clear until you select something.</p>
 <div class="patch-region-collection"><label>Region to edit<select id="patchRegionList"></select></label><label><input id="patchAddMode" type="checkbox" checked>Add each new drawing as another region</label><div class="patch-toolbar"><button id="patchRemoveRegion">Remove selected region</button><button id="patchClearRegions">Clear all regions</button></div><small>Use the checkboxes below to include regions in live depth and snaps. This dropdown only chooses which region to edit. Up to 16 regions; uncheck Add to replace one.</small></div>
 <div class="patch-live-board"><strong>Choose regions · live + snap</strong><output id="patchRegionBatchStatus" aria-live="polite">Draw regions, then check which to measure.</output><div class="patch-region-scroll"><table aria-label="Choose regions for live depth and snaps"><thead><tr><th>Use</th><th>Region</th><th>Range</th><th>Z depth</th><th>State</th></tr></thead><tbody id="patchRegionSummary"></tbody></table></div><div class="patch-toolbar"><button id="patchIncludeAll">Check all</button><button id="patchIncludeNone">Uncheck all</button><button id="patchIncludeOnly">Only edited region</button></div><small>Checked = green outline, live patches and new snaps. Unchecked = saved only. Check several to update them together.</small></div>
 <div class="patch-toolbar"><button id="patchDiscover">Discover visible parts</button><button id="patchClearRegion">Clear target</button><button id="patchMeasure">Measure checked now</button></div>
 <div class="patch-options"><label><input id="patchLive" type="checkbox">Live depth · checked regions</label><label><input id="patchHeatmap" type="checkbox">Sampled heatmap</label><label><input id="patchBoundaries" type="checkbox">Dotted part boundaries</label><label><input id="patchShowValues" type="checkbox">On-screen depths</label></div>
 <div class="patch-settings patch-primary-settings"><label>Samples per patch<select id="patchSamples">${Array.from({length:64},(_,i)=>`<option value="${i+1}">${i+1}${i===0?' · centre':''}</option>`).join('')}<option value="adaptive">9–25 · adaptive</option></select></label><label>Live updates / second<select id="patchHz">${Array.from({length:10},(_,i)=>`<option>${i+1}</option>`).join('')}</select></label><label>Boundary detail<select id="patchBoundaryDetail"><option value="128">1 · light · 128 px</option><option value="256">2 · balanced · 256 px</option><option value="384">3 · finer · 384 px</option><option value="768">4 · high · 768 px</option><option value="0">Source pixels · costly</option></select></label></div>
 <div class="patch-recording"><label class="depth-check"><input id="patchRecord" type="checkbox">Record fresh patch depth with every image</label><button id="patchSync5">Set images + telemetry to 5 Hz</button><fieldset class="snap-options"><legend>Snap: your selected boundary · snaps/</legend><label class="snap-scope">Snap covers<select id="patchSnapScope"><option value="object">Visible object below the latest shape · follows it</option><option value="region">Only the measured region</option></select></label><div class="patch-options"><label><input id="patchSnapShowOutline" type="checkbox">Selected outline</label><label><input id="patchSnapShowGrid" type="checkbox">Grid lines</label></div><label>Outline geometry<select id="patchSnapGeometry"><option value="selection">Your selected boundary · follows the surface</option><option value="surface">All visible object edges · optional</option></select></label><label>Line width · source pixels<select id="patchSnapLineWidth"><option>1</option><option>2</option><option>3</option><option>4</option></select></label><div class="patch-options"><label><input id="patchSnapDashed" type="checkbox">Dashed lines</label><label><input id="patchSnapSelection" type="checkbox">Include latest selection border</label><label><input id="patchSnapDepthEdges" type="checkbox">Self-occlusion / depth-gap detail</label><label><input id="patchSnapClipPatches" type="checkbox">Only selected patches</label></div><button id="patchSnapPair" type="button">Snapshot RGB + outline / compare</button><small>Default: only your green dashed selection on white. Visible border sections stay drawn as the camera moves. Frame-clipped sections stay open.</small><div class="snap-colors"><label>Background<input id="patchSnapBackground" type="color"></label><label>Outline<input id="patchSnapOutline" type="color"></label><label>Grid<input id="patchSnapGrid" type="color"></label></div></fieldset><small id="patchSyncStatus">Image-linked CSV and one snap image per camera image are saved in the recording ZIP, even with this panel closed.</small></div>
 <output id="patchStatus" aria-live="polite">Choose the object or shape you want to measure.</output><small id="patchHeatLegend"></small>
 <div class="patch-toolbar"><button id="patchChoose">Choose patches inside target</button><button id="patchShapes">Back to shape selection</button></div>
 <div id="patchFilterControls" hidden><p>Fixed 16 rows × 16 columns. Click to toggle; drag replaces the patch list. Ctrl-drag adds; Shift-drag removes. Only target pixels in chosen patches are measured.</p><div class="patch-toolbar"><button id="patchAll">All patches in target</button><button id="patchClear">Clear patches</button></div><div class="patch-id-entry"><label>Patch IDs<input id="patchIds" placeholder="1, 4, 20-40"></label><button id="patchApplyIds">Apply IDs</button></div></div>
 <div class="patch-options"><label><input id="patchShowGrid" type="checkbox">Show target grid</label><label><input id="patchPause" type="checkbox">Pause when selecting patches</label></div>
 <div class="patch-results"><table aria-label="Depth inside selected patches"><thead><tr><th>Patch</th><th>Median depth</th><th>Samples</th><th>State</th></tr></thead><tbody id="patchRows"></tbody></table></div><div class="patch-pages"><button id="patchPrev">←</button><span id="patchPage">0 results</span><button id="patchNext">→</button></div><div id="patchDetails" class="patch-details">Choose a result to inspect its parts.</div>
 <div class="patch-toolbar"><button id="patchExport">Export checked patch CSV</button><button id="patchExportSamples">Export checked sample CSV</button><button id="patchExportHistory">Export history</button></div><div id="patchDownloads"></div>
 <details id="patchAdvanced" class="patch-advanced"><summary>Surface attachment & measurement notes</summary><label class="depth-check"><input id="patchFollow" type="checkbox">Follow the attached rigid surface selection</label><p>Preview contours and heatmap are visual guides. Exported depths are actual visible-triangle samples. Tiny or occluded parts may be missed by sparse sampling.</p></details>
 <details class="patch-calibration"><summary>Reference plane calibration</summary><label class="depth-check"><input id="patchCalibrated" type="checkbox">Known dimensions across the entire image</label><div class="patch-settings"><label>Image width · cm<input id="patchReferenceWidth" type="number" min="0.001" step="any"></label><label>Image height · cm<input id="patchReferenceHeight" type="number" min="0.001" step="any"></label></div><p>54.4 × 54.4 cm across a square reference image gives 3.4 × 3.4 cm per patch. This describes one plane; depth comes from geometry.</p></details></section>`;
 const $=id=>mount.querySelector('#'+id),boundaryRenderer=new DepthBoundaryRenderer(renderer,scene,{exclude});
 const snapshot=()=>{cameraMode(true);try{return new DepthSnapshot(scene,{exclude,maxRange:range(),indexed:true});}finally{cameraMode(false)}};
 const renderBoundary=(...args)=>{cameraMode(true);try{return boundaryRenderer.render(...args);}finally{cameraMode(false)}};
 const regions=new DepthRegions(16),filters=new Map(),liveVisible=new Map(),boardRows=new Map();let regionListKey='';
 let grid=null,region=null,eligible=[],userIds=null,patchInput=false,active=false,drag=null,discovering=false,latest=null,liveBatch=null,busy=false,generation=0,serial=0,lastStart=-Infinity,lastPaint=0,lastDiscovery=-Infinity,progress=null,page=0,focusId=null,error=null,history=[],historyRows=0,dropped=0,mask=null,heatCanvas=null,lastRate=null,manualRequested=false,selectionRevision=0;
 for(const[id,key]of [['patchLive','live'],['patchShowGrid','showGrid'],['patchShowValues','showValues'],['patchHeatmap','heatmap'],['patchBoundaries','boundaries']])$(id).checked=settings[key];
 $('patchRecord').checked=settings.record;for(const[id,key]of SNAP_FIELDS)$(id)[typeof settings.snap[key]==='boolean'?'checked':'value']=settings.snap[key];$('patchSamples').value=settings.mode;$('patchHz').value=settings.hz;$('patchBoundaryDetail').value=settings.boundaryDetail;$('patchCalibrated').checked=settings.calibration.enabled;$('patchReferenceWidth').value=settings.calibration.width_cm;$('patchReferenceHeight').value=settings.calibration.height_cm;
 const metric=()=>mount.closest('.depth-panel').querySelector('#depthMetric').value,statKey=()=>metric()==='range_m'?'range':'z_depth';
 const selected=()=>eligible.filter(s=>!userIds||userIds.has(s.id));
 const ids=()=>selected().map(s=>s.id);
 const persist=()=>localStorage.setItem(KEY,JSON.stringify(settings));
 function syncSnapControls(){const selected=settings.snap.geometry==='selection';for(const id of ['patchSnapScope','patchSnapSelection','patchSnapDepthEdges','patchSnapClipPatches'])$(id).closest('label').hidden=selected;}
 syncSnapControls();persist();
 function invalidate(){generation++;latest=null;liveBatch=null;progress=null;mask=null;heatCanvas=null;error=null;lastStart=-Infinity;lastRate=null;page=0;render();redraw();}
 function ensureGrid(){const [w,h]=imageSize();if(!grid||grid.width!==w||grid.height!==h){grid=patchGrid(w,h);if(region?.polygon&&!region.follow)eligible=regionPatchSelections(grid,region.polygon);invalidate();}}
 function syncRegionList(){const key=regions.revision+':'+regions.activeId;if(key===regionListKey)return;regionListKey=key;$('patchRegionList').replaceChildren(...regions.items.map(r=>new Option('#'+r.region_id+' · '+(r.label||'Selected region'),r.region_id)));$('patchRegionList').value=String(regions.activeId??'');$('patchRemoveRegion').disabled=!regions.items.length;$('patchClearRegions').disabled=!regions.items.length;}
 function saveFilter(){if(region)filters.set(region.region_id,userIds?new Set(userIds):null);}
 function focusReading(){latest=liveBatch?.region_readings.find(r=>r.region_id===region?.region_id)||null;const polygon=latest?.projected_region_polygon||(region?.follow?projectSelectionOutline(scene,cameraForViewport(camera,grid.width,grid.height),region).coverage_polygon:region?.polygon);eligible=polygon?regionPatchSelections(grid,polygon):[];}
 function useRegion(value,{changed=false}={}){region=value;userIds=region?filters.get(region.region_id)||null:null;patchInput=false;discovering=false;page=0;focusId=null;ensureGrid();$('patchFollow').disabled=!region?.local_to_clip;$('patchFollow').checked=!!region?.follow;if(changed)invalidate();focusReading();render();redraw();}
 function setRegion(value){if(!value){useRegion(null);return;}try{const item=regions.commit(value,{replace:!$('patchAddMode').checked});selectionRevision=regions.revision;liveVisible.delete(item.region_id);useRegion(item,{changed:true});}catch(e){error=e.message;status();}}
 function removeActive(){if(!region)return;const id=region.region_id;regions.remove(id);filters.delete(id);liveVisible.delete(id);selectionRevision=regions.revision;useRegion(regions.active,{changed:true});}
 function resetSelections(){regions.clear();filters.clear();liveVisible.clear();history=[];historyRows=0;dropped=0;manualRequested=false;drag=null;focusId=null;selectionRevision=regions.revision;useRegion(null,{changed:true});}
 const capturedRegions=()=>regions.snapshotIncluded().map(r=>({...r,patch_ids:filters.get(r.region_id)?[...filters.get(r.region_id)]:null}));
 $('patchRegionList').onchange=()=>{saveFilter();useRegion(regions.select(Number($('patchRegionList').value)));onRegionSelected();};
 $('patchRemoveRegion').onclick=()=>onClear();$('patchClearRegions').onclick=()=>{regions.clear();filters.clear();liveVisible.clear();selectionRevision=regions.revision;useRegion(null,{changed:true});onClear();};

 function changeIncluded(ids){
  saveFilter();const keep=new Set(ids);
  for(const item of regions.items)regions.setIncluded(item.region_id,keep.has(item.region_id));
  selectionRevision=regions.revision;liveVisible.clear();invalidate();focusReading();render();redraw();
 }
 $('patchIncludeAll').onclick=()=>changeIncluded(regions.items.map(r=>r.region_id));
 $('patchIncludeNone').onclick=()=>changeIncluded([]);
 $('patchIncludeOnly').onclick=()=>changeIncluded(region?[region.region_id]:[]);
 function renderRegionBoard(){
  const body=$('patchRegionSummary'),readings=new Map((liveBatch?.region_readings||[]).map(r=>[r.region_id,r]));
  for(const[id,row]of boardRows)if(!regions.items.some(r=>r.region_id===id)){row.tr.remove();boardRows.delete(id);}
  for(const item of regions.items){
   let row=boardRows.get(item.region_id);
   if(!row){
    const tr=document.createElement('tr'),check=document.createElement('input'),button=document.createElement('button'),cells=Array.from({length:5},()=>document.createElement('td'));
    check.type='checkbox';check.className='patch-region-include';check.dataset.regionId=item.region_id;check.setAttribute('aria-label','Include region '+item.region_id+' in live depth and snaps');
    check.onchange=()=>changeIncluded(regions.items.filter(r=>r.region_id===item.region_id?check.checked:r.included!==false).map(r=>r.region_id));
    button.onclick=()=>{saveFilter();useRegion(regions.select(item.region_id));onRegionSelected();};
    cells[0].append(check);cells[1].append(button);tr.append(...cells);body.append(tr);row={tr,check,button,cells};boardRows.set(item.region_id,row);
   }
   const {tr,check,button,cells}=row,included=item.included!==false,reading=included?readings.get(item.region_id):null;
   tr.dataset.regionId=item.region_id;tr.dataset.active=String(item.region_id===region?.region_id);tr.dataset.included=String(included);check.checked=included;
   for(const [key,value]of Object.entries({batchId:reading?liveBatch.id:'',sourceFrame:reading?liveBatch.source_frame_index:'',simTime:reading?liveBatch.sim_time_s:''}))tr.dataset[key]=value;
   button.textContent='#'+item.region_id+' · '+(item.label||'Region');button.title=button.textContent;
   const compact=value=>Number.isFinite(value)?mount.closest('.depth-panel').querySelector('#depthUnits').value==='cm'?(value*100).toFixed(1)+'cm':value.toFixed(3)+'m':'—';
   cells[2].textContent=compact(reading?.summary.range?.median_m);cells[2].title=format(reading?.summary.range?.median_m);cells[3].textContent=compact(reading?.summary.z_depth?.median_m);cells[3].title=format(reading?.summary.z_depth?.median_m);
   const state=!included?'Unchecked':!reading?'Waiting':reading.status==='disabled'?'Disabled':reading.summary.count?'Visible':reading.selection_outline.status==='occluded'?'Blocked':!reading.projected_region_polygon?'Outside view':!reading.patches.length?'No patches':'No sample';
   cells[4].textContent=state;tr.dataset.state=state;
  }
  for(const id of ['patchIncludeAll','patchIncludeNone'])$(id).disabled=!regions.items.length;
  $('patchIncludeOnly').disabled=!region;
 }

 function status(){
  $('patchCount').textContent=region?'#'+region.region_id+' · '+ids().length+' / 256 patches · '+regions.included.length+'/'+regions.items.length+' checked':'Choose a shape first';
  let text=error||(region?.included===false?'Unchecked: saved for later. Check Use to include it in live depth and new snaps.':!region?(discovering?'Visible parts are outlined. Click a part to select it.':'Choose an Object/Part, Rectangle or Polygon first.'):progress?'Sampling '+progress.completed+'/'+progress.total+' patches · '+progress.attempted+' rays…':!ids().length?'This region has no selected patches or is outside view. Other checked regions continue updating.':latest?`${settings.live?'Live region':'Snapshot'} · batch ${latest.id} · simulation ${latest.sim_time_s.toFixed(3)} s\n${latest.attempted_samples} rays · ${latest.valid_samples} valid · ${latest.elapsed_ms.toFixed(0)} ms batch latency\n${latest.summary.count?'Range '+format(latest.summary.range.median_m)+' · Z '+format(latest.summary.z_depth.median_m):'No visible target sample'}\nCaptured ${Math.max(0,(performance.now()-latest.completed_at_ms)/1000).toFixed(1)} s ago${latest.boundary_error?' · boundary preview unavailable':''}`:'Preparing selected region…');
  $('patchStatus').textContent=text;const stats=recorder.report();$('patchSyncStatus').textContent=`Image-linked depth: ${stats.images} image records · ${stats.pending} pending · ${stats.deferred_capture_opportunities} deferred capture opportunities${stats.capacity_reached?' · memory limit: export and clear to continue':''}. Recording ignores the live preview rate.`;
  $('patchRegionBatchStatus').textContent=!regions.included.length?(regions.items.length?'No regions checked · new snaps have no selected outline.':'Draw regions, then check which to measure.'):liveBatch?(isRecording()?'Recorded frame':settings.live?'Live together':'Last measurement')+' · '+liveBatch.region_count+' checked / '+regions.items.length+' saved · batch '+liveBatch.id+' · t='+liveBatch.sim_time_s.toFixed(3)+' s'+(busy?' · updating…':''):regions.included.length+' checked / '+regions.items.length+' saved · '+(busy?'measuring together…':'waiting for a measurement');
 }
 function renderDetails(){const p=latest?.patches.find(p=>p.patch_id===focusId),el=$('patchDetails');el.replaceChildren();if(!p){el.textContent='Choose a result to inspect its parts.';return;}const title=document.createElement('strong');title.textContent=`Patch ${p.patch_id} · row ${p.row}, column ${p.column}\nSource pixels [${p.pixel_bounds.join(', ')}), upper bounds excluded`;el.append(title);for(const s of p.surfaces){const row=document.createElement('p');row.textContent=`${s.surface} · ${s.count} samples\nRange ${format(s.range.median_m)} · Z ${format(s.z_depth.median_m)}\nSample Z min/max ${format(s.z_depth.min_m)} / ${format(s.z_depth.max_m)}`;el.append(row);}if(!p.surfaces.length)el.append(document.createTextNode('No valid target sample. It may be occluded, outside range, or missed by sparse sampling.'));}
 function render(){
  syncRegionList();const chosen=ids(),lookup=new Map((latest?.patches||[]).map(p=>[p.patch_id,p]));page=Math.max(0,Math.min(page,Math.ceil(chosen.length/PAGE_SIZE)-1));$('patchRows').replaceChildren();
  for(const id of chosen.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)){const p=lookup.get(id),tr=document.createElement('tr'),cells=Array.from({length:4},()=>document.createElement('td')),b=document.createElement('button');b.textContent='#'+id;b.onclick=()=>{focusId=id;renderDetails();redraw();};cells[0].append(b);cells[1].textContent=p?.status==='mixed'?'Mixed parts':format(p?.[statKey()]?.median_m);cells[2].textContent=p?`${p.valid_samples}/${p.attempted_samples}`:'—';cells[3].textContent=p?.status||'Pending';tr.dataset.state=p?.status||'pending';tr.append(...cells);$('patchRows').append(tr);}
  $('patchPage').textContent=chosen.length?`${page*PAGE_SIZE+1}–${Math.min(chosen.length,(page+1)*PAGE_SIZE)} / ${chosen.length}`:'0 results';$('patchPrev').disabled=page===0;$('patchNext').disabled=(page+1)*PAGE_SIZE>=chosen.length;
  for(const id of ['patchChoose','patchShowGrid','patchClearRegion'])$(id).disabled=!region;$('patchMeasure').disabled=!regions.included.length;
  $('patchFilterControls').hidden=!patchInput&&!userIds;$('patchShapes').hidden=!patchInput;$('patchChoose').classList.toggle('on',patchInput);
  $('patchExport').disabled=$('patchExportSamples').disabled=!liveBatch;$('patchExportHistory').disabled=!history.length;
  $('patchRegionHint').textContent=region?`${region.kind==='object'?'Object / part':region.follow?'Attached surface':'Image region'}: ${region.label||'selected area'}. ${patchInput?'Choose cells now; the target mask stays in place.':'Draw another shape any time, or optionally choose patches below.'}`:'1. Click an object/part, or draw a Rectangle or Polygon above. 2. Optionally choose patches inside it.';
  status();renderRegionBoard();renderDetails();const stats=liveBatch?.summary?.[statKey()];$('patchHeatLegend').textContent=settings.heatmap&&stats?'Checked-region sample heatmap: blue '+format(stats.min_m)+' → red '+format(stats.max_m):'';
 }
 async function buildHeat(preview,batch,cam,cancelled){
  if(!preview||!settings.heatmap||!batch.samples.length)return null;
  const canvas=document.createElement('canvas');canvas.width=preview.width;canvas.height=preview.height;const ctx=canvas.getContext('2d'),data=ctx.createImageData(canvas.width,canvas.height),bins=new Map(),key=metric(),stats=batch.summary[statKey()],lo=stats.min_m,hi=stats.max_m;
  const contexts=new Map(batch.regions.map(r=>[r.region_id,{region:r,accept:followedRegionTest({...r,face_ids:null,surface_parts:r.surface_parts?.map(p=>({...p,face_ids:null}))})}]));
  for(const sample of batch.samples){const id=sample.patch_id+':'+sample.mesh_id;let list=bins.get(id);if(!list){list=[];bins.set(id,list);}list.push(sample);}
  const pv=new T.Vector3(),eye=cam.getWorldPosition(new T.Vector3()),forward=new T.Vector3(0,0,-1).applyQuaternion(cam.quaternion),inverseByPart=new Map();let since=performance.now();
  for(let y=0;y<preview.height;y++){
   if(cancelled())throw new DOMException('Selection changed','AbortError');
   for(let x=0;x<preview.width;x++){
    const i=y*preview.width+x,part=preview.parts.get(preview.ids[i]);if(!part)continue;
    const u=preview.bounds[0]+(x+.5)/preview.width*(preview.bounds[2]-preview.bounds[0]),v=preview.bounds[1]+(y+.5)/preview.height*(preview.bounds[3]-preview.bounds[1]),cell=patchAt(grid,u,v),samples=bins.get(cell.id+':'+part.mesh_id);if(!samples)continue;
    let local=null,nearest=null,distance=Infinity;const accepted=new Map();
    for(const sample of samples){let ok=accepted.get(sample.region_id);if(ok===undefined){const context=contexts.get(sample.region_id),r=context.region;ok=true;
      if(r.kind==='region'&&!r.follow)ok=insidePolygon(u,v,r.polygon);
      else if(r.follow&&r.local_to_clip){if(!local){let inv=inverseByPart.get(part.id);if(!inv){inv=new T.Matrix4().fromArray(part.matrix_world).invert();inverseByPart.set(part.id,inv);}pv.set(u*2-1,1-v*2,.5).unproject(cam).sub(eye).normalize();const denom=pv.dot(forward);if(denom<=0)continue;local=pv.multiplyScalar(preview.z[i]/denom).add(eye).applyMatrix4(inv).toArray();}ok=context.accept({mesh_id:part.mesh_id,local_point_m:local});}accepted.set(sample.region_id,ok);
     }if(!ok)continue;const d=(sample.u-u)**2+(sample.v-v)**2;if(d<distance){distance=d;nearest=sample;}
    }
    if(nearest)data.data.set([...heatColor((nearest[key]-lo)/Math.max(1e-9,hi-lo)),135],i*4);
   }
   if(performance.now()-since>2){await new Promise(r=>setTimeout(r,0));since=performance.now();}
  }
  ctx.putImageData(data,0,0);return canvas;
 }
 function acceptLiveBatch(reading,{preview=null,heat=null,retainHistory=false}={}){
  liveBatch=reading;mask=preview;heatCanvas=heat;
  for(const batch of reading.region_readings){Object.assign(batch,{id:reading.id,completed_at_ms:reading.completed_at_ms,elapsed_ms:reading.elapsed_ms,sampled_at_iso:reading.sampled_at_iso,camera_world_matrix:reading.camera_world_matrix,projection_matrix:reading.projection_matrix,actual_update_hz:reading.actual_update_hz});if(batch.selection_outline.visible_parts)liveVisible.set(batch.region_id,batch.selection_outline.visible_parts);}
  focusReading();
  if(retainHistory){const{samples,region_readings,...summary}=reading;history.push(summary);historyRows+=summary.patches.reduce((n,p)=>n+Math.max(1,p.surfaces.length),0);while(history.length>MAX_HISTORY_BATCHES||historyRows>MAX_HISTORY_ROWS){const old=history.shift();historyRows-=old.patches.reduce((n,p)=>n+Math.max(1,p.surfaces.length),0);dropped++;}}
 }
 async function measure(){
  if(!active||busy||!regions.included.length)return;ensureGrid();
  const own=generation,started=performance.now(),simTime=clock(),sampledAt=new Date().toISOString(),capturedFrame=frameIndex(),cam=cameraForViewport(camera,grid.width,grid.height),definitions=capturedRegions(),mode=settings.mode,calibration=structuredClone(settings.calibration),cancelled=()=>own!==generation||!active||isRecording();let query;
  busy=true;lastStart=started;error=null;
  try{
   query=snapshot();const prepared=prepareRegions(query,cam,definitions,grid),geometry=query.meshes.filter(m=>!m.userData.frozenGeometry).map(m=>[m.userData.original,m.geometry,m.geometry.attributes.position,m.geometry.attributes.position.version,m.geometry.index,m.geometry.index?.version]);let preview=null,previewError=null;
   // One optional GPU mask is captured before yielding, matching this batch's frozen scene.
   if(settings.boundaries||settings.heatmap){const points=prepared.flatMap(r=>r.polygon||[]);if(points.length)try{const bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];preview=renderBoundary(cam,grid.width,grid.height,{bounds,maxEdge:settings.boundaryDetail});}catch(e){previewError=e.message;}}
   const reading=await sampleRegions(query,cam,grid,prepared,{mode,simTime,sourceFrame:capturedFrame,calibration,cancelled,onProgress:p=>{progress=p;if(performance.now()-lastPaint>150){lastPaint=performance.now();status();}}});
   if(cancelled())return;
   if(geometry.some(([o,g,p,v,index,version])=>o.geometry!==g||g.attributes.position!==p||p.version!==v||g.index!==index||index?.version!==version))throw Error('Geometry changed; take a fresh measurement');
   const heat=await buildHeat(preview,reading,cam,cancelled);if(cancelled())return;
   const end=performance.now();Object.assign(reading,{id:++serial,sampled_at_iso:sampledAt,camera_world_matrix:cam.matrixWorld.toArray(),projection_matrix:cam.projectionMatrix.toArray(),selection_revision:regions.revision,selected_region_ids:definitions.map(r=>r.region_id),saved_region_count:regions.items.length,selection_policy:'Only explicitly checked regions, frozen at acquisition',completed_at_ms:end,elapsed_ms:end-started,actual_update_hz:lastRate?1000/(end-lastRate):null,boundary_error:previewError,boundary_preview:preview?{width:preview.width,height:preview.height,bounds:preview.bounds,precision:preview.precision}:null});lastRate=end;
   acceptLiveBatch(reading,{preview,heat,retainHistory:true});
  }catch(e){if(own===generation&&e.name!=='AbortError')error=e.message;}
  finally{query?.dispose();busy=false;if(own===generation){progress=null;render();redraw();}}
 }
 function prepareImageCapture(context){
  const definitions=capturedRegions(),savedRegionCount=regions.items.length,withDepth=settings.record&&definitions.length>0,g=patchGrid(context.width,context.height),options=snapOptions(settings.snap),mode=settings.mode,calibration=structuredClone(settings.calibration),own=generation,capturedRevision=regions.revision,activeId=region?.region_id,cam=cameraForViewport(camera,g.width,g.height),started=performance.now();let query=null;
  try{
   if(definitions.length)query=snapshot();const prepared=prepareRegions(query||scene,cam,definitions,g),native=new Map(),targets=new Map();
   if(options.geometry==='surface')for(const item of prepared){let targetIds=item.region.mesh_ids||null;if(options.scope==='object'&&targetIds?.length)targetIds=partIds(scene,targetIds[0],true);const box=options.scope==='object'&&targetIds?.length?projectedBounds(query,cam,targetIds):item.polygon,bounds=options.scope==='object'&&!targetIds?.length?[0,0,g.width,g.height]:snapPixelBounds(box,g.width,g.height);let mask=null;if(bounds&&item.polygon)mask=renderBoundary(cam,g.width,g.height,{bounds:[bounds[0]/g.width,bounds[1]/g.height,bounds[2]/g.width,bounds[3]/g.height],pixelBounds:bounds,maxEdge:0,contours:false});if(item.polygon&&!mask)throw Error('Native contour capture unavailable');if(options.scope==='object'&&mask&&!targetIds?.length){const id=dominantSnapPart(mask,item.polygon);targetIds=id?partIds(scene,id,true):[];}native.set(item.region.region_id,mask);targets.set(item.region.region_id,targetIds);}
   return{dispose:()=>query?.dispose(),sample:async()=>{
    const reading=await sampleRegions(query,cam,g,prepared,{withDepth,mode,simTime:context.capture_sim_s,sourceFrame:context.source_frame_index,calibration,contours:options.geometry==='surface'?item=>visibleSnapContours(native.get(item.region.region_id),{polygon:item.polygon,scope:options.scope,targetIds:targets.get(item.region.region_id),grid:g,patchIds:options.clipPatches?item.chosen.map(p=>p.id):null,depthEdges:options.depthEdges}):null});
    reading.selected_region_ids=definitions.map(r=>r.region_id);reading.saved_region_count=savedRegionCount;reading.selection_policy='Only explicitly checked regions, frozen at acquisition';reading.patch_status=!definitions.length?'no_region':!withDepth?'disabled':null;reading.snap_options=options;reading.snap_camera=structuredClone(context.camera||{});reading.snap_pixel_aligned=context.rgb_pixel_aligned!==false||!!context.camera?.D?.some(v=>v)&&!context.image_effects?.blur&&!context.camera_frozen;
    reading.id=++serial;reading.sampled_at_iso=context.sampled_at_iso;reading.camera_world_matrix=cam.matrixWorld.toArray();reading.projection_matrix=cam.projectionMatrix.toArray();reading.selection_revision=capturedRevision;reading.region=definitions.find(r=>r.region_id===activeId)||definitions[0]||null;reading.projected_region_polygon=prepared.find(r=>r.region.region_id===activeId)?.polygon||prepared[0]?.polygon||null;reading.completed_at_ms=performance.now();reading.elapsed_ms=reading.completed_at_ms-started;
    for(const batch of reading.region_readings){batch.id=reading.id;batch.sampled_at_iso=reading.sampled_at_iso;}
    if(own===generation){acceptLiveBatch(reading);if(active){render();redraw();}}
    return reading;
   }};
  }catch(error){query?.dispose();throw error;}
 }

 const snap=(reading,c)=>depthSnapPNG(reading,{width:c.width,height:c.height,...reading.snap_options});
 const recorder=new ImageDepthRecorder({prepare:prepareImageCapture,snap});
 async function captureStandalone(context){const isolated=new ImageDepthRecorder({prepare:prepareImageCapture,snap});const entry=await isolated.capture(context);if(entry.status==='error'||entry.snap_error)throw Error(entry.error||entry.snap_error);return{entry,files:await isolated.files()};}
 $('patchSnapPair').onclick=()=>document.getElementById('bShot')?.click();
 $('patchRecord').onchange=()=>{settings.record=$('patchRecord').checked;persist();};
 for(const[id,key]of SNAP_FIELDS)$(id).oninput=$(id).onchange=()=>{settings.snap={...settings.snap,[key]:$(id).type==='checkbox'?$(id).checked:$(id).value};persist();syncSnapControls();};
 $('patchSync5').onclick=()=>{if(isRecording()){error='Stop recording before changing capture rates.';status();return;}for(const[id,value]of [['sEvery','0.2'],['sHz','5']]){const el=document.getElementById(id);if(el){el.value=value;el.dispatchEvent(new Event('change'));}}status();};
 async function refreshVisibility(){if(!active||busy||!regions.included.length)return;const own=generation,cam=cameraForViewport(camera,grid.width,grid.height),query=snapshot(),cache=new Map();busy=true;lastStart=performance.now();try{for(const item of capturedRegions()){const outline=await visibleSelectionOutline(query,cam,item,projectSelectionOutline(query,cam,item),{width:grid.width,height:grid.height,cache,cancelled:()=>own!==generation||!active});if(own===generation)liveVisible.set(item.region_id,outline.visible_parts);}}catch(e){if(e.name!=='AbortError'&&own===generation)error=e.message;}finally{query.dispose();busy=false;if(own===generation)redraw();}}
 function tick(r){
  if(!active||!r)return;ensureGrid();if(isRecording()){if(performance.now()-lastPaint>300){lastPaint=performance.now();status();}return;}if(manualRequested){if(!busy){manualRequested=false;measure();}return;}const now=performance.now();
  if(discovering&&!region&&!busy&&now-lastDiscovery>500){lastDiscovery=now;try{mask=renderBoundary(cameraForViewport(camera,grid.width,grid.height),grid.width,grid.height,{maxEdge:settings.boundaryDetail});}catch(e){error=e.message;}status();}
  if(regions.included.length&&!busy&&now-lastStart>=1000/settings.hz){if(settings.live)measure();else refreshVisibility();}
  if(now-lastPaint>300){lastPaint=now;status();}
 }
 function sameFrame(cam){return !mask||mask.camera_world_matrix.every((v,i)=>Math.abs(v-cam.matrixWorld.elements[i])<1e-6)&&mask.projection_matrix.every((v,i)=>Math.abs(v-cam.projectionMatrix.elements[i])<1e-6);}
 function draw(ctx,r){
  ensureGrid();const lookup=new Map((latest?.patches||[]).map(p=>[p.patch_id,p])),cam=cameraForViewport(camera,grid.width,grid.height),same=sameFrame(cam),xy=p=>[r.left+p[0]*r.width,r.top+p[1]*r.height];ctx.save();ctx.beginPath();ctx.rect(r.left,r.top,r.width,r.height);ctx.clip();
  if(same&&mask){
   ctx.save();
   if(heatCanvas&&settings.heatmap)ctx.drawImage(heatCanvas,r.left+mask.bounds[0]*r.width,r.top+mask.bounds[1]*r.height,(mask.bounds[2]-mask.bounds[0])*r.width,(mask.bounds[3]-mask.bounds[1])*r.height);
   if(settings.boundaries||discovering){ctx.setLineDash([2,3]);ctx.strokeStyle='#fff2a0';ctx.lineWidth=1.3;for(const[id,segments]of mask.segments){const part=mask.parts.get(id);if(liveBatch?.regions.every(r=>r.mesh_ids?.length)&&!liveBatch.regions.some(r=>r.mesh_ids.includes(part.mesh_id)))continue;const object=scene.getObjectByProperty('uuid',part.mesh_id);if(!object?.parent||!part.matrix_world.every((v,i)=>Math.abs(v-object.matrixWorld.elements[i])<1e-6))continue;ctx.beginPath();for(const path of mask.paths.get(id)||[]){path.forEach((p,i)=>i?ctx.lineTo(...xy(p)):ctx.moveTo(...xy(p)));}ctx.stroke();}ctx.setLineDash([]);}
   ctx.restore();
  }
  if(settings.showGrid){
   const byCell=new Map();
   for(const reading of liveBatch?.region_readings||[])for(const p of reading.patches){let entries=byCell.get(p.patch_id);if(!entries){entries=[];byCell.set(p.patch_id,entries);}entries.push({reading,p});}
   const editable=patchInput&&region?.included!==false?new Set(eligible.map(p=>p.id)):new Set(),picked=new Set(ids());ctx.font='10px system-ui';
   for(const c of grid.cells){
    const entries=byCell.get(c.id)||[];if(!entries.length&&!editable.has(c.id))continue;
    const [x,y]=xy(c.bounds),w=(c.bounds[2]-c.bounds[0])*r.width,h=(c.bounds[3]-c.bounds[1])*r.height,isPicked=entries.length||editable.has(c.id)&&picked.has(c.id);
    ctx.strokeStyle=isPicked?'#46f0bf':'#8ca5b480';ctx.lineWidth=.8;ctx.strokeRect(x+.5,y+.5,w-1,h-1);ctx.fillStyle=isPicked?'#caffeb':'#91a8b6';if(w>22&&h>15)ctx.fillText(c.id,x+3,y+12);
    if(settings.showValues&&w>30&&h>28){let line=0;const cm=mount.closest('.depth-panel').querySelector('#depthUnits').value==='cm';for(const {reading,p}of entries.slice(0,Math.max(1,Math.floor((h-14)/13)))){
      const value=p[statKey()]?.median_m,text='#'+reading.region_id+':'+(p.status==='mixed'?'Mixed':Number.isFinite(value)?(value*(cm?100:1)).toFixed(cm?0:2)+(cm?'cm':'m'):'—'),ty=y+h-5-13*line++;
      ctx.fillStyle='#051820dc';ctx.fillRect(x+2,ty-10,Math.min(w-4,ctx.measureText(text).width+6),13);ctx.fillStyle='#e3fff3';ctx.fillText(text,x+4,ty);
    }}
   }
  }

  const showGuides=mount.closest('.depth-panel').querySelector('#depthGuides').checked,projected=(showGuides||settings.showValues)?regions.included.map(item=>{const checked=liveVisible.get(item.region_id),drawRegion=checked?{...item,surface_parts:checked}:item;return{item,outline:projectSelectionOutline(scene,cam,drawRegion)};}):[];
  if(showGuides)for(const{item,outline}of projected){ctx.save();ctx.translate(r.left,r.top);ctx.beginPath();for(const points of outline.paths)snapPath(ctx,points,r.width,r.height);ctx.setLineDash([6,4]);ctx.strokeStyle='#3af3cb';ctx.lineWidth=item.region_id===region?.region_id?2.1:1.6;ctx.stroke();ctx.setLineDash([]);ctx.restore();}
  if(liveBatch&&settings.showValues){
   const readings=new Map(liveBatch.region_readings.map(b=>[b.region_id,b])),placed=[],right=r.left+r.width,bottom=r.top+r.height;ctx.font='bold 11px system-ui';
   for(const{item,outline}of projected){const batch=readings.get(item.region_id);if(!batch||!outline.paths.length)continue;const bounds=[1,1,0];for(const path of outline.paths)for(const p of path){bounds[0]=Math.min(bounds[0],p[0]);bounds[1]=Math.min(bounds[1],p[1]);bounds[2]=Math.max(bounds[2],p[0]);}const name=(item.label||'Region').slice(0,22),text='#'+item.region_id+' '+name+' · '+(batch.summary.count?'R '+format(batch.summary.range.median_m)+' · Z '+format(batch.summary.z_depth.median_m):'depth unavailable'),w=Math.min(r.width-16,ctx.measureText(text).width+14),h=23;
    let x=Math.max(r.left+8,Math.min(right-w-8,r.left+(bounds[0]+bounds[2])*r.width/2-w/2)),y=Math.max(r.top+37,Math.min(bottom-h-8,r.top+bounds[1]*r.height+6));
    for(let i=0;i<regions.items.length&&placed.some(p=>x<p.x+p.w&&x+w>p.x&&y<p.y+h&&y+h>p.y);i++){y+=h+3;if(y+h>bottom-8)y=r.top+37+(i%2)*(h+3);}
    placed.push({x,y,w});ctx.fillStyle='#051820ec';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#3af3cb';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);ctx.fillStyle=batch.summary.count?'#d2ffec':'#ffd099';ctx.save();ctx.beginPath();ctx.rect(x+4,y,w-8,h);ctx.clip();ctx.fillText(text,x+7,y+15);ctx.restore();
   }
   const time=`${isRecording()?'FRAME':settings.live?'LIVE CHECKED':'SNAP CHECKED'} · ${liveBatch.region_count} regions · batch ${liveBatch.id} · t=${liveBatch.sim_time_s.toFixed(3)} s`;ctx.font='11px system-ui';ctx.fillStyle='#051820e8';ctx.fillRect(r.left+8,r.top+8,Math.min(r.width-16,ctx.measureText(time).width+16),23);ctx.fillStyle='#d2ffec';ctx.fillText(time,r.left+16,r.top+24);
  }
  if(drag){ctx.setLineDash([5,4]);ctx.strokeStyle='#ffd78f';ctx.strokeRect(...xy(drag.start),(drag.end[0]-drag.start[0])*r.width,(drag.end[1]-drag.start[1])*r.height);ctx.setLineDash([]);}
  ctx.restore();
 }
 function handle(type,e,r){
  if(!patchInput||!region)return false;const point=e=>[Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];
  if(type==='click'||type==='dblclick')return true;
  if(type==='pointerdown'&&e.button===0){drag={start:point(e),end:point(e),viewport:r};redraw();return true;}
  if(type==='pointermove'&&drag){drag.end=point(e);redraw();return true;}
  if(type==='pointerup'&&drag){const a=drag.start,b=point(e),d=Math.hypot((b[0]-a[0])*r.width,(b[1]-a[1])*r.height);drag=null;if(!userIds)userIds=new Set(ids());if(d<4){const c=patchAt(grid,...b);if(eligible.some(s=>s.id===c.id)){if(userIds.has(c.id))userIds.delete(c.id);else userIds.add(c.id);}}else{const temp=new PatchSelection(grid);temp.selectRectangle([...a,...b]);if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey)userIds.clear();for(const id of temp.items.keys())if(eligible.some(s=>s.id===id)){if(e.shiftKey)userIds.delete(id);else userIds.add(id);}}if($('patchPause').checked)pause();saveFilter();invalidate();return true;}
  return false;
 }
 function download(name,text){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=name;a.textContent='Download '+name;$('patchDownloads').append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},60000);}
 function historyCSV(){return history.map((b,i)=>{const csv=patchCSV(b);return i?csv.slice(csv.indexOf('\n')+1):csv;}).join('\n');}
 $('patchChoose').onclick=()=>{if(!region)return;patchInput=true;userIds=new Set(ids());settings.showGrid=true;$('patchShowGrid').checked=true;render();redraw();};$('patchShapes').onclick=()=>{patchInput=false;render();redraw();};
 $('patchAll').onclick=()=>{userIds=null;saveFilter();invalidate();};$('patchClear').onclick=()=>{userIds=new Set();saveFilter();invalidate();};
 $('patchApplyIds').onclick=()=>{try{const requested=parsePatchIds($('patchIds').value),available=new Set(eligible.map(s=>s.id));userIds=new Set(requested.filter(id=>available.has(id)));saveFilter();invalidate();if(requested.some(id=>!available.has(id))){error='IDs outside the chosen target were ignored. Patch IDs are always full-image IDs.';status();}}catch(e){error=e.message;status();}};
 $('patchIds').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('patchApplyIds').click();}};
 $('patchDiscover').onclick=()=>{const next=!discovering;if(next){useRegion(null);discovering=true;onObjectMode();lastDiscovery=-Infinity;}else{discovering=false;mask=null;}status();redraw();};$('patchClearRegion').onclick=onClear;$('patchMeasure').onclick=()=>{manualRequested=true;};
 $('patchPrev').onclick=()=>{page--;render();};$('patchNext').onclick=()=>{page++;render();};
 for(const[id,key]of [['patchLive','live'],['patchShowGrid','showGrid'],['patchShowValues','showValues'],['patchHeatmap','heatmap'],['patchBoundaries','boundaries']])$(id).onchange=()=>{settings[key]=$(id).checked;persist();if(key==='live'){generation++;progress=null;lastStart=-Infinity;render();redraw();}else if((key==='heatmap'||key==='boundaries')&&settings[key]&&!mask)invalidate();else{render();redraw();}};
 $('patchSamples').onchange=()=>{settings.mode=$('patchSamples').value;persist();invalidate();};$('patchHz').onchange=()=>{settings.hz=Number($('patchHz').value);persist();lastStart=-Infinity;};$('patchBoundaryDetail').onchange=()=>{settings.boundaryDetail=Number($('patchBoundaryDetail').value);persist();invalidate();};
 $('patchFollow').onchange=()=>{if(region){region.follow=$('patchFollow').checked;invalidate();}};
 for(const id of ['patchCalibrated','patchReferenceWidth','patchReferenceHeight'])$(id).onchange=()=>{try{settings.calibration=patchCalibration({enabled:$('patchCalibrated').checked,width_cm:Number($('patchReferenceWidth').value),height_cm:Number($('patchReferenceHeight').value)});persist();invalidate();}catch(e){error=e.message;status();}};
 $('patchExport').onclick=()=>liveBatch&&download('dynora-depth-patches.csv',patchCSV(liveBatch));$('patchExportSamples').onclick=()=>liveBatch&&download('dynora-depth-patch-samples.csv',patchSamplesCSV(liveBatch));$('patchExportHistory').onclick=()=>download('dynora-depth-patch-history.csv',historyCSV());
 render();
 return{resetSelections,captureStandalone,captureImage:context=>recorder.capture(context),captureReady:()=>recorder.ready(),deferCapture:()=>recorder.defer(),recordingFiles:()=>recorder.files(),clearRecording:()=>recorder.clear(),recordingMetadata:()=>recorder.report(),tick,draw,handle,hasRegion:()=>regions.items.length>0,showValues:()=>settings.showValues,setRegion,removeActive,isMode:()=>patchInput,dragViewport:()=>drag?.viewport,useShapes:()=>{patchInput=false;render();},setMode:()=>{},setActive:on=>{active=on;generation++;progress=null;lastStart=-Infinity;drag=null;discovering=false;render();},invalidate,refresh:()=>{if(liveBatch&&mask&&settings.heatmap){const own=generation,cam=cameraForViewport(camera,grid.width,grid.height),m=new T.Matrix4().fromArray(liveBatch.camera_world_matrix);m.decompose(cam.position,cam.quaternion,cam.scale);cam.updateMatrixWorld(true);cam.projectionMatrix.fromArray(liveBatch.projection_matrix);cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();buildHeat(mask,liveBatch,cam,()=>own!==generation).then(heat=>{if(own===generation){heatCanvas=heat;redraw();}}).catch(()=>{});}render();redraw();},error:m=>{error=m;status();},metadata:()=>({schema:'dynora-depth-selection-2',settings,active,busy,image_recording:recorder.report(),visualization:{heatmap_ready:!!heatCanvas,mask_ready:!!mask},regions:regions.snapshot(),selected_region_ids:regions.included.map(r=>r.region_id),region,interaction:patchInput?'patches':'shapes',grid:grid?{count:256,rows:grid.rows.map(r=>r.columns),source_image_px:[grid.width,grid.height],viewport_px:[grid.width,grid.height],cells:grid.cells}:null,selection:selected(),latest_batch:latest?(({samples,...summary})=>summary)(latest):null,live_batch:liveBatch?{id:liveBatch.id,sim_time_s:liveBatch.sim_time_s,source_frame_index:liveBatch.source_frame_index,region_count:liveBatch.region_count,elapsed_ms:liveBatch.elapsed_ms,actual_update_hz:liveBatch.actual_update_hz}:null,live_regions:liveBatch?.region_readings.map(({samples,...summary})=>summary)||[],boundary_preview:mask?{width:mask.width,height:mask.height,parts:mask.parts.size,segments:[...mask.segments.values()].reduce((n,p)=>n+p.length/4,0),precision:mask.precision}:null,history:{retained_batches:history.length,dropped_batches:dropped}}),files:()=>[['visual/depth-patch-selection.json',JSON.stringify({grid,region,regions:regions.snapshot(),selected_region_ids:regions.included.map(r=>r.region_id),selection:selected(),settings})],...(liveBatch?[['visual/depth-patches.json',JSON.stringify(liveBatch)],['visual/depth-patches.csv',patchCSV(liveBatch)],['visual/depth-patch-samples.csv',patchSamplesCSV(liveBatch)]]:[]),...(history.length?[['visual/depth-patch-history.csv',historyCSV()],['visual/depth-patch-history.json',JSON.stringify(history)],['visual/depth-patch-history-info.json',JSON.stringify({retained_batches:history.length,dropped_batches:dropped,max_batches:MAX_HISTORY_BATCHES,max_rows:MAX_HISTORY_ROWS})]]:[]),...(mask?[['visual/depth-boundaries.json',JSON.stringify({source_image_px:mask.source_image_px,preview_px:[mask.width,mask.height],uv_bounds:mask.bounds,camera_world_matrix:mask.camera_world_matrix,projection_matrix:mask.projection_matrix,precision:mask.precision,parts:[...mask.parts.values()],contours:[...mask.segments].map(([id,uv_segments])=>({id,uv_segments}))})]]:[])]};
}
