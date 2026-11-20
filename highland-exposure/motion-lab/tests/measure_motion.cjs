const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const p=await b.newPage({viewport:{width:320,height:180}});
await p.goto('http://localhost:8768/highland-exposure/motion-lab/index.html?test');await p.waitForFunction(()=>window.__lab,null,{timeout:300000});
console.log(JSON.stringify(await p.evaluate(()=>{const L=window.__lab,P=L.player(),D=L.donkey(),G=L.G,out={};L.state.overrideInput=true;const V=()=>P.root.position.clone();
 function stances(track){ // track: array of [x,y,z] per frame; a stance = run of frames at the foot's lowest band
  let mn=Infinity;for(const t of track)mn=Math.min(mn,t[1]);const runs=[];let cur=null;
  track.forEach((t,i)=>{if(t[1]<mn+.025){if(!cur)cur=[i,i];else cur[1]=i}else if(cur){runs.push(cur);cur=null}});if(cur)runs.push(cur);
  return runs.filter(r=>r[1]-r[0]>=4).map(([a,b])=>({frames:b-a+1,drift_cm:+(Math.hypot(track[b][0]-track[a][0],track[b][2]-track[a][2])*100).toFixed(1)}))}
 function walkTest(x,z,yaw,run,frames){P.x=x;P.z=z;P.yaw=yaw;L.cam.yaw=yaw;L.input.f=1;L.input.run=run;for(let i=0;i<45;i++)L.step(1/30);const A=[],B=[],x0=P.x,z0=P.z;
  for(let i=0;i<frames;i++){L.step(1/30);const a=P.rt.D.footL.getWorldPosition(V()),c=P.rt.D.footR.getWorldPosition(V());A.push([a.x,a.y-G.height(a.x,a.z),a.z]);B.push([c.x,c.y-G.height(c.x,c.z),c.z])}
  const sp=Math.hypot(P.x-x0,P.z-z0)/(frames/30);L.input.f=0;L.input.run=false;const st=[...stances(A),...stances(B)];
  return {speed_ms:+sp.toFixed(2),stances:st.length,meanDriftPerStance_cm:+(st.reduce((s,v)=>s+v.drift_cm,0)/st.length).toFixed(1),bodyPerStance_cm:+(sp*100*st.reduce((s,v)=>s+v.frames,0)/st.length/30).toFixed(0)}}
 out.walkFlat=walkTest(400,300,0,false,120);
 const R=G.road;let lo=0;for(let i=0;i<R.length;i++)if(R[i][2]<R[lo][2])lo=i;const a=R[Math.max(0,lo-30)],b2=R[Math.max(0,lo-34)];
 out.walkUphillRoad=walkTest(a[0],a[1],Math.atan2(b2[0]-a[0],b2[1]-a[1]),false,120);out.walkUphillRoad.grade=+((G.height(b2[0],b2[1])-G.height(a[0],a[1]))/Math.hypot(b2[0]-a[0],b2[1]-a[1])*100).toFixed(1);
 out.runFlat=walkTest(400,300,0,true,90);
 // donkey on the lead
 P.x=D.x+1.6;P.z=D.z+.6;L.state.lead=true;P.yaw=Math.atan2(R[30][0]-R[20][0],R[30][1]-R[20][1]);L.input.f=1;for(let i=0;i<60;i++)L.step(1/30);
 let fl,fr;D.m.traverse(o=>{if(o.name==='front_leg_foot_l')fl=o;if(o.name==='front_leg_foot_r')fr=o});const A=[],B=[];const d0=[D.x,D.z];
 for(let i=0;i<150;i++){L.step(1/30);const u=fl.getWorldPosition(V()),w=fr.getWorldPosition(V());A.push([u.x,u.y-G.height(u.x,u.z),u.z]);B.push([w.x,w.y-G.height(w.x,w.z),w.z])}
 const st=[...stances(A),...stances(B)],sp=Math.hypot(D.x-d0[0],D.z-d0[1])/5;out.donkey={speed_ms:+sp.toFixed(2),stances:st.length,meanDriftPerStance_cm:+(st.reduce((s,v)=>s+v.drift_cm,0)/st.length).toFixed(1),bodyPerStance_cm:+(sp*100*st.reduce((s,v)=>s+v.frames,0)/st.length/30).toFixed(0)};
 return out}),null,1));await b.close()})()
