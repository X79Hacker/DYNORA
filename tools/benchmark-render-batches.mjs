import {performance} from 'node:perf_hooks';
import * as T from 'three';
import {MODEL_CATALOG,createFurniture} from '../src/visual-models.js';
import {RigidRenderBatches} from '../src/rigid-render-batches.js';

// CPU and draw-structure check, deliberately separate from full app / GPU FPS.
// Original catalog geometry, plus the apartment's many-colour book pattern.
const scene=new T.Scene(),roots=MODEL_CATALOG.map(spec=>createFurniture(spec.id));
const shelf=new T.Group();for(let i=0;i<66;i++){const book=new T.Mesh(new T.BoxGeometry(.055,.27,.22),new T.MeshStandardMaterial({color:new T.Color().setHSL(i/66,.55,.5),roughness:.7}));book.position.set((i%22)*.065,Math.floor(i/22)*.45,0);book.castShadow=book.receiveShadow=true;shelf.add(book)}roots.push(shelf);scene.add(...roots);scene.updateMatrixWorld(true);
const count=()=>{let draws=0,triangles=0;scene.traverseVisible(o=>{if(o.isMesh&&(o.layers.mask&1)){draws++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3}});return{draws,triangles}};
const before=count(),batches=new RigidRenderBatches({validationMs:250}),start=performance.now();for(const root of roots)batches.track(root);const setup=performance.now()-start,after=count();
const measure=fn=>{const values=[];for(let i=0;i<120;i++){const t=performance.now();fn();values.push(performance.now()-t)}values.sort((a,b)=>a-b);return{median_ms:values[60],p95_ms:values[114],samples:values.length}};
const idle=measure(()=>batches.update({matricesCurrent:true})),validate=measure(()=>{batches.invalidate();batches.update({matricesCurrent:true})});
if(before.triangles!==after.triangles||after.draws>=before.draws)throw Error('Geometry/draw budget regression');
console.log(JSON.stringify({schema:'dynora-draw-structure-13',fixture:'One of each bundled furniture model and a 66-book shelf; not the full apartment',before,after,batches:batches.info(),setup_ms:setup,unchanged_frame_update:idle,full_validation:validate,note:'CPU timings and layer-visible mesh submissions only. Does not measure WebGL, shadows, the full app, or laptop FPS.'},null,2));batches.dispose();
