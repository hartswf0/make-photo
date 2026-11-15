/* Pack Donkey: world, camera, controls and sound. */
(function(){"use strict";
const T=window.THREE,$=id=>document.getElementById(id);
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const hash=(x,z=0)=>{const a=Math.sin(x*127.1+z*311.7+8.1)*43758.5453123;return a-Math.floor(a);};
function noise(x,z){
  const i=Math.floor(x),j=Math.floor(z),u=smooth(0,1,x-i),v=smooth(0,1,z-j);
  return lerp(lerp(hash(i,j),hash(i+1,j),u),lerp(hash(i,j+1),hash(i+1,j+1),u),v);
}
function fbm(x,z,o=4){let s=0,a=.5,f=1;for(let i=0;i<o;i++){s+=a*noise(x*f,z*f);a*=.5;f*=2.03;}return s;}

const canvas=$("view");
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene();
scene.fog=new T.FogExp2(0xb9b6ae,.003);
const camera=new T.PerspectiveCamera(38,1,.08,1400);
const world=new T.Group();scene.add(world);

/* ---------- terrain ---------- */
const CELL=1.4,N=360,HALF=CELL*N/2;
function ground(x,z){
  const r=Math.hypot(x,z);
  let h=(fbm(x*.011+3,z*.011+9)-.5)*9*smooth(6,60,r)+(noise(x*.06,z*.06)-.5)*1.1*smooth(3,22,r)+(noise(x*.33,z*.33)-.5)*.1;
  h+=5.2*Math.exp(-((x-20)*(x-20)+(z-34)*(z-34))/300);
  const m=smooth(105,250,r);
  if(m>0){const n=fbm(x*.0065+11,z*.0065+5,5),ridge=1-Math.abs(2*n-1);h+=m*m*(40+150*ridge*ridge+50*n);}
  return h;
}
const H=new Float32Array((N+1)*(N+1));
for(let j=0;j<=N;j++)for(let i=0;i<=N;i++)H[j*(N+1)+i]=ground(i*CELL-HALF,j*CELL-HALF);
function heightAt(x,z){
  const gx=clamp((x+HALF)/CELL,0,N-.001),gz=clamp((z+HALF)/CELL,0,N-.001),i=Math.floor(gx),j=Math.floor(gz),fx=gx-i,fz=gz-j;
  const a=H[j*(N+1)+i],b=H[j*(N+1)+i+1],c=H[(j+1)*(N+1)+i],d=H[(j+1)*(N+1)+i+1];
  return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
}
(function buildTerrain(){
  const pos=new Float32Array((N+1)*(N+1)*3),col=new Float32Array((N+1)*(N+1)*3),uv=new Float32Array((N+1)*(N+1)*2);
  const idx=new Uint32Array(N*N*6);
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
    const q=j*(N+1)+i,x=i*CELL-HALF,z=j*CELL-HALF,h=H[q];
    pos[q*3]=x;pos[q*3+1]=h;pos[q*3+2]=z;uv[q*2]=x/5;uv[q*2+1]=z/5;
    const hx=H[q+(i<N?1:-1)]-h,hz=H[q+(j<N?N+1:-N-1)]-h,sl=Math.hypot(hx,hz)/CELL;
    let g=lerp(.19,.36,smooth(.15,.7,sl))*(.8+.4*noise(x*.09,z*.09));
    g=lerp(g,.13,smooth(.55,.75,noise(x*.035+40,z*.035))*(1-smooth(.1,.4,sl)));
    g=lerp(g,.92,smooth(60,95,h+30*noise(x*.03,z*.03))*(1-smooth(.9,1.6,sl)));
    col[q*3]=col[q*3+1]=col[q*3+2]=g;
  }
  let k=0;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;
    idx[k++]=a;idx[k++]=c;idx[k++]=b;idx[k++]=b;idx[k++]=c;idx[k++]=d;
  }
  const g=new T.BufferGeometry();
  g.setAttribute("position",new T.BufferAttribute(pos,3));g.setAttribute("color",new T.BufferAttribute(col,3));
  g.setAttribute("uv",new T.BufferAttribute(uv,2));g.setIndex(new T.BufferAttribute(idx,1));g.computeVertexNormals();
  const c=document.createElement("canvas");c.width=c.height=512;const x=c.getContext("2d");
  x.fillStyle="#a8a8a8";x.fillRect(0,0,512,512);
  for(let i=0;i<26000;i++){
    const v=Math.floor(90+hash(i,1)*150),r=.5+hash(i,2)*hash(i,5)*3.4;
    x.fillStyle="rgba("+v+","+v+","+v+",.5)";x.beginPath();x.ellipse(hash(i,3)*512,hash(i,4)*512,r,r*.7,hash(i,6)*3,0,TAU);x.fill();
  }
  const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.NoColorSpace;tex.anisotropy=8;
  const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,map:tex,bumpMap:tex,bumpScale:2.5,roughness:1}));
  m.receiveShadow=true;world.add(m);
})();

/* rocks and pines */
const solids=[];
(function scatter(){
  const rg=new T.IcosahedronGeometry(1,2),p=rg.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),s=.72+.5*noise(x*1.7+5,y*1.7+z*1.3)+.12*noise(x*5,z*5+y*3);
    p.setXYZ(i,x*s,y*s*.72,z*s);
  }
  rg.computeVertexNormals();
  const count=1500,rocks=new T.InstancedMesh(rg,new T.MeshStandardMaterial({color:0x8c8a85,roughness:.95,flatShading:false}),count);
  const o=new T.Object3D(),c=new T.Color();
  for(let i=0;i<count;i++){
    const a=hash(i,11)*TAU,r=4+Math.pow(hash(i,12),.75)*150,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const big=hash(i,13)>.955,s=big?1+hash(i,14)*1.7:.06+Math.pow(hash(i,14),2.4)*.55;
    o.position.set(x,heightAt(x,z)-s*.22,z);o.rotation.set(hash(i,15)*.5,hash(i,16)*TAU,hash(i,17)*.5);
    o.scale.set(s*(.8+hash(i,18)*.5),s*(.6+hash(i,19)*.5),s);o.updateMatrix();rocks.setMatrixAt(i,o.matrix);
    const g=.5+hash(i,20)*.5;c.setRGB(g,g,g);rocks.setColorAt(i,c);
    if(big)solids.push([x,z,s*.95+.38]);
  }
  rocks.castShadow=rocks.receiveShadow=true;world.add(rocks);

  const parts=[];
  for(let i=0;i<9;i++){
    const t=i/8,g=new T.ConeGeometry(1.55*(1-t*.82)*(.85+.3*hash(i,41)),1.9,11,1,true),q=g.attributes.position;
    for(let v=0;v<q.count;v++){
      const a=Math.atan2(q.getZ(v),q.getX(v)),j=1+.22*Math.sin(a*5+i*1.7)+.12*Math.sin(a*11+i);
      if(q.getY(v)<0)q.setXYZ(v,q.getX(v)*j,q.getY(v)-.25*Math.abs(Math.sin(a*5+i)),q.getZ(v)*j);
    }
    g.translate(0,2.2+i*.95,0);g.computeVertexNormals();parts.push(g.toNonIndexed());
  }
  const trunk=new T.CylinderGeometry(.13,.26,4,7);trunk.translate(0,2,0);parts.push(trunk.toNonIndexed());
  const n=parts.reduce((s,g)=>s+g.attributes.position.count,0),P=new Float32Array(n*3),Nn=new Float32Array(n*3);
  let off=0;for(const g of parts){P.set(g.attributes.position.array,off);Nn.set(g.attributes.normal.array,off);off+=g.attributes.position.count*3;}
  const tg=new T.BufferGeometry();tg.setAttribute("position",new T.BufferAttribute(P,3));tg.setAttribute("normal",new T.BufferAttribute(Nn,3));
  const tc=420,trees=new T.InstancedMesh(tg,new T.MeshStandardMaterial({color:0x232421,roughness:1,side:T.DoubleSide}),tc);
  let k=0;
  for(let i=0;k<tc&&i<9000;i++){
    const x=(hash(i,31)-.5)*330,z=(hash(i,32)-.5)*330,r=Math.hypot(x,z);
    if(r<30||r>170||noise(x*.022+70,z*.022+20)<.56)continue;
    const s=.7+hash(i,33)*.9;
    o.position.set(x,heightAt(x,z)-.2,z);o.rotation.set(0,hash(i,34)*TAU,0);o.scale.set(s,s*(.9+hash(i,35)*.5),s);o.updateMatrix();
    trees.setMatrixAt(k++,o.matrix);solids.push([x,z,.55]);
  }
  trees.count=k;trees.castShadow=true;world.add(trees);
})();

/* trail post */
(function post(){
  const g=new T.Group(),wood=new T.MeshStandardMaterial({color:0x6d675d,roughness:.95});
  const px=3.2,pz=-5.5;g.position.set(px,heightAt(px,pz),pz);g.rotation.y=.5;
  const pole=new T.Mesh(new T.CylinderGeometry(.07,.09,1.9,7),wood);pole.position.y=.9;pole.rotation.z=.04;g.add(pole);
  const c=document.createElement("canvas");c.width=256;c.height=160;const x=c.getContext("2d");
  x.fillStyle="#7b756a";x.fillRect(0,0,256,160);x.strokeStyle="#2a2824";x.lineWidth=6;x.strokeRect(8,8,240,144);
  x.fillStyle="#1d1b18";x.textAlign="center";x.font="600 30px Georgia,serif";x.fillText("BURRO PASS",128,66);
  x.font="22px Georgia,serif";x.fillText("ELEV. 11,120 FT",128,112);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;
  const sign=new T.Mesh(new T.BoxGeometry(.52,.32,.035),[wood,wood,wood,wood,new T.MeshStandardMaterial({map:t,roughness:.9}),wood]);
  sign.position.set(.2,1.5,.08);sign.rotation.z=-.05;g.add(sign);
  g.traverse(o=>{o.castShadow=o.receiveShadow=true;});world.add(g);solids.push([px,pz,.45]);
})();

/* sky */
const sky=new T.Mesh(new T.SphereGeometry(1200,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,
  uniforms:{time:{value:0}},
  vertexShader:"varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader:`varying vec3 d;uniform float time;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  float f(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+7.;a*=.5;}return s;}
  void main(){vec3 v=normalize(d);float y=max(v.y,0.);
    float g=mix(.74,.1,pow(y,.45));
    vec2 p=v.xz/(y+.12)*1.1+vec2(time*.006,0.);
    float c=smoothstep(.5,.78,f(p))*smoothstep(.0,.12,y);
    float lit=.72+.3*f(p*2.3+3.);
    g=mix(g,lit,c*.92);
    gl_FragColor=vec4(vec3(g)*vec3(1.,.985,.95),1.);}`}));
sky.frustumCulled=false;world.add(sky);

/* light */
const hemi=new T.HemisphereLight(0xdcdcdc,0x5a5852,1.45);scene.add(hemi);
const sun=new T.DirectionalLight(0xffffff,2.9);
const sunDir=new T.Vector3(-.55,.72,.42).normalize();
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.012;
Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:1,far:70});
scene.add(sun,sun.target);
const fill=new T.DirectionalLight(0xffffff,.75);scene.add(fill,fill.target);

/* ---------- donkey ---------- */
const donkey=window.makeDonkey();scene.add(donkey.group);
donkey.place(0,0,-2.85,heightAt);
const S=donkey.state;

/* ---------- study plate: the donkey alone on paper, for comparing with reference sheets ---------- */
let study=false,saved=null;
const flat=()=>0,hf=(x,z)=>study?0:heightAt(x,z);
const catcher=new T.Mesh(new T.PlaneGeometry(80,80),new T.ShadowMaterial({opacity:.3}));
catcher.rotation.x=-Math.PI/2;catcher.receiveShadow=true;catcher.visible=false;scene.add(catcher);
const fogOut=scene.fog,paper=new T.Color(0xd9d5cb);
function setStudy(on){
  if(on===study)return;study=on;
  world.visible=!on;catcher.visible=on;scene.fog=on?null:fogOut;scene.background=on?paper:null;
  hemi.intensity=on?2.1:1.45;hemi.groundColor.set(on?0xa8a59c:0x5a5852);sun.intensity=on?2.0:2.9;
  if(on){saved=[S.x,S.z,S.heading];donkey.place(0,0,S.heading,flat);}
  else if(saved)donkey.place(saved[0],saved[1],saved[2],heightAt);
  document.body.classList.toggle("study",on);
  const b=$("b-study");if(b)b.setAttribute("aria-pressed",on);
  resize();
}

/* ---------- sound ---------- */
let audio=null,noiseBuf=null,muted=false;
function ensureAudio(){
  if(audio||muted)return;
  try{
    audio=new (window.AudioContext||window.webkitAudioContext)();
    noiseBuf=audio.createBuffer(1,audio.sampleRate*.3,audio.sampleRate);
    const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.4);
  }catch(e){audio=null;}
}
S.onStep=(L,gait)=>{
  if(!audio||muted)return;
  const t=audio.currentTime,src=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();
  src.buffer=noiseBuf;src.playbackRate.value=.55+Math.random()*.25+(L.front?.1:0);
  f.type="bandpass";f.frequency.value=260+Math.random()*160+gait*180;f.Q.value=1.1;
  g.gain.value=.16+gait*.18;src.connect(f).connect(g).connect(audio.destination);src.start(t);
};
function braySound(){
  if(!audio||muted)return;
  const t0=audio.currentTime+.12,o=audio.createOscillator(),f=audio.createBiquadFilter(),g=audio.createGain(),f2=audio.createBiquadFilter();
  o.type="sawtooth";f.type="bandpass";f.Q.value=4;f2.type="peaking";f2.frequency.value=2300;f2.gain.value=9;
  g.gain.setValueAtTime(0,t0);
  for(let i=0;i<3;i++){
    const t=t0+i*.72;
    o.frequency.setValueAtTime(520,t);o.frequency.linearRampToValueAtTime(760,t+.26);
    f.frequency.setValueAtTime(1500,t);g.gain.linearRampToValueAtTime(.16,t+.05);g.gain.linearRampToValueAtTime(.02,t+.29);
    o.frequency.setValueAtTime(250,t+.31);o.frequency.exponentialRampToValueAtTime(150,t+.68);
    f.frequency.setValueAtTime(820,t+.31);g.gain.linearRampToValueAtTime(.24,t+.38);g.gain.linearRampToValueAtTime(.01,t+.7);
  }
  g.gain.linearRampToValueAtTime(0,t0+2.3);
  o.connect(f).connect(f2).connect(g).connect(audio.destination);o.start(t0);o.stop(t0+2.4);
}

/* ---------- input ---------- */
const keys=new Set(),ctl={throttle:0,steer:0,trot:false};
const cam={yaw:2.45,pitch:.2,dist:4.6,view:0,manual:0,face:false,faceYaw:.7};
const views=[2.45,Math.PI/2,.55,Math.PI];
let trotLatch=false,packOn=true;
const stick={id:null,x:0,y:0,ox:0,oy:0};
const orbit={id:null,x:0,y:0};
let reel=-1,reelT=0;
function snort(){
  if(!audio||muted)return;
  const t=audio.currentTime,src=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();
  src.buffer=noiseBuf;src.playbackRate.value=.35;f.type="bandpass";f.frequency.value=420;f.Q.value=.8;
  g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.01,t+.5);src.connect(f).connect(g).connect(audio.destination);src.start(t);
}
S.onMood=id=>{
  if(id==="bray")braySound();
  if(id==="startled"||id==="annoyed"||id==="shake"||id==="kick"||id==="paw")snort();
};
function setMood(id){ensureAudio();donkey.setMood(id);}
const moodKeys={"1":"calm","2":"alert","3":"curious","4":"content","5":"sleepy","6":"annoyed","7":"startled","8":"bray","9":"flehmen","0":"yawn","-":"chew","=":"shake","[":"graze","]":"lick",";":"greet","'":"paw","\\":"kick"};
function act(name){
  ensureAudio();
  if(name==="pack"){packOn=!packOn;donkey.setPack(packOn);$("b-pack").setAttribute("aria-pressed",packOn);}
  if(name==="trot"){trotLatch=!trotLatch;$("b-trot").setAttribute("aria-pressed",trotLatch);}
  if(name==="bray")setMood("bray");
  if(name==="mood"){const i=donkey.moods.findIndex(m=>m.id===S.mood);setMood(donkey.moods[(i+1)%donkey.moods.length].id);}
  if(name==="face"){cam.face=!cam.face;$("b-face").setAttribute("aria-pressed",cam.face);}
  if(name==="reel"){reel=reel<0?0:-1;$("b-reel").setAttribute("aria-pressed",reel>=0);if(reel>=0){cam.face=true;$("b-face").setAttribute("aria-pressed",true);reelT=0;setMood(donkey.moods[0].id);}}
  if(name==="study")setStudy(!study);
  if(name==="view"){cam.view=(cam.view+1)%views.length;cam.yaw=views[cam.view];}
  if(name==="sound"){muted=!muted;$("b-sound").setAttribute("aria-pressed",!muted);if(!muted)ensureAudio();}
}
addEventListener("keydown",e=>{
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const k=e.key.toLowerCase();keys.add(k);ensureAudio();
  if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();
  if(e.repeat)return;
  if(k==="p")act("pack");if(k==="b"||k===" ")act("bray");if(k==="c")act("view");if(k==="t")act("trot");if(k==="m")act("sound");if(k==="f")act("face");if(k==="e")act("mood");if(k==="g")act("reel");if(moodKeys[k])setMood(moodKeys[k]);if(k==="v")act("study");
  if(k==="r")donkey.place(0,0,-2.85,hf);
});
addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
addEventListener("blur",()=>keys.clear());
for(const b of document.querySelectorAll("[data-act]"))b.addEventListener("click",e=>{act(b.dataset.act);b.blur();});
const pad=$("stick"),nub=$("nub");
canvas.addEventListener("pointerdown",e=>{
  ensureAudio();canvas.setPointerCapture(e.pointerId);
  if(e.pointerType==="touch"&&e.clientX<innerWidth*.45&&stick.id===null){
    stick.id=e.pointerId;stick.ox=e.clientX;stick.oy=e.clientY;stick.x=stick.y=0;
    pad.style.left=e.clientX+"px";pad.style.top=e.clientY+"px";pad.classList.add("on");nub.style.transform="";
  } else if(orbit.id===null){orbit.id=e.pointerId;orbit.x=e.clientX;orbit.y=e.clientY;}
});
canvas.addEventListener("pointermove",e=>{
  if(e.pointerId===stick.id){
    let dx=(e.clientX-stick.ox)/52,dy=(e.clientY-stick.oy)/52;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}
    stick.x=dx;stick.y=dy;nub.style.transform="translate("+dx*44+"px,"+dy*44+"px)";
  } else if(e.pointerId===orbit.id){
    if(cam.face)cam.faceYaw-=(e.clientX-orbit.x)*.0065;else cam.yaw-=(e.clientX-orbit.x)*.0065;cam.pitch=clamp(cam.pitch+(e.clientY-orbit.y)*.005,-.12,1.5);
    orbit.x=e.clientX;orbit.y=e.clientY;
  }
});
const release=e=>{
  if(e.pointerId===stick.id){stick.id=null;stick.x=stick.y=0;pad.classList.remove("on");}
  if(e.pointerId===orbit.id)orbit.id=null;
};
canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);
canvas.addEventListener("wheel",e=>{e.preventDefault();cam.dist=clamp(cam.dist*Math.exp(e.deltaY*.0012),1.7,16);},{passive:false});

/* ---------- loop ---------- */
function resize(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;
  camera.fov=study?(w<h?24:17):(w<h?52:38);camera.updateProjectionMatrix();
}
addEventListener("resize",resize);resize();
const faceP=new T.Vector3(),faceLook=new T.Vector3();let faceInit=false;
const look=new T.Vector3(),camPos=new T.Vector3(0,3,-6),want=new T.Vector3();
let camYaw=S.heading+cam.yaw,first=true;
const params=new URLSearchParams(location.search);
const demo=params.get("demo");
function step(dt){
  const kd=(a,b)=>(keys.has(a)||keys.has(b)?1:0);
  let th=kd("w","arrowup")-kd("s","arrowdown"),st=kd("a","arrowleft")-kd("d","arrowright");
  if(stick.id!==null){
    th=Math.abs(stick.y)>.15?-stick.y:0;st=Math.abs(stick.x)>.2?-stick.x:0;
    ctl.trot=trotLatch||Math.hypot(stick.x,stick.y)>.93&&th>.5;
  } else ctl.trot=trotLatch!==keys.has("shift");
  if(demo){th=1;ctl.trot=demo==="trot";st=demo==="turn"?1:demo==="spin"?(th=0,1):0;}
  ctl.throttle=th;ctl.steer=st;
  donkey.update(dt,ctl,hf);
  if(!study)for(const s of solids){
    const dx=S.x-s[0],dz=S.z-s[1],d=Math.hypot(dx,dz);
    if(d<s[2]&&d>1e-4){S.x=s[0]+dx/d*s[2];S.z=s[1]+dz/d*s[2];S.speed*=.9;}
  }
  const r=Math.hypot(S.x,S.z);if(!study&&r>150){S.x*=150/r;S.z*=150/r;}
  catcher.position.set(S.x,.002,S.z);

  /* camera */
  const target=S.heading+(cam.face&&cam.faceYaw!==null?cam.faceYaw:cam.yaw);
  camYaw+=Math.atan2(Math.sin(target-camYaw),Math.cos(target-camYaw))*(1-Math.exp(-dt*(orbit.id!==null?30:3.2)));
  if(reel>=0){reelT+=dt;if(reelT>3.7){reelT=0;reel=(reel+1)%donkey.moods.length;setMood(donkey.moods[reel].id);}}
  const lf=cam.lookF!==undefined?cam.lookF:(cam.face?.95:0),ly=cam.lookY||(cam.face?1.06:.92);
  look.set(S.x+Math.sin(S.heading)*lf,S.y+ly,S.z+Math.cos(S.heading)*lf);
  if(cam.face&&cam.lookF===undefined){donkey.faceAt(faceP);if(faceInit)faceLook.lerp(faceP,1-Math.exp(-dt*5));else{faceLook.copy(faceP);faceInit=true;}look.copy(faceLook);}else faceInit=false;
  const cp=Math.cos(cam.pitch),dist=cam.face&&!cam.rawDist?(study?3.6:1.7):cam.dist*(study?2.35:1);
  want.set(look.x+Math.sin(camYaw)*cp*dist,look.y+Math.sin(cam.pitch)*dist,look.z+Math.cos(camYaw)*cp*dist);
  if(!study||!cam.free)want.y=Math.max(want.y,hf(want.x,want.z)+.3);
  if(first){camPos.copy(want);first=false;}else camPos.lerp(want,1-Math.exp(-dt*9));
  camera.position.copy(camPos);camera.lookAt(look);
  sky.position.copy(camera.position);sky.material.uniforms.time.value+=dt;
  sun.target.position.copy(look);sun.position.copy(look).addScaledVector(sunDir,32);fill.target.position.copy(look);fill.position.set(look.x-sunDir.x*20,look.y+6,look.z-sunDir.z*20);

  $("gait").textContent=S.label;$("mood").textContent=donkey.moods.find(m=>m.id===S.mood).label;
  $("speed").textContent=Math.abs(S.speed).toFixed(1)+" m/s";
}
let last=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  step(dt);renderer.render(scene,camera);
  requestAnimationFrame(frame);
}
/* test hook: orthographic silhouette of the standing donkey, for scoring against reference sheets */
function orthoShot(view,cx,cy,halfW,halfH){
  setStudy(true);catcher.visible=false;
  const bg=scene.background;scene.background=new T.Color(0x00ff00);
  const o=new T.OrthographicCamera(-halfW,halfW,halfH,-halfH,.1,50),c=new T.Vector3(S.x,S.y,S.z);
  const f=new T.Vector3(Math.sin(S.heading),0,Math.cos(S.heading)),l=new T.Vector3(f.z,0,-f.x);
  if(view==="left"){o.position.copy(c).addScaledVector(l,10).addScaledVector(f,cx);o.position.y+=cy;o.lookAt(c.clone().addScaledVector(f,cx).setY(S.y+cy));}
  if(view==="front"){o.position.copy(c).addScaledVector(f,10).addScaledVector(l,cx);o.position.y+=cy;o.lookAt(c.clone().addScaledVector(l,cx).setY(S.y+cy));}
  if(view==="rear"){o.position.copy(c).addScaledVector(f,-10).addScaledVector(l,cx);o.position.y+=cy;o.lookAt(c.clone().addScaledVector(l,cx).setY(S.y+cy));}
  if(view==="top"){o.up.copy(l).negate();o.position.copy(c).addScaledVector(f,cx);o.position.y+=10;o.lookAt(c.clone().addScaledVector(f,cx));}
  renderer.render(scene,o);scene.background=bg;
}
if(params.get("mood"))donkey.setMood(params.get("mood"));
window.__pd={setMood,orthoShot,step,render:()=>renderer.render(scene,camera),donkey,cam,act,heightAt,setStudy,camera};
if(params.has("study"))setStudy(true);
if(!params.has("manual"))requestAnimationFrame(frame);
document.body.classList.add("ready");
})();
