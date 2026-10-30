import './style.css';
import {prepareHumans} from './realistic-human.js';
const $=id=>document.getElementById(id),enc=new TextEncoder();
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const rnd=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
async function hash(pw,salt){const k=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:150000},k,256))}
const users=()=>JSON.parse(localStorage.getItem('rsw_users')||'{}');
const pick=()=>new Promise(r=>{const el=$('envPick');el.hidden=false;el.querySelectorAll('[data-env]').forEach(b=>b.onclick=()=>{sessionStorage.setItem('rsw_env',b.dataset.env);el.hidden=true;r(b.dataset.env)})});
async function start(u){sessionStorage.setItem('rsw_user',u);$('auth').remove();const requested=new URLSearchParams(location.search).get('environment');let env=['apartment','canteen','track'].includes(requested)?requested:sessionStorage.getItem('rsw_env')||await pick();sessionStorage.setItem('rsw_env',env);$('envSel').value=env;$('envSel').onchange=e=>{sessionStorage.setItem('rsw_env',e.target.value);const url=new URL(location.href);url.searchParams.set('environment',e.target.value);location.assign(url.href)};const loading=document.createElement('div');loading.className='people-loading';loading.textContent='Loading detailed people from this laptop…';document.body.append(loading);try{await prepareHumans()}catch(error){console.warn('Detailed human assets unavailable',error);loading.textContent='Human asset load failed. Using fallback people; check visual/humans in your extracted download.';loading.classList.add('people-warning');setTimeout(()=>loading.remove(),12000)}if(!loading.classList.contains('people-warning'))loading.remove();if(env==='canteen')await import('./canteen.js');else if(env==='track')await import('./track.js');else await import('./main.js')}
(async()=>{
 if(!crypto.subtle){$('aMsg').textContent='Open via https or localhost (needed for secure login).';return}
 const all=users();if(!Object.keys(all).length){const s=rnd();all.admin={salt:s,hash:await hash('robot123',s)};localStorage.setItem('rsw_users',JSON.stringify(all))}
 if(sessionStorage.getItem('rsw_user'))return start(sessionStorage.getItem('rsw_user')).catch(showFailure);
 let reg=false;
 $('aSwitch').onclick=e=>{e.preventDefault();reg=!reg;$('aGo').textContent=reg?'Create account':'Sign in';$('aSub').textContent=reg?'Create a new account':'Sign in to continue';$('aSwitch').textContent=reg?'Back to sign in':'Create an account';$('aMsg').textContent=''};
 $('aForm').onsubmit=async e=>{e.preventDefault();const u=$('aUser').value.trim().toLowerCase(),p=$('aPass').value,all=users();
  if(reg){if(all[u]){$('aMsg').textContent='Username already exists';return}const s=rnd();all[u]={salt:s,hash:await hash(p,s)};localStorage.setItem('rsw_users',JSON.stringify(all));return start(u).catch(showFailure)}
  if(!all[u]||await hash(p,all[u].salt)!==all[u].hash){$('aMsg').textContent='Wrong username or password';return}start(u).catch(showFailure)};
})();

function showFailure(error){console.error(error);const warning=document.createElement('div');warning.className='render-failure';const title=document.createElement('strong');title.textContent='3D scene could not start';const text=document.createElement('p');text.textContent=/WebGL|context/i.test(error.message)?'This browser could not create a WebGL context. Enable graphics acceleration in Chrome or Edge, restart the browser, and try again. The numerical verification lab works without WebGL.':error.message;const link=document.createElement('a');link.href='./verification.html';link.textContent='Open numerical verification lab';warning.append(title,text,link);document.body.append(warning);}
window.addEventListener('unhandledrejection',event=>{if(/WebGL|context|initialization/i.test(String(event.reason)))showFailure(event.reason)});
