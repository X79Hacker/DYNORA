import {makeRNG} from './lab-core.js';
export const RUN_SEED=(()=>{try{return JSON.parse(localStorage.getItem('dynora-lab-3')||'{}').seed||'dynora-2026'}catch{return'dynora-2026'}})();
const streams=new Map();
export function randomStream(name){if(!streams.has(name))streams.set(name,makeRNG(RUN_SEED+'|'+name));return streams.get(name);}
export function randomState(){return Object.fromEntries([...streams].map(([k,r])=>[k,r.state()]));}
export function restoreRandomState(states){for(const[k,v]of Object.entries(states))randomStream(k).restore(v);}
