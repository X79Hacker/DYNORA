import {planGrid} from './navigation-core.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,...planGrid(data.map,data.start,data.goal,data.options)})}catch(e){self.postMessage({id:data.id,status:'error',error:e.message,path:[]})}};
