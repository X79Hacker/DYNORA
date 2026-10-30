import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {contactBounds} from '../src/contact-geometry.js';
import {PropPhysics} from '../src/prop-physics.js';
import {DriveDynamics,STEP} from '../src/dynamics.js';

test('render-only floor shadows never enlarge prop contact bounds or keep resting props awake',async()=>{
 for(const mode of ['box','parts']){
  const scene=new T.Scene(),root=new T.Group(),solid=new T.Mesh(new T.BoxGeometry(.4,.4,.4),new T.MeshBasicMaterial());solid.position.y=.2;root.add(solid);scene.add(root);
  const shadow=new T.Mesh(new T.PlaneGeometry(3,3),new T.MeshBasicMaterial({transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.007;shadow.userData={contactShadow:true,noContact:true,noDepth:true,editorAuxiliary:true};root.add(shadow);
  const bounds=contactBounds(root);assert.ok(Math.abs(bounds.min.x+.2)<1e-6&&Math.abs(bounds.max.x-.2)<1e-6);assert.ok(Math.abs(bounds.max.y-.4)<1e-6);
  const p=await new PropPhysics().initialize();p.add('box',root,{dynamic:true,mass:2,collider:mode});assert.equal(p.items.get('box').colliders.length,1);
  p.environment([shadow]);assert.equal(p.statics.size,0);
  const robot=new T.Group(),state=new DriveDynamics();robot.position.x=state.pose.x=10;
  for(let i=0;i<200;i++)p.step(STEP,state,robot);
  assert.ok(p.items.get('box').body.isSleeping(),'resting physical shape settles without a degenerate shadow hull');assert.ok(Math.abs(root.position.y)<.01);p.world.free();
 }
});

test('auxiliary groups and render proxies are excluded while physical instances contribute their transforms',()=>{
 const root=new T.Group(),mesh=new T.InstancedMesh(new T.BoxGeometry(.2,.2,.2),new T.MeshBasicMaterial(),2),m=new T.Matrix4();mesh.setMatrixAt(0,m.makeTranslation(1,.1,0));mesh.setMatrixAt(1,m.makeTranslation(2,.1,0));root.add(mesh);
 const helper=new T.Group();helper.userData.editorAuxiliary=true;const huge=new T.Mesh(new T.BoxGeometry(100,100,100));helper.add(huge);root.add(helper);const proxy=huge.clone();proxy.userData={renderProxy:true};root.add(proxy);
 const b=contactBounds(root);assert.ok(Math.abs(b.min.x-.9)<1e-6&&Math.abs(b.max.x-2.1)<1e-6);assert.ok(b.max.y<.201);
});
