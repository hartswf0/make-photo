"""LiDAR shots: each Atlas place (kerb, neon, tunnel, fog, lanterns, arcade) as its point cloud, flown three ways, clean (no words).
path = along the place's own cameras · push = a slow dolly in from the first camera · rise = a crane up and over, tilting down.
Colour: the height ramp (blue ground -> red top) lit by the scan's luminance; the push uses white scan points for contrast."""
import json, os, sys, math, subprocess, numpy as np, cv2
TIDE='/home/user/hartswf0/butterfly-halfworld/wygwyl/world/tide';A=TIDE+'/atlas'
W,H,FPS,DUR=960,540,24,12
meta=json.load(open(A+'/ride-cel/site/lidar.json'))
def R(q):
    x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def slerp(a,b,t):
    a=np.array(a,float);b=np.array(b,float);d=np.dot(a,b)
    if d<0:b,d=-b,-d
    if d>.9995:q=a+t*(b-a);return q/np.linalg.norm(q)
    th=math.acos(d);return (math.sin((1-t)*th)*a+math.sin(t*th)*b)/math.sin(th)
def qmul(a,b):
    x1,y1,z1,w1=a;x2,y2,z2,w2=b;return np.array([w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2,w1*w2-x1*x2-y1*y2-z1*z2])
def qaxis(ax,ang):s=math.sin(ang/2);return np.array([ax[0]*s,ax[1]*s,ax[2]*s,math.cos(ang/2)])
def ramp(h):
    st=np.array([[255,40,10],[255,190,0],[80,230,40],[0,230,255],[0,140,255],[40,40,230]],np.float32);x=np.clip(h,0,1)*(len(st)-1);i=np.minimum(len(st)-2,x.astype(int));f=(x-i)[:,None];return st[i]*(1-f)+st[i+1]*f
def load(name):
    p=f'{A}/arcade/arcade.lidar.bin' if name=='arcade' else f'{A}/ride-cel/{name}/{name}.lidar.bin';m=meta[name];n=m['n'];b=open(p,'rb').read()
    q=np.frombuffer(b[:n*6],np.int16).reshape(n,3).astype(np.float32);lum=np.frombuffer(b[n*6:n*7],np.uint8).astype(np.float32)
    lo,hi=np.array(m['lo']),np.array(m['hi']);P=(q+32768)/65535*(hi-lo)+lo;return P.astype(np.float32),lum,m
def cams(name):
    if name in ('kerb','neon','tunnel'):
        return [c for c in json.load(open(A+'/ride-cel/scenes.json')) if c['name']==name][0]['cams']
    return json.load(open(f'{A}/arcade/cameras.json' if name=='arcade' else f'{A}/ride-cel/{name}/cameras.json'))
def draw(P,col,pos,q,f):
    Rm=R(q);Xc=(P-pos)@Rm;z=-Xc[:,2];ok=z>.15;zz=np.where(ok,z,1)
    u=f*Xc[:,0]/zz+W/2;v=-f*Xc[:,1]/zz+H/2;ok&=(u>=0)&(u<W-1)&(v>=0)&(v<H-1)
    u=u[ok].astype(np.int32);v=v[ok].astype(np.int32);z=z[ok];c=col[ok];o=np.argsort(-z);u,v,z,c=u[o],v[o],z[o],c[o]
    img=np.zeros((H,W,3),np.float32);c=c*np.clip(1.15-z/60,.22,1)[:,None];img[v,u]=c
    near=z<5;img[v[near]+1,u[near]]=c[near];img[v[near],u[near]+1]=c[near];img[v[near]+1,u[near]+1]=c[near]
    return np.clip(img+cv2.GaussianBlur(img,(0,0),2.4)*.85,0,255).astype(np.uint8)
def shot(name,kind):
    P,lum,m=load(name);cs=cams(name);f0=cs[0]['fy']*H/cs[0]['h'];g,top=m['ground'],m['top']
    L=(lum/255)[:,None]
    col=ramp((P[:,1]-g)/(top-g))*(.45+.75*L) if kind!='push' else np.repeat((40+215*np.clip(L*1.25,0,1)),3,1)*np.array([1,.92,.82],np.float32)
    out=f'lidar/lidar-{name}-{kind}.mp4'
    ff=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-c:v','libx264','-crf','24','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart',out],stdin=subprocess.PIPE)
    keys=[(np.array(c['p']),np.array(c['q'])) for c in cs];N=DUR*FPS
    fwd0=-R(keys[0][1])[:,2]
    for n in range(N):
        u=n/(N-1);e=u*u*(3-2*u)
        if kind=='path':
            k=len(keys);fl=e*(k-1);i=min(k-2,int(fl)) if k>1 else 0;a=fl-i
            pos,q=(keys[0] if k==1 else (keys[i][0]*(1-a)+keys[i+1][0]*a,slerp(keys[i][1],keys[i+1][1],a)))
            if k==1:pos=keys[0][0]+fwd0*2.5*e
        elif kind=='push':
            pos=keys[0][0]+fwd0*7*e;q=keys[0][1]
        else:
            up=np.array([0,1,0]);pos=keys[0][0]-fwd0*2*e+up*3.6*e;right=R(keys[0][1])[:,0];q=qmul(qaxis(right,-math.radians(17)*e),keys[0][1])
        ff.stdin.write(draw(P,col,pos,q,f0).tobytes())
    ff.stdin.close();ff.wait();print(out,flush=True)
if __name__=='__main__':
    for nm in sys.argv[1:]:
        for kd in ('path','push','rise'):shot(nm,kd)
