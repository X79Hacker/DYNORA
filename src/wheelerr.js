import {randomStream} from './app-random.js';
const random=randomStream('wheelerr');
// ===== wheel speed error (Settings): each wheel turns a little faster or slower than commanded, as with real motors / gearboxes =====
// A wheel's real speed = commanded speed × (1 + its error). In a skid-steer robot the two wheels on a side share the ground, so a side
// moves at the mean of its two wheels. Driven by hand (open loop) the robot therefore drifts into a slow curve; on a path the
// controller steers it back, so the path stays the same but the PWM it needs differs per side. Encoders measure the real rotation.
const $=id=>document.getElementById(id);
const KEY='rsw_wheel_err',NAMES=['front left','front right','rear left','rear right'];
// which wheels have the error (FL, FR, RL, RR); the other wheels turn at exactly the commanded speed
const SEL={all:[1,1,1,1],left:[1,0,1,0],right:[0,1,0,1],front:[1,1,0,0],back:[0,0,1,1]},SEL_T={all:'All',left:'Left',right:'Right',front:'Front',back:'Back'};
export const WE={on:false,max:2,sel:'all',e:[0,0,0,0]};   // max: largest error (%); sel: wheels with error; e: error per wheel as a fraction (FL, FR, RL, RR)
try{const s=JSON.parse(localStorage.getItem(KEY)||'{}');if(s&&typeof s==='object'){WE.on=!!s.on;if(s.max>=1&&s.max<=3)WE.max=+s.max;if(SEL[s.sel])WE.sel=s.sel;if(Array.isArray(s.e)&&s.e.length===4)WE.e=s.e.map(Number)}}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(WE))}catch(e){}};
// a new error for each wheel: a size between 1 % and the largest error. Each side is faster or slower at random, and its two wheels
// share that sign, so a chosen side or pair always makes the robot drift (opposite errors on one side would cancel out)
function roll(){const s=[0,1].map(()=>random()<.5?-1:1);WE.e=WE.e.map((_,i)=>s[i%2]*(1+random()*(WE.max-1))/100);save()}
if(WE.e.every(v=>!v))roll();
// error of each wheel after the wheel choice (0 for a wheel without error)
const eff=()=>WE.e.map((v,i)=>v*SEL[WE.sel][i]);
// [left, right] side errors (0 when the option is off)
export const sideErr=()=>{if(!WE.on)return[0,0];const e=eff();return[(e[0]+e[2])/2,(e[1]+e[3])/2]};
export const wheelErrInfo=()=>{const e=eff();return{enabled:WE.on,wheels:WE.sel,max_pct:WE.max,per_wheel_pct:Object.fromEntries(NAMES.map((n,i)=>[n.replace(' ','_'),+(e[i]*100).toFixed(2)])),
 side_pct:{left:+(((e[0]+e[2])/2)*100).toFixed(2),right:+(((e[1]+e[3])/2)*100).toFixed(2)},model:'motor no-load angular speed is scaled by 1 + side error; tyre contact and torque determine ground speed; side errors are averages of the chosen wheel errors'}};

// card in the Settings tab
export function initWheelErr({toast}={}){if($('weCard'))return;
 const card=document.createElement('div');card.className='card';card.id='weCard';
 card.innerHTML=`<h3>Wheel speed error <small>motor mismatch</small></h3>
<label class="chk"><input id="weOn" type="checkbox"> Each wheel turns a little faster or slower than commanded</label>
<label class="pl">Wheels with error <select id="weSel">${Object.keys(SEL).map(k=>`<option value="${k}">${SEL_T[k]}</option>`).join('')}</select></label>
<label class="pl">Largest error <input id="weMax" type="range" min="1" max="3" step="0.1"> <b id="weMaxT"></b></label>
<div class="btns"><button id="weRoll">🎲 New wheel errors</button></div><div id="weVals" class="mut" style="font-size:12px;line-height:1.6"></div>
<p class="mut">Driven by hand the robot drifts into a slow curve; the path controller attempts to correct it, with different PWM per side. Tyre slip can still cause drift. Encoders show wheel rotation.</p>`;
 $('t-set').append(card);
 const pct=v=>(v>=0?'+':'')+(v*100).toFixed(1)+' %';
 const show=()=>{$('weOn').checked=WE.on;$('weSel').value=WE.sel;$('weMax').value=WE.max;$('weMaxT').textContent='±'+WE.max.toFixed(1)+' %';const e=eff(),[l,r]=[(e[0]+e[2])/2,(e[1]+e[3])/2];
  $('weVals').innerHTML=NAMES.map((n,i)=>n+': <b>'+(SEL[WE.sel][i]?pct(e[i]):'exact')+'</b>').join(' · ')+'<br>left side '+pct(l)+', right side '+pct(r)+(WE.on?' → drifts '+(Math.abs(r-l)<1e-4?'straight':r>l?'to the left':'to the right'):' (off)')};
 $('weOn').onchange=e=>{WE.on=e.target.checked;save();show();toast&&toast(WE.on?'Wheel speed error on':'Wheel speed error off')};
 $('weSel').onchange=e=>{WE.sel=e.target.value;save();show();toast&&toast('Wheel speed error: '+SEL_T[WE.sel].toLowerCase()+' wheels')};
 $('weMax').oninput=e=>{WE.max=+e.target.value;roll();show()};
 $('weRoll').onclick=()=>{roll();show();toast&&toast('New wheel errors')};show()}
