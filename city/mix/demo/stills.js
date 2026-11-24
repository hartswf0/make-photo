const {chromium}=require('playwright');const fs=require('fs');(async()=>{
const SHOTS={'11':[3.8,23.5,28.8,36.8,40.0,47.5,62.6,69.8,77.4,79.4,81.8,88.0,94.0],'12':[6.0,10.5,13.5,19.0,24.5,26.0,36.4,40.5,45.5,51.3,53.4,61.0],
 '13':[3.3,8.0,10.8,19.0,23.6,28.8,30.8,44.4,49.6,55.3,67.8,69.0,75.5,82.4,87.0,96.9],'14':[3.0,7.5,8.2,10.0,17.0,25.6,27.6,34.5,38.9,45.0,49.0,55.5,60.0,63.0,64.0,67.2]};
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const poem of Object.keys(SHOTS)){const pg=await b.newPage({viewport:{width:1600,height:900}});pg.on('pageerror',e=>console.log('ERR',e.message));
 await pg.addInitScript(()=>{try{localStorage.clear()}catch(e){}});await pg.goto('file://'+process.cwd()+'/mix.html');await pg.waitForTimeout(1500);
 const info=await pg.evaluate(p=>{setEye(false);return DEMO.prepare(960,540,p)},poem);await pg.waitForTimeout(3000);
 for(const c of SHOTS[poem]){const r=await pg.evaluate(t=>DEMO.renderAt(t),c-info.c0);fs.writeFileSync(`ideas/${poem}_${c.toFixed(1)}.jpg`,Buffer.from(r.img.split(',')[1],'base64'))}
 console.log(poem,info.nodes.map(n=>n.rid+':'+n.key).join(' '));await pg.close()}
await b.close()})();
