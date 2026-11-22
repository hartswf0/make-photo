import json,sys
from faster_whisper import WhisperModel
m=WhisperModel("small.en",device="cpu",compute_type="int8",cpu_threads=4)
import wave,numpy as np
w=wave.open(sys.argv[1]);a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
segs,info=m.transcribe(a,word_timestamps=True,vad_filter=True,beam_size=5,condition_on_previous_text=False)
out=[]
for s in segs:
    out.append({"s":round(s.start,2),"e":round(s.end,2),"text":s.text.strip(),"words":[[round(w.start,2),round(w.end,2),w.word.strip(),round(w.probability,2)] for w in (s.words or [])]})
    print(f"{s.start:8.2f} {s.text.strip()}",flush=True)
json.dump(out,open(sys.argv[2],'w'))
