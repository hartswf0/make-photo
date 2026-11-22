import json,subprocess,os,sys
sys.path.insert(0,os.path.dirname(__file__));from wavelib import wave
S=os.path.dirname(os.path.abspath(__file__));os.chdir(S)
C=json.load(open('cues.json'));SU=json.load(open('suite.json'));W=json.load(open('world.json'))
os.makedirs('reels',exist_ok=True);out=[]
for p in SU['poems']:
  a=p['clip']['src_in'];D=p['clip']['dur']
  cs=sorted([c for c in C if c['poem']==p['num'] and os.path.exists(f"fsmeta/{c['id']}.json") and (c.get('dur') or 0)>0],key=lambda c:c['t'])
  if not cs: continue
  for c in cs:c['rel']=round(min(max(0,c['t']-a),D-1),2)
  args=['ffmpeg','-nostdin','-v','error','-y'];fl=[]
  for i,c in enumerate(cs):
    nxt=cs[i+1]['rel'] if i+1<len(cs) else D
    L=max(2.0,min(c.get('dur') or 20,nxt-c['rel']+1.5));fo=min(1.2,L/3)
    args+=['-i',f"sounds/{c['id']}.mp3"]
    fl.append(f"[{i}:a]atrim=0:{L:.2f},afade=t=in:d=0.05,afade=t=out:st={L-fo:.2f}:d={fo:.2f},adelay={int(c['rel']*1000)}:all=1,volume=0.8[a{i}]")
  fl.append(''.join(f'[a{i}]' for i in range(len(cs)))+f"amix=inputs={len(cs)}:normalize=0:dropout_transition=0,apad,atrim=0:{D:.2f},alimiter=limit=0.9[o]")
  f=f"reels/fx-{p['num']}.mp3"
  subprocess.run(args+['-filter_complex',';'.join(fl),'-map','[o]','-ac','2','-ar','44100','-b:a','96k',f],check=True)
  out.append({'num':p['num'],'file':f,'dur':D,'cues':[{'t':c['rel'],'line':c['line'],'role':c['role'],'verse':c['verse'],'id':c['id'],'title':c['title'],'author':c['author'],'license':('CC '+c['license'].upper().replace('ZERO','0')) if c.get('license') else None,'url':c['url']} for c in cs],'wave':wave(f)})
  print(p['num'],len(cs),os.path.getsize(f)//1000,'KB')
for w in W:w['thumb']=f"world/{w['key']}.jpg"
json.dump({'world':W,'sounds':out},open('decks.json','w'),separators=(',',':'))
print('decks.json',os.path.getsize('decks.json')//1000,'KB')
