// Keep the most recent recording available after an accidental page reload.
// A normal download link always remains available if browser storage is full.
let database=null;
const urls=[];
let revision=0;
function clearLinks(){const el=document.getElementById('datasetDownloads');el?.replaceChildren();for(const url of urls.splice(0))URL.revokeObjectURL(url);}
export function resetRecordingDownloads(){revision++;clearLinks();}
function db(){return database||=(new Promise((resolve,reject)=>{const r=indexedDB.open('dynora-recording-exports',1);r.onupgradeneeded=()=>r.result.createObjectStore('zips',{keyPath:'name'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}))}
async function transact(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('zips',mode);let result;fn(t.objectStore('zips'),value=>result=value);t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)})}
function area(){let el=document.getElementById('datasetDownloads');if(!el){el=document.createElement('div');el.id='datasetDownloads';el.setAttribute('aria-live','polite');document.getElementById('bExp').after(el)}return el}
function link(name,blob,verification,recovered=false){
 const el=area();while(el.children.length>=3){URL.revokeObjectURL(el.firstElementChild.href);el.firstElementChild.remove()}
 const a=document.createElement('a'),url=URL.createObjectURL(blob);urls.push(url);a.href=url;a.download=name;a.className='zip-ready';a.textContent=(recovered?'Restore':'Download')+' ZIP · '+(blob.size/1048576).toFixed(1)+' MB';a.title=name;a.dataset.verified=verification?'true':'false';if(verification)a.title+=' · CRC and SHA-256 verified';el.append(a);return a;
}
export async function publishRecording(name,blob,verification){
 resetRecordingDownloads();const stamp=new Date().toISOString().replace(/[:.]/g,'-');name=name.replace(/\.zip$/i,'_'+stamp+'.zip');const a=link(name,blob,verification);
 let backedUp=true;try{await transact('readwrite',(s,done)=>{s.clear();s.put({name,blob,verification,saved:Date.now()});done(true)})}catch(error){backedUp=false;console.warn('Recording download is ready; browser backup could not be stored',error)}
 // Browsers can decline an asynchronous automatic download. The same URL stays
 // on screen and the retained Blob can be downloaded by a direct user click.
 a.click();return {name,bytes:blob.size,backedUp};
}
export async function restoreRecordingDownloads(){const own=revision;try{const records=await transact('readonly',(s,done)=>{const r=s.getAll();r.onsuccess=()=>done(r.result)});if(own!==revision)return;for(const r of records)link(r.name,r.blob,r.verification,true);if(records.length){const status=document.getElementById('rst');if(status)status.textContent='Recovered verified recording · '+(records[0].verification?.images??'?')+' images. Use Restore ZIP to download.'}}catch{}}
addEventListener('pagehide',()=>urls.forEach(url=>URL.revokeObjectURL(url)));
