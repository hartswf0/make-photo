/* Pack donkey: procedural skinned model with foot-planted walk and trot.
   Usage: const d=makeDonkey(); scene.add(d.group); d.update(dt,{throttle,steer,trot},heightAt). */
(function(){"use strict";
const T=window.THREE;
const TAU=Math.PI*2, DEG=Math.PI/180;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const frac=v=>v-Math.floor(v);
const hash=n=>frac(Math.sin(n*127.1+3.7)*43758.5453);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};

/* ---------- geometry helpers ---------- */
function cr(a,b,c,d,t){return .5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);}
function refine(R,sub){
  const out=[];
  for(let i=0;i<R.length-1;i++){
    const r0=R[Math.max(0,i-1)],r1=R[i],r2=R[i+1],r3=R[Math.min(R.length-1,i+2)];
    for(let s=0;s<sub;s++){
      const t=s/sub,o={};
      for(const k in r1){
        if(Array.isArray(r1[k]))o[k]=r1[k].map((_,q)=>cr(r0[k][q],r1[k][q],r2[k][q],r3[k][q],t));
        else if(typeof r1[k]==="number")o[k]=cr(r0[k],r1[k],r2[k],r3[k],t);
        else o[k]=r1[k];
      }
      out.push(o);
    }
  }
  out.push(Object.assign({},R[R.length-1]));
  return out;
}
/* Rings: {p:[x,y,z], w, up, dn, e?, ...}. Cross-section spans `side` (default +X) by w and
   cross(tangent,side) by up/dn. opt: seg, arc:[a0,a1], color(r,sa,ca), skin(r,sa,ca)->[a,b,wb], ur, vr, xf, tan. */
function loft(rings,opt){
  opt=opt||{};
  if(!opt.arc&&!opt.open){ // close both ends so no tube is ever seen into
    const tip=r=>Object.assign({},r,{w:.0008,up:.0008,dn:.0008});
    rings=[tip(rings[0])].concat(rings,[tip(rings[rings.length-1])]);
  }
  const seg=opt.seg||20,n=rings.length,full=!opt.arc;
  const a0=full?Math.PI:opt.arc[0],a1=full?Math.PI*3:opt.arc[1];
  const pos=[],col=[],uv=[],si=[],sw=[],idx=[],fur=[],meta=[];
  let v=0;
  for(let i=0;i<n;i++){
    const r=rings[i];
    const t=r.t||opt.tan||norm([0,1,2].map(q=>rings[Math.min(n-1,i+1)].p[q]-rings[Math.max(0,i-1)].p[q]));
    const side=r.side||opt.side||[1,0,0],up=norm(cross(t,side)),e=r.e||opt.e||1;
    if(i>0)v+=Math.hypot(r.p[0]-rings[i-1].p[0],r.p[1]-rings[i-1].p[1],r.p[2]-rings[i-1].p[2]);
    const w=Math.max(.0015,r.w),hu=Math.max(.0015,r.up),hd=Math.max(.0015,r.dn);
    for(let j=0;j<=seg;j++){
      const a=lerp(a0,a1,j/seg),sa=Math.sin(a),ca=Math.cos(a);
      const dsp=opt.disp?opt.disp(r,sa,ca):1,nar=1-(ca>0?(r.tw||0):(r.bw||0))*Math.pow(Math.abs(ca),1.5);
      const cx=Math.sign(sa)*Math.pow(Math.abs(sa),e)*w*nar*dsp,cy=Math.sign(ca)*Math.pow(Math.abs(ca),e)*(ca>0?hu:hd)*dsp;
      fur.push(opt.fur?opt.fur(r,sa,ca):0);meta.push(r,cy);
      pos.push(r.p[0]+side[0]*cx+up[0]*cy,r.p[1]+side[1]*cx+up[1]*cy,r.p[2]+side[2]*cx+up[2]*cy);
      const g=opt.color?opt.color(r,sa,ca):1;col.push(g,g,g);
      uv.push(j/seg*(opt.ur||4),v*(opt.vr||6));
      if(opt.skin){const s=opt.skin(r,sa,ca);si.push(s[0],s[1],0,0);sw.push(1-s[2],s[2],0,0);}
    }
  }
  for(let i=0;i<n-1;i++)for(let j=0;j<seg;j++){
    const a=i*(seg+1)+j,b=a+1,c=a+seg+1,d=c+1;
    idx.push(a,c,b,b,c,d);
  }
  const g=new T.BufferGeometry();
  g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
  g.setAttribute("color",new T.Float32BufferAttribute(col,3));
  g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  g.setAttribute("fur",new T.Float32BufferAttribute(fur,1));
  if(opt.skin){
    g.setAttribute("skinIndex",new T.Uint16BufferAttribute(si,4));
    g.setAttribute("skinWeight",new T.Float32BufferAttribute(sw,4));
  }
  g.setIndex(idx);
  if(opt.xf)g.applyMatrix4(opt.xf);
  g.computeVertexNormals();
  const P=g.attributes.position,pj=new Float32Array(P.count*4),pw=opt.pw===undefined?1:opt.pw,tw=opt.topw||0;
  for(let i=0;i<P.count;i++){
    const q=opt.proj?opt.proj(meta[i*2],meta[i*2+1]):[P.getZ(i),P.getY(i)];
    pj[i*4]=q[0];pj[i*4+1]=q[1];pj[i*4+2]=pw;pj[i*4+3]=tw;
  }
  g.setAttribute("proj",new T.BufferAttribute(pj,4));
  const p2=new Float32Array(P.count*2);for(let i=0;i<P.count;i++){p2[i*2]=opt.fw||0;p2[i*2+1]=opt.rw||0;}
  g.setAttribute("pj2",new T.BufferAttribute(p2,2));
  if(full){
    const N=g.attributes.normal;
    for(let i=0;i<n;i++){
      const a=i*(seg+1),b=a+seg;
      const x=N.getX(a)+N.getX(b),y=N.getY(a)+N.getY(b),z=N.getZ(a)+N.getZ(b),l=Math.hypot(x,y,z)||1;
      N.setXYZ(a,x/l,y/l,z/l);N.setXYZ(b,x/l,y/l,z/l);
    }
  }
  return g;
}
function sampleRings(R,key,v){
  if(v<=R[0][key])return R[0];
  for(let i=1;i<R.length;i++)if(v<=R[i][key]){
    const a=R[i-1],b=R[i],t=(v-a[key])/(b[key]-a[key]||1),o={};
    for(const k in a)o[k]=Array.isArray(a[k])?a[k].map((q,j)=>lerp(q,b[k][j],t)):typeof a[k]==="number"?lerp(a[k],b[k],t):a[k];
    return o;
  }
  return R[R.length-1];
}
function noiseTexture(size,draw){
  const c=document.createElement("canvas");c.width=c.height=size;
  draw(c.getContext("2d"),size);
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.NoColorSpace;t.anisotropy=4;
  return t;
}
function roundedBox(w,h,d,r){
  const s=new T.Shape(),x=d/2,y=h/2;
  s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);
  s.lineTo(-x+r,y);s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);
  const b=Math.min(r,w*.3);
  const g=new T.ExtrudeGeometry(s,{depth:w-2*b,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:3,curveSegments:5});
  g.translate(0,0,-(w-2*b)/2);g.rotateY(Math.PI/2);
  return g;
}

/* ---------- the donkey ---------- */
function makeDonkey(){
  const group=new T.Group();group.rotation.order="YXZ";

  /* materials */
  const furMap=noiseTexture(256,(c,s)=>{
    c.fillStyle="#b4b4b4";c.fillRect(0,0,s,s);
    for(let i=0;i<9000;i++){
      const x=hash(i)*s,y=hash(i+.31)*s,l=5+hash(i+.67)*15,g=Math.floor(70+hash(i+.11)*185);
      c.strokeStyle="rgba("+g+","+g+","+g+",.42)";c.lineWidth=.7+hash(i+.5);
      c.beginPath();c.moveTo(x,y);c.lineTo(x+(hash(i+.9)-.5)*4,y+l);c.stroke();
    }
  });
  const weave=noiseTexture(128,(c,s)=>{
    c.fillStyle="#c8c8c8";c.fillRect(0,0,s,s);
    for(let i=0;i<s;i+=2){
      c.fillStyle="rgba(0,0,0,"+(.03+hash(i)*.05)+")";c.fillRect(i,0,1,s);
      c.fillStyle="rgba(255,255,255,"+(.02+hash(i+.4)*.05)+")";c.fillRect(0,i,s,1);
    }
    for(let i=0;i<500;i++){c.fillStyle="rgba(0,0,0,"+hash(i+.2)*.12+")";c.fillRect(hash(i)*s,hash(i+.7)*s,2+hash(i+.3)*7,1+hash(i+.5)*5);}
  });
  const hide=new T.MeshPhysicalMaterial({vertexColors:true,map:furMap,bumpMap:furMap,bumpScale:1.4,roughness:.93,metalness:0,
    sheen:1,sheenRoughness:.6,sheenColor:new T.Color(.1,.098,.092)});
  const strand=noiseTexture(256,(c,s)=>{
    const d=c.createImageData(s,s);
    for(let i=0;i<s*s;i++){const v=Math.floor(Math.pow(hash(i*.37+1.3),.8)*255);d.data[i*4]=d.data[i*4+1]=d.data[i*4+2]=v;d.data[i*4+3]=255;}
    c.putImageData(d,0,0);
  });
  strand.magFilter=T.NearestFilter;
  /* the coat is the reference sheet itself: side view on the flanks, top view on the back */
  const sheet=name=>{const t=new T.TextureLoader().load(name);t.colorSpace=T.NoColorSpace;t.generateMipmaps=false;t.minFilter=t.magFilter=T.LinearFilter;return t;};
  const tSide=sheet("coat_side.jpg"),tTop=sheet("coat_top.jpg"),tFront=sheet("coat_front.jpg"),tRear=sheet("coat_rear.jpg");
  function coat(m,h){
    m.onBeforeCompile=sh=>{
      Object.assign(sh.uniforms,{shell:{value:h},strand:{value:strand},tSide:{value:tSide},tTop:{value:tTop},tFront:{value:tFront},tRear:{value:tRear}});
      sh.vertexShader="attribute float fur;attribute vec4 proj;attribute vec2 pj2;uniform float shell;varying float vFur;varying vec4 vProj;varying vec4 vAux;\n"+
        sh.vertexShader.replace("#include <begin_vertex>",
        "vec3 transformed=position+normal*fur*shell+vec3(0.,-1.,0.)*fur*shell*shell*.5;vFur=fur;"+
        "vProj=vec4(proj.xyz,proj.w*smoothstep(.5,.9,normal.y));vAux=vec4(position.xz,pj2.x*smoothstep(.3,.75,normal.z),pj2.y*smoothstep(.3,.75,-normal.z));");
      sh.fragmentShader="uniform float shell;uniform sampler2D strand,tSide,tTop,tFront,tRear;varying float vFur;varying vec4 vProj;varying vec4 vAux;\n"+
        sh.fragmentShader.replace("#include <color_fragment>",
        "#include <color_fragment>\n"+
        "if(shell>0.){float st=texture2D(strand,vMapUv*vec2(.31,.27)).r;if(vFur<.0012||st<shell*.92)discard;}\n"+
        "float vy=1.-(349.-241.*vProj.y)/354.;\n"+
        "float pc=texture2D(tSide,vec2((442.-221.*vProj.x)/754.,1.-(318.-221.*vProj.y)/323.)).r;\n"+
        "pc=mix(pc,texture2D(tTop,vec2((108.+(1.15-vAux.y)*304.)/754.,1.-(112.-vAux.x*304.)/221.)).r,vProj.w);\n"+
        "pc=mix(pc,texture2D(tFront,vec2((390.+241.*vAux.x)/754.,vy)).r,vAux.z);\n"+
        "pc=mix(pc,texture2D(tRear,vec2((364.5-241.*vAux.x)/754.,vy)).r,vAux.w);\n"+
        "pc=pow(pc,2.2);pc=pc*2.1/(1.+1.7*pc);\n"+
        "diffuseColor.rgb=mix(diffuseColor.rgb,vec3(pc)*(.72+.4*texture2D(map,vMapUv).r),vProj.z);\n"+
        "if(shell>0.)diffuseColor.rgb*=mix(.75,1.35,shell*shell);");
    };
    return m;
  }
  const SHELLS=14,shellMats=[];
  for(let i=1;i<=SHELLS;i++)shellMats.push(coat(new T.MeshStandardMaterial({vertexColors:true,map:furMap,roughness:1,alphaToCoverage:true}),i/SHELLS));
  coat(hide,0);
  const horn=coat(new T.MeshStandardMaterial({vertexColors:true,roughness:.6,map:furMap}),0);
  const canvas=new T.MeshStandardMaterial({color:new T.Color(.36,.345,.31),roughness:.96,map:weave,bumpMap:weave,bumpScale:.8,side:T.DoubleSide});
  const canvasDark=new T.MeshStandardMaterial({color:new T.Color(.3,.285,.255),roughness:.97,map:weave,bumpMap:weave,bumpScale:.8,side:T.DoubleSide});
  const leather=new T.MeshStandardMaterial({color:new T.Color(.075,.066,.058),roughness:.58,side:T.DoubleSide});
  const metal=new T.MeshStandardMaterial({color:new T.Color(.62,.6,.56),roughness:.35,metalness:.85});
  const eyeMat=new T.MeshPhysicalMaterial({color:0x050505,roughness:.08,clearcoat:1});
  const dark=new T.MeshStandardMaterial({color:new T.Color(.02,.02,.02),roughness:.8});

  /* ----- skeleton (bind pose: all rotations identity, positions in metres, +Z forward) ----- */
  const bones=[],bind=[];
  function bone(name,parent,x,y,z){
    const b=new T.Bone();b.name=name;const i=bones.length;bones.push(b);bind.push([x,y,z]);
    if(parent>=0){const p=bind[parent];b.position.set(x-p[0],y-p[1],z-p[2]);bones[parent].add(b);}
    else b.position.set(x,y,z);
    b.userData.rest=b.position.clone();
    return i;
  }
  const B_BODY=bone("body",-1,0,.95,0);
  const B_PELVIS=bone("pelvis",B_BODY,0,.98,-.28);
  const B_CHEST=bone("chest",B_BODY,0,.96,.24);
  const B_NECK1=bone("neck1",B_CHEST,0,.92,.45);
  const B_NECK2=bone("neck2",B_NECK1,0,1.04,.68);
  const B_HEAD=bone("head",B_NECK2,0,1.25,.862);
  const tailPts=[[0,1.0,-.478],[0,.91,-.52],[0,.79,-.532],[0,.67,-.535],[0,.56,-.532]];
  const B_TAIL=[];for(let i=0;i<4;i++)B_TAIL.push(bone("tail"+i,i?B_TAIL[i-1]:B_PELVIS,...tailPts[i]));
  const LP=.075,HOOF=.06;
  const legDefs=[
    {name:"FL",front:true, x:.105,z:.415, y:.79,L1:.36,L2:.295,home:[.095,.445], slide:.24,off:[.25,.5]},
    {name:"FR",front:true, x:-.105,z:.415,y:.79,L1:.36,L2:.295,home:[-.095,.415],slide:.24,off:[.75,1]},
    {name:"HL",front:false,x:.115,z:-.25, y:.73,L1:.40,L2:.32, home:[.105,-.425], slide:.32,off:[0,0]},
    {name:"HR",front:false,x:-.115,z:-.25,y:.73,L1:.40,L2:.32, home:[-.105,-.365],slide:.32,off:[.5,.5]}
  ];
  for(const L of legDefs){
    const par=L.front?B_CHEST:B_PELVIS;
    L.b0=bone(L.name+"0",par,L.x,L.y,L.z);
    L.b1=bone(L.name+"1",L.b0,L.x,L.y-L.L1,L.z);
    L.b2=bone(L.name+"2",L.b1,L.x,L.y-L.L1-L.L2,L.z);
    L.b3=bone(L.name+"3",L.b2,L.x,L.y-L.L1-L.L2-LP,L.z);
    L.parent=bones[par];L.upper=bones[L.b0];L.lower=bones[L.b1];L.pastern=bones[L.b2];L.hoof=bones[L.b3];
    L.upper.rotation.order="ZXY";
    L.pos=new T.Vector3();L.from=new T.Vector3();L.stance=true;L.skip=false;L.lift=0;
  }
  group.add(bones[B_BODY]);
  group.updateMatrixWorld(true);
  const skeleton=new T.Skeleton(bones);
  const meshes=[],furMeshes=[];
  function skinned(geo,mat){
    const m=new T.SkinnedMesh(geo,mat);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;
    group.add(m);m.bind(skeleton);meshes.push(m);
    if(mat===hide)for(const sm of shellMats){
      const f=new T.SkinnedMesh(geo,sm);f.frustumCulled=false;f.receiveShadow=true;group.add(f);f.bind(skeleton);furMeshes.push(f);
    }
    return m;
  }
  function rigid(geo,mat,parent,x,y,z){
    const m=new T.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);m.castShadow=true;m.receiveShadow=true;parent.add(m);
    if(mat===hide)for(const sm of shellMats){const f=new T.Mesh(geo,sm);f.receiveShadow=true;m.add(f);furMeshes.push(f);}
    return m;
  }

  /* ----- torso ----- */
  const COAT=.125;
  const surf=(r,y)=>{ // half width of a ring's surface at height y above its centre
    const t=Math.abs(y)/(y>0?r.up:r.dn);
    if(t>=1)return 0;
    const e=r.e||1,cab=Math.pow(t,1/e);
    return r.w*Math.pow(Math.sqrt(1-cab*cab),e)*(1-(y>0?(r.tw||0):(r.bw||0))*Math.pow(cab,1.5));
  };
  const torsoRaw=[ // z, top, bottom, half width, squareness, top narrowing (measured from the reference side and top views, less fur)
    [-.526,.93,.86,.025,1,0],[-.51,.965,.75,.072,.95,.2],[-.48,.998,.70,.112,.92,.25],[-.44,1.03,.668,.145,.9,.3],
    [-.39,1.07,.648,.178,.88,.32],[-.30,1.097,.635,.2,.86,.32],[-.21,1.10,.6,.214,.85,.3],[-.10,1.085,.56,.226,.84,.28],
    [.02,1.07,.545,.242,.83,.28],[.14,1.057,.537,.235,.83,.32],[.24,1.06,.542,.216,.84,.4],[.335,1.085,.56,.202,.86,.5],
    [.42,1.09,.58,.19,.88,.5],[.49,1.055,.635,.162,.92,.4],[.533,.99,.71,.1,.96,.2],[.55,.91,.79,.03,1,0]
  ].map(a=>{const cy=a[2]+(a[1]-a[2])*.52;return {p:[0,cy,a[0]],z:a[0],w:a[3],up:a[1]-cy,dn:cy-a[2],e:a[4],tw:a[5]};});
  const torso=refine(torsoRaw,4);
  const mottle=(a,b)=>1+.09*Math.sin(a*37+b*11)*Math.sin(a*13-b*29);
  skinned(loft(torso,{seg:32,tan:[0,0,1],ur:9,vr:7,topw:1,rw:1,
    color:(r,sa,ca)=>{
      let g=lerp(COAT,.3,smooth(-.35,-.95,ca))*mottle(r.z,sa);
      if(ca>0)g=lerp(g,.04,1-smooth(.04,.15,Math.abs(sa)));
      return g;
    },
    fur:(r,sa,ca)=>.019+.012*smooth(-.3,-.9,ca),
    skin:r=>[B_PELVIS,B_CHEST,smooth(-.3,.26,r.z)]}),hide);

  /* ----- neck and mane ----- */
  const neck=refine([
    {p:[0,.84,.36],w:.185,up:.255,dn:.26,k:0,tw:.3},{p:[0,.925,.50],w:.14,up:.235,dn:.245,k:.7,tw:.45},
    {p:[0,1.0,.62],w:.118,up:.205,dn:.205,k:1.4,tw:.5},{p:[0,1.07,.72],w:.104,up:.172,dn:.175,k:2.1,tw:.45},
    {p:[0,1.13,.80],w:.096,up:.138,dn:.145,k:2.6,tw:.35},{p:[0,1.19,.86],w:.085,up:.095,dn:.105,k:3,tw:.2}
  ],4);
  const chain=[B_CHEST,B_NECK1,B_NECK2,B_HEAD];
  const neckSkin=r=>{const k=clamp(r.k,0,2.999),i=Math.floor(k);return [chain[i],chain[i+1],k-i];};
  skinned(loft(neck,{seg:24,ur:6,vr:7,topw:1,skin:neckSkin,fur:()=>.018,
    color:(r,sa,ca)=>lerp(COAT,.15,smooth(-.5,-1,ca))*mottle(r.k,sa)}),hide);
  const maneRings=[],maneN=(neck.length-6)*4;
  for(let i=5;i<neck.length-1;i++)for(let s=0;s<4;s++){
    const a=neck[i],b=neck[i+1],t=s/4,q=maneRings.length;
    const p=[0,1,2].map(j=>lerp(a.p[j],b.p[j],t)),tan=norm([0,b.p[1]-a.p[1],b.p[2]-a.p[2]]),up=cross(tan,[1,0,0]);
    const ride=lerp(a.up,b.up,t)-.03,h=(.022+.006*hash(q)+.003*Math.sin(q*.9))*smooth(-1,6,q)*smooth(maneN,maneN-7,q);
    maneRings.push({p:[(hash(q+.5)-.5)*.004,p[1]+up[1]*(ride+h),p[2]+up[2]*(ride+h)],w:.011+.003*hash(q+.2),up:h,dn:h,k:lerp(a.k,b.k,t),e:.8});
  }
  skinned(loft(maneRings,{seg:8,ur:3,vr:9,pw:.5,skin:neckSkin,color:()=>.03,fur:(r,sa,ca)=>.01+.016*smooth(-.2,.7,ca)}),hide);

  /* ----- head ----- */
  const HEAD_PITCH=1.09;
  const HS=1.1,headXf=new T.Matrix4().makeRotationX(HEAD_PITCH).scale(new T.Vector3(HS,HS,HS)).setPosition(bind[B_HEAD][0],bind[B_HEAD][1],bind[B_HEAD][2]);
  const headRings=refine([[-.06,.03,.03,.035,0,0],[-.03,.078,.082,.1,.2,.2],[.03,.094,.098,.128,.25,.35],[.11,.1,.1,.152,.32,.5],
    [.2,.098,.094,.16,.36,.55],[.28,.088,.084,.148,.36,.5],[.35,.075,.074,.108,.34,.35],[.41,.066,.066,.086,.26,.2],
    [.46,.064,.064,.084,.16,.1],[.5,.06,.06,.08,.12,.1],[.53,.048,.046,.062,.1,.1],[.55,.02,.018,.026,0,0]
  ].map(a=>({p:[0,-.01,a[0]],l:a[0],w:a[1],up:a[2],dn:a[3],tw:a[4],bw:a[5]})),4);
  const headAt=l=>sampleRings(headRings,"l",l);
  const EYE=[0,.005,.23];EYE[0]=surf(headAt(EYE[2]),EYE[1]+.01);
  skinned(loft(headRings,{seg:26,ur:5,vr:9,topw:.6,fw:1,xf:headXf,skin:()=>[B_HEAD,B_HEAD,0],tan:[0,0,1],
    fur:(r,sa,ca)=>{
      const dy=(ca>0?ca*r.up:ca*r.dn)-EYE[1],d=Math.abs(sa)>.5?Math.hypot(r.l-EYE[2],dy):1;
      return lerp(.011,.0025,smooth(.3,.42,r.l))*smooth(.55,.5,r.l)*smooth(.018,.045,d);
    },
    color:(r,sa,ca)=>{
      let g=lerp(COAT,.2,smooth(-.45,-1,ca));
      const dy=(ca>0?ca*r.up:ca*r.dn)-EYE[1],d=Math.hypot(r.l-EYE[2],dy);
      
      g=lerp(g,.5,smooth(.33,.41,r.l));
      return lerp(g,.16,smooth(.5,.548,r.l));
    }}),hide);
  const headFrame=new T.Group();headFrame.rotation.x=HEAD_PITCH;headFrame.scale.setScalar(HS);bones[B_HEAD].add(headFrame);
  const ears=[],lids=[];
  const earGeo=(function(){
    const NU=22,NV=11,pos=[],col=[],uv=[],fur=[],idx=[],ring=NV*2;
    for(let i=0;i<=NU;i++){
      const u=i/NU,half=(.05+.012*Math.sin(Math.PI*Math.min(1,u*1.25)))*(1-Math.pow(u,3.2))+.0015;
      const open=lerp(lerp(2.8,1.2,smooth(0,.4,u)),.8,smooth(.5,1,u)),R=half/open,y=-.03+u*.3,back=-.04*u*u;
      for(let j=0;j<ring;j++){
        const outer=j<NV,t=(outer?j:ring-1-j)/(NV-1),phi=(t*2-1)*open,r=outer?R:Math.max(R-.005,.001);
        pos.push(r*Math.sin(phi),y,-r*Math.cos(phi)+R+back);
        const edge=Math.abs(t*2-1),tip=smooth(.72,1,u);
        col.push(...Array(3).fill(outer?lerp(lerp(.11,.05,smooth(.5,1,edge)),.035,tip):lerp(lerp(.42,.08,smooth(.5,.97,edge)),.06,tip)));
        fur.push(outer?.0045:lerp(.013,0,smooth(.5,.9,edge))*(1-tip));
        uv.push(j/ring*3,u*5);
      }
    }
    for(let i=0;i<NU;i++)for(let j=0;j<ring;j++){
      const a=i*ring+j,b=i*ring+(j+1)%ring,c=a+ring,d=b+ring;idx.push(a,c,b,b,c,d);
    }
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("color",new T.Float32BufferAttribute(col,3));
    g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setAttribute("fur",new T.Float32BufferAttribute(fur,1));
    g.setIndex(idx);g.computeVertexNormals();
    g.setAttribute("proj",new T.BufferAttribute(new Float32Array(pos.length/3*4),4));
    g.setAttribute("pj2",new T.BufferAttribute(new Float32Array(pos.length/3*2),2));
    return g;
  })();
  const lidGeo=new T.SphereGeometry(.0188,14,8,0,TAU,0,Math.PI*.5);
  const lidMat=new T.MeshStandardMaterial({color:new T.Color(.05,.05,.05),roughness:.9});
  for(const s of [1,-1]){
    const pivot=new T.Group();pivot.position.set(s*.068,.02,.07);bones[B_HEAD].add(pivot);
    pivot.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(s*.64,.74,.14).normalize());
    const twist=new T.Group();twist.rotation.y=s*.7;pivot.add(twist);
    const ear=new T.Group();twist.add(ear);
    rigid(earGeo,hide,ear);
    ears.push({ear,s,flick:0,next:1+hash(s+5)*4});
    const ex=s*(EYE[0]-.012);
    rigid(new T.SphereGeometry(.017,16,12),eyeMat,headFrame,ex,EYE[1],EYE[2]);
    rigid(new T.SphereGeometry(.0022,8,6),new T.MeshBasicMaterial({color:0x9a9a9a}),headFrame,ex+s*.0163,EYE[1]+.005,EYE[2]+.005).castShadow=false;
    const lid=rigid(lidGeo,lidMat,headFrame,ex,EYE[1],EYE[2]);lid.castShadow=false;lids.push({lid,s});
    const nostril=rigid(new T.SphereGeometry(.014,10,8),dark,headFrame,s*.027,.008,.534);
    nostril.scale.set(.8,1.25,.5);nostril.rotation.set(-.35,s*.5,s*.3);
    const mouth=[];for(let l=.43;l<=.531;l+=.02)mouth.push([s*(surf(headAt(l),-.05)+.0005),-.06,l]);
    rigid(new T.TubeGeometry(new T.CatmullRomCurve3(mouth.map(p=>new T.Vector3(...p))),16,.0028,5),dark,headFrame);
  }
  /* halter (always worn) */
  function band(rings,inflate,mat,parent,arc,seg){
    const R=rings.map(r=>Object.assign({},r,{w:r.w+inflate,up:r.up+inflate,dn:r.dn+inflate}));
    return rigid(loft(R,{seg:seg||28,arc,open:true,tan:[0,0,1]}),mat,parent);
  }
  function tube(pts,r,mat,parent){
    const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(p[0],p[1],p[2])));
    return rigid(new T.TubeGeometry(curve,pts.length*6,r,6),mat,parent);
  }
  function ribbon(pts,width,mat,parent){
    const c=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(p[0],p[1],p[2]))),n=pts.length*8,pos=[],idx=[];
    for(let i=0;i<=n;i++){
      const q=c.getPoint(i/n);pos.push(q.x,q.y+width/2,q.z,q.x,q.y-width/2,q.z);
      if(i<n){const a=i*2;idx.push(a,a+1,a+2,a+2,a+1,a+3);}
    }
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
    return rigid(g,mat,parent);
  }
  band([headAt(.325),headAt(.345),headAt(.365)],.011,leather,headFrame);
  band([headAt(-.008),headAt(.003),headAt(.014)],.012,leather,headFrame);
  for(const s of [1,-1]){
    const pts=[];for(let l=.008;l<=.347;l+=.056)pts.push([s*(surf(headAt(l),-.02)+.012),-.03,l]);
    tube(pts,.008,leather,headFrame);
    rigid(new T.TorusGeometry(.016,.0035,6,14),metal,headFrame,s*(surf(headAt(.345),-.03)+.013),-.04,.345).rotation.y=Math.PI/2;
  }
  rigid(new T.TorusGeometry(.021,.004,6,16),metal,headFrame,0,-headAt(.345).dn-.036,.345).rotation.y=Math.PI/2;

  /* ----- tail ----- */
  const tailRings=refine([
    {p:[0,1.03,-.44],w:.034,up:.03,dn:.03,k:0},{p:tailPts[0],w:.03,up:.026,dn:.026,k:0},{p:tailPts[1],w:.025,up:.021,dn:.021,k:1},
    {p:tailPts[2],w:.021,up:.018,dn:.018,k:2},{p:tailPts[3],w:.02,up:.018,dn:.018,k:3},{p:tailPts[4],w:.025,up:.022,dn:.022,k:3},
    {p:[0,.48,-.53],w:.03,up:.026,dn:.026,k:3},{p:[0,.41,-.528],w:.022,up:.02,dn:.02,k:3},{p:[0,.37,-.527],w:.004,up:.004,dn:.004,k:3}
  ],3);
  skinned(loft(tailRings,{seg:10,ur:3,vr:8,rw:1,color:r=>lerp(COAT,.028,smooth(.66,.56,r.p[1])),
    fur:r=>lerp(.004,.026,smooth(.62,.5,r.p[1]))*smooth(.37,.41,r.p[1])+.003,
    skin:r=>{const k=clamp(r.k,0,2.999),i=Math.floor(k);return [B_TAIL[i],B_TAIL[i+1],k-i];}}),hide);

  /* ----- legs ----- */
  const frontRings=[[.24,.01,.02,.02,0,-.05],[.2,.05,.09,.09,0,-.02],[.14,.07,.125,.125,0,.004],[.07,.08,.125,.125,0,.018],[0,.078,.108,.112,-.004,.02],
    [-.1,.07,.09,.09,-.002,.012],[-.19,.058,.07,.066,.002,.008],[-.27,.05,.056,.05,.006,0],[-.325,.047,.053,.044,.008,0],[-.355,.05,.059,.044,.01,0],
    [-.39,.046,.052,.042,.008,0],[-.435,.037,.04,.039,.002,0],[-.545,.035,.037,.04,0,0],[-.62,.038,.04,.046,-.002,0],
    [-.655,.04,.042,.051,-.004,0],[-.69,.036,.039,.042,0,0],[-.732,.038,.042,.04,.004,0]];
  const hindRings=[[.17,.01,.02,.05,-.05,-.04],[.12,.05,.12,.12,-.03,-.04],[.04,.07,.17,.16,-.01,-.02],[-.02,.076,.17,.17,-.005,-.012],[-.08,.078,.15,.145,0,-.004],
    [-.16,.078,.1,.115,0,.01],[-.25,.06,.066,.084,0,.004],[-.33,.049,.052,.064,-.004,0],[-.398,.046,.048,.072,-.008,0],[-.45,.042,.044,.054,-.004,0],
    [-.5,.036,.038,.042,0,0],[-.62,.035,.036,.04,0,0],[-.7,.039,.041,.048,0,0],[-.73,.04,.042,.051,0,0],
    [-.765,.036,.039,.042,0,0],[-.807,.038,.042,.04,.004,0]];
  for(const L of legDefs){
    const j1=-L.L1,j2=-L.L1-L.L2,j3=j2-LP,s=Math.sign(L.x);
    const rings=refine((L.front?frontRings:hindRings).map(a=>{const th=lerp(1,1.2,smooth(.02,-.12,a[0]));return {p:[L.x+s*a[5],L.y+a[0],L.z+a[4]],y:a[0],w:a[1]*th,up:a[2]*th,dn:a[3]*th};}),3);
    const path=L.front?[[.26,.43,1.02],[0,.44,.79],[-.36,.445,.40],[-.655,.445,.13],[-.8,.455,0]]
      :[[.2,-.27,.93],[0,-.27,.73],[-.2,-.37,.56],[-.4,-.5,.40],[-.72,-.43,.11],[-.86,-.4,0]];
    const legProj=(r,cy)=>{
      let i=0;while(i<path.length-2&&r.y<path[i+1][0])i++;
      const a=path[i],b=path[i+1],t=clamp((r.y-a[0])/(b[0]-a[0]),0,1);
      return [lerp(a[1],b[1],t)+cy*.9,lerp(a[2],b[2],t)];
    };
    skinned(loft(rings,{seg:16,tan:[0,-1,0],ur:4,vr:7,proj:legProj,fw:1,rw:1,
      color:(r,sa)=>lerp(lerp(COAT,.19,smooth(.2,.9,-sa*s)*smooth(j2,.05,r.y)),.065,smooth(j2+.1,j3,r.y)*.6)*mottle(r.y,sa),
      fur:(r,sa,ca)=>(lerp(.008,.017,smooth(j1-.04,j1+.12,r.y))+.014*smooth(-.1,-.8,ca)*(1-smooth(.02,.1,Math.abs(r.y-j2+.01))))*smooth(j3-.004,j3+.03,r.y),
      skin:r=>{
        const y=r.y;
        if(y>j1+.035)return [L.b0,L.b0,0];
        if(y>j1-.035)return [L.b0,L.b1,(j1+.035-y)/.07];
        if(y>j2+.03)return [L.b1,L.b1,0];
        if(y>j2-.03)return [L.b1,L.b2,(j2+.03-y)/.06];
        return [L.b2,L.b3,smooth(j3+.035,j3-.005,y)];
      }}),hide);
    const k=L.front?1.14:1.06;
    const hoof=refine([{p:[L.x,L.y+j3+.014,L.z+.002],w:.034*k,up:.038*k,dn:.037*k},{p:[L.x,L.y+j3-.012,L.z+.006],w:.039*k,up:.046*k,dn:.039*k},
      {p:[L.x,L.y+j3-.04,L.z+.011],w:.045*k,up:.056*k,dn:.041*k},{p:[L.x,L.y+j3-HOOF+.003,L.z+.014],w:.048*k,up:.062*k,dn:.042*k}],2)
      .concat([{p:[L.x,L.y+j3-HOOF,L.z+.014],w:.044*k,up:.057*k,dn:.038*k},{p:[L.x,L.y+j3-HOOF+.008,L.z+.01],w:.004,up:.004,dn:.004}]);
    hoof.forEach(r=>{r.y=r.p[1]-L.y;});
    skinned(loft(hoof,{seg:16,tan:[0,-1,0],ur:2,vr:14,proj:legProj,fw:1,rw:1,skin:()=>[L.b3,L.b3,0],color:()=>.2}),horn);
  }

  /* ----- pack (rides on the body bone) ----- */
  const pack=new T.Group();pack.position.set(-bind[B_BODY][0],-bind[B_BODY][1],-bind[B_BODY][2]);
  const packPivot=new T.Group();bones[B_BODY].add(packPivot);packPivot.add(pack);
  const prof=z=>sampleRings(torso,"z",z);
  const FUR=.024;
  const surfX=(z,y)=>{const r=prof(z);return surf(r,y-r.p[1]);};
  const zs=(a,b,n)=>Array.from({length:n},(_,i)=>prof(lerp(a,b,i/(n-1))));
  band(zs(-.24,.36,12),FUR,canvasDark,pack,[-1.9,1.9]);
  band(zs(.03,.095,3),FUR+.01,leather,pack);
  rigid(new T.BoxGeometry(.05,.06,.07),metal,pack,0,prof(.06).p[1]-prof(.06).dn-FUR-.012,.06);
  band(zs(-.4,-.37,3),FUR,leather,pack,[-1.5,1.5]);
  const loop=(y,zA,zB,zEnd,n)=>{
    const pts=[];
    for(let i=0;i<n;i++){
      const z=lerp(zA,zB,i/(n-1));
      pts.push([surfX(z,y)+FUR+.004+.05*Math.exp(-Math.pow((z-.43)/.1,2))+.055*Math.exp(-Math.pow((z+.36)/.1,2)),y+(i?0:.04),z]);
    }
    pts.push([0,y-.004,zEnd]);
    for(let i=n-1;i>=0;i--)pts.push([-pts[i][0],pts[i][1],pts[i][2]]);
    return pts;
  };
  ribbon(loop(.86,-.2,-.51,-.552,8),.034,leather,pack);
  ribbon(loop(.88,.2,.525,.575,7),.034,leather,pack);
  const bags=[];
  for(const s of [1,-1]){
    const hang=new T.Group();hang.position.set(s*.275,1.1,.06);pack.add(hang);
    const bag=new T.Group();bag.position.set(s*.095,-.225,0);bag.rotation.z=s*.16;hang.add(bag);bags.push({hang,s});
    rigid(roundedBox(.2,.45,.52,.032),canvas,bag);
    rigid(roundedBox(.205,.03,.525,.012),canvasDark,bag,0,.21,0);
    rigid(roundedBox(.205,.03,.525,.012),canvasDark,bag,0,-.21,0);
    rigid(roundedBox(.014,.046,.34,.006),leather,bag,s*.103,.05,0);
    for(const z of [-.22,.22])for(const y of [-.185,.185])rigid(new T.SphereGeometry(.011,8,6),metal,bag,s*.101,y,z);
    for(const z of [-.15,.15]){
      tube([[s*.05,.225,z],[s*.0,.26,z],[-s*.1,.275,z],[-s*.2,.24,z]],.009,leather,bag).scale.z=2.2;
      bag.children[bag.children.length-1].position.z=-z*1.2;
    }
    rigid(roundedBox(.012,.15,.034,.004),leather,bag,s*.02,-.275,0).rotation.z=-s*.1;
    rigid(new T.BoxGeometry(.018,.04,.046),metal,bag,s*.02,-.24,0);
  }
  const rollProf=[];
  for(let i=0;i<=36;i++){
    const t=i/36,z=lerp(-.3,.5,t),sw=Math.pow(Math.max(Math.sin(Math.PI*t),0),.3),lump=.86+.14*Math.sin(t*19+1)+.06*Math.sin(t*41);
    rollProf.push({p:[.012*Math.sin(t*9),1.215+.012*Math.sin(t*13+2),z],z,w:Math.max(.004,.44*sw*(.94+.06*Math.sin(t*23))),
      up:Math.max(.004,.165*sw*lump),dn:Math.max(.004,.095*sw),e:.66});
  }
  const fold=(r,sa,ca)=>Math.sin(sa*9+r.z*23)*Math.sin(ca*4+r.z*11)+.6*Math.sin(r.z*55+sa*4);
  rigid(loft(rollProf,{seg:40,tan:[0,0,1],ur:5,vr:5,disp:(r,sa,ca)=>1+.035*fold(r,sa,ca),color:(r,sa,ca)=>.8+.2*fold(r,sa,ca)}),
    new T.MeshStandardMaterial({vertexColors:true,color:new T.Color(.42,.4,.36),roughness:.97,map:weave,bumpMap:weave,bumpScale:.8}),pack);
  for(const z of [-.12,.27]){
    const R=[-.022,0,.022].map(d=>Object.assign({},sampleRings(rollProf,"z",z+d)));
    R.forEach(r=>{r.w*=.99;r.up*=.94;});
    band(R,.012,leather,pack,null,30);
    rigid(new T.BoxGeometry(.055,.014,.058),metal,pack,.1,R[1].p[1]+R[1].up+.012,z);
  }
  const rope=new T.MeshStandardMaterial({color:new T.Color(.5,.46,.38),roughness:.9});
  for(let i=0;i<2;i++)tube([[-.46,1.11,-.22+i*.56],[-.43,1.24,-.17+i*.44],[0,1.41,.03+i*.1],[.43,1.24,.27-i*.44],[.46,1.11,.34-i*.56]],.009,rope,pack);

  /* ---------- motion ---------- */
  const S={x:0,z:0,y:0,heading:0,speed:0,yawRate:0,phase:0,gait:0,pitch:0,roll:0,moving:0,time:0,
    bray:0,blink:0,nextBlink:2,idle:0,rest:0,swish:0,nextSwish:3,look:0,lookTarget:0,nextLook:2,slope:0,onStep:null,label:"Stand"};
  const v3=new T.Vector3(),m4=new T.Matrix4(),home=new T.Vector3();
  const fwdX=()=>Math.sin(S.heading),fwdZ=()=>Math.cos(S.heading);
  function homeWorld(L,out){
    const c=Math.cos(S.heading),s=Math.sin(S.heading);
    return out.set(S.x+L.home[0]*c+L.home[1]*s,0,S.z-L.home[0]*s+L.home[1]*c);
  }
  function place(x,z,heading,heightAt){
    S.x=x;S.z=z;S.heading=heading||0;S.speed=S.yawRate=0;S.phase=0;
    for(const L of legDefs){homeWorld(L,L.pos);L.pos.y=heightAt(L.pos.x,L.pos.z);L.stance=true;L.skip=false;}
    S.y=heightAt(x,z);S.pitch=S.roll=0;
  }

  function update(dt,ctl,heightAt){
    dt=Math.min(dt,.05);S.time+=dt;
    const t=S.time;
    /* drive */
    const fx=fwdX(),fz=fwdZ();
    const hF=heightAt(S.x+fx*.44,S.z+fz*.44),hH=heightAt(S.x-fx*.4,S.z-fz*.4);
    const slope=(hF-hH)/.84;S.slope=lerp(S.slope,slope,1-Math.exp(-dt*4));
    const top=(ctl.trot?3.3:1.3)*clamp(1-S.slope*1.1,.5,1.12);
    const want=ctl.throttle>=0?ctl.throttle*top:ctl.throttle*.7;
    const acc=(Math.abs(want)<Math.abs(S.speed)||want*S.speed<0)?3.4:1.9;
    S.speed+=clamp(want-S.speed,-acc*dt,acc*dt);
    const yawWant=ctl.steer*lerp(1.35,1.0,smooth(0,3.3,Math.abs(S.speed)));
    S.yawRate=lerp(S.yawRate,yawWant,1-Math.exp(-dt*6));
    if(Math.abs(S.yawRate)<.002)S.yawRate=0;
    S.heading+=S.yawRate*dt;
    S.x+=Math.sin(S.heading)*S.speed*dt;S.z+=Math.cos(S.heading)*S.speed*dt;

    /* gait clock */
    const sp=Math.abs(S.speed);
    S.gait=smooth(1.7,2.4,sp);
    const stride=lerp(lerp(.6,1.12,smooth(0,1.15,sp)),1.95,S.gait),beta=lerp(.63,.43,S.gait);
    const driving=sp>.04||Math.abs(S.yawRate)>.1;
    let settle=false;
    for(const L of legDefs){
      homeWorld(L,home);
      if(!L.stance&&!L.skip)settle=true;
      else if(Math.hypot(L.pos.x-home.x,L.pos.z-home.z)>.085)settle=true;
    }
    let rate=Math.max(sp/stride,Math.abs(S.yawRate)*.62);
    if(!driving)rate=settle?1.25:0;
    S.phase+=rate*dt;
    S.moving=lerp(S.moving,driving?1:0,1-Math.exp(-dt*5));
    S.idle=driving||settle?0:S.idle+dt;
    S.rest=lerp(S.rest,S.idle>9&&Math.abs(S.pitch)<.12?1:0,1-Math.exp(-dt*(S.idle>9?1.5:9)));
    S.label=!driving?"Stand":sp<=.04?"Turn":S.speed<0?"Back":S.gait>.5?"Trot":S.slope>.14?"Uphill step":S.slope<-.14?"Downhill step":"Walk";

    /* feet */
    for(const L of legDefs){
      const lp=frac(S.phase+lerp(L.off[0],L.off[1],S.gait)),st=lp<beta;
      homeWorld(L,home);
      const rx=home.x-S.x,rz=home.z-S.z;
      const vx=Math.sin(S.heading)*S.speed+S.yawRate*rz,vz=Math.cos(S.heading)*S.speed-S.yawRate*rx;
      if(L.stance&&!st){
        L.skip=!driving&&Math.hypot(L.pos.x-home.x,L.pos.z-home.z)<.05;
        L.from.copy(L.pos);
      }
      if(!L.stance&&st&&!L.skip&&S.onStep)S.onStep(L,S.gait);
      if(st)L.skip=false;
      L.stance=st;L.lp=lp;L.beta=beta;L.u=0;
      if(!st&&!L.skip&&rate>0){
        const u=(lp-beta)/(1-beta),ahead=clamp(((1-u)*(1-beta)+beta*.5)/Math.max(rate,.2),0,.9);
        const tx=home.x+vx*ahead,tz=home.z+vz*ahead,e=u*u*(3-2*u);
        L.pos.x=lerp(L.from.x,tx,e);L.pos.z=lerp(L.from.z,tz,e);
        const lift=(L.front?lerp(.075,.15,S.gait):lerp(.06,.12,S.gait))*lerp(.6,1,smooth(0,.8,sp+Math.abs(S.yawRate)));
        L.lift=lift*Math.pow(Math.sin(Math.PI*u),.85);
        L.pos.y=heightAt(L.pos.x,L.pos.z);L.u=u;
      } else {
        L.lift=0;L.pos.y=heightAt(L.pos.x,L.pos.z);
        if(Math.hypot(L.pos.x-home.x,L.pos.z-home.z)>.95){L.pos.x=home.x;L.pos.z=home.z;}
      }
    }

    /* body over the ground */
    const lx=fz,lz=-fx;
    const hL=heightAt(S.x+lx*.2,S.z+lz*.2),hR=heightAt(S.x-lx*.2,S.z-lz*.2);
    const k=1-Math.exp(-dt*7);
    S.y=lerp(S.y,(hF*.52+hH*.48),k);
    S.pitch=lerp(S.pitch,Math.atan2(hF-hH,.84),k);
    S.roll=lerp(S.roll,Math.atan2(hL-hR,.4)*.55,k);
    group.position.set(S.x,S.y,S.z);
    group.rotation.set(-S.pitch,S.heading,-S.roll);

    /* body rhythm */
    const ph=S.phase*TAU,mv=S.moving,g=S.gait,walk=mv*(1-g),trot=mv*g;
    const body=bones[B_BODY],pelvis=bones[B_PELVIS],chest=bones[B_CHEST];
    const breath=Math.sin(t*1.7);
    body.position.copy(body.userData.rest);
    body.position.y+=walk*.011*Math.cos(ph*2+.6)+trot*(.026*Math.cos(ph*2+.2)-.012)+.003*breath-.012*Math.abs(S.pitch)*3;
    body.position.x+=walk*.012*Math.sin(ph+.5);
    body.rotation.set(walk*.012*Math.sin(ph*2)+trot*.01*Math.sin(ph*2+1),0,walk*.022*Math.sin(ph+.9)+trot*.012*Math.sin(ph));
    const bend=clamp(S.yawRate*.11,-.16,.16);
    pelvis.rotation.set(0,-bend+walk*.05*Math.sin(ph+.3),walk*.03*Math.sin(ph+.3)-S.rest*.035);
    chest.rotation.set(0,bend*.8-walk*.035*Math.sin(ph+.3),-walk*.02*Math.sin(ph+.3));

    /* neck and head */
    if(t>S.nextLook){S.lookTarget=(hash(t)-.5)*1.1;S.nextLook=t+2.5+hash(t+1)*5;}
    S.look=lerp(S.look,mv>.3||S.still?0:S.lookTarget,1-Math.exp(-dt*1.6));
    if(S.still){S.idle=0;S.nextSwish=S.nextBlink=t+9;for(const E of ears)E.next=t+9;}
    let brayUp=0,brayOpen=0;
    if(S.bray>0){
      S.bray-=dt;const bt=2.6-S.bray;
      brayUp=smooth(0,.35,bt)*smooth(2.6,2.2,bt);brayOpen=brayUp*(.5+.5*Math.sin(bt*9.5));
    }
    const nod=walk*.055*Math.cos(ph*2+1.9)+trot*.02*Math.cos(ph*2+.4);
    const carry=walk*.1-trot*.06+clamp(S.slope,-.3,.4)*.5+(S.still?0:.04*Math.sin(t*.43)*(1-mv));
    const n1=bones[B_NECK1],n2=bones[B_NECK2],hd=bones[B_HEAD];
    n1.rotation.set(carry+nod-brayUp*.3,bend*1.1+S.look*.3,0);
    n2.rotation.set(carry*.4+nod*.5-brayUp*.14,bend*.9+S.look*.35,0);
    hd.rotation.set(-carry*.7-nod*.9-brayUp*.38-brayOpen*.1,bend*.8+S.look*.4,S.look*.08);
    for(const E of ears){
      if(t>E.next){E.flick=1;E.next=t+1.2+hash(t+E.s)*5;}
      E.flick=Math.max(0,E.flick-dt*4.5);
      const f=Math.sin(E.flick*Math.PI),back=trot*.35+brayUp*.8;
      E.ear.rotation.set(-back*.75-f*.25+walk*.04*Math.sin(ph*2+E.s),-E.s*f*.7,E.s*(f*.2+.04*Math.sin(t*.8+E.s)-back*.25));
    }

    /* eyes */
    if(t>S.nextBlink){S.blink=1;S.nextBlink=t+1.5+hash(t+3)*5;}
    S.blink=Math.max(0,S.blink-dt*7);
    const shut=Math.sin(S.blink*Math.PI);
    for(const E of lids)E.lid.rotation.z=-E.s*(.62+shut*.9+brayUp*.2);

    /* load sways against the stride */
    packPivot.rotation.set(trot*.012*Math.sin(ph*2+2.2),0,walk*.018*Math.sin(ph+2.1)+trot*.012*Math.sin(ph+1));
    packPivot.position.y=trot*.007*Math.cos(ph*2+1.3);
    for(const G of bags)G.hang.rotation.z=G.s*(walk*.03*Math.sin(ph*2+G.s)+trot*.05*Math.max(0,Math.sin(ph*2+1.6+G.s)));

    /* tail */
    if(t>S.nextSwish){S.swish=1;S.nextSwish=t+2+hash(t+2)*6;}
    S.swish=Math.max(0,S.swish-dt*.9);
    const sw=Math.sin(S.swish*Math.PI)*.2;
    for(let i=0;i<4;i++){
      const b=bones[B_TAIL[i]];
      b.rotation.z=(.04+sw)*Math.sin(t*(sw>.02?9:2.2)-i*.9)*(.4+i*.15)+walk*.05*Math.sin(ph-i*.7)+trot*.05*Math.sin(ph*2-i)-S.yawRate*.07;
      b.rotation.x=(i===0?.1:.03)+sp*.018-(i===0?brayUp*.5:0)+trot*.04*Math.sin(ph*2-i*.8);
    }

    /* legs */
    group.updateMatrixWorld(true);
    for(const L of legDefs){
      m4.copy(L.parent.matrixWorld).invert();
      v3.copy(L.pos).applyMatrix4(m4);                       // sole centre in parent space
      const rest=L.upper.userData.rest;
      let chi=0,psi=24*DEG;
      const s=L.lp/L.beta;
      if(L.stance||L.skip){
        chi=(L.skip?0:34*DEG*smooth(.72,1,s))*mv;
        psi=(24+8*Math.sin(Math.PI*clamp(s,0,1))*(.4+.6*mv)*(1+.6*g))*DEG;
      } else {
        const u=L.u,fl=1+.5*g;
        chi=(34*(1-smooth(0,.5,u))*mv+30*fl*Math.sin(Math.PI*clamp(u/.62,0,1))-9*smooth(.62,.92,u)*(1-smooth(.94,1,u)))*DEG;
        psi=(24-52*fl*Math.pow(Math.sin(Math.PI*u),1.2))*DEG;
      }
      if(L.name==="HL"&&S.rest>.001){chi=lerp(chi,50*DEG,S.rest);psi=lerp(psi,-8*DEG,S.rest);}
      const c=Math.cos(chi),sn=Math.sin(chi),cp=chi>0;
      const cy=v3.y+L.lift+(cp?HOOF*c+.058*sn:HOOF),cz=v3.z+(cp?.058+HOOF*sn-.058*c:0)-.013;
      const fy=cy+LP*Math.cos(psi),fz=cz-LP*Math.sin(psi);
      const homeZ=L.home[1]-(L.front?bind[B_CHEST][2]:bind[B_PELVIS][2]);
      let ry=rest.y,rzz=rest.z+L.slide*clamp(v3.z-homeZ,-.5,.5);
      let dx=v3.x-rest.x,dy=fy-ry,dz=fz-rzz;
      const LM=(L.L1+L.L2)*.997;
      let dn=Math.hypot(dx,dy),d=Math.hypot(dn,dz);
      if(d>LM){
        const need=Math.sqrt(Math.max(LM*LM-dz*dz,.04)),drop=clamp(dn-need,0,.1);
        ry-=drop;dy=fy-ry;dn=Math.hypot(dx,dy);d=Math.min(LM,Math.hypot(dn,dz));
      }
      d=Math.max(d,.2);
      const th=Math.atan2(dz,dn);
      const A=Math.acos(clamp((L.L1*L.L1+d*d-L.L2*L.L2)/(2*L.L1*d),-1,1));
      const Bk=Math.acos(clamp((L.L1*L.L1+L.L2*L.L2-d*d)/(2*L.L1*L.L2),-1,1));
      const a1=L.front?th+A:th-A,rel=L.front?-(Math.PI-Bk):(Math.PI-Bk),a2=a1+rel;
      L.upper.position.set(rest.x,ry,rzz);
      L.upper.rotation.set(-a1,0,Math.atan2(dx,-dy));
      L.lower.rotation.x=-rel;
      L.pastern.rotation.x=-(psi-a2);
      L.hoof.rotation.x=chi+psi;
    }
  }

  return {group,update,place,state:S,pack,furMeshes,
    setFur(on){for(const f of furMeshes)f.visible=on;},
    setPack(on){pack.visible=on;},
    bray(){if(S.bray<=0)S.bray=2.6;}};
}
window.makeDonkey=makeDonkey;
})();
