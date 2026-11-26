// Dedicated SPAM rehearsal. Same train geometry, same original hand-off. No paid model calls.
import * as THREE from 'three';
import * as kit from './kit.js';
import * as rail from './train.js?v=spam3';
import * as landLib from './land.js';
import * as canLib from './cans.js?v=spam3';
import * as audioLib from './audio.js';
try { (function spamRun(T,kit,rail,landLib,canLib,audioLib) {
  const {DIM,makeTextures,makeMaterials,clamp,damp}=kit, {buildTrain,SPAM_CARS,locate}=rail, {makeCan}=canLib;
  const F=DIM.FLOOR,L=DIM.L, $=id=>document.getElementById(id), V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), params=new URLSearchParams(location.search);
  const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<760, seedMode=params.has('seed'), canvas=$('stage');
  const renderer=new T.WebGLRenderer({canvas,antialias:!mobile,powerPreference:'high-performance',preserveDrawingBuffer:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.3:1.8));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(62,1,.035,6500);scene.fog=new T.Fog(0xdcc096,480,4200);
  const hemi=new T.HemisphereLight(0xffe6c1,0x5b5057,1.1),sun=new T.DirectionalLight(0xffd39b,2.2);sun.position.set(8,18,12);scene.add(hemi,sun);
  const light=new T.PointLight(0xffbf73,4.6,12,1.6);scene.add(light);
  const textures=makeTextures(), M=makeMaterials(textures), tl=new T.TextureLoader();
  const panelTex=tl.load('assets/tex_panels.jpg');panelTex.colorSpace=T.SRGBColorSpace;panelTex.wrapS=T.RepeatWrapping;M.panels=new T.MeshStandardMaterial({map:panelTex,roughness:.8});
  M.screens=[0x153c42,0x304938,0x45696c,0x2c334b].map(color=>new T.MeshBasicMaterial({color}));
  const train=buildTrain(scene,M,SPAM_CARS),cars=train.cars,land=landLib.buildLand(scene,M,textures,tl), audio=audioLib.createAudio();
  const envScene=new T.Scene();envScene.background=new T.Color(0x9b9f9a);const sky=new T.Mesh(new T.SphereGeometry(10,16,8),new T.ShaderMaterial({side:T.BackSide,vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;void main(){float h=normalize(p).y;gl_FragColor=vec4(mix(vec3(.52,.32,.17),vec3(.85,.89,.78),smoothstep(-.2,.8,h)),1.);}'}));envScene.add(sky);const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(envScene,.05).texture;pm.dispose();
  const actor=makeCan(0);actor.group.name='SPAM_CLASSIC_001';actor.group.userData.cls='person';scene.add(actor.group);
  const P=actor.group.position;P.set(cars[1].x+5.55,F,0);actor.group.rotation.y=-Math.PI/2;
  const state={t:0,dist:600,x:P.x,z:0,dir:-1,speed:0,lid:0,react:-10,goal:null,mode:'Follow',cue:0,visited:new Set([1]),found:new Set(),events:[],tour:false,waitUntil:0,body:'Can',returning:false,bee:null,beeYaw:Math.PI,beePitch:0,guide:!seedMode,paused:false,seed:seedMode};
  const names=['Empty seed','Classic / One Bee','Dining / Twelve Bees','Wax and Gold','Mailworks','Cinema and Doubles','Hot Honey','Slop Sea','Sacred Hive'];
  const discoveries=['','The first sting','Bouncy desserts','A balancing act','Envelope fountain','A film within a film','Honey droplets','Jelly copy machine','Share the feast'];
  let score=null,loadingError='',camPos=null,camAim=null,rec=null,guideShown=true,initialized=false;
  const keys=new Set(),stick={x:0,y:0}, drag={yaw:0,pitch:0};
  const B=(p,m,x,y,z,w,h,d)=>{let o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);p.add(o);return o;};
  const S=(p,m,x,y,z,r)=>{let o=new T.Mesh(new T.SphereGeometry(r,12,8),m);o.position.set(x,y,z);p.add(o);return o;};
  const C=(p,m,x,y,z,r,h,n=12)=>{let o=new T.Mesh(new T.CylinderGeometry(r,r,h,n),m);o.position.set(x,y,z);p.add(o);return o;};
  const material=(color,opts={})=>new T.MeshStandardMaterial({color,roughness:.45,...opts});
  const pink=material(0xe79887,{roughness:.26}),pink2=material(0xf4bda4,{roughness:.28}),honey=material(0xffb83b,{roughness:.13,metalness:.15,transparent:true,opacity:.78}),paper=material(0xe9d9ae),blue=material(0x234f89,{metalness:.42}),yellow=material(0xffd950,{emissive:0x8c470a,emissiveIntensity:.5});
  const npcs=[], toys=[], flying=[], specials={}, rings=[];
  function npc(ci,flavor,x,z,seated=false,role='idle'){const c=makeCan(flavor);c.group.scale.multiplyScalar(.86);c.group.position.set(cars[ci].x+x,F+(seated?.40:0),z);c.group.rotation.y=seated?(x<0?Math.PI/2:-Math.PI/2):z>0?Math.PI:0;scene.add(c.group);npcs.push({c,ci,role,seated,base:c.group.position.clone(),phase:npcs.length*.71});return c;}
  // Nothing is installed in seed car 1. All other inhabitants are tins.
  npc(2,1,3.3,1.08,true);npc(2,3,-1.5,-1.1,true);npc(2,5,-5.8,.92,false,'trolley');
  npc(3,2,3.3,1.08,true);npc(3,4,-1.5,-1.10,true);npc(3,3,-5.3,.95,false,'music');npc(3,1,1.0,-.96,false,'waiter');
  npc(4,3,3.9,1.05,false,'sort');npc(4,6,-3.0,-1.08,false,'sort');npc(5,1,4.6,1.06,false,'sort');npc(5,4,-3.2,-1.05,false,'sort');
  const angel=npc(6,0,-4.7,.97,false,'idle');
  for(const side of [-1,1])for(let k=0;k<5;k++){const feather=B(angel.group,M.brass,side*(.40+k*.10),.88+k*.09,-.15,.09,.46-k*.045,.055);feather.rotation.z=side*-.75;}
  npc(6,3,4.1,1.04,true);npc(6,2,1.3,-1.04,true);npc(7,5,3.6,1.04,false,'honey');npc(7,6,-4.1,-1.05,false,'honey');npc(8,4,3.4,1.02,false,'sort');npc(8,2,-3.2,-1.03,false,'sort');npc(9,5,2.8,1.05,false,'honey');npc(9,0,-3.5,-1.02,false,'idle');
  const trolley=new T.Group();B(trolley,M.walnut,0,.40,0,.68,.57,.36);B(trolley,M.brass,0,.73,0,.76,.05,.42);for(const x of [-.25,.25])for(const z of [-.14,.14])C(trolley,M.iron,x,.09,z,.08,.045).rotation.x=Math.PI/2;trolley.position.set(cars[2].x-5,F,.71);scene.add(trolley);
  // Tactile interactions use small bounded springy bodies rather than blocking the corridor.
  const jellyG=new T.SphereGeometry(1,15,10);
  function toy(ci,type,x,z,r=.17){const m=type==='honey'?honey:type==='letter'?paper:type==='can'?blue: pink;let o=type==='letter'?B(scene,m,cars[ci].x+x,F+.06,z,.26,.035,.17):type==='can'?B(scene,m,cars[ci].x+x,F+.18,z,.24,.34,.19):new T.Mesh(jellyG,m);
    if(!o.parent){scene.add(o);o.position.set(cars[ci].x+x,F+r,z);o.scale.set(r*1.25,r,r*.9);}const body={ci,type,o,base:o.position.clone(),v:V(),r,phase:Math.random()*6,kick:0};toys.push(body);return body;}
  for(let j=0;j<6;j++)toy(3,'jelly',-1.8+j*.43,(j%2?.62:-.60),.13);
  for(let j=0;j<14;j++){let q=toy(5,'letter',-3.1+j*.42,j%2?.66:-.68,.06);q.o.rotation.y=j*.57;}
  for(let j=0;j<8;j++)toy(7,'honey',-1.7+j*.44,(j%2?.65:-.65),.12);
  for(let j=0;j<16;j++)toy(8,j%4===0?'can':'jelly',-4+j*.47,j%2?.64:-.64,.13);
  const balance=new T.Group();balance.position.set(cars[4].x,F+.78,-.96);scene.add(balance);C(balance,M.brass,0,.24,0,.035,.48);
  const beam=new T.Group();beam.position.y=.45;balance.add(beam);B(beam,M.brass,0,0,0,1.24,.045,.05);for(const s of [-1,1]){C(beam,M.brass,s*.51,-.15,0,.13,.028);C(beam,M.brass,s*.51,-.075,0,.014,.15);}B(beam,M.honey,-.51,-.055,0,.19,.16,.15);B(beam,M.steel,.51,-.04,0,.15,.18,.15);specials.balance=beam;
  const miniature=new T.Group();miniature.position.set(cars[6].x-2.4,F+.79,.93);scene.add(miniature);B(miniature,M.walnut,0,-.36,0,1.25,.72,.56);B(miniature,M.leaf,0,.015,0,1.2,.03,.55);let loop=new T.Mesh(new T.TorusGeometry(.22,.012,5,36),M.steel);loop.rotation.x=Math.PI/2;loop.scale.x=2;miniature.add(loop);const miniCan=B(miniature,blue,0,.09,0,.15,.12,.10);B(miniCan,yellow,0,.07,0,.15,.02,.10);specials.mini=miniCan;
  const engine=new T.Group();engine.position.set(cars[9].x-5.4,F+1.08,-1.0);scene.add(engine);C(engine,M.brass,0,0,0,.5,.18,18).rotation.x=Math.PI/2;for(let j=0;j<8;j++)B(engine,M.iron,Math.cos(j*Math.PI/4)*.34,Math.sin(j*Math.PI/4)*.34,-.12,.15,.10,.08);specials.engine=engine;
  // Film surfaces: the first room is actually captured before leaving; mailworks uses live in-engine cameras.
  const memoryRT=new T.WebGLRenderTarget(384,216),liveRT=new T.WebGLRenderTarget(256,144),screenMeshes=[];
  function screen(ci,x,y,z,w,h,map,ry=0){let mat=new T.MeshBasicMaterial({map,side:T.DoubleSide});let o=new T.Mesh(new T.PlaneGeometry(w,h),mat);o.position.set(cars[ci].x+x,F+y,z);o.rotation.y=ry;scene.add(o);screenMeshes.push(o);return o;}
  screen(6,0,1.6,-1.24,3.33,1.38,memoryRT.texture);
  for(let x of [-6,-3,0,3,6])screen(5,x,1.38,-.975,1.03,.55,liveRT.texture);
  // Explicit per-car insects. They do not get rehomed when the camera changes.
  const beeGeo=new T.SphereGeometry(1,8,6).scale(.066,.032,.035),wingGeo=new T.PlaneGeometry(.071,.10).rotateX(-Math.PI/2),stripeGeo=new T.SphereGeometry(1,8,6).scale(.021,.034,.036);
  const counts=[0,0,1,12,24,32,48,76,108,144];const total=counts.reduce((a,b)=>a+b,0);
  const beeBodies=new T.InstancedMesh(beeGeo,new T.MeshLambertMaterial({color:0xe5b23c}),total),stripes=new T.InstancedMesh(stripeGeo,new T.MeshBasicMaterial({color:0x30221a}),total),wings=new T.InstancedMesh(wingGeo,new T.MeshBasicMaterial({color:0xfff0ce,transparent:true,opacity:.48,depthWrite:false,side:T.DoubleSide}),total);
  for(let o of [beeBodies,stripes,wings]){o.frustumCulled=false;scene.add(o);o.userData.cls='bee';}
  for(let ci=2;ci<cars.length;ci++)for(let k=0;k<counts[ci];k++){let a=k*2.399,base=V(cars[ci].x+(k===0?1.4:(Math.sin(a*1.13)*7)),F+1.1+(k%5)*.23,Math.cos(a)*.92);flying.push({ci,base,p:base.clone(),phase:k*1.37,manual:false});}
  const mx=new T.Matrix4(),q=new T.Quaternion(),eu=new T.Euler(),scl=V(),pos=V();
  // World-space guide, never part of a seed or a clean still.
  const routeGuide=new T.Group();scene.add(routeGuide);
  const guideMat=new T.MeshBasicMaterial({color:0xffd764,transparent:true,opacity:.68,depthWrite:false});
  for(let j=0;j<9;j++){let disk=new T.Mesh(new T.CircleGeometry(.065,16),guideMat);disk.rotation.x=-Math.PI/2;routeGuide.add(disk);rings.push(disk);}
  const beacon=new T.Mesh(new T.TorusGeometry(.26,.018,7,32),guideMat);beacon.rotation.y=Math.PI/2;routeGuide.add(beacon);
  const log=(event,detail={})=>{state.events.push({t:+state.t.toFixed(2),car:locate(cars,state.x).i-1,event,...detail});};
  function toast(t){$('toast').textContent=t;$('toast').classList.add('on');state.toastUntil=state.t+2.8;}
  function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
  const current=()=>locate(cars,state.body==='Bee'&&state.bee?state.bee.p.x:state.x).i;
  const rearDoor=ci=>train.doors.find(d=>d.car.i===ci&&d.x<d.car.x);
  function cue(n){state.cue=n;log('cue',{n,door:n,source:score?.run?.[n]?.id||'spam_'+n});const c=score?.run?.[n];$('cueTitle').textContent=c?.title||names[n];$('cueText').textContent=c?.genie||loadingError||'Loading the hand-off…';$('copy').disabled=!c;$('cueNum').textContent=`${String(n).padStart(2,'0')} / 08`;if(n)toast('Door '+n+' · '+names[n]);}
  function nextCar(){if(state.seed){state.seed=false;state.guide=true;document.body.classList.remove('seed');}if(state.returning)return;let i=current();if(i>=9){state.tour=false;toast('The hive · enjoy the ride');return;}state.goal=cars[Math.max(2,i+1)].x+5.4;state.discoverGoal=false;state.dir=-1;log('guide_next',{to:i});}
  function discover(){let i=current();if(i===1){nextCar();return;}state.goal=cars[i].x;state.discoverGoal=true;state.dir=state.goal<(state.body==='Bee'?state.bee.p.x:state.x)?-1:1;}
  function trigger(i){if(i<2||state.found.has(i))return;state.found.add(i);log('discovery',{id:i-1,name:discoveries[i-1]});toast(discoveries[i-1]);state.react=state.t;
    if(i===2){state.lid=1;log('sting');}
    if(i===3||i===5||i===7||i===8||i===9){for(const o of toys.filter(x=>x.ci===i)){o.v.set((Math.random()-.5)*2,1.9+Math.random()*2.5,(Math.random()-.5)*1.6);o.kick=1;}}
    if(i===4)specials.balance.userData.start=state.t;
    if(i===6)specials.mini.userData.active=true;
    if(i===9)toast('A feast for everyone · '+state.found.size+'/8');
  }
  function changeBody(){if(state.body==='Bee'){state.returning=true;state.goal=null;toast('Returning to your can');return;}let i=current();if(i===1){toast('Find the first bee beyond the door');return;}let b=flying.filter(b=>b.ci===i).sort((a,b)=>a.p.distanceToSquared(P)-b.p.distanceToSquared(P))[0];if(!b)return;b.manual=true;state.bee=b;state.body='Bee';state.mode='Bee follow';state.beeYaw=state.dir===-1?Math.PI:0;state.goal=null;log('embody_bee');}
  function finishReturn(){if(state.bee)state.bee.manual=false;state.bee=null;state.body='Can';state.mode='Follow';state.returning=false;state.goal=null;camPos=null;log('return_to_can');}
  function setMode(m){state.mode=m;drag.yaw=drag.pitch=0;log('camera',{mode:m});}
  function guideStep(dt) {
    const isBee=state.body==='Bee'&&state.bee;let x=isBee?state.bee.p.x:state.x,z=isBee?state.bee.p.z:state.z;
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+stick.y, side=(keys.has('d')?1:0)-(keys.has('a')?1:0)+stick.x;
    if(Math.abs(forward)+Math.abs(side)>.1){state.goal=null;state.tour=false;state.returning=false;}
    let dx=0,dz=0,dy=0;
    if(isBee&&state.returning){const target=P.clone().add(V(.05,.95,0)),d=target.clone().sub(state.bee.p),len=d.length();if(len<.24){finishReturn();return;}d.divideScalar(Math.max(len,.001));dx=d.x;dy=d.y;dz=d.z;}
    else if(Math.abs(forward)+Math.abs(side)>.1){if(isBee){dx=forward*Math.cos(state.beeYaw)-side*Math.sin(state.beeYaw);dz=forward*Math.sin(state.beeYaw)+side*Math.cos(state.beeYaw);dy=(keys.has(' ')||keys.has('e')?1:0)-(keys.has('shift')||keys.has('q')?1:0)+forward*Math.sin(state.beePitch)*.6;}else{dx=-forward;dz=side;}}
    else if(state.goal!==null){let d=state.goal-x;if(Math.abs(d)<.07){state.goal=null;if(state.discoverGoal)trigger(current());state.discoverGoal=false;state.waitUntil=state.t+1.6;}else{dx=Math.sign(d);dz=clamp(-z*3,-1,1);}}
    if(state.tour&&state.goal===null&&!state.returning&&state.t>state.waitUntil){let i=current();if(i>1&&!state.found.has(i)){discover();}else if(i<9)nextCar();else state.tour=false;}
    const mag=Math.hypot(dx,dz,dy);if(mag>1){dx/=mag;dy/=mag;dz/=mag;}
    const sp=isBee?3.8:2.55;let nx=clamp(x+dx*sp*dt,cars[9].x+cars[9].walkMin+.2,cars[1].x+7.0);
    if(state.goal!==null&&Math.sign(state.goal-x)!==Math.sign(state.goal-nx))nx=state.goal;
    for(const d of train.doors){if((x-d.x)*(nx-d.x)<=0&&d.open<.82){nx=x;break;}}
    let nz=clamp(z+dz*sp*dt,isBee?-1.05:-.13,isBee?1.05:.13);
    if(isBee){state.bee.p.set(nx,clamp(state.bee.p.y+dy*sp*dt,F+.12,F+2.43),nz);}
    else{state.speed=Math.abs(nx-x)/Math.max(dt,.001);state.x=nx;state.z=nz;if(Math.abs(dx)>.03)state.dir=Math.sign(dx);P.set(nx,F,nz);actor.group.rotation.y=damp(actor.group.rotation.y,state.dir<0?-Math.PI/2:Math.PI/2,12,dt);}
    return Math.abs(nx-x);
  }
  function doorStep(dt){let p=state.body==='Bee'?state.bee.p.x:state.x;for(const d of train.doors){let near=Math.abs(p-d.x)<2.2||Math.abs(state.x-d.x)<1.9||(camera.position.x-d.x)*(state.x-d.x)<0&&Math.abs(camera.position.x-state.x)<5;d.open=damp(d.open,near?1:0,near?9:4,dt);d.g.position.z=d.open*.88;
      // A cue is emitted only at its actual outgoing door, with the can/bee approaching that door.
      if(d.car.i===state.cue+1&&d.x<d.car.x&&state.cue<8&&d.open>.55&&p>=d.x-1.5&&p-d.x<2.2)cue(state.cue+1);
    }}
  function updateCamera(dt,reset=false){const isBee=state.body==='Bee'&&state.bee,a=isBee?state.bee.p:P,dir=isBee?Math.sign(Math.cos(state.beeYaw))||-1:state.dir;let cp,at;
    if(isBee){const forward=V(Math.cos(state.beeYaw),Math.sin(state.beePitch),Math.sin(state.beeYaw)).normalize();if(state.mode==='Bee eyes'){cp=a.clone().addScaledVector(forward,.09);at=cp.clone().addScaledVector(forward,3);}else{cp=a.clone().addScaledVector(forward,-.48).add(V(0,.16,.06));at=a.clone().addScaledVector(forward,.75);}}
    else if(state.mode==='Profile'){cp=a.clone().add(V(-1.65*dir,1.22,.94));at=a.clone().add(V(0,.80,0));}
    else if(state.mode==='Face'){cp=a.clone().add(V(dir*2.0,1.08,.35));at=a.clone().add(V(0,.75,0));}
    else if(state.mode==='Window'){cp=a.clone().add(V(-dir*1.15,1.3,-.7));at=a.clone().add(V(dir*.45,1.2,8));}
    else if(state.mode==='Orbit'){let u=state.t*.55;cp=a.clone().add(V(2.35*Math.cos(u),1.32,.92*Math.sin(u)));at=a.clone().add(V(0,.78,0));}
    else if(state.mode==='Outside'){cp=a.clone().add(V(6,5.2,-10));at=a.clone().add(V(-3,.6,0));}
    else{cp=a.clone().add(V(-dir*2.7,1.46,.06));at=a.clone().add(V(dir*2.4,.72,0));}
    if(state.mode!=='Outside'){cp.z=clamp(cp.z,-1.27,1.27);cp.y=clamp(cp.y,F+.16,F+2.45);}
    if(!isBee){let ray=at.clone().sub(cp);ray.applyAxisAngle(V(0,1,0),drag.yaw);const right=V().crossVectors(ray,V(0,1,0)).normalize();ray.applyAxisAngle(right,drag.pitch);at=cp.clone().add(ray);}
    if(reset||!camPos){camPos=cp;camAim=at;}else{let k=1-Math.exp(-dt*8);camPos.lerp(cp,k);camAim.lerp(at,k);}
    camera.position.copy(camPos);camera.lookAt(camAim);camera.fov=isBee?(state.mode==='Bee eyes'?96:78):state.mode==='Outside'?53:62;camera.updateProjectionMatrix();
  }
  function updateBees(dt){const ci=current(),first=flying[0];if(first&&!first.manual&&state.visited.has(2)&&state.t-state.react<1.5){first.p.copy(P).add(V(.10,1.38+.12*Math.sin(state.t*8),.13));}
    flying.forEach((b,k)=>{if(!b.manual&&!(k===0&&state.visited.has(2)&&state.t-state.react<1.5)){let t=state.t*1.35+b.phase;b.p.copy(b.base).add(V(.56*Math.sin(t),.16*Math.sin(t*2),.25*Math.cos(t)));}const show=(b.ci===ci||Math.abs(b.ci-ci)<=1)&&ci!==1||b.manual;const size=show?1:0;eu.set(0,b.manual?-state.beeYaw:state.t*.9+b.phase,0);q.setFromEuler(eu);mx.compose(b.p,q,scl.setScalar(size));beeBodies.setMatrixAt(k,mx);pos.copy(b.p).x+=.014;mx.compose(pos,q,scl);stripes.setMatrixAt(k,mx);pos.copy(b.p).y+=.035;scl.set(size,size,size*(.35+Math.abs(Math.sin(state.t*76+k))));mx.compose(pos,q,scl);wings.setMatrixAt(k,mx);});
    for(let o of [beeBodies,stripes,wings])o.instanceMatrix.needsUpdate=true;
  }
  function updateToys(dt){const ci=current();for(const t of toys){let o=t.o;t.o.visible=Math.abs(ci-t.ci)<=2||state.mode==='Outside';if(!o.visible)continue;
      if(state.body==='Can'&&state.speed>.15&&P.distanceTo(o.position)<.76&&state.t-(t.lastKick||-10)>.5){t.v.x+=state.dir*1.7;t.v.y+=1.5;t.v.z+=(Math.random()-.5)*1.0;t.lastKick=state.t;t.kick=1;}
      if(t.v.lengthSq()>.001||o.position.y>t.base.y+.01){t.v.y-=6*dt;o.position.addScaledVector(t.v,dt);if(o.position.y<t.base.y){o.position.y=t.base.y;t.v.y=Math.abs(t.v.y)*.56;t.v.x*=.85;t.v.z*=.85;t.kick=1;}const c=cars[t.ci];if(Math.abs(o.position.x-c.x)>7.7){o.position.x=clamp(o.position.x,c.x-7.7,c.x+7.7);t.v.x*=-.65;}if(Math.abs(o.position.z)>1.15){o.position.z=clamp(o.position.z,-1.15,1.15);t.v.z*=-.65;}t.v.multiplyScalar(Math.exp(-dt*.9));}
      t.kick*=Math.exp(-dt*5);if(t.type==='jelly'||t.type==='honey'){let r=t.r,w=t.kick*Math.cos(state.t*15+t.phase)*.23;o.scale.set(r*1.25*(1+w),r*(1-w),r*.9*(1+w));}else{o.rotation.y+=dt*(t.v.x+t.v.z)*.8;}
    }
    const t=state.t-(specials.balance.userData.start??-100);specials.balance.rotation.z=t<8?Math.sin(t*5)*.29*Math.exp(-t*.43):0;
    if(specials.mini.userData.active){let a=state.t*1.6;specials.mini.position.set(.44*Math.cos(a),.09,.22*Math.sin(a));specials.mini.rotation.y=-a;}
    specials.engine.rotation.z+=dt*.75;trolley.position.x=cars[2].x-5+.65*Math.sin(state.t*.5);
  }
  function updateUI(){let i=current(),n=i-1;$('title').textContent=names[n]||'Train';$('progress').textContent=String(n).padStart(2,'0')+' / 08';$('found').textContent=state.found.size+' / 8';$('view').textContent=state.mode;$('bee').textContent=state.body==='Bee'?'Return to can':'Bee';$('tour').textContent=state.tour?'Pause tour':'Tour';$('next').disabled=i>=9||state.returning;$('discover').textContent=i===1?'First car':state.found.has(i)?'Play again':'Discover';$('hint').textContent=i===1?'An empty train. One door ahead.':state.found.has(i)?'Explore freely or continue.':discoveries[n];if(state.t>state.toastUntil)$('toast').classList.remove('on');}
  function drawFrame(dt){state.t+=dt;state.dist=(state.dist+24*dt)%landLib.LOOP;train.spin(state.dist/.46);state.speed=0;
    if(!state.seed&&!state.paused){doorStep(dt);guideStep(dt);const i=current();if(i!==state.lastCar){state.lastCar=i;state.visited.add(i);log('enter_car',{i});if(i===2&&!state.found.has(2))trigger(2);}}
    state.lid=state.t-state.react<1.15?1:state.t-state.react<1.9?.25:0;
    actor.update(dt,state.speed,false,state.lid);if(state.t-state.react<.9)actor.group.position.y=F+Math.sin((state.t-state.react)*Math.PI/.9)*.14;
    for(const n of npcs){n.c.group.visible=state.mode==='Outside'||Math.abs(n.ci-current())<=2;let a=n.role==='music'?.28*(1+Math.sin(state.t*4+n.phase)):n.role==='sort'?.10*(1+Math.sin(state.t*3+n.phase)):0;n.c.update(dt,0,n.seated,a);}
    updateToys(dt);updateCamera(dt);land.update(state.dist,camera.position.x,state.t);updateBees(dt);
    const ci=current(),car=cars[ci];light.position.set(camera.position.x,F+2.04,0);light.color.setHex(car.cool?0x9de4d9:0xffbf78);light.intensity=car.dim?3.2:5;
    const e=land.env;hemi.intensity=e.tunnel?.15:1.1;sun.intensity=e.tunnel?0:2.2;scene.fog.near=e.tunnel?4:480;scene.fog.far=e.tunnel?160:4200;
    routeGuide.visible=state.guide&&!state.seed&&state.mode!=='Outside'&&state.body==='Can';for(let j=0;j<rings.length;j++){let x=state.x-1.2-j*.70;rings[j].position.set(x,F+.018,0);rings[j].visible=x>cars[9].x+cars[9].walkMin;let a=.8+.3*Math.sin(state.t*4-j*.4);rings[j].scale.setScalar(a);}
    const d=rearDoor(ci);beacon.visible=!!d;if(d){beacon.position.set(d.x+.07,F+1.02,0);beacon.scale.setScalar(1+.08*Math.sin(state.t*3));}guideMat.opacity=.58+.12*Math.sin(state.t*2);
    for(const c of cars)c.group.visible=state.mode==='Outside'||Math.abs(c.i-ci)<=3;
    if(!initialized){let old=renderer.getRenderTarget(),vis=routeGuide.visible;routeGuide.visible=false;screenMeshes.forEach(o=>o.visible=false);renderer.setRenderTarget(memoryRT);renderer.render(scene,camera);renderer.setRenderTarget(old);screenMeshes.forEach(o=>o.visible=true);routeGuide.visible=vis;initialized=true;}
    if(ci===5&&Math.floor(state.t*2)!==state.lastFeed){state.lastFeed=Math.floor(state.t*2);let fc=new T.PerspectiveCamera(60,16/9,.05,100);fc.position.set(cars[3].x+5,F+1.9,0);fc.lookAt(cars[3].x-4,F+.8,0);let old=renderer.getRenderTarget();screenMeshes.forEach(o=>o.visible=false);const visible=cars[3].group.visible;cars[3].group.visible=true;renderer.setRenderTarget(liveRT);renderer.render(scene,fc);renderer.setRenderTarget(old);cars[3].group.visible=visible;screenMeshes.forEach(o=>o.visible=true);}
    renderer.render(scene,camera);audio.update(24, state.mode==='Outside'?.6:1,e.tunnel||0, state.bee?state.bee.p.distanceTo(camera.position):3);updateUI();
  }
  function saveBlob(blob,name){const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),20000);}
  function cameraData(){const w=canvas.width,h=canvas.height,fy=h*.5/Math.tan(T.MathUtils.degToRad(camera.fov)*.5);return {position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),intrinsics:{width:w,height:h,fx:fy,fy,cx:w/2,cy:h/2},source:'SPAM_CLASSIC_001',car:current()-1,seed:state.seed};}
  function still(){let vis=routeGuide.visible;routeGuide.visible=false;renderer.render(scene,camera);canvas.toBlob(b=>b&&saveBlob(b,state.seed?'spam_0_seed_clean.jpg':'spam-train-'+Date.now()+'.jpg'),'image/jpeg',.94);routeGuide.visible=vis;}
  function seedFrame(){state.seed=true;state.tour=false;state.goal=null;state.x=cars[1].x+5.55;state.z=0;state.dir=-1;P.set(state.x,F,0);actor.group.rotation.y=-Math.PI/2;state.react=-100;state.found.clear();state.visited=new Set([1]);state.lastCar=1;state.cue=0;state.lid=0;state.body='Can';if(state.bee)state.bee.manual=false;state.bee=null;state.returning=false;state.guide=false;setMode('Follow');for(const d of train.doors){d.open=0;d.g.position.z=0;}document.body.classList.add('seed');cue(0);camPos=null;initialized=false;drawFrame(0);}
  function captureSeed(){seedFrame();const w=1280,h=720,old=renderer.getPixelRatio(),aspect=camera.aspect;renderer.setPixelRatio(1);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);const data=canvas.toDataURL('image/jpeg',.95),meta=cameraData();renderer.setPixelRatio(old);resize();camera.aspect=aspect;camera.updateProjectionMatrix();return {color:data,camera:meta};}
  function saveSeed(){const data=captureSeed();const a=document.createElement('a');a.href=data.color;a.download='spam_0_seed_clean.jpg';a.click();saveBlob(new Blob([JSON.stringify(data.camera,null,2)],{type:'application/json'}),'spam_0_seed_clean.cam.json');}
  function record(){if(rec){rec.stop();return;}if(!canvas.captureStream||!window.MediaRecorder){toast('Recording not supported here');return;}let stream=canvas.captureStream(24),chunks=[],type=['video/webm;codecs=vp9','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));rec=new MediaRecorder(stream,type?{mimeType:type,videoBitsPerSecond:6000000}:undefined);const r=rec;let old=state.guide;state.guide=false;r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};r.onstop=()=>{saveBlob(new Blob(chunks,{type:r.mimeType}),'spam-take-'+Date.now()+(r.mimeType.includes('mp4')?'.mp4':'.webm'));stream.getTracks().forEach(t=>t.stop());rec=null;state.guide=old;$('rec').textContent='Rec';};r.start(1000);$('rec').textContent='Stop';}
  $('next').onclick=nextCar;$('discover').onclick=()=>{if(state.found.has(current()))state.found.delete(current());discover();};$('tour').onclick=()=>{state.seed=false;state.guide=true;document.body.classList.remove('seed');state.tour=!state.tour;if(state.tour){state.waitUntil=0;if(state.goal===null)nextCar();}};$('bee').onclick=changeBody;
  $('view').onclick=()=>{let modes=state.body==='Bee'?['Bee follow','Bee eyes']:['Follow','Profile','Face','Window','Orbit','Outside'];setMode(modes[(modes.indexOf(state.mode)+1)%modes.length]);};
  $('look').onclick=()=>{document.body.classList.toggle('showcue');};$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(score?.run?.[state.cue]?.genie||'');toast('Cue copied');}catch{toast('Select and copy the cue text');}};$('sound').onclick=()=>{$('sound').classList.toggle('on',audio.toggle());};$('rec').onclick=record;$('still').onclick=still;$('seed').onclick=saveSeed;$('hide').onclick=()=>document.body.classList.toggle('clean');$('reset').onclick=()=>{seedFrame();state.seed=false;state.guide=true;document.body.classList.remove('seed');};$('ledger').onclick=()=>saveBlob(new Blob([JSON.stringify({source:'SPAM-HANDOFF.md',events:state.events,camera:cameraData()},null,2)],{type:'application/json'}),'spam-run-ledger.json');
  const joy=$('joy'),nub=$('nub');let pointer=null;function jmove(e){const r=joy.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width*.42),dy=(e.clientY-r.top-r.height/2)/(r.height*.42),l=Math.max(1,Math.hypot(dx,dy));stick.x=dx/l;stick.y=-dy/l;nub.style.transform=`translate(${stick.x*30}px,${-stick.y*30}px)`;}
  joy.addEventListener('pointerdown',e=>{pointer=e.pointerId;joy.setPointerCapture(pointer);jmove(e);});joy.addEventListener('pointermove',e=>{if(pointer===e.pointerId)jmove(e);});for(let ev of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(ev,()=>{pointer=null;stick.x=stick.y=0;nub.style.transform='';});
  let touch=null;canvas.addEventListener('pointerdown',e=>{touch={id:e.pointerId,x:e.clientX,y:e.clientY,m:0};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!touch||e.pointerId!==touch.id)return;let dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch.m+=Math.abs(dx)+Math.abs(dy);touch.x=e.clientX;touch.y=e.clientY;if(state.body==='Bee'){state.beeYaw-=dx*.005;state.beePitch=clamp(state.beePitch-dy*.004,-1.1,1.1);}else{drag.yaw=clamp(drag.yaw-dx*.004,-.8,.8);drag.pitch=clamp(drag.pitch-dy*.003,-.45,.45);}});canvas.addEventListener('pointerup',e=>{if(touch&&touch.m<9&&!state.seed){const i=current();if(i<9){state.goal=Math.max(cars[i+1].x+5.4,(state.body==='Bee'?state.bee.p.x:state.x)-3.6);state.discoverGoal=false;}}touch=null;});canvas.addEventListener('pointercancel',()=>touch=null);
  addEventListener('keydown',e=>{if(e.target.matches?.('textarea,input'))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown',' ','shift','q','e'].includes(k))e.preventDefault();keys.add(k);if(e.repeat)return;if(k==='n')nextCar();if(k==='f')discover();if(k==='b')changeBody();if(k==='c')$('view').click();if(k==='h')$('hide').click();if(k==='p')still();if(k==='r')record();if(k==='t')$('tour').click();if(state.seed&&k==='w'){state.seed=false;state.guide=true;document.body.classList.remove('seed');}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();stick.x=stick.y=0;});
  fetch('data/spam_session.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(j=>{score=j;cue(state.cue);}).catch(e=>{loadingError='Cue data unavailable: '+e.message;cue(state.cue);});
  window.trainFilm={version:'3.0-spam',next:nextCar,discover,tour:(on=true)=>{state.tour=on;state.waitUntil=0;},camera:setMode,bee:changeBody,still,record,seed:seedFrame,capture:captureSeed,log:()=>state.events.slice(),observe:()=>({car:current()-1,room:names[current()-1],cue:state.cue,body:state.body,x:state.x,doors:train.doors.filter(d=>d.x<d.car.x).map(d=>+d.open.toFixed(3)),found:[...state.found],t:state.t,camera:state.mode,people:npcs.length,bees:counts[current()],calls:renderer.info.render.calls}),_:{scene,camera,renderer,train,state,actor,step:drawFrame}};
  if(seedMode)document.body.classList.add('seed');cue(0);drawFrame(0);$('loading').hidden=true;
  let last=performance.now();function tick(now){requestAnimationFrame(tick);let dt=clamp((now-last)/1000,0,.05);last=now;drawFrame(dt);}requestAnimationFrame(tick);
})(THREE,kit,rail,landLib,canLib,audioLib); }
catch(e){console.error(e);const l=document.getElementById('loading');l.hidden=false;l.textContent='Train could not start: '+e.message;}
