// ===== live narration: plain-language text for what the robot does (start, bends, stops), shared by both environments =====
import * as THREE from 'three';

const $=id=>document.getElementById(id);
const ang=a=>Math.atan2(Math.sin(a),Math.cos(a));
const MOVING=new Set(['CRUISING','TURNING','MANUAL']);

// path = ()=>({curve,t,len,loop}); zone(x,z) names the area; blocker() names what stopped the robot; log(type,text) writes a dataset event
export function initNarrate({scene,robot,path,zone,blocker,manual,log}){
 const box=new THREE.Box3(),tan=new THREE.Vector3(),pt=new THREE.Vector3();
 let prev=null,last='',hold=0,turn=null,list=[];
 const S={show:true,speak:false};try{Object.assign(S,JSON.parse(localStorage.getItem('rsw_narr')||'{}'))}catch(e){}
 const save=()=>{try{localStorage.setItem('rsw_narr',JSON.stringify(S))}catch(e){}};

 // UI: caption over the 3D view + a log card on the Live tab
 const cap=document.createElement('div');cap.id='narr';document.body.append(cap);
 const card=document.createElement('div');card.className='card';card.innerHTML='<h3>Bot narration <small><label><input id="nShow" type="checkbox"> captions</label> <label><input id="nSpeak" type="checkbox"> speak</label></small></h3><div id="nList" class="mut">Waiting for the robot…</div>';
 $('t-live').prepend(card);$('nShow').checked=S.show;$('nSpeak').checked=S.speak;
 $('nShow').onchange=e=>{S.show=e.target.checked;cap.hidden=!S.show;save()};$('nSpeak').onchange=e=>{S.speak=e.target.checked;if(!S.speak)speechSynthesis.cancel();save()};cap.hidden=!S.show;
 function say(text,kind,simT){last=text;list.unshift([simT,text]);list.length=Math.min(list.length,8);
  $('nList').innerHTML=list.map(([t,x],i)=>`<div class="${i?'':'now'}"><b>${t.toFixed(1)} s</b> ${x}</div>`).join('');
  cap.innerHTML=`<span>${{start:'▶',turn:'↪',stop:'⛔',end:'🏁',info:'ℹ'}[kind]||'ℹ'}</span>${text}`;cap.classList.remove('fade');void cap.offsetWidth;cap.classList.add('show');clearTimeout(say.t);say.t=setTimeout(()=>cap.classList.add('fade'),5000);
  if(S.speak&&window.speechSynthesis){const voice=speechSynthesis.getVoices().find(v=>v.localService&&/^en/i.test(v.lang));if(voice){speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text.replace(/°/g,' degrees'));utterance.voice=voice;speechSynthesis.speak(utterance)}}
  log('instruction',text)}

 // nearest labelled object to a point (within 2.5 m), skipping hidden ones
 function nearest(x,z){let best=null,bd=2.5;pt.set(x,.5,z);scene.traverse(o=>{if(!o.userData.label||!o.parent)return;for(let p=o;p;p=p.parent)if(!p.visible)return;
  box.setFromObject(o);if(box.isEmpty())return;const d=box.distanceToPoint(pt);if(d<bd){bd=d;best=o.userData.label}});return best}
 const near=(x,z)=>{const o=nearest(x,z),zn=zone(x,z);return o?'near the '+o+' ('+zn+')':'in the '+zn};
 // walk the path ahead and add up the heading change of the coming bend
 function bend(){const{curve,t,len,loop}=path();if(!curve)return null;const head=u=>{curve.getTangentAt(u,tan);return Math.atan2(-tan.z,tan.x)};
  const U=s=>{const u=t+s/len;return loop?((u%1)+1)%1:Math.max(0,Math.min(u,1))};let h=head(U(-.3)),sum=0,flat=0,s=0,mid=null;   // start a little behind: the turn is noticed once it has begun
  // the bend ends where the path is nearly straight (< 0.3 rad/m) for 0.35 m, or where it starts to curve the other way
  for(s=-.25;s<4;s+=.05){const h2=head(U(s)),d=ang(h2-h);h=h2;if(Math.abs(sum)>.2&&d*sum<0&&Math.abs(d)>.015)break;sum+=d;flat=Math.abs(d)<.015?flat+.05:0;if(!mid&&Math.abs(sum)>.35){curve.getPointAt(U(s),pt);mid=[pt.x,pt.z]}if(Math.abs(sum)>.2&&flat>.35)break;if(!loop&&U(s)>=1)break}
  return{deg:sum*180/Math.PI,dist:s,at:mid||[robot.position.x,robot.position.z]}}
 const sideOf=d=>d>0?'left':'right',round5=d=>Math.round(Math.abs(d)/5)*5;

 let simT=0;
 function step(row,col){const md=row[5],t=simT=+row[1],yaw=col('yaw_deg'),dist=col('dist_travelled_m'),x=robot.position.x,z=robot.position.z;
  if(prev===null){prev=md;say(MOVING.has(md)?'Bot is starting '+near(x,z)+'.':'Bot is ready '+near(x,z)+'.','start',t);return}
  if(md!==prev){
   if(MOVING.has(md)&&!MOVING.has(prev))say(prev==='OBSTACLE_STOP'?'The way is clear. Bot is starting again.':prev==='PAUSED'?'Bot is starting again.':'Bot is starting.','start',t);
   if(md==='OBSTACLE_STOP')say('Bot stopped: '+(blocker()||'an obstacle')+' is in the way.','stop',t);
   if(md==='PAUSED')say('Bot is paused.','stop',t);
   if(md==='IDLE'&&MOVING.has(prev)&&!/^Task \d+ complete/.test(last))say('Bot reached the end of its path '+near(x,z)+'.','end',t);
   if(md==='MANUAL')say('Operator is driving the bot.','info',t);else if(prev==='MANUAL'&&MOVING.has(md))say('Bot is back on its path.','info',t)}
  // bends on the path: predict the full angle when the turn starts
  if(md==='TURNING'&&prev!=='TURNING'&&!(turn&&dist<turn.until)){const b=bend();if(b&&Math.abs(b.deg)>=15){say((Math.abs(b.deg)>=150?'Bot is turning around ('+round5(b.deg)+'° '+sideOf(b.deg)+') ':'Bot is bending '+round5(b.deg)+'° '+sideOf(b.deg)+' at the corner ')+near(b.at[0],b.at[1])+'.','turn',t);turn={until:dist+b.dist+.3}}}
  if(md==='MANUAL'&&manual())manualStep(col,t,yaw,x,z);else M.moving=M.turning=false;
  prev=md}

 // driven by hand the mode stays MANUAL, so narrate from the motion itself: start, reverse, turns (angle at the end), stop, close obstacles
 const M={moving:false,dir:0,turning:false,yaw0:0,still:0,calm:0,warn:-9,t:0};
 function manualStep(col,t,yaw,x,z){const dt=Math.min(.5,Math.max(0,t-M.t));M.t=t;const v=col('v_mps'),w=col('omega_dps'),cm=d=>(d*100).toFixed(0);
  if(Math.abs(v)>.06){M.still=0;const d=Math.sign(v);if(!M.moving||d!==M.dir){M.moving=true;M.dir=d;say((d>0?'Bot is moving forward ':'Bot is reversing ')+near(x,z)+'.','start',t)}}
  else if(M.moving&&Math.abs(v)<.03&&(M.still+=dt)>=.6){M.moving=false;if(!M.turning)say('Bot stopped '+near(x,z)+'.','stop',t)}
  if(!M.turning&&Math.abs(w)>25){M.turning=true;M.calm=0;M.yaw0=yaw;say('Bot is turning '+sideOf(w)+(Math.abs(v)<.05?' on the spot ':' ')+near(x,z)+'.','turn',t)}
  else if(M.turning&&Math.abs(w)<8&&(M.calm+=dt)>=.4){M.turning=false;const d=ang((yaw-M.yaw0)*Math.PI/180)*180/Math.PI;if(Math.abs(d)>=15)say('Bot turned '+round5(d)+'° '+sideOf(d)+' '+near(x,z)+'.','turn',t)}
  else if(M.turning&&Math.abs(w)>=8)M.calm=0;
  const f=col('tof_front_m'),b=col('tof_back_m');
  if(t-M.warn>4){if(v>.05&&f<.35){M.warn=t;say('Careful: '+(blocker()||'an obstacle')+' is '+cm(f)+' cm ahead.','stop',t)}else if(v<-.05&&b<.35){M.warn=t;say('Careful: something is '+cm(b)+' cm behind the bot.','stop',t)}}}
 return{step,last:()=>last,say:(text,kind)=>say(text,kind||'info',simT)};
}
