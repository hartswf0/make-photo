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
const phone=matchMedia("(pointer:coarse)").matches||Math.min(innerWidth,innerHeight)<520;
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,phone?1.5:2));
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
  uniforms:{time:{value:0},dark:{value:1}},
  vertexShader:"varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader:`varying vec3 d;uniform float time,dark;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  float f(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+7.;a*=.5;}return s;}
  void main(){vec3 v=normalize(d);float y=max(v.y,0.);
    float g=mix(.74,.1,pow(y,.45))*dark;
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
sun.castShadow=true;sun.shadow.mapSize.set(phone?1024:2048,phone?1024:2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.012;
Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:1,far:70});
scene.add(sun,sun.target);
const fill=new T.DirectionalLight(0xffffff,.75);scene.add(fill,fill.target);

/* ---------- donkey ---------- */
const donkey=window.makeDonkey({shells:+new URLSearchParams(location.search).get("shells")||(phone?6:14)});scene.add(donkey.group);
donkey.place(0,0,-2.85,heightAt);
const S=donkey.state;

/* ---------- study plate: the donkey alone on paper, for comparing with reference sheets ---------- */
let study=false,saved=null;
const flat=()=>0,hf=(x,z)=>groundFn?groundFn(x,z):study?0:heightAt(x,z);
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
  g.gain.value=.16+gait*.18+S.g2*.2+S.hv*.12;src.connect(f).connect(g).connect(audio.destination);src.start(t);
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
let trotLatch=false,packOn=true,paceLatch=0,groundFn=null;
const stick={id:null,x:0,y:0,ox:0,oy:0};
const orbit={id:null,x:0,y:0};
/* ---------- the plate camera: tie the burro, unload, compose on the ground glass, expose ---------- */
const shot={on:false,yaw:0,pitch:.05,lens:1,filter:0,ev:0,used:0,broken:0,exposed:0,shock:0,plates:[],x:0,z:0};
const LENSES=[["Wide 6¾ in",52],["Normal 10 in",34],["Long 19 in",18]],FILTERS=[["No filter",1,1],["Yellow K2",.78,1.06],["Red A",.5,1.16]];
const rig=new T.Group();rig.visible=false;scene.add(rig);
(function buildRig(){
  const wood=new T.MeshStandardMaterial({color:0x4a4034,roughness:.7}),brass=new T.MeshStandardMaterial({color:0x8a8272,roughness:.35,metalness:.8}),
    black=new T.MeshStandardMaterial({color:0x0c0c0c,roughness:.9});
  for(let i=0;i<3;i++){
    const a=i/3*TAU+.5,leg=new T.Mesh(new T.CylinderGeometry(.014,.02,1.5,6),wood);
    leg.position.set(Math.sin(a)*.3,.7,Math.cos(a)*.3);leg.rotation.set(Math.cos(a)*.42,0,-Math.sin(a)*.42);rig.add(leg);
  }
  const head=new T.Mesh(new T.CylinderGeometry(.07,.07,.04,12),brass);head.position.y=1.36;rig.add(head);
  const body=new T.Group();body.position.y=1.5;rig.add(body);rig.userData.body=body;
  const back=new T.Mesh(new T.BoxGeometry(.3,.26,.05),wood);back.position.z=-.14;body.add(back);
  const front=new T.Mesh(new T.BoxGeometry(.22,.2,.03),wood);front.position.z=.12;body.add(front);
  for(let i=0;i<9;i++){const k=i/8,b=new T.Mesh(new T.BoxGeometry(lerp(.27,.19,k)+(i%2?.02:0),lerp(.23,.17,k)+(i%2?.02:0),.03),black);b.position.z=lerp(-.11,.1,k);body.add(b);}
  const lens=new T.Mesh(new T.CylinderGeometry(.04,.045,.07,14),brass);lens.rotation.x=Math.PI/2;lens.position.z=.165;body.add(lens);
  const bed=new T.Mesh(new T.BoxGeometry(.2,.02,.34),wood);bed.position.y=-.14;body.add(bed);
  const cloth=new T.Mesh(new T.SphereGeometry(.2,12,8,0,TAU,0,Math.PI*.55),black);cloth.position.set(0,-.02,-.2);cloth.scale.set(1,1.1,1.2);body.add(cloth);
  rig.traverse(o=>{if(o.isMesh)o.castShadow=true;});
})();
const packed=id=>{const it=items.find(i=>i.id===id);return it&&it.slot!=="-"&&!it.out;};
function say(t){const el=$("toast");el.textContent=t;el.hidden=false;clearTimeout(say.t);say.t=setTimeout(()=>{el.hidden=true;},3600);}
function unexposed(){return Math.max(0,24-shot.exposed-shot.broken);}
function camHud(){
  $("c-lens").textContent=LENSES[shot.lens][0];$("c-filter").textContent=FILTERS[shot.filter][0];
  $("c-ev").textContent="Exposure "+(shot.ev>0?"+":"")+shot.ev;
  const left=Math.min(12-shot.used,unexposed());
  $("c-count").textContent=left+" of 12 in the holders · "+unexposed()+" unexposed · "+shot.exposed+" exposed"+(shot.broken?" · "+shot.broken+" cracked":"");
  $("c-expose").disabled=left<=0;
}
function setUpCamera(){
  if(study){say("Leave the study plate first.");return;}
  if(S.down>0){say("Mistletoe is lying down.");return;}
  if(Math.abs(S.speed)>.15){say("Stop first. A burro will not hold a tripod.");return;}
  for(const [id,what] of [["camera","The view camera is not packed."],["tripod","No tripod on the load."],["holders","No plate holders on the load."]])if(!packed(id)){say(what);return;}
  for(const id of ["camera","tripod","holders"])items.find(i=>i.id===id).out=true;
  applyCargo();S.tethered=true;
  const fx=Math.sin(S.heading),fz=Math.cos(S.heading);
  shot.x=S.x+fz*2.4+fx*1.2;shot.z=S.z-fx*2.4+fz*1.2;shot.yaw=S.heading;shot.pitch=.04;
  rig.position.set(shot.x,hf(shot.x,shot.z),shot.z);rig.visible=true;
  shot.on=true;document.body.classList.add("cam");$("packing").hidden=true;$("mind").hidden=true;
  say("Mistletoe is tied. Camera and tripod are off the load: "+S.cargo.m.toFixed(1)+" kg left on.");camHud();
}
function packUpCamera(){
  for(const id of ["camera","tripod","holders"]){const it=items.find(i=>i.id===id);if(it)it.out=false;}
  applyCargo();S.tethered=false;shot.on=false;rig.visible=false;rig.userData.body.visible=true;document.body.classList.remove("cam");
  sky.material.uniforms.dark.value=1;renderer.toneMappingExposure=1.05;resize();
  say("Packed up. "+S.cargo.m.toFixed(1)+" kg on the load.");
}
function aimPlateCamera(){
  rig.rotation.y=shot.yaw;rig.userData.body.rotation.x=-shot.pitch;rig.userData.body.visible=false;
  const y=rig.position.y+1.5;
  camera.position.set(shot.x+Math.sin(shot.yaw)*.2,y,shot.z+Math.cos(shot.yaw)*.2);
  camera.rotation.set(0,0,0);camera.rotation.order="YXZ";camera.rotation.y=shot.yaw+Math.PI;camera.rotation.x=shot.pitch;
  const fov=LENSES[shot.lens][1];if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
  sky.material.uniforms.dark.value=FILTERS[shot.filter][1];renderer.toneMappingExposure=1.05*Math.pow(1.45,shot.ev)*FILTERS[shot.filter][2];
}
function expose(){
  if(!shot.on||Math.min(12-shot.used,unexposed())<=0)return;
  renderer.render(scene,camera);
  const src=renderer.domElement,W=850,H=650,c=document.createElement("canvas");c.width=W+60;c.height=H+60;
  const x=c.getContext("2d");x.fillStyle="#0b0b0a";x.fillRect(0,0,c.width,c.height);
  const sw=src.width,sh=src.height,ar=W/H;let cw=sw,ch=sw/ar;if(ch>sh){ch=sh;cw=sh*ar;}
  x.drawImage(src,(sw-cw)/2,(sh-ch)/2,cw,ch,30,30,W,H);
  const im=x.getImageData(30,30,W,H),d=im.data;
  for(let i=0;i<d.length;i+=4){
    const px=(i/4)%W,py=Math.floor(i/4/W),vx=px/W-.5,vy=py/H-.5;
    let g=(d[i]*.3+d[i+1]*.59+d[i+2]*.11)/255;g=(g-.42)*1.3+.5;g*=1-.5*(vx*vx+vy*vy);g+=(Math.random()-.5)*.035;
    g=clamp(g,0,1)*255;d[i]=g*1.0;d[i+1]=g*.975;d[i+2]=g*.93;
  }
  x.putImageData(im,30,30);
  x.fillStyle="#d9d5cb";x.font="13px Georgia,serif";x.fillText("PLATE "+(shot.exposed+1)+" · "+LENSES[shot.lens][0]+" · "+FILTERS[shot.filter][0],34,c.height-9);
  shot.plates.push(c.toDataURL("image/jpeg",.86));shot.used++;shot.exposed++;
  if(audio&&!muted){const t=audio.currentTime,s2=audio.createBufferSource(),g2=audio.createGain();s2.buffer=noiseBuf;s2.playbackRate.value=2.4;g2.gain.value=.5;s2.connect(g2).connect(audio.destination);s2.start(t);}
  $("flash").classList.remove("go");void $("flash").offsetWidth;$("flash").classList.add("go");
  say("Plate "+shot.exposed+" exposed. Dark slide in, holder flipped.");camHud();drawPlates();
}
function drawPlates(){
  const g=$("pl-grid");g.textContent="";
  $("pl-note").textContent=shot.plates.length?shot.plates.length+" exposed plate"+(shot.plates.length>1?"s":"")+" in the box. Tap one to look.":"No plates exposed yet. Set up the camera and expose one.";
  shot.plates.forEach((u,i)=>{const b=document.createElement("button");b.type="button";b.setAttribute("aria-label","Plate "+(i+1));const im=new Image();im.src=u;im.alt="Plate "+(i+1);b.append(im);
    b.addEventListener("click",()=>{$("pl-big").src=u;$("pl-big").hidden=false;});g.append(b);});
  $("pl-reload").disabled=!(shot.used>0&&unexposed()>0&&packed("tent")||shot.used>0&&unexposed()>0&&shot.on);
}
function plateShock(dt){ // glass rides on edge in the kyack; a walk is safe, bounding gaits crack it
  if(!packed("plates")||unexposed()<=0)return;
  shot.shock+=dt*(S.g2*.5+S.g3*.9)*(Math.abs(S.speed)>3?1:0);
  if(shot.shock>1){shot.shock=0;shot.broken++;say("A glass plate cracked in the kyack. "+unexposed()+" good plates left.");
    if(audio&&!muted){const t=audio.currentTime,s2=audio.createBufferSource(),f=audio.createBiquadFilter(),g2=audio.createGain();s2.buffer=noiseBuf;s2.playbackRate.value=3.2;f.type="highpass";f.frequency.value=3500;g2.gain.value=.5;s2.connect(f).connect(g2).connect(audio.destination);s2.start(t);}
  }
}
function drawMind(){
  const M=donkey.mind,rows=[["Hunger",M.hunger],["Tiredness",1-S.stamina],["Fear",M.fear],["Trust",M.trust],["Strain of what you ask",Math.min(1,M.strain)]];
  const el=$("mind-bars");
  if(!el.children.length)for(const r of rows){const d=document.createElement("div");d.className="mb";const s=document.createElement("span");s.textContent=r[0];const b=document.createElement("i");b.append(document.createElement("em"));d.append(s,b);el.append(d);}
  rows.forEach((r,i)=>{el.children[i].querySelector("em").style.width=Math.round(r[1]*100)+"%";});
}
let reel=-1,reelT=0;
/* ---------- packing: every item has a weight and a place; the donkey carries the sum ---------- */
const items=[
  {id:"camera",name:"6½ × 8½ view camera",note:"Wooden plate camera, bellows, lens boards and brass lenses",kg:9,slot:"L"},
  {id:"plates",name:"Glass dry plates",note:"Two dozen, packed on edge in a padded box. They crack at a canter",kg:11,slot:"R"},
  {id:"holders",name:"Plate holders",note:"Six double holders: twelve exposures before reloading in the dark",kg:6.5,slot:"L"},
  {id:"lenses",name:"Lens case",note:"Three lenses, shutter, lens board",kg:3,slot:"R"},
  {id:"filters",name:"Filters and meter",note:"Yellow, red and green glass; exposure meter",kg:1.2,slot:"L"},
  {id:"tripod",name:"Tripod",note:"Ash legs, brass fittings, lashed lengthwise on top",kg:5.5,slot:"T"},
  {id:"tent",name:"Dark cloth and changing tent",note:"For loading holders in the field",kg:2.5,slot:"T"},
  {id:"bedroll",name:"Bedroll",note:"Wool blankets in a canvas cover",kg:4,slot:"T"},
  {id:"water",name:"Water canteens",note:"Two gallons, the heaviest thing for its size",kg:8,slot:"R"},
  {id:"grain",name:"Grain sack",note:"Oats for the donkey",kg:10,slot:"-"},
  {id:"cook",name:"Cook kit",note:"Pot, pan, coffee, tins",kg:3.5,slot:"L"},
  {id:"tarp",name:"Coat and tarp",note:"Oilcloth for the load in rain",kg:3,slot:"T"}
];
const SLOTS=[["L","Left"],["T","Top"],["R","Right"],["-","Off"]];
function applyCargo(){return donkey.setCargo(items.filter(i=>i.slot!=="-"&&!i.out));}
function drawPacking(){
  const C=applyCargo(),list=$("pk-list");list.textContent="";
  for(const it of items){
    const row=document.createElement("div");row.className="pk-row"+(it.slot==="-"?" off":"");
    const txt=document.createElement("div");txt.className="pk-txt";
    const nm=document.createElement("b");nm.textContent=it.name;const kg=document.createElement("span");kg.textContent=it.kg.toFixed(1)+" kg";
    const nt=document.createElement("small");nt.textContent=it.note;txt.append(nm,kg,nt);
    const seg=document.createElement("div");seg.className="pk-seg";seg.setAttribute("role","group");seg.setAttribute("aria-label","Place "+it.name);
    for(const [id,label] of SLOTS){
      const b=document.createElement("button");b.type="button";b.textContent=label;b.setAttribute("aria-pressed",it.slot===id);
      b.addEventListener("click",()=>{it.slot=id;drawPacking();});seg.append(b);
    }
    row.append(txt,seg);list.append(row);
  }
  const diff=C.L-C.R,tilt=C.x*C.m;
  $("pk-total").textContent=C.m.toFixed(1)+" kg";
  $("pk-sides").textContent="Left "+C.L.toFixed(1)+" · Top "+C.T.toFixed(1)+" · Right "+C.R.toFixed(1);
  $("pk-dot").style.left=(50-clamp(tilt/8,-1,1)*46)+"%";
  $("pk-height").textContent=C.m?"Centre of gravity "+Math.round(C.y*100)+" cm above the ground":"Nothing loaded";
  const v=[];
  if(!C.m)v.push("Unloaded.");
  else{
    if(Math.abs(diff)<1.3)v.push("Balanced side to side, within three pounds.");else v.push("Lists "+(diff>0?"left":"right")+" by "+Math.abs(diff).toFixed(1)+" kg. Even the panniers or the saddle will turn.");
    if(C.T>C.m*.45&&C.T>12)v.push("Top-heavy: the load will sway in turns.");
    if(C.m>60)v.push("Overloaded. A donkey this size carries about 50 kg; it will tire fast and cannot run.");
    else if(C.m>45)v.push("A full load. Walk and trot only.");
  }
  $("pk-verdict").textContent=v.join(" ");
}
function snort(){
  if(!audio||muted)return;
  const t=audio.currentTime,src=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();
  src.buffer=noiseBuf;src.playbackRate.value=.35;f.type="bandpass";f.frequency.value=420;f.Q.value=.8;
  g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.01,t+.5);src.connect(f).connect(g).connect(audio.destination);src.start(t);
}
S.onMood=id=>{
  if(id==="collapse"){snort();return;}
  if(id==="bray")braySound();
  if(id==="startled"||id==="annoyed"||id==="shake"||id==="kick"||id==="paw")snort();
};
function setMood(id){ensureAudio();donkey.setMood(id);}
const moodKeys={"1":"calm","2":"alert","3":"curious","4":"content","5":"sleepy","6":"annoyed","7":"startled","8":"bray","9":"flehmen","0":"yawn","-":"chew","=":"shake","[":"graze","]":"lick",";":"greet","'":"paw","\\":"kick"};
function act(name){
  ensureAudio();
  if(name==="pack"){const p=$("packing");p.hidden=!p.hidden;$("b-pack").setAttribute("aria-pressed",!p.hidden);if(!p.hidden)drawPacking();}
  if(name==="trot"){paceLatch=(paceLatch+1)%4;$("b-trot").textContent=["Walk","Trot","Canter","Gallop"][paceLatch];$("b-trot").setAttribute("aria-pressed",paceLatch>0);}
  if(name==="lie")donkey.lie();
  if(name==="mind"){const p=$("mind");p.hidden=!p.hidden;$("b-mind").setAttribute("aria-pressed",!p.hidden);}
  if(name==="feed"){ensureAudio();donkey.feed();}
  if(name==="soothe"){ensureAudio();donkey.soothe();}
  if(name==="camera"){if(shot.on)packUpCamera();else setUpCamera();}
  if(name==="expose")expose();
  if(name==="lens"){shot.lens=(shot.lens+1)%LENSES.length;camHud();}
  if(name==="filter"){shot.filter=(shot.filter+1)%FILTERS.length;camHud();}
  if(name==="evup"){shot.ev=Math.min(2,shot.ev+1);camHud();}
  if(name==="evdn"){shot.ev=Math.max(-2,shot.ev-1);camHud();}
  if(name==="plates"){const p=$("platebox");p.hidden=!p.hidden;$("pl-big").hidden=true;if(!p.hidden)drawPlates();}
  if(name==="reload"){if(unexposed()>0){shot.used=0;say("Holders reloaded in the changing tent.");camHud();drawPlates();}}
  if(name==="more"){const b=document.querySelector(".bar");b.classList.toggle("open");$("b-more").setAttribute("aria-pressed",b.classList.contains("open"));}
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
  if(k==="p")act("pack");if(k==="b"||k===" ")act("bray");if(k==="c")act("view");if(k==="t")act("trot");if(k==="m")act("sound");if(k==="k")act("lie");if(k==="n")act("mind");if(k==="f")act("face");if(k==="e")act("mood");if(k==="g")act("reel");if(moodKeys[k])setMood(moodKeys[k]);if(k==="v")act("study");
  if(k==="o")act("camera");if(shot.on&&(k==="enter"||k===" "))expose();
  if(k==="r"&&!shot.on)donkey.place(0,0,-2.85,hf);
});
addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
addEventListener("blur",()=>keys.clear());
for(const b of document.querySelectorAll("[data-act]"))b.addEventListener("click",e=>{act(b.dataset.act);b.blur();});
const pad=$("stick"),nub=$("nub");
canvas.addEventListener("pointerdown",e=>{
  ensureAudio();canvas.setPointerCapture(e.pointerId);
  if(e.pointerType==="touch"&&e.clientX<innerWidth*.45&&stick.id===null&&!shot.on){
    stick.id=e.pointerId;stick.ox=e.clientX;stick.oy=e.clientY;stick.x=stick.y=0;
    pad.style.left=e.clientX+"px";pad.style.top=e.clientY+"px";pad.classList.add("on");nub.style.transform="";
  } else if(orbit.id===null){orbit.id=e.pointerId;orbit.x=e.clientX;orbit.y=e.clientY;}
});
canvas.addEventListener("pointermove",e=>{
  if(e.pointerId===stick.id){
    let dx=(e.clientX-stick.ox)/52,dy=(e.clientY-stick.oy)/52;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}
    stick.x=dx;stick.y=dy;nub.style.transform="translate("+dx*44+"px,"+dy*44+"px)";
  } else if(e.pointerId===orbit.id){
    if(pinch){orbit.x=e.clientX;orbit.y=e.clientY;return;}
    if(shot.on){const k=camera.fov/34*.0028;shot.yaw-=(e.clientX-orbit.x)*k;shot.pitch=clamp(shot.pitch-(e.clientY-orbit.y)*k,-.45,.7);orbit.x=e.clientX;orbit.y=e.clientY;return;}
    if(cam.face)cam.faceYaw-=(e.clientX-orbit.x)*.0065;else cam.yaw-=(e.clientX-orbit.x)*.0065;cam.pitch=clamp(cam.pitch+(e.clientY-orbit.y)*.005,-.12,1.5);
    orbit.x=e.clientX;orbit.y=e.clientY;
  }
});
const release=e=>{
  if(e.pointerId===stick.id){stick.id=null;stick.x=stick.y=0;pad.classList.remove("on");}
  if(e.pointerId===orbit.id)orbit.id=null;
};
canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);
const touches=new Map();let pinch=0;
canvas.addEventListener("pointerdown",e=>{if(e.pointerType==="touch")touches.set(e.pointerId,[e.clientX,e.clientY]);},true);
canvas.addEventListener("pointermove",e=>{
  if(!touches.has(e.pointerId))return;touches.set(e.pointerId,[e.clientX,e.clientY]);
  const free=[...touches.entries()].filter(([id])=>id!==stick.id).map(q=>q[1]);
  if(free.length===2){const d=Math.hypot(free[0][0]-free[1][0],free[0][1]-free[1][1]);if(pinch)cam.dist=clamp(cam.dist*pinch/d,1.7,16);pinch=d;}else pinch=0;
},true);
for(const ev of ["pointerup","pointercancel"])canvas.addEventListener(ev,e=>{touches.delete(e.pointerId);pinch=0;},true);
document.addEventListener("gesturestart",e=>e.preventDefault());
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
    ctl.trot=Math.hypot(stick.x,stick.y)>.93&&th>.5;
  } else ctl.trot=keys.has("shift");
  if(demo){th=1;ctl.trot=demo==="trot";st=demo==="turn"?1:demo==="spin"?(th=0,1):0;}
  ctl.pace=Math.max(ctl.trot?1:0,paceLatch,keys.has("x")?3:keys.has("z")?2:0);
  ctl.throttle=th;ctl.steer=st;
  { // what lies ahead: distance to the nearest rock or tree in the donkey's path
    const fx=Math.sin(S.heading),fz=Math.cos(S.heading);let near=99;
    if(!study)for(const s of solids){const dx=s[0]-S.x,dz=s[1]-S.z,a=dx*fx+dz*fz;if(a>0&&a<6&&Math.abs(dx*fz-dz*fx)<s[2]+.5)near=Math.min(near,a-s[2]);}
    ctl.near=near;
  }
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
  if(shot.on){const kk=dt*.9;if(keys.has("a")||keys.has("arrowleft"))shot.yaw+=kk;if(keys.has("d")||keys.has("arrowright"))shot.yaw-=kk;
    if(keys.has("w")||keys.has("arrowup"))shot.pitch=Math.min(.7,shot.pitch+kk*.6);if(keys.has("s")||keys.has("arrowdown"))shot.pitch=Math.max(-.45,shot.pitch-kk*.6);aimPlateCamera();}
  else plateShock(dt);
  sky.position.copy(camera.position);sky.material.uniforms.time.value+=dt;
  sun.target.position.copy(look);sun.position.copy(look).addScaledVector(sunDir,32);fill.target.position.copy(look);fill.position.set(look.x-sunDir.x*20,look.y+6,look.z-sunDir.z*20);

  $("stam").style.width=(S.stamina*100).toFixed(0)+"%";$("stam").parentNode.classList.toggle("low",S.stamina<.25);
  $("thought").textContent=S.thought||"";if(!$("mind").hidden)drawMind();
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
window.__pd={shot,setGround(f){groundFn=f;},setMood,orthoShot,step,render:()=>renderer.render(scene,camera),donkey,cam,act,heightAt,setStudy,camera};
if(params.has("study"))setStudy(true);
if(!params.has("manual"))requestAnimationFrame(frame);
applyCargo();
document.body.classList.add("ready");
})();
