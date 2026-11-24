import json,subprocess,numpy as np,math,sys
SR=48000;LEN=64;FPS=24
def dec(f,tempo=None):
    af=[]
    if tempo:
        t=tempo;ch=[]
        while t<0.5: ch.append('atempo=0.5');t/=0.5
        ch.append(f'atempo={t:.6f}');af=['-af',','.join(ch)]
    r=subprocess.run(['ffmpeg','-v','error','-i',f,*af,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True)
    return np.frombuffer(r.stdout,np.float32).astype(np.float64)
def speed(t):
    if t<14:return 1
    if t<14.6:return .5+.5*math.cos(math.pi*(t-14)/.6)
    if t<15:return 0
    if t<15.5:return .5-.5*math.cos(math.pi*(t-15)/.5)
    if 27<=t<29:return 1+2.8*math.sin(4*math.pi*(t-27))
    if 50<=t<52.5:return 1-.5*math.sin(math.pi*(t-50)/2.5)
    if 62.3<=t<63.5:return .5+.5*math.cos(math.pi*(t-62.3)/1.2)
    if t>=63.5:return 0
    return 1
JUMPS=[38.6,39.2,39.8,40.4]
n=LEN*SR;t=np.arange(n)/SR
sp=np.array([speed(x) for x in np.arange(0,LEN+1,1/240)]);C240=2+np.concatenate([[0],np.cumsum(sp)[:-1]/240])
C=np.interp(t,np.arange(len(C240))/240,C240)
for u in JUMPS:C[t>=u]-=.6
# a 4 ms dip at each jump so the stutter is a cut, not a click
env=np.ones(n)
for u in JUMPS:
    d=np.abs(t-u);env*=np.clip(d/0.004,0,1)
mix=sorted(sum([json.load(open(f'demo/mix_{c}.json')) for c in (0,16,32,48)],[]),key=lambda m:m['f']);nodes=mix[0]['m'];fr=np.array([m['f'] for m in mix])/FPS
su=json.load(open('suite.json'));p10=[p for p in su['poems'] if p['num']=='10'][0];a,b=p10['speech']
out=np.zeros(n)
for i,nd in enumerate(nodes):
    g=np.interp(t,fr,[m['m'][i]['g'] for m in mix])
    if nd['kind']=='world':
        rate=nd['dur']/(b-a);src=dec(nd['files'][0],rate);x=C-a;valid=(x>=0)&(x<(b-a))
    else:
        src=None
        for f in nd['files']:
            s=dec(f);src=s if src is None else src[:len(s)]+s[:len(src)]
        x=C;valid=(x>=0)&(x<len(src)/SR)
    idx=np.clip(x*SR,0,len(src)-2);sig=np.interp(idx,np.arange(len(src)),src)*valid
    out+=sig*g;print(nd['key'],round(float(g.mean()),3),file=sys.stderr)
out*=env
y=np.tanh(1.3*out)/np.tanh(1.3);y=y/max(1e-6,np.abs(y).max())*0.93
fi=np.minimum(1,t/0.05)*np.minimum(1,(LEN-t)/0.4);y*=fi
import wave
w=wave.open('demo/mix.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((y*32767).astype(np.int16).tobytes());w.close();print('ok')
