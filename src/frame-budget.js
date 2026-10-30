export class FrameProfiler{
 constructor(){this.samples=[];this.current={};this.previous=null;this.started=0;this.marked=0;this.lastReport=0;this.report=null}
 begin(timestamp,active=true){this.elapsed=this.previous===null||!active||this.wasActive===false?0:timestamp-this.previous;this.wasActive=active;this.previous=timestamp;this.started=this.marked=performance.now();this.current={}}
 mark(label){const now=performance.now();this.current[label]=(this.current[label]||0)+now-this.marked;this.marked=now}
 end(renderer){const now=performance.now(),cpu=now-this.started;if(this.elapsed>0&&Number.isFinite(this.elapsed)){this.samples.push({frame:this.elapsed,cpu,phases:this.current});if(this.samples.length>120)this.samples.shift()}if(now-this.lastReport<1000||!this.samples.length)return null;this.lastReport=now;const n=this.samples.length,mean=key=>this.samples.reduce((s,v)=>s+v[key],0)/n,phases={};for(const s of this.samples)for(const[k,v]of Object.entries(s.phases))phases[k]=(phases[k]||0)+v/n;const sorted=this.samples.map(v=>v.frame).sort((a,b)=>a-b);return this.report={schema:'dynora-frame-profile-13',display_fps:1000/mean('frame'),frame_ms:mean('frame'),frame_p95_ms:sorted[Math.floor((n-1)*.95)],cpu_callback_ms:mean('cpu'),phases_ms:phases,draw_calls:renderer?.info?.render.calls||0,triangles:renderer?.info?.render.triangles||0,pixel_ratio:renderer?.getPixelRatio?.()||1,samples:n,note:'Wall-clock display interval and CPU callback timings. GPU execution time is not directly measured.'}}
}

export class AdaptivePixels{
 constructor({min=.65,max=1,target=45,enabled=true}={}){this.configure({min,max,target,enabled});this.ratio=this.max;this.last=-Infinity;this.good=0}
 configure({min=this.min,max=this.max,target=this.target,enabled=this.enabled}){if(!Number.isFinite(min)||!Number.isFinite(max)||min<.5||max>2||max<min||!Number.isFinite(target)||target<20||target>120)throw Error('Invalid display budget');this.min=min;this.max=max;this.target=target;this.enabled=enabled;this.ratio=Math.max(min,Math.min(max,this.ratio??max));return this.ratio}
 observe(report,now){if(!this.enabled||!report||report.samples<10||now-this.last<1500)return this.ratio;this.last=now;const desired=1000/this.target,render=report.phases_ms['Render submission']||0,cpuBound=report.cpu_callback_ms>report.frame_ms*.65&&render<report.cpu_callback_ms*.25;
  if(report.frame_ms>desired*1.12&&!cpuBound){this.ratio=Math.max(this.min,Math.min(this.ratio-.06,this.ratio*Math.sqrt(desired/report.frame_ms)));this.good=0}else if(report.frame_ms<desired*.85){if(++this.good>=3){this.ratio=Math.min(this.max,this.ratio+.05);this.good=0}}else this.good=0;
  return this.ratio;
 }
}
