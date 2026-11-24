import json,re,difflib,subprocess,numpy as np
from faster_whisper import WhisperModel
m=WhisperModel('small',device='cpu',compute_type='int8')
su=json.load(open('suite.json'));dk=json.load(open('decks.json'))
norm=lambda w:re.sub(r"[^a-z']","",w.lower())
out={}
for w in dk['world']:
    if not w['poem']:continue
    p=[q for q in su['poems'] if q['num']==w['poem']][0]
    a=subprocess.run(['ffmpeg','-v','error','-i',w['file'],'-ac','1','-ar','16000','-f','f32le','-'],capture_output=True).stdout
    a=np.frombuffer(a,np.float32)
    segs,_=m.transcribe(a,language='en',word_timestamps=True)
    rw=[(x.start,x.end,norm(x.word)) for s in segs for x in s.words if norm(x.word)]
    pw=[(x[0],x[1],norm(x[2])) for x in p['words'] if norm(x[2])]
    sm=difflib.SequenceMatcher(None,[x[2] for x in pw],[x[2] for x in rw],autojunk=False)
    anc=[]
    for b in sm.get_matching_blocks():
        for i in range(b.size):anc.append((pw[b.a+i][0],rw[b.b+i][0]))
    # monotonic, thinned to ~1 s
    anc.sort();mono=[];last=-1
    for c,r in anc:
        if r>last+.05 and (not mono or c-mono[-1][0]>=.8):mono.append((round(c,3),round(r,3)));last=r
    cover=len(anc)/max(1,len(pw))
    out[w['key']]={'sync':mono,'matched':round(cover,2),'words':len(rw)}
    print(w['key'],w['poem'],'matched',round(cover,2),'anchors',len(mono),mono[:2],mono[-2:])
json.dump(out,open('world_sync.json','w'))
