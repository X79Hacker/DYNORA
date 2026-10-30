// Small renderer-independent contract shared by scene UI, history and tests.
export function readTransform(object){return {position:object.position.toArray(),quaternion:object.quaternion.toArray(),scale:object.scale.toArray()}}
export function validateTransform(t){
  for(const [key,length]of [['position',3],['quaternion',4],['scale',3]])
    if(!Array.isArray(t?.[key])||t[key].length!==length||t[key].some(v=>!Number.isFinite(v)))throw Error('Transform must contain finite position, rotation and scale');
  if(Math.abs(t.position[0])>50||Math.abs(t.position[2])>50||t.position[1]<-2||t.position[1]>10)throw Error('Keep objects within 50 m horizontally and −2 to 10 m in height');
  if(t.scale.some(s=>s<.01||s>100))throw Error('Scale must be positive and between 0.01 and 100');
  if(Math.abs(t.quaternion.reduce((s,v)=>s+v*v,0)-1)>.01)throw Error('Rotation must be a unit quaternion');
  return t;
}
export function writeTransform(object,t){validateTransform(t);object.position.fromArray(t.position);object.quaternion.fromArray(t.quaternion);object.scale.fromArray(t.scale);object.updateMatrixWorld(true)}
export class TransformHistory {
  constructor(limit=60){this.limit=limit;this.undoStack=[];this.redoStack=[]}
  record(id,before,after){validateTransform(before);validateTransform(after);if(JSON.stringify(before)===JSON.stringify(after))return;this.undoStack.push(structuredClone({id,before,after}));if(this.undoStack.length>this.limit)this.undoStack.shift();this.redoStack=[]}
  async move(direction,apply){const from=direction==='undo'?this.undoStack:this.redoStack,to=direction==='undo'?this.redoStack:this.undoStack;const entry=from.at(-1);if(!entry)return false;await apply(entry.id,structuredClone(direction==='undo'?entry.before:entry.after));from.pop();to.push(entry);return true}
}
