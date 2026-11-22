import numpy as np,subprocess,base64
def wave(path,rate=20,sr=16000):
  a=np.frombuffer(subprocess.run(['ffmpeg','-nostdin','-v','error','-i',path,'-ac','1','-ar',str(sr),'-f','s16le','-'],capture_output=True).stdout,dtype=np.int16).astype(np.float32)/32768
  hop=sr//rate;win=1024;f=np.fft.rfftfreq(win,1/sr);bl=f<250;bm=(f>=250)&(f<2500);bh=f>=2500;han=np.hanning(win);L=[];M=[];H=[]
  for i in range(len(a)//hop):
    seg=a[i*hop:i*hop+win]
    if len(seg)<win:seg=np.pad(seg,(0,win-len(seg)))
    sp=np.abs(np.fft.rfft(seg*han))**2;L.append(sp[bl].sum());M.append(sp[bm].sum());H.append(sp[bh].sum())
  e=lambda v,g:np.log1p(np.sqrt(np.array(v))*g)
  l,m,h=e(L,1),e(M,1),e(H,3);mx=max(l.max(),m.max(),h.max(),1e-6)
  q=lambda v:base64.b64encode(np.clip(v/mx*255,0,255).astype(np.uint8).tobytes()).decode()
  return {'rate':rate,'lo':q(l),'mid':q(m),'hi':q(h)}
def cuts(path,th=.3):
  o=subprocess.run(['ffmpeg','-nostdin','-hide_banner','-i',path,'-vf',f"scale=160:-2,select='gt(scene,{th})',metadata=print:file=-",'-an','-f','null','-'],capture_output=True,text=True).stdout
  import re;c=[float(x) for x in re.findall(r'pts_time:([\d.]+)',o)];r=[]
  for x in c:
    if not r or x-r[-1]>1.0:r.append(round(x,2))
  return r
