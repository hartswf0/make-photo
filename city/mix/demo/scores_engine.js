/* ===== performances: scores keyed to his words =====
   A score names its cast (sources, including borrowed reels and time-shifted copies of his own reading), where each starts, and cues:
   [clock, seconds, who, {values}] = from that word, glide (smoothstep) to these values over that many seconds.
   values: x, y, m (mass), r (reach), h (hue), ta (tint amount), e (echo: that node's voice, far away); ear: x, y; field: G, veil, tang.
   cast: {id, key, far (a copy whose voice is only ever distant), map ([clock, source time] anchors, slope 1 outside), txt}.
   The reading plays untouched at 1×; every score follows its clock, live and when rendered. */
const DEMO={on:false,t0:0,c0:0,c1:0,len:0};
const smo=x=>{x=clamp(x,0,1);return x*x*(3-2*x)},lerp=(a,b,u)=>a+(b-a)*u;
const DEFV={x:.5,y:.5,m:0,r:.4,h:0,ta:0,e:0};
const SCORES={
 '10':{title:'Magic Ride',c0:1.5,c1:97.4,
  cast:[{id:'R',key:'R10'},{id:'G',key:'W10ride-grey'},{id:'C',key:'W10ride-cel'},{id:'M',key:'Wmagic-ride'},{id:'F',key:'W10ride-greyfig'},{id:'S',key:'S10'},{id:'X',key:'X10'}],
  init:@@INIT10@@,
  cues:@@CUES10@@},
 '11':{title:'New Day',c0:1.5,c1:101.8,
  cast:[{id:'R',key:'R11'},{id:'A',key:'W06',map:[[20,22],[26.2,28.2],[26.25,62],[33,69],[38.8,75],[38.85,24],[60,45],[82.9,67],[82.95,30]]},{id:'D',key:'Wstreet-098',map:[[33.5,0],[53.5,20],[82.9,20.1],[82.95,4]]},
    {id:'Wt',key:'Wpoemwalk-cel020',map:[[53,48],[64,59],[79.9,61.5],[80,10]]},{id:'Sun',key:'Wprobe-spin',map:[[76,0]]},{id:'Gh',key:'R11',far:true,map:[[68,40]]},{id:'S',key:'S11'},{id:'X',key:'X11'}],
  init:{R:{x:.42,y:.4,m:.9,r:.35,h:205,ta:0},A:{x:.5,y:.12,m:0,r:.4,h:30},D:{x:.85,y:.45,m:0,r:.5,h:45},Wt:{x:.6,y:.5,m:0,r:.3},Sun:{x:.78,y:.3,m:0,r:.35,h:42},Gh:{x:.76,y:.42,m:0,r:.3,h:230,ta:.5},S:{x:.16,y:.86,m:.5},X:{x:.84,y:.86,m:.5}},
  cues:[
   // Even here is chilly in the morning · river … seas in the distance · this world is at peace
   [2.4,2,'R',{ta:.45}],[5.2,2.2,'ear',{x:.82,y:.8}],[11.8,2.2,'R',{r:.5,ta:.15}],
   // in silent resounds, choir chords … offered them back as keepsakes to the higher power: wings rise above him
   [14.3,1.8,'ear',{x:.5,y:.55}],[16.2,1.6,'R',{r:.42}],[21.4,2.6,'A',{m:.75,r:.45}],[24.2,1.4,'A',{y:.1}],
   // exhausted emotions carry forward a diminishing flame · jazz-tuned lyrics that heat and dry the morning dew
   [26.3,1.2,'A',{x:.22,y:.62,r:.35,ta:.5,h:25}],[28.3,1.8,'A',{r:.14,m:.55}],[30.0,1.5,'ear',{x:.2,y:.82}],[31.7,1.6,'R',{ta:.35,h:30}],
   // the remnants of the destruction revealed in the sunlight: the cenotaph walk
   [34.6,1.0,'A',{m:0}],[34.8,2.4,'D',{x:.64,y:.45,m:.9,r:.7}],[34.8,2.2,'R',{r:.26,ta:0}],[37.4,1.2,'D',{ta:.55}],
   // we can rebuild this temple: the frame sets into blocks · it's a new day: it softens, warm
   [39.2,.8,'field',{G:10}],[39.2,1,'A',{x:.74,y:.36,m:.9,r:.42,ta:0}],[39.2,1,'D',{x:.2,y:.42,r:.42}],[39.4,1,'R',{r:.4,x:.44,y:.46}],
   [41.5,1.4,'field',{G:1.6}],[41.6,1.4,'R',{ta:.35,h:42}],[41.6,1.4,'A',{ta:.4,h:42}],
   // the painful crawl along the cobblestone boulevard of broken dreams
   [43.0,2.2,'A',{m:0}],[43.0,2.4,'D',{x:.6,y:.5,r:.8,m:.95,ta:0}],[43.0,2.4,'R',{r:.24,ta:0}],[43,2,'ear',{x:.3,y:.75}],[49.4,.8,'field',{tang:.55}],[50.4,1.2,'field',{tang:0}],
   // I can close the chapter and open a journal … words written … a blueprint … majestic
   [51.5,1.2,'D',{m:0,r:.4}],[53.1,1.8,'Wt',{m:.85,r:.55}],[53.1,1.8,'R',{r:.32}],[59.4,1.6,'Wt',{x:.66,y:.45}],[62.8,1.4,'Wt',{r:.7,ta:.3,h:45}],[63,1.4,'R',{ta:.25}],
   // sung alone as gospels to the lonely mirror's midnight hours: his own face from earlier, far, with its voice
   [66.0,1.6,'Wt',{m:0}],[66.1,2.4,'R',{ta:.5,h:230,r:.3}],[66.1,2,'ear',{x:.5,y:.15}],[68.4,1.8,'Gh',{m:.5,r:.32}],[69.3,.8,'Gh',{e:.22}],[72.0,2.6,'Gh',{m:0,e:0}],[72.4,2.4,'R',{ta:.2}],
   // we can embrace · receive · welcome a new day: three steps of light
   [76.3,1.2,'Sun',{m:.35,r:.25}],[76.3,1.2,'R',{r:.34,ta:.35,h:200}],[78.3,1.2,'Sun',{m:.6,r:.35}],[78.3,1.2,'R',{r:.42,h:60,ta:.2}],[80.2,1.4,'Sun',{m:.85,r:.48}],[80.2,1.4,'R',{r:.52,h:42,ta:.35}],[80.2,1.6,'ear',{x:.6,y:.6}],
   // everything I've known and learned … together in this sacred place: all of it gathers round him
   [83.0,2.6,'A',{x:.18,y:.25,m:.5,r:.3,ta:.2,h:42}],[83.2,2.6,'D',{x:.2,y:.75,m:.5,r:.3,ta:.2}],[83.4,2.6,'Wt',{x:.8,y:.75,m:.5,r:.3,ta:0}],[83.0,2.4,'Sun',{x:.8,y:.25,r:.3}],[83,2.4,'R',{r:.4}],[88.4,2.4,'field',{veil:.25}],[90.5,1.6,'R',{ta:.4}],
   // reveling in the sunlight of a new beginning … at peace
   [91.6,2.6,'Sun',{x:.62,y:.38,r:.75,m:.95}],[91.6,2.6,'A',{m:0}],[91.6,2.6,'D',{m:0}],[91.6,2.6,'Wt',{m:0}],[91.6,2,'field',{veil:0}],[95.0,2.4,'R',{r:.45}],
   [98.6,2.6,'Sun',{m:0}],[98.8,1.8,'S',{m:0}],[98.8,1.8,'X',{m:0}],[100.8,1.0,'R',{m:0}]]},
 '12':{title:'Reunion',c0:1.5,c1:67.5,
  cast:[{id:'R',key:'R12'},{id:'T',key:'W12shots'},{id:'H',key:'W12'},{id:'Q',key:'R12',far:true,map:[[23,15]]},{id:'Mt',key:'W10ride-grey',map:[[47,82]]},{id:'S',key:'S12'},{id:'X',key:'X12'}],
  init:{R:{x:.42,y:.4,m:.9,r:.35,h:35},T:{x:.7,y:.45,m:0,r:.4,h:220},H:{x:.5,y:.5,m:0,r:.6,h:35},Q:{x:.25,y:.7,m:0,r:.35},Mt:{x:.6,y:.4,m:0,r:.6,h:225},S:{x:.16,y:.86,m:.5},X:{x:.84,y:.86,m:.5}},
  cues:[
   // decades later … more space for laughter: the welcome-home hall around him · hugs with no reason
   [2.4,2.4,'H',{m:.8,r:.7}],[2.4,2.4,'R',{r:.3,ta:.25}],[7.6,1.4,'ear',{x:.8,y:.8}],[9.3,1.6,'T',{m:.85,r:.5}],[9.3,1.6,'H',{r:.45}],
   // loud voices so our hearts can be overheard: the other takes of his voice, for this phrase only
   [11.9,.6,'T',{e:.4}],[11.9,.6,'H',{e:.35}],[11.9,.8,'ear',{x:.5,y:.55}],[14.6,1.4,'T',{e:0}],[14.6,1.4,'H',{e:0}],
   // my mind drifts into the darkness of our afterlives, and all those rooms are empty
   [16.2,2.4,'H',{m:0}],[16.2,2.6,'R',{m:.55,r:.28,ta:0}],[16.2,2.4,'T',{x:.62,y:.45,r:.75,ta:.55}],[16.4,2,'ear',{x:.5,y:.12}],[21.4,1.2,'T',{m:.6}],
   // we're all here: four cells, the room among them · glasses of burning sands
   [23.2,1.0,'field',{G:8}],[23.2,1.2,'R',{m:.9,x:.3,y:.32,r:.38}],[23.3,1.2,'Q',{m:.85,x:.28,y:.74,r:.38}],[23.4,1.2,'T',{x:.72,y:.3,m:.85,r:.38,ta:0}],[23.5,1.2,'H',{x:.72,y:.74,m:.8,r:.38}],[23.3,1.4,'ear',{x:.5,y:.5}],[25.6,1.0,'T',{ta:.6,h:35}],
   // grateful for every living tree … shared memories
   [27.0,2.4,'field',{G:1.6}],[28.8,2.4,'ear',{x:.82,y:.82}],[33.6,2.6,'Q',{m:0}],
   // this is brotherhood: all motion stills, three equal cells · narrow differences: they draw together
   [35.6,.7,'field',{G:6}],[35.6,.8,'R',{x:.3,y:.38,r:.36,m:.85}],[35.6,.8,'T',{x:.7,y:.38,r:.36,m:.85,ta:0}],[35.6,.8,'H',{x:.5,y:.78,r:.36,m:.85}],[35.6,1,'ear',{x:.84,y:.84}],
   [39.2,2.2,'field',{G:1.2}],[39.2,2.2,'R',{x:.42,y:.42}],[39.2,2.2,'T',{x:.58,y:.42}],[39.2,2.2,'H',{x:.5,y:.6}],[41.3,.4,'T',{e:.3}],[42.2,1.2,'T',{e:0}],
   // we can place our ears upon the next brother's soul: the ear goes from one to the next, and hears each
   [44.4,1.4,'ear',{x:.58,y:.42}],[45.0,.6,'T',{e:.28}],[46.0,1.2,'ear',{x:.5,y:.62}],[46.0,.8,'T',{e:0}],[46.2,.6,'H',{e:.25}],[47.4,1,'H',{e:0}],
   // paths of hilltops and canyons · blinding lights · infinite nights · all too familiar
   [47.2,2.4,'Mt',{m:.85,r:.75}],[47.2,2.4,'field',{veil:.5}],[47.2,2,'H',{m:0}],[47.2,2,'T',{m:.3}],[50.9,.6,'Mt',{ta:.25,h:55}],[50.9,.6,'field',{veil:.75}],[52.8,1.2,'Mt',{ta:.75,h:225}],
   [55.0,2.0,'Mt',{m:0}],[55,2,'field',{veil:0}],[55.2,2,'T',{m:.85,r:.55,ta:0}],
   // laughter and football and recollections that bring us back home every time
   [58.8,1.2,'ear',{x:.8,y:.8}],[60.2,1.6,'T',{r:.7,ta:.35,h:38}],[63.7,1.6,'H',{m:.5,r:.4}],[63.8,1.4,'R',{ta:.35,r:.4}],
   [65.4,1.6,'T',{m:0}],[65.4,1.6,'H',{m:0}],[65.6,1.4,'S',{m:0}],[65.6,1.4,'X',{m:0}],[66.4,1.0,'R',{m:0}]]},
 '13':{title:'How to Win My Heart',c0:1.5,c1:102.6,
  cast:[{id:'R',key:'R13'},{id:'Sky',key:'W06',map:[[6,3]]},{id:'Ice',key:'Wpoemwalk-cel020',map:[[9.5,25],[20,35.5],[54.5,40],[72,57.5],[72.05,30]]},
    {id:'Y',key:'R13',far:true,map:[[27.5,3]]},{id:'Aud',key:'R13',far:true,map:[[29.8,30]]},{id:'Fu',key:'R13',far:true,map:[[24.8,96.6],[97.6,97.6]]},{id:'S',key:'S13'},{id:'X',key:'X13'}],
  init:{R:{x:.42,y:.38,m:.9,r:.08,h:30},Sky:{x:.5,y:.3,m:0,r:.6,h:260},Ice:{x:.55,y:.82,m:0,r:.35},Y:{x:.2,y:.5,m:0,r:.22,h:205,ta:.5},Aud:{x:.62,y:.76,m:0,r:.3,h:30,ta:.2},Fu:{x:.86,y:.2,m:0,r:.07,h:45,ta:.25},S:{x:.16,y:.86,m:.5},X:{x:.84,y:.86,m:.5}},
  cues:[
   // I want you to notice me in a corner cafe: we see him only through a small window
   [2.9,1.0,'R',{r:.16}],[4.8,1.2,'R',{r:.12}],
   // at the Harbor of the Heavens, wandering in thought, discovering water on Jupiter's moons
   [6.5,2.4,'Sky',{m:.8,r:.7}],[6.5,2.4,'R',{r:.22}],[8.6,2,'R',{r:.3}],[10.0,1.8,'Ice',{m:.7,r:.35}],
   // healing the sick with silent prayers … every pulsing beat … after walking alone
   [12.6,1.8,'Sky',{m:0}],[12.6,1.8,'Ice',{m:0}],[13.6,1.6,'R',{r:.34,ta:.2}],[18.3,.12,'R',{r:.42}],[18.45,.3,'R',{r:.34}],[19.0,.12,'R',{r:.42}],[19.15,.3,'R',{r:.34}],[20.2,1.0,'R',{r:.2}],
   // I don't want you to really notice me · but the distance: a far window, the room at the very end of his reading
   [23.0,1.0,'R',{r:.07,m:.6}],[24.8,1.8,'Fu',{m:.75}],
   // our younger selves watching and dreaming · our elders clutch their pearls, hold their faith and breath closely, free their worries peacefully
   [27.6,1.6,'Y',{m:.55}],[29.4,1.2,'R',{r:.2,m:.8}],[30.0,1.6,'Aud',{m:.7}],
   [32.4,1.0,'R',{r:.14}],[32.4,1.0,'Aud',{r:.22}],[32.4,1.0,'Y',{r:.16}],[34.7,1.6,'R',{r:.3}],[34.7,1.6,'Aud',{r:.36}],[34.7,1.6,'Y',{r:.26}],[34.7,1.6,'field',{G:1.2}],
   // I've journeyed beyond any place you could conceivably be
   [37.4,2.4,'Sky',{m:.75,r:.8,x:.55,y:.35}],[37.4,2.4,'field',{veil:.45}],[37.6,2,'Aud',{m:0}],[37.6,2,'Y',{m:0}],[41.4,1.4,'Sky',{m:0}],[41.4,1.4,'field',{veil:0,G:1.6}],
   // life has burned all my love stories · all ends led to losses · victory-less seasons · a man that just wanted one win · I could celebrate forever
   [43.6,1.0,'R',{ta:.8,h:18,r:.36}],[43.6,1.0,'field',{tang:.55}],[43.6,1.0,'Ice',{m:.6,x:.66,y:.55,r:.35,ta:.85,h:15}],[45.4,1.6,'field',{tang:0}],[45.5,2,'Ice',{m:0}],[47.5,1.2,'R',{m:.6,ta:0}],
   [48.6,.9,'field',{G:10}],[48.6,1,'Y',{m:.6,x:.18,y:.36,r:.3,ta:.6}],[48.7,1,'Aud',{m:.6,x:.78,y:.7,r:.3,ta:.6,h:210}],[50.8,1.0,'R',{m:.95,r:.45}],[50.8,1,'Y',{m:.3}],[50.8,1,'Aud',{m:.3}],
   [51.8,1.6,'field',{G:1.6}],[51.8,1.4,'R',{ta:.4,h:45}],[52.4,1.6,'Y',{m:0}],[52.4,1.6,'Aud',{m:0}],
   // ice has frozen and thawed friendships in death and departure
   [54.8,.8,'Ice',{m:.85,x:.62,y:.5,r:.6,ta:.6,h:200}],[54.8,.6,'field',{G:12}],[54.9,1,'R',{ta:.5,h:200,r:.3}],[55.8,1.4,'field',{G:1.4}],[57.4,2,'Ice',{x:.95,m:0}],
   // I've learned to love myself more … more brilliant than the scarlet poppies and purple blossoms that time and tears have disclaimed
   [59.6,1.8,'R',{r:.45,ta:.3,h:35,m:.95}],[66.2,1.2,'R',{ta:.45,h:50}],[67.2,1.0,'Ice',{x:.7,y:.7,m:.8,r:.4,ta:.85,h:355}],[68.4,1.0,'Sky',{x:.25,y:.25,m:.7,r:.4,ta:.7,h:285}],
   [70.2,2.2,'Ice',{m:0}],[70.2,2.2,'Sky',{m:0}],[70.6,2,'R',{ta:.1}],
   // yet from a distant window, beautiful and calm, hope tells me you'll see me
   [74.8,1.4,'Fu',{m:.95,r:.1}],[76.6,1.6,'field',{G:1.2}],[76.6,1.6,'R',{r:.36}],[78.2,2.4,'Fu',{x:.74,y:.28,r:.2}],
   // and if you notice me, it captured my eyes · as you refocused yours · stepping back · letting them say hello
   [81.9,.7,'R',{r:.12}],[81.9,.5,'field',{G:8}],[83.2,1.4,'field',{G:1.6}],[83.2,1.6,'R',{r:.48}],[85.0,1.4,'R',{r:.36}],[86.0,1.6,'Fu',{x:.68,y:.42,r:.34}],
   // all the fatigue of wandering alone … windless seasons … scarlet poppies: each returns once, faint
   [88.5,2.4,'Y',{m:.3,x:.15,y:.4}],[90.8,1.6,'Sky',{m:.3,x:.2,y:.2,ta:0}],[93.4,1.4,'Ice',{m:.4,x:.8,y:.8,ta:.85,h:355}],[95.6,1.6,'Y',{m:0}],[95.6,1.6,'Sky',{m:0}],[95.6,1.6,'Ice',{m:0}],
   // won't prevent me from sharing a smile: the far window, slowed all along, reaches this moment and meets him
   [96.2,1.6,'Fu',{x:.44,y:.4,r:.4,m:.6}],[97.8,1.4,'Fu',{m:0}],[98.0,1.6,'R',{r:.5,ta:.35,h:40}],
   [100.6,1.4,'S',{m:0}],[100.6,1.4,'X',{m:0}],[101.4,1.0,'R',{m:0}]]},
 '14':{title:'Hot Minute',c0:1.5,c1:72.8,
  cast:[{id:'R',key:'R14'},{id:'Con',key:'W06',map:[[4,2]]},{id:'Door',key:'Wpoemwalk-cel020',map:[[9,34.5],[11,36.5],[65.5,34.6],[69,38]]},{id:'Ml',key:'Wmagic-ride',map:[[32.4,18]]},
    {id:'E1',key:'R14',far:true,txt:true,map:[[54.8,9.2]]},{id:'Dn',key:'R14',far:true,map:[[57,4.5]]},{id:'Dawn',key:'Wprobe-spin',map:[[61,0]]},{id:'S',key:'S14'},{id:'X',key:'X14'}],
  init:{R:{x:.42,y:.38,m:.9,r:.42,h:30},Con:{x:.5,y:.3,m:0,r:.6},Door:{x:.8,y:.45,m:0,r:.4},Ml:{x:.5,y:.4,m:0,r:.5},E1:{x:.76,y:.3,m:0,r:.22,h:210,ta:.4},Dn:{x:.7,y:.5,m:0,r:.3,h:15,ta:.2},Dawn:{x:.65,y:.35,m:0,r:.5,h:20,ta:.2},S:{x:.16,y:.86,m:.5},X:{x:.84,y:.86,m:.5}},
  cues:[
   // don't make me leave and go where promises, hearts, spectrums of light-filled constellations are broken
   [2.4,1.2,'R',{r:.5,m:1}],[5.8,1.6,'Con',{m:.8,r:.65}],[5.8,1.6,'R',{r:.34}],[6.6,1.2,'Con',{ta:.5,h:200}],[7.1,1.0,'Con',{h:300}],[8.0,.15,'field',{G:12}],
   // I escaped here for a reason: the gate shows, and closes · a sharpened key · a more grounded vibrato
   [9.4,1.2,'Con',{m:0}],[9.4,1.2,'field',{G:1.6}],[9.4,1.2,'R',{ta:.3,r:.4}],[9.5,.8,'Door',{m:.8}],[10.4,1.0,'Door',{r:.01,m:0}],
   [13.8,.3,'field',{G:6}],[14.3,1,'field',{G:1.6}],[16.5,.1,'R',{r:.46}],[16.65,.1,'R',{r:.4}],[16.8,.1,'R',{r:.46}],[16.95,.1,'R',{r:.4}],[17.1,.1,'R',{r:.45}],[17.25,.3,'R',{r:.4}],
   // the way you see things felt safe and timeless · whatever has terminated this moment · damn you
   [21.6,1.8,'R',{r:.5,ta:.35}],[25.4,.1,'field',{G:12}],[25.4,.12,'R',{r:.2,m:.55,ta:0}],[27.3,.3,'R',{ta:.65,h:0}],
   // let it feel love · and loss · as we must endure
   [29.6,.8,'R',{ta:.4,h:35,r:.36,m:.9}],[29.6,1,'field',{G:1.6}],[30.6,.8,'R',{h:215}],[31.9,1,'R',{ta:.1}],
   // absent artificial escapes and machine-learning strengths … our highs and our lows as your source material
   [33.6,1.0,'Ml',{m:.9,r:.6}],[33.6,1,'field',{tang:.7}],[37.8,.6,'Ml',{y:.2}],[38.8,.6,'Ml',{y:.8}],[40.0,1.4,'field',{tang:0}],[40.0,1.6,'Ml',{m:0}],
   // battle scars · the wisdom that brushes great tones into our melanin · disappointments and defeat · I trust that you'll be fine
   [44.6,.3,'field',{G:10}],[44.6,.4,'R',{r:.3}],[47.8,1.6,'field',{G:1.6}],[47.8,2,'R',{ta:.55,h:28,r:.42}],[51.6,1.2,'R',{m:.6}],[53.1,1.2,'R',{m:.95,r:.5,ta:.25}],
   // I escaped here for a reason, again: the first time returns, far away, with its own words
   [54.9,.8,'E1',{m:.6}],[55.0,.5,'E1',{e:.35}],[56.4,1.2,'E1',{m:0,e:0}],
   // our dance together … to entwine muses: two moments of him trade places · twisted dawns · a hot minute
   [57.3,1.0,'Dn',{m:.75,r:.32}],[57.3,5,'Dn',{x:.3,y:.6}],[57.3,5,'R',{x:.55,y:.32}],[61.2,1.2,'Dawn',{m:.85,r:.6}],[62.4,.8,'field',{tang:.5}],[62.4,1,'Dawn',{ta:.6}],[63.7,.6,'R',{ta:.8,h:12}],[63.7,.6,'Dn',{ta:.8,h:12}],
   // a genesis of a new testament · as this ends: the gate again, closing
   [65.0,1.4,'field',{tang:0,veil:.5}],[65.0,1.4,'Dn',{m:0}],[66.6,1.0,'Door',{x:.6,y:.45,m:.9,r:.6}],[66.6,1.0,'Dawn',{m:0}],[66.6,1,'field',{veil:0}],[66.6,1.2,'R',{x:.42,y:.38,ta:0}],[67.8,.9,'Door',{r:.01,m:0}],
   [69.6,1.4,'S',{m:0}],[69.6,1.4,'X',{m:0}],[71.0,1.6,'R',{m:0}]]}};
let SC=null;
function segAt(a,i,c){return lerp(a.sv[i],a[i][2],smo((c-a[i][0])/Math.max(.001,a[i][1])))}
function initOf(sc,w,q){const I=sc.init[w]||{};if(q in I)return I[q];if(w==='ear')return .5;if(w==='field')return{G:1.6,veil:0,tang:0}[q];return DEFV[q]}
function tracks(sc){if(sc.trk)return;sc.trk={};for(const cue of sc.cues)for(const[q,v]of Object.entries(cue[3])){const id=cue[2]+'.'+q;(sc.trk[id]=sc.trk[id]||[]).push([cue[0],cue[1],v])}
  for(const id in sc.trk){const a=sc.trk[id].sort((x,y)=>x[0]-y[0]),[w,q]=id.split('.'),v0=initOf(sc,w,q);a.sv=[];for(let i=0;i<a.length;i++)a.sv[i]=i?segAt(a,i-1,a[i][0]):v0}}
function val(w,q,c){const a=SC.trk[w+'.'+q];if(!a)return initOf(SC,w,q);let i=-1;for(let j=0;j<a.length;j++){if(a[j][0]<=c)i=j;else break}return i<0?a.sv[0]:segAt(a,i,c)}
const byRid=id=>NODES.find(k=>k.rid===id)||null;
function castScore(sc){tracks(sc);while(NODES.length)removeNode(NODES[0]);for(const m of sc.cast){const s=SK[m.key];if(!s)continue;const I=sc.init[m.id]||{};
    makeNode(m.key,{rid:m.id,far:!!m.far,map:m.map||null,x:I.x??.5,y:I.y??.5,level:0,route:{pic:!!s.pic,snd:!!s.snd&&s.kind!=='world'&&!m.far,txt:!!m.txt||(s.kind==='reading'&&!m.far)}})}
  ANC=byRid('R');SEL=ANC}
function applyDemo(c){FMP.G=val('field','G',c);FMP.veil=val('field','veil',c);FMP.tang=val('field','tang',c);EAR.x=val('ear','x',c);EAR.y=val('ear','y',c);EAR.drag=EAR.glide=null;EAR.vx=EAR.vy=0;
  for(const m of SC.cast){const k=byRid(m.id);if(!k)continue;const w=m.id;k.on=true;k.link=true;k.drag=null;k.vx=k.vy=0;k.x=val(w,'x',c);k.y=val(w,'y',c);k.level=val(w,'m',c);k.reach=val(w,'r',c);k.rS=k.reach;
    k.ta=val(w,'ta',c);k.hue=k.ta>.01?val(w,'h',c):null;k.col=k.hue==null?0:k.hue/360;k.echo=val(w,'e',c);k.mS=k.level*(inTake(k)?1:0);for(const d of KNOBS)k.kS[d.id]=k[d.id]}
  let best='gravity',bd=1e9;for(const m of FMODES){const T=FMT[m],d=Math.abs(Math.log(T.G/FMP.G))+Math.abs(T.veil-FMP.veil)*3+Math.abs(T.tang-FMP.tang)*3;if(d<bd){bd=d;best=m}}
  if(best!==FM){FM=best;$('fmodes').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.m===FM))}}
function startDemo(){const n=SCORES[POEM]?POEM:'10';SC=SCORES[n];POEM=n;poemUI();castScore(SC);layout();DEMO.c0=SC.c0;DEMO.c1=SC.c1;DEMO.len=SC.c1-SC.c0;applyDemo(SC.c0);$('demo').classList.add('on');
  setTimeout(()=>{const R=byRid('R');if(!R)return;ensureAC();seekD(R,SC.c0);playD(R,true);R.spd=1;DEMO.on=true;DEMO.t0=performance.now();buzz([10,40,10],true)},900)}
function stopDemo(){DEMO.on=false;$('demo').classList.remove('on');for(const k of NODES)k.echo=0;save()}
/* live: the score follows the reading's own clock, so every gesture lands on its word */
function demoTick(now){if(!DEMO.on)return;const R=byRid('R');if(!R){stopDemo();return}const c=tD(R);ANC=R;if(!playing(R))playD(R,true);
  DEMO.t0=now-(c-DEMO.c0)*1000;if(c>=DEMO.c1){stopDemo();for(const k of NODES)k.motor=0;return}applyDemo(c)}
/* offline: every source at exactly the frame's time, the same shader, and the sound mix the tool computes for that frame */
DEMO.renderAt=async function(t){OFFLINE=true;const c=DEMO.c0+t,R=byRid('R'),waits=[];ANC=R;
  for(const k of NODES){const mt=nodeTime(k,c),tt=clamp(mt,0,k.s.dur-.05);k._mt=mt;for(const e of k.els)if(!e.paused)e.pause();
    const v=k.els[0];if(Math.abs(v.currentTime-tt)>1e-3){if(k.s.video)waits.push(new Promise(r=>{const to=setTimeout(r,2500);v.addEventListener('seeked',()=>{clearTimeout(to);r()},{once:true})}));for(const e of k.els)e.currentTime=tt}}
  await Promise.all(waits);DEMO.on=true;applyDemo(c);field();drawOut();compose();const duck=duckAt(R.s,c);const mix=NODES.map(k=>({g:gainOf(k,duck),mt:k._mt}));DEMO.on=false;
  return{img:rc.toDataURL('image/jpeg',.9),mix}};
DEMO.prepare=function(w,h,poem){OFFLINE=true;SC=SCORES[poem];POEM=poem;castScore(SC);DEMO.c0=SC.c0;DEMO.c1=SC.c1;DEMO.len=SC.c1-SC.c0;sizeOut(w,h);
  return{len:DEMO.len,c0:SC.c0,nodes:NODES.map(k=>({rid:k.rid,key:k.s.key,kind:k.s.kind,files:k.s.files,far:!!k.far,map:k.map||null,sync:k.s.sync||null,speech:k.s.speech||null,dur:k.s.dur}))}};
