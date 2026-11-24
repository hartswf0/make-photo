/* ===== a performance of poem 10, played like an instrument: a score keyed to his words =====
   Each cue is [clock, seconds, who, {values}]: from that word, glide (smoothstep) to these values over that many seconds.
   who: R reading · G grey reel (whole ride) · C cel reel · M LiDAR reel · F rider-in-the-seed reel · S line sounds · X rooms · ear · field.
   values: x, y, m (mass), r (reach), h (hue), ta (tint amount), e (echo: his voice from that reel's take, far away); field: G, veil, tang.
   The reading plays untouched at 1×: the score follows his clock, live and when rendered. */
const DEMO={on:false,t0:0,poem:'10',c0:1.5,c1:97.4};DEMO.len=DEMO.c1-DEMO.c0;
const smo=x=>{x=clamp(x,0,1);return x*x*(3-2*x)},lerp=(a,b,u)=>a+(b-a)*u;
const ROLE={R:'R10',G:'W10ride-grey',C:'W10ride-cel',M:'Wmagic-ride',F:'W10ride-greyfig',S:'S10',X:'X10'};
const INIT={R:{x:.42,y:.42,m:.9,r:.3,h:38,ta:0},G:{x:.08,y:.45,m:0,r:.36,h:228,ta:0,e:0},C:{x:.93,y:.5,m:0,r:.3,h:42,ta:0,e:0},M:{x:.5,y:.08,m:0,r:.4,h:0,ta:0,e:0},F:{x:.92,y:.15,m:0,r:.4,h:0,ta:0,e:0},
  S:{x:.16,y:.86,m:.5},X:{x:.84,y:.86,m:.5},ear:{x:.5,y:.5},field:{G:1.6,veil:0,tang:0}};
const SCORE=[
 // I wasn't looking for a ride, but here you are, blissful and oddly sensitive — he is alone; on "ride" the bike under the lamp arrives
 [2.4,1.2,'R',{r:.4}],[3.6,2.2,'C',{x:.74,y:.48,m:.85,r:.34}],[3.7,3,'ear',{x:.72,y:.72}],[5.5,2,'C',{r:.5}],[7.0,1.6,'R',{ta:.35}],[8.5,1.2,'C',{r:.42}],
 // withering a soul purveying both the dark and the light worlds I've known — two worlds, a seam through him
 [9.3,2.2,'field',{G:5}],[9.4,2.2,'G',{x:.16,y:.45,m:.85,r:.36}],[9.4,1.8,'ear',{x:.5,y:.6}],[12.2,.9,'G',{ta:.85}],[13.2,.9,'C',{ta:.6,r:.5}],[13.6,1.6,'R',{r:.27,ta:0}],
 // So I rub my aggressions into your steel coverings and hop on to amuse myself — friction, metal; then the ride begins
 [15.6,1.0,'field',{tang:.65,G:2}],[15.6,1.2,'M',{x:.5,y:.22,m:.8,r:.4}],[15.6,1.5,'ear',{x:.2,y:.8}],[15.6,1.2,'G',{ta:0}],[15.6,1.2,'C',{ta:0}],[17.3,.6,'M',{r:.58}],[17.9,1.0,'M',{r:.45}],
 [18.9,.9,'field',{tang:0,G:1.6}],[19.0,1.4,'M',{m:0}],[19.2,1.8,'G',{x:.62,y:.6,r:.5}],[19.2,1.6,'C',{m:.3}],[20.3,1.5,'R',{r:.36}],
 // Loneliness is having everything with no one to tell — he shrinks into a corner of a vast empty road; the foley thins; "no one to tell" answers from far away
 [23.0,2.8,'R',{x:.24,y:.3,r:.12,m:.6}],[23.0,2.6,'G',{x:.56,y:.62,r:.95,m:.9}],[23.0,1.5,'C',{m:0}],[23.0,2.5,'ear',{x:.5,y:.12}],[23.0,2,'S',{m:.3}],[23.0,2,'X',{m:.35}],
 [25.3,.5,'G',{e:.55}],[26.6,2.2,'G',{e:0}],
 // being everywhere with no one to love and escape — everywhere at once: a mosaic of every take, him small among them
 [27.4,1.6,'field',{G:10}],[27.5,1.5,'G',{x:.5,y:.56,r:.4}],[27.5,1.5,'F',{x:.8,y:.24,m:.8,r:.4}],[27.6,1.5,'C',{x:.82,y:.76,m:.8,r:.4}],[27.7,1.5,'M',{x:.2,y:.78,m:.7,r:.4}],[27.5,1.5,'R',{r:.2,m:.75}],
 [29.0,1.0,'R',{m:.55}],[30.8,1.2,'field',{G:3}],
 // wide-eyed and stone but alive and well, wandering with no clear end — he opens wide; stone hardens the edges; then fog, and no edge at all
 [31.2,1.0,'R',{x:.4,y:.4,r:.5,m:.9}],[32.3,.5,'field',{G:12}],[33.0,1.2,'field',{G:1.6}],[34.6,1.8,'M',{m:0}],[34.6,1.8,'F',{m:0}],[34.6,1.8,'G',{m:.5}],
 [34.8,2.6,'C',{x:.7,y:.55,m:.8,r:.5}],[35.0,2.6,'R',{m:.7}],[36.2,1.4,'field',{veil:.5}],[36.2,1.4,'ear',{x:.5,y:.5}],[36.2,1.4,'S',{m:.5}],[36.2,1.4,'X',{m:.5}],
 // I let the noise block the noise — interference and street roar; the way I ride through the streets with a swag — the lantern street; and eyes turn, heads twist — the worlds turn around him
 [38.3,.6,'field',{veil:0,tang:.75,G:1.6}],[38.3,.8,'M',{x:.45,y:.22,m:.9,r:.6}],[38.3,1.2,'ear',{x:.84,y:.8}],[38.3,1,'X',{m:.9}],[39.2,.4,'M',{r:.75}],[39.7,.8,'M',{r:.5}],
 [40.2,1.0,'field',{tang:0,G:2.5}],[40.2,1.2,'G',{x:.6,y:.62,m:.85,r:.45}],[40.2,1.2,'C',{m:0}],[40.4,1.4,'M',{m:0}],
 [41.6,.1,'C',{x:.1,y:.55}],[42.0,1.0,'C',{x:.25,m:.9,r:.5,ta:.3}],[43.5,1.4,'C',{x:.78}],[43.5,1.4,'G',{x:.2}],[44.4,1.2,'ear',{x:.5,y:.6}],
 // yeah, that magic still exists — everything melts warm; the far voice repeats it
 [47.6,1.4,'field',{G:1.2}],[47.6,1.2,'C',{ta:.7,r:.6}],[47.7,1.2,'R',{ta:.3,r:.42}],[48.0,.4,'G',{e:.5}],[49.4,2,'G',{e:0}],
 // All preparations to live and dream in darkness I no longer desire — the worlds sink into the dark
 [51.8,1.6,'C',{m:0}],[51.8,1.6,'G',{m:.15}],[51.8,1.6,'R',{m:.6,ta:0,r:.3}],[51.8,1.6,'ear',{x:.5,y:.15}],[51.8,1.6,'field',{G:1.6}],
 // The moon settles and the tease of distant stars subsides — night water and stars, cool
 [54.9,2.4,'G',{x:.62,y:.4,m:.75,r:.7,ta:.6}],[55.0,2.4,'field',{veil:.35}],[55.0,2.4,'R',{m:.7}],[57.4,1.0,'G',{r:.6}],
 // and I can see a morning ahead from me — the colour turns to dawn; he steps aside for the road ahead
 [59.0,1.8,'G',{h:34,ta:.55,m:.9}],[59.0,1.6,'field',{veil:0}],[59.2,1.6,'G',{x:.66,y:.55,r:.8}],[59.2,1.6,'R',{x:.3,y:.4,r:.3}],[59.0,2,'ear',{x:.75,y:.75}],[59.0,2,'X',{m:.7}],
 // It looks like a morning I could believe in — he and the world in balance
 [62.4,1.4,'R',{r:.42,m:.9}],
 // a morning where loss and life aren't so well, ripe with sunlight that's deceptively warm — a breath out and in; warmth, a cold flicker, warmth
 [64.2,.9,'R',{m:.6}],[65.2,.9,'R',{m:.95}],[67.7,1.0,'G',{ta:.8,h:42}],[68.6,.35,'G',{h:210}],[69.2,.7,'G',{h:38}],
 // The chirping of birds, the fueling of nests, spring out of the night that has covered me — birds; he springs out of the night
 [71.0,1.6,'ear',{x:.82,y:.82}],[71.0,1.6,'X',{m:.85}],[71.0,1.6,'S',{m:.6}],[72.4,1.0,'R',{r:.18}],[73.4,1.2,'R',{r:.55,m:1}],[73.4,1.4,'G',{m:.6,r:.5,ta:.3}],
 // with my own curiosities for a chance at an end, where everything will be okay. Sweet chariot
 [77.0,3.0,'G',{x:.7,y:.5}],[79.2,1.4,'field',{G:1.0}],[79.2,1.4,'R',{ta:.3}],[81.6,1.4,'ear',{x:.8,y:.85}],
 // blissful and oddly innocent — the opening again: him alone, the road arriving where the bike arrived
 [83.3,1.4,'G',{m:.3,r:.3,x:.78,y:.5,ta:.25}],[83.4,1.3,'R',{x:.42,y:.42,r:.4,ta:.35}],[83.4,1.5,'ear',{x:.5,y:.5}],[83.4,1.4,'field',{G:1.6}],[85.0,1.4,'G',{m:.8,r:.42}],
 // riding it away that you can't help but double-click — the road drifts off; two clicks snap the field
 [86.4,2.0,'G',{x:.85}],[88.3,.8,'ear',{x:.8,y:.8}],[89.30,.06,'field',{G:12}],[89.42,.1,'field',{G:1.6}],[89.56,.06,'field',{G:12}],[89.68,.12,'field',{G:1.6}],
 // and prove, yeah, the magic it still exists — the far voice answers; the world goes; let's call it magic, right
 [90.0,1.5,'ear',{x:.5,y:.5}],[92.4,.4,'G',{e:.55}],[93.6,2.4,'G',{m:0}],[94.2,2,'G',{e:0}],[94.0,2.5,'S',{m:0}],[94.0,2.5,'X',{m:0}],[95.6,1.6,'R',{m:0}]];
/* tracks: per (who, value) the cues in order, with the value each one starts from, so evaluation is a lookup, not a replay */
const TRK={};
(function(){for(const c of SCORE)for(const[q,v]of Object.entries(c[3])){const id=c[2]+'.'+q;(TRK[id]=TRK[id]||[]).push([c[0],c[1],v])}
  for(const id in TRK){const a=TRK[id].sort((x,y)=>x[0]-y[0]),[w,q]=id.split('.'),v0=INIT[w][q];a.sv=[];for(let i=0;i<a.length;i++)a.sv[i]=i?segAt(a,i-1,a[i][0]):v0}})();
function segAt(a,i,c){return lerp(a.sv[i],a[i][2],smo((c-a[i][0])/Math.max(.001,a[i][1])))}
function val(w,q,c){const a=TRK[w+'.'+q];if(!a)return INIT[w][q];let i=-1;for(let j=0;j<a.length;j++){if(a[j][0]<=c)i=j;else break}return i<0?(a.sv[0]):segAt(a,i,c)}
function roles(){const o={};for(const w in ROLE)o[w]=NODES.find(k=>k.s.key===ROLE[w])||null;return o}
function applyDemo(c){const ro=roles();FMP.G=val('field','G',c);FMP.veil=val('field','veil',c);FMP.tang=val('field','tang',c);EAR.x=val('ear','x',c);EAR.y=val('ear','y',c);EAR.drag=EAR.glide=null;EAR.vx=EAR.vy=0;
  for(const w of ['R','G','C','M','F','S','X']){const k=ro[w];if(!k)continue;const I=INIT[w];k.on=true;k.link=true;k.drag=null;k.vx=k.vy=0;k.x=val(w,'x',c);k.y=val(w,'y',c);k.level=val(w,'m',c);
    if('r' in I){k.reach=val(w,'r',c);k.rS=k.reach}if('h' in I){k.ta=val(w,'ta',c);k.hue=k.ta>.01?val(w,'h',c):null;k.col=k.hue==null?0:k.hue/360}k.echo='e' in I?val(w,'e',c):0;
    k.mS=k.level*(inTake(k)?1:0);for(const d of KNOBS)k.kS[d.id]=k[d.id]}
  let best='gravity',bd=1e9;for(const m of FMODES){const T=FMT[m],d=Math.abs(Math.log(T.G/FMP.G))+Math.abs(T.veil-FMP.veil)*3+Math.abs(T.tang-FMP.tang)*3;if(d<bd){bd=d;best=m}}
  if(best!==FM){FM=best;$('fmodes').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.m===FM))}}
function startDemo(){if(POEM!==DEMO.poem||!roles().R){loadPoem(DEMO.poem);setTimeout(startDemo,1200);return}ensureAC();const ro=roles();for(const k of NODES){k.loop=null;k.mom=0;k.tone=0;applyTone(k);k.route.snd=k.s.kind!=='world'}
  ANC=ro.R;SEL=ro.R;seekD(ro.R,DEMO.c0);playD(ro.R,true);ro.R.spd=1;DEMO.on=true;DEMO.t0=performance.now();applyDemo(DEMO.c0);$('demo').classList.add('on');buzz([10,40,10],true)}
function stopDemo(){DEMO.on=false;$('demo').classList.remove('on');for(const k of NODES)k.echo=0;save()}
/* live: the score follows the reading's own clock, so every gesture lands on its word */
function demoTick(now){if(!DEMO.on)return;const ro=roles();if(!ro.R){stopDemo();return}const c=tD(ro.R);ANC=ro.R;SEL=ro.R;if(!playing(ro.R))playD(ro.R,true);
  DEMO.t0=now-(c-DEMO.c0)*1000;if(c>=DEMO.c1){stopDemo();for(const k of NODES)k.motor=0;return}applyDemo(c)}
/* offline: every source at exactly the frame's time, the same shader, and the sound mix the tool computes for that frame */
DEMO.renderAt=async function(t){OFFLINE=true;const c=DEMO.c0+t,ro=roles(),waits=[];ANC=ro.R;
  for(const k of NODES){const mt=fromClock(k.s,c),tt=clamp(mt,0,k.s.dur-.05);k._mt=mt;for(const e of k.els)if(!e.paused)e.pause();
    const v=k.els[0];if(Math.abs(v.currentTime-tt)>1e-3){if(k.s.video)waits.push(new Promise(r=>{const to=setTimeout(r,2500);v.addEventListener('seeked',()=>{clearTimeout(to);r()},{once:true})}));for(const e of k.els)e.currentTime=tt}}
  await Promise.all(waits);DEMO.on=true;applyDemo(c);field();drawOut();compose();const duck=duckAt(ro.R.s,c);const mix=NODES.map(k=>({key:k.s.key,kind:k.s.kind,files:k.s.files,mt:k._mt,dur:k.s.dur,g:gainOf(k,duck)}));DEMO.on=false;
  return{img:rc.toDataURL('image/jpeg',.9),mix}};
DEMO.prepare=function(w,h){OFFLINE=true;sizeOut(w,h);for(const k of NODES)k.route.snd=k.s.kind!=='world';return NODES.map(k=>k.s.key)};
