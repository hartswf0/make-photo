const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const p=await b.newPage({viewport:{width:480,height:270}});
const errs=[];p.on('pageerror',e=>errs.push('PE '+e.message));
await p.goto('http://localhost:8768/highland-exposure/motion-lab/index.html?test');await p.waitForFunction(()=>window.__lab,null,{timeout:300000});
const r=await p.evaluate(()=>{const L=window.__lab,C=L.chassis(),V=L.vehicle(),G=L.G,out={};L.state.overrideInput=true;
 const Q=()=>{const r=C.rotation();return r},fx=()=>{const {x,y,z,w}=Q();return [1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y)]};
 const place=(x,z,head)=>{C.setTranslation({x,y:G.height(x,z)+.9,z},true);const h=new L.camera.quaternion.constructor().setFromAxisAngle(new L.camera.up.constructor(0,1,0),head-Math.PI/2);C.setRotation(h,true);C.setLinvel({x:0,y:0,z:0},true);C.setAngvel({x:0,y:0,z:0},true);L.state.mode='drive';L.input.f=0;L.input.s=0;L.input.brake=false;for(let i=0;i<60;i++)L.step(1/30)};
 // find the flattest 60 m straight in the patch
 let best=null;for(let x=0;x<600;x+=20)for(let z=0;z<600;z+=20)for(const hd of [0,Math.PI/2]){let mx=0;for(let k=-30;k<=30;k+=5){const a=G.height(x+Math.sin(hd)*k,z+Math.cos(hd)*k);mx=Math.max(mx,Math.abs(a-G.height(x,z)))}if(!best||mx<best.mx)best={x,z,hd,mx}}
 out.flat=best;place(best.x-Math.sin(best.hd)*28,best.z-Math.cos(best.hd)*28,best.hd);
 out.restPitch=+fx()[1].toFixed(3);out.contacts=[0,1,2].map(k=>V.wheelIsInContact(k)?1:0).join('');out.susp=[0,1,2].map(k=>+V.wheelSuspensionLength(k).toFixed(3));
 // 0-30 km/h
 L.input.f=1;let t=0;while(V.currentVehicleSpeed()*3.6<30&&t<20){L.step(1/30);t+=1/30}out.t0to30=+t.toFixed(2);
 // brake to stop
 L.input.f=0;L.input.brake=true;const s0=C.translation();let mxp=0;t=0;while(V.currentVehicleSpeed()>.1&&t<10){L.step(1/30);t+=1/30;mxp=Math.min(mxp,fx()[1])}const s1=C.translation();
 out.stop30_m=+Math.hypot(s1.x-s0.x,s1.z-s0.z).toFixed(1);out.stop30_s=+t.toFixed(2);out.brakePitchMin=+mxp.toFixed(3);L.input.brake=false;
 // top speed on the flat (as far as the straight allows)
 place(best.x-Math.sin(best.hd)*28,best.z-Math.cos(best.hd)*28,best.hd);L.input.f=1;let vm=0;for(let i=0;i<30*6;i++){L.step(1/30);vm=Math.max(vm,V.currentVehicleSpeed())}out.vmax6s_kmh=+(vm*3.6).toFixed(1);L.input.f=0;
 // a hard turn at 25 km/h: does it roll over
 place(best.x,best.z,best.hd);L.input.f=1;while(V.currentVehicleSpeed()*3.6<25){L.step(1/30)}L.input.f=.4;L.input.s=1;let roll=0;for(let i=0;i<60;i++){L.step(1/30);const {x,y,z,w}=Q();roll=Math.max(roll,Math.abs(2*(x*y-w*z)))} out.turn25_maxRoll=+roll.toFixed(3);out.turn25_speedAfter=+(V.currentVehicleSpeed()*3.6).toFixed(1);out.tipResets=L.state.resets||0;L.input.s=0;L.input.f=0;
 // climb: the road from its lowest point back up toward Entoto
 const R=G.road;let lo=0;for(let i=0;i<R.length;i++)if(R[i][2]<R[lo][2])lo=i;const a=R[Math.max(0,lo-2)],bq=R[Math.max(0,lo-6)];place(a[0],a[1],Math.atan2(bq[0]-a[0],bq[1]-a[1]));
 L.input.f=1;let ri=Math.max(0,lo-6);const climb=[];for(let i=0;i<30*25;i++){const t=C.translation();let tg=R[ri];while(Math.hypot(tg[0]-t.x,tg[1]-t.z)<8&&ri>0){ri--;tg=R[ri]}const f=fx(),h=Math.atan2(f[0],f[2]),w=Math.atan2(tg[0]-t.x,tg[1]-t.z),e=Math.atan2(Math.sin(w-h),Math.cos(w-h));L.input.s=Math.max(-1,Math.min(1,-e*2.2));L.step(1/30);
  if(i%75===0){const g=(G.height(t.x+f[0]*4,t.z+f[2]*4)-G.height(t.x-f[0]*4,t.z-f[2]*4))/8;climb.push([+(i/30).toFixed(0),+(V.currentVehicleSpeed()*3.6).toFixed(1),+(g*100).toFixed(1)])}}
 out.climb=climb;out.resets=L.state.resets||0;return out});
console.log(JSON.stringify(r,null,0));console.log(errs);await b.close()})()
