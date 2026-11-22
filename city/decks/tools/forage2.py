import json,re,time,subprocess,urllib.request,os,sys
from concurrent.futures import ThreadPoolExecutor
S=sys.argv[1];C=json.load(open(S+'/cues.json'))
UA={'User-Agent':'Mozilla/5.0 (poem-decks research fetch)'}
def one(c):
  mp=f"{S}/fsmeta/{c['id']}.json"
  if os.path.exists(mp):return
  if c.get('preview') and os.path.exists(f"{S}/sounds/{c['id']}.mp3"):
    json.dump({k:c.get(k) for k in('preview','license','dur')},open(mp,'w'));return
  t0=time.time()
  try:
    h=urllib.request.urlopen(urllib.request.Request(c['url'],headers=UA),timeout=40).read().decode('utf-8','ignore')
    m=re.search(r'https://cdn\.freesound\.org/previews/[^"]+-hq\.mp3',h);pre=m.group(0) if m else None
    l=re.search(r'creativecommons\.org/(licenses|publicdomain)/([a-z\-]+)/([\d.]+)',h);lic=(l.group(2)+' '+l.group(3)) if l else None
    t1=time.time();d=0
    if pre:
      raw=f"{S}/fsraw/{c['id']}.mp3";subprocess.run(['curl','-sS','-L','--retry','3','--connect-timeout','15','--max-time','60','-r','0-480000','-o',raw,pre],check=True)
      subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',raw,'-t','24','-af','afade=t=out:st=22:d=2,loudnorm=I=-18:TP=-2','-ac','1','-ar','44100','-b:a','80k',f"{S}/sounds/{c['id']}.mp3"])
      d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f"{S}/sounds/{c['id']}.mp3"],capture_output=True,text=True).stdout.strip() or 0)
    json.dump({'preview':pre,'license':lic,'dur':round(d,2)},open(mp,'w'))
    print(c['poem'],c['line'],c['id'],lic,round(d,1),f"page {t1-t0:.1f}s total {time.time()-t0:.1f}s",flush=True)
  except Exception as e:print('FAIL',c['id'],e,flush=True)
with ThreadPoolExecutor(6) as ex:list(ex.map(one,C))
for c in C:
  mp=f"{S}/fsmeta/{c['id']}.json"
  if os.path.exists(mp):c.update(json.load(open(mp)))
json.dump(C,open(S+'/cues.json','w'),indent=0);print('DONE')
