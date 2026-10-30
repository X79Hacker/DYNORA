// Stable identities survive refining, replacing and removing a selected region.
// One collection is frozen at acquisition, not read again after async sampling.
export class DepthRegions{
 constructor(limit=16){this.limit=limit;this.items=[];this.serial=0;this.activeId=null;this.revision=0;}
 get active(){return this.items.find(r=>r.region_id===this.activeId)||null;}
 get included(){return this.items.filter(r=>r.included!==false);}
 setIncluded(id,on){
  if(typeof on!=='boolean')throw Error('Region inclusion must be true or false');
  const item=this.items.find(r=>r.region_id===Number(id));if(!item)return null;
  if((item.included!==false)!==on){item.included=on;item.selection_revision=++this.revision;}
  return item;
 }
 commit(value,{replace=false}={}){
  let item=value.selection_key?this.items.find(r=>r.selection_key===value.selection_key):null;
  if(!item&&replace)item=this.active;
  if(!item&&this.items.length>=this.limit)throw Error(`At most ${this.limit} regions. Remove one before adding another.`);
  const next={...structuredClone(value),region_id:item?.region_id??++this.serial,included:item?item.included!==false:value.included!==false,selection_revision:++this.revision};
  if(item)this.items[this.items.indexOf(item)]=next;else this.items.push(next);this.activeId=next.region_id;return next;
 }
 select(id){if(!this.items.some(r=>r.region_id===Number(id)))return null;this.activeId=Number(id);return this.active;}
 remove(id=this.activeId){const i=this.items.findIndex(r=>r.region_id===Number(id));if(i<0)return null;this.items.splice(i,1);this.revision++;if(this.activeId===Number(id))this.activeId=this.items[Math.min(i,this.items.length-1)]?.region_id??null;return this.active;}
 clear(){this.items=[];this.activeId=null;this.revision++;}
 snapshot(){return structuredClone(this.items);}
 snapshotIncluded(){return structuredClone(this.included);}
}
