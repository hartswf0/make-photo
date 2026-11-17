(async function(){"use strict";
const T=window.THREE;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
function hash(x,z=0) {
  const a=Math.sin(x*127.1+z*311.7+8.1)*43758.5453123;
  return a-Math.floor(a);
}
function noise(x,z) {
  const i=Math.floor(x), j=Math.floor(z), u=smooth(0,1,x-i), v=smooth(0,1,z-j);
  return lerp(lerp(hash(i,j),hash(i+1,j),u),lerp(hash(i,j+1),hash(i+1,j+1),u),v);
}
const roman=["0","I","II","III","IV","V","VI","VII","VIII","IX","X"];
const stops=[
  {id:"halfdome",name:"Half Dome",region:"Yosemite · Sierra Nevada",rig:"Mistletoe",transport:"burro",
    assignment:"Granite and sky",subject:"Half Dome",tones:"Dark sky · textured granite",
    brief:"Lead Mistletoe to the upper bench. Separate Half Dome from the sky with the red glass. Keep the bright granite textured.",
    hint:"The red glass lowers the blue sky. Use exposure to place the granite, then meter the sky again. J and K record the two readings.",
    road:[[-17,22],[-9,9],[1,-5],[9,-19],[12,-36],[8,-55],[5,-65]],
    station:3, startWeather:.28, time:.46, aim:[108,329,-909], focal:250},
  {id:"tetons",name:"Snake River",region:"Grand Teton · Wyoming",rig:"Roof-deck wagon",transport:"wagon",
    assignment:"The silver bend",subject:"Snake River",tones:"Bright water · dark timber",
    brief:"Drive to the river pullout, set the brake, and climb the roof deck. Put the bright bend between the dark banks.",
    hint:"The roof deck clears the scrub. Keep the bend in the lower half of the plate. Mark the trees with J and the water with K.",
    road:[[-16,24],[-10,12],[-2,2],[5,-10],[7,-24],[4,-38],[1,-51]],
    station:5, startWeather:.33, time:.35, aim:[1,10,-222], focal:250},
  {id:"yosemite",name:"Clearing Storm",region:"Yosemite Valley · Sierra Nevada",rig:"Roof-deck wagon",transport:"wagon",
    assignment:"The storm opening",subject:"The valley",tones:"Bright cloud · textured forest",
    brief:"Take the wagon to the overlook. Wait for the storm to break over the valley and hold texture in the bright clouds.",
    hint:"Wait for a break in the clouds. Mark the trees with J and a bright cloud with K.",
    road:[[-19,25],[-12,13],[-7,0],[0,-13],[7,-28],[5,-41],[2,-55]],
    station:5, startWeather:.88, time:.24, aim:[40,67,-650], focal:250}
];
const filters=[
  {name:"Clear",rgb:[1,1,1],glass:0},
  {name:"Yellow #8",rgb:[1.02,.95,.58],glass:.5},
  {name:"Orange #21",rgb:[1.12,.87,.23],glass:1},
  {name:"Red #25",rgb:[1.34,.63,.07],glass:1.5},
  {name:"Green #58",rgb:[.48,1.13,.26],glass:1}
];
const canvas=$("world");
const context=canvas.getContext("webgl2",{alpha:false,depth:true,stencil:false,powerPreference:"high-performance",antialias:false});
if(!context||typeof DecompressionStream==="undefined")throw new Error("WebGL 2 and DecompressionStream are required");
const renderer=new T.WebGLRenderer({canvas,context,alpha:false});
renderer.outputColorSpace=T.LinearSRGBColorSpace;
renderer.toneMapping=T.NoToneMapping;
renderer.setClearColor(0x171819);
renderer.autoClear=false;
const debugGpu=context.getExtension("WEBGL_debug_renderer_info");
const software=debugGpu&&/swiftshader|llvmpipe|software rasterizer/i.test(context.getParameter(debugGpu.UNMASKED_RENDERER_WEBGL));
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(56,1,.09,2800);
camera.rotation.order="YXZ";
const screenCamera=new T.Camera();
const eyeLight=new T.DirectionalLight(0xfff0d9,2.25);
const fillLight=new T.HemisphereLight(0xd3e0ec,0x383125,1.20);
scene.add(eyeLight,eyeLight.target,fillLight);
const sunDirection=new T.Vector3(-.46,.69,.59).normalize();
const clockUniform={value:0},weatherUniform={value:.25};
const sunlightUniform={value:sunDirection},cameraPosition={value:camera.position};
const viewForward={value:new T.Vector3()},viewRight={value:new T.Vector3()},viewUp={value:new T.Vector3()};
const viewport={value:new T.Vector2(1,1)},lensScale={value:1};
const motionPreference=matchMedia("(prefers-reduced-motion: reduce)");
const motionUniform={value:motionPreference.matches?.17:1};
const reflectionCull={value:0};
const maps={};
function texture(uri,repeat=false) {
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{
      const tex=new T.Texture(image);
      tex.flipY=false;
      tex.wrapS=tex.wrapT=repeat?T.RepeatWrapping:T.ClampToEdgeWrapping;
      tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      tex.needsUpdate=true;
      resolve(tex);
    };
    image.onerror=()=>reject(new Error("A terrain texture could not be loaded"));
    image.src=uri;
  });
}
function decode(encoded) {
  const bytes=atob(encoded), out=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++)out[i]=bytes.charCodeAt(i);
  return out;
}
async function expand(encoded) {
  const input=new Blob([decode(encoded)]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Response(input).arrayBuffer();
}
const repeatMaps=new Set(["weathered-rock","gravel","stone-face","stone-rock","stone-physical"]);

async function readPack(name) {
  const partCount = {base: 6, halfdome: 4, tetons: 5, yosemite: 4}[name];
  const parts = await Promise.all(Array.from({length: partCount}, async (_, index) => {
    const url = new URL("assets/" + name + "-" + String(index).padStart(2, "0"), document.baseURI);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Unable to load " + name);
    return response.arrayBuffer();
  }));
  const stream = new Blob(parts).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Response(stream).json();
}
async function loadTextures(values) {
  await Promise.all(Object.entries(values).map(async ([name, uri]) => {
    maps[name] = await texture(uri, repeatMaps.has(name));
  }));
}
const [base, firstRegion] = await Promise.all([readPack("base"), readPack("halfdome")]);
const [cloudBytes] = await Promise.all([expand(base.cloud), loadTextures(base.maps)]);
const clouds = new T.Data3DTexture(new Uint8Array(cloudBytes), 176, 104, 136);
clouds.format = T.RedFormat;
clouds.minFilter = clouds.magFilter = T.LinearFilter;
clouds.unpackAlignment = 1;
clouds.needsUpdate = true;

const surveys = {};
const snake = {};
const loadedRegions = new Set();
let firstRegionData = firstRegion;
async function loadRegion(stop) {
  if (loadedRegions.has(stop.id)) return;
  const regional = stop.id === "halfdome" && firstRegionData ? firstRegionData : await readPack(stop.id);
  if (stop.id === "halfdome") firstRegionData = null;
  const textures = loadTextures(regional.maps);
  if (stop.id === "tetons") {
    Object.assign(snake, regional.snake);
    await Promise.all(["near","far"].map(async name => {
      snake[name].heights = new Uint16Array(await expand(snake[name].height));
      delete snake[name].height;
    }));
    snake.river.levels = new Float32Array(decode(snake.river.height).buffer);
    delete snake.river.height;
    snake.trees = new Float32Array(decode(snake.crowns).buffer);
    delete snake.crowns;
  } else {
    const {data: encoded, ...metadata} = regional.survey;
    surveys[stop.id] = {...metadata, size: [metadata.size, metadata.size], heights: new Uint16Array(await expand(encoded))};
  }
  await textures;
  loadedRegions.add(stop.id);
}

const state={
  index:0,mode:"opening",active:false,elapsed:0,weather:stops[0].startWeather,time:stops[0].time,
  x:0,z:0,yaw:0,pitch:0,driveYaw:0,drivePitch:0,road:0,speed:0,drive:false,lead:false,roof:false,walkSpeed:0,
  packs:2,sheets:4,meter:false,meterReading:null,listen:true,
  glass:0,ev:0,aperture:22,focus:80,focal:210,shift:0,tilt:0,frame:"landscape",
  plates:{},noticeUntil:0,quality:1
};
const currentStop=()=>stops[state.index];
function encodeSave() {
  return {index:state.index,plates:state.plates,listen:state.listen};
}
function save() {
  try{localStorage.setItem("field-plates.v1",JSON.stringify(encodeSave()));}catch{}
}
function restore() {
  try{
    const prev=JSON.parse(localStorage.getItem("field-plates.v1"));
    if(!prev)return;
    if(Number.isInteger(prev.index)&&stops[prev.index])state.index=prev.index;
    if(typeof prev.listen==="boolean")state.listen=prev.listen;
    for(const stop of stops) {
      const item=prev.plates?.[stop.id];
      if(item&&typeof item.preview==="string"&&item.preview.startsWith("data:image/")&&typeof item.assigned==="boolean")state.plates[stop.id]=item;
    }
  }catch{}
}
function zoneNumber(value,ev=0) {
  return clamp(Math.round(5+Math.log2(Math.max(.0001,value)/.18)+ev),0,10);
}
function lensFov(focal,portrait=false) {
  return T.MathUtils.radToDeg(2*Math.atan((portrait?254:203)/(2*focal)));
}

const fieldNoise = `
float h3(vec3 p){
  p=fract(p*vec3(.1031,.11369,.13787));p+=dot(p,p.yzx+19.19);
  return fract((p.x+p.y)*p.z);
}
float n3(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
`;
const surfaceVertex = `
precision highp float;
in vec3 position,normal;
in vec2 uv;
uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix;
out vec3 vWorld,vNormal;
out vec2 vUv;
void main(){
  vWorld=(modelMatrix*vec4(position,1.)).xyz;
  mat3 linear=mat3(modelMatrix);
  vec3 scaleSquared=vec3(dot(linear[0],linear[0]),dot(linear[1],linear[1]),dot(linear[2],linear[2]));
  vNormal=normalize(linear*(normal/scaleSquared));
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const stoneFunctions = `
uniform sampler2D uRock,uGravel,uGrain,uPhysical;
vec4 rockSample(sampler2D tex,vec3 p,vec3 n) {
  vec3 w=pow(abs(n),vec3(4.5));w/=max(.0001,dot(w,vec3(1.)));
  vec3 signN=sign(n+vec3(.0001));
  vec3 x=texture(tex,vec2(-signN.x*p.z,-p.y)).rgb;
  vec3 y=texture(tex,vec2(p.x,signN.y*p.z)).rgb;
  vec3 z=texture(tex,vec2(signN.z*p.x,-p.y)).rgb;
  vec3 dx=vec3(0.,x.y-.5,-signN.x*(x.x-.5));
  vec3 dy=vec3(y.x-.5,0.,-signN.y*(y.y-.5));
  vec3 dz=vec3(signN.z*(z.x-.5),z.y-.5,0.);
  vec3 d=2.*(dx*w.x+dy*w.y+dz*w.z);
  return vec4(d-n*dot(n,d),dot(vec3(x.z,y.z,z.z),w));
}
float specular(vec3 n,vec3 l,vec3 v,float roughness) {
  vec3 h=normalize(l+v);
  float a=roughness*roughness;float a2=a*a;
  float nh=max(dot(n,h),0.);float nv=max(dot(n,v),.035);float nl=max(dot(n,l),0.);
  float den=nh*nh*(a2-1.)+1.;
  float k=(1.+roughness)*(1.+roughness)*.125;
  float g=1./((nl*(1.-k)+k)*(nv*(1.-k)+k));
  return min(.22,(a2/(3.14159*den*den))*g*.011*nl);
}
float stoneRoughness(vec3 p,vec3 n) {
  vec3 w=pow(abs(n),vec3(5.));
  w/=max(.001,dot(w,vec3(1.)));
  return dot(w,vec3(texture(uPhysical,p.zy).b,texture(uPhysical,p.xz).b,texture(uPhysical,p.xy).b));
}
`;
const shared = {
  uTime:clockUniform,uWeather:weatherUniform,uSun:sunlightUniform,uEye:cameraPosition,
  uMotion:motionUniform,uReflectionCull:reflectionCull
};
const stones = {
  uRock:{value:maps["weathered-rock"]},uGravel:{value:maps.gravel},uGrain:{value:maps["stone-rock"]},
  uFace:{value:maps["stone-face"]},uPhysical:{value:maps["stone-physical"]}
};
function makeSurface(fragment,uniforms,options={}) {
  return new T.RawShaderMaterial({
    glslVersion:T.GLSL3,vertexShader:surfaceVertex,fragmentShader:fragment,uniforms,
    toneMapped:false,...options
  });
}

const quad=new T.BufferGeometry();
quad.setAttribute("position",new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
const passVertex=`
in vec3 position;
out vec2 uv;
void main(){uv=position.xy*.5+.5;gl_Position=vec4(position,1.);}
`;
function screenPass(source,uniforms) {
  const stage=new T.Scene();
  const mat=new T.RawShaderMaterial({glslVersion:T.GLSL3,vertexShader:passVertex,
    fragmentShader:"precision highp float;\nin vec2 uv;out vec4 pixel;\n"+source,uniforms,
    depthTest:false,depthWrite:false,toneMapped:false});
  const mesh=new T.Mesh(quad,mat);
  mesh.frustumCulled=false;
  stage.add(mesh);
  return stage;
}

function irregularStone(seed,detail=1) {
  const g=new T.IcosahedronGeometry(1,detail);
  const a=g.getAttribute("position");
  for(let i=0;i<a.count;i++) {
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
    const split=(noise(x*4.31+y*.52+seed,z*3.71-y*1.1)-.5)*.25;
    const radial=.88+.25*noise(x*2.74+y*.8,z*2.41+seed);
    const height=Math.min(.68+split,y)*(1.+split*.4)+x*.17-z*.12;
    const side=1.+.18*Math.sin(3.1*y+seed)*Math.sin(4.3*z+x*.73);
    a.setXYZ(i,x*radial*side+y*.16,height,z*(1.+split)+x*.13);
  }
  g.computeVertexNormals();
  return g;
}

const windVertex=`
vec2 wind(vec2 where,float time,float storm) {
  float drift=sin(where.x*.22+where.y*.12-time*.97);
  float roll=sin(where.x*.54-where.y*.36-time*1.78)*.31;
  float gust=sin(where.y*.31+time*.48)*.47+drift*.45+roll;
  return (vec2(.44,.18)+vec2(gust,gust*.53))*(.37+storm*1.08);
}`;
const treeVertex=`
precision highp float;
in vec3 position;
in vec2 uv;
in vec4 treeStyle;
in mat4 instanceMatrix;
uniform mat4 viewMatrix,projectionMatrix;
uniform float uTime,uWeather,uMotion;
out vec2 vUv;
out vec3 vWorld;
flat out vec4 vStyle;
`+windVertex+`
void main() {
  vec3 root=instanceMatrix[3].xyz;
  vec3 across=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0]));
  float width=instanceMatrix[0][0],height=instanceMatrix[1][1];
  float t=uTime*uMotion;
  vec2 gust=wind(root.xz,t,uWeather);
  float crown=position.y*position.y;
  vec3 p=root+across*(position.x*width+sin(t*3.9+root.z*.66+position.y*9.8)*.018*crown*height);
  p.xz+=gust*crown*.118*height*uMotion;
  p.y+=position.y*height;
  vUv=uv;vStyle=treeStyle;vWorld=p;
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const treeFragment=`
precision highp float;
in vec2 vUv;
in vec3 vWorld;
flat in vec4 vStyle;
out vec4 pixel;
uniform sampler2D uTrees;
uniform vec3 uSun,uEye;
uniform float uWeather,uReflectionCull;
void main(){
  if(uReflectionCull>.5&&vWorld.y<.005)discard;
  vec2 local=vec2(vStyle.y<0.?1.-vUv.x:vUv.x,mix(.963,.030,vUv.y));
  vec4 canopy=texture(uTrees,(local+vStyle.xz)*vec2(.25,.5));
  float distanceToEye=length(vWorld-uEye);
  float silhouette=mix(.36,.26,smoothstep(5.,22.,distanceToEye));
  if(canopy.a<silhouette)discard;
  vec3 front=normalize(vec3(uEye.x-vWorld.x,.001,uEye.z-vWorld.z));
  vec3 side=vec3(front.z,0.,-front.x);
  vec3 n=normalize(front*.67+side*(vUv.x-.5)*1.85+vec3(0.,.28+.45*vUv.y,0.));
  float light=(.44+.79*max(dot(n,uSun),0.)+.20*pow(max(dot(-front,uSun),0.),4.))*(.63+.37*vUv.y);
  vec3 pigment=pow(canopy.rgb,vec3(2.13))*(.68+vStyle.w*.59)*light;
  pigment+=vec3(.026,.030,.024)*smoothstep(.53,.89,vUv.y)*max(dot(n,uSun),0.);
  float haze=1.-exp(-distanceToEye*(.0016+uWeather*.0026));
  pixel=vec4(mix(pigment,vec3(.137,.173,.212),haze*.85),1.);
}`;

const TAU=Math.PI*2;
const roadBounds={xmin:-29,xmax:26,zmin:-75,zmax:31};
const terrainCache=new Map();
let landscape=null;
const tetonHeading=-93.926168*Math.PI/180;
const tetonScale=.112;
const tetonEast=Math.sin(tetonHeading),tetonNorth=-Math.cos(tetonHeading);
function sourceToTeton(x,z) {
  const east=x+46.34576,north=z-1.36642;
  return [(east*-tetonNorth+north*tetonEast)*tetonScale,-(east*tetonEast+north*tetonNorth)*tetonScale];
}
function terrainSample(grid,x,z) {
  const [w,h]=grid.size;
  const px=clamp(x*(w-1),0,w-1.00001),pz=clamp(z*(h-1),0,h-1.00001);
  const i=Math.floor(px),j=Math.floor(pz),a=j*w+i;
  return lerp(lerp(grid.heights[a],grid.heights[a+1],px-i),lerp(grid.heights[a+w],grid.heights[a+w+1],px-i),pz-j);
}
function tetonHeight(x,z) {
  const e=-46.34576+(-tetonNorth*x-tetonEast*z)/tetonScale;
  const n=1.36642+(tetonEast*x-tetonNorth*z)/tetonScale;
  const sample=grid=>{
    const [a,b,c,d]=grid.bounds;
    return terrainSample(grid,(e-a)/(b-a),(n+d)/(d-c))*.05-120;
  };
  const [a,b,c,d]=snake.near.bounds;
  const blend=smooth(0,145,Math.min(e-a,b-e,n+d,-c-n));
  return (lerp(sample(snake.far),sample(snake.near),blend)-156)*tetonScale;
}
const surveyTransforms={
  halfdome:{origin:[85,-297],scale:62,yScale:85,datum:-24,aerial:[-10,-24,13,2]},
  yosemite:{origin:[0,-176],scale:64,yScale:63,datum:-33,aerial:[-9.5,-22,10,2]}
};
function surveyedHeight(id,x,z) {
  if(id==="tetons")return tetonHeight(x,z);
  const grid=surveys[id],spec=surveyTransforms[id];
  const [a,b]=spec.origin, u=(x-a)/spec.scale,v=(z-b)/spec.scale;
  const q=terrainSample(grid,u/grid.span+.5,(v-grid.center)/grid.span+.5);
  return (grid.low+grid.range*q/65535)*spec.yScale+spec.datum;
}
function makeRoute(stop) {
  const points=stop.road.map(([x,z])=>new T.Vector3(x,0,z));
  const curve=new T.CatmullRomCurve3(points,false,"centripetal");
  curve.arcLengthDivisions=200;
  curve.updateArcLengths();
  const length=curve.getLength(), marks=curve.getLengths();
  function nearest(x,z) {
    let distance=Infinity,spot=0;
    for(let i=0;i<points.length-1;i++) {
      const a=points[i], b=points[i+1], dx=b.x-a.x,dz=b.z-a.z;
      const p=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
      const d=Math.hypot(x-a.x-p*dx,z-a.z-p*dz);
      if(d<distance){distance=d;spot=(i+p)/(points.length-1);}
    }
    return {distance,spot};
  }
  function at(s) {
    return curve.getPointAt(clamp(s/length,0,1));
  }
  const station=marks[Math.round(stop.station/(points.length-1)*200)];
  return {curve,length,station,at,nearest};
}
const routes=stops.map(makeRoute);
function localLand(stop,x,z) {
  const route=routes[stops.indexOf(stop)], p=route.nearest(x,z);
  const trailHeight=stop.id==="tetons"?.14-.033*Math.max(0,-z-41):
    stop.id==="halfdome"?-.15+(25-z)*.087:1.7+(25-z)*.019;
  const shoulder=smooth(1.3,10.7,p.distance);
  const ridge=(noise(x*.068-8,z*.054)*.72+noise(x*.22,z*.22)*.28);
  const ground=trailHeight+shoulder*(.5+3.9*ridge)+.31*noise(x*.33,z*.27)+.083*Math.sin(x*1.8+z*.9);
  const edge=stop.id==="tetons"?-45:stop.id==="yosemite"?-49:-56;
  const stretch=stop.id==="tetons"?24:stop.id==="yosemite"?56:65;
  const blend=smooth(0,1,Math.max((Math.abs(x)-24)/55,(edge-z)/stretch,(z-29)/32));
  const survey=surveyedHeight(stop.id,x,z);
  const surveyed=stop.id==="tetons"?survey:lerp(stop.id==="halfdome"?-14:-11,survey,
    smooth(30,208,Math.abs(x)+Math.max(0,-z-101)));
  return lerp(ground,surveyed,blend);
}
function heightAt(stop,x,z) {
  return localLand(stop,x,z);
}
function meshAt(geometry,material,parent,x=0,y=0,z=0) {
  const mesh=new T.Mesh(geometry,material);
  mesh.position.set(x,y,z);parent.add(mesh);
  return mesh;
}
const terrainStyle={
  halfdome:{snow:[172,386],sun:[-.58,.52,.62],fog:[.103,.148,.20],grade:1.12},
  yosemite:{snow:[92,310],sun:[-.61,.67,.42],fog:[.152,.186,.24],grade:1.03},
  tetons:{snow:[80,213],sun:[.55,.52,.62],fog:[.121,.161,.21],grade:.98}
};
const fieldTone=makeSurface(`
precision highp float;
in vec3 vWorld,vNormal;
in vec2 vUv;
out vec4 pixel;
uniform vec3 uSun,uEye,uAir;
uniform float uTime,uWeather,uMotion,uReflectionCull,uWaterline,uGeography;
uniform sampler2D uSurface,uCover,uRelief,uFace,uRoute,uRiver;
uniform vec4 uBounds,uFarBounds,uNearBounds,uRiverBounds;
uniform vec2 uMapOrigin,uSnow;
uniform float uScale;
`+fieldNoise+stoneFunctions+`
float inside(vec2 uv){return step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);}
vec2 extents(vec2 p,vec4 b){return (p-b.xy)*b.zw;}
void main() {
  vec3 p=vWorld;
  if(uReflectionCull>.5&&p.y<uWaterline+.035)discard;
  vec3 n=normalize(vNormal), view=normalize(uEye-p);
  float dist=length(uEye-p), slope=1.-max(0.,n.y);
  float near=1.-smoothstep(39.,220.,dist);
  float fold=n3(p*vec3(.019,.038,.024));
  float breakage=n3(p*vec3(.071,.059,.075));
  vec3 warp=p+(n3(p*.15)-.5)*mix(4.1,.41,near);
  vec4 face=rockSample(uFace,warp*mix(.036,.42,near),n);
  vec4 stone=rockSample(uRock,warp*mix(.083,.74,near),n);
  vec4 sand=rockSample(uGravel,warp*mix(.12,1.18,near),n);
  vec4 grit=rockSample(uGrain,p*mix(.29,4.7,near),n);
  float bare=smoothstep(.15,.63,slope);
  float crushed=smoothstep(.24,.68,face.w*.58+stone.w*.42);
  float brightRock=.40+.41*stone.w+.22*grit.w+.54*crushed;
  vec3 granite=vec3(.31,.303,.279)*brightRock;
  vec3 earth=vec3(.152,.134,.111)*(.43+1.01*sand.w+.14*grit.w);
  vec3 pigment=mix(earth,granite,.16+.80*bare);
  vec3 relief=vec3(0.);
  float woods=0., bank=-25., shingle=0.;
  if(uGeography<1.5) {
    vec2 mapped=extents((p.xz-uMapOrigin)/uScale,uBounds);
    float coverage=inside(mapped)*smoothstep(.0,.062,min(min(mapped.x,1.-mapped.x),min(mapped.y,1.-mapped.y)));
    vec3 aerial=pow(texture(uSurface,mapped).rgb,vec3(2.16));
    woods=texture(uCover,mapped).r*coverage*(1.-bare*.89);
    relief=(texture(uRelief,mapped).rgb-.5)*coverage;
    pigment=mix(pigment,aerial*.74+pigment*.58,coverage*(1.-bare)*.74*(1.-near*.87));
  } else {
    vec2 local=vec2(-46.34576,1.36642)+mat2(-.06846,-.99765,.99765,-.06846)*(p.xz/.112);
    vec2 uvNear=extents(local,uNearBounds), uvFar=extents(local,uFarBounds);
    vec3 detail=texture(uCover,uvNear).rgb;
    float neighborhood=inside(uvNear)*smoothstep(.0,.065,min(min(uvNear.x,1.-uvNear.x),min(uvNear.y,1.-uvNear.y)));
    float aerial=mix(texture(uSurface,uvFar).r,detail.r,neighborhood);
    woods=(1.-smoothstep(.05,.17,aerial))*(1.-smoothstep(22.,93.,p.y))*(1.-bare)*.78;
    relief=(texture(uRelief,extents(local,uBounds)).rgb-.5)*inside(extents(local,uBounds));
    vec2 waterUv=extents(local,uRiverBounds);
    bank=mix(-30.,texture(uRiver,waterUv).b*160.-32.,inside(waterUv));
    shingle=(1.-smoothstep(1.5,15.,abs(bank)))*inside(waterUv);
    pigment=mix(pigment,vec3(.15,.135,.107)*(.32+aerial*2.8),neighborhood*(1.-bare)*.62*(1.-near*.65));
  }
  vec2 routeUv=vec2((p.x+29.)/55.,(p.z+75.)/106.);
  vec3 route=texture(uRoute,routeUv).rgb*inside(routeUv);
  float track=route.r;
  woods*=1.-track;
  pigment=mix(pigment,vec3(.025,.042,.029)*(.51+.74*sand.w+.43*breakage),woods*.94);
  float litter=smoothstep(.31,.72,n3(p*vec3(.53,.35,.49))*.68+breakage*.32);
  float turf=(1.-bare)*(1.-track)*near*(.32+.45*litter);
  pigment=mix(pigment,vec3(.087,.107,.058)*(.51+.81*sand.w+.36*grit.w),turf*.83);
  float dampness=exp(-max(0.,p.y-uWaterline)*1.6)*smoothstep(-12.,1.,bank);
  pigment=mix(pigment,earth*(1.19+.29*stone.w),shingle*.83);
  pigment=mix(pigment,vec3(.195,.169,.127)*(.49+.89*sand.w+.15*grit.w)*(1.-route.g*.23),track*.93);
  float seams=smoothstep(.30,.79,fold*.46+breakage*.32+stone.w*.22+relief.r*.49-relief.b*.21);
  float drift=smoothstep(uSnow.x,uSnow.y,p.y)*seams*(1.-smoothstep(.34,.84,slope))*(1.-woods);
  pigment=mix(pigment,vec3(.73,.784,.81)*(.76+.24*grit.w),drift*.94);
  pigment*=1.-dampness*.31-uWeather*.12;
  vec3 bump=mix(face.xyz*.58+stone.xyz*.54,sand.xyz*.8,track*.78+(1.-bare)*.22);
  vec3 ridge=vec3(-relief.x,.14*relief.r,-relief.y);
  vec3 detail=normalize(n+(bump+grit.xyz*.25)*(1.-drift*.61)+ridge*.63);
  float cloud=n3(vec3(p.xz*.0101-vec2(.21,.12)*uTime*.071*uMotion,3.17));
  float daylight=mix(.35,1.49,smoothstep(.23,.73,cloud+(.36-uWeather)*.41));
  float direct=max(0.,dot(detail,uSun))*daylight;
  float ambient=(.38+.62*max(n.y,0.))*(.41+.59*smoothstep(.16,.67,stone.w));
  float rim=max(0.,dot(detail,normalize(vec3(-.43,.53,.69))))*smoothstep(.21,.73,slope);
  vec3 lit=pigment*(vec3(.26,.37,.53)*ambient+vec3(1.83,1.57,1.26)*direct+vec3(.45,.35,.25)*rim);
  lit+=vec3(.68,.77,.88)*specular(detail,uSun,view,mix(.82,.42,dampness));
  float heightFog=exp(-max(p.y+7.,0.)/66.);
  float fog=1.-exp(-dist*(.00010+.00038*uWeather+.0019*heightFog*(.22+.73*uWeather)));
  pixel=vec4(mix(lit,uAir*(.72+.38*cloud),fog*.88),1.);
}`,{}, {side:T.FrontSide});

function boundsVector([a,b,c,d]) {
  return new T.Vector4(a,-c,1/(b-a),-1/(d-c));
}
function routeTexture(index) {
  const stop=stops[index], route=routes[index];
  const {xmin,xmax,zmin,zmax}=roadBounds, w=240,h=448;
  const samples=new Uint8Array(w*h*4), roadWidth=stop.transport==="wagon"?2.43:.83;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const x=lerp(xmin,xmax,i/(w-1)),z=lerp(zmin,zmax,j/(h-1));
    const {distance,spot}=route.nearest(x,z);
    const edge=distance+(noise(x*.92,z*.74)-.5)*.59;
    const strength=(1-smooth(roadWidth*.65,roadWidth*1.20,edge))*smooth(.0,.025,spot)*(1-smooth(.955,1,spot));
    const rut=Math.abs(distance-.67);
    const index=(j*w+i)*4;
    samples[index]=Math.round(255*strength);
    samples[index+1]=stop.transport==="wagon"?Math.round((1-smooth(.057,.19,rut))*strength*255):0;
    samples[index+3]=255;
  }
  const tex=new T.DataTexture(samples,w,h);
  tex.magFilter=tex.minFilter=T.LinearFilter;tex.needsUpdate=true;
  return tex;
}
function terrainMaterial(stop,index,waterline) {
  const tetons=index===1, spec=surveyTransforms[stop.id],style=terrainStyle[stop.id];
  const a=spec?.aerial??[0,0,1,1];
  const mat=fieldTone.clone();
  mat.uniforms={...shared,...stones,uFace:{value:maps["stone-face"]},
    uAir:{value:new T.Vector3(...style.fog)},uSnow:{value:new T.Vector2(...style.snow)},
    uWaterline:{value:waterline},uGeography:{value:tetons?2:index},
    uSurface:{value:maps[tetons?"far-teton":"ground-"+stop.id]},
    uCover:{value:maps[tetons?"near-teton":"cover-"+stop.id]},
    uRelief:{value:maps[tetons?"teton-mountain-relief":"relief-"+stop.id]},
    uRoute:{value:routeTexture(index)},uRiver:{value:maps["teton-flow"]},
    uMapOrigin:{value:new T.Vector2(...(spec?.origin??[0,0]))},uScale:{value:spec?.scale??1},
    uBounds:{value:tetons?boundsVector(snake.mountainRelief):new T.Vector4(a[0],a[1],1/(a[2]-a[0]),1/(a[3]-a[1]))},
    uFarBounds:{value:boundsVector(snake.far?.bounds ?? [0, 1, 0, 1])},uNearBounds:{value:boundsVector(snake.near?.bounds ?? [0, 1, 0, 1])},
    uRiverBounds:{value:boundsVector(snake.river?.bounds ?? [0, 1, 0, 1])}
  };
  return mat;
}
function nestedAxis(min,max,low,high,steps,outerSteps) {
  const points=[];
  for(let i=0;i<outerSteps;i++)points.push(lerp(min,low,1-(1-i/outerSteps)**2.38));
  for(let i=0;i<=steps;i++)points.push(lerp(low,high,i/steps));
  for(let i=1;i<=outerSteps;i++)points.push(lerp(high,max,(i/outerSteps)**2.38));
  return points;
}
function landscapeMesh(stop,material,group) {
  const x=nestedAxis(-1580,1580,-30,32,92,83);
  const z=nestedAxis(-2590,240,-77,30,118,104);
  const positions=new Float32Array(x.length*z.length*3), indices=[];
  for(let j=0;j<z.length;j++)for(let i=0;i<x.length;i++){
    const a=j*x.length+i,k=a*3;
    positions[k]=x[i];positions[k+1]=heightAt(stop,x[i],z[j]);positions[k+2]=z[j];
    if(j<z.length-1&&i<x.length-1)indices.push(a,a+x.length,a+1,a+1,a+x.length,a+x.length+1);
  }
  const g=new T.BufferGeometry();
  g.setAttribute("position",new T.BufferAttribute(positions,3));
  g.setAttribute("uv",new T.BufferAttribute(new Float32Array(x.length*z.length*2),2));
  g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
  meshAt(g,material,group);
}

const waterReflection={value:null}, waterMatrix={value:new T.Matrix4()};
const waterValidity={value:0};
const waterMaterial=makeSurface(`
precision highp float;
in vec3 vWorld,vNormal;
in vec2 vUv;
out vec4 pixel;
uniform vec3 uSun,uEye,uAir;
uniform float uTime,uWeather,uMotion,uReflectionReady;
uniform sampler2D uFlow,uBar,uReflection;
uniform mat4 uMirror;
`+fieldNoise+stoneFunctions+`
vec2 wave(vec2 p,vec2 direction,float size,float offset,float amplitude){
  float angle=dot(p,direction)*size+offset;
  return direction*cos(angle)*amplitude*(1.-smoothstep(.5,2.9,fwidth(angle)));
}
void main(){
  vec3 p=vWorld;
  vec3 flow=texture(uFlow,vUv).rgb;
  float toBank=flow.b*160.-32.;
  if(toBank<-.18)discard;
  float depth=clamp(max(.014,toBank*.011),.014,1.61);
  vec2 current=normalize(vec2(-.06846,-.99765)*(.001+flow.r*2.-1.)+vec2(-.99765,.06846)*(flow.g*2.-1.));
  vec2 across=vec2(-current.y,current.x);
  float t=uTime*uMotion;
  vec2 q=vec2(dot(p.xz,current),dot(p.xz,across));
  float drift=n3(vec3(q*.175-vec2(t*.19,0.),3.5));
  float twist=n3(vec3(q*vec2(.72,.59)-vec2(t*.44,0.),7.9));
  vec2 slopes=wave(p.xz,normalize(current+across*.23),4.7,-t*1.95+6.2*drift,.044);
  slopes+=wave(p.xz,normalize(current*.57-across*.92),10.9,-t*2.74+7.6*twist,.037);
  slopes+=wave(p.xz,normalize(current*.64+across*.86),22.8,-t*4.9+5.9*drift+twist*4.9,.039);
  slopes+=wave(p.xz,normalize(current*.77-across*.65),37.4,-t*6.7+7.8*twist,.027);
  slopes*=.59+uWeather*.69;
  vec3 n=normalize(vec3(-slopes.x,1.,-slopes.y));
  vec3 view=normalize(uEye-p);
  vec3 reflected=reflect(-view,n);
  vec3 transmitted=refract(-view,n,1./1.333);
  float fresnel=.024+.976*pow(1.-max(0.,dot(n,view)),5.);
  vec4 clip=uMirror*vec4(p,1.);
  vec2 uv=clip.xy/max(.01,clip.w)*.5+.5+slopes*.16;
  float valid=smoothstep(0.,.098,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)))*uReflectionReady;
  vec3 mirror=texture(uReflection,clamp(uv,.003,.997)).rgb;
  float opening=smoothstep(.28,.74,n3(vec3(reflected.xz*6.9-t*.019,reflected.y*13.4)));
  vec3 sky=mix(vec3(.123,.201,.299),vec3(.80,.85,.90),opening);
  mirror=mix(sky,mirror,valid*.95);
  float path=depth/max(.30,-transmitted.y);
  vec2 foot=p.xz+transmitted.xz*min(path,.58);
  float grains=rockSample(uGravel,vec3(foot.x*1.73,.08,foot.y*1.73),vec3(0,1,0)).w;
  float shingle=smoothstep(.13,.78,grains);
  float bar=texture(uBar,vUv).r;
  vec3 bed=mix(vec3(.035,.038,.031),vec3(.29,.241,.17),shingle)*(.69+.49*bar);
  vec3 absorption=exp(-path*vec3(4.82,3.11,1.73));
  vec3 water=vec3(.024,.066,.087);
  vec3 under=bed*absorption+water*(1.-absorption);
  float fraction=clamp(fresnel*(.62+.37*smoothstep(.025,.53,depth)),.055,.96);
  vec3 col=mix(under,mirror,fraction);
  float gleam=pow(max(0.,dot(reflected,uSun)),85.)*.57+specular(n,uSun,view,.2)*.5;
  float pearl=pow(max(0.,dot(reflected,normalize(vec3(-.21,.32,-.92)))),14.)*(.36+.24*twist);
  float shear=n3(vec3(q.x*3.3-t*1.2,q.y*19.0+drift*4.,4.1));
  float shore=(1.-smoothstep(.038,.24,depth))*smoothstep(.57,.81,shear);
  col+=vec3(.79,.86,.91)*(gleam+pearl+shore*.22+smoothstep(.52,.83,twist)*smoothstep(.62,.83,shear)*.093);
  float dist=length(uEye-p);
  float air=1.-exp(-dist*(.0012+uWeather*.00137));
  pixel=vec4(mix(col,uAir,air*.45),1.);
}`,{});
function waterFor(stop,group) {
  if(stop.id!=="tetons")return {mesh:null,level:-18};
  const level=(65.9-156)*tetonScale;
  const {bounds:[a,b,c,d],grid:[w,h],levels}=snake.river;
  const geo=new T.PlaneGeometry(1,1,w-1,h-1);geo.rotateX(-Math.PI/2);
  const v=geo.attributes.position,uv=geo.attributes.uv;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const [x,z]=sourceToTeton(lerp(a,b,i/(w-1)),lerp(-d,-c,j/(h-1)));
    const k=j*w+i;
    v.setXYZ(k,x,(levels[k]-156)*tetonScale+.044,z);
    uv.setXY(k,i/(w-1),j/(h-1));
  }
  geo.computeVertexNormals();geo.computeBoundingSphere();
  const mat=waterMaterial.clone();
  mat.uniforms={...shared,...stones,uAir:{value:new T.Vector3(...terrainStyle[stop.id].fog)},
    uFlow:{value:maps["teton-flow"]},uBar:{value:maps["teton-gravel"]},uMirror:waterMatrix,
    uReflection:waterReflection,uReflectionReady:waterValidity};
  return {mesh:meshAt(geo,mat,group),level};
}

function forestGeometry(points,group) {
  const g=new T.PlaneGeometry(.89,1,1,4);g.translate(0,.5,0);
  const variants=new T.InstancedBufferAttribute(new Float32Array(points.length*4),4);
  g.setAttribute("treeStyle",variants);
  const mat=makeSurface(treeFragment,{...shared,uTrees:{value:maps["tree-atlas"]}},
    {vertexShader:treeVertex,side:T.DoubleSide});
  const mesh=new T.InstancedMesh(g,mat,points.length);
  const m=new T.Matrix4();
  points.forEach(([x,y,z,h,s],i)=>{
    m.makeScale(h*(.76+.43*hash(s,84)),h,1);m.setPosition(x,y-.08,z);
    mesh.setMatrixAt(i,m);
    variants.setXYZW(i,Math.min(3,Math.floor(hash(s,31)*4)),hash(s,97)<.5?-1:1,hash(s,87)>.84?1:0,hash(s,53));
  });
  mesh.computeBoundingSphere();group.add(mesh);
}
function treesFor(index,group) {
  const stop=stops[index], route=routes[index], points=[];
  for(let i=0;i<380;i++){
    const z=lerp(-160,36,hash(i,index+39)), x=(hash(i,index+81)-.5)*147;
    const distance=route.nearest(x,z).distance, y=heightAt(stop,x,z);
    if(distance<(index===0?3.4:6.5)||noise(x*.092,z*.062)<.31||y<-7||y>115)continue;
    if(index===1&&z<-33&&Math.abs(x)<10)continue;
    const h=1.8+10*hash(i,53)**1.78;
    points.push([x,y,z,h,i]);
  }
  if(index===1){
    for(let i=0;i<snake.trees.length;i+=10){
      const [x0,y0,z0,h,coverage]=snake.trees.subarray(i,i+5);
      const [x,z]=sourceToTeton(x0,z0);
      if(z> -74||Math.abs(x)>440||coverage<.25)continue;
      const y=heightAt(stop,x,z);
      if(Math.abs(y-(y0-156)*tetonScale)>5.2)continue;
      points.push([x,y,z,clamp(h*.177,1,4.8),i+2000]);
    }
  } else {
    for(let i=0;i<2620;i++){
      const z=lerp(-100,-795,hash(i,72)**1.36), x=(hash(i,89)-.5)*1280;
      const y=heightAt(stop,x,z);
      const slope=Math.abs(heightAt(stop,x+2.7,z+2.7)-y);
      if(slope>3.4||y>202||y<-19||noise(x*.023,z*.019)<.37)continue;
      points.push([x,y,z,3.5+16*hash(i,92)**1.5,i+420]);
    }
  }
  forestGeometry(points,group);
}
const needles=makeSurface(`
precision highp float;
in vec3 vWorld,vNormal;
in vec2 vUv;
out vec4 pixel;
uniform vec3 uSun,uEye;
uniform sampler2D uNeedles;
void main(){
  vec4 bark=texture(uNeedles,vec2(vUv.x,1.-vUv.y));
  if(bark.a<.36)discard;
  vec3 n=gl_FrontFacing?normalize(vNormal):-normalize(vNormal);
  vec3 tone=pow(bark.rgb,vec3(2.08))*(.50+.97*max(0.,dot(n,uSun)));
  pixel=vec4(tone,1.);
}`,{...shared,uNeedles:{value:maps.needles}},{side:T.DoubleSide});
const firBark=new T.MeshStandardMaterial({color:0x493727,roughness:.94});
const sprigGeo=new T.PlaneGeometry(1.91,.94,1,1);
function trailFirs(index,group) {
  const stop=stops[index],route=routes[index],branches=[];
  const placements=index===0?[[17,4.7],[41,-4.9],[65,4.4]]:
    index===1?[[12,-5.7],[42,6.5],[51,-6.8]]:[[19,6.5],[41,-5.9],[64,7.6]];
  for(const [travel,side] of placements) {
    const root=route.at(travel),forward=route.at(travel+1).sub(root).normalize();
    const x=root.x-forward.z*side,z=root.z+forward.x*side;
    const fir=new T.Group();
    fir.position.set(x,heightAt(stop,x,z)-.045,z);
    group.add(fir);
    const height=3.9+hash(travel,17)*2.2;
    const trunk=meshAt(new T.CylinderGeometry(.044,.126,height,9,1),firBark,fir,0,height*.50,0);
    trunk.rotation.z=.041;
    for(let i=0;i<34;i++){
      const angle=i*2.39996,layer=i/34,rad=1.58*(1-layer)**.84+.087;
      const y=height*(.15+layer*.865),x=Math.cos(angle),z=Math.sin(angle);
      const a=meshAt(sprigGeo,needles,fir,x*rad*.69,y,z*rad*.69);
      a.rotation.set(-1.29+(hash(i,83)-.5)*.41,-angle,.28*Math.sin(i));
      a.scale.set(rad,rad,rad);
      const twig=new T.CylinderGeometry(.009,.023,rad*.90,6,1);
      const branch=meshAt(twig,firBark,fir,x*rad*.42,y-.042,z*rad*.42);
      branch.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(x,.18,z).normalize());
      branches.push([a,a.rotation.x,i+travel]);
    }
  }
  return branches;
}

const rocks=makeSurface(`
precision highp float;
in vec3 vWorld,vNormal;
in vec2 vUv;
out vec4 pixel;
uniform vec3 uSun,uEye;
uniform float uWeather;
`+stoneFunctions+`
void main(){
  vec3 n=normalize(vNormal),p=vWorld;
  vec4 rock=rockSample(uRock,p*.91,n),grain=rockSample(uGrain,p*4.9,n);
  n=normalize(n+rock.xyz*.69+grain.xyz*.25);
  vec3 pigment=vec3(.298,.28,.244)*(.44+.58*rock.w+.37*grain.w);
  vec3 light=vec3(.22,.30,.44)*(.61+.39*n.y)+vec3(1.69,1.49,1.25)*max(0.,dot(n,uSun));
  vec3 col=pigment*light*(1.-.23*uWeather);
  float fog=1.-exp(-length(uEye-p)*.0030);
  pixel=vec4(mix(col,vec3(.13,.16,.19),fog*.79),1.);
}`,{...shared,...stones});
const meadowMaterial=makeSurface(`
precision highp float;
in vec2 vUv;
in vec3 vWorld;
flat in float vPatch;
out vec4 pixel;
uniform vec3 uSun,uEye;
uniform float uWeather;
void main(){
  float shadow=.26+.45*smoothstep(0.,1.,vUv.y);
  vec3 grass=mix(vec3(.057,.067,.031),vec3(.171,.162,.087),vPatch)*shadow;
  grass*=.61+.57*uSun.y+.32*max(0.,uSun.x);
  float air=(1.-exp(-length(vWorld-uEye)*.0014))*uWeather;
  pixel=vec4(mix(grass,vec3(.134,.156,.19),air),1.);
}`,{...shared},{
  side:T.DoubleSide,
  vertexShader:`
precision highp float;
in vec3 position;
in vec2 uv;
in mat4 instanceMatrix;
uniform mat4 viewMatrix,projectionMatrix;
uniform float uTime,uWeather,uMotion;
out vec2 vUv;
out vec3 vWorld;
flat out float vPatch;
`+windVertex+`
void main(){
  vec3 root=instanceMatrix[3].xyz;
  vec3 p=(instanceMatrix*vec4(position,1.)).xyz;
  p.xz+=wind(root.xz,uTime*uMotion,uWeather)*position.y*position.y*.17*length(instanceMatrix[1].xyz)*uMotion;
  vPatch=fract(sin(root.x*.731+root.z*11.19)*9118.1);
  vUv=uv;vWorld=p;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`
});
function meadow(index,group) {
  const stop=stops[index],route=routes[index],verts=[],uv=[];
  for(let i=0;i<8;i++){
    const a=hash(i,18)*TAU,s=(.021+.019*hash(i,25)),h=.35+.60*hash(i,44);
    const x=(hash(i,31)-.5)*.37,z=(hash(i,78)-.5)*.36;
    const dx=Math.cos(a)*s,dz=Math.sin(a)*s;
    const bend=.14+.17*hash(i,99);
    verts.push(x-dx,0,z-dz,x+dx,0,z+dz,x+dx*.53+dz*bend,h*.61,z+dz*.53-dx*bend,
      x-dx,0,z-dz,x+dx*.53+dz*bend,h*.61,z+dz*.53-dx*bend,x+dz*8.1*bend,h,z-dx*8.1*bend);
    uv.push(0,0,1,0,1,.61,0,0,1,.61,.5,1);
  }
  const geom=new T.BufferGeometry();
  geom.setAttribute("position",new T.Float32BufferAttribute(verts,3));geom.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  geom.computeBoundingSphere();
  const cap=index===0?2320:3410, mesh=new T.InstancedMesh(geom,meadowMaterial,cap);
  const m=new T.Matrix4(), scale=new T.Vector3();
  let planted=0;
  for(let i=0;i<cap*3&&planted<cap;i++){
    const z=lerp(index===1?-68:-85,31,hash(i,index+118)),x=(hash(i,index+49)-.49)*75;
    if(route.nearest(x,z).distance<(index===0?1.18:2.95))continue;
    if(noise(x*.48,z*.38)*.62+noise(x*.089,z*.092)*.38<.345)continue;
    const y=heightAt(stop,x,z);
    if(y<-6.9)continue;
    let height=.17+.52*hash(i,57)**1.72;
    if(index===0)height*=.68;
    if(index===1&&z< -31&&z> -44&&x>0&&x<9)height*=1.41;
    m.makeRotationY(hash(i,49)*TAU).scale(scale.setScalar(height));
    m.setPosition(x,y-.024,z);
    mesh.setMatrixAt(planted++,m);
  }
  mesh.count=planted;mesh.computeBoundingSphere();group.add(mesh);
  if(index===1){
    const corner=route.at(route.station+5.5);
    const scrub=[];
    for(let i=0;i<9;i++){
      const x=corner.x+lerp(-5.4,3.7,i/8),z=corner.z-1.8-hash(i,99)*3.1;
      if(Math.abs(x-corner.x)<.86)continue;
      scrub.push([x,heightAt(stop,x,z),z,1.05+1.34*hash(i,38),i+3991]);
    }
    forestGeometry(scrub,group);
  }
}
function scenery(index,group) {
  const stop=stops[index],route=routes[index], forms=Array.from({length:7},(_,i)=>irregularStone(i,2));
  for(let i=0;i<176;i++){
    const z=lerp(-127,30,hash(i,76)), x=(hash(i,index+57)-.5)*86;
    const d=route.nearest(x,z).distance, y=heightAt(stop,x,z);
    if(d<(stop.transport==="wagon"?2.3:1.24)||y<-7)continue;
    if(index===1&&z< -42&&z> -76&&Math.abs(x-3)<11)continue;
    if(index===2&&z<-39&&z> -66&&Math.abs(x)<8)continue;
    const rock=meshAt(forms[i%forms.length],rocks,group,x,y-.10,z);
    const s=.13+2.5*hash(i,index+132)**3.4;
    rock.scale.set(s*(.96+.47*hash(i,55)),s*.63,s);
    rock.rotation.set((hash(i,72)-.5)*.19,hash(i,26)*TAU,(hash(i,17)-.5)*.28);
  }
  const guide=route.at(route.station),ahead=route.at(route.station+2).sub(guide).normalize();
  const position=guide.clone().add(new T.Vector3(-ahead.z,0,ahead.x).multiplyScalar(index===0?2.12:3.52));
  const y=heightAt(stop,position.x,position.z);
  for(let i=0;i<5;i++){
    const stone=meshAt(forms[i],rocks,group,position.x+i*.017,y+.12+i*.15,position.z+.019*i);
    stone.scale.set(.54-i*.085,.23-i*.024,.40-i*.063);
    stone.rotation.y=i*.54;
  }
  if(index===1){
    for(let i=0;i<91;i++){
      const x=lerp(-25,23,hash(i,224)),z=lerp(-67,-50,hash(i,72));
      if(route.nearest(x,z).distance<2.25||Math.abs(x-2)<10)continue;
      const h=heightAt(stop,x,z);
      const rock=meshAt(forms[i%7],rocks,group,x,h-.08,z);
      const s=.15+.57*hash(i,255)**2;
      rock.scale.set(s*1.25,s*.56,s);
    }
  }
}
function valleyFall(group) {
  const v=surveys.yosemite.waterfall,spec=surveyTransforms.yosemite;
  if(!v)return;
  const x=spec.origin[0]+v[0]*spec.scale,z=spec.origin[1]+v[1]*spec.scale;
  const foot=heightAt(stops[2],x,z+37);
  const ridge=heightAt(stops[2],x,z-9);
  const drop=clamp(ridge-foot,29,132);
  const waterfall=makeSurface(`
    precision highp float;
    in vec3 vWorld,vNormal;in vec2 vUv;out vec4 pixel;
    uniform float uTime,uMotion;
    `+fieldNoise+`
    void main(){
      float weave=n3(vec3(vUv.x*13.,vUv.y*56.+uTime*4.2*uMotion,8.7));
      float strands=smoothstep(.16,.59,weave)*sin(3.14159*vUv.x);
      float mist=exp(-vUv.y*11.)*.29;
      pixel=vec4(vec3(.68,.76,.83)*(.63+.35*weave),strands*.73+mist);
    }`,shared,{side:T.DoubleSide,transparent:true,depthWrite:false});
  const fall=meshAt(new T.PlaneGeometry(4.1,drop,4,24),waterfall,group,x,foot+drop*.53,z+13);
  fall.rotation.set(-.09,-.27,.026);
}
function openLandscape(index) {
  if(landscape)scene.remove(landscape.group);
  if(!terrainCache.has(index)){
    const stop=stops[index],group=new T.Group();
    const water=waterFor(stop,group);
    const material=terrainMaterial(stop,index,water.level);
    landscapeMesh(stop,material,group);
    treesFor(index,group);
    scenery(index,group);
    meadow(index,group);
    const branches=trailFirs(index,group);
    if(index===2)valleyFall(group);
    terrainCache.set(index,{group,water,route:routes[index],stop,branches});
  }
  landscape=terrainCache.get(index);
  waterValidity.value=0;
  scene.add(landscape.group);
}

const finishFragment=`
precision highp float;
in vec3 vWorld,vNormal;
in vec2 vUv;
out vec4 pixel;
uniform vec3 uSun,uEye,uPigment;
uniform float uKind,uWeather;
`+fieldNoise+`
void main() {
  vec3 p=vWorld, n=normalize(vNormal),v=normalize(uEye-p);
  float view=max(0.,dot(n,v)), up=.5+.5*n.y;
  float day=max(0.,dot(n,uSun));
  float glint=pow(max(0.,dot(n,normalize(uSun+v))),mix(18.,89.,uKind==3.?1.:0.));
  vec3 r=reflect(-v,n);
  float env=smoothstep(-.21,.42,r.y);
  float grain=n3(p*34.1);
  float fiber=n3(p*vec3(93.,7.1,19.));
  float streak=n3(vec3(vUv.x*39.,vUv.y*3.1,1.9));
  vec3 albedo=uPigment;
  if(uKind==1.)albedo*=.67+.23*grain+.26*fiber;
  if(uKind==2.)albedo*=.54+.71*streak+.22*grain;
  if(uKind==4.)albedo*=.77+.37*grain;
  vec3 color=albedo*(vec3(.26,.34,.46)*(.46+.54*up)+vec3(1.46,1.31,1.11)*day);
  if(uKind==0.)color+=vec3(.48,.58,.70)*(glint*.36+pow(1.-view,3.)*env*.16);
  if(uKind==3.)color=mix(vec3(.045,.053,.056),vec3(.83,.86,.92),env*.92)+glint*.31;
  if(uKind==5.)color=mix(vec3(.015,.020,.027),vec3(.123,.167,.23),env*.86)*(.65+.35*pow(1.-view,1.4))+glint*.14;
  if(uKind==6.)color=albedo;
  pixel=vec4(color,1.);
}`;
function surface(rgb,kind=0) {
  return makeSurface(finishFragment,{...shared,uPigment:{value:new T.Vector3(...rgb)},uKind:{value:kind}});
}
const nickel=surface([.48,.48,.46],3),rubber=surface([.030,.029,.026],4),sidewall=surface([.041,.040,.034],4);
const ash=surface([.45,.34,.217],2),walnut=surface([.231,.113,.055],2),deckWood=surface([.29,.230,.153],2);
const coach=surface([.52,.56,.57]),charcoal=surface([.048,.05,.047],4),safetyGlass=surface([.1,.11,.13],5);
const canvasKhaki=surface([.355,.281,.189],4),canvasShade=surface([.212,.179,.127],4);
const strap=surface([.087,.053,.033],4),ropeMat=surface([.355,.29,.19],4);
const hide=surface([.154,.144,.119],1),mane=surface([.065,.054,.039],1),muzzle=surface([.262,.257,.218],1);
const innerEar=surface([.215,.139,.108],1),eyeBlack=surface([.023,.018,.014]),eyeDot=surface([.20,.19,.164],6);
const amber=surface([.78,.65,.41],6),redLens=surface([.64,.145,.067],6);
const filmGlass=surface([.11,.23,.21],5),blackPaint=surface([.038,.039,.036],4);
const darkTailgate=surface([.195,.126,.077],2);
const woodBox=new T.BoxGeometry(1,1,1);
const ball=new T.SphereGeometry(1,20,14);
function billet(group,mat,x,y,z,w,h,l) {
  const m=meshAt(woodBox,mat,group,x,y,z);
  m.scale.set(w,h,l);
  return m;
}
function oval(group,mat,x,y,z,w,h,l) {
  const m=meshAt(ball,mat,group,x,y,z);
  m.scale.set(w,h,l);
  return m;
}
function spar(group,mat,a,b,r1,r2=r1,sides=9) {
  const p=new T.Vector3(...a),q=new T.Vector3(...b),offset=q.clone().sub(p);
  const tube=meshAt(new T.CylinderGeometry(r2,r1,offset.length(),sides,1),mat,group);
  tube.position.copy(p).lerp(q,.5);
  tube.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),offset.normalize());
  return tube;
}
function pipe(group,mat,pts,radius,segments=23) {
  const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));
  return meshAt(new T.TubeGeometry(curve,segments,radius,7,false),mat,group);
}
function loft(group,mat,profiles,sides=34,segments=28,flat=1) {
  const spine=new T.CatmullRomCurve3(profiles.map(([z,y,xRadius,yRadius])=>new T.Vector3(xRadius,yRadius,z)));
  const levels=new T.CatmullRomCurve3(profiles.map(([z,y])=>new T.Vector3(0,y,z)));
  const p=[],uv=[],tri=[];
  for(let j=0;j<=segments;j++){
    const t=j/segments,point=spine.getPoint(t),y=levels.getPoint(t).y;
    for(let i=0;i<=sides;i++){
      const theta=i/sides*TAU;
      const contour=v=>Math.sign(v)*Math.abs(v)**flat;
      p.push(contour(Math.cos(theta))*Math.max(.001,point.x),y+contour(Math.sin(theta))*Math.max(.001,point.y),point.z);
      uv.push(i/sides,t);
      if(j<segments&&i<sides){
        const a=j*(sides+1)+i;
        if(profiles[0][0]<profiles.at(-1)[0])tri.push(a,a+1,a+sides+1,a+1,a+sides+2,a+sides+1);
        else tri.push(a,a+sides+1,a+1,a+1,a+sides+1,a+sides+2);
      }
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  g.setIndex(tri);g.computeVertexNormals();
  return meshAt(g,mat,group);
}
function roundedCase(group,mat,x,y,z,w,h,l,r=.06) {
  const shape=new T.Shape();
  const a=w*.5-r,b=h*.5-r;
  shape.moveTo(-a,-b-r);shape.lineTo(a,-b-r);shape.quadraticCurveTo(a+r,-b-r,a+r,-b);
  shape.lineTo(a+r,b);shape.quadraticCurveTo(a+r,b+r,a,b+r);shape.lineTo(-a,b+r);
  shape.quadraticCurveTo(-a-r,b+r,-a-r,b);shape.lineTo(-a-r,-b);shape.quadraticCurveTo(-a-r,-b-r,-a,-b-r);
  const geom=new T.ExtrudeGeometry(shape,{depth:l,bevelEnabled:false,curveSegments:5});
  geom.translate(0,0,-l*.5);
  return meshAt(geom,mat,group,x,y,z);
}
function panelSide(group,mat,side,shapePoints,thickness) {
  const shape=new T.Shape();
  shapePoints.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,curveSegments:4});
  g.rotateY(-Math.PI*.5);
  g.translate(thickness*.5,0,0);
  return meshAt(g,mat,group,side,0,0);
}
const shadowMaterial=makeSurface(`
precision highp float;
in vec3 vWorld,vNormal;
in vec2 vUv;
out vec4 pixel;
void main(){
  vec2 q=(vUv-.5)*2.;
  float alpha=exp(-dot(q,q)*3.8)*(1.-smoothstep(.65,1.,length(q)));
  pixel=vec4(.019,.021,.023,alpha*.51);
}`,{}, {transparent:true,depthWrite:false});
function contactShadow(width,length) {
  const g=new T.PlaneGeometry(width,length);g.rotateX(-Math.PI*.5);
  return meshAt(g,shadowMaterial,scene);
}
function wheel(group,x,y,z,front) {
  const mount=new T.Group();mount.position.set(x,y,z);group.add(mount);
  const spin=new T.Group();mount.add(spin);
  const tire=meshAt(new T.TorusGeometry(.30,.091,14,36),rubber,spin);
  tire.rotation.y=Math.PI*.5;tire.scale.z=1.22;
  const direction=Math.sign(x);
  for(const offset of [-.047,.047]){
    const bead=meshAt(new T.TorusGeometry(.303,.051,12,34),sidewall,spin,offset,0,0);
    bead.rotation.y=Math.PI*.5;
  }
  const hub=meshAt(new T.CylinderGeometry(.218,.218,.145,28),charcoal,spin);
  hub.rotation.z=Math.PI*.5;
  oval(spin,nickel,direction*.097,0,0,.038,.145,.145);
  oval(spin,coach,direction*.124,0,0,.019,.084,.084);
  const ring=meshAt(new T.TorusGeometry(.183,.011,6,28),nickel,spin,direction*.077,0,0);
  ring.rotation.y=Math.PI*.5;
  for(let i=0;i<27;i++){
    const angle=i/27*TAU;
    const tread=billet(spin,rubber,0,.387*Math.cos(angle),.387*Math.sin(angle),.176,.014,.022);
    tread.rotation.x=angle;
  }
  return {mount,spin,front};
}
function buildWagon() {
  const group=new T.Group();scene.add(group);
  const body=new T.Group();group.add(body);
  loft(body,coach,[[-2.61,.72,.08,.07],[-2.5,.77,.72,.24],[-2.1,.83,.93,.38],[-1.47,.87,.98,.43],
    [-.9,.88,.99,.45],[.1,.89,.97,.43],[1.1,.88,.96,.40],[1.99,.81,.94,.36],[2.44,.78,.75,.30],[2.59,.76,.016,.029]],44,40,.55);
  loft(body,coach,[[-2.6,.91,.045,.026],[-2.46,1.04,.43,.22],[-2.14,1.14,.58,.215],[-1.65,1.22,.62,.214],
    [-1.15,1.25,.68,.23],[-.79,1.24,.69,.21]],32,25,.68);
  const roof=[[-1.26,1.35,.72,.048],[-1.04,1.65,.76,.17],[-.77,1.75,.83,.32],[-.38,1.78,.85,.34],[.52,1.80,.86,.34],
    [1.43,1.77,.85,.32],[2.04,1.73,.78,.27],[2.33,1.59,.70,.15],[2.48,1.29,.67,.044]];
  loft(body,charcoal,roof,32,36,.63);
  for(const sign of [-1,1]) {
    const x=sign*.90;
    const lower=[[-1.03,.59],[-1.18,1.28],[-.66,1.41],[1.97,1.41],[2.35,1.10],[2.36,.66]];
    panelSide(body,walnut,x+sign*.031,lower,.037);
    for(const y of [.70,.91,1.13,1.365]){
      const strip=billet(body,ash,x+sign*.018,y,.51,.068,.052,3.28);
      strip.rotation.x=-.016;
    }
    const windows=[[-1.03,1.38],[-.64,1.91],[1.87,1.90],[2.15,1.75],[2.35,1.41]];
    panelSide(body,safetyGlass,x-sign*.072,windows,.035);
    pipe(body,ash,windows.concat([windows[0]]).map(([z,y])=>[x-sign*.051,y,z]),.030,24);
    for(const z of [-.96,.02,1.08,2.14]){
      const y=z===-.96?1.43:1.57;
      const brace=billet(body,ash,x+sign*.010,y,z,.070,z===-.96?.80:1.16,.050);
      brace.rotation.x=z===-.96?-.25:z===2.14?.30:.007;
    }
    for(const z of [-.52,.52]) {
      const handle=billet(body,nickel,x+sign*.089,1.23,z,.034,.038,.165);
      handle.rotation.x=-.075;
    }
    const frontFender=loft(body,coach,[[-2.58,.68,.019,.035],[-2.40,.75,.211,.224],[-2.06,.78,.276,.32],[-1.66,.77,.285,.30],
      [-1.27,.72,.237,.24],[-.94,.63,.14,.18],[-.57,.57,.03,.054]],24,22,.83);
    frontFender.position.x=sign*.73;
    const rearFender=loft(body,coach,[[.55,.57,.013,.028],[.87,.64,.155,.156],[1.27,.73,.271,.274],[1.66,.76,.295,.312],
      [2.12,.71,.254,.237],[2.48,.63,.139,.14],[2.58,.59,.016,.025]],24,20,.75);
    rearFender.position.x=sign*.735;
    for(const h of [.52,.58,.64]) {
      billet(body,nickel,sign*1.00,h,-1.74,.029,.022,1.32);
      billet(body,nickel,sign*1.01,h,1.71,.028,.021,1.46);
    }
    oval(body,nickel,sign*.66,.88,-2.36,.185,.187,.18);
    oval(body,amber,sign*.66,.88,-2.48,.129,.131,.073);
    oval(body,redLens,sign*.79,.65,2.482,.051,.083,.046);
    oval(body,nickel,sign*1.01,1.43,-.95,.082,.063,.032);
  }
  roundedCase(body,darkTailgate,0,1.049,2.426,1.61,.600,.135,.145);
  for(const y of [.84,1.024,1.205])billet(body,ash,0,y,2.502,1.43,.044,.052);
  for(const x of [-.735,.735])billet(body,ash,x,1.062,2.50,.050,.44,.064);
  billet(body,nickel,0,1.248,2.512,.218,.049,.038);
  for(const sign of [-1,1]){
    const windscreen=billet(body,safetyGlass,sign*.382,1.615,-.946,.743,.405,.033);
    windscreen.rotation.x=.59;
    const rear=billet(body,safetyGlass,sign*.376,1.60,2.22,.696,.344,.04);
    rear.rotation.x=-.44;
  }
  billet(body,ash,0,1.62,2.224,.067,.42,.088).rotation.x=-.44;
  billet(body,nickel,0,1.59,-1.000,.038,.49,.05).rotation.x=.59;
  for(let i=0;i<5;i++){
    const z=-2.35+i*.173;
    for(let k=-2;k<=2;k++)billet(body,nickel,k*.072,1.35+i*.025,z,.016,.015,.167);
    billet(body,nickel,0,.60+i*.062,-2.567+i*.008,.99-i*.031,.035,.050);
  }
  billet(body,nickel,0,.467,-2.59,1.77,.121,.17);
  billet(body,nickel,0,.446,2.535,1.85,.123,.19);
  for(const s of [-1,1]) {
    billet(body,nickel,s*.58,.495,-2.658,.105,.245,.17);
    billet(body,deckWood,s*.95,2.37,.44,.090,.118,3.65);
    for(const z of [-1.06,.20,1.65]) {
      billet(body,nickel,s*.944,1.885,z,.035,.84,.062);
      billet(body,deckWood,s*.93,2.36,z,.091,.367,.065);
    }
    spar(body,charcoal,[s*.946,2.49,-1.39],[s*.946,2.49,2.29],.021);
  }
  for(let i=0;i<12;i++)billet(body,i%3?deckWood:ash,(i-5.5)*.153,2.265,.43,.145,.065,3.69);
  for(const x of [-.87,-.40])spar(body,charcoal,[x,.37,2.62],[x,2.29,2.10],.031,.028);
  for(let i=0;i<7;i++) {
    const f=(i+.38)/7;
    spar(body,nickel,[-.87,lerp(.37,2.29,f),lerp(2.62,2.10,f)],[-.40,lerp(.37,2.29,f),lerp(2.62,2.10,f)],.023);
  }
  const luggage=roundedCase(body,canvasShade,.59,2.39,1.81,.50,.184,.58,.052);
  luggage.rotation.y=-.16;
  const wheels=[wheel(group,-.862,.394,-1.71,true),wheel(group,.862,.394,-1.71,true),
    wheel(group,-.882,.394,1.61,false),wheel(group,.882,.394,1.61,false)];
  return {group,body,wheels,shadow:contactShadow(2.96,6.25)};
}

function makeBurro() {
  const group=new T.Group();scene.add(group);
  const body=new T.Group();group.add(body);
  loft(body,hide,[[-.63,1.14,.047,.067],[-.53,1.13,.211,.25],[-.34,1.09,.281,.301],[-.11,1.045,.321,.314],
    [.20,1.075,.304,.309],[.49,1.10,.269,.285],[.66,1.12,.170,.197],[.75,1.135,.024,.036]],31,30,1);
  const neck=new T.Group();neck.position.set(0,1.27,-.42);body.add(neck);
  loft(neck,hide,[[-.39,.322,.096,.126],[-.31,.257,.119,.21],[-.20,.176,.148,.303],[-.055,.034,.188,.364],[.116,-.091,.143,.221]],28,24,.95);
  for(let i=0;i<11;i++) {
    const tuft=oval(neck,mane,(hash(i,8)-.5)*.036,.02+i*.037,-.008-i*.020,.063-i*.0019,.119,.044);
    tuft.rotation.x=-.61;tuft.rotation.z=(hash(i,81)-.5)*.29;
  }
  const head=new T.Group();head.position.set(0,.34,-.319);neck.add(head);
  loft(head,hide,[[-.465,-.169,.067,.055],[-.408,-.161,.108,.081],[-.309,-.119,.109,.104],
    [-.184,-.068,.131,.129],[-.065,-.018,.148,.164],[.067,.019,.107,.142],[.123,.008,.022,.056]],30,24,.93);
  oval(head,muzzle,0,-.180,-.407,.102,.075,.078).rotation.x=.16;
  const ears=[];
  for(const s of [-1,1]){
    const socket=oval(head,hide,s*.116,.021,-.138,.025,.043,.059);
    socket.rotation.z=s*.22;
    oval(head,eyeBlack,s*.135,.020,-.144,.010,.021,.028);
    oval(head,eyeDot,s*.143,.025,-.155,.004,.004,.005);
    oval(head,eyeBlack,s*.076,-.170,-.456,.023,.012,.012);
    const ear=new T.Group();ear.position.set(s*.087,.109,-.015);head.add(ear);
    const base=oval(ear,hide,0,.179,0,.055,.223,.036);base.rotation.x=-.17;
    const inner=oval(ear,innerEar,0,.199,-.028,.030,.154,.016);inner.rotation.x=-.17;
    ears.push({ear,sign:s});
    pipe(head,strap,[[s*.109,-.165,-.374],[s*.121,-.123,-.237],[s*.153,-.069,-.115],[s*.132,.116,.027]],.013,15);
    const ring=meshAt(new T.TorusGeometry(.027,.006,5,16),nickel,head,s*.125,-.122,-.326);
    ring.rotation.y=Math.PI*.5;
  }
  pipe(head,strap,[[-.108,-.148,-.389],[-.061,-.113,-.422],[.006,-.105,-.436],[.068,-.116,-.421],[.108,-.146,-.388]],.013,14);
  const legs=[];
  for(const side of [-1,1])for(const front of [true,false]){
    const limb=new T.Group();limb.position.set(side*(front?.169:.195),front?.99:1.015,front?-.405:.491);body.add(limb);
    const upper=oval(limb,hide,0,-.123,front?.006:-.006,front?.084:.116,.232,front?.089:.135);
    upper.rotation.x=front?.052:-.18;
    const shin=new T.Group();shin.position.set(0,-.388,front?.021:-.081);limb.add(shin);
    oval(limb,hide,0,-.32,front?.019:-.045,.060,.133,.060);
    spar(shin,hide,[0,.053,0],[0,-.42,.039],.060,.038,12);
    oval(shin,hide,0,-.413,.049,.046,.075,.048);
    spar(shin,muzzle,[0,-.394,.041],[0,-.530,.014],.040,.042);
    const hoof=meshAt(new T.CylinderGeometry(.043,.063,.114,16,1),charcoal,shin,0,-.546,.008);
    hoof.rotation.x=-.105;hoof.scale.z=1.25;
    legs.push({limb,shin,phase:(front===(side>0)?0:Math.PI)});
  }
  const tail=new T.Group();tail.position.set(0,1.244,.659);body.add(tail);
  pipe(tail,hide,[[0,0,0],[.016,-.14,.118],[.022,-.335,.139],[.045,-.48,.133]],.035,23);
  oval(tail,mane,.045,-.46,.128,.069,.109,.064).rotation.z=.32;
  const cargo=new T.Group();body.add(cargo);
  oval(cargo,canvasShade,0,1.355,.078,.382,.077,.467);
  spar(cargo,ash,[-.343,1.405,-.304],[.343,1.405,-.304],.032);
  spar(cargo,ash,[-.343,1.405,.326],[.343,1.405,.326],.032);
  for(const side of [-1,1]){
    const bags=new T.Group();bags.position.set(side*.339,1.151,.017);bags.rotation.z=side*.13;
    cargo.add(bags);
    roundedCase(bags,canvasKhaki,0,0,.014,.238,.482,.66,.053);
    roundedCase(bags,canvasShade,0,.233,-.01,.246,.127,.638,.049).rotation.x=-.09;
    for(const z of [-.184,.203]){
      billet(bags,strap,side*.123,-.019,z,.015,.446,.041);
      billet(bags,nickel,side*.137,.081,z,.013,.059,.047);
    }
  }
  const bed=oval(cargo,canvasShade,.038,1.48,.143,.344,.101,.322);
  bed.rotation.y=.19;
  for(const s of [-1,1])pipe(cargo,ropeMat,[[s*.392,1.073,-.214],[s*.31,1.43,-.260],[0,1.57,.099],[-s*.29,1.42,.335],[-s*.381,1.079,.308]],.014,23);
  const load=new T.Group();cargo.add(load);
  roundedCase(load,walnut,-.023,1.543,-.154,.55,.162,.42,.025);
  billet(load,nickel,0,1.543,-.368,.089,.055,.029);
  spar(load,deckWood,[-.352,1.548,.27],[.35,1.548,.25],.023,.024);
  return {group,body,neck,head,ears,legs,tail,cargo,load,shadow:contactShadow(1.48,2.86),walk:0};
}
function buildCamera() {
  const group=new T.Group();scene.add(group);
  const stand=new T.Group();group.add(stand);
  const cameraHead=new T.Group();cameraHead.position.y=1.32;stand.add(cameraHead);
  for(let i=0;i<3;i++){
    const a=(i+.13)/3*TAU;
    const top=[Math.cos(a)*.078,1.297,Math.sin(a)*.078],bottom=[Math.cos(a)*.53,.045,Math.sin(a)*.53];
    spar(stand,walnut,top,bottom,.027,.036);
    spar(stand,ash,[top[0]*1.31,top[1]-.04,top[2]*1.31],[bottom[0]*.77,.33,bottom[2]*.77],.017,.023);
    spar(stand,nickel,[bottom[0]*.87,.20,bottom[2]*.87],bottom,.017,.017);
  }
  oval(stand,nickel,0,1.265,0,.123,.049,.128);
  billet(cameraHead,walnut,0,.009,-.013,.305,.051,.512);
  const bellows=new T.Group();cameraHead.add(bellows);
  for(let i=0;i<14;i++){
    const w=lerp(.308,.151,i/13),h=lerp(.252,.158,i/13);
    billet(bellows,i%2?blackPaint:charcoal,0,.151,-i*.032,w+(i%2?.009:.0),h,.033);
  }
  roundedCase(cameraHead,walnut,0,.15,.039,.352,.293,.056,.016);
  roundedCase(cameraHead,filmGlass,0,.15,.073,.267,.214,.014,.003);
  roundedCase(cameraHead,ash,0,.15,-.447,.219,.230,.042,.012);
  const mount=spar(cameraHead,nickel,[0,.15,-.469],[0,.15,-.516],.083,.076,25);
  mount.name="lens mount";
  spar(cameraHead,charcoal,[0,.15,-.509],[0,.15,-.566],.061,.059,28);
  spar(cameraHead,filmGlass,[0,.15,-.562],[0,.15,-.573],.044,.043,26);
  for(const side of [-1,1]) {
    billet(cameraHead,nickel,side*.153,.052,.048,.040,.043,.063);
    billet(cameraHead,nickel,side*.11,.28,-.447,.028,.028,.056);
  }
  group.visible=false;
  return {group,stand,head:cameraHead,bellows};
}
const wagon=buildWagon(),burro=makeBurro(),tripod=buildCamera();
/* Mistletoe is the shared pack donkey from ../donkey/donkey.js when that script is present; the old burro stays as its ground anchor. */
const mist=window.makeDonkey?window.makeDonkey({assetPath:"../donkey/",shells:8}):null;
if(mist){scene.add(mist.group);burro.body.visible=false;mist.state.tethered=true;}
const lineGeometry=new T.BufferGeometry();
const linePosition=new T.BufferAttribute(new Float32Array(17*3),3);
lineGeometry.setAttribute("position",linePosition);
const leadRope=new T.Line(lineGeometry,new T.LineBasicMaterial({color:0x8c826c,transparent:true,opacity:.83}));
leadRope.frustumCulled=false;scene.add(leadRope);
const rigActors=[wagon.group,wagon.shadow,burro.group,burro.shadow,tripod.group,leadRope];
const anchor=new T.Vector3();
let burroFacing=0, wagonFacing=0;
function directionOfRoute(distance) {
  const route=landscape.route;
  return route.at(Math.min(route.length,distance+.65)).sub(route.at(Math.max(0,distance-.65))).normalize();
}
function rigSpot() {
  const group=currentStop().transport==="burro"?burro.group:wagon.group;
  return group.position;
}
function aimBetween(from,to) {
  return Math.atan2(from.x-to.x,from.z-to.z);
}
function seatOnGround(rig,stop,x,z,vertical=0) {
  const y=heightAt(stop,x,z);
  rig.group.position.set(x,y+vertical,z);
  rig.shadow.position.set(x,y+.058,z);
}
function resetRigs() {
  const stop=currentStop(),route=landscape.route, p=route.at(0), dir=directionOfRoute(0);
  wagonFacing=Math.atan2(-dir.x,-dir.z);
  seatOnGround(wagon,stop,p.x-dir.z*1.54,p.z+dir.x*1.54);
  burroFacing=.76+wagonFacing;
  seatOnGround(burro,stop,p.x-dir.z*3.04-dir.x*.37,p.z+dir.x*3.04-dir.z*.37);
  wagon.group.rotation.y=wagonFacing;burro.group.rotation.y=burroFacing;
  wagon.body.rotation.set(0,0,0);burro.walk=0;if(mist)mist.seated=false;
  burro.load.visible=burro.cargo.visible=true;
  rigActors.forEach(object=>{object.visible=false;});
  wagon.group.visible=wagon.shadow.visible=stop.transport==="wagon";
  burro.group.visible=burro.shadow.visible=stop.transport==="burro";if(mist)mist.group.visible=stop.transport==="burro";
}
function updateRigs(dt) {
  const stop=currentStop();
  if(stop.transport==="wagon") {
    const dir=directionOfRoute(state.road);
    const p=landscape.route.at(state.road);
    const bend=state.lane||0;
    p.x-=dir.z*bend;p.z+=dir.x*bend;
    seatOnGround(wagon,stop,p.x,p.z);
    wagonFacing=Math.atan2(-dir.x,-dir.z);
    wagon.group.rotation.y=wagonFacing;
    wagon.shadow.rotation.z=0;
    wagon.body.rotation.set(.012*Math.sin(state.road*3.7)*Math.min(1,Math.abs(state.speed)/4)*motionUniform.value,
      0,-.016*state.speed/10*(.76+Math.sin(state.road*.73)));
    for(const wheel of wagon.wheels) {
      wheel.spin.rotation.x=state.road/.387;
      wheel.mount.rotation.y=wheel.front?-.11*bend:0;
    }
  } else {
    const p=burro.group.position;
    if(mist){
      const M=mist.state,ground=(x,z)=>heightAt(stop,x,z);
      if(!mist.seated||Math.hypot(M.x-p.x,M.z-p.z)>8){mist.place(p.x,p.z,burroFacing+Math.PI,ground);mist.seated=true;}
      let goal=null;
      if(state.lead&&state.mode==="field"){
        anchor.set(state.x+Math.cos(state.yaw)*.64+Math.sin(state.yaw)*1.48,0,state.z-Math.sin(state.yaw)*.64+Math.cos(state.yaw)*1.48);
        if(Math.hypot(anchor.x-M.x,anchor.z-M.z)>.6)goal={x:anchor.x,z:anchor.z};
      }
      M.goal=goal;M.goalWhy="Following.";
      mist.update(dt,{throttle:0,steer:0},ground);
      seatOnGround(burro,stop,M.x,M.z);burroFacing=M.heading+Math.PI;burro.group.rotation.y=burroFacing;
      if(mist.packs!==state.packs){mist.packs=state.packs;
        mist.setCargo(state.packs===2?[{kg:14,slot:"L"},{kg:14,slot:"R"},{kg:10,slot:"T"}]:state.packs===1?[{kg:12,slot:"L"},{kg:12,slot:"R"}]:[]);}
    } else {
      let stride=0;
      if(state.lead&&state.mode==="field"){
        anchor.set(state.x+Math.cos(state.yaw)*.64+Math.sin(state.yaw)*1.48,0,state.z-Math.sin(state.yaw)*.64+Math.cos(state.yaw)*1.48);
        const dx=anchor.x-p.x,dz=anchor.z-p.z,len=Math.hypot(dx,dz);
        if(len>.17){
          stride=Math.min((state.packs===2?2.30:2.73)*dt,len);
          p.x+=dx/len*stride;p.z+=dz/len*stride;
          const goal=Math.atan2(-dx,-dz);
          const turn=Math.atan2(Math.sin(goal-burroFacing),Math.cos(goal-burroFacing));
          burroFacing+=turn*Math.min(1,dt*7.8);
        }
      }
      burro.walk+=stride*5.2;
      seatOnGround(burro,stop,p.x,p.z);
      burro.group.rotation.y=burroFacing;
      const sway=Math.min(1,stride/Math.max(.00001,dt*1.17));
      const gait=burro.walk;
      burro.body.position.y=(.028*Math.cos(gait*2)*sway+.011*Math.sin(state.elapsed*2.3))*motionUniform.value;
      for(const leg of burro.legs) {
        const swing=Math.sin(gait+leg.phase);
        leg.limb.rotation.x=sway*swing*.51;
        leg.shin.rotation.x=sway*Math.max(0,Math.cos(gait+leg.phase))*.71;
      }
      burro.neck.rotation.x=(.078*sway*Math.sin(gait)+(!state.lead?.07+.14*Math.sin(state.elapsed*.6):-.08))*motionUniform.value;
      burro.head.rotation.y=(.13*Math.sin(state.elapsed*.77)+.08*sway*Math.sin(gait*.51))*motionUniform.value;
      burro.tail.rotation.z=.29*Math.sin(state.elapsed*2.1)*motionUniform.value;
      for(const {ear,sign} of burro.ears){
        ear.rotation.z=sign*(-.20-.18*Math.sin(state.elapsed*1.91+sign*1.75)*motionUniform.value);
        ear.rotation.x=.15+.24*Math.sin(state.elapsed*.66+sign)*motionUniform.value;
      }
      burro.load.visible=state.packs===2;
      burro.cargo.visible=state.packs>0;
    }
  }
  leadRope.visible=state.mode==="field"&&state.lead;
  if(leadRope.visible){
    burro.head.updateWorldMatrix(true,false);
    const muzzlePoint=mist?mist.faceAt(new T.Vector3()):burro.head.localToWorld(new T.Vector3(.09,-.151,-.40));
    const h=heightAt(stop,state.x,state.z);
    const hand=new T.Vector3(state.x+Math.cos(state.yaw)*.35-Math.sin(state.yaw)*.14,h+.98,state.z-Math.sin(state.yaw)*.35-Math.cos(state.yaw)*.14);
    for(let i=0;i<linePosition.count;i++){
      const t=i/(linePosition.count-1);
      linePosition.setXYZ(i,lerp(muzzlePoint.x,hand.x,t),lerp(muzzlePoint.y,hand.y,t)-Math.sin(Math.PI*t)*.19,lerp(muzzlePoint.z,hand.z,t));
    }
    linePosition.needsUpdate=true;
  }
}

const skyPass=screenPass(fieldNoise+`
precision highp sampler3D;
uniform sampler3D uCloud;
uniform vec3 uSun,uForward,uRight,uUp;
uniform vec2 uSize,uOffset;
uniform float uTime,uWeather,uFov,uMotion,uHour,uStop;
uniform int uSteps;
float vapor(vec3 p){
  float d=texture(uCloud,clamp(p,vec3(0.),vec3(1.))).r;
  float margin=smoothstep(.0,.14,p.x)*(1.-smoothstep(.86,1.,p.x))*smoothstep(.0,.12,p.z);
  float deck=.65+.84*uWeather;
  return d*margin*deck;
}
void main(){
  vec2 f=(uv*2.-1.)+uOffset;
  vec3 r=normalize(uForward+uFov*(f.x*uSize.x/uSize.y*uRight+f.y*uUp));
  float y=r.y;
  vec3 blue=mix(vec3(.10,.22,.58),vec3(.014,.067,.32),smoothstep(-.09,.56,y));
  vec3 overcast=vec3(.30,.40,.53)*(.72+.28*n3(vec3(r.x*9.,r.y*17.,r.z*11.)));
  vec3 col=mix(blue,overcast,smoothstep(.55,.96,uWeather)*.81);
  float sunDisk=max(0.,dot(r,uSun));
  col+=vec3(.40,.31,.20)*pow(sunDisk,31.)*(1.-.50*uWeather);
  vec3 moon=normalize(vec3(-.162,.476,-.94));
  float disk=length(r-moon);
  if(uStop<.5&&disk<.0128){
    float mottling=n3(vec3((r.xz-moon.xz)*238.,5.1));
    col=mix(col,vec3(1.77,1.76,1.70)*(.68+.32*mottling),1.-smoothstep(.0098,.0127,disk));
  }
  if(y>-.105){
    float ahead=max(.24,-r.z+.34);
    vec3 start=vec3(.50+r.x/ahead*.38-uTime*.0019*uMotion+(uHour-.35)*.35,
      -.019+y*1.02+(uStop-1.)*.042,.92);
    vec3 stepVec=vec3(r.x*.29,.41+y*.65,-.82)/float(uSteps);
    vec3 toward=normalize(vec3(uSun.x,.52,-uSun.z));
    float trans=1.;
    vec3 light=vec3(0.);
    for(int i=0;i<32;i++){
      if(i>=uSteps)break;
      vec3 p=start+stepVec*(float(i)+.46);
      float d=vapor(p);
      if(d>.0015){
        float shade=vapor(p+toward*.024)*.9+vapor(p+toward*.061)*1.1+vapor(p+toward*.133)*1.2;
        float shell=exp(-shade*(3.51+uWeather*2.8));
        vec3 lit=vec3(.16,.205,.25)*(1.-.37*uWeather)+vec3(1.15,1.10,1.02)*shell*(.78+.22*uHour);
        float a=1.-exp(-d*(76.+uWeather*35.)/float(uSteps));
        light+=lit*a*trans;trans*=1.-a;
        if(trans<.015)break;
      }
    }
    col=mix(col,col*trans+light,smoothstep(-.105,.044,y));
  }
  float drift=n3(vec3(r.x*7.1-uTime*.012*uMotion,y*14.6,r.z*4.6));
  col=mix(col,vec3(.33,.38,.45),exp(-abs(y-.018)*18.)*drift*(.17+.40*uWeather));
  pixel=vec4(col,1.);
}`,{...shared,uCloud:{value:clouds},uForward:viewForward,uRight:viewRight,uUp:viewUp,uSize:viewport,uFov:lensScale,
  uOffset:{value:new T.Vector2()},uHour:{value:.42},uStop:{value:0},uSteps:{value:23}});
const skyUniform=skyPass.children[0].material.uniforms;
const halfFloat=Boolean(context.getExtension("EXT_color_buffer_float"));
function makeTarget(type=T.UnsignedByteType,depth=false) {
  const t=new T.WebGLRenderTarget(1,1,{type,depthBuffer:depth,generateMipmaps:false,
    minFilter:T.LinearFilter,magFilter:T.LinearFilter,
    depthTexture:depth?new T.DepthTexture(1,1,T.UnsignedIntType):null});
  if(t.depthTexture)t.depthTexture.minFilter=t.depthTexture.magFilter=T.NearestFilter;
  return t;
}
const sceneTarget=makeTarget(halfFloat?T.HalfFloatType:T.UnsignedByteType,true);
const skyTarget=makeTarget(sceneTarget.texture.type);
const reflected=makeTarget(sceneTarget.texture.type,true);
const plateTarget=makeTarget(T.UnsignedByteType);
const spotTarget=makeTarget(T.UnsignedByteType);
waterReflection.value=reflected.texture;
const displaySky=screenPass(`
uniform sampler2D uSky;
void main(){pixel=vec4(texture(uSky,uv).rgb,1.);}
`,{uSky:{value:skyTarget.texture}});
const spectrum={value:new T.Vector3(1,1,1)};
const gradeUniform={value:1};
const exposure={value:0},focusUniform={value:80},apertureUniform={value:22},tiltUniform={value:0};
const useOptics={value:0}, reverseUniform={value:0};
const printPass=screenPass(`
uniform sampler2D uFrame;
uniform highp sampler2D uDepth;
uniform vec3 uSpectrum;
uniform vec2 uSize;
uniform float uExposure,uFocus,uAperture,uTilt,uUseOptics,uReverse,uGrade;
float hash2(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
float filtered(vec3 color){return max(.0001,dot(color*uSpectrum,vec3(.2126,.7152,.0722)));}
void main(){
  vec2 at=uReverse>.5?1.-uv:uv;
  vec3 rgb=texture(uFrame,at).rgb;
  if(uUseOptics>.5){
    float d=texture(uDepth,at).r;
    float z=.09*2800./max(.09,2800.-d*(2800.-.09));
    float focalDepth=max(1.,uFocus*exp2((at.y-.5)*uTilt*.128));
    float disparity=abs(1./max(.1,z)-1./focalDepth);
    float blur=min(9.,disparity*(24./uAperture)*48.);
    if(blur>.73){
      vec3 total=rgb*.36;float count=.36;
      for(int i=0;i<7;i++){
        float a=float(i)*2.39996323;
        vec2 tap=at+vec2(cos(a),sin(a))*sqrt((.5+float(i))/7.)*blur/uSize;
        float diff=abs(texture(uDepth,tap).r-d);
        float w=.107*mix(.48,1.,1.-smoothstep(.002,.04,diff));
        total+=texture(uFrame,tap).rgb*w;count+=w;
      }
      rgb=total/count;
    }
  }
  float luminance=filtered(rgb)*exp2(uExposure)*uGrade;
  float film=luminance*(1.+.148*luminance)/(1.+luminance);
  float silver=pow(max(0.,film-.007),.523)*1.10;
  float value=clamp((silver-.24)*1.10+.24,0.,1.);
  float grain=(hash2(gl_FragCoord.xy)-hash2(gl_FragCoord.yx+vec2(101.,77.)))*.017;
  value=clamp(value+grain*(.24+.76*sin(value*3.14159)),0.,1.);
  pixel=vec4(value*vec3(1.,.996,.986),1.);
}`,{uFrame:{value:sceneTarget.texture},uDepth:{value:sceneTarget.depthTexture},uSpectrum:spectrum,uSize:viewport,
  uGrade:gradeUniform,uExposure:exposure,uFocus:focusUniform,uAperture:apertureUniform,uTilt:tiltUniform,
  uUseOptics:useOptics,uReverse:reverseUniform});
const meterPass=screenPass(`
uniform sampler2D uFrame;
uniform vec3 uSpectrum;
uniform vec2 uStep;
void main(){
  float y=0.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++) {
    vec3 c=texture(uFrame,.5+vec2(float(i),float(j))*uStep).rgb;
    y+=dot(c*uSpectrum,vec3(.2126,.7152,.0722))/9.;
  }
  float encoded=clamp((log2(max(.0001,y)/.18)+10.)/20.,0.,1.);
  pixel=vec4(encoded,0.,0.,1.);
}`,{uFrame:{value:sceneTarget.texture},uSpectrum:spectrum,uStep:{value:new T.Vector2(.004,.006)}});
const mirrorCamera=camera.clone(), tempForward=new T.Vector3(),tempUp=new T.Vector3();
const lastMirrorEye=new T.Vector3(Infinity,0,0);
let lastReflection=-Infinity, displayWidth=0, displayHeight=0, lastFov=0, lastAspect=0;
function cameraBasis(view) {
  view.updateMatrixWorld();
  viewRight.value.setFromMatrixColumn(view.matrixWorld,0);
  viewUp.value.setFromMatrixColumn(view.matrixWorld,1);
  viewForward.value.setFromMatrixColumn(view.matrixWorld,2).negate();
}
function syncLight() {
  const base=terrainStyle[currentStop().id].sun;
  sunDirection.set(base[0]+(state.time-.45)*.98,base[1]+(.55-state.time)*.61,base[2]).normalize();
  eyeLight.position.copy(sunDirection).multiplyScalar(95);
  eyeLight.intensity=lerp(2.40,1.10,state.weather);
  clockUniform.value=state.elapsed;
  weatherUniform.value=state.weather;
  skyUniform.uHour.value=state.time;
  skyUniform.uStop.value=state.index;
  for(const [branch,rest,phase] of landscape.branches){
    branch.rotation.x=rest+Math.sin(state.elapsed*1.77+phase*.16)*(.023+.071*state.weather)*motionUniform.value;
  }
}
function renderSky(view) {
  cameraBasis(view);
  skyUniform.uOffset.value.set(view.projectionMatrix.elements[8],view.projectionMatrix.elements[9]);
  renderer.setRenderTarget(skyTarget);renderer.clear(true,false,false);
  renderer.render(skyPass,screenCamera);
}
function drawLayer(view,target) {
  renderSky(view);
  renderer.setRenderTarget(target);renderer.clear(true,true,false);
  renderer.render(displaySky,screenCamera);renderer.render(scene,view);
}
function renderReflection(w,h,force) {
  const {mesh,level}=landscape.water;
  if(!mesh||state.mode==="opening")return;
  const moved=lastMirrorEye.distanceToSquared(camera.position)>1.2||lastAspect!==camera.aspect||lastFov!==camera.fov;
  const delay=software?1.75:.54;
  if(waterValidity.value&& !force && state.elapsed-lastReflection<(moved?delay*.43:delay))return;
  lastReflection=state.elapsed;lastMirrorEye.copy(camera.position);lastAspect=camera.aspect;lastFov=camera.fov;
  mirrorCamera.copy(camera);
  mirrorCamera.position.y=2*level-camera.position.y;
  camera.getWorldDirection(tempForward);
  tempForward.y*=-1;
  tempUp.setFromMatrixColumn(camera.matrixWorld,1);
  mirrorCamera.up.set(-tempUp.x,tempUp.y,-tempUp.z);
  mirrorCamera.lookAt(tempForward.add(mirrorCamera.position));
  mirrorCamera.updateMatrixWorld();
  waterMatrix.value.multiplyMatrices(mirrorCamera.projectionMatrix,mirrorCamera.matrixWorldInverse);
  reflected.setSize(Math.max(120,Math.round(w*.37)),Math.max(90,Math.round(h*.37)));
  mesh.visible=false;
  reflectionCull.value=1;
  try{drawLayer(mirrorCamera,reflected);}
  finally{reflectionCull.value=0;mesh.visible=true;}
  waterValidity.value=1;
}
function renderWorld(w,h,{target=null,photographic=state.mode==="camera",force=false,negative=false}={}) {
  const crop=state.frame==="portrait"?4/5:5/4;
  const viewAspect=photographic?crop:w/h;
  const fov=photographic?lensFov(state.focal,state.frame==="portrait"):56;
  const shift=photographic?state.shift:0;
  camera.aspect=viewAspect;camera.fov=fov;camera.filmOffset=0;
  camera.clearViewOffset();
  if(shift!==0)camera.setViewOffset(viewAspect*1000,1000,0,shift*1000,viewAspect*1000,1000);
  camera.updateProjectionMatrix();
  lensScale.value=Math.tan(fov*Math.PI/360);
  viewport.value.set(w,h);
  sceneTarget.setSize(w,h);
  const skyScale=negative?.73:software?.48:.58;
  skyTarget.setSize(Math.max(100,Math.round(w*skyScale)),Math.max(74,Math.round(h*skyScale)));
  skyUniform.uSteps.value=negative?30:software?17:24;
  syncLight();
  camera.updateMatrixWorld();
  const vis=rigActors.map(r=>r.visible);
  if(photographic)rigActors.forEach(r=>{r.visible=false;});
  try {
    renderReflection(w,h,force);
    drawLayer(camera,sceneTarget);
  } finally {rigActors.forEach((r,i)=>{r.visible=vis[i];});}
  spectrum.value.fromArray(photographic?filters[state.glass].rgb:filters[0].rgb);
  gradeUniform.value=terrainStyle[currentStop().id].grade;
  exposure.value=photographic?state.ev:0;
  focusUniform.value=state.focus;apertureUniform.value=state.aperture;tiltUniform.value=state.tilt;
  useOptics.value=photographic?1:0;
  reverseUniform.value=!negative&&photographic&&state.invert?1:0;
  renderer.setRenderTarget(target);
  renderer.render(printPass,screenCamera);
}
function resizeView() {
  const framing=state.mode==="camera";
  const ratio=state.frame==="portrait"?.8:1.25;
  const w=innerWidth,h=innerHeight;
  const displayW=framing?Math.min(w*(w<700?.95:.73),h*(h<600?.68:.80)*ratio):w;
  const displayH=framing?displayW/ratio:h;
  const limit=software?940:1540;
  const mult=Math.min(devicePixelRatio||1,limit*state.quality/Math.max(displayW,displayH),1.37);
  const px=Math.max(2,Math.round(displayW*mult)),py=Math.max(2,Math.round(displayH*mult));
  if(px!==displayWidth||py!==displayHeight){
    renderer.setSize(px,py,false);
    displayWidth=px;displayHeight=py;
  }
  if(framing){
    canvas.style.width=displayW+"px";
    canvas.style.height=displayH+"px";
  } else {
    canvas.style.removeProperty("width");canvas.style.removeProperty("height");
  }
}
const spotBytes=new Uint8Array(4);
function readLight() {
  renderer.setRenderTarget(spotTarget);renderer.render(meterPass,screenCamera);
  renderer.readRenderTargetPixels(spotTarget,0,0,1,1,spotBytes);
  renderer.setRenderTarget(null);
  return .18*2**(spotBytes[0]/255*20-10);
}
function readZone(lum) {return zoneNumber(lum,state.ev);}
function makeNegative() {
  const limit=software?896:1200;
  const width=state.frame==="portrait"?Math.floor(limit*.8):limit,height=state.frame==="portrait"?limit:Math.floor(limit*.8);
  plateTarget.setSize(width,height);
  renderWorld(width,height,{target:plateTarget,photographic:true,force:true,negative:true});
  const data=new Uint8Array(width*height*4);
  renderer.readRenderTargetPixels(plateTarget,0,0,width,height,data);
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d",{willReadFrequently:true});
  const img=context.createImageData(width,height), row=width*4;
  for(let y=0;y<height;y++)img.data.set(data.subarray((height-y-1)*row,(height-y)*row),y*row);
  context.putImageData(img,0,0);
  renderer.setRenderTarget(null);
  waterValidity.value=0;
  return {canvas,context,original:img,width,height};
}

const sound=(()=>{
  let audio,master,wind,current,motor,windFilter,riverFilter,motorGain,noiseBuffer;
  function filtered(type,freq) {
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
    source.buffer=noiseBuffer;source.loop=true;filter.type=type;filter.frequency.value=freq;gain.gain.value=0;
    source.connect(filter).connect(gain).connect(master);source.start();
    return [gain,filter];
  }
  function start() {
    if(!audio) {
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return;
      audio=new Audio();master=audio.createGain();master.gain.value=0;master.connect(audio.destination);
      noiseBuffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate);
      const sample=noiseBuffer.getChannelData(0);
      let v=0;
      for(let i=0;i<sample.length;i++) {
        const n=Math.random()*2-1;v=.949*v+.051*n;sample[i]=n*.39+v*.74;
      }
      [wind,windFilter]=filtered("bandpass",480);
      [current,riverFilter]=filtered("lowpass",2100);
      motor=audio.createOscillator();motor.type="triangle";motor.frequency.value=35;
      motorGain=audio.createGain();motorGain.gain.value=0;motor.connect(motorGain).connect(master);motor.start();
    }
    if(audio.state==="suspended")audio.resume().catch(()=>{});
    master.gain.setTargetAtTime(state.listen?.53:0,audio.currentTime,.06);
  }
  function run(){
    if(!audio)return;
    const t=audio.currentTime;
    const gust=.46+.37*state.weather+.15*Math.sin(state.elapsed*.74+state.x*.20);
    const moving=state.drive?Math.abs(state.speed):0;
    const air=state.mode==="darkroom"?.18:1;
    master.gain.setTargetAtTime(state.listen?.52:0,t,.04);
    wind.gain.setTargetAtTime(.17*gust*air+moving*.002,t,.3);
    windFilter.frequency.setTargetAtTime(290+210*gust,t,.32);
    current.gain.setTargetAtTime(state.index===1?.11*air*clamp((-state.z-10)/42,.07,1):state.index===2?.032*air:0,t,.4);
    riverFilter.frequency.setTargetAtTime(920+870*gust,t,.28);
    motorGain.gain.setTargetAtTime(state.drive?(.028+moving*.0035):0,t,.11);
    motor.frequency.setTargetAtTime(30+moving*5.3,t,.17);
  }
  function click(kind){
    if(!audio||!state.listen)return;
    const t=audio.currentTime,s=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
    s.buffer=noiseBuffer;
    filter.type="bandpass";
    filter.frequency.value=kind==="shutter"?1900:kind==="hoof"?408:kind==="chain"?2600:930;
    filter.Q.value=kind==="shutter"?1.4:.69;
    const length=kind==="shutter"?.15:kind==="hoof"?.12:.089;
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(kind==="shutter"?.38:.15,t+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,t+length);
    s.connect(filter).connect(gain).connect(master);s.start(t,.2+Math.random()*2,length+.01);
  }
  function note(midi=52,delay=0){
    if(!audio||!state.listen)return;
    const t=audio.currentTime+delay;
    for(const [ratio,strength,time] of [[1,.07,.88],[2,.022,.49],[3.004,.009,.25]]){
      const source=audio.createOscillator(),g=audio.createGain();
      source.frequency.value=440*2**((midi-69)/12)*ratio;
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(strength,t+.015);
      g.gain.exponentialRampToValueAtTime(.0001,t+time);
      source.connect(g).connect(master);source.start(t);source.stop(t+time+.015);
    }
  }
  return {start,run,click,note};
})();

const inputs=new Set();
const touchAxis=new T.Vector2();
const aim=new T.Vector3(), deckPoint=new T.Vector3(), target=new T.Vector3();
const sampled={shadow:null,light:null};
const printCanvas=$("print-canvas"), printContext=printCanvas.getContext("2d",{willReadFrequently:true});
let room=null, modeBeforeBook="opening", lastFrame=performance.now(), lastPaint=-Infinity;
let nextSample=0, nextAudio=0, elapsedSinceFoot=0, ready=false, dirty=true;
let zoomedControls=false;
let loadingRegion=false;
const sideOffset=(dir,amount)=>new T.Vector3(-dir.z*amount,0,dir.x*amount);
const signed=(n,digits=1)=>(n>0?"+":n<0?"−":"")+Math.abs(n).toFixed(digits);
const floor=()=>heightAt(currentStop(),state.x,state.z);
const distanceTo=p=>Math.hypot(p.x-state.x,p.z-state.z);
const toTarget=()=>landscape.route.at(landscape.route.station);
const roofStation=()=>state.roof&&Math.abs(state.road-landscape.route.station)<5.2;
const footStation=()=>distanceTo(toTarget())<5.4;
const rigNear=()=>distanceTo(rigSpot())<(state.index===0?3.35:3.85);
function report(text,seconds=3.6) {
  $("message").textContent=text;
  $("message").hidden=false;
  state.noticeUntil=state.elapsed+seconds;
}
function hideNotice() {$("message").hidden=true;}
function setMode(mode) {
  state.mode=mode;
  document.body.dataset.mode=mode;
  inputs.clear();touchAxis.set(0,0);
  $("opening").hidden=mode!=="opening";
  $("field-top").hidden=!["field","camera"].includes(mode);
  $("field-tools").hidden=mode!=="field";
  $("camera-ui").hidden=mode!=="camera";
  $("book").hidden=mode!=="book";
  $("darkroom").hidden=mode!=="darkroom";
  $("touch").hidden=mode!=="field";
  $("crosshair").hidden=mode!=="field"||state.drive;
  $("waypoint").hidden=true;
  hideNotice();
  dirty=true;
  if(mode==="field"||mode==="camera")canvas.focus();
}
function placeCamp(index,begin=true) {
  state.index=index;
  const stop=currentStop();
  Object.assign(state,{
    active:begin,weather:stop.startWeather,time:stop.time,road:0,lane:0,speed:0,driveYaw:0,drivePitch:0,
    drive:false,roof:false,lead:false,burroTied:false,packs:2,sheets:4,
    glass:0,ev:0,aperture:22,focus:index===0?940:index===1?135:550,focal:stop.focal,tilt:0,shift:0,frame:"landscape",
    pitch:-.025,invert:false,meter:false,meterReading:null,parkHint:false
  });
  sampled.shadow=sampled.light=null;
  room=null;zoomedControls=false;
  $("lens-tray").hidden=true;$("optics").setAttribute("aria-expanded","false");
  openLandscape(index);
  resetRigs();
  const path=landscape.route.at(0),dir=directionOfRoute(0),actor=rigSpot();
  const side=sideOffset(dir,2.84);
  state.x=path.x+side.x-dir.x*1.91;
  state.z=path.z+side.z-dir.z*1.91;
  if(index!==0)updateRigs(0);
  state.yaw=aimBetween(new T.Vector3(state.x,0,state.z),actor);
  setMode(begin?"field":"opening");
  syncPose();syncControls();
  if(begin){
    save();sound.start();
    report(index===0?"Approach Mistletoe and take the lead rope.":"Walk to the wagon and get in.");
  }
}
function syncPose() {
  const stop=currentStop();
  if(state.mode==="opening"){
    const p=burro.group.position;
    if(state.index===0)camera.position.set(p.x-4.25,p.y+1.57,p.z+3.18);
    else {const v=wagon.group.position;camera.position.set(v.x-5.8,v.y+2.46,v.z+6.5);}
    camera.lookAt(p.x-.77,p.y+3.53,p.z-8.5);
    if(state.index!==0)camera.lookAt(wagon.group.position.x+.64,wagon.group.position.y+2.21,wagon.group.position.z-6.0);
    return;
  }
  if(state.mode==="camera"){
    camera.position.copy(tripod.group.position);camera.position.y+=1.47;
    camera.rotation.set(state.pitch,state.yaw,0,"YXZ");
    return;
  }
  if(state.drive) {
    const dir=directionOfRoute(state.road), p=wagon.group.position;
    const baseYaw=Math.atan2(dir.x,dir.z), camYaw=baseYaw+state.driveYaw;
    const cx=Math.sin(camYaw), cz=Math.cos(camYaw);
    camera.position.set(p.x-cx*6.8+dir.z*.6,p.y+3.35,p.z-cz*6.8-dir.x*.6);
    camera.lookAt(p.x+cx*9.5,heightAt(stop,p.x+cx*9.5,p.z+cz*9.5)+1.65+state.drivePitch*6,p.z+cz*9.5);
    return;
  }
  if(state.roof) {
    const p=wagon.group.position;
    camera.position.set(p.x,p.y+3.72,p.z+.12);
  } else {
    const bob=Math.sin(elapsedSinceFoot*TAU)*.018*motionUniform.value;
    camera.position.set(state.x,floor()+1.67+bob,state.z);
  }
  camera.rotation.set(state.pitch,state.yaw,0,"YXZ");
}
function driveUpdate(dt) {
  const accelerate=+(inputs.has("KeyW")||inputs.has("ArrowUp"))-+(inputs.has("KeyS")||inputs.has("ArrowDown"))-touchAxis.y;
  const turn=+(inputs.has("KeyD")||inputs.has("ArrowRight"))-+(inputs.has("KeyA")||inputs.has("ArrowLeft"))+touchAxis.x;
  const braking=inputs.has("Space")||inputs.has("touchBrake");
  if(braking)state.speed*=Math.exp(-dt*9.2);
  else state.speed=lerp(state.speed,accelerate>=0?clamp(accelerate,0,1)*12.2:clamp(accelerate,-1,0)*4.8,1-Math.exp(-dt*(accelerate===0?2.9:3.2)));
  if(Math.abs(state.speed)<.025)state.speed=0;
  state.lane=clamp(lerp(state.lane,turn*1.38,1-Math.exp(-dt*4.8)),-1.45,1.45);
  if(!drag&&Math.abs(state.speed)>.4)state.driveYaw*=Math.exp(-dt*1.8);
  const end=landscape.route.station+1.65;
  state.road=clamp(state.road+state.speed*dt,0,end);
  if(state.road===end&&state.speed>0){
    state.speed=0;
    if(!state.parkHint){report("At the pullout. Set the brake, then climb the deck.");state.parkHint=true;}
  }
  if(state.road===0&&state.speed<0)state.speed=0;
}
function walkUpdate(dt) {
  const forward=+(inputs.has("KeyW"))-+(inputs.has("KeyS"))-touchAxis.y;
  const right=+(inputs.has("KeyD"))-+(inputs.has("KeyA"))+touchAxis.x;
  const magnitude=Math.hypot(forward,right), scale=Math.max(1,magnitude);
  state.yaw+=(+(inputs.has("ArrowLeft"))-+(inputs.has("ArrowRight")))*dt*1.28;
  state.pitch=clamp(state.pitch+(+(inputs.has("ArrowUp"))-+(inputs.has("ArrowDown")))*dt*1.09,-1.22,1.19);
  if(!magnitude){state.walkSpeed=0;return;}
  const stop=currentStop();
  const brisk=inputs.has("ShiftLeft")||inputs.has("ShiftRight");
  let speed=(brisk?4.1:3.36);
  if(state.lead)speed=Math.min(speed,state.packs===2?2.25:2.69);
  if(state.packs===1)speed*=.96;
  if(state.packs===0)speed*=.82;
  const mx=(Math.cos(state.yaw)*right-Math.sin(state.yaw)*forward)*speed*dt/scale;
  const mz=(-Math.sin(state.yaw)*right-Math.cos(state.yaw)*forward)*speed*dt/scale;
  const x=clamp(state.x+mx,-27,24),z=clamp(state.z+mz,stop.id==="tetons"?-62:-70,30);
  if(Math.abs(heightAt(stop,x,z)-floor())<1.1) {state.x=x;state.z=z;}
  const feet=Math.floor(elapsedSinceFoot*2);
  elapsedSinceFoot+=Math.hypot(mx,mz)*.66;
  if(Math.floor(elapsedSinceFoot*2)>feet){
    sound.click("step");
    if(state.lead&&feet%2===0)sound.click("hoof");
  }
  state.walkSpeed=speed;
}
function travel(dt) {
  if(state.mode!=="field")return;
  if(state.drive)driveUpdate(dt);
  else if(!state.roof)walkUpdate(dt);
  else {
    state.yaw+=(+(inputs.has("ArrowLeft"))-+(inputs.has("ArrowRight")))*dt*1.28;
    state.pitch=clamp(state.pitch+(+(inputs.has("ArrowUp"))-+(inputs.has("ArrowDown")))*dt,-1.22,1.19);
  }
  updateRigs(dt);
}
function climbDown(){
  const p=wagon.group.position,dir=directionOfRoute(state.road),side=sideOffset(dir,1.85);
  state.roof=false;state.x=p.x+side.x;state.z=p.z+side.z;
  state.yaw=aimBetween(new T.Vector3(state.x,0,state.z),p);state.pitch=-.065;
}
function rigAction() {
  if(state.mode!=="field")return;
  if(state.index===0) {
    if(state.lead) {
      state.lead=false;state.burroTied=footStation();
      sound.click("chain");report(state.burroTied?"Mistletoe is tied off at the bench.":"Mistletoe waits here.");
    } else if(rigNear()){
      state.lead=true;state.burroTied=false;
      if(distanceTo(landscape.route.at(0))<7)state.yaw=aimBetween(new T.Vector3(state.x,0,state.z),toTarget());
      sound.click("chain");report("Lead Mistletoe along the trail to the cairn.");
    } else report("Walk back to Mistletoe to take the rope.");
  } else if(state.drive) {
    state.drive=false;state.speed=0;state.driveYaw=0;state.drivePitch=0;climbDown();
    report("Brake set. Climb the deck from beside the wagon.",3.3);
  } else if(state.roof) {
    climbDown();
  } else if(rigNear()){
    state.drive=true;
    state.speed=0;state.driveYaw=0;state.drivePitch=0;
    report("W / S for throttle and reverse, A/D steer, drag to look, Space to brake.",4.4);
  } else report("Approach the wagon to get in.");
  syncControls();
}
function changeCargo(){
  if(state.mode!=="field"||state.index!==0)return;
  if(!rigNear()&&!state.lead){report("Move beside Mistletoe to handle the cases.");return;}
  state.packs=(state.packs+2)%3;
  const descriptions=["You carry both cases and can set up on your own.","One case each. You carry the camera and Mistletoe carries the tripod.","Both cases on Mistletoe. A slower pace on the climb."];
  report(descriptions[state.packs]);sound.click("chain");
  syncControls();
}
function climbDeck() {
  if(state.mode!=="field"||state.index===0)return;
  if(state.drive){state.drive=false;state.speed=0;state.driveYaw=0;state.drivePitch=0;}
  if(state.roof){climbDown();syncControls();return;}
  if(!rigNear()){report("Go to the wagon’s ladder.");return;}
  state.roof=true;
  const p=wagon.group.position;
  state.x=p.x;state.z=p.z;
  recenter();
  report("From the deck, look over the scrub and into the valley.");
  syncControls();
}
function recenter() {
  const stop=currentStop(), y=state.mode==="camera"?tripod.group.position.y+1.47:state.roof?wagon.group.position.y+3.72:floor()+1.67;
  const p=new T.Vector3(state.x,y,state.z);
  target.fromArray(stop.aim);
  state.yaw=aimBetween(p,target);
  state.pitch=Math.atan2(target.y-p.y,Math.hypot(target.x-p.x,target.z-p.z));
  state.focal=stop.focal;state.shift=0;dirty=true;
  syncOptics();
}
function setupCamera() {
  if(state.mode!=="field")return;
  const stop=currentStop();
  if(state.drive){report("Park the wagon to set the camera.");return;}
  if(state.sheets<=0){report("Reload at camp to make another exposure.");return;}
  if(state.index===0&&!(rigNear()||state.lead)&&state.packs>0){
    report(state.packs===2?"The camera case is on Mistletoe. Bring the burro to this spot.":"The tripod is on Mistletoe. Bring the burro to this spot.");return;
  }
  if(state.index!==0&&!state.roof&&!rigNear()) {
    report("The camera is in the wagon. Set it near the wagon or on the deck.");return;
  }
  if(state.lead){state.lead=false;state.burroTied=footStation();sound.click("chain");}
  deckPoint.set(state.x,state.roof?wagon.group.position.y+2.28:floor(),state.z);
  tripod.group.position.copy(deckPoint);tripod.group.rotation.y=state.yaw;tripod.group.visible=true;
  state.cameraAtStation=state.index===0?footStation():roofStation();
  state.meter=false;sampled.shadow=sampled.light=null;state.meterReading=null;
  setMode("camera");recenter();syncPose();syncControls();
  report("Drag to frame. F raises the spot meter.",3.2);
}
function exitCamera() {
  tripod.group.visible=false;state.meter=false;
  setMode("field");syncPose();syncControls();
}
function waitForLight() {
  if(state.mode!=="camera")return;
  state.time=(state.time+.123)%1;
  state.weather=clamp(state.weather+(state.index===2?-.212:-.094),.09,.96);
  waterValidity.value=0;dirty=true;
  report(state.weather>.59?"The clouds thicken over the ridge.":state.weather>.30?"Light is moving across the trees.":"A break in the clouds.");
}
function changeGlass(i) {
  state.glass=i;dirty=true;nextSample=0;
  if(state.meter)state.meterReading=null;
  syncOptics();syncReading();
  sound.click("chain");
}
function meterToggle() {
  if(state.mode!=="camera")return;
  state.meter=!state.meter;
  if(state.meter){nextSample=0;dirty=true;}
  syncReading();
}
function syncReading() {
  const enabled=state.mode==="camera"&&state.meter;
  $("meter").setAttribute("aria-pressed",enabled);
  $("meter-data").hidden=$("meter-reticle").hidden=$("readings").hidden=!enabled;
  $("zone").textContent=state.meterReading===null?"—":roman[readZone(state.meterReading)];
  $("meter-ev").textContent=state.meterReading===null?"Measuring…":signed(Math.log2(state.meterReading/.18)+state.ev)+" stops";
  for(const [type,id] of [["shadow","set-shadow"],["light","set-light"]]) {
    const reading=sampled[type];
    $(id).querySelector("span").textContent=reading?" · "+roman[reading.zone]:"";
  }
}
function markReading(type) {
  if(state.mode!=="camera")return;
  if(state.meterReading===null||!state.meter){report("Raise the spot meter and aim at the tone you want to mark.");return;}
  sampled[type]={zone:readZone(state.meterReading),value:state.meterReading};
  syncReading();
  sound.note(41+sampled[type].zone*2);
}
function focusControl(meters) {return 100*Math.log(meters/2)/Math.log(650);}
function syncOptics() {
  $("glass").value=state.glass;$("focal").value=state.focal;$("aperture").value=state.aperture;
  $("ev").value=state.ev;$("focus").value=focusControl(state.focus);$("rise").value=state.shift;$("tilt").value=state.tilt;
  $("ev-value").textContent=signed(state.ev,2)+" EV";
  $("focus-value").textContent=state.focus>850?"∞":Math.round(state.focus)+" m";
  $("rise-value").textContent=signed(state.shift*100,0)+"%";
  $("tilt-value").textContent=signed(state.tilt,0)+"°";
  $("orientation").setAttribute("aria-pressed",state.frame==="portrait");
  $("invert").setAttribute("aria-pressed",state.invert);
  $("film-size").textContent=(state.frame==="portrait"?"10×8":"8×10")+" · "+state.focal+" mm";
}
function syncControls() {
  const stop=currentStop(),onTrail=state.mode==="field";
  $("region").textContent=stop.region;$("location").textContent=stop.name;
  $("sheets").textContent=state.sheets+" "+(state.sheets===1?"sheet":"sheets");
  $("audio").textContent=state.listen?"Sound on":"Sound off";$("audio").setAttribute("aria-pressed",!state.listen);
  $("rig-action").querySelector("span").textContent=state.index===0?(state.lead?"Hitch Mistletoe":"Lead Mistletoe"):state.drive?"Set brake":state.roof?"Climb down":"Get in wagon";
  $("cargo").hidden=state.index!==0||!onTrail;
  $("deck").hidden=state.index===0||state.drive;
  $("deck").querySelector("span").textContent=state.roof?"Climb down":"Climb deck";
  $("setup").hidden=state.drive;
  $("crosshair").hidden=!onTrail||state.drive;
  $("touch-brake").hidden=!state.drive;
  $("expose").disabled=state.sheets===0;
  const label=state.index===0?"Upper bench":"Overlook pullout";
  let detail;
  if(state.drive)detail=Math.abs(state.road-landscape.route.station)<4?"At the pullout · Brake and step out":Math.max(0,Math.round(landscape.route.station-state.road))+" m along the road · Space to brake";
  else if(state.roof)detail="Roof deck · "+(roofStation()?"Set the camera here":"Drive to the marked pullout for the assignment");
  else if(state.index===0)detail=state.lead?"Leading Mistletoe · "+Math.round(distanceTo(toTarget()))+" m to the bench":state.burroTied?"Mistletoe tied off · Set the camera":Math.round(distanceTo(toTarget()))+" m to the bench";
  else detail=rigNear()?"Wagon nearby · Climb deck or get in":"Approach the wagon";
  if($("task-name").textContent!==label)$("task-name").textContent=label;
  if($("task-detail").textContent!==detail)$("task-detail").textContent=detail;
  syncOptics();syncReading();
}

function inspectPrint(photo) {
  const {original,width,height}=photo;
  const pixels=original.data;
  const average=(left,top,right,bottom)=>{
    let sum=0,count=0;
    for(let y=Math.round(height*top);y<height*bottom;y+=3)for(let x=Math.round(width*left);x<width*right;x+=3){
      sum+=pixels[(y*width+x)*4]/255;count++;
    }
    return sum/Math.max(1,count);
  };
  let shadows=0,white=0,count=0;
  for(let y=2;y<height;y+=4)for(let x=2;x<width;x+=4){
    const q=pixels[(y*width+x)*4]/255;
    if(q<.022)shadows++;
    if(q>.977)white++;
    count++;
  }
  return {shadow:shadows/count,white:white/count,sky:average(.16,.04,.84,.21),
    ground:average(.19,.42,.81,.74),water:average(.27,.60,.73,.91),edges:average(.04,.60,.26,.92)};
}
function feedback(meta) {
  const stop=stops[meta.index], a=meta.analysis;
  if(!meta.station)return meta.index===0?"Make this study from the upper bench for the assignment.":"Make this study from the wagon deck at the marked pullout.";
  if(meta.framing<.84)return "Bring the landmark back into the plate. Recenter is available under Lens & glass.";
  if(a.white>.29)return "The highlights are losing texture. Try less exposure and meter the brightest area again.";
  if(a.shadow>.51)return "Too much of the plate is in deep shadow. Give the negative more exposure.";
  if(meta.index===0&&(meta.glass<2||a.ground-a.sky<.048))return "Try orange or red glass and frame the granite against a darker patch of sky.";
  if(meta.index===1&&(a.water<.255||a.water-a.edges<.028))return "The bend needs to read brighter than the banks. Reframe or increase exposure.";
  if(meta.index===2&&meta.weather>.58)return "Wait for a break in the storm before exposing.";
  return "";
}
function refreshRoomText() {
  if(!room)return;
  const {meta,review}=room;
  const data=$("negative-details");data.replaceChildren();
  const add=(str)=>{const p=document.createElement("p");p.textContent=str;data.append(p);};
  add(filters[meta.glass].name+" · "+meta.focal+" mm · f/"+meta.aperture+" · "+signed(meta.ev,2)+" EV");
  if(meta.shadow!==null||meta.light!==null)add("Spot notes · "+(meta.shadow!==null?"Shadow "+roman[meta.shadow]:"Shadow —")+" · "+(meta.light!==null?"Highlight "+roman[meta.light]:"Highlight —"));
  add(review||"This negative meets the field assignment. Develop it and file your print.");
}
function exposePlate() {
  if(state.mode!=="camera"||state.sheets<=0)return;
  sound.click("shutter");
  syncPose();
  const photo=makeNegative();
  state.sheets--;
  const landmark=new T.Vector3(...currentStop().aim).sub(camera.position).normalize();
  const facing=camera.getWorldDirection(aim);
  const meta={index:state.index,station:state.cameraAtStation,glass:state.glass,ev:state.ev,aperture:state.aperture,
    focal:state.focal,framing:landmark.dot(facing),weather:state.weather,shadow:sampled.shadow?.zone??null,
    light:sampled.light?.zone??null,analysis:inspectPrint(photo)};
  room={...photo,meta,review:feedback(meta),mask:new Float32Array(photo.width*photo.height),
    tone:0,brush:1,brushSize:13,showNegative:false,saved:false};
  $("dark-location").textContent=currentStop().name+" · Sheet "+(4-state.sheets)+" of 4";
  $("contrast").value=0;$("contrast-value").textContent="Normal";$("brush-size").value=13;
  $("dodge").setAttribute("aria-pressed",true);$("burn").setAttribute("aria-pressed",false);
  $("show-negative").setAttribute("aria-pressed",false);
  $("print-status").textContent="";
  printCanvas.width=photo.width;printCanvas.height=photo.height;
  room.output=printContext.createImageData(photo.width,photo.height);
  setMode("darkroom");refreshRoomText();drawPrint();
  const flash=$("flash");flash.classList.remove("shutter");
  void flash.offsetWidth;flash.classList.add("shutter");
  $("file-print").focus();
}
function drawPrint(forcePositive=false) {
  if(!room)return;
  const {original,output,width,height,tone,mask,showNegative}=room;
  const src=original.data,dst=output.data;
  const contrast=1+tone*.013, negative=showNegative&&!forcePositive;
  const lut=new Uint8Array(256);
  for(let i=0;i<256;i++){
    const base=i/255;
    const y=clamp((base-.49)*contrast+.49,0,1);
    lut[i]=Math.round((negative?.965-y*.911:y)*255);
  }
  for(let p=0,i=0;p<width*height;p++,i+=4){
    const value=clamp(Math.round(lut[src[i]]+(negative?0:mask[p]*255)),0,255);
    dst[i]=value;dst[i+1]=Math.round(value*.996);dst[i+2]=Math.round(value*.985);dst[i+3]=255;
  }
  printContext.putImageData(output,0,0);
}
function brushAt(clientX,clientY) {
  if(!room||room.showNegative)return;
  const bounds=printCanvas.getBoundingClientRect(), {width,height,brush,brushSize,mask}=room;
  const x=(clientX-bounds.left)/bounds.width*width,y=(clientY-bounds.top)/bounds.height*height;
  const r=brushSize*.006*Math.min(width,height),loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(width-1,Math.ceil(x+r));
  const loY=Math.max(0,Math.floor(y-r)),hiY=Math.min(height-1,Math.ceil(y+r));
  for(let j=loY;j<=hiY;j++)for(let i=loX;i<=hiX;i++){
    const d=((i-x)**2+(j-y)**2)/(r*r);
    if(d>=1)continue;
    const k=j*width+i;
    mask[k]=clamp(mask[k]+brush*.024*(1-d)**2,-.35,.35);
  }
  if(performance.now()-lastPaint>34){drawPrint();lastPaint=performance.now();}
}
function downloadUrl(uri,name) {
  const a=document.createElement("a");a.href=uri;a.download=name;
  document.body.append(a);a.click();a.remove();
}
function saveFullPrint() {
  if(!room)return;
  drawPrint(true);
  const stamp=currentStop().id+"-plate.png";
  printCanvas.toBlob(blob=>{
    if(!blob)return;
    const uri=URL.createObjectURL(blob);
    downloadUrl(uri,stamp);
    setTimeout(()=>URL.revokeObjectURL(uri),1500);
  },"image/png");
  if(room.showNegative)drawPrint();
}
function storePrint() {
  if(!room)return;
  drawPrint(true);
  const small=document.createElement("canvas");
  const factor=450/Math.max(printCanvas.width,printCanvas.height);
  small.width=Math.round(printCanvas.width*factor);small.height=Math.round(printCanvas.height*factor);
  small.getContext("2d").drawImage(printCanvas,0,0,small.width,small.height);
  const stop=currentStop(),assigned=!room.review;
  const before=state.plates[stop.id];
  if(!before?.assigned||assigned){
    state.plates[stop.id]={preview:small.toDataURL("image/jpeg",.88),assigned,glass:filters[room.meta.glass].name,
      ev:room.meta.ev,shadow:room.meta.shadow,light:room.meta.light};
    save();
  }
  room.saved=true;
  $("print-status").textContent=assigned?"Assignment print filed.":before?.assigned?"Study developed. The assignment print stays in the book.":"Study filed. This assignment is still open.";
  sound.note(45);sound.note(57,.22);
  openBook("darkroom");
}
function closeRoom() {
  if(state.mode!=="darkroom")return;
  room=null;
  setMode("camera");syncPose();syncControls();
  if(state.sheets===0)report("Holder empty. Reload at camp from the field book.",4.4);
}

const controlList=`
<dl>
<dt>W A S D</dt><dd>Walk. In the wagon, W/S are throttle and reverse, A/D steer within the road.</dd>
<dt>Mouse drag / arrows</dt><dd>Look around or frame the plate. Touch supports dragging and a trail joystick.</dd>
<dt>E / P</dt><dd>Lead or hitch Mistletoe, or get in or out of the wagon. P moves one case between you and Mistletoe.</dd>
<dt>Space / V</dt><dd>Brake in the wagon. V climbs or leaves the roof deck when parked.</dd>
<dt>C / F / J / K</dt><dd>Set the camera, raise the meter, and mark shadow and highlight readings.</dd>
<dt>1–5 / T / Space</dt><dd>Select glass, wait for light, and expose a sheet in camera view.</dd>
<dt>Tab / Esc</dt><dd>Field book or back to the previous view.</dd>
</dl>
<p><strong>Geography.</strong> The terrain, firs, and weather derive from <cite>Storm Over Granite</cite> and the river from <cite>Snake River Print</cite>. The routes and shooting benches were designed for play. Survey data and aerial imagery come from <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank" rel="noopener">the USGS National Map</a>. Stone and fir materials use <a href="https://polyhaven.com/" target="_blank" rel="noopener">Poly Haven</a> sources.</p>
<p><strong>Fieldwork.</strong> Mistletoe and the roof deck draw on the supplied references and Adams’s field equipment. The three assignments bring different periods of his fieldwork together. <a href="https://www.pbs.org/wgbh/americanexperience/features/ansel-photo-gear/" target="_blank" rel="noopener">PBS · Adams’s photo gear</a> · <a href="https://www.wisconsinhistory.org/record/image/W012RU6/ansel-adams-on-camera-platform" target="_blank" rel="noopener">Wisconsin Historical Society · Roof platform</a></p>`;
async function travelTo(index, button) {
  if (loadingRegion) return;
  loadingRegion = true;
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Loading landscape…";
  try {
    await loadRegion(stops[index]);
    if (state.mode === "book") placeCamp(index);
  } catch (error) {
    console.error(error);
    $("book-progress").textContent = "The landscape could not load. Tap Travel here to try again.";
  } finally {
    loadingRegion = false;
    button.disabled = false;
    button.textContent = label;
  }
}
function stationCard(stop,index) {
  const card=document.createElement("article");card.className="station-card";
  const record=state.plates[stop.id];
  const head=document.createElement("header");
  head.innerHTML=`<span class="eyebrow">${stop.rig}</span><h3>${stop.name}</h3><p>${stop.brief}</p><p>${stop.tones}</p>`;
  card.append(head);
  if(record){
    const img=document.createElement("img");img.src=record.preview;img.alt=(record.assigned?"Filed assignment":"Study")+" of "+stop.name;card.append(img);
  } else {
    const blank=document.createElement("div");blank.className="placeholder";card.append(blank);
  }
  const actions=document.createElement("div");actions.className="row station-actions";
  const visit=document.createElement("button");visit.textContent=index===state.index&&state.active?"Current site":"Travel here";
  visit.className=index===state.index?"":"paper";
  visit.addEventListener("click",()=>index===state.index&&state.active?closeBook():travelTo(index,visit));
  actions.append(visit);
  if(record){
    const status=document.createElement("small");
    status.textContent=record.assigned?"Print filed":"Study filed";
    actions.append(status);
  }
  card.append(actions);return card;
}
function openBook(previous=state.mode) {
  if(state.mode==="book")return;
  modeBeforeBook=previous;
  setMode("book");
  const count=stops.filter(stop=>state.plates[stop.id]?.assigned).length;
  $("book-progress").textContent=count===stops.length?"Portfolio complete · Three prints filed":count+" of 3 assignment prints filed";
  $("station-list").replaceChildren(...stops.map(stationCard));
  const stop=currentStop();
  $("current-note").innerHTML=`<strong>${stop.assignment}</strong><br>${stop.hint}`;
  if(room?.saved&&previous==="darkroom") {
    const outcome=document.createElement("p");
    outcome.textContent=room.review||"Assignment print filed.";
    $("current-note").append(outcome);
  }
  $("reload").hidden=!state.active;
  $("book-close").focus();
}
function closeBook() {
  if(state.mode!=="book")return;
  setMode(modeBeforeBook);
  if(modeBeforeBook==="opening")$("begin").focus();
  if(modeBeforeBook==="darkroom"){
    $("file-print").focus();
    if(room?.saved&&state.plates[currentStop().id]?.assigned)$("print-status").textContent="Assignment print filed.";
  }
  syncPose();syncControls();
}

function showWaypoint() {
  const marker=$("waypoint");
  if(state.mode!=="field"){marker.hidden=true;return;}
  const destination=toTarget();
  const d=distanceTo(destination);
  destination.y=heightAt(currentStop(),destination.x,destination.z)+1.38;
  camera.updateMatrixWorld();
  camera.getWorldDirection(aim);
  const ahead=destination.clone().sub(camera.position).dot(aim)>0;
  destination.project(camera);
  const visible=ahead&&Math.abs(destination.x)<.93&&Math.abs(destination.y)<.88&&d>3.5;
  marker.hidden=!visible;
  if(!visible)return;
  marker.style.left=(destination.x*.5+.5)*100+"%";
  marker.style.top=(.5-destination.y*.5)*100+"%";
  marker.querySelector("span").textContent=state.index===0?"UPPER BENCH":"PULLOUT";
}
function look(dx,dy) {
  if(state.mode!=="camera"&&state.mode!=="field")return;
  if(state.drive){
    state.driveYaw=clamp(state.driveYaw-dx*.0031,-1.15,1.15);
    state.drivePitch=clamp(state.drivePitch-dy*.0028,-.45,.45);
    dirty=true;
    return;
  }
  const sensitivity=state.mode==="camera"?.0021:.0031;
  const factor=state.mode==="camera"&&state.invert?-1:1;
  state.yaw-=dx*sensitivity*factor;
  state.pitch=clamp(state.pitch-dy*sensitivity*factor,-1.22,1.18);
  dirty=true;
}
function adjustCamera(dt){
  const x=+(inputs.has("ArrowRight"))-+(inputs.has("ArrowLeft"));
  const y=+(inputs.has("ArrowDown"))-+(inputs.has("ArrowUp"));
  if(x||y)look(x*dt*420,y*dt*358);
}
function cameraControls(){
  zoomedControls=!zoomedControls;
  $("lens-tray").hidden=!zoomedControls;
  $("optics").setAttribute("aria-expanded",zoomedControls);
}
function begin(){
  if(!ready)return;
  placeCamp(state.index);
}
for(let i=0;i<filters.length;i++){
  const option=document.createElement("option");option.value=i;option.textContent=filters[i].name;$("glass").append(option);
}
$("instructions").innerHTML=controlList;
$("begin").addEventListener("click",begin);
$("open-map").addEventListener("click",()=>openBook("opening"));
$("journal").addEventListener("click",()=>openBook());
$("book-close").addEventListener("click",closeBook);
$("reload").addEventListener("click",()=>{placeCamp(state.index);report("At camp. Four fresh sheets.");});
$("audio").addEventListener("click",()=>{state.listen=!state.listen;sound.start();save();syncControls();});
$("rig-action").addEventListener("click",rigAction);
$("cargo").addEventListener("click",changeCargo);
$("deck").addEventListener("click",climbDeck);
$("setup").addEventListener("click",setupCamera);
$("leave-camera").addEventListener("click",exitCamera);
$("meter").addEventListener("click",meterToggle);
$("wait").addEventListener("click",waitForLight);
$("optics").addEventListener("click",cameraControls);
$("expose").addEventListener("click",exposePlate);
$("set-shadow").addEventListener("click",()=>markReading("shadow"));
$("set-light").addEventListener("click",()=>markReading("light"));
$("reset-view").addEventListener("click",recenter);
$("glass").addEventListener("change",event=>changeGlass(Number(event.target.value)));
for(const [id,property,convert] of [
  ["ev","ev",Number],["focal","focal",Number],["aperture","aperture",Number],["focus","focus",v=>2*650**(v/100)],
  ["rise","shift",Number],["tilt","tilt",Number]
]){
  $(id).addEventListener("input",event=>{
    state[property]=convert(event.target.value);
    dirty=true;nextSample=0;syncOptics();syncReading();
  });
}
$("orientation").addEventListener("click",()=>{
  state.frame=state.frame==="portrait"?"landscape":"portrait";dirty=true;syncOptics();
});
$("invert").addEventListener("click",()=>{state.invert=!state.invert;dirty=true;syncOptics();});
$("room-close").addEventListener("click",closeRoom);
$("contrast").addEventListener("input",event=>{
  room.tone=Number(event.target.value);
  $("contrast-value").textContent=room.tone===0?"Normal":signed(room.tone,0);drawPrint();
});
$("brush-size").addEventListener("input",event=>{room.brushSize=Number(event.target.value);});
function chooseBrush(direction){
  room.brush=direction;room.showNegative=false;
  $("dodge").setAttribute("aria-pressed",direction>0);
  $("burn").setAttribute("aria-pressed",direction<0);
  $("show-negative").setAttribute("aria-pressed",false);
  drawPrint();
}
$("dodge").addEventListener("click",()=>chooseBrush(1));
$("burn").addEventListener("click",()=>chooseBrush(-1));
$("clear-marks").addEventListener("click",()=>{room.mask.fill(0);drawPrint();});
$("show-negative").addEventListener("click",()=>{
  room.showNegative=!room.showNegative;
  $("show-negative").setAttribute("aria-pressed",room.showNegative);
  drawPrint();
});
$("download").addEventListener("click",saveFullPrint);
$("file-print").addEventListener("click",storePrint);
let brushPointer=null;
printCanvas.addEventListener("pointerdown",event=>{
  if(event.button!==0||!room)return;
  brushPointer=event.pointerId;printCanvas.setPointerCapture(event.pointerId);
  brushAt(event.clientX,event.clientY);
});
printCanvas.addEventListener("pointermove",event=>{if(brushPointer===event.pointerId)brushAt(event.clientX,event.clientY);});
function liftBrush(event){if(brushPointer!==event.pointerId)return;brushPointer=null;drawPrint();}
printCanvas.addEventListener("pointerup",liftBrush);printCanvas.addEventListener("pointercancel",liftBrush);
let drag=null;
canvas.addEventListener("pointerdown",event=>{
  if(event.button!==0||!["field","camera"].includes(state.mode))return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY};
  canvas.setPointerCapture(event.pointerId);canvas.focus();
});
canvas.addEventListener("pointermove",event=>{
  if(drag?.id!==event.pointerId)return;
  look(event.clientX-drag.x,event.clientY-drag.y);
  drag.x=event.clientX;drag.y=event.clientY;
});
function stopDrag(event){if(drag?.id===event.pointerId)drag=null;}
canvas.addEventListener("pointerup",stopDrag);canvas.addEventListener("pointercancel",stopDrag);
const stick=$("joystick"),stickTip=stick.querySelector("i");
let stickPointer=null;
function updateStick(event) {
  const b=stick.getBoundingClientRect();
  touchAxis.set((event.clientX-b.x-b.width*.5)/29,(event.clientY-b.y-b.height*.5)/29);
  if(touchAxis.length()>1)touchAxis.normalize();
  stickTip.style.transform=`translate(${touchAxis.x*23}px,${touchAxis.y*23}px)`;
}
stick.addEventListener("pointerdown",event=>{
  if(stickPointer!==null)return;
  stickPointer=event.pointerId;stick.setPointerCapture(stickPointer);updateStick(event);
});
stick.addEventListener("pointermove",event=>{if(stickPointer===event.pointerId)updateStick(event);});
function releaseStick(event){
  if(stickPointer!==event.pointerId)return;
  stickPointer=null;touchAxis.set(0,0);stickTip.style.transform="";
}
stick.addEventListener("pointerup",releaseStick);stick.addEventListener("pointercancel",releaseStick);
$("touch-brake").addEventListener("pointerdown",event=>{
  $("touch-brake").setPointerCapture(event.pointerId);inputs.add("touchBrake");
});
for(const type of ["pointerup","pointercancel"])$("touch-brake").addEventListener(type,()=>inputs.delete("touchBrake"));
for(const button of document.querySelectorAll("#field-tools button,#camera-ui button,#audio")) {
  button.addEventListener("click",()=>{if(state.mode==="field"||state.mode==="camera")canvas.focus();});
}
const controlKeys=new Set(["KeyW","KeyA","KeyS","KeyD","ArrowLeft","ArrowRight","ArrowUp","ArrowDown",
  "KeyE","KeyP","KeyV","KeyC","KeyT","KeyF","KeyJ","KeyK","Space","Digit1","Digit2","Digit3","Digit4","Digit5"]);
document.addEventListener("keydown",event=>{
  if(!ready||event.ctrlKey||event.metaKey||event.altKey)return;
  const {code}=event,mode=state.mode;
  if(code==="Escape"){
    if(mode==="book")closeBook();
    else if(mode==="darkroom")closeRoom();
    else if(mode==="camera")exitCamera();
    else if(mode==="field")openBook();
    return;
  }
  if((mode==="field"||mode==="camera")&&code==="Tab"&&!event.shiftKey&&document.activeElement===canvas){
    event.preventDefault();openBook();return;
  }
  if(!["field","camera"].includes(mode)||event.target.matches("input,select,summary"))return;
  if(event.target.matches("button")&&(code==="Space"||code==="Enter"))return;
  if(controlKeys.has(code))event.preventDefault();
  inputs.add(code);
  if(event.repeat)return;
  if(mode==="field"){
    if(code==="KeyE")rigAction();
    if(code==="KeyP")changeCargo();
    if(code==="KeyV")climbDeck();
    if(code==="KeyC")setupCamera();
  } else {
    if(code==="KeyF")meterToggle();
    if(code==="KeyT")waitForLight();
    if(code==="KeyJ")markReading("shadow");
    if(code==="KeyK")markReading("light");
    if(code==="Space")exposePlate();
    if(/^Digit[1-5]$/.test(code))changeGlass(Number(code.at(-1))-1);
  }
});
document.addEventListener("keyup",event=>inputs.delete(event.code));
window.addEventListener("blur",()=>{inputs.clear();touchAxis.set(0,0);});
window.addEventListener("resize",()=>{dirty=true;});
motionPreference.addEventListener?.("change",event=>{motionUniform.value=event.matches?.17:1;dirty=true;});
canvas.addEventListener("webglcontextlost",event=>{
  event.preventDefault();ready=false;
  setMode("opening");$("loading").hidden=false;$("loading").textContent="Rendering stopped. Reload to return to your field book.";
  $("begin").disabled=$("open-map").disabled=true;
});
function updateFrame() {
  resizeView();
  if(state.mode==="camera"){
    const guide=$("plate-guide");
    guide.style.width=canvas.style.width;guide.style.height=canvas.style.height;
  }
  renderWorld(displayWidth,displayHeight);
  showWaypoint();
}
let lastRender=-Infinity,lastControls=-Infinity;
function tick(now) {
  if(!ready)return;
  requestAnimationFrame(tick);
  const elapsed=Math.min(.27,Math.max(0,(now-lastFrame)*.001));
  lastFrame=now;
  if(document.hidden)return;
  state.elapsed+=elapsed;
  if(state.mode==="field") {
    const count=Math.max(1,Math.ceil(elapsed/.045));
    for(let i=0;i<count;i++)travel(elapsed/count);
    syncPose();
    if(state.elapsed-lastControls>.19){syncControls();lastControls=state.elapsed;}
  } else if(state.mode==="camera"){
    adjustCamera(elapsed);syncPose();
  } else if(state.mode==="opening"){
    updateRigs(elapsed);syncPose();
  }
  if(state.elapsed>state.noticeUntil)hideNotice();
  if(state.elapsed>nextAudio){sound.run();nextAudio=state.elapsed+.15;}
  if(["field","camera","opening"].includes(state.mode)&&(dirty||state.elapsed-lastRender>(software?.056:.022))){
    updateFrame();
    lastRender=state.elapsed;dirty=false;
    if(state.mode==="camera"&&state.meter&&state.elapsed>nextSample){
      state.meterReading=readLight();
      nextSample=state.elapsed+(software?.51:.19);
      syncReading();
    }
  }
}
restore();
await loadRegion(currentStop());
placeCamp(state.index,false);
updateFrame();
ready=true;
$("loading").hidden=true;
$("begin").disabled=$("open-map").disabled=false;
if(Object.keys(state.plates).length)$("begin").textContent="Continue expedition";
requestAnimationFrame(tick);

})().catch(error=>{console.error(error);const status=document.getElementById("loading");status.textContent="Field Plates could not start. Reload, or try a current browser with WebGL 2."});