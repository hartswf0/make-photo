#!/usr/bin/env python3
"""Dress a blocked-out seed: the three.js frame's depth + a style reference + a prompt -> a photographic frame on the same geometry
(World Labs Atlas atlasChisel). Usage: dress_seed.py <capdir> <seeds.json> <outdir> [id,id,...]"""
import json,sys,subprocess,os,base64,time,numpy as np,OpenEXR,Imath,concurrent.futures as cf
API='https://api.atlas.worldlabs.ai/api/v2';cap,seedfile,out=sys.argv[1:4];only=sys.argv[4].split(',') if len(sys.argv)>4 else None
HERE=os.path.dirname(os.path.abspath(__file__));os.makedirs(out,exist_ok=True)
def post(path,body,t=600):
    r=subprocess.run(['curl','-s','-m',str(t),'-X','POST',API+path,'-H','Authorization: Bearer '+os.environ.get('ATLAS_API_KEY','proxy'),'-H','Content-Type: application/json','-d','@-'],input=json.dumps(body),capture_output=True,text=True)
    try: return json.loads(r.stdout)
    except Exception: return {'error':r.stdout[:400]}
def exr(f32,w,h,path,far):
    z=np.fromfile(f32,dtype=np.float32).reshape(h,w).copy();z[z>far]=far
    hd=OpenEXR.Header(w,h);hd['channels']={'Y':Imath.Channel(Imath.PixelType(Imath.PixelType.FLOAT))};hd['compression']=Imath.Compression(Imath.Compression.ZIP_COMPRESSION)
    o=OpenEXR.OutputFile(path,hd);o.writePixels({'Y':z.tobytes()});o.close()
def b64(p): return base64.b64encode(open(p,'rb').read()).decode()
spec=json.load(open(seedfile));STYLE=spec['style']
def run(sd):
    i=sd['id'];dst=f'{out}/{i}.jpg'
    if os.path.exists(dst): return i,'cached'
    cam=json.load(open(f'{cap}/{i}.cam.json'))['camera'];K=cam['intrinsics']
    e=f'{cap}/{i}.depth.exr';exr(f'{cap}/{i}.depth.f32',K['width'],K['height'],e,sd.get('far',900))
    body={'targetFrames':[{'camera':cam,'depth':{'depthAsset':{'base64':b64(e)}}}],'prompt':STYLE+' '+sd['frame'],'enhancePrompt':sd.get('enhance',True)}
    ref=sd.get('ref') or spec.get('ref')
    if ref: body['styleReferenceImageAsset']={'base64':b64(os.path.join(HERE,'..',ref))}
    if 'seedValue' in sd: body['modelParameters']={'seed':sd['seedValue']}
    op=post('/tasks:atlasChisel',body)
    if 'id' not in op: return i,'submit failed '+json.dumps(op)[:500]
    for _ in range(120):
        if op.get('done'): break
        time.sleep(4)
        r=post('/operations/%s:wait'%op['id'],{'timeoutSecs':60},90)
        if 'done' in r: op=r
    if not op.get('done') or op.get('error'): return i,'failed '+json.dumps(op.get('error') or op)[:500]
    png=f'{out}/{i}.png';subprocess.run(['curl','-s','-m','180','-o',png,op['response']['frames'][0]['imageAsset']['url']])
    from PIL import Image
    Image.open(png).convert('RGB').save(dst,quality=90);os.remove(png)
    json.dump({'id':i,'operation':op['id'],'promptUsed':op['response'].get('promptUsed')},open(f'{out}/{i}.dress.json','w'),indent=1)
    return i,'ok'
jobs=[s for s in spec['seeds'] if not only or s['id'] in only]
with cf.ThreadPoolExecutor(3) as ex:
    for r in ex.map(run,jobs): print(*r,flush=True)
