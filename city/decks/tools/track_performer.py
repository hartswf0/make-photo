"""Find him in his own footage. For each reading clip, at 12 fps:
1. Detect up to four people (pose landmarks + an instance mask each), faces (with how open the jaw is) and a person/clothes segmentation.
2. Cut the clip into shots where the picture changes abruptly.
3. Link each shot's detections into tracks and choose his: dark clothing (his black mock-neck), size, and a jaw that moves while he reads.
   A shot with no such track is the room or the audience, and is labelled so.
4. Write his matte (white = him) as a 12 fps grey video, and a track per frame: face centre and size, shoulders, wrists, body box, jaw, shot kind.
usage: python track/track.py 01 02 ..."""
import mediapipe as mp, numpy as np, cv2, subprocess, json, sys, os
from mediapipe.tasks.python import vision, BaseOptions
M='models/';FPS=12;W,H=640,360;MW,MH=320,180
def models():
    pose=vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=M+'pose_landmarker_full.task'),running_mode=vision.RunningMode.VIDEO,num_poses=4,output_segmentation_masks=True,min_pose_detection_confidence=.35,min_tracking_confidence=.35))
    face=vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=M+'face_landmarker.task'),running_mode=vision.RunningMode.VIDEO,num_faces=4,output_face_blendshapes=True,min_face_detection_confidence=.35))
    seg=vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path=M+'selfie_multiclass_256x256.tflite'),running_mode=vision.RunningMode.VIDEO,output_category_mask=True))
    emb=vision.ImageEmbedder.create_from_options(vision.ImageEmbedderOptions(base_options=BaseOptions(model_asset_path=M+'embedder.tflite'),l2_normalize=True))
    return pose,face,seg,emb
def frames(f):
    p=subprocess.Popen(['ffmpeg','-v','error','-i',f,'-vf',f'fps={FPS},scale={W}:{H}','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
    while True:
        b=p.stdout.read(W*H*3)
        if len(b)<W*H*3:break
        yield np.frombuffer(b,np.uint8).reshape(H,W,3)
def run(num):
    import pickle
    if os.environ.get('CACHE') and os.path.exists(f'track/cache_{num}.pkl'):
        d=pickle.load(open(f'track/cache_{num}.pkl','rb'));F,person,hist=d['F'],d['person'],d['hist'];masks=[[m.astype(np.float32)/255 for m in fm] for fm in d['masks']];return select(num,F,masks,person,hist)
    pose,face,seg,emb=models();F=[];masks=[];person=[];hist=[];LUT=None
    for i,im0 in enumerate(frames(f'clips/{num}.mp4')):
        # dark takes are lifted for the detectors (his clothing is still measured on the original)
        if i==0 or (i<24 and LUT is None):
            if im0.mean()<34 and i>=6:LUT=(255*(np.arange(256)/255)**(1/2.4)).astype(np.uint8)
        im=LUT[im0] if LUT is not None else im0
        ts=int(i*1000/FPS);mi=mp.Image(image_format=mp.ImageFormat.SRGB,data=np.ascontiguousarray(im))
        p=pose.detect_for_video(mi,ts);fc=face.detect_for_video(mi,ts);cat=np.squeeze(seg.segment_for_video(mi,ts).category_mask.numpy_view())
        person.append(cv2.resize((cat>0).astype(np.uint8),(MW,MH),interpolation=cv2.INTER_NEAREST))
        h=cv2.calcHist([cv2.cvtColor(im,cv2.COLOR_RGB2HSV)],[0,1],None,[16,8],[0,180,0,256]);hist.append(cv2.normalize(h,h).flatten())
        faces=[]
        for j,fl in enumerate(fc.face_landmarks):
            xs=[q.x for q in fl];ys=[q.y for q in fl];jaw=[b.score for b in fc.face_blendshapes[j] if b.category_name=='jawOpen'][0]
            faces.append({'c':[float(np.mean(xs)),float(np.mean(ys))],'r':float(max(max(xs)-min(xs),(max(ys)-min(ys))*H/W)/2),'jaw':float(jaw)})
        cands=[];fm=[]
        for j,lm in enumerate(p.pose_landmarks):
            m=np.squeeze(p.segmentation_masks[j].numpy_view());ms=cv2.resize(m,(MW,MH))
            sh=[lm[11],lm[12]];hp=[lm[23],lm[24]];x0=int(max(0,min(a.x for a in sh+hp))*W);x1=int(min(1,max(a.x for a in sh+hp))*W);y0=int(max(0,min(a.y for a in sh))*H);y1=int(min(1,max(a.y for a in hp))*H)
            tor=im0[y0:max(y0+2,y1),x0:max(x0+2,x1)];tv=float(tor.max(2).mean()) if tor.size else 99.
            nose=[lm[0].x,lm[0].y];fb=min(faces,key=lambda q:(q['c'][0]-nose[0])**2+(q['c'][1]-nose[1])**2,default=None)
            if fb and ((fb['c'][0]-nose[0])**2+(fb['c'][1]-nose[1])**2)**.5>.08:fb=None
            ys_,xs_=np.nonzero(ms>.5);area=len(xs_)/(MW*MH)
            hr=max(abs(lm[7].x-lm[8].x)*.9,.025);hx0,hx1=int(max(0,nose[0]-hr)*W),int(min(1,nose[0]+hr)*W);hy0,hy1=int(max(0,nose[1]-hr*1.6)*H),int(min(1,nose[1]+hr*1.2)*H)
            hc=im[hy0:max(hy0+2,hy1),hx0:max(hx0+2,hx1)];hh=cv2.calcHist([cv2.cvtColor(np.ascontiguousarray(hc),cv2.COLOR_RGB2HSV)],[0,1],None,[12,6],[0,180,0,256]) if hc.size else np.zeros((12,6),np.float32);hh=cv2.normalize(hh,hh).flatten()
            box=[float(xs_.min()/MW),float(ys_.min()/MH),float(xs_.max()/MW),float(ys_.max()/MH)] if len(xs_) else None
            shy=(lm[11].y+lm[12].y)/2;sw=abs(lm[11].x-lm[12].x);sz=max(sw*1.5,abs(lm[7].x-lm[8].x)*4,.06);cx,cy=nose[0],(nose[1]+shy)/2
            ex0,ex1=int(max(0,cx-sz/2)*W),int(min(1,cx+sz/2)*W);ey0,ey1=int(max(0,cy-sz*W/H/2)*H),int(min(1,cy+sz*W/H/2)*H)
            ec=np.ascontiguousarray(im[ey0:max(ey0+8,ey1),ex0:max(ex0+8,ex1)]);ev=np.array(emb.embed(mp.Image(image_format=mp.ImageFormat.SRGB,data=ec)).embeddings[0].embedding,np.float32) if ec.shape[0]>=8 and ec.shape[1]>=8 else np.zeros(1024,np.float32)
            cands.append({'ev':ev,'nose':nose,'ear':abs(lm[7].x-lm[8].x),'sh':[[lm[11].x,lm[11].y],[lm[12].x,lm[12].y]],'wr':[[lm[15].x,lm[15].y,lm[15].visibility],[lm[16].x,lm[16].y,lm[16].visibility]],'area':area,'tv':tv,'box':box,'face':fb,'hh':hh})
            fm.append(ms)
        F.append(cands);masks.append(fm)
        if i%240==0:print(num,i,flush=True)
    pickle.dump({'F':F,'masks':[[(m*255).astype(np.uint8) for m in fm] for fm in masks],'person':person,'hist':hist},open(f'track/cache_{num}.pkl','wb'))
    return select(num,F,masks,person,hist)
def select(num,F,masks,person,hist):
    n=len(F)
    # shots: abrupt changes of the colour histogram
    cuts=[0]+[i for i in range(1,n) if cv2.compareHist(hist[i-1],hist[i],cv2.HISTCMP_BHATTACHARYYA)>.32 and i-0>3]+[n]
    shots=[];cl=[cuts[0]]
    for c in cuts[1:]:
        if c-cl[-1]>=4 or c==n:cl.append(c)
    for a,b in zip(cl[:-1],cl[1:]):
        if b>a:shots.append([a,b])
    pick=[None]*n;kinds=[]
    # learn him from frames where he is unmistakable: the largest person, big in frame, in a very dark top
    ref=[]
    for i in range(n):
        if F[i]:
            c=max(F[i],key=lambda q:q['area'])
            if c['area']>.12 and c['tv']<26 and len(F[i])<=2:ref.append(c['ev'])
    eref=np.mean(ref,0) if ref else None
    if eref is not None:eref=eref/np.linalg.norm(eref)
    TH=float(os.environ.get('TH','.5'))
    for i in range(n):
        for c in F[i]:c['esim']=float(c['ev']@eref) if eref is not None else 0.
    for a,b in shots:
        best={}
        for i in range(a,b):
            def stander(c):
                b_=c['box']
                if not b_:return False
                w_=(b_[2]-b_[0])*W;h_=(b_[3]-b_[1])*H;cx_=(b_[0]+b_[2])/2
                return h_>1.7*w_ and b_[1]<.55 and .22<cx_<.82 and .015<c['area']<.12 and c['tv']<60
            st_=[c for c in F[i] if stander(c)]
            ok=[(c['esim'],j) for j,c in enumerate(F[i]) if (c['esim']>.62) or (c['tv']<48 and c['esim']>TH) or (len(st_)==1 and c is st_[0] and c['esim']>.3)]
            if ok:best[i]=max(ok)[1]
        es=[F[i][j]['esim'] for i,j in best.items()];cov=len(best)/max(1,b-a)
        allb=[max(c['esim'] for c in F[i]) for i in range(a,b) if F[i]]
        k={'a':a/FPS,'b':b/FPS,'cov_him':round(cov,3),'esim':round(float(np.median(es)),3) if es else None,'esim_any':round(float(np.median(allb)),3) if allb else None}
        # keep runs of at least five frames, so a stray match never flickers on
        keys=sorted(best);runs=[];cur=[]
        for i in keys:
            if cur and i-cur[-1]>3:runs.append(cur);cur=[]
            cur.append(i)
        if cur:runs.append(cur)
        best={i:best[i] for r in runs if len(r)>=5 for i in r};cov=len(best)/max(1,b-a);k['cov_him']=round(cov,3)
        okshot=cov>.06
        k['kind']=('room' if not any(F[i] for i in range(a,b)) else 'audience') if not okshot else ('close' if np.median([F[i][j]['area'] for i,j in best.items()])>.09 else 'room')
        if os.environ.get('DIAG'):print(num,'shot',k,flush=True)
        kinds.append(k)
        if okshot:
            last=None
            for i in range(a,b):
                if i in best:pick[i]=best[i];last=(i,best[i])
                elif last and i-last[0]<=5:pick[i]=('hold',last)
    print(num,'reference frames',len(ref),flush=True)
    # matte: his pose mask, kept to where the segmenter also sees a person, eased in time
    ff=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','gray','-s',f'{MW}x{MH}','-r',str(FPS),'-i','-','-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',f'clips/{num}-matte.mp4'],stdin=subprocess.PIPE)
    prev=np.zeros((MH,MW),np.float32);out=[];si=0
    for i in range(n):
        while si<len(shots)-1 and i>=shots[si][1]:si+=1
        if i==shots[si][0]:prev[:]=0
        src=pick[i][1] if isinstance(pick[i],tuple) else ((i,pick[i]) if pick[i] is not None else None)
        if src is not None:
            m=masks[src[0]][src[1]];pm=cv2.dilate(person[i],np.ones((5,5),np.uint8)).astype(np.float32);cur=np.clip(m*1.15,0,1)*np.maximum(pm,.35)
        else:cur=np.zeros((MH,MW),np.float32)
        prev=prev*.35+cur*.65;ff.stdin.write((cv2.GaussianBlur(prev,(0,0),1.2)*255).astype(np.uint8).tobytes())
        c=F[src[0]][src[1]] if src is not None else None
        if c:
            fr=c['face']['r'] if c['face'] else max(.02,c['ear']*.9)
            fcx=c['face']['c'] if c['face'] else c['nose']
            out.append([round(i/FPS,3),1,round(fcx[0],4),round(fcx[1],4),round(fr,4),*[round(v,3) for v in (c['box'] or [0,0,0,0])],*[round(v,3) for p_ in c['sh'] for v in p_],*[round(v,3) for p_ in c['wr'] for v in p_],round(c['face']['jaw'],3) if c['face'] else -1])
        else:out.append([round(i/FPS,3),0])
    ff.stdin.close();ff.wait()
    json.dump({'fps':FPS,'cols':['t','on','fx','fy','fr','x0','y0','x1','y1','lsx','lsy','rsx','rsy','lwx','lwy','lwv','rwx','rwy','rwv','jaw'],'shots':kinds,'f':out},open(f'track/{num}.json','w'),separators=(',',':'))
    on=sum(1 for o in out if o[1]);print(num,'frames',n,'with him',round(on/n*100),'%','shots',len(kinds),{k:sum(1 for s in kinds if s['kind']==k) for k in ('close','room','audience')},flush=True)
if __name__=='__main__':
    for a in sys.argv[1:]:run(a)
