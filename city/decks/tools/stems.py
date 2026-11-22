import json,subprocess,os,sys
S=os.path.dirname(os.path.abspath(__file__));os.chdir(S);sys.path.insert(0,S);from wavelib import wave
X=json.load(open('xsheet.json'));SU=json.load(open('suite.json'));SN={s['id']:s for s in json.load(open('xsounds.json'))}
for f in os.listdir('fsmeta'):
  i=int(f[:-5]);SN.setdefault(i,{'id':i}).update(json.load(open('fsmeta/'+f)))
C={c['id']:c for c in json.load(open('cues.json'))}
for i,s in SN.items():
  if i in C:s.setdefault('title',C[i]['title']);s.setdefault('author',C[i]['author']);s.setdefault('url',C[i]['url'])
os.makedirs('stems',exist_ok=True)
PL=[('p0','P0 MASK',False,-0.35,.9),('p1','P1–2 ACTION',False,0,1.0),('p3','P3 PROP',False,0,.8),('p4','P4 ROOM',True,0,.55),('p5','P5–6 HORIZON',True,0,.6)]
out=[]
for p in SU['poems']:
  a=p['clip']['src_in'];D=p['clip']['dur'];ls=sorted([x for x in X if x['poem']==p['num']],key=lambda x:x['t'])
  for x in ls:x['rel']=round(min(max(0,x['t']-a),D-1),2)
  stems=[]
  for j,(key,name,bed,lead,g) in enumerate(PL):
    segs=[]
    for i,x in enumerate(ls):
      sid=x['layers'][j]['id'];st=max(0,x['rel']+lead);en=ls[i+1]['rel'] if i+1<len(ls) else D
      if bed and segs and segs[-1]['id']==sid:segs[-1]['en']=en;segs[-1]['lines'].append(x['line']);continue
      segs.append({'id':sid,'st':st,'en':en,'lines':[x['line']]})
    args=['ffmpeg','-nostdin','-v','error','-y'];fl=[]
    for i,sg in enumerate(segs):
      dur=SN[sg['id']].get('dur') or 10
      L=(sg['en']-sg['st']+(1.5 if bed else 1.2)) if bed else max(1.5,min(dur,sg['en']-sg['st']+1.5))
      if i==len(segs)-1:L=min(L,D-sg['st'])
      L=max(.5,L);fi=.8 if bed else .02;fo=min(1.5 if bed else 1.0,L/3)
      args+=(['-stream_loop','-1'] if bed else [])+['-i',f"sounds/{sg['id']}.mp3"]
      fl.append(f"[{i}:a]atrim=0:{L:.2f},afade=t=in:d={fi},afade=t=out:st={L-fo:.2f}:d={fo:.2f},adelay={int(sg['st']*1000)}:all=1,volume={g}[a{i}]")
    fl.append(''.join(f'[a{i}]' for i in range(len(segs)))+f"amix=inputs={len(segs)}:normalize=0:dropout_transition=0,apad,atrim=0:{D:.2f},alimiter=limit=0.95[o]")
    f=f"stems/{p['num']}-{key}.mp3"
    subprocess.run(args+['-filter_complex',';'.join(fl),'-map','[o]','-ac','1','-ar','44100','-b:a','56k',f],check=True)
    stems.append({'key':key,'name':name,'file':f,'segs':[{'t':sg['st'],'id':sg['id'],'lines':sg['lines']} for sg in segs]})
  mix=f"/tmp/claude-0/-home-user/4f7b9986-18bb-540c-abe5-b47cddb8d17e/scratchpad/mix_{p['num']}.wav"
  subprocess.run(['ffmpeg','-nostdin','-v','error','-y']+sum([['-i',s['file']] for s in stems],[])+['-filter_complex',f"amix=inputs={len(stems)}:normalize=0[o]",'-map','[o]',mix],check=True)
  out.append({'num':p['num'],'dur':D,'stems':stems,'lines':[{'t':x['rel'],'line':x['line'],'beat':x['beat'],'verse':x['verse'],'action':x['action'],'mic':x['mic'],'layers':[{'id':l['id'],'label':l['label'],'desc':l['desc']} for l in x['layers']]} for x in ls],'wave':wave(mix)})
  os.remove(mix);print(p['num'],len(ls),[len(s['segs']) for s in stems],flush=True)
used={l['id'] for x in X for l in x['layers']}
snd={i:{'title':SN[i].get('title'),'author':SN[i].get('author'),'url':SN[i].get('url'),'license':('CC '+SN[i]['license'].upper().replace('ZERO','0')) if SN[i].get('license') else None} for i in used}
json.dump({'planes':[{'key':k,'name':n} for k,n,*_ in PL],'poems':out,'sounds':snd},open('layers.json','w'),separators=(',',':'))
print('layers.json',os.path.getsize('layers.json')//1000,'KB')
