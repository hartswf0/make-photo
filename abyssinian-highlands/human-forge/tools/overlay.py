import sys, os; sys.argv=[sys.argv[0]]+sys.argv[1:]
src=open(os.path.join(os.path.dirname(__file__),'..','verify.py')).read().split("refs = ref_masks()")[0].split("# ------------------------------------------------------------------ 1) mjs gates")[0]+open(os.path.join(os.path.dirname(__file__),'..','verify.py')).read().split("# ------------------------------------------------------------------ 2) silhouette IoU")[1].split("refs = ref_masks()")[0]
exec(src); HERE=os.path.abspath(os.path.join(os.path.dirname(__file__),".."))
key=sys.argv[1] if len(sys.argv)>1 else 'adult_m'; cf=float(sys.argv[2]) if len(sys.argv)>2 else .8
meta,D=load_fig(key); refs=ref_masks(); tiles=[]
for yaw,ref in zip([0,35,90],refs):
    pts,(x0,x1,y0,y1)=sil(meta,D,yaw,cf); rh,rw=ref.shape; sc=rh/(y1-y0); Wc=int(max(rw,(x1-x0)*sc)+4)
    ox=(Wc-(x1-x0)*sc)/2; tri=[[((x-x0)*sc+ox,(y1-y)*sc) for x,y in t] for t in pts]; mine=raster(tri,Wc,rh)
    rr=np.zeros((rh,Wc),bool); rx=(Wc-rw)//2; rr[:,rx:rx+rw]=ref
    im=np.zeros((rh,Wc,3),np.uint8); im[mine&rr]=(200,200,200); im[mine&~rr]=(230,60,60); im[~mine&rr]=(60,120,240); tiles.append(im)
H=max(t.shape[0] for t in tiles); out=np.concatenate([np.pad(t,((0,H-t.shape[0]),(0,6),(0,0))) for t in tiles],1)
Image.fromarray(out).save(sys.argv[3] if len(sys.argv)>3 else '/tmp/overlay.jpg',quality=75); print(out.shape)
