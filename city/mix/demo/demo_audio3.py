import json,subprocess,numpy as np,wave,sys
import glob
SR=48000;FPS=24;INFO=json.load(open('demo3/nodes.json'));C0=INFO['c0'];LEN=int(np.ceil(INFO['len']))
def dec(f):
    r=subprocess.run(['ffmpeg','-v','error','-i',f,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True)
    return np.frombuffer(r.stdout,np.float32).astype(np.float64)
def fft_filter(x,lo,hi):
    X=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/SR);H=1/np.sqrt(1+(lo/np.maximum(f,1))**4)/np.sqrt(1+(f/hi)**4);return np.fft.irfft(X*H,len(x))
def conv(x,h):
    n=len(x)+len(h);N=1<<int(np.ceil(np.log2(n)));return np.fft.irfft(np.fft.rfft(x,N)*np.fft.rfft(h,N),N)[:len(x)]
mix=sorted(sum([json.load(open(f)) for f in glob.glob('demo3/mix_*.json')],[]),key=lambda m:m['f'])
nodes=INFO['nodes'];fr=np.array([m['f'] for m in mix])/FPS
dk={w['key']:w for w in json.load(open('decks.json'))['world']}
n=LEN*SR;t=np.arange(n)/SR;C=C0+t
dry=np.zeros(n);far=np.zeros(n)
for i,nd in enumerate(nodes):
    g=np.interp(t,fr,[m['m'][i]['g'] for m in mix])
    if g.max()<1e-4:continue
    src=None
    for f in nd['files']:
        s=dec(f);src=s if src is None else src[:len(s)]+s[:len(src)]
    def anch(A):
        A=np.array(A,float);x=np.interp(C,A[:,0],A[:,1]);lo=C<A[0,0];hi=C>A[-1,0];x[lo]=A[0,1]+(C[lo]-A[0,0]);x[hi]=A[-1,1]+(C[hi]-A[-1,0]);return x
    if nd.get('map'):x=anch(nd['map'])
    elif nd['kind']=='world' and nd.get('sync'):x=anch(nd['sync'])
    else:x=C
    valid=(x>=0)&(x<len(src)/SR-.01);sig=np.interp(np.clip(x*SR,0,len(src)-2),np.arange(len(src)),src)*valid*g
    (far if (nd['kind']=='world' or nd.get('far')) else dry)[:]+=sig;print(nd['key'],'peak gain',round(float(g.max()),2),file=sys.stderr)
# far away: 0.32 s late, 250–1800 Hz, a 2.4 s room (the same chain as the tool's distance bus)
d=int(.32*SR);far=np.concatenate([np.zeros(d),far[:-d]]);far=fft_filter(far,250,1800)
L=int(2.4*SR);rng=np.random.default_rng(7);ir=rng.standard_normal(L)
ir=fft_filter(ir,60,6000)*(1-np.arange(L)/L)**3;ir/=np.sqrt((ir**2).sum())
far=.25*far+.9*conv(far,ir)*3
out=dry+far
y=np.tanh(1.2*out)/np.tanh(1.2);y=y/max(1e-6,np.abs(y).max())*.93;y*=np.minimum(1,t/.05)*np.minimum(1,(LEN-t)/.6)
w=wave.open('demo3/mix.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((y*32767).astype(np.int16).tobytes());w.close();print('ok')
