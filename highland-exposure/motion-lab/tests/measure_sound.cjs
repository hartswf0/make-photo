const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:640,height:360}});
const errs=[];p.on('pageerror',e=>errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+' '+m.text().slice(0,160))});p.on('response',r=>{if(r.status()>=400)errs.push('HTTP '+r.status()+' '+r.url())});
await p.goto('http://localhost:8769/highland-exposure/motion-lab/index.html?test');await p.waitForFunction(()=>window.__lab,null,{timeout:300000});
await p.evaluate(async()=>{const A=window.__lab.audio();await A.start();});
const r=await p.evaluate(async()=>{const L=window.__lab,A=L.audio(),P=L.player(),out={};L.state.overrideInput=true;
 // tap an analyser on the output to prove sound is flowing
 
 out.ctxState=A.ctx.state;out.buffersLoaded=Object.keys(A.manifest.files).length;
 const ev0=A.events;P.x=400;P.z=300;P.yaw=0;L.input.f=1;for(let i=0;i<150;i++)L.step(1/30);L.input.f=0;out.steps=L.state.steps;out.footEvents=A.log.filter(l=>/dirt|grass|gravel|stone/.test(l[1])).length;out.surfaces=[...new Set(A.log.map(l=>l[1]))];
 // donkey
 const D=L.donkey();P.x=D.x+1.6;P.z=D.z+.6;L.act('G');const R=L.G.road;P.yaw=Math.atan2(R[30][0]-R[20][0],R[30][1]-R[20][1]);L.input.f=1;for(let i=0;i<150;i++)L.step(1/30);L.input.f=0;L.state.lead=false;out.hooves=L.state.hooves;
 // pump strokes near Makeda
 for(let i=0;i<150;i++)L.step(1/30);out.pumpStrokes=L.state.pumpStrokes||0;
 // bajaj with radio
 const C=L.chassis(),t=C.translation();P.x=t.x+1.2;P.z=t.z+1.2;L.act('F');await new Promise(r=>setTimeout(r,200));L.input.f=1;for(let i=0;i<150;i++)L.step(1/30);await new Promise(r=>setTimeout(r,3000));
 out.engineOn=L.state.engineOn;out.gear=null;out.radio=A.radio&&{on:A.radio.on,name:A.radio.name,playing:!!A.radio.src,gain:+A.radio.g.gain.value.toFixed(2)};
 L.act('R');await new Promise(r=>setTimeout(r,2500));out.radio2=A.radio&&{name:A.radio.name,playing:!!A.radio.src};
 out.eventsTotal=A.events;out.log=A.log.slice(-12);return out});
console.log(JSON.stringify(r,null,1));console.log(errs.slice(0,8));await b.close()})()
