export class RemovalHistory{
 constructor(limit=5){this.limit=limit;this.entries=[];this.busy=false}
 async remove(entry,remove,restore){if(this.busy)throw Error('Wait for the current removal');this.busy=true;try{await remove(entry);this.entries.push({entry,restore});if(this.entries.length>this.limit)this.entries.shift()}finally{this.busy=false}}
 async undo(){if(this.busy)throw Error('Wait for the current removal');const value=this.entries.at(-1);if(!value)return false;this.busy=true;try{await value.restore(value.entry);this.entries.pop();return true}finally{this.busy=false}}
 get canUndo(){return this.entries.length>0&&!this.busy}
}
