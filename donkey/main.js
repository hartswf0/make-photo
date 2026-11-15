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
const LENSES=[["Wide 6¾ in",52],["Normal 10 in",34],["Long 19 in",18]],FILTERS=[["No filter",1,1,1],["Yellow K2 filter",.78,1.06,1.6],["Red A filter",.5,1.16,3.2]];
const STEPS=[
  ["tie","Tap Mistletoe to tie her to a picket."],
  ["tripod","Tap the tripod on top of her load."],
  ["legs","Tap the tripod to spread its legs."],
  ["case","Tap the left kyack to lift out the camera case."],
  ["mount","Tap the camera in the case to mount it."],
  ["bellows","Tap the camera to rack out the bellows."],
  ["lens","Tap the lens in the case."],
  ["cloth","Tap the camera back to drape the focusing cloth."]];
const STOPS=[["f/8",.3,5],["f/16",.8,3.2],["f/32",2.2,1.8],["f/64",6,.9]];
Object.assign(shot,{cur:0,t:0,busy:false,packing:false,glass:false,orbit:0,orbitP:.16,A:null,lid:true,ap:1,f:.3,sharp:1,holder:false,hk:0,slide:false,sk:0,
  shutter:false,expT:0,latent:null,fog:false,shake:0,shook:false,bored:0,ev:null,evT:0,frame:0,ticks:0});
const gear=new T.Group();gear.visible=false;scene.add(gear);
const G={},hits=[];
const glassRT=new T.WebGLRenderTarget(256,192);glassRT.texture.colorSpace=T.SRGBColorSpace;
const plateRT=new T.WebGLRenderTarget(850,650);plateRT.texture.colorSpace=T.SRGBColorSpace;
const lensCam=new T.PerspectiveCamera(34,850/650,.35,1400);
(function buildGear(){
  const wood=new T.MeshStandardMaterial({color:0x5a4c3c,roughness:.65}),walnut=new T.MeshStandardMaterial({color:0x3a3026,roughness:.6}),
    brass=new T.MeshStandardMaterial({color:0x9a917c,roughness:.3,metalness:.85}),black=new T.MeshStandardMaterial({color:0x0b0b0b,roughness:.92,side:T.DoubleSide}),
    iron=new T.MeshStandardMaterial({color:0x2b2b2a,roughness:.5,metalness:.6}),rubber=new T.MeshStandardMaterial({color:0x3a1e18,roughness:.6}),
    ghost=new T.MeshBasicMaterial({visible:false});
  const tag=(o,id)=>{o.userData.hit=id;hits.push(o);return o;};
  const box=(w,h,d,m,par,x,y,z)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x||0,y||0,z||0);o.castShadow=true;par.add(o);return o;};
  const proxy=(r,id)=>{const o=new T.Mesh(new T.SphereGeometry(r,8,6),ghost);gear.add(o);return tag(o,id);};
  G.hDonkey=proxy(.75,"donkey");G.hTop=proxy(.4,"top");G.hKyack=proxy(.4,"kyack");
  G.mark=new T.Mesh(new T.RingGeometry(.9,1,40),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8,depthTest:false,side:T.DoubleSide}));G.mark.renderOrder=9;gear.add(G.mark);
  G.stake=new T.Mesh(new T.CylinderGeometry(.02,.012,.6,7),iron);G.stake.castShadow=true;gear.add(G.stake);
  G.rope=new T.Line(new T.BufferGeometry().setAttribute("position",new T.BufferAttribute(new Float32Array(14*3),3)),new T.LineBasicMaterial({color:0xb9b09a}));G.rope.frustumCulled=false;gear.add(G.rope);
  G.tri=tag(new T.Group(),"tri");gear.add(G.tri);G.legs=[];
  for(let i=0;i<3;i++){
    const yaw=new T.Group();yaw.rotation.y=i/3*TAU+.5;G.tri.add(yaw);const tilt=new T.Group();yaw.add(tilt);
    const leg=new T.Mesh(new T.CylinderGeometry(.016,.022,1.45,7),wood);leg.position.y=-.725;leg.castShadow=true;tilt.add(leg);
    const spike=new T.Mesh(new T.ConeGeometry(.014,.07,6),brass);spike.position.y=-1.48;spike.rotation.x=Math.PI;tilt.add(spike);G.legs.push(tilt);
  }
  const puck=new T.Mesh(new T.CylinderGeometry(.075,.06,.05,14),brass);puck.castShadow=true;G.tri.add(puck);
  G.box=tag(new T.Group(),"box");gear.add(G.box);
  box(.5,.26,.38,walnut,G.box,0,.13,0);box(.46,.02,.34,black,G.box,0,.262,0);
  G.lid=tag(new T.Group(),"lid");G.lid.position.set(0,.26,-.19);G.box.add(G.lid);box(.5,.04,.38,walnut,G.lid,0,.02,.19);box(.06,.03,.02,brass,G.lid,0,.02,.385);
  /* six holders standing in the case, like books */
  G.spare=[];for(let i=0;i<5;i++)G.spare.push(box(.02,.2,.26,walnut,G.box,.2-i*.028,.2,0));
  G.cam=new T.Group();gear.add(G.cam);
  tag(box(.2,.022,.4,wood,G.cam,0,.011,0),"cam");for(const x of [-.085,.085])box(.012,.012,.4,brass,G.cam,x,.028,0);
  G.back=tag(new T.Group(),"glass");G.back.position.set(0,.17,-.16);G.cam.add(G.back);
  box(.32,.28,.045,wood,G.back);for(const y of [-.15,.15])box(.34,.016,.05,brass,G.back,0,y,0);
  G.glass=new T.Mesh(new T.PlaneGeometry(.26,.2),new T.MeshBasicMaterial({map:glassRT.texture,color:0xbdbab0}));G.glass.rotation.y=Math.PI;G.glass.position.z=-.0235;G.back.add(G.glass);
  G.front=tag(new T.Group(),"cam");G.cam.add(G.front);box(.2,.2,.028,wood,G.front);box(.05,.3,.012,brass,G.front,-.115,-.02,0);box(.05,.3,.012,brass,G.front,.115,-.02,0);
  G.knob=tag(new T.Mesh(new T.CylinderGeometry(.028,.028,.03,14),brass),"knob");G.knob.rotation.z=Math.PI/2;G.knob.position.set(.13,.03,.02);G.cam.add(G.knob);
  G.bell=[];for(let i=0;i<10;i++)G.bell.push(box(1,1,.02,black,G.cam));
  G.cloth=tag(new T.Mesh(new T.SphereGeometry(.24,14,10,0,TAU,0,Math.PI*.6),black),"glass");G.cloth.position.set(0,.22,-.27);G.cloth.castShadow=true;G.cam.add(G.cloth);
  G.holder=tag(box(.28,.24,.022,walnut,gear),"holder");G.slide=tag(box(.25,.23,.006,black,gear),"slide");box(.1,.02,.01,brass,G.slide,0,.125,0);
  G.lens=tag(new T.Group(),"lens");gear.add(G.lens);box(.12,.12,.012,walnut,G.lens);
  const barrel=new T.Mesh(new T.CylinderGeometry(.038,.042,.08,16),brass);barrel.rotation.x=Math.PI/2;barrel.position.z=.045;barrel.castShadow=true;G.lens.add(barrel);
  G.iris=new T.Mesh(new T.CircleGeometry(.03,16),new T.MeshPhysicalMaterial({color:0x050505,roughness:.05,clearcoat:1}));G.iris.position.z=.086;G.lens.add(G.iris);
  G.filt=new T.Mesh(new T.CylinderGeometry(.046,.046,.008,18),new T.MeshPhysicalMaterial({color:0x555555,roughness:.05,transparent:true,opacity:.55}));G.filt.rotation.x=Math.PI/2;G.filt.position.z=.094;G.lens.add(G.filt);
  const hose=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(.04,0,.05),new T.Vector3(.1,-.08,.02),new T.Vector3(.13,-.22,-.05),new T.Vector3(.1,-.34,-.1)]),12,.005,5),rubber);G.lens.add(hose);
  G.bulb=tag(new T.Mesh(new T.SphereGeometry(.034,12,10),rubber),"bulb");G.bulb.position.set(.1,-.37,-.1);G.bulb.scale.set(1,1.3,1);G.lens.add(G.bulb);
  G.filtCase=tag(new T.Mesh(new T.CylinderGeometry(.046,.046,.012,18),new T.MeshStandardMaterial({color:0x777468,roughness:.3})),"filter");gear.add(G.filtCase);
})();
const packed=id=>{const it=items.find(i=>i.id===id);return it&&it.slot!=="-"&&!it.out;};
function say(t,keep){const el=$("toast");el.textContent=t;el.hidden=false;clearTimeout(say.t);say.t=setTimeout(()=>{el.hidden=true;},keep||4200);}
function tick(rate,gain,hp){if(!audio||muted)return;const t=audio.currentTime,s2=audio.createBufferSource(),g2=audio.createGain();s2.buffer=noiseBuf;s2.playbackRate.value=rate;g2.gain.value=gain;
  if(hp){const f=audio.createBiquadFilter();f.type="highpass";f.frequency.value=hp;s2.connect(f).connect(g2);}else s2.connect(g2);g2.connect(audio.destination);s2.start(t);}
function unexposed(){return Math.max(0,24-shot.exposed-shot.broken);}
function ready(){return shot.cur>=STEPS.length;}
function camHud(){
  $("c-count").textContent=Math.min(12-shot.used,unexposed())+" holder sides · "+unexposed()+" good plates"+(shot.broken?" · "+shot.broken+" cracked":"")+" · "+shot.exposed+" exposed";
  $("c-back").hidden=!shot.glass;$("knob").hidden=!shot.glass;
}
function prompt(){
  if(!ready()){say(STEPS[shot.cur][1],60000);return;}
  if(shot.glass){say("Drag to aim. Turn the brass knob to focus.",5000);return;}
  if(!shot.holder)say("Tap the ground glass to compose. Lens ring: stop. Filter in the case. Holder in the case when ready.",9000);
  else if(!shot.slide&&!shot.latent)say("Holder is in. Tap the dark slide to pull it.",8000);
  else if(shot.slide&&!shot.latent)say("Squeeze and hold the bulb: about "+needT().toFixed(1)+" s at "+STOPS[shot.ap][0]+".",9000);
  else if(shot.slide)say("Push the dark slide back in before you take the holder out.",8000);
  else say("Tap the holder to take it out.",8000);
}
function needT(){return STOPS[shot.ap][1]*FILTERS[shot.filter][3];}
function setGlass(on){if(on&&shot.holder){say("The holder covers the ground glass. Nothing to see.");return;}shot.glass=on;document.body.classList.toggle("glass",on);camHud();prompt();}
function setUpCamera(){
  if(study){say("Leave the study plate first.");return;}
  if(S.down>0){say("Mistletoe is lying down.");return;}
  if(Math.abs(S.speed)>.15){say("Stop first. A burro will not hold a tripod.");return;}
  for(const [id,what] of [["camera","The view camera is not packed."],["tripod","No tripod on the load."],["holders","No plate holders on the load."]])if(!packed(id)){say(what);return;}
  const fx=Math.sin(S.heading),fz=Math.cos(S.heading),lx=fz,lz=-fx,A={};
  const at=(side,fwd)=>{const x=S.x+lx*side+fx*fwd,z=S.z+lz*side+fz*fwd;return new T.Vector3(x,hf(x,z),z);};
  A.spot=at(2.3,1.3);A.box=at(1.5,2.0);A.stake=at(.55,1.75);A.head=S.heading;A.home=new T.Vector3(S.x,0,S.z);
  Object.assign(shot,{A,x:A.spot.x,z:A.spot.z,yaw:S.heading,pitch:.04,cur:0,t:0,busy:false,packing:false,lid:true,holder:false,hk:0,slide:false,sk:0,shutter:false,latent:null,fog:false,
    bored:0,ev:null,cp:null,orbitP:.16,orbit:Math.atan2(A.spot.x-S.x,A.spot.z-S.z)+.75});
  S.tethered=true;shot.on=true;gear.visible=true;document.body.classList.add("cam");$("packing").hidden=true;$("mind").hidden=true;camHud();prompt();
}
function advance(){
  if(shot.busy||shot.packing||ready())return;
  shot.busy=true;shot.t=0;tick(1.6,.35);
  if(shot.cur===1){items.find(i=>i.id==="tripod").out=true;applyCargo();}
  if(shot.cur===3){items.find(i=>i.id==="camera").out=true;items.find(i=>i.id==="holders").out=true;applyCargo();}
}
function packUpCamera(){if(!shot.on||shot.packing)return;if(shot.glass)setGlass(false);shot.packing=true;shot.busy=false;shot.holder=false;shot.slide=false;S.goal=null;S.faceTo=null;
  if(ready()){shot.cur=STEPS.length-1;shot.t=1;}say("Packing up.");}
function finishPackUp(){
  for(const id of ["camera","tripod","holders"]){const it=items.find(i=>i.id===id);if(it)it.out=false;}
  applyCargo();S.tethered=false;S.goal=null;S.faceTo=null;shot.on=false;shot.packing=false;gear.visible=false;document.body.classList.remove("cam");resize();
  say("Packed up. "+S.cargo.m.toFixed(1)+" kg on the load.");
}
/* ---- handling the camera: every control is the object itself ---- */
function tapGear(ids){
  if(shot.packing||shot.busy)return;
  if(shot.cur===0){advance();return;}
  if(!ready()){
    const want=STEPS[shot.cur][0],ok={tripod:["top","tri"],legs:["tri"],case:["kyack"],mount:["box","cam","lid","glass"],bellows:["cam","glass","knob"],lens:["lens","box","lid"],cloth:["glass","cam"]}[want]||[];
    if(ids.some(i=>ok.includes(i)))advance();else if(ids[0]==="donkey")say("She leans into the scratch. "+STEPS[shot.cur][1],8000);else say(STEPS[shot.cur][1],60000);return;
  }
  if(!shot.holder)ids=ids.map(i=>i==="slide"?"holder":i);
  let id=ids.find(i=>["slide","holder","filter","knob","lens","lid"].includes(i))||ids.find(i=>i!=="donkey"&&i!=="tri")||ids[0];
  if(shot.holder&&(ids.includes("slide")||ids.includes("holder")))id=shot.slide?"slide":shot.latent?"holder":"slide";
  if(id==="donkey"){
    if(shot.cur===0){advance();return;}
    shot.bored=0;shot.ev=null;S.goal={x:shot.A.home.x,z:shot.A.home.z};S.goalWhy="Going back.";S.faceTo=null;donkey.soothe();
    say(packed("grain")?"A handful of oats and a scratch. She settles.":"A scratch behind the ears. She settles.");if(packed("grain"))donkey.mind.hunger=Math.max(0,donkey.mind.hunger-.4);return;
  }
  if(id==="lid"||id==="box"){shot.lid=!shot.lid;tick(1.2,.4);say(shot.lid?"Case open.":"Case shut. The plates are safe from a curious nose.");return;}
  if(id==="glass"){setGlass(!shot.glass);return;}
  if(id==="lens"){shot.ap=(shot.ap+1)%STOPS.length;tick(3,.25);say("Stopped to "+STOPS[shot.ap][0]+". Needs about "+needT().toFixed(1)+" s."+(shot.ap===3?" Everything sharp.":""));return;}
  if(id==="filter"){if(!shot.lid){say("The case is shut.");return;}shot.filter=(shot.filter+1)%FILTERS.length;tick(2.6,.25);say(FILTERS[shot.filter][0]+(shot.filter?" on the lens. Needs about "+needT().toFixed(1)+" s.":". Bare lens."));return;}
  if(id==="holder"){
    if(!shot.holder){
      if(!shot.lid){say("The case is shut.");return;}
      if(Math.min(12-shot.used,unexposed())<=0){say(unexposed()?"All twelve sides are used. Reload in the changing tent (plate box).":"No good plates left.");return;}
      if(shot.glass)setGlass(false);shot.holder=true;shot.latent=null;shot.fog=false;tick(1.5,.4);prompt();
    } else {
      if(shot.slide){shot.fog=true;say("You pulled the holder with the slide out. That plate is fogged.");}
      shot.holder=false;shot.slide=false;tick(1.5,.4);develop();
    }
    return;
  }
  if(id==="slide"){if(!shot.holder)return;shot.slide=!shot.slide;tick(2.2,.3,1500);prompt();return;}
  if(id==="knob"){say("Drag the knob to focus.");return;}
}
function pressBulb(down){
  if(!ready())return;
  if(down){
    shot.shutter=true;shot.expT=0;shot.ticks=0;shot.shook=false;tick(2.8,.5);
    if(shot.holder&&shot.slide){renderLens(plateRT);const px=new Uint8Array(850*650*4);renderer.readRenderTargetPixels(plateRT,0,0,850,650,px);shot.latent={px,sharp:shot.sharp,double:!!shot.latent};}
  } else if(shot.shutter){
    shot.shutter=false;tick(2.8,.4);
    if(!shot.holder)say("Click. No plate in the camera.");
    else if(!shot.slide)say("Click. The dark slide was still in. Nothing recorded.");
    else{shot.latent.t=(shot.latent.t||0)+shot.expT;shot.latent.shook=shot.latent.shook||shot.shook;prompt();}
  }
}
function renderLens(rt){
  G.cam.updateMatrixWorld(true);G.front.localToWorld(_v.set(0,0,.12));lensCam.position.copy(_v);G.cam.getWorldQuaternion(_q);lensCam.quaternion.copy(_q).multiply(_q2.setFromAxisAngle(_up,Math.PI));
  lensCam.updateMatrixWorld(true);sky.material.uniforms.dark.value=FILTERS[shot.filter][1];
  const gv=gear.visible;gear.visible=false;renderer.setRenderTarget(rt);renderer.render(scene,lensCam);renderer.setRenderTarget(null);gear.visible=gv;sky.material.uniforms.dark.value=1;
}
function develop(){
  if(!shot.latent&&!shot.fog)return;
  shot.used++;shot.exposed++;
  const W=850,H=650,c=document.createElement("canvas");c.width=W+60;c.height=H+60;const x=c.getContext("2d");x.fillStyle="#0b0b0a";x.fillRect(0,0,c.width,c.height);
  const im=x.createImageData(W,H),d=im.data,L=shot.latent,r=L?L.t/needT():0,gain=L?Math.pow(clamp(r,.08,6),.75):0,soft=L?Math.round((1-L.sharp)*7):0,con=FILTERS[shot.filter][2];
  let note="";
  for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){
    const o=(y*W+xx)*4;let g=0;
    if(L){
      const sy=H-1-y;let acc=0,n=0;
      for(let k=-soft;k<=soft;k+=Math.max(1,soft)){const a=(sy*W+clamp(xx+k,0,W-1))*4,b2=(clamp(sy+k,0,H-1)*W+xx)*4;acc+=L.px[a]*.3+L.px[a+1]*.59+L.px[a+2]*.11+L.px[b2]*.3+L.px[b2+1]*.59+L.px[b2+2]*.11;n+=2;}
      g=acc/n/255;
      if(L.shook){const a=(sy*W+clamp(xx+22,0,W-1))*4;g=g*.55+(L.px[a]*.3+L.px[a+1]*.59+L.px[a+2]*.11)/255*.45;}
      g=((g-.42)*1.25*con+.5)*gain;
    }
    if(shot.fog)g=.82+g*.1;
    const vx=xx/W-.5,vy=y/H-.5;g*=1-.5*(vx*vx+vy*vy);g+=(Math.random()-.5)*.04;g=clamp(g,0,1)*255;d[o]=g;d[o+1]=g*.975;d[o+2]=g*.93;d[o+3]=255;
  }
  x.putImageData(im,30,30);
  if(shot.fog)note="Fogged";else if(!L)note="Blank";else note=(r<.45?"Thin, underexposed":r>2.4?"Dense, overexposed":"Good exposure")+(L.sharp<.6?", soft focus":"")+(L.shook?", shaken":"")+(L.double?", double exposure":"");
  x.fillStyle="#d9d5cb";x.font="13px Georgia,serif";x.fillText("PLATE "+shot.exposed+" · "+STOPS[shot.ap][0]+" · "+(L?L.t.toFixed(1):"0")+" s · "+FILTERS[shot.filter][0]+" · "+note,34,c.height-9);
  shot.plates.push(c.toDataURL("image/jpeg",.86));shot.latent=null;shot.fog=false;
  say("Plate "+shot.exposed+": "+note.toLowerCase()+". It is in the plate box.");camHud();drawPlates();
}
/* ---- Mistletoe gets bored ---- */
function mischief(dt){
  const A=shot.A,M=donkey.mind;
  if(shot.ev){
    shot.evT-=dt;
    if(S.arrived){S.arrived=false;
      if(shot.ev==="nose"){if(shot.lid&&unexposed()>0){shot.broken++;tick(3.2,.5,3500);say("Mistletoe nosed into the open case. A plate cracked. Shut the lid next time.");camHud();}else say("Mistletoe sniffed at the case and found it shut.");donkey.setMood("curious");shot.evT=3;}
      if(shot.ev==="bump"){shot.yaw+=(hash(S.time)-.5)*.3;shot.pitch+=.06;shot.shook=true;shot.shake=1;tick(1.1,.5);say("She leaned on the tripod. Your framing has moved"+(shot.shutter?" and the plate is shaken.":"."));shot.evT=2.5;}
      if(shot.ev==="bomb"){S.faceTo=Math.atan2(A.spot.x-S.x,A.spot.z-S.z);donkey.setMood("curious");say("Mistletoe has walked into your picture.");shot.evT=9;}
    }
    if(shot.evT<=0){shot.ev=null;S.faceTo=null;S.goal={x:A.home.x,z:A.home.z};S.goalWhy="Bored of that.";}
    return;
  }
  if(shot.cur<3||S.goal)return;
  shot.bored+=dt*(.035+.05*M.hunger)*(shot.shutter?.3:1);
  if(shot.bored>1){
    shot.bored=0;const r=hash(S.time*2.1),ev=r<.4?"nose":r<.7?"bomb":"bump";shot.ev=ev;shot.evT=14;S.arrived=false;
    const to=(x,z,why)=>{S.goal={x,z};S.goalWhy=why;};
    if(ev==="nose")to(lerp(A.box.x,A.home.x,.3),lerp(A.box.z,A.home.z,.3),"What is in that box?");
    if(ev==="bump")to(lerp(A.spot.x,A.home.x,.28),lerp(A.spot.z,A.home.z,.28),"That thing is in my way.");
    if(ev==="bomb")to(A.spot.x+Math.sin(shot.yaw)*2.7,A.spot.z+Math.cos(shot.yaw)*2.7,"What are you looking at?");
  }
}
const _v=new T.Vector3(),_q=new T.Quaternion(),_q2=new T.Quaternion(),_up=new T.Vector3(0,1,0),_ray=new T.Raycaster(),_nd=new T.Vector2();
function pick(e){_nd.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);_ray.setFromCamera(_nd,camera);
  const out=[];for(const h of _ray.intersectObjects(hits,true)){let o=h.object,vis=true;for(let q=o;q;q=q.parent)if(q.visible===false)vis=false;while(o&&!o.userData.hit)o=o.parent;if(o&&vis&&!out.includes(o.userData.hit))out.push(o.userData.hit);}return out;}
let tapS=null;
canvas.addEventListener("pointerdown",e=>{if(!shot.on)return;ensureAudio();tapS={x:e.clientX,y:e.clientY,t:performance.now(),id:pick(e)};
  if(tapS.id[0]==="bulb"&&!shot.glass){pressBulb(true);tapS.bulb=true;}else if(tapS.id[0]==="knob")tapS.knob=true;},true);
canvas.addEventListener("pointermove",e=>{if(tapS&&tapS.knob&&shot.on){shot.f=clamp(shot.f+(e.movementX||0)*.004,0,1);}},true);
for(const ev of ["pointerup","pointercancel"])canvas.addEventListener(ev,e=>{if(!tapS)return;const s=tapS;tapS=null;if(s.bulb){pressBulb(false);return;}
  if(shot.on&&!shot.glass&&ev==="pointerup"&&Math.hypot(e.clientX-s.x,e.clientY-s.y)<10&&performance.now()-s.t<500&&s.id.length)tapGear(s.id);},true);
(function knob(){const k=$("knob");let on=false,lx=0;
  k.addEventListener("pointerdown",e=>{on=true;lx=e.clientX;k.setPointerCapture(e.pointerId);});
  k.addEventListener("pointermove",e=>{if(!on)return;shot.f=clamp(shot.f+(e.clientX-lx)*.004,0,1);lx=e.clientX;k.style.setProperty("--a",(shot.f*540)+"deg");});
  k.addEventListener("pointerup",()=>{on=false;});k.addEventListener("pointercancel",()=>{on=false;});})();
function stepRig(dt){
  const A=shot.A,ez=k=>k*k*(3-2*k);shot.frame++;
  if(shot.packing){
    if(shot.t>0)shot.t=Math.max(0,shot.t-dt*2.6);
    else if(shot.cur>0){shot.cur--;shot.t=1;tick(1.4,.25);
      if(shot.cur===3){items.find(i=>i.id==="camera").out=false;items.find(i=>i.id==="holders").out=false;applyCargo();}
      if(shot.cur===1){items.find(i=>i.id==="tripod").out=false;applyCargo();}}
    else{finishPackUp();return;}
  } else if(shot.busy){shot.t+=dt/1.1;if(shot.t>=1){shot.t=0;shot.cur++;shot.busy=false;tick(2.2,.3);camHud();prompt();}}
  else mischief(dt);
  const p=i=>i<shot.cur?1:i===shot.cur?ez(clamp(shot.t,0,1)):0,arc=k=>Math.sin(Math.PI*k);
  donkey.group.updateMatrixWorld(true);donkey.group.localToWorld(G.hDonkey.position.set(0,.95,.15));
  donkey.group.localToWorld(G.hTop.position.set(0,1.4,.1));donkey.group.localToWorld(G.hKyack.position.set(.42,.95,.03));
  const top=G.hTop.position,ky=G.hKyack.position;
  G.stake.position.set(A.stake.x,A.stake.y+.3-.5*(1-p(0)),A.stake.z);G.stake.visible=p(0)>0;G.rope.visible=p(0)>.5;
  if(G.rope.visible){donkey.faceAt(_v);const P=G.rope.geometry.attributes.position,slack=clamp(1-_v.distanceTo(A.stake)/3.4,0,1);
    for(let i=0;i<14;i++){const k=i/13;P.setXYZ(i,lerp(_v.x,A.stake.x,k),lerp(_v.y-.12,A.stake.y+.5,k)-Math.sin(Math.PI*k)*(.1+.5*slack),lerp(_v.z,A.stake.z,k));}P.needsUpdate=true;}
  const a=lerp(.035,.4,p(2)),hy=1.47*Math.cos(a),k1=p(1);
  G.tri.visible=shot.cur>=1||k1>0||true;
  G.tri.position.set(lerp(top.x,A.spot.x,k1),lerp(top.y+.02,A.spot.y+hy,k1)+arc(k1)*.35,lerp(top.z,A.spot.z,k1));
  G.tri.rotation.set(lerp(Math.PI/2,0,k1),lerp(S.heading,A.head,k1),0);for(const L of G.legs)L.rotation.x=a;
  const k3=p(3),kc=ez(clamp(k3/.7,0,1));
  G.box.visible=k3>0;G.box.position.set(lerp(ky.x,A.box.x,kc),lerp(ky.y,A.box.y,kc)+arc(kc)*.4,lerp(ky.z,A.box.z,kc));G.box.rotation.y=A.head+.5;
  shot.lidK=lerp(shot.lidK||0,k3>=1&&shot.lid&&!shot.packing?1:ez(clamp((k3-.7)/.3,0,1))*(shot.lid?1:0),1-Math.exp(-dt*8));G.lid.rotation.x=-1.9*shot.lidK;
  const k4=p(4),e=p(5)*(.62+.38*shot.f),headY=A.spot.y+1.47*Math.cos(.4)+.03;
  shot.shake=Math.max(0,shot.shake-dt*1.5);const jit=shot.shake*.04*Math.sin(S.time*60);
  G.cam.visible=k3>=1||shot.cur>3;
  G.cam.position.set(lerp(A.box.x,A.spot.x,k4),lerp(A.box.y+.06,headY,k4)+arc(k4)*.3,lerp(A.box.z,A.spot.z,k4));
  G.cam.rotation.order="YXZ";G.cam.rotation.set(-shot.pitch*k4+jit,lerp(A.head+.5,shot.yaw,k4)+jit,0);G.cam.scale.setScalar(lerp(.86,1,k4));
  const fzz=lerp(-.1,.15,e);G.front.position.set(0,.17,fzz);G.knob.rotation.x=shot.f*9;
  G.bell.forEach((b,i)=>{const k=i/9;b.position.set(0,.17,lerp(-.135,fzz-.02,k));b.scale.set(lerp(.27,.17,k)+(i%2?.025:0),lerp(.23,.17,k)+(i%2?.025:0),1);});
  G.cloth.visible=p(7)>0&&!shot.holder;G.cloth.scale.set(.72,.62*p(7),.85);
  const k6=p(6);G.lens.visible=G.box.visible&&k3>=1;
  G.cam.updateMatrixWorld(true);G.box.updateMatrixWorld(true);G.front.localToWorld(_v.set(0,0,.016));
  const lr=G.box.localToWorld(new T.Vector3(-.12,.3,.02));
  G.lens.position.set(lerp(lr.x,_v.x,k6),lerp(lr.y,_v.y,k6)+arc(k6)*.25,lerp(lr.z,_v.z,k6));G.cam.getWorldQuaternion(_q);
  if(k6>.5)G.lens.quaternion.copy(_q);else G.lens.rotation.set(-Math.PI/2,0,0);
  G.filt.visible=shot.filter>0&&k6>=1;G.filt.material.color.setScalar(shot.filter===2?.12:.5);G.iris.scale.setScalar([1,.7,.45,.25][shot.ap]);G.bulb.scale.set(1,shot.shutter?.8:1.3,1);
  G.filtCase.visible=G.box.visible&&k3>=1&&shot.lidK>.5;G.box.localToWorld(G.filtCase.position.set(-.17,.3,.12));
  /* holder and slide travel between the case and the camera back */
  shot.hk=lerp(shot.hk,shot.holder?1:0,1-Math.exp(-dt*6));shot.sk=lerp(shot.sk,shot.slide?1:0,1-Math.exp(-dt*7));
  const hc=G.box.localToWorld(new T.Vector3(.2+.028,.36,0)),hb=G.cam.localToWorld(new T.Vector3(0,.17,-.2));
  G.holder.visible=G.slide.visible=G.box.visible&&k3>=1&&(shot.lidK>.5||shot.hk>.05);
  G.holder.position.lerpVectors(hc,hb,ez(shot.hk));G.holder.position.y+=arc(shot.hk)*.25;
  if(shot.hk>.5)G.holder.quaternion.copy(_q);else G.holder.rotation.set(0,A.head+.5+Math.PI/2,0);
  G.slide.quaternion.copy(G.holder.quaternion);G.slide.position.copy(G.holder.position).add(_v.set(0,shot.sk*.21,-.014).applyQuaternion(G.holder.quaternion));
  /* exposure clock: you count it yourself, the bulb ticks once a second */
  if(shot.shutter){shot.expT+=dt;if(Math.floor(shot.expT)>shot.ticks){shot.ticks=Math.floor(shot.expT);tick(4,.2,2500);say(shot.ticks+"…",1200);}}
  /* focus: what the lens is pointed at decides where sharp is */
  if(ready()){
    const dx=S.x-A.spot.x,dz=S.z-A.spot.z,dd=Math.hypot(dx,dz),ang=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-shot.yaw),Math.cos(Math.atan2(dx,dz)-shot.yaw)));
    const fstar=ang<.3&&dd<7?clamp(.2+1.7/dd,0,1):.2;shot.sharp=clamp(1-Math.abs(shot.f-fstar)*STOPS[shot.ap][2],0,1);
    const want=shot.glass?[64,128,256,512,800][Math.round(shot.sharp*4)]:[48,96,160,256,256][Math.round(shot.sharp*4)];
    if(glassRT.width!==want)glassRT.setSize(want,Math.round(want*.77));
    G.glass.visible=!shot.holder;if(!shot.holder&&(shot.glass||shot.frame%3===0))renderLens(glassRT);
  } else G.glass.visible=false;
  /* the ring that shows what to touch next */
  let mk=null;
  if(!ready()&&!shot.busy&&!shot.packing){const w=STEPS[shot.cur][0];mk=w==="tie"?G.hDonkey.position:w==="tripod"?top:w==="legs"?G.tri.position:w==="case"?ky:w==="mount"?_v.copy(G.box.position).setY(G.box.position.y+.22):w==="lens"?G.lens.position:G.cam.position;}
  G.mark.visible=!!mk;if(mk){G.mark.position.copy(mk);G.mark.quaternion.copy(camera.quaternion);const sc=.22+.03*Math.sin(S.time*5);G.mark.scale.setScalar(sc);}
  /* view */
  if(shot.glass){
    const kk=dt*.9;if(keys.has("a")||keys.has("arrowleft"))shot.yaw+=kk;if(keys.has("d")||keys.has("arrowright"))shot.yaw-=kk;
    if(keys.has("w")||keys.has("arrowup"))shot.pitch=Math.min(.7,shot.pitch+kk*.6);if(keys.has("s")||keys.has("arrowdown"))shot.pitch=Math.max(-.45,shot.pitch-kk*.6);
    if(keys.has("q"))shot.f=clamp(shot.f-dt*.4,0,1);if(keys.has("e"))shot.f=clamp(shot.f+dt*.4,0,1);
    const fov=40;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
    const th=Math.tan(fov*Math.PI/360),dist=Math.max(.2/(2*th),.26/(2*th*camera.aspect))*1.12;
    G.back.localToWorld(_v.set(0,0,-.0235));G.cam.getWorldQuaternion(_q);camera.position.copy(_v).add(_up2.set(0,0,-dist).applyQuaternion(_q));camera.quaternion.copy(_q);
    G.cloth.visible=false;
  } else {
    const wide=shot.cur<4,tx=wide?lerp(S.x,A.spot.x,.55):A.spot.x,tz=wide?lerp(S.z,A.spot.z,.55):A.spot.z,ty=A.spot.y+(wide?1.0:1.25);
    const o=shot.orbit,ph=shot.orbitP,d=wide?5.2:2.5,cp=Math.cos(ph);
    want.set(tx+Math.sin(o)*cp*d,ty+Math.sin(ph)*d,tz+Math.cos(o)*cp*d);want.y=Math.max(want.y,hf(want.x,want.z)+.3);
    if(!shot.cp)shot.cp=camera.position.clone();shot.cp.lerp(want,1-Math.exp(-dt*5));camera.position.copy(shot.cp);look.set(tx,ty,tz);camera.lookAt(look);
    if(camera.fov===40)resize();
  }
}
const _up2=new T.Vector3();
function expose(){}
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
  if(name==="glass"){if(shot.on&&ready())setGlass(!shot.glass);}
  if(name==="expose")expose();
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
  if(k==="p")act("pack");if((k==="b"||k===" ")&&!shot.on)act("bray");if(k==="c")act("view");if(k==="t")act("trot");if(k==="m")act("sound");if(k==="k")act("lie");if(k==="n")act("mind");if(k==="f")act("face");if(k==="e")act("mood");if(k==="g")act("reel");if(moodKeys[k])setMood(moodKeys[k]);if(k==="v")act("study");
  if(k==="o")act("camera");if(shot.on&&k==="escape"&&shot.glass)setGlass(false);
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
    if(shot.on){const dx=e.clientX-orbit.x,dy=e.clientY-orbit.y;orbit.x=e.clientX;orbit.y=e.clientY;
      if(shot.glass){const k=camera.fov/34*.0028;shot.yaw-=dx*k;shot.pitch=clamp(shot.pitch-dy*k,-.45,.7);}
      else{shot.orbit-=dx*.006;shot.orbitP=clamp(shot.orbitP+dy*.004,.02,.9);}return;}
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
  if(shot.on)stepRig(dt);
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
window.__pd={pick,G,shot,setGround(f){groundFn=f;},setMood,orthoShot,step,render:()=>renderer.render(scene,camera),donkey,cam,act,heightAt,setStudy,camera};
if(params.has("study"))setStudy(true);
if(!params.has("manual"))requestAnimationFrame(frame);
applyCargo();
document.body.classList.add("ready");
})();
