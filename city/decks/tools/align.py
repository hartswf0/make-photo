import json,re,difflib
T=json.load(open('fio/transcript.json'))
D=json.load(open('/home/user/make-photo/city/worldtext/data/poems_dossiers.json'))
norm=lambda w:re.sub(r"[^a-z0-9']","",w.lower().replace('’',"'"))
tw=[(norm(w[2]),w[0],w[1],w[2]) for s in T for w in s['words'] if norm(w[2])]
pw=[]  # (word, poem idx, line idx)
for pi,p in enumerate(D):
  for li,l in enumerate(p['lines']):
    for w in l['text'].split():
      n=norm(w)
      if n: pw.append((n,pi,li))
sm=difflib.SequenceMatcher(None,[x[0] for x in pw],[x[0] for x in tw],autojunk=False)
m=[None]*len(pw)
for a,b,n in sm.get_matching_blocks():
  for k in range(n): m[a+k]=b+k
print('matched',sum(x is not None for x in m),'of',len(pw))
# line times: first/last matched word, interpolate gaps
lines={}
for i,(w,pi,li) in enumerate(pw):
  if m[i] is None: continue
  t=tw[m[i]]
  L=lines.setdefault((pi,li),[t[1],t[2],0]);L[0]=min(L[0],t[1]);L[1]=max(L[1],t[2]);L[2]+=1
out=[]
for pi,p in enumerate(D):
  ls=[]
  for li,l in enumerate(p['lines']):
    nw=len([w for w in l['text'].split() if norm(w)])
    x=lines.get((pi,li));ls.append({'text':l['text'],'s':x[0] if x else None,'e':x[1] if x else None,'hit':(x[2]/nw if x else 0),'read_t':l['time']})
  # interpolate missing
  for k,l in enumerate(ls):
    if l['s'] is None:
      prev=next((ls[j]['e'] for j in range(k-1,-1,-1) if ls[j]['e'] is not None),None)
      nxt=next((ls[j]['s'] for j in range(k+1,len(ls)) if ls[j]['s'] is not None),None)
      l['s']=prev if prev is not None else nxt;l['e']=nxt if nxt is not None else prev;l['interp']=True
  out.append({'num':p['num'],'title':p['title'],'start':ls[0]['s'],'end':ls[-1]['e'],'lines':ls})
for p in out:
  print(p['num'],p['title'][:24].ljust(24),'%7.2f-%7.2f'%(p['start'],p['end']),'hit %.2f'%(sum(l['hit'] for l in p['lines'])/len(p['lines'])),'interp',sum(1 for l in p['lines'] if l.get('interp')))
json.dump(out,open('aligned.json','w'),indent=1)
