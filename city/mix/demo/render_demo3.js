const {chromium}=require('playwright');const fs=require('fs');(async()=>{const FPS=24,LEN=+process.argv[2]||64,FROM=+process.argv[3]||0;
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage({viewport:{width:1600,height:900}});pg.on('pageerror',e=>console.log('ERR',e.message));
await pg.addInitScript(()=>{try{localStorage.clear()}catch(e){}});await pg.goto('file://'+process.cwd()+'/mix.html');await pg.waitForTimeout(1500);
const POEM=process.argv[4]||'10';const info=await pg.evaluate(p=>{setEye(false);return DEMO.prepare(1280,720,p)},POEM);await pg.waitForTimeout(4000);console.log(info.len,await pg.evaluate(()=>NODES.map(k=>k.rid+(k.mt?'+m':'')).join(' ')));fs.writeFileSync('demo3/nodes.json',JSON.stringify(info));const mix=[];const t0=Date.now();
for(let f=Math.round(FROM*FPS);f<LEN*FPS;f++){const r=await pg.evaluate(t=>DEMO.renderAt(t),f/FPS);fs.writeFileSync(`demo3/frames/f${String(f).padStart(5,'0')}.jpg`,Buffer.from(r.img.split(',')[1],'base64'));mix.push({f,m:r.mix});
  if(f%120===0)console.log(f,((Date.now()-t0)/1000).toFixed(0)+'s')}
fs.writeFileSync(`demo3/mix_${FROM}.json`,JSON.stringify(mix));await b.close()})();
