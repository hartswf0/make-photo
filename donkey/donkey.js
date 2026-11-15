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
  if(!opt.arc&&!opt.arcOf&&!opt.open){ // close both ends so no tube is ever seen into
    const tip=r=>Object.assign({},r,{w:.0008,up:.0008,dn:.0008});
    rings=[tip(rings[0])].concat(rings,[tip(rings[rings.length-1])]);
  }
  const seg=opt.seg||20,n=rings.length,full=!opt.arc&&!opt.arcOf;
  const a0=full?Math.PI:opt.arc?opt.arc[0]:0,a1=full?Math.PI*3:opt.arc?opt.arc[1]:1;
  const pos=[],col=[],uv=[],si=[],sw=[],idx=[],fur=[],meta=[],hw=[];
  let v=0;
  for(let i=0;i<n;i++){
    const r=rings[i];
    const t=r.t||opt.tan||norm([0,1,2].map(q=>rings[Math.min(n-1,i+1)].p[q]-rings[Math.max(0,i-1)].p[q]));
    const side=r.side||opt.side||[1,0,0],up=norm(cross(t,side)),e=r.e||opt.e||1;
    if(i>0)v+=Math.hypot(r.p[0]-rings[i-1].p[0],r.p[1]-rings[i-1].p[1],r.p[2]-rings[i-1].p[2]);
    const w=Math.max(.0015,r.w),hu=Math.max(.0015,r.up),hd=Math.max(.0015,r.dn);
    for(let j=0;j<=seg;j++){
      const A=opt.arcOf?opt.arcOf(r):null,a=A?lerp(A[0],A[1],j/seg):lerp(a0,a1,j/seg),sa=Math.sin(a),ca=Math.cos(a);
      const dsp=opt.disp?opt.disp(r,sa,ca):1,nar=1-(ca>0?(r.tw||0):(r.bw||0))*Math.pow(Math.abs(ca),1.5);
      let cx=Math.sign(sa)*Math.pow(Math.abs(sa),e)*w*nar*dsp,cy=Math.sign(ca)*Math.pow(Math.abs(ca),e)*(ca>0?hu:hd)*dsp;
      if(opt.sculpt){const k=1+opt.sculpt(r,cx,cy)/(Math.hypot(cx,cy)||1);cx*=k;cy*=k;}
      fur.push(opt.fur?opt.fur(r,sa,ca):0);meta.push(r,cy);hw.push(opt.hw?opt.hw(r,sa,ca):0);
      pos.push(r.p[0]+side[0]*cx+up[0]*cy,r.p[1]+side[1]*cx+up[1]*cy,r.p[2]+side[2]*cx+up[2]*cy);
      const g=opt.color?opt.color(r,sa,ca):1;col.push(g,g,g);
      uv.push(j/seg*(opt.ur||4),v*(opt.vr||6));
      if(opt.skin){const s=opt.skin(r,sa,ca);si.push(s[0],s[1],0,0);sw.push(1-s[2],s[2],0,0);}
    }
  }
  for(let i=0;i<n-1;i++)for(let j=0;j<seg;j++){
    if(opt.cut&&opt.cut(rings[i],rings[i+1],lerp(a0,a1,j/seg),lerp(a0,a1,(j+1)/seg)))continue;
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
  const p2=new Float32Array(P.count*3);for(let i=0;i<P.count;i++){p2[i*3]=opt.fw||0;p2[i*3+1]=opt.rw||0;p2[i*3+2]=hw[i];}
  g.setAttribute("pj2",new T.BufferAttribute(p2,3));
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
  /* the coat is the reference sheet itself: side view on the flanks, top view on the back */
  const sheet=name=>{const t=new T.TextureLoader().load(name);t.colorSpace=T.NoColorSpace;t.generateMipmaps=false;t.minFilter=t.magFilter=T.LinearFilter;return t;};
  const tSide=sheet("coat_side.jpg"),tTop=sheet("coat_top.jpg"),tFront=sheet("coat_front.jpg"),tRear=sheet("coat_rear.jpg"),tHead=sheet("coat_head.jpg");
  const face={hU:{value:new T.Vector4()},hV:{value:new T.Vector4()},hD:{value:new T.Vector3()},tHead:{value:tHead}};
  function coat(m,h){
    m.onBeforeCompile=sh=>{
      Object.assign(sh.uniforms,{shell:{value:h},strand:{value:strand},tSide:{value:tSide},tTop:{value:tTop},tFront:{value:tFront},tRear:{value:tRear}},face);
      sh.vertexShader="attribute float fur;attribute vec4 proj;attribute vec3 pj2;uniform float shell;uniform vec4 hU,hV;uniform vec3 hD;varying float vFur;varying vec4 vProj;varying vec4 vAux;varying vec3 vHA;varying vec3 vHB;\n"+
        sh.vertexShader.replace("#include <begin_vertex>",
        "vec3 transformed=position+normal*fur*shell+vec3(0.,-1.,0.)*fur*shell*shell*.5;vFur=fur;"+
        "vProj=vec4(proj.xyz,proj.w*smoothstep(.5,.9,normal.y));vAux=vec4(position.xz,pj2.x*smoothstep(.3,.75,normal.z),pj2.y*smoothstep(.3,.75,-normal.z));"+
        "vec4 hp=vec4(position,1.),hm=vec4(-position.x,position.yz,1.);"+
        "vHA=vec3(dot(hU,hp),dot(hV,hp),pj2.z*smoothstep(.05,.5,dot(normal,hD)));vHB=vec3(dot(hU,hm),dot(hV,hm),pj2.z*smoothstep(.05,.5,dot(vec3(-normal.x,normal.yz),hD)));");
      sh.fragmentShader="uniform float shell;uniform sampler2D strand,tSide,tTop,tFront,tRear,tHead;varying float vFur;varying vec4 vProj;varying vec4 vAux;varying vec3 vHA;varying vec3 vHB;\n"+
        sh.fragmentShader.replace("#include <color_fragment>",
        "#include <color_fragment>\n"+
        "if(shell>0.){float st=texture2D(strand,vMapUv*vec2(.62,.54)).r;if(vFur<.0012||st<shell*.92)discard;}\n"+
        "float vy=1.-(349.-241.*vProj.y)/354.;\n"+
        "float pc=texture2D(tSide,vec2((442.-221.*vProj.x)/754.,1.-(318.-221.*vProj.y)/323.)).r;\n"+
        "pc=mix(pc,texture2D(tTop,vec2((108.+(1.15-vAux.y)*304.)/754.,1.-(112.-vAux.x*304.)/221.)).r,vProj.w);\n"+
        "pc=mix(pc,texture2D(tFront,vec2((390.+241.*vAux.x)/754.,vy)).r,vAux.z);\n"+
        "pc=mix(pc,texture2D(tRear,vec2((364.5-241.*vAux.x)/754.,vy)).r,vAux.w);\n"+
        "float hw=vHA.z+vHB.z;if(hw>.001)pc=mix(pc,(texture2D(tHead,vHA.xy).r*vHA.z+texture2D(tHead,vHB.xy).r*vHB.z)/hw,clamp(hw,0.,1.));\n"+
        "pc=pow(pc,2.2);pc=pc*2.1/(1.+1.7*pc);\n"+
        "diffuseColor.rgb=mix(diffuseColor.rgb,vec3(pc)*(.72+.4*texture2D(map,vMapUv).r),vProj.z);\n"+
        "if(shell>0.)diffuseColor.rgb*=mix(.75,1.35,shell*shell);if(!gl_FrontFacing)diffuseColor.rgb*=.22;");
    };
    return m;
  }
  const SHELLS=14,shellMats=[];
  for(let i=1;i<=SHELLS;i++)shellMats.push(coat(new T.MeshStandardMaterial({vertexColors:true,map:furMap,roughness:1,alphaToCoverage:true}),i/SHELLS));
  coat(hide,0);
  const hideOpen=coat(hide.clone(),0);hideOpen.side=T.DoubleSide;hideOpen.shadowSide=T.FrontSide;
  const horn=coat(new T.MeshStandardMaterial({vertexColors:true,roughness:.6,map:furMap}),0);
  const canvas=new T.MeshStandardMaterial({color:new T.Color(.36,.345,.31),roughness:.96,map:weave,bumpMap:weave,bumpScale:.8,side:T.DoubleSide});
  const canvasDark=new T.MeshStandardMaterial({color:new T.Color(.3,.285,.255),roughness:.97,map:weave,bumpMap:weave,bumpScale:.8,side:T.DoubleSide});
  const leather=new T.MeshStandardMaterial({color:new T.Color(.075,.066,.058),roughness:.58,side:T.DoubleSide});
  const metal=new T.MeshStandardMaterial({color:new T.Color(.62,.6,.56),roughness:.35,metalness:.85});
  const eyeMat=new T.MeshPhysicalMaterial({color:0x030303,roughness:.05,clearcoat:1,clearcoatRoughness:.03});
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
  const B_HEAD=bone("head",B_NECK2,0,1.25,.868);
  const HEAD_PITCH=1.1,HS=1.19;
  const headPt=(y,l)=>[0,bind[B_HEAD][1]+HS*(y*Math.cos(HEAD_PITCH)-l*Math.sin(HEAD_PITCH)),bind[B_HEAD][2]+HS*(y*Math.sin(HEAD_PITCH)+l*Math.cos(HEAD_PITCH))];
  const B_JAW=bone("jaw",B_HEAD,...headPt(-.05,.12)),B_LIP=bone("lip",B_HEAD,...headPt(.02,.4));
  const tailPts=[[0,1.0,-.47],[0,.91,-.503],[0,.79,-.512],[0,.67,-.514],[0,.56,-.512]];
  const B_TAIL=[];for(let i=0;i<4;i++)B_TAIL.push(bone("tail"+i,i?B_TAIL[i-1]:B_PELVIS,...tailPts[i]));
  const LP=.075,HOOF=.06;
  const legDefs=[
    {name:"FL",front:true, x:.105,z:.418, y:.79,L1:.36,L2:.295,home:[.095,.448], slide:.08,off:[.25,.5]},
    {name:"FR",front:true, x:-.105,z:.418,y:.79,L1:.36,L2:.295,home:[-.095,.418],slide:.08,off:[.75,1]},
    {name:"HL",front:false,x:.115,z:-.25, y:.73,L1:.37,L2:.31, home:[.105,-.41], slide:.1,off:[0,0]},
    {name:"HR",front:false,x:-.115,z:-.25,y:.73,L1:.37,L2:.31, home:[-.105,-.35],slide:.1,off:[.5,.5]}
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
    if(mat===hide||mat===hideOpen)for(const sm of shellMats){
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
    [-.39,1.07,.648,.178,.88,.32],[-.30,1.097,.635,.2,.86,.32],[-.21,1.10,.615,.214,.85,.3],[-.10,1.085,.572,.226,.84,.28],
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
  skinned(loft(neck,{seg:24,ur:6,vr:7,topw:1,hw:(r,sa,ca)=>smooth(1.7,2.5,r.k)*smooth(.25,-.1,ca),skin:neckSkin,fur:()=>.018,
    color:(r,sa,ca)=>lerp(COAT,.15,smooth(-.5,-1,ca))*mottle(r.k,sa)}),hide);
  const maneRings=[],maneN=(neck.length-7)*4;
  for(let i=7;i<neck.length;i++)for(let s=0;s<4;s++){
    const a=neck[Math.min(i,neck.length-2)],b=neck[Math.min(i,neck.length-2)+1],t=i>=neck.length-1?1+s*.35:s/4,q=maneRings.length;
    const p=[0,1,2].map(j=>lerp(a.p[j],b.p[j],t)),tan=norm([0,b.p[1]-a.p[1],b.p[2]-a.p[2]]),up=cross(tan,[1,0,0]);
    const ride=lerp(a.up,b.up,t)-.03,h=(.034+.01*hash(q)+.006*Math.sin(q*1.7))*smooth(0,14,q)*smooth(maneN+2,maneN-4,q);
    maneRings.push({p:[(hash(q+.5)-.5)*.004,p[1]+up[1]*(ride+h),p[2]+up[2]*(ride+h)],w:.011+.003*hash(q+.2),up:h,dn:h,k:lerp(a.k,b.k,t),e:.8});
  }
  skinned(loft(maneRings,{seg:8,ur:3,vr:9,pw:.5,skin:neckSkin,color:()=>.03,fur:(r,sa,ca)=>.012+.034*smooth(-.2,.7,ca)}),hide);

  /* ----- head ----- */
  const headXf=new T.Matrix4().makeRotationX(HEAD_PITCH).scale(new T.Vector3(HS,HS,HS)).setPosition(bind[B_HEAD][0],bind[B_HEAD][1],bind[B_HEAD][2]);
  const headRings=refine([[-.06,.03,.03,.035,0,0],[-.03,.092,.088,.1,.2,.2],[.03,.116,.106,.138,.22,.32],[.1,.124,.11,.168,.26,.46],
    [.18,.12,.102,.178,.3,.5],[.25,.104,.09,.156,.34,.46],[.31,.086,.077,.108,.34,.32],[.365,.074,.069,.084,.26,.2],
    [.41,.073,.068,.082,.16,.1],[.45,.071,.066,.084,.12,.1],[.485,.06,.054,.066,.1,.1,.004],[.505,.024,.022,.03,0,0,.008]
  ].map(a=>({p:[0,-.01+(a[6]||0),a[0]],l:a[0],w:a[1],up:a[2],dn:a[3],tw:a[4],bw:a[5]})),8);
  const headAt=l=>sampleRings(headRings,"l",l);
  const EYE=[0,.005,.21];EYE[0]=surf(headAt(EYE[2]),EYE[1]+.01);
  const MOUTH=-.048,headY=(r,ca)=>(ca>0?ca*r.up:ca*r.dn)+r.p[1],lipY=r=>Math.max(MOUTH,r.p[1]-.56*r.dn);
  const G=(a,b,c,sa,sb,sc)=>Math.exp(-(a*a/(sa*sa)+b*b/(sb*sb)+c*c/(sc*sc)));
  const sculptHead=(r,x,y)=>{
    const ax=Math.abs(x),yy=y-.01,l=r.l;
    return -.009*G(ax-EYE[0],yy-EYE[1],l-EYE[2],.03,.013,.022)      // eye socket
      +.006*G(ax-EYE[0]+.006,yy-EYE[1]-.027,l-EYE[2]+.004,.03,.011,.04) // brow
      +.003*G(ax-EYE[0]+.004,yy-EYE[1]+.026,l-EYE[2]-.01,.03,.01,.035)  // lower lid pouch
      -.004*G(ax-.07,yy-.06,l-.1,.04,.02,.04)                       // temple hollow
      +.008*G(ax-.085,yy+.07,l-.17,.04,.05,.07)                     // cheek muscle
      +.004*G(ax-.07,yy+.0,l-.31,.03,.012,.06)                      // facial crest
      -.016*G(ax-.036,yy-.004,l-.484,.013,.016,.013)                  // nostril
      +.006*G(ax-.05,yy-.012,l-.468,.012,.02,.02)                  // nostril wing
      -.004*G(0,yy+.05,l-.46,1,.005,.05)*smooth(.385,.42,l)         // mouth
      +.002*G(ax,yy+.07,l-.45,.03,.012,.03);                       // chin
  };
  skinned(loft(headRings,{seg:44,ur:5,vr:9,topw:.2,fw:1,xf:headXf,sculpt:sculptHead,hw:(r,sa,ca)=>lerp(smooth(.25,-.1,ca),1,smooth(.02,.12,r.l)),skin:(r,sa,ca)=>{
      const l=r.l,yy=headY(r,ca),m=lipY(r);
      if(yy>m)return [B_HEAD,B_LIP,smooth(.41,.5,l)];
      const k=smooth(.3,.385,l);
      return [B_HEAD,B_JAW,smooth(.1,.28,l)*smooth(lerp(-.02,m+.00002,k),lerp(-.08,m-.00002,k),yy)];
    },
    cut:(a,b,p,q)=>Math.min(a.l,b.l)>.385&&Math.cos((p+q)/2)<0&&((headY(a,Math.cos(p))-lipY(a))*(headY(a,Math.cos(q))-lipY(a))<=0||(headY(b,Math.cos(p))-lipY(b))*(headY(b,Math.cos(q))-lipY(b))<=0),
    tan:[0,0,1],
    fur:(r,sa,ca)=>{
      const dy=(ca>0?ca*r.up:ca*r.dn)-EYE[1],d=Math.abs(sa)>.5?Math.hypot(r.l-EYE[2],dy):1;
      return lerp(.0055,.0015,smooth(.26,.38,r.l))*smooth(.505,.46,r.l)*smooth(.018,.045,d);
    },
    color:(r,sa,ca)=>{
      let g=lerp(COAT,.2,smooth(-.45,-1,ca));
      const dy=(ca>0?ca*r.up:ca*r.dn)-EYE[1],d=Math.hypot(r.l-EYE[2],dy);
      
      g=lerp(g,.5,smooth(.3,.37,r.l));
      return lerp(g,.16,smooth(.47,.505,r.l));
    }}),hideOpen);
  (function fitPortrait(){
    const L=[[-EYE[0],EYE[1],EYE[2],240,232,12],[EYE[0],EYE[1],EYE[2],352,233],[-.036,.004,.487,335,386,4],[0,-.004,.507,378,402],
      [0,-.09,.46,322,442],[0,.1,.02,252,116],[-.06,-.155,.19,192,368],[0,.098,.19,306,208],[0,.068,.37,350,316],[-.055,-.05,.41,292,402]];
    const A=[0,1,2,3].map(()=>[0,0,0,0,0,0]),v=new T.Vector3();
    for(const q of L){
      v.set(q[0],q[1],q[2]).applyMatrix4(headXf);const x=[v.x,v.y,v.z,1];
      const wt=q[5]||1;
      for(let i=0;i<4;i++){for(let j=0;j<4;j++)A[i][j]+=wt*x[i]*x[j];A[i][4]+=wt*x[i]*q[3]/480;A[i][5]+=wt*x[i]*(1-q[4]/451);}
    }
    for(let i=0;i<4;i++){
      let m=i;for(let k=i+1;k<4;k++)if(Math.abs(A[k][i])>Math.abs(A[m][i]))m=k;
      [A[i],A[m]]=[A[m],A[i]];
      for(let k=0;k<4;k++)if(k!==i){const f=A[k][i]/A[i][i];for(let j=i;j<6;j++)A[k][j]-=f*A[i][j];}
    }
    const U=A.map((r,i)=>r[4]/r[i]),V=A.map((r,i)=>r[5]/r[i]);
    face.hU.value.set(U[0],U[1],U[2],U[3]);face.hV.value.set(V[0],V[1],V[2],V[3]);
    const d=new T.Vector3(U[0],U[1],U[2]).cross(new T.Vector3(V[0],V[1],V[2])).normalize();
    if(d.x>0)d.negate();face.hD.value.copy(d);
    let err=0;for(const q of L){v.set(q[0],q[1],q[2]).applyMatrix4(headXf);
      err+=Math.hypot((U[0]*v.x+U[1]*v.y+U[2]*v.z+U[3])*480-q[3],(1-(V[0]*v.x+V[1]*v.y+V[2]*v.z+V[3]))*451-q[4]);}
    makeDonkey.fit={meanPixelError:err/L.length,dir:d.toArray()};
  })();
  const headFrame=new T.Group();headFrame.rotation.x=HEAD_PITCH;headFrame.scale.setScalar(HS);bones[B_HEAD].add(headFrame);
  const frameOn=b=>{const f=new T.Group();f.rotation.x=HEAD_PITCH;f.scale.setScalar(HS);
    f.position.set(0,bind[B_HEAD][1]-bind[b][1],bind[B_HEAD][2]-bind[b][2]);bones[b].add(f);return f;};
  const jawFrame=frameOn(B_JAW),lipFrame=frameOn(B_LIP);
  const gum=new T.MeshStandardMaterial({color:new T.Color(.035,.03,.03),roughness:.5});
  const tooth=new T.MeshStandardMaterial({color:new T.Color(.62,.6,.52),roughness:.35});
  const tongueMat=new T.MeshStandardMaterial({color:new T.Color(.2,.17,.17),roughness:.4});
  const blob=(mat,par,x,y,z,sx,sy,sz)=>{const m=rigid(new T.SphereGeometry(1,14,10),mat,par,x,y,z);m.scale.set(sx,sy,sz);m.castShadow=false;return m;};
  /* mouth: a lining gives both jaws thickness, lips rim the slit, incisors stand in gums, a jointed tongue rides the jaw */
  blob(gum,headFrame,0,-.05,.25,.05,.05,.04);
  const lining=new T.MeshStandardMaterial({color:new T.Color(.12,.085,.085),roughness:.42,side:T.DoubleSide});
  const lipMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.7});
  const gumMat=new T.MeshStandardMaterial({color:new T.Color(.2,.14,.14),roughness:.35});
  const mouthRings=headRings.filter(r=>r.l>=.24&&r.l<=.498&&r.up>.02);
  const lipAng=r=>Math.acos(clamp((lipY(r)-r.p[1])/r.dn,-1,0));
  const inset=mouthRings.map(r=>Object.assign({},r,{am:lipAng(r),w:Math.max(r.w-.013,.004),up:Math.max(r.up-.012,.004),dn:Math.max(r.dn-.014,.004)}));
  const inner=(arcOf,skin)=>{const m=skinned(loft(inset,{seg:18,open:true,tan:[0,0,1],xf:headXf,arcOf,skin}),lining);m.castShadow=false;return m;};
  inner(r=>[r.am+.06,TAU-r.am-.06],()=>[B_JAW,B_JAW,0]);
  inner(r=>[-r.am+.06,r.am-.06],r=>[B_HEAD,B_LIP,smooth(.41,.5,r.l)]);
  const lipSkin=new T.MeshStandardMaterial({vertexColors:true,roughness:.85,side:T.DoubleSide});
  const lipStrip=(sgn,skin)=>{ // outer lip face, lip edge, and the inner wall back to the lining
    const R=headRings.filter(r=>r.l>=.375&&r.up>.012),seq=[],pos=[],col=[],si=[],sw=[],idx=[];
    for(let i=0;i<R.length;i+=2)seq.push([R[i],-1]);
    for(let i=R.length-1-((R.length-1)%2);i>=0;i-=2)seq.push([R[i],1]);
    seq.forEach(([r,sx],n)=>{
      const y0=lipY(r),pale=lerp(.07,.34,smooth(.37,.44,r.l)),q=skin(r.l);
      const pt=(dy,ins)=>{const y=y0+sgn*dy,x=surf(r,y-r.p[1]);return [sx*x*(1-ins),r.p[1]+(y-r.p[1])*(1-ins),r.l];};
      for(const [v,c] of [[pt(.012,-.012),pale],[pt(.0008,.015),pale*.4+.03],[pt(.0008,.25),.085]]){
        pos.push(v[0],v[1],v[2]);col.push(c,c,c);si.push(q[0],q[1],0,0);sw.push(1-q[2],q[2],0,0);}
      if(n){const a=(n-1)*3,b=n*3;idx.push(a,b,a+1,a+1,b,b+1,a+1,b+1,a+2,a+2,b+1,b+2);}
    });
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("color",new T.Float32BufferAttribute(col,3));
    g.setAttribute("skinIndex",new T.Uint16BufferAttribute(si,4));g.setAttribute("skinWeight",new T.Float32BufferAttribute(sw,4));
    g.setIndex(idx);g.applyMatrix4(headXf);g.computeVertexNormals();
    const m=new T.SkinnedMesh(g,lipSkin);m.frustumCulled=false;group.add(m);m.bind(skeleton);return m;
  };
  lipStrip(1,l=>[B_HEAD,B_LIP,smooth(.41,.5,l)]);
  lipStrip(-1,()=>[B_JAW,B_JAW,0]);
  const toothGeo=roundedBox(.0108,.021,.0072,.0028);
  for(const [frame,y,tilt,gy] of [[headFrame,-.036,-.22,-.025],[jawFrame,-.06,.2,-.071]]){
    for(let i=0;i<6;i++){
      const a=(i-2.5)*.34,k=1-.12*Math.abs(i-2.5)/2.5;
      const th=rigid(toothGeo,tooth,frame,Math.sin(a)*.029,y,.428+Math.cos(a)*.044);
      th.rotation.set(tilt,a,0,"YXZ");th.scale.set(1,k,1);th.castShadow=false;
    }
    const gm=rigid(new T.TorusGeometry(.034,.0085,8,20,Math.PI*.8),gumMat,frame,0,gy,.428);
    gm.rotation.set(Math.PI/2,0,Math.PI*.1+Math.PI);gm.scale.set(.86,1.28,1);gm.castShadow=false;
  }
  const tongue=new T.Group();tongue.position.set(0,-.05,.262);jawFrame.add(tongue);
  const tongueTip=new T.Group();tongueTip.position.set(0,0,.118);tongue.add(tongueTip);
  const tng=(z0,z1,n,w0,w1,round)=>{
    const R=[];for(let i=0;i<=n;i++){const t=i/n,e=round?Math.sqrt(Math.max(1-Math.pow(t,2.6),.0004)):1;
      R.push({p:[0,0,lerp(z0,z1,t)],w:lerp(w0,w1,t)*e,up:.0075*(round?lerp(1,.6,t)*e:1),dn:.0045*(round?e:1)});}
    return loft(R,{seg:14,tan:[0,0,1],open:!round,color:(r,sa,ca)=>ca>.5?lerp(.75,1,smooth(0,.4,Math.abs(sa))):1});
  };
  const tMat=new T.MeshStandardMaterial({color:new T.Color(.3,.22,.22),roughness:.3,vertexColors:true});
  rigid(tng(0,.122,8,.021,.0235,false),tMat,tongue).castShadow=false;
  rigid(tng(0,.072,9,.0235,.019,true),tMat,tongueTip).castShadow=false;
  const ears=[],lids=[],nostrils=[];
  const earGeo=(function(){
    const NU=22,NV=11,pos=[],col=[],uv=[],fur=[],idx=[],ring=NV*2;
    for(let i=0;i<=NU;i++){
      const u=i/NU,half=(.062+.03*Math.sin(Math.PI*Math.min(1,u*1.2)))*(1-Math.pow(u,6))+.0015;
      const open=lerp(lerp(2.85,1.25,smooth(0,.35,u)),.95,smooth(.5,1,u)),R=half/open,y=-.03+u*.275,back=-.035*u*u;
      for(let j=0;j<ring;j++){
        const outer=j<NV,t=(outer?j:ring-1-j)/(NV-1),phi=(t*2-1)*open,r=outer?R:Math.max(R-.007,.001);
        pos.push(r*Math.sin(phi),y,-r*Math.cos(phi)+R+back);
        const edge=Math.abs(t*2-1),tip=smooth(.72,1,u);
        col.push(...Array(3).fill(outer?lerp(lerp(.11,.05,smooth(.5,1,edge)),.035,tip):lerp(lerp(lerp(.2,.42,smooth(.1,.75,edge))*lerp(.7,1.1,smooth(.1,.7,u)),.08,smooth(.8,.99,edge)),.08,smooth(.9,1,u))*(.8+.4*hash(i*7.3+j*3.1))));
        fur.push(outer?.007:lerp(.016,.006,smooth(.5,.95,edge)));
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
    g.setAttribute("pj2",new T.BufferAttribute(new Float32Array(pos.length),3));
    return g;
  })();
  const lidGeo=new T.SphereGeometry(.0138,14,8,0,TAU,0,Math.PI*.5);
  const lidLow=lidGeo.clone().rotateX(Math.PI);
  const lidMat=new T.MeshStandardMaterial({color:new T.Color(.05,.05,.05),roughness:.9});
  for(const s of [1,-1]){
    const sw=new T.Group();sw.position.set(s*.088,-.012,.045);sw.rotation.order="YXZ";bones[B_HEAD].add(sw);
    const pivot=new T.Group();sw.add(pivot);
    pivot.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(s*.42,.84,.36).normalize());
    const twist=new T.Group();twist.rotation.y=s*.85;pivot.add(twist);
    const ear=new T.Group();twist.add(ear);
    rigid(earGeo,hide,ear);
    ears.push({ear,sw,s,flick:0,next:1+hash(s+5)*4});
    const ex=s*(EYE[0]-.0165);
    rigid(new T.SphereGeometry(.0125,16,12),eyeMat,headFrame,ex,EYE[1],EYE[2]);
    const lid=rigid(lidGeo,lidMat,headFrame,ex,EYE[1],EYE[2]);lid.castShadow=false;
    const low=rigid(lidLow,lidMat,headFrame,ex,EYE[1],EYE[2]);low.castShadow=false;lids.push({lid,low,s});
    const nostril=rigid(new T.SphereGeometry(.014,10,8),dark,lipFrame,s*.031,.006,.481);
    nostril.scale.set(.8,1.25,.5);nostril.rotation.set(-.35,s*.5,s*.3);nostrils.push(nostril);
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
  const halter=new T.Group();headFrame.add(halter);
  band([headAt(.307),headAt(.32),headAt(.333)],.009,leather,halter);
  band([headAt(-.006),headAt(.003),headAt(.012)],.011,leather,halter);
  for(const s of [1,-1]){
    const pts=[];for(let l=.008;l<=.322;l+=.052)pts.push([s*(surf(headAt(l),-.02)+.012),-.03,l]);
    tube(pts,.0055,leather,halter);
    rigid(new T.TorusGeometry(.013,.003,6,14),metal,halter,s*(surf(headAt(.32),-.03)+.013),-.04,.32).rotation.y=Math.PI/2;
  }
  rigid(new T.TorusGeometry(.018,.0035,6,16),metal,halter,0,-headAt(.32).dn-.036,.32).rotation.y=Math.PI/2;

  /* ----- tail ----- */
  const tailRings=refine([
    {p:[0,1.03,-.44],w:.034,up:.03,dn:.03,k:0},{p:tailPts[0],w:.03,up:.026,dn:.026,k:0},{p:tailPts[1],w:.025,up:.021,dn:.021,k:1},
    {p:tailPts[2],w:.021,up:.018,dn:.018,k:2},{p:tailPts[3],w:.02,up:.018,dn:.018,k:3},{p:tailPts[4],w:.025,up:.022,dn:.022,k:3},
    {p:[0,.48,-.51],w:.03,up:.026,dn:.026,k:3},{p:[0,.41,-.508],w:.022,up:.02,dn:.02,k:3},{p:[0,.37,-.507],w:.004,up:.004,dn:.004,k:3}
  ],3);
  skinned(loft(tailRings,{seg:10,ur:3,vr:8,rw:1,color:r=>lerp(COAT,.028,smooth(.66,.56,r.p[1])),
    fur:r=>lerp(.004,.026,smooth(.62,.5,r.p[1]))*smooth(.37,.41,r.p[1])+.003,
    skin:r=>{const k=clamp(r.k,0,2.999),i=Math.floor(k);return [B_TAIL[i],B_TAIL[i+1],k-i];}}),hide);

  /* ----- legs ----- */
  const frontRings=[[.24,.01,.02,.02,0,-.05],[.2,.05,.09,.09,0,-.02],[.14,.07,.125,.125,0,.004],[.07,.08,.125,.125,0,.018],[0,.078,.108,.112,-.004,.02],
    [-.1,.07,.09,.09,-.002,.012],[-.19,.058,.07,.066,.002,.008],[-.27,.05,.056,.05,.006,0],[-.325,.047,.053,.044,.008,0],[-.355,.05,.059,.044,.01,0],
    [-.39,.046,.052,.042,.008,0],[-.435,.037,.04,.039,.002,0],[-.545,.035,.037,.04,0,0],[-.62,.038,.04,.046,-.002,0],
    [-.655,.04,.042,.051,-.004,0],[-.69,.036,.039,.042,0,0],[-.732,.038,.042,.04,.004,0]];
  const hindRings=[[.17,.01,.02,.05,-.05,-.04],[.12,.05,.12,.12,-.03,-.04],[.04,.07,.14,.14,-.01,-.02],[-.02,.076,.14,.15,-.005,-.012],[-.08,.078,.125,.13,0,-.004],
    [-.16,.076,.105,.11,0,.006],[-.25,.06,.075,.082,0,.004],[-.33,.049,.052,.064,-.004,0],[-.398,.046,.048,.072,-.008,0],[-.45,.042,.044,.054,-.004,0],
    [-.5,.036,.038,.042,0,0],[-.62,.035,.036,.04,0,0],[-.7,.039,.041,.048,0,0],[-.73,.04,.042,.051,0,0],
    [-.765,.036,.039,.042,0,0],[-.807,.038,.042,.04,.004,0]];
  for(const L of legDefs){
    const j1=-L.L1,j2=-L.L1-L.L2,j3=j2-LP,s=Math.sign(L.x);
    const rings=refine((L.front?frontRings:hindRings).map(a=>{
      const th=lerp(1,1.2,smooth(.02,-.12,a[0])),T=L.front?[0,-.355,-.655,-.732]:[0,-.398,-.73,-.807],J=[0,j1,j2,j3];
      let y=a[0];for(let i=0;i<3;i++)if(a[0]<=T[i]&&a[0]>=T[i+1])y=lerp(J[i],J[i+1],(a[0]-T[i])/(T[i+1]-T[i]));
      return {p:[L.x+s*a[5],L.y+y,L.z+a[4]],y,w:a[1]*th,up:a[2]*th,dn:a[3]*th};}),3);
    const path=L.front?[[.26,.43,1.02],[0,.44,.79],[-.36,.44,.40],[-.655,.44,.13],[-.8,.45,0]]
      :[[.2,-.27,.93],[0,-.27,.73],[-.19,-.37,.56],[-.37,-.49,.40],[-.68,-.43,.11],[-.82,-.4,0]];
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
  const FACE={earF:0,earL:0,earR:0,earTurn:0,droop:0,lid:0,low:0,lidTilt:0,jaw:0,jawSide:0,lip:0,nos:0,neck:0,head:0,yaw:0,roll:0,tail:0,tailUp:0,rest:0,
    tongue:0,tongueUp:0,tongueSide:0,paw:0,pawFwd:0,kick:0,bodyPitch:0,crouch:0};
  const SPRING={earF:[170,.42],earL:[170,.42],earR:[170,.42],earTurn:[170,.42],droop:[150,.45],neck:[55,.62],head:[70,.6],yaw:[60,.65],roll:[70,.55],tailUp:[60,.5]},V={};
  for(const k in SPRING)V[k]=0;
  const F=Object.assign({},FACE),T_=Object.assign({},FACE);
  const pulse=(t,a,b)=>smooth(a,a+(b-a)*.3,t)*smooth(b,b-(b-a)*.35,t);
  /* Moods: f(t since start, targets, clock). Fields: ears (earF forward+/back-, droop sideways), lids (lid +closed/-wide, low = lower lid),
     jaw open, upper lip curl, nostril flare, neck/head pitch (+ lowers), yaw, roll, tail. `dur` makes a mood a one-shot. */
  const MOODS={
    calm:{label:"Calm",f:(t,P,c)=>{P.earF=.05;P.droop=.16+.05*Math.sin(c*.5);P.lid=.05;}},
    alert:{label:"Alert",f:(t,P)=>{P.earF=.34;P.droop=-.08;P.lid=-.28;P.nos=.6;P.neck=-.24;P.head=.1;P.yaw=.28*Math.sin(t*.9);P.tailUp=.15;}},
    curious:{label:"Curious",f:(t,P)=>{const k=Math.sin(t*1.3);P.roll=.24*smooth(-.4,.4,k)-.06;P.yaw=.3;P.neck=-.06;P.head=-.16;
      P.earF=.2;P.earL=.22*smooth(-.2,.2,Math.sin(t*2.1));P.earR=.22*smooth(-.2,.2,Math.sin(t*2.1+2.4));P.lid=-.12;
      P.nos=.45+.45*Math.sin(t*9);P.lip=.07+.07*Math.sin(t*9+1);}},
    content:{label:"Content",f:(t,P)=>{P.lid=.5;P.low=.55;P.droop=.62;P.earF=-.12;P.jaw=.03;P.neck=.12;P.head=.05;P.roll=.04*Math.sin(t*.7);P.tail=.25;}},
    sleepy:{label:"Dozing",f:(t,P)=>{const nodOff=pulse(t%5,3.2,4.6);P.lid=.9-.5*pulse(t%5,4.5,5);P.low=.4;P.droop=.78;P.earF=-.08;
      P.jaw=.05;P.neck=.3+.14*nodOff;P.head=-.12;P.rest=1;}},
    annoyed:{label:"Annoyed",f:(t,P)=>{P.earF=-1.25;P.droop=.1;P.lid=.3;P.lidTilt=.6;P.nos=.9;P.neck=.2;P.head=-.28;P.yaw=.16*Math.sin(t*3.1);
      P.lip=-.08;P.tail=1;P.jawSide=.3*Math.sin(t*5);}},
    startled:{label:"Startled",dur:1.9,snap:26,f:(t,P)=>{const e=1-smooth(.9,1.9,t);P.neck=-.42*e;P.head=.22*e;P.lid=-.3;P.nos=1;
      P.earF=.4*e;P.earTurn=.5*Math.sin(t*14)*smooth(.3,.5,t)*e;P.tailUp=.5*e;}},
    bray:{label:"Braying",dur:3.3,snap:18,f:(t,P)=>{
      const e=pulse(t,0,3.3),c=(t+.6)%.72,on=t>.12&&t<2.5?1:0,hee=pulse(c,0,.34)*on,haw=pulse(c,.3,.72)*on;
      P.neck=(-.3-.12*hee+.07*haw)*e;P.head=(-.36-.14*hee+.1*haw)*e;P.jaw=(.2+.75*hee+.42*haw)*e;P.lip=(.1+.3*hee)*e;
      P.tongue=.25*hee*e;P.earF=-.95*e;P.droop=.15*e;P.nos=e;P.lid=.3*e+.3*hee;P.low=.4*e;P.tailUp=.8*e;P.crouch=.3*haw*e;P.bodyPitch=-.03*hee*e;}},
    flehmen:{label:"Flehmen",dur:3.6,f:(t,P)=>{const e=pulse(t,0,3.6);P.neck=-.4*e;P.head=-.62*e;P.lip=e;P.jaw=.1*e;P.lid=.55*e;P.low=.6*e;
      P.earF=-.25*e;P.droop=.35*e;P.nos=-.4*e;P.roll=.05*Math.sin(t*2)*e;}},
    yawn:{label:"Yawning",dur:3.4,f:(t,P)=>{const e=pulse(t,.2,3.2);P.jaw=1.15*e;P.lid=1*e;P.low=.5*e;P.head=-.35*e;P.neck=-.1*e;P.roll=.22*e;
      P.earF=-.5*e;P.droop=.3*e;P.lip=.2*e;P.jawSide=.5*e;}},
    chew:{label:"Chewing",f:(t,P)=>{const k=t*6.2;P.jaw=.05+.1*Math.max(0,Math.sin(k));P.jawSide=.9*Math.sin(k+1.3);P.lid=.18;P.droop=.3;
      P.earF=-.02;P.neck=.05;P.head=.03*Math.sin(k);P.lip=.05*Math.sin(k*.5);}},
    graze:{label:"Grazing",f:(t,P)=>{const k=t*7,up=pulse(t%9,7.2,9);P.neck=.78-.5*up;P.head=-.72+.6*up;P.bodyPitch=.04*(1-up);P.crouch=.2*(1-up);
      P.jaw=.04+.07*Math.max(0,Math.sin(k));P.jawSide=.8*Math.sin(k+1.2);P.lip=.1+.1*Math.sin(k*.5);P.droop=.3;P.earF=.05+.1*Math.sin(t*1.7);
      P.earL=.15*smooth(.6,.9,Math.sin(t*.9));P.lid=.2;P.tail=.35;P.yaw=.25*Math.sin(t*.45);P.nos=.2+.2*Math.sin(k*.5);}},
    lick:{label:"Licking",dur:2.6,f:(t,P)=>{const e=pulse(t,0,2.6),k=t*5.2;P.jaw=(.3+.08*Math.sin(k))*e;P.tongue=(.75+.25*Math.sin(k))*e;
      P.tongueUp=(.55+.45*Math.sin(k+.6))*e;P.tongueSide=Math.sin(k*.5)*e;P.lip=.15*e;P.lid=.35*e;P.low=.3*e;P.head=-.1*e;P.droop=.35*e;P.nos=.3*e;}},
    greet:{label:"Greeting",dur:3,f:(t,P)=>{const e=pulse(t,0,3),k=Math.sin(t*6.5);P.earF=.4*e;P.droop=-.05;P.neck=(-.14+.12*k)*e;P.head=(.08-.1*k)*e;
      P.lid=-.2*e;P.nos=(.5+.4*k)*e;P.lip=(.12+.1*Math.sin(t*13))*e;P.jaw=.04*e;P.tail=.5*e;P.roll=.08*Math.sin(t*3.2)*e;}},
    paw:{label:"Pawing",dur:3,f:(t,P)=>{const e=pulse(t,0,3),k=t*7.5,on=smooth(.3,.6,t)*smooth(2.7,2.3,t);P.paw=on*(.35+.65*Math.max(0,Math.sin(k)));
      P.pawFwd=on*Math.cos(k);P.neck=.38*e;P.head=-.1*e;P.earF=-.45*e;P.nos=.7*e;P.lid=.2*e;P.tail=.8*e;P.yaw=-.12*e;P.crouch=.15*e;}},
    kick:{label:"Kicking",dur:1.6,snap:22,f:(t,P)=>{const wind=pulse(t,0,.55),go=pulse(t,.38,.95);P.kick=go;P.bodyPitch=.24*go-.05*wind;P.crouch=.5*wind*(1-go)-1.5*go;
      P.neck=.3*go+.1*wind;P.head=-.15*go;P.earF=-1.2*pulse(t,0,1.5);P.nos=1;P.lid=.3;P.lidTilt=.6;P.tailUp=go;P.tail=1;}},
    shake:{label:"Shaking off",dur:1.5,snap:40,f:(t,P)=>{const e=pulse(t,0,1.5),k=Math.sin(t*24);P.roll=.42*k*e;P.yaw=.12*Math.cos(t*24)*e;
      P.droop=(.5+.45*k)*e;P.earTurn=.5*k*e;P.lid=.8*e;P.low=.5*e;P.neck=.1*e;P.jaw=.05*e;}}
  };
  const S={mood:"calm",moodT:0,autoT:0,idleMood:6,alive:true,x:0,z:0,y:0,heading:0,speed:0,yawRate:0,phase:0,gait:0,pitch:0,roll:0,moving:0,time:0,
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
    const v0=S.speed;
    S.speed+=clamp(want-S.speed,-acc*dt,acc*dt);
    S.accel=lerp(S.accel||0,(S.speed-v0)/Math.max(dt,1e-4),1-Math.exp(-dt*6));
    const yawWant=ctl.steer*lerp(1.35,1.0,smooth(0,3.3,Math.abs(S.speed)));
    S.yawRate=lerp(S.yawRate,yawWant,1-Math.exp(-dt*6));
    if(Math.abs(S.yawRate)<.002)S.yawRate=0;
    S.heading+=S.yawRate*dt;
    S.x+=Math.sin(S.heading)*S.speed*dt;S.z+=Math.cos(S.heading)*S.speed*dt;

    /* gait clock */
    const sp=Math.abs(S.speed);
    S.gait=smooth(1.7,2.4,sp);
    const stride=lerp(lerp(.55,.94,smooth(0,1.15,sp)),1.7,S.gait),beta=lerp(.63,.43,S.gait);
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
    S.lean=lerp(S.lean||0,clamp(S.yawRate*S.speed*.05,-.14,.14),1-Math.exp(-dt*5));
    group.rotation.set(-S.pitch+F.bodyPitch+clamp(S.accel*.012,-.05,.05),S.heading,-S.roll+S.lean);

    /* body rhythm */
    const ph=S.phase*TAU,mv=S.moving,g=S.gait,walk=mv*(1-g),trot=mv*g;
    const body=bones[B_BODY],pelvis=bones[B_PELVIS],chest=bones[B_CHEST];
    const breath=Math.sin(t*1.7);
    body.position.copy(body.userData.rest);
    body.position.y+=-F.crouch*.05+walk*.011*Math.cos(ph*2+.6)+trot*(.026*Math.cos(ph*2+.2)-.012)+.003*breath-.012*Math.abs(S.pitch)*3;
    body.position.x+=walk*.012*Math.sin(ph+.5);
    body.rotation.set(walk*.012*Math.sin(ph*2)+trot*.01*Math.sin(ph*2+1),0,walk*.022*Math.sin(ph+.9)+trot*.012*Math.sin(ph));
    const bend=clamp(S.yawRate*.11,-.16,.16);
    pelvis.rotation.set(0,-bend+walk*.05*Math.sin(ph+.3),walk*.03*Math.sin(ph+.3)-S.rest*.035);
    chest.rotation.set(0,bend*.8-walk*.035*Math.sin(ph+.3),-walk*.02*Math.sin(ph+.3));

    /* neck, head and face: a mood sets targets, the face eases toward them */
    if(t>S.nextLook){S.lookTarget=(hash(t)-.5)*1.1;S.nextLook=t+2.5+hash(t+1)*5;}
    S.look=lerp(S.look,mv>.3||S.still||S.mood!=="calm"?0:S.lookTarget,1-Math.exp(-dt*1.6));
    if(S.still){S.idle=0;S.nextSwish=S.nextBlink=t+9;for(const E of ears)E.next=t+9;}
    S.moodT+=dt;
    const busy=sp>.04||Math.abs(S.yawRate)>.1;
    if(S.autoT>0){S.autoT-=dt;if(S.autoT<=0&&!MOODS[S.mood].dur){S.mood="calm";S.moodT=0;}}
    if(S.mood==="calm"&&!busy&&!S.still&&S.alive){
      S.idleMood-=dt;
      if(S.idleMood<0){
        const r=hash(t*3.7),pick=r<.2?"chew":r<.36?"curious":r<.5?"graze":r<.62?"shake":r<.72?"lick":r<.8?"content":r<.87?"yawn":r<.94?"greet":"paw";
        S.mood=pick;S.moodT=0;S.autoT=MOODS[pick].dur?0:3.5+hash(t)*4;S.idleMood=5+hash(t+9)*8;if(S.onMood)S.onMood(pick);
      }
    }
    let M=MOODS[S.mood];
    if(M.dur&&S.moodT>M.dur){S.mood="calm";S.moodT=0;M=MOODS.calm;}
    if(mv>.5&&(S.mood==="sleepy"||S.mood==="content"||S.mood==="graze"||S.mood==="paw"||S.mood==="lick")){S.mood="calm";S.moodT=0;M=MOODS.calm;}
    for(const k in FACE)T_[k]=0;
    M.f(S.moodT,T_,t);
    const ease=1-Math.exp(-dt*(M.snap||10));
    for(const k in FACE){
      const sp=SPRING[k];
      if(sp&&!M.snap){V[k]+=((T_[k]-F[k])*sp[0]-V[k]*2*Math.sqrt(sp[0])*sp[1])*dt;F[k]+=V[k]*dt;}
      else F[k]=lerp(F[k],T_[k],ease);
    }
    tongue.position.z=.262+F.tongue*.2;tongue.position.y=-.05+F.tongue*.006;tongue.rotation.set(-F.tongueUp*.25,F.tongueSide*.35,0);
    tongueTip.rotation.set(-F.tongueUp*1.0,F.tongueSide*.5,0);
    const nod=walk*.055*Math.cos(ph*2+1.9)+trot*.02*Math.cos(ph*2+.4);
    const carry=walk*.0-trot*.1+clamp(S.slope,-.3,.4)*.5+(S.still?0:.04*Math.sin(t*.43)*(1-mv));
    const n1=bones[B_NECK1],n2=bones[B_NECK2],hd=bones[B_HEAD];
    n1.rotation.set(carry+nod+F.neck,bend*1.1+S.look*.3+F.yaw*.35,0);
    n2.rotation.set(carry*.4+nod*.5+F.neck*.5,bend*.9+S.look*.35+F.yaw*.35,F.roll*.3);
    hd.rotation.set(-carry*.7-nod*.9+F.head,bend*.8+S.look*.4+F.yaw*.5,S.look*.08+F.roll);
    bones[B_JAW].rotation.set(F.jaw*.42,0,F.jawSide*.07);
    bones[B_LIP].rotation.set(-F.lip*.75,0,0);
    bones[B_LIP].position.copy(bones[B_LIP].userData.rest);bones[B_LIP].position.y+=F.lip*.012;
    for(const N of nostrils)N.scale.set(.8*(1+.55*F.nos),1.25*(1+.35*F.nos),.5);
    for(const E of ears){
      if(t>E.next){E.flick=1;E.next=t+1.2+hash(t+E.s)*5;}
      E.flick=Math.max(0,E.flick-dt*4.5);
      const f=Math.sin(E.flick*Math.PI)*(1-Math.min(1,Math.abs(F.earF))),own=E.s>0?F.earL:F.earR;
      E.sw.rotation.set((F.earF+own)*1.0-trot*.3+walk*.04*Math.sin(ph*2+E.s),-E.s*F.earTurn,-E.s*(F.droop*.95+.04*Math.sin(t*.8+E.s)));
      E.ear.rotation.set(-f*.25,-E.s*f*.7,E.s*f*.2);
    }

    /* eyes */
    if(t>S.nextBlink){S.blink=1;S.nextBlink=t+1.5+hash(t+3)*5;}
    S.blink=Math.max(0,S.blink-dt*7);
    const shut=Math.max(Math.sin(S.blink*Math.PI),0);
    for(const E of lids){
      E.lid.rotation.set(F.lidTilt*.5,0,-E.s*clamp(.35+F.lid*1.15+shut*1.15,.02,1.5));
      E.low.rotation.set(0,0,E.s*clamp(F.low*.95+shut*.3,0,1.2));
    }

    /* load sways against the stride */
    packPivot.rotation.set(trot*.012*Math.sin(ph*2+2.2),0,walk*.018*Math.sin(ph+2.1)+trot*.012*Math.sin(ph+1));
    packPivot.position.y=trot*.007*Math.cos(ph*2+1.3);
    for(const G of bags)G.hang.rotation.z=G.s*(walk*.03*Math.sin(ph*2+G.s)+trot*.05*Math.max(0,Math.sin(ph*2+1.6+G.s)));

    /* tail */
    if(t>S.nextSwish){S.swish=1;S.nextSwish=t+2+hash(t+2)*6;}
    S.swish=Math.max(0,S.swish-dt*.9);
    const sw=Math.sin(S.swish*Math.PI)*.2+F.tail*.22;
    for(let i=0;i<4;i++){
      const b=bones[B_TAIL[i]];
      b.rotation.z=(.04+sw)*Math.sin(t*(sw>.02?9:2.2)-i*.9)*(.4+i*.15)+walk*.05*Math.sin(ph-i*.7)+trot*.05*Math.sin(ph*2-i)-S.yawRate*.07;
      b.rotation.x=(i===0?.06:.015)+(i===0?walk*.22+trot*.4:walk*.03)-(i===0?F.tailUp*.6:0)+trot*.04*Math.sin(ph*2-i*.8);
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
      const rs=Math.max(S.rest,F.rest*(1-mv));
      if(L.name==="HL"&&rs>.001){chi=lerp(chi,50*DEG,rs);psi=lerp(psi,-8*DEG,rs);}
      let lift=L.lift;
      if(L.name==="FL"&&F.paw>.002){lift+=F.paw*.24;v3.z+=F.pawFwd*.24;chi=lerp(chi,.7,F.paw);psi=lerp(psi,-.3,F.paw);}
      if(!L.front&&F.kick>.002){lift+=F.kick*(L.x>0?.46:.4);v3.z-=F.kick*.5;chi=lerp(chi,1.1,F.kick);psi=lerp(psi,-.5,F.kick);}
      const c=Math.cos(chi),sn=Math.sin(chi),cp=chi>0;
      const cy=v3.y+lift+(cp?HOOF*c+.058*sn:HOOF),cz=v3.z+(cp?.058+HOOF*sn-.058*c:0)-.013;
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

  const facePoint=new T.Vector3();
  return {group,update,place,state:S,pack,furMeshes,
    faceAt(out){return out.copy(facePoint.set(0,-.03,.3)).applyMatrix4(headFrame.matrixWorld);},
    setFur(on){for(const f of furMeshes)f.visible=on;},
    setPack(on){pack.visible=halter.visible=on;},
    moods:Object.keys(MOODS).map(k=>({id:k,label:MOODS[k].label})),
    setMood(id){if(!MOODS[id])return;S.mood=id;S.moodT=0;S.autoT=0;S.idleMood=id==="calm"?12:8;if(id==="startled")S.speed=Math.min(S.speed,-.9);if(S.onMood)S.onMood(id);},
    bray(){this.setMood("bray");}};
}
window.makeDonkey=makeDonkey;
})();
