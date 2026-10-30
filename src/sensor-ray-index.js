import * as THREE from 'three';
import {beginRaycastFrame,posedWorldBounds} from './raycast-acceleration.js';

// Broad phase only: every accepted surface is still tested against its original
// triangles. Moving/edited geometry refits before the next sensor sample.
function entryDistance(ray, box, near, far) {
  let lo = Math.max(0, near), hi = far;
  for (const key of ['x', 'y', 'z']) {
    const d = ray.direction[key], o = ray.origin[key];
    if (Math.abs(d) < 1e-15) {
      if (o < box.min[key] || o > box.max[key]) return Infinity;
      continue;
    }
    let a = (box.min[key] - o) / d, b = (box.max[key] - o) / d;
    if (a > b) [a, b] = [b, a];
    lo = Math.max(lo, a); hi = Math.min(hi, b);
    if (hi < lo) return Infinity;
  }
  return lo;
}

export class SensorRayIndex {
  constructor({boundsFor=null}={}) {
    this.boundsFor = boundsFor;
    this.cache = new WeakMap(); this.entries = []; this.fallback = [];
    this.root = null; this.hits = []; this.tested = 0;
  }

  update(objects) {
    beginRaycastFrame();
    const entries = [], fallback = [];
    let changed = false;
    for (let order = 0; order < objects.length; order++) {
      const object = objects[order], g = object.geometry;
      // Instances, active morphs and custom non-mesh queries retain their
      // existing implementation. Skins below use conservative posed bounds.
      if (!object.isMesh || object.isInstancedMesh ||
          object.morphTargetInfluences?.some(v => v !== 0) || !g?.attributes.position) {
        fallback.push({object, order}); continue;
      }
      let entry = this.cache.get(object);
      if (!entry) {
        entry = {object, box: new THREE.Box3(), matrix: new THREE.Matrix4(), version: -1};
        this.cache.set(object, entry);
      }
      const frozenBounds = this.boundsFor?.(object);
      if (frozenBounds) {
        entry.box.copy(frozenBounds); entry.order = order; changed = true;
        if (!entry.box.isEmpty()) entries.push(entry);
        continue;
      }
      if (object.isSkinnedMesh) {
        const bounds = posedWorldBounds(object);
        if (!bounds) { fallback.push({object, order}); continue; }
        entry.box.copy(bounds); entry.order = order; changed = true;
        if (!entry.box.isEmpty()) entries.push(entry);
        continue;
      }
      const position = g.attributes.position;
      if (entry.geometry !== g || entry.position !== position || entry.version !== position.version) {
        g.computeBoundingBox();
        entry.geometry = g; entry.position = position; entry.version = position.version;
        entry.dirty = true;
      }
      if (entry.dirty || !entry.matrix.equals(object.matrixWorld)) {
        entry.box.copy(g.boundingBox).applyMatrix4(object.matrixWorld).expandByScalar(1e-7);
        entry.matrix.copy(object.matrixWorld); entry.dirty = false; changed = true;
      }
      entry.order = order;
      if (!entry.box.isEmpty()) entries.push(entry);
    }
    const rebuild = entries.length !== this.entries.length || entries.some((e, i) => e !== this.entries[i]);
    this.entries = entries; this.fallback = fallback;
    if (rebuild) {
      const build = list => {
        const box = new THREE.Box3(); for (const entry of list) box.union(entry.box);
        if (list.length <= 6) return {box, entries: list};
        const size = box.getSize(new THREE.Vector3());
        const axis = size.x > size.y ? (size.z > size.x ? 'z' : 'x') : (size.z > size.y ? 'z' : 'y');
        list.sort((a, b) => (a.box.min[axis] + a.box.max[axis]) - (b.box.min[axis] + b.box.max[axis]));
        const half = list.length >> 1;
        return {box, left: build(list.slice(0, half)), right: build(list.slice(half))};
      };
      this.root = entries.length ? build(entries.slice()) : null;
    } else if (changed) {
      const refit = node => {
        node.box.makeEmpty();
        if (node.entries) for (const entry of node.entries) node.box.union(entry.box);
        else { refit(node.left); refit(node.right); node.box.copy(node.left.box).union(node.right.box); }
      };
      if (this.root) refit(this.root);
    }
    return this;
  }

  nearest(raycaster) {
    const originalFar = raycaster.far;
    let best = null, bestOrder = Infinity; this.tested = 0;
    const test = entry => {
      this.hits.length = 0; this.tested++;
      raycaster.intersectObject(entry.object, false, this.hits);
      const hit = this.hits[0];
      if (hit && (!best || hit.distance < best.distance || hit.distance === best.distance && entry.order < bestOrder)) {
        best = hit; bestOrder = entry.order; raycaster.far = hit.distance;
      }
    };
    const distance = node => entryDistance(raycaster.ray, node.box, raycaster.near, raycaster.far);
    const visit = node => {
      if (distance(node) === Infinity) return;
      if (node.entries) {
        for (const entry of node.entries)
          if (entryDistance(raycaster.ray, entry.box, raycaster.near, raycaster.far) !== Infinity) test(entry);
      } else {
        const a = distance(node.left), b = distance(node.right);
        if (a <= b) { if (a !== Infinity) visit(node.left); if (b !== Infinity) visit(node.right); }
        else { if (b !== Infinity) visit(node.right); if (a !== Infinity) visit(node.left); }
      }
    };
    try {
      if (this.root) visit(this.root);
      for (const entry of this.fallback) test(entry);
      return best;
    } finally { raycaster.far = originalFar; this.hits.length = 0; }
  }
}
