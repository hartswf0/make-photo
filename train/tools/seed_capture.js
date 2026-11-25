// node cap.js <outdir> <seed,seed,...|all>  -> <id>.blockout.jpg, <id>.depth.f32, <id>.cam.json
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const [out,list='all',base='http://localhost:8731/train/index.html']=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto(base);await p.waitForFunction(()=>window.trainFilm&&window.trainFilm._.hero,null,{timeout:120000});await p.waitForTimeout(6000);
const all=await p.evaluate(()=>trainFilm.seeds());const ids=list==='all'?all.map(s=>s.id):list.split(',');
for(const id of ids){await p.evaluate(id=>trainFilm.seed(id),id);await p.waitForTimeout(+(all.find(s=>s.id===id)||{}).settle||3500);
 const c=await p.evaluate(()=>trainFilm.capture());
 fs.writeFileSync(`${out}/${id}.blockout.jpg`,Buffer.from(c.color.split(',')[1],'base64'));fs.writeFileSync(`${out}/${id}.depth.f32`,Buffer.from(c.depth,'base64'));
 fs.writeFileSync(`${out}/${id}.cam.json`,JSON.stringify({camera:c.camera,observe:c.observe},null,1));console.log(id,'ok',c.observe.car,c.observe.shot)}
await b.close()})();
