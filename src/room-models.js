import * as THREE from 'three';
// Original parametric room assets. Nominal dimensions/masses are editable assumptions.
export const EXTRA_CATALOG=[
 {id:'floor-mirror',name:'Full-length standing mirror',category:'Bedroom',dimensions:[.68,1.72,.48],mass:12},
 {id:'double-bed',name:'Double bed with duvet and pillows',category:'Bedroom',dimensions:[1.65,1.16,2.15],mass:65},
 {id:'nightstand',name:'Two-drawer bedside cabinet',category:'Bedroom',dimensions:[.48,.56,.42],mass:12},
 {id:'wardrobe',name:'Double-door wardrobe',category:'Bedroom',dimensions:[1.2,2.02,.58],mass:80},
 {id:'writing-desk',name:'Writing desk with drawer and cable tray',category:'Office',dimensions:[1.3,.77,.65],mass:24},
 {id:'bookcase',name:'Open bookcase with books and decor',category:'Office',dimensions:[.85,1.82,.32],mass:32},
 {id:'armchair',name:'Lounge armchair with piping',category:'Living room',dimensions:[.83,.91,.84],mass:18},
 {id:'bar-stool',name:'Upholstered counter stool',category:'Kitchen',dimensions:[.44,.98,.44],mass:6},
 {id:'dining-table',name:'Six-seat oak dining table',category:'Living room',dimensions:[1.8,.76,.9],mass:35},
 {id:'tv-console',name:'Media console with television',category:'Living room',dimensions:[1.5,1.22,.42],mass:35},
 {id:'refrigerator',name:'Two-door refrigerator',category:'Kitchen',dimensions:[.7,1.82,.72],mass:75},
 {id:'oven-range',name:'Freestanding oven and hob',category:'Kitchen',dimensions:[.6,.91,.63],mass:48},
 {id:'kitchen-counter',name:'Kitchen sink cabinet and worktop',category:'Kitchen',dimensions:[1.2,1.09,.62],mass:60},
 {id:'washing-machine',name:'Front-load washing machine',category:'Appliances',dimensions:[.6,.85,.64],mass:65},
 {id:'floor-lamp',name:'Floor lamp with fabric shade',category:'Lighting',dimensions:[.42,1.68,.42],mass:5},
 {id:'table-lamp',name:'Ceramic table lamp',category:'Lighting',dimensions:[.3,.52,.3],mass:2},
 {id:'bathroom-vanity',name:'Bathroom vanity with basin',category:'Bathroom',dimensions:[.8,1.05,.5],mass:35},
 {id:'toilet',name:'Close-coupled ceramic toilet',category:'Bathroom',dimensions:[.4,.82,.7],mass:30},
 {id:'radiator',name:'Panel radiator with fins and valves',category:'Fixtures',dimensions:[1,.62,.13],mass:18},
 {id:'coat-rack',name:'Standing coat rack and hanging jacket',category:'Fixtures',dimensions:[.5,1.76,.5],mass:6},
];

export function buildExtraFurniture(id,root,b){
 const oak=b.mat(0xaf926b,.58,0,'wood'),darkWood=b.mat(0x615142,.66,0,'wood'),steel=b.mat(0x9ca8b2,.28,.82,'metal'),black=b.mat(0x212a34,.55,.12,'paint'),rubber=b.mat(0x181d22,.96,0,'rubber'),white=b.mat(0xe4e1d7,.38,0,'ceramic'),paint=b.mat(0xc3c9ca,.58,.12,'paint'),linen=b.mat(0xb1b6b0,.92,0,'fabric'),blue=b.mat(0x526b79,.93,0,'fabric'),gold=b.mat(0xa28d55,.32,.7,'metal');
 const legs=(xs,zs,h,m=oak,y=0,r=.025)=>{for(const x of xs)for(const z of zs)b.cylinder(r,r*.8,h,m,x,y+h/2,z)};
 const handle=(x,y,z,w=.12)=>b.tube([[x-w/2,y,z],[x-w/2,y,z+.022],[x+w/2,y,z+.022],[x+w/2,y,z]],.006,steel);
 const ring=(r,t,m,x,y,z,rx=Math.PI/2)=>{const o=b.add(new THREE.TorusGeometry(r,t,8,36),m,x,y,z);o.rotation.x=rx;return o};
 const ball=(r,m,x,y,z,s=[1,1,1])=>{const o=b.add(new THREE.SphereGeometry(r,16,10),m,x,y,z);o.scale.set(...s);return o};
 const book=(x,y,z,w,h,c,lean=0)=>{const m=b.mat(c,.8,0,'paper'),g=new THREE.Group();g.position.set(x,y,z);g.rotation.z=lean;root.add(g);b.box(w,h,.18,m,0,h/2,0,.001,g);b.box(w*.8,h*.94,.173,b.mat(0xe4ddca,.95,0,'paper'),0,h/2,.004,.001,g);b.box(w,.018,.004,m,0,h*.75,.092,.001,g)};
 const lampShade=(r1,r2,h,x,y,z)=>{const m=b.mat(0xd0c7ad,.94,0,'fabric');m.side=THREE.DoubleSide;b.add(new THREE.CylinderGeometry(r1,r2,h,32,1,true),m,x,y,z);ring(r1,.003,gold,x,y+h/2,z);ring(r2,.003,gold,x,y-h/2,z);ball(.028,b.mat(0xffdb94,.5,0,'bulb'),x,y-.02,z);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;b.tube([[x,y-.1,z],[x+Math.cos(a)*r2*.95,y-h/2,z+Math.sin(a)*r2*.95]],.0025,gold)}};
 if(id==='floor-mirror'){
  const face=new THREE.Group();face.position.set(0,.87,0);face.rotation.x=-.07;root.add(face);
  for(const x of[-.31,.31])b.box(.035,1.62,.035,darkWood,x,0,0,.009,face);for(const y of[-.79,.79])b.box(.65,.035,.035,darkWood,0,y,0,.009,face);
  b.box(.59,1.55,.014,black,0,0,-.012,.002,face);
  const mirror=b.box(.582,1.53,.009,b.mat(0xd4e1e4,.035,1,'mirror'),0,0,.006,.001,face);mirror.userData.mirrorPlane={width:.576,height:1.524,offset:.0055};
  for(const x of[-.245,.245]){b.tube([[x,.025,-.28],[x,.7,-.15],[x,1.12,-.04]],.012,steel);b.cylinder(.021,.021,.018,rubber,x,.009,-.28)}for(const x of[-.31,.31]){b.tube([[x,.085,.055],[x,.02,.15]],.011,darkWood);b.cylinder(.018,.018,.018,rubber,x,.009,.15);const hinge=b.cylinder(.015,.015,.008,steel,x,1.12,-.04);hinge.rotation.z=Math.PI/2;}
  b.tube([[-.245,.035,-.28],[.245,.035,-.28]],.009,steel);
 }else if(id==='double-bed'){
  legs([-.7,.7],[-.86,.86],.2,darkWood);b.box(1.64,.18,2.12,oak,0,.27,0,.022);for(let i=0;i<12;i++)b.box(1.48,.018,.07,darkWood,0,.365,-.88+i*.16,.003);
  b.box(1.57,.21,1.98,linen,0,.475,.015,.065);b.box(1.62,.84,.09,oak,0,.73,-1.005,.025);for(let i=0;i<7;i++)b.box(.015,.65,.012,darkWood,-.66+i*.22,.76,-.953,.003);
  b.box(1.58,.085,1.46,blue,0,.615,.235,.035);for(const x of[-.74,.74])b.box(.045,.2,1.5,blue,x,.54,.22,.012);b.box(1.58,.16,.065,blue,0,.55,.947,.022);
  b.box(1.56,.055,.28,linen,0,.655,-.39,.018);for(const x of[-.405,.405]){const pillow=b.box(.65,.13,.4,linen,x,.625,-.72,.065);pillow.rotation.z=x>0?.025:-.025;b.tube([[x-.27,.665,-.9],[x,.675,-.925],[x+.27,.665,-.9]],.0025,linen)}
  for(const z of[-.18,.1,.38,.66])b.tube([[-.73,.66,z],[-.35,.671,z+.012],[.35,.671,z-.009],[.73,.66,z]],.0018,b.mat(0x7b8f99,.95,0,'fabric'));
 }else if(id==='nightstand'){
  legs([-.18,.18],[-.14,.14],.12,black);b.box(.48,.03,.42,oak,0,.545,0,.014);b.box(.46,.035,.39,oak,0,.14,0,.006);for(const x of[-.22,.22])b.box(.02,.37,.39,oak,x,.34,0,.005);b.box(.44,.36,.018,darkWood,0,.34,-.19,.003);
  for(const y of[.25,.43]){b.box(.43,.16,.025,oak,0,y,.199,.004);handle(0,y,.216)}
 }else if(id==='wardrobe'){
  b.box(1.2,.06,.58,oak,0,.06,0,.01);for(const x of[-.585,.585])b.box(.03,1.93,.58,oak,x,1.025,0,.006);for(const y of[.11,2])b.box(1.16,.035,.58,oak,0,y,0,.006);b.box(1.14,1.9,.018,darkWood,0,1.05,-.28,.003);
  for(const x of[-.29,.29]){b.box(.565,1.84,.026,oak,x,1.055,.286,.008);for(const z of[-.185,.185])b.box(.018,1.76,.014,darkWood,x+z,1.05,.307,.003)}for(const x of[-.045,.045])b.tube([[x,.88,.31],[x,.88,.34],[x,1.14,.34],[x,1.14,.31]],.007,steel);
 }else if(id==='writing-desk'){
  b.box(1.3,.035,.65,oak,0,.7475,0,.016);for(const x of[-.565,.565])for(const z of[-.24,.24])b.box(.035,.73,.035,black,x,.365,z,.008);
  b.box(1.12,.06,.018,black,0,.31,-.24,.003);b.box(.43,.105,.48,oak,.3,.668,.015,.005);b.box(.4,.09,.018,oak,.3,.67,.267,.004);handle(.3,.672,.278);
  b.box(.5,.03,.12,steel,-.25,.62,-.22,.005);b.tube([[-.48,.73,-.2],[-.48,.65,-.24],[-.42,.16,-.24]],.004,rubber);
 }else if(id==='bookcase'){
  for(const x of[-.4075,.4075])b.box(.035,1.82,.32,oak,x,.91,0,.006);for(const y of[.04,.46,.9,1.34,1.79])b.box(.8,.03,.32,oak,0,y,0,.004);b.box(.78,1.75,.012,darkWood,0,.91,-.153,.002);
  const palette=[0x516a7a,0x8d6554,0xb7a778,0x5d7463,0x737081];for(const[y,row]of[[.055,0],[.475,1],[.915,2]])for(let i=0;i<5;i++)book(-.3+i*.068,y,-.02,.047,.21+(i%3)*.035,palette[(i+row)%5],i===4?-.08:0);
  b.cylinder(.075,.055,.17,white,.18,1.44,0);ball(.07,gold,-.18,1.45,0);b.box(.18,.025,.15,linen,.15,.93,0,.003);
 }else if(id==='armchair'){
  legs([-.3,.3],[-.28,.28],.15,oak);b.box(.73,.21,.77,blue,0,.25,0,.05);b.box(.65,.14,.64,linen,0,.435,.03,.05);const back=b.box(.7,.48,.14,blue,0,.64,-.3,.06);back.rotation.x=-.08;for(const x of[-.36,.36])b.box(.105,.42,.75,blue,x,.42,0,.04);b.tube([[-.3,.49,.31],[0,.505,.35],[.3,.49,.31]],.003,linen);const pillow=b.box(.3,.3,.11,b.mat(0xaa795a,.94,0,'fabric'),0,.66,-.13,.065);pillow.rotation.z=.12;
 }else if(id==='bar-stool'){
  for(const x of[-.16,.16])for(const z of[-.16,.16])b.tube([[x*1.1,.018,z*1.1],[x,.34,z],[x*.85,.69,z*.85]],.014,black);ring(.17,.012,steel,0,.3,0);b.box(.4,.07,.39,linen,0,.705,0,.03);for(const x of[-.16,.16])b.tube([[x,.69,-.16],[x,.93,-.2]],.011,black);b.box(.35,.18,.035,blue,0,.88,-.2,.02);
 }else if(id==='dining-table'){
  b.box(1.8,.045,.9,oak,0,.7375,0,.028);for(const z of[-.34,.34])b.box(1.53,.09,.035,darkWood,0,.66,z,.004);for(const x of[-.74,.74])b.box(.035,.09,.7,darkWood,x,.66,0,.004);for(const x of[-.74,.74])for(const z of[-.34,.34])b.box(.065,.7,.065,oak,x,.35,z,.012);
 }else if(id==='tv-console'){
  legs([-.64,.64],[-.13,.13],.13,black);b.box(1.5,.035,.42,oak,0,.43,0,.015);b.box(1.46,.025,.39,oak,0,.15,0,.008);for(const x of[-.71,0,.71])b.box(.024,.27,.39,oak,x,.29,0,.004);b.box(1.4,.25,.015,darkWood,0,.29,-.18,.003);
  for(const x of[-.47,.47]){b.box(.44,.245,.025,oak,x,.29,.192,.005);handle(x,.34,.211,.09)}b.box(.21,.028,.23,black,.12,.181,.01,.004);
  b.box(1.28,.72,.034,black,0,.84,-.035,.018);b.box(1.235,.67,.006,b.mat(0x263d4b,.22,.3,'screen'),0,.845,-.013,.006);for(const x of[-.42,.42])b.tube([[x,.48,.08],[x*.9,.5,-.02],[x*.82,.58,-.035]],.009,black);ball(.003,b.mat(0x5cbdaf,.4),.54,.495,-.012);
 }else if(id==='refrigerator'){
  b.box(.69,1.78,.68,paint,0,.92,-.01,.025);legs([-.26,.26],[-.25,.25],.055,rubber);for(const[y,h]of[[.58,1.04],[1.465,.69]]){b.box(.66,h,.045,white,0,y,.342,.016);b.box(.64,.01,.009,rubber,0,y-h/2+.008,.368,.001)}for(const[y,h]of[[.62,.42],[1.49,.3]])b.tube([[-.25,y-h/2,.369],[-.25,y-h/2,.398],[-.25,y+h/2,.398],[-.25,y+h/2,.369]],.01,steel);b.box(.19,.018,.006,steel,.16,1.67,.37,.002);
 }else if(id==='oven-range'){
  b.box(.6,.84,.6,paint,0,.46,0,.018);legs([-.24,.24],[-.24,.24],.05,black);b.box(.59,.035,.6,black,0,.892,0,.012);b.box(.53,.53,.025,black,0,.37,.31,.012);b.box(.43,.39,.007,b.mat(0x29333c,.22,.25,'screen'),0,.365,.327,.014);handle(0,.615,.332,.4);
  for(const x of[-.23,-.115,0,.115,.23]){const knob=b.cylinder(.018,.018,.022,steel,x,.775,.318);knob.rotation.x=Math.PI/2;b.box(.002,.012,.003,black,x,.783,.332,.001)}for(const x of[-.16,.16])for(const z of[-.16,.16]){ring(.08,.006,steel,x,.913,z);ring(.052,.003,steel,x,.914,z)}
 }else if(id==='kitchen-counter'){
  b.box(1.2,.045,.62,b.mat(0xbabbb4,.42,0,'stone'),0,.8875,0,.012);for(const x of[-.575,.575])b.box(.03,.79,.55,oak,x,.47,0,.006);b.box(1.15,.04,.54,oak,0,.095,0,.006);b.box(1.13,.72,.018,darkWood,0,.46,-.26,.002);for(const x of[-.285,.285]){b.box(.555,.69,.025,oak,x,.485,.282,.006);handle(x,.76,.301)}
  b.box(.4,.008,.32,steel,-.2,.914,0,.045);b.box(.34,.007,.26,b.mat(0x657780,.26,.9,'metal'),-.2,.919,0,.04);ring(.025,.003,black,-.2,.924,.04);b.tube([[-.2,.91,-.205],[-.2,1.04,-.205],[-.2,1.08,-.08],[-.2,1.025,-.055]],.012,steel);b.box(.05,.009,.015,steel,-.16,.96,-.2,.003);
 }else if(id==='washing-machine'){
  b.box(.6,.81,.59,white,0,.445,0,.02);legs([-.23,.23],[-.22,.22],.04,black);b.box(.56,.115,.018,paint,0,.745,.305,.009);b.box(.18,.065,.007,black,.1,.75,.32,.004);const dial=b.cylinder(.032,.032,.024,steel,-.15,.75,.325);dial.rotation.x=Math.PI/2;
  const rim=b.cylinder(.215,.215,.025,steel,0,.385,.318,root,40);rim.rotation.x=Math.PI/2;const seal=b.cylinder(.184,.184,.03,rubber,0,.385,.338,root,40);seal.rotation.x=Math.PI/2;const glass=b.cylinder(.16,.16,.008,b.mat(0x354b58,.2,.3,'screen'),0,.385,.358,root,40);glass.rotation.x=Math.PI/2;handle(.155,.385,.37,.035);for(let i=0;i<5;i++)b.box(.006,.006,.004,black,.015+i*.025,.75,.331,.001);b.box(.1,.055,.012,paint,.2,.13,.304,.008);
 }else if(id==='floor-lamp'){
  b.cylinder(.16,.17,.028,black,0,.014,0,root,32);b.cylinder(.012,.012,1.37,gold,0,.7,0);lampShade(.12,.205,.3,0,1.5,0);b.tube([[0,.045,0],[.06,.02,.08],[.24,.008,.14]],.003,rubber);
 }else if(id==='table-lamp'){
  b.cylinder(.095,.105,.018,gold,0,.009,0);ball(.095,white,0,.15,0,[.82,1.35,.82]);b.cylinder(.008,.008,.1,gold,0,.31,0);lampShade(.085,.145,.19,0,.42,0);b.tube([[0,.02,-.045],[.08,.008,-.09],[.13,.008,-.1]],.0025,rubber);
 }else if(id==='bathroom-vanity'){
  legs([-.32,.32],[-.17,.17],.13,black);b.box(.8,.05,.5,white,0,.825,0,.018);for(const x of[-.38,.38])b.box(.025,.64,.45,oak,x,.48,0,.004);b.box(.73,.03,.45,oak,0,.16,0,.004);for(const x of[-.185,.185]){b.box(.35,.59,.02,oak,x,.48,.233,.006);handle(x,.69,.248,.1)}
  const basin=b.add(new THREE.LatheGeometry([[.04,0],[.14,.012],[.175,.045],[.19,.09],[.185,.105],[.165,.105],[.15,.065],[.09,.035],[.025,.025]].map(p=>new THREE.Vector2(...p)),32),white,0,.85,0);basin.scale.z=.78;ring(.018,.003,steel,0,.882,0);b.tube([[0,.85,-.19],[0,.99,-.19],[0,1.035,-.08],[0,.99,-.06]],.012,steel);
 }else if(id==='toilet'){
  ball(.19,white,0,.29,.11,[.95,.72,1.48]);ball(.12,white,0,.18,.02,[.8,1.35,1.08]);b.box(.24,.045,.37,white,0,.024,.06,.04);b.box(.35,.38,.16,white,0,.62,-.22,.04);b.box(.37,.035,.18,white,0,.817,-.22,.015);b.cylinder(.014,.014,.005,steel,.08,.838,-.22);
  const seat=b.add(new THREE.TorusGeometry(.155,.023,8,36),white,0,.415,.11);seat.rotation.x=Math.PI/2;seat.scale.set(1,1.38,.55);const lid=ball(.157,white,0,.443,.11,[1,.075,1.38]);b.box(.18,.025,.04,paint,0,.42,-.08,.006);
 }else if(id==='radiator'){
  b.box(1,.54,.075,white,0,.33,0,.016);for(let i=0;i<23;i++)b.box(.012,.49,.018,paint,-.45+i*.041,.33,.049,.003);for(const y of[.065,.595])b.box(1,.025,.105,white,0,y,0,.006);for(const x of[-.39,.39])b.box(.03,.18,.035,steel,x,.19,-.055,.005);b.tube([[-.48,.1,0],[-.54,.1,0],[-.54,.035,0]],.012,steel);const valve=b.cylinder(.025,.025,.05,white,.52,.12,0);valve.rotation.z=Math.PI/2;
 }else if(id==='coat-rack'){
  for(let k=0;k<4;k++){const a=k*Math.PI/2;b.tube([[0,.2,0],[Math.cos(a)*.13,.08,Math.sin(a)*.13],[Math.cos(a)*.24,.015,Math.sin(a)*.24]],.015,darkWood);b.tube([[0,1.48,0],[Math.cos(a)*.19,1.6,Math.sin(a)*.19],[Math.cos(a)*.2,1.69,Math.sin(a)*.2]],.013,oak);ball(.022,oak,Math.cos(a)*.2,1.69,Math.sin(a)*.2)}b.cylinder(.018,.024,1.58,oak,0,.92,0);b.box(.29,.48,.055,blue,.17,1.32,.035,.045);for(const x of[.025,.315]){const sleeve=b.box(.075,.33,.065,blue,x,1.38,.035,.025);sleeve.rotation.z=x>.1?.23:-.23}b.box(.008,.42,.006,black,.17,1.32,.067,.002);
 }else return false;
 return true;
}
