import json, math
M_LAT=110574.0
def enu(lat0,lon0,x,north): return [round(lat0+north/M_LAT,6), round(lon0+x/(111320*math.cos(math.radians(lat0))),6)]
T0=(43.7541667,-110.6235)
def teton(x,z): return enu(T0[0],T0[1],x,-z)
W=[]
def world(**k): W.append(k)
st={'overlook':(-14.8,.8),'switchback':(-40,-157),'ford':(-236.5,-46.5),'oxbow':(-504.5,106.5),'plaza':(-772.5,-19.5)}
pump=(13.22461,38.10454)
def ahiya(x,z):
    dx,dz=x+1460,z-760; a=math.radians(10); ex=dx*math.cos(a)-dz*math.sin(a); nz=dx*math.sin(a)+dz*math.cos(a); return enu(pump[0],pump[1],ex,-nz)
sets={'Basalt Pump':(-1460,760),'Cross-Beacon Watch':(-1610,590),'Hill Archive':(-1765,540),'Daylight Compound':(-1680,775)}
world(id='donkey-water', title='Donkey Water 2086 · Night Post', kind='montage', entry='../night-post/index.html?circuit=ahiya&demo=ahiya',
  note='One walkable world stitched from real places at invented offsets: the Teton frame is real metres; Ahiya (Simien) is pasted 1.6 km west; the Abyss is procedural; Half Dome is mirrored in at x 620.',
  pieces=[
   {'id':'np-west','title':'Western Basin (Grand Teton frame)','geo':'real','landmarks':[{'name':n.title(),'local':list(v),'latlon':teton(*v)} for n,v in st.items()]},
   {'id':'np-ahiya','title':'Ahiya Highlands (Simien)','geo':'real','approx':True,'landmarks':[{'name':n,'local':list(v),'latlon':ahiya(*v)} for n,v in sets.items()]},
   {'id':'np-abyss','title':'Abyssal Whale Fluke Sanctuary','geo':'fictional','landmarks':[{'name':'Whale Fluke Cistern','local':[-1064,-18.5]}]},
   {'id':'np-ridge','title':'Half Dome (mirrored in)','geo':'real','approx':True,'landmarks':[{'name':'Half Dome East Apron','local':[428,43],'latlon':[37.746,-119.5675]}]}],
  seams=[{'a':[13.22461,38.10454],'b':teton(-772.5,-19.5),'label':'Ahiya pump ↔ Pueblo plaza: 0.7 km walk in the game, 13,000 km on Earth'},
         {'a':teton(428,43),'b':[37.746,-119.5675],'label':'Half Dome sits 440 m east of the Teton overlook in the game'}])
mv={'Snake River Overlook':(-46.3,1.4),'Moraine Switchback':(-48,-168),'Silver Ford':(-246,-54.8),'North Cottonwood Oxbow':(-518,94),'Far-Bank Sage Terrace':(-790,-35)}
world(id='monolith-3', title='MONOLITH-3 · Grand Teton expedition', kind='real', entry='../MONOLITH-3.html', source='USGS 3DEP, NHD', landmarks=[{'name':n,'local':list(v),'latlon':teton(*v)} for n,v in mv.items()])
zz={'Overlook Rim':(-45,1.4),'Moraine':(-22,-52),'Bluff':(-48,-168),'Sage Bench':(-162,-112),'Silver Ford':(-248,-55),'Oxbow':(-518,94)}
world(id='zones', title='THRESHOLD · zones', kind='real', entry='../zones/index.html', landmarks=[{'name':n,'local':list(v),'latlon':teton(*v)} for n,v in zz.items()])
world(id='half-dome', title='MONOLITH · Half Dome survey', kind='real', entry='../MONOLITH.html', landmarks=[{'name':'Half Dome survey centre','latlon':[37.746,-119.5675]}])
world(id='field-plates', title='Field plates · three assignments', kind='real', entry='../field-plates/index.html',
  landmarks=[{'name':'Half Dome plate','latlon':[37.746,-119.5675]},{'name':'Yosemite Valley plate','latlon':[37.71491,-119.67691]},{'name':'Teton plate','latlon':[T0[0],T0[1]]}])
world(id='pack-donkey', title='Pack Donkey', kind='fictional', anchor_note='named for Tuolumne Meadows; terrain is procedural', entry='../donkey/index.html',
  landmarks=[{'name':'Tuolumne Meadow (named)','latlon':[37.8735,-119.3593],'approx':True}])
m=json.load(open('ethiopia-highlands/terrain-pack/manifest.json')); tiles=[]
for rid in m['regionOrder']:
    r=m['regions'][rid]; b=r['bounds']; span=r['worldSpanM']
    ll=lambda x,z:[round(b['latNorth']-(z/span+.5)*(b['latNorth']-b['latSouth']),6),round(b['lonWest']+(x/span+.5)*(b['lonEast']-b['lonWest']),6)]
    lms=[]; trail=[]
    for k,l in r['landmarks'].items():
        if isinstance(l,dict) and 'x' in l and 'z' in l: lms.append({'name':l.get('label',k),'local':[l['x'],l['z']],'latlon':ll(l['x'],l['z'])})
        elif isinstance(l,list): trail=[ll(p['x'],p['z']) for p in l if isinstance(p,dict)]
    tiles.append({'id':rid,'title':r['name'],'bbox':[b['latSouth'],b['lonWest'],b['latNorth'],b['lonEast']],'dem':'../ethiopia-highlands/terrain-pack/'+r['files']['dem16Bin'],'grid':r['gridSize'],'elev':[r['minElevM'],r['maxElevM']],'entry':'../ethiopia-highlands/index.html?region='+rid,'landmarks':lms,'trail':trail})
world(id='ethiopia-highlands', title='Ethiopia highlands · real-DEM tiles', kind='real', entry='../ethiopia-highlands/index.html', source='AWS Terrarium z11-13', tiles=tiles)
orb=json.load(open('abyssinian-highlands/orbital/orbital_manifest.json'))
places={'Lake Tana':(12.0,37.3),'Ras Dashen':(13.2417,38.37),'Gheralta':(13.9722,39.4286),'Lalibela':(12.0317,39.0417),'Aksum':(14.13,38.72),'Addis Ababa':(9.03,38.74),'GERD':(11.2153,35.0931),'Abay gorge':(10.075,38.1917),'Imet Gogo':(13.2167,38.0833),'Rift':(8.6,39.45),'Afar':(12.0,41.0)}
world(id='abyssinian-roof', title='Abyssinian highlands · roof of Africa', kind='real', entry='../abyssinian-highlands/roof.html',
  region_dem={'url':'../abyssinian-highlands/orbital/orbital_dem16.bin','w':orb['width'],'h':orb['height'],'bbox':[orb['latSouth'],orb['lonWest'],orb['latNorth'],orb['lonEast']],'elev':[orb['minElevM'],orb['maxElevM']]},
  landmarks=[{'name':n,'latlon':list(v)} for n,v in places.items()])
world(id='abyssinian-transect', title='Abyssinian transect (four zones)', kind='composite', entry='../abyssinian-highlands/index.html', anchor_note='compressed 860 m transect; its gorge zone is GERD', landmarks=[{'name':'Gorge / GERD zone','latlon':[11.2153,35.0931]}])
he=[('Entoto',9.1083,38.8194,0,-6400),('Addis (Meskel Sq)',9.0106,38.7613,0,-3600),('Abay crossing',10.0758,38.1914,0,-500),('Lalibela (Biete Ghiorgis)',12.0316,39.0411,0,2800),('Ras Dashen',13.2369,38.3731,0,6400)]
world(id='highland-exposure', title='Highland Exposure · Entoto to Simien corridor', kind='composite', entry='../highland-exposure/index.html', compression='about 40:1 along the corridor',
  landmarks=[{'name':n,'local':[x,z],'latlon':[a,o]} for n,a,o,x,z in he], route=[[a,o] for n,a,o,x,z in he])
sc={'Entoto':(5.5,-6275),'Addis':(0,-3610),'Abay bridge':(0,-548),'Roha':(-48,2400),'Simien':(0,6188)}
hel={'Entoto':(9.1083,38.8194),'Addis':(9.0106,38.7613),'Abay bridge':(10.0758,38.1914),'Roha':(12.0316,39.0411),'Simien':(13.2369,38.3731)}
world(id='scion-demiurge', title='Scion Demiurge · crucible corridor', kind='composite', entry='../scion-demiurge/index.html', anchor_note='same corridor as Highland Exposure; anchors differ (Entoto z -6275 vs -6400; Roha 2400 vs 2800)',
  landmarks=[{'name':n,'local':list(v),'latlon':list(hel[n])} for n,v in sc.items()])
world(id='city-island', title='WYGWYL island · six places in one', kind='composite', entry='../city/island/index.html', anchor_note='each region is a real place rotated and scaled into one island',
  landmarks=[{'name':'Baltimere · Mount Vernon','latlon':[39.3002,-76.6163]},{'name':'Atlantis · Centro CDMX','latlon':[19.434,-99.1395]},{'name':'Chapel · Holland Island','latlon':[38.11984,-76.08713]},
             {'name':'Nevermore · Assateague','latlon':[38.06,-75.18],'approx':True},{'name':'Field · Teotihuacan','latlon':[19.6925,-98.8438],'approx':True},{'name':'Pass · Tres Marías','latlon':[19.05,-99.24],'approx':True}])
world(id='city-maps', title='City3D · Baltimore', kind='composite', entry='../city/maps/index.html', landmarks=[{'name':'City3D nominal centre','latlon':[39.29,-76.61]}])
world(id='atlantis', title='Atlantis rings', kind='fictional', entry='../city/atlantis/index.html', anchor_note='anchored to Centro CDMX through the island', landmarks=[{'name':'Atlantis (via Centro CDMX)','latlon':[19.434,-99.1395],'approx':True}])
world(id='nolli-block', title='Nolli block', kind='fictional', entry='../city/index.html', anchor_note='a single block with cartridge skins; no place', landmarks=[])
json.dump({'schema':1,'note':'Every world registered once. latlon is WGS84. approx marks values derived here, not read from the world.','worlds':W},open('atlas/worlds.json','w'),ensure_ascii=False,indent=1)
n=sum(len(w.get('landmarks',[]))+sum(len(p['landmarks']) for p in w.get('pieces',[]))+sum(len(t['landmarks']) for t in w.get('tiles',[])) for w in W)
print(len(W),'worlds',n,'landmarks')
