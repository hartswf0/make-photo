# Builds the look@1 packets from the values the survey read out of each level's own shaders (file:line in atlas/LOOKS.md).
import json
import pathlib; R=str(pathlib.Path(__file__).resolve().parents[2])+'/'
def lin(*c):   # a linear shader colour -> sRGB hex
    f=lambda x: 12.92*x if x<=.0031308 else 1.055*max(x,0)**(1/2.4)-.055
    return '#'+''.join('%02x'%max(0,min(255,round(f(v)*255))) for v in c)
def mix(a,b,t): return [a[i]+(b[i]-a[i])*t for i in range(3)]
def hx(h): h=h.lstrip('#'); return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def tohex(c): return '#'+''.join('%02x'%round(max(0,min(1,v))*255) for v in c)
def hmix(a,b,t): return tohex(mix(hx(a),hx(b),t))
SILVER=[[.07,.065,.06],[.95,.935,.90]]
CAT={  # the shared 14-look catalogue (night-post.js:1662-1677 / evalLook :2334-2428, study/look-audition-mv.js, city/shaders.js), as ramps over a silver base
 'embers':     {'grade':{'ramp':[[.02,.015,.012],[.32,.19,.10],[.70,.43,.22],[1.0,.72,.40]],'rampMix':1,'contrast':1.1}},
 'set':        {'grade':{'ramp':[[.02,.03,.04],[.33,.41,.46],[.76,.92,1.0]],'rampMix':1,'scan':.55,'contrast':1.05}},
 'cave':       {'grade':{'ramp':[[.09,.03,.16],[.46,.06,.48],[.92,.26,.10],[1.0,.86,.34]],'rampMix':1}},
 'silhouette': {'grade':{'ramp':[[.065,.05,.068],[.80,.25,.12],[.98,.82,.44]],'rampMix':1,'steps':3,'contrast':1.2}},
 'woodblock':  {'grade':{'ramp':['#181d26','#5d6d7e','#7c8690','#8e4926','#e8b282','#f6e1c9'],'rampMix':1,'steps':5,'edge':.6,'edgeColor':'#181d26'}},
 'silver':     {'grade':{'ramp':SILVER,'rampMix':1,'contrast':1.12,'grain':.026}},
 'card':       {'grade':{'ramp':[[.12,.11,.13],[.93,.90,.82]],'rampMix':1,'steps':2}},
 'spray':      {'grade':{'ramp':[[.20,.19,.18],[.54,.51,.47],[.96,.94,.89]],'rampMix':1,'steps':3,'grain':.05}},
 'watercolour':{'grade':{'ramp':[[.40,.56,.73],[.87,.71,.54],[.96,.94,.89]],'rampMix':1,'edge':.25,'edgeColor':[.40,.56,.73],'contrast':.9}},
 'cyanotype':  {'grade':{'ramp':[[.06,.23,.55],[.50,.62,.80],[.94,.97,1.0]],'rampMix':1}},
 'glass':      {'grade':{'ramp':[[0,.02,.05],[.28,.36,.44],[.80,.93,1.0]],'rampMix':1,'edge':.9,'edgeColor':[.9,.97,1.0]}},
 'risograph':  {'grade':{'ramp':['#232c74','#3d3678','#9e657e','#cf856a','#ffd996','#fcf2dc'],'rampMix':1,'steps':6,'grain':.04}},
 'inkwash':    {'grade':{'ramp':[[.10,.09,.10],[.50,.49,.47],[.95,.93,.87]],'rampMix':.62,'edge':.5,'edgeColor':[.10,.09,.10],'saturation':.35}},
 'jerikan':    {'grade':{'ramp':[SILVER[0],[.902,.882,.839]],'rampMix':1,'contrast':1.12,'cyan':1,'cyanLo':[.10,.70,.90],'cyanHi':[.20,.80,.95],'grain':.026}},
 'weave':      {'grade':{'ramp':[[.06,.09,.15],[.08,.14,.24],[.55,.40,.36],[.86,.58,.44],[.95,.88,.78]],'rampMix':1,'steps':5,'edge':.52,'edgeColor':[.06,.09,.15],'cyan':.6,'cyanLo':[.12,.82,1.0],'cyanHi':[.4,.9,1.0]}},
}
STANDARD={'note':"Teton's law, from MONOLITH-3 and Donkey Water: film() and paper() silver, the jerikan cyan mask (night-post.js:2539-2545)",
 'toning':SILVER,'grade':{'rampMix':1,'contrast':1.3,'saturation':1,'cyan':1,'cyanLo':[.10,.70,.90],'cyanHi':[.20,.80,.95],'grain':.028,'vignette':.18,'steps':0,'filter':[1,1,1]}}
json.dump({'look':1,'standard':STANDARD,'catalog':CAT},open(R+'atlas/look-catalog.json','w'),indent=1)
ALL=['jerikan','silver','embers','set','cave','silhouette','woodblock','card','spray','watercolour','cyanotype','glass','risograph','inkwash']

# ---------- Ethiopia Highlands (ethiopia-world.js :516-801, ethiopia-terrain.js :223-680) ----------
g=.36; bot,mid,top='#e6decb','#95bad8','#28568a'
fog=hmix(bot,mid,.35)
ETH={'sky':[mid,hmix(mid,bot,.5),bot,fog],   # the dome is mix(mid, top, pow(h,.58)): a portrait frame sees mostly its low band
 'fog':{'color':fog,'near':1400,'far':17000},'hemi':{'sky':mid,'ground':hmix('#7c634a','#523828',g),'i':.92-.2*g},
 'sun':{'color':hmix('#fff4df','#ff9b48',g*.78),'i':2.25+.4*g},'exposure':1.06,'aces':1,'water':{'color':'#124858','specular':'#bff5ff'},
 'grade':{'saturation':.9,'contrast':1.0,'tint':tohex(mix([1,1,1],[1.0,.97/1.10,.86/1.10],1)),'tintAmt':g*.3,'vignette':.1,'grain':.012},
 'offers':['jerikan','silver','woodblock','cyanotype','risograph','inkwash','silhouette','set'],
 'looks':{'Golden hour':{'sky':[hmix('#24558c','#28365e',.78),hmix('#8fb8dc','#d88c58',.72),hmix('#e5dfd0','#ffbe76',.85),hmix(hmix('#e5dfd0','#ffbe76',.85),hmix('#8fb8dc','#d88c58',.72),.35)],
     'sun':{'color':hmix('#fff4df','#ff9b48',.78),'i':2.65},'hemi':{'sky':hmix('#8fb8dc','#d88c58',.72),'ground':'#523828','i':.72},'grade':{'tint':'#ffe7d0','tintAmt':.55}},
   'Monsoon mist':{'fog':{'color':tohex([.85*.9,.88*.9,.91*.9]),'near':500,'far':7500},'sky':[top,mid,tohex([.85,.88,.91]),tohex([.77,.79,.82])],'grade':{'saturation':.92}}}}
TONE={'simien_imet_gogo':[[.045,.055,.07],[.44,.46,.48],[.92,.90,.86]],'gheralta_spires':[[.07,.04,.03],[.52,.37,.27],[.97,.90,.80]],
 'blue_nile_gorge':[[.06,.05,.05],[.50,.47,.42],[.94,.92,.86]],'gerd_belaya_escarpment':[[.04,.06,.05],[.40,.46,.40],[.92,.94,.88]]}
ground={'simien_imet_gogo':{'meadow':[lin(.22,.34,.15),lin(.44,.51,.40)],'rock':lin(.25,.27,.31),'sand':lin(.44,.33,.23),'snow':lin(.44,.51,.40),'snowLine':99999,'rockSlope':[.11,.38],'paint':.12},
 'gheralta_spires':{'meadow':[lin(.39,.42,.21),lin(.69,.53,.34)],'rock':lin(.58,.21,.12),'sand':lin(.81,.63,.41),'snow':lin(.81,.63,.41),'snowLine':99999,'rockSlope':[.13,.40],'paint':.12},
 'blue_nile_gorge':{'meadow':[lin(.31,.43,.19),lin(.60,.52,.26)],'rock':lin(.70,.65,.53),'sand':lin(.60,.25,.15),'snow':lin(.28,.30,.34),'snowLine':900,'rockSlope':[.16,.48],'paint':.12},
 'gerd_belaya_escarpment':{'meadow':[lin(.16,.35,.15),lin(.62,.53,.24)],'rock':lin(.52,.37,.23),'sand':lin(.42,.30,.19),'snow':lin(.27,.45,.18),'snowLine':99999,'rockSlope':[.30,.62],'paint':.12}}
json.dump({'look':1,'source':'ethiopia-world.js:516-801, ethiopia-terrain.js:223-680, study/look-audition-mv.js:22-66','islands':{k:{**ETH,'ground':v,'toning':TONE[k],'toning_exposure':.9} for k,v in ground.items()}},open(R+'ethiopia-highlands/look.json','w'),indent=1)

# ---------- WYGWYL (island.js :87-166, :461-506, :2429; shader-suite-bar.js :52-126; shaders.js :3-205) ----------
CITY={'sky':['#08182e','#0f2c52','#2c5278','#102644'],'fog':{'color':'#102644','near':220,'far':3800},'hemi':{'sky':'#5c8cc4','ground':'#1d2430','i':1.15},'sun':{'color':'#ffbe7d','i':1.55},
 'fill':{'color':'#18b4ff','i':.32},'exposure':1.3,'aces':1,'water':{'color':'#13466e','specular':'#18b4ff'},
 'toning':[[.02,.03,.07],[.22,.30,.45],[.80,.86,.95]],'toning_exposure':1.25,'ground':{'meadow':['#2a3631','#4b5847'],'rock':'#5a5f66','sand':'#6b6a66','snow':'#6b6a66','snowLine':99999,'rockSlope':[.3,.6],'paint':.15},
 'grade':{'saturation':1.05,'contrast':1.06,'vignette':.18,'grain':.02,'cyan':.3,'cyanLo':[.12,.76,1.0],'cyanHi':[.4,.9,1.0]},
 'offers':['weave','jerikan','silver','cyanotype','woodblock','inkwash','watercolour','risograph','card','silhouette','glass','cave','set','embers','spray'],
 'looks':{'Dawn':{'sky':['#243a52','#4f7391','#d9b18b','#4f7391'],'sun':{'color':'#ffd7ad','i':2.6},'hemi':{'sky':'#4f7391','ground':'#4a453f','i':1.35},'fog':{'color':'#6a7f90','near':300,'far':3000},'fill':{'i':.15}},
   'Midday':{'sky':['#4c7294','#7ea6c4','#cbd6dc','#a9bfcc'],'sun':{'color':'#fff8ec','i':3.0},'hemi':{'sky':'#7ea6c4','ground':'#595752','i':1.65},'fog':{'color':'#a9bfcc','near':600,'far':6000},'fill':{'i':0}},
   'Blue hour':{'sky':['#0c1f38','#2c6294','#6f93b0','#2c4a6a'],'sun':{'color':'#c4daf2','i':2.0},'hemi':{'sky':'#2c6294','ground':'#333b44','i':1.25},'fog':{'color':'#2c4a6a','near':260,'far':2600}},
   'Night':{'sky':['#08111e','#162d47','#2a4158','#101c2a'],'sun':{'color':'#90b6db','i':.95},'hemi':{'sky':'#162d47','ground':'#1e252e','i':.72},'fog':{'color':'#101c2a','near':160,'far':2000},'exposure':1.0}}}
json.dump({'look':1,'source':'city/island/island.js:87-166, :461-506, :2429-2451; city/shader-suite-bar.js:52-126; city/shaders.js:3-205','islands':{'wygwyl':CITY}},open(R+'city/island/look.json','w'),indent=1)

# ---------- the trough's own islands ----------
MONO_SKY=[tohex([.10+.75*.12]*3),tohex([.55]*3),tohex([.78,.775,.76]),tohex([.70,.695,.68])]
TETON={'toning_exposure':.62,'sky':MONO_SKY,'fog':{'color':tohex([.66,.655,.64]),'near':1200,'far':16000},'hemi':{'sky':'#f2f0e9','ground':'#414140','i':1.3},'sun':{'color':'#fffaf0','i':2.0},'aces':0,
 'water':{'color':'#235f8f','specular':'#e8f4ff'},
 'exposure':.62,'grade':{**CAT['jerikan']['grade'],'contrast':1.38,'vignette':.2,'grain':.03},'offers':ALL,   # film(): gamma .44 with a toe; an Adams print is dark and steep
 'looks':{'Yellow #8':{'grade':{'filter':[1.14,1.05,.42]}},'Orange #15':{'grade':{'filter':[1.26,.88,.24]}},'Red #25':{'grade':{'filter':[1.45,.44,.18]},'sky':[tohex([.04]*3),tohex([.23]*3),tohex([.56]*3),tohex([.5]*3)]},
   'Green #58':{'grade':{'filter':[.52,1.32,.56]}},'Storm break':{'sun':{'color':'#fffaf0','i':1.2},'sky':[tohex([.10]*3),tohex([.34]*3),tohex([.62]*3),tohex([.55]*3)],'fog':{'color':tohex([.5]*3),'near':500,'far':8000}}}}
HALF={'sky':[lin(.024,.080,.193),lin(.12,.20,.33),lin(.224,.317,.457),lin(.145,.181,.221)],'fog':{'color':lin(.145,.181,.221),'near':500,'far':9000},'hemi':{'sky':'#aac4e2','ground':'#47453b','i':1.25},'sun':{'color':'#ffedd3','i':2.0},'aces':0,
 'water':{'color':lin(.09,.138,.214),'specular':lin(.67,.75,.83)},
 'exposure':.8,'grade':{'ramp':[[.02,.02,.02],[.48,.478,.472],[1.0,.996,.984]],'rampMix':1,'contrast':1.42,'grain':.018,'vignette':.16,'cyan':0},
 'toning':[[.02,.02,.02],[.48,.478,.472],[1.0,.996,.984]],'toning_exposure':.8,'offers':['silver','cyanotype','inkwash','card'],
 'looks':{'Yellow #8':{'grade':{'filter':[.96,.86,.42]}},'Orange #21':{'grade':{'filter':[.92,.60,.055]}},'Red #25':{'grade':{'filter':[.91,.13,.018]}},'Green #58':{'grade':{'filter':[.13,.91,.16]}},'Zone system':{'grade':{'steps':11}}}}
noon=dict(haze=[.655,.735,.77],zen=[.195,.444,.627],amb=[.60,.64,.70],dirc=[.52,.48,.39])
def he(p,i=1.0,far=17000): return {'sky':[tohex(p['zen']),tohex(mix(p['zen'],p['haze'],.55)),tohex(p['haze']),tohex(p['haze'])],'fog':{'color':tohex(p['haze']),'near':1200,'far':far},'hemi':{'sky':tohex(p['amb']),'ground':tohex([v*.55 for v in p['amb']]),'i':1.0*i},'sun':{'color':tohex([min(1,v/max(p['dirc'])) for v in p['dirc']]),'i':1.7*i*max(p['dirc'])/.52}}
CORR={**he(noon),'aces':0,'water':{'color':tohex([.18,.32,.30]),'specular':'#cfe0dc'},
 'ground':{'meadow':['#41583b','#97864d'],'rock':'#736c5b','sand':'#b19967','snow':'#717266','snowLine':2400,'rockSlope':[.13,.48],'paint':.2},
 'toning':[[.06,.06,.04],[.48,.46,.36],[.93,.91,.83]],'toning_exposure':.85,'grade':{'saturation':.9,'contrast':1.02,'vignette':.12,'grain':.015},'offers':['silver','jerikan','cyanotype','watercolour'],
 'looks':{'Dawn':he(dict(haze=[.765,.686,.598],zen=[.281,.458,.592],amb=[.55,.57,.67],dirc=[.68,.49,.33]),.9,13000),
          'Squall':{**he(dict(haze=[.49,.565,.575],zen=[.225,.294,.327],amb=[.57,.63,.67],dirc=[.19,.19,.17]),.7,4500),'weather':{'storm':.5}},
          'Night':{**he(dict(haze=[.157,.199,.251],zen=[.032,.054,.104],amb=[.24,.296,.378],dirc=[.14,.153,.167]),.45,9000),'exposure':.8}}}
AH={**TETON,'toning_exposure':.55,'hemi':{'sky':'#f2f0e9','ground':'#3b3c39','i':1.05},'sun':{'color':'#fffaf0','i':1.6},
 'looks':{**TETON['looks'],'Night watch':{'exposure':.55,'sky':[tohex([.03]*3),tohex([.09]*3),tohex([.18]*3),tohex([.14]*3)],'fog':{'color':tohex([.14]*3),'near':300,'far':5000},'sun':{'i':.6}}}}
json.dump({'look':1,'packets':['../ethiopia-highlands/look.json','../city/island/look.json'],
 'source':'MONOLITH-3.html :1746-1776, :2360-2467, :3185-3609; night-post/night-post.js :1662-1719, :2257-2552, :6370; MONOLITH.html :5109-5114, :5240-5595, :6182-6230, :6440-6460; highland-exposure/index.html :3347-3662, :3952-3955',
 'islands':{'teton':TETON,'halfdome':HALF,'corridor':CORR,'ahiya':AH}},open(R+'atlas/looks.json','w'),indent=1)
print('ok')
