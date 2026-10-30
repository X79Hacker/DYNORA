// Runtime bindings stay out of Object3D.userData and exported scene JSON.
const bindings=new WeakMap();
export function bindContact(object,body){bindings.set(object,body)}
export function unbindContact(object){bindings.delete(object)}
export function contactBody(object){return bindings.get(object)||null}
