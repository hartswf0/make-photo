#!/usr/bin/env python3
"""Compile the run (one empty carriage, then seven door cues) from island-ecology's BEES ON A TRAIN worlds file
into data/seeds.json and data/session.json. Usage: build_run.py <worlds_synthesized.json>"""
import json,re,sys,os
HERE=os.path.dirname(os.path.abspath(__file__));W=json.load(open(sys.argv[1]))['worlds']
norm=lambda s:re.sub(r'[^a-z0-9]','',s.lower())
class Names(dict):
    def find(self,k):
        n=norm(k)
        if n in self: return self[n]
        c=[v for kk,v in self.items() if n in kk or kk in n]
        return c[0] if len(c)==1 else None
byname=Names({norm(w['name']):w for w in W})
sp=lambda s:re.sub(r'(?<=[a-z0-9])(?=[A-Z])|_',' ',s)
p=os.path.join(HERE,'..','data','seeds.json');d=json.load(open(p))
LOCK=d['run']['lock']
T="a lone traveler in a long weathered canvas duster coat and a dark felt hat, hands clasped behind his back,"
OPEN=("A playable third-person world: THE SEALED LINE. One continuous take aboard a weathered 1970s passenger train crossing ochre highlands. "
"The protagonist is a lone traveler in a long canvas duster coat and a dark felt hat. He walks the central aisle and passes through the brass-framed sliding doors between carriages. The train never stops moving. "
"Look: a lost 1970s Ethiopian western-noir on 35mm, technicolor-sepia dust, imperial gold, teal and indigo shadow, blood red, amber lamps, heavy grain. "
"No cuts, dissolves, teleporting or interface overlays: every change arrives through a door, a window or an object. "
"This first carriage is empty. Teal panelled walls, oxblood leather bench seats and small tables on both sides, amber dome lamps, brass luggage racks, large windows. No passengers, no luggage, no cups, no bees, no sound but the rails. Nothing has happened here yet.")
OLD={s['id']:s for s in d['seeds']}
def door(n,cid,idx,km,title,chapters,worlds,ref,door,scene,bees,people,deed,window,far=None):
    found=[(w,byname.find(w)) for w in worlds];miss=[w for w,f in found if not f];assert not miss,miss
    g=door+" "+scene+" Bees: "+bees+" People: "+people+" What happens to him: "+deed+" "+("Outside: "+window+" " if window else "")+LOCK
    s={"id":f"run_{n}_{cid}","run":n,"title":f"{n}. {title}","car":idx,"x":5.6,"dir":-1,"walk":3,"km":km,"shot":"follow","ref":ref,"frame":OLD.get(f"run_{n}_{cid}",{}).get('frame',''),
       "chapters":chapters,"worlds":[{"uid":f['uid'],"name":sp(f['name'])} for _,f in found],
       "door":door,"scene":scene,"bees":bees,"people":people,"deed":deed,"window":window,"genie":g,
       "events":[deed,*(["Outside the windows: "+window] if window else []),"He reaches the closed door at the far end and puts his hand on the brass handle."]}
    if far: s['far']=far
    return s
D="He slides the door open and steps through the dark gangway. The door shuts behind him. "
R=[{"id":"run_1_empty","run":1,"title":"1. The empty carriage","car":1,"x":5.6,"dir":-1,"walk":3,"km":.5,"shot":"follow","empty":True,"ref":"assets/worlds/quiet.jpg",
 "frame":"Third-person view from behind "+T+" walking away from the camera down the central aisle of a completely empty weathered railway carriage: teal panelled walls, oxblood leather bench seats with brass rails and small bare tables on both sides, arched cream ceiling with amber dome lamps, empty brass luggage racks, large windows showing a bare ochre plain. No passengers, no luggage, no bees. A closed brass-framed sliding door with a small lit window at the far end.",
 "chapters":[],"worlds":[],"door":None,"scene":"An empty carriage: seats, tables, lamps, windows, a closed door at the far end.","bees":"none.","people":"none.","deed":"nothing. He walks.","window":"a bare ochre plain.",
 "genie":OPEN+" "+LOCK,"events":["He walks the length of the empty carriage.","He reaches the closed door at the far end and puts his hand on the brass handle."]},
door(2,"dining",2,2.38,"Sealed velocity",["03 Bullet Train","04 Snowpiercer"],
 ["SmartLocker0527","QuietCarNipponSpeedline","MobileConcessionCart","FirstClassCabinPrince","AutomatedTrainLavatory","BreachedExteriorTrainDoor","MomomonMascotSuit","LovesYouLuggageStorage","ProteinBlockMachineTail","SacredEngineRoomCar1","KronoleStorageMidTrain","WaterReclamationTanksFirstClass","NightVisionGogglesArmory","ChildLaborerEngineSubfloor","GreenhouseCarEquator","ClassroomCarAnthem","TailorStationSecondClass","ViolinStringsDiningCar","ButcherStationLivestockCar","SushiAquariumFiltrationPump","DentedDoorTailBoundary","IntercomSpeakerTail","HatchetBladeArmoryCorridor","WilfordPocketWatchEngineRoom","MasonsShoeThreshold","ShatteredWindowFirstClassLounge","FrozenSeoulView","PolarBearSnowdriftCrashSite","FrozenBodyTailExterior","YekaterinaBridgeRussianFarEast","FrozenSkyscraperAvalanche","IceJamSiberianUndercarriage","PrisonDrawerNamgoongMinsu"],
 "assets/worlds/dining.jpg",D+"The next carriage is a dining car on a train that must never stop.",
 "A first-class dining car crammed with a whole sealed train's worth of rooms: linen tables where a violinist plays for diners in furs; a long sushi counter built around a bubbling aquarium; beside it a steel machine extruding black gelatin protein blocks onto a tray; a butcher's rail of hanging chickens; a tailor's station with a measuring tape; a row of school desks where children sing an anthem to a teacher at a blackboard; a wall of numbered smart lockers, one open with a silver briefcase inside; a concession cart of bottled water jammed in the aisle; a pink cartoon mascot suit slumped in a seat; steel drawers along the floor, one open with a man asleep in it; a shoe placed on a diner's head like a hat; an intercom horn barking orders; a hatchet buried in a doorframe; a brass pocket watch swinging from a lamp; a child's arm reaching up through a floor hatch to oil a gear; water tanks sweating overhead.",
 "exactly one. It walks the rim of a diner's glass, then follows him.",
 "diners in furs who eat without looking up, two men in suits fighting silently over the briefcase and shushing each other, a prim official with large glasses conducting the children, masked guards in night-vision goggles at both doors.",
 "the concession cart is shoved into his shins. One of the fighting men uses him as a shield, the other apologises in a whisper and straightens his hat. The official takes the shoe from the diner's head and sets it on his. A child hands him a protein block and waits until he bites it. The one bee stings the back of his hand; the welt stays for the rest of the journey.",
 "everything is frozen white: a city of iced skyscrapers, a trestle bridge packed with ice, a polar bear watching from a snowdrift, one upraised frozen arm beside the track. A window at the end of the car is shattered and snow blows in across the linen."),
door(3,"greenhouse",3,1.6,"Half for me, half for them",["05 Honeyland"],
 ["BekirlijaVillage","LimestoneCrevice","EditingRoomSkopje","SpiderCaves","SkopjeMarket","ArrivalOfHussein","ApiculturalMuseum","LangstrothPatent","HollowedTreeTrunk","SundanceAwards","MacedonianBeeLineage","VerbalTransaction","WinterBoundBed","ColonyCollapseThreshold","YugoslavArchive","EgyptianSunTemple","HalfForThemRule"],
 "assets/worlds/greenhouse.jpg",D+"Warm air comes out to meet him. The next carriage is a greenhouse with a mountain village growing in it.",
 "A glass-roofed carriage holding a whole hillside: on the left a limestone cliff face rises to the roof with wild honeycomb glowing in a crevice; a hollowed tree trunk hive lies across two planters; stone houses of an abandoned village the size of doll's houses sit among coffee shrubs; an old woman lies in a winter bed under quilts between the flower beds, a candle beside her; a market stall of honey jars with a brass scale; a small herd of cattle wedged in the aisle; a row of white box hives being opened too fast; painted wooden hive panels leaning against the glass; a patent drawing of a movable-frame hive pinned to a rib; a film-editing bench with strips of footage hanging like vines; a filing cabinet of agricultural decrees with moss on it; a small sandstone sun temple whose reliefs are bees; a golden trophy among the tomatoes. It is raining inside.",
 "dozens, calm, working the flowers. Half of every comb in the carriage has been left uncut.",
 "a beekeeper in a yellow blouse and green headscarf working the cliff bare-handed and singing to the bees; a loud family with seven children and a caravan chasing calves; a merchant counting money; two people filming everything from behind a planter.",
 "the beekeeper cuts a comb in two and presses half into his hand: half for him, half for them. The family's children climb him like a tree and take his hat; a calf leans its full weight against his legs. He is soaked by the indoor rain. When the neighbour takes all the honey from a box hive, the bees turn on everyone and he is stung on the cheek, which swells.",
 "the train is crossing a viaduct so high the clouds are below the glass; on a far ridge, a single lit stone house."),
door(4,"apiary",4,3.22,"The beekeepers",["01 Beekeeper"],
 ["AnisetteTerminal","FalseBottomHoneyCentrifuge","BeachAssaultLandingZone","BostonFBIFieldOffice","HighSocietyNightclubAtrium","GlobalTracingSignalInterface","WreckedTacticalHumvee","WhitePicketFenceProperty","RainyAirportTarmac","OverlookCommandPost","ConcreteStairwellExplodingDataCenter","SmolderingHiveFrame","GlassEnclosureExecutivePenthouse","OffshoreFinancialServerRack","AudioRecordingCommandDirective","RooftopHelicopterExtractionPoint","ArmoryConcealedBehindHoneyJars"],
 "assets/worlds/apiary.jpg",D+"The sound arrives before the light. The next carriage is an apiary that is also an armoury.",
 "A windowless carriage lined floor to ceiling with painted hive panels and shelves of honey jars; one shelf has swung open like a door on a wall of rifles behind the jars. A steel honey centrifuge with a false bottom stands open on a cache of passports and pistols. A white picket fence runs down one side of the aisle with a mown strip of lawn and a mailbox. A hive frame smoulders on a table, still smoking. An old computer terminal glows green with a world map of tracing lines; a rack of blinking servers drips honey; a reel-to-reel recorder plays a calm voice giving an order; a glass-walled office the size of a phone booth holds a man in a suit pounding on the glass; a nightclub's mirrored bar and dance floor fill one corner under a slow disco ball; the burned-out shell of an armoured truck is parked across the far end, its doors open; a concrete stairwell leads up into the ceiling and smoke comes down it; a helicopter searchlight sweeps through the roof vents.",
 "hundreds, flying in tight ribbons that part around him and close behind him.",
 "a retired beekeeper in a canvas jacket calmly lifting frames with bare hands; agents in windbreakers shouting into radios; clubgoers in sequins dancing as if nothing is wrong; a squad in black sliding down ropes from the roof vents; an elderly woman at the mailbox reading a bank letter and crying.",
 "an agent mistakes him for the beekeeper and handcuffs one of his wrists; the beekeeper snaps the cuff off with a hive tool without looking up, drops a veil over his hat and pushes a dripping frame into his hands. The roped squad swings through him like a door; a dancer spins him once. Honey runs down his sleeves. He is stung on both hands and does not drop the frame.",
 None,60),
door(5,"mirror",5,4.45,"The angels",["06 Wings I","07 Wings II"],
 ["VictoryColumnVantage","KaiserWilhelmMemorialRuins","StateLibraryThoughtSite","CircusAlekanThreshold","PotsdamerPlatzDeathStrip","HansaStudiosMixingDesk","PeterFalkSketchpad","AnhalterBahnhofRuins","BerlinWallGraffitiSegment","GrandHotelEsplanadeKaisersaal","ColorTimingSuite","Original35mmNegatives","NickCaveEsplanadeStage","HandkeSongOfChildhoodNotebook","UBahnTrainCarriage","PropArmorSurface","CannesFilmFestival1987"],
 "assets/worlds/mirror.jpg",D+"All colour drains away as he crosses the threshold. The next carriage is a sleeper corridor in black and white.",
 "A narrow sleeper corridor in silver monochrome. Every compartment door stands open on a different room of a divided city: a library reading room where readers sit under green lamps; a circus tent with a trapeze swinging the width of the compartment; a strip of raked sand, barbed wire and a watchtower; a recording studio mixing desk with its meters twitching; the bombed stump of a church tower; the brick arch of a ruined railway terminus; a hotel ballroom with a rock band playing on a small stage; a film laboratory where strips of negative hang drying. A long concrete wall covered in bright graffiti runs down the window side, the only colour in the carriage. A suit of plate armour stands in the corridor. A notebook lies open on the carpet, a child's handwriting moving across the page by itself. In the gilt mirror, the corridor is in colour.",
 "they have gathered into the shape of a man his height in an overcoat, who walks beside him in step and turns its head when he does.",
 "men in long dark overcoats with ponytails stand unseen behind every passenger, one hand on a shoulder, listening; the passengers' thoughts are audible as overlapping whispers. A trapeze artist with feathered wings swings out of her compartment and back. A rumpled man in a raincoat sketches faces on a pad and seems to know the angels are there.",
 "an angel lays a hand on his shoulder and for a moment he hears everyone in the carriage think at once and stops walking. The trapeze artist takes his hat on one pass and returns it on the next. The man in the raincoat hands him a paper cup of coffee: the cup is hot, and where he holds it colour returns, spreading up his sleeve until he alone is in colour. The man made of bees touches his other shoulder and he is stung a dozen times.",
 "dusk over a grey city seen from above, as if the carriage ran along rooftops; a golden winged figure on a tall column is level with the windows and watching."),
door(6,"surveillance",6,3.3,"The breach",["00 Breach","02 Surveillance"],
 ["AgriDyneBreach","Nozomi64Breach","CDCIntakeBreach","EurotunnelEMP","DavisApiaryEradication","ChannelTrainMassacre","NORADStormRecognition","SeoulStationMisdiagnosis","HiveMindStrike","SeattleKillSwitch","EvergreenProtocolTransport","LincolnTunnelFirewall","DiplomaticThreshold2017","CommercialOriginShenzhen","AcademicTestbedAtlanta","GraphicalThresholdLA","PsychoacousticChamberMaryland","MavenIntegrationVirginia","BiometricRepositoryAWS","EthicalFrameworksBerkeley","DataChokepointUtah","TopographicDeadzoneTennessee","StadiumSurveillanceAtlanta","IJCAIThresholdBuenosAires","SimulatedCampusEdinburgh","YOLOGitHubCommit","SenateVulnerabilityDC"],
 "assets/worlds/surveillance.jpg",D+"Cold blue light and static. The next carriage is a control room that has already lost control.",
 "A windowless carriage walled with CRT monitors and tape reels. The screens show a radar sweep with a storm on it that is not weather; a stadium crowd with a green box drawn on every face; a subway car full of slumped commuters; a green wireframe of a campus with tiny figures running; drone footage of a forest canopy; this corridor, from behind him, a few seconds from now. Down the middle: a long treaty table with flags and unsigned papers; a factory bench of palm-sized quadcopters, half assembled; an anechoic booth of foam wedges with one drone hovering in it; a hospital gurney under a plastic tent; a stack of white bee boxes sealed with hazard tape; a shipping container with frost on its doors; a server rack humming; a steel fire door across the far end with a keypad. A red telephone rings and nobody answers it.",
 "thousands, and not all of them are bees: among them fly drones the size of bees, with a faint red light each. They cover most of the screens like a moving skin.",
 "radar operators in headsets standing on their chairs; delegates in suits arguing across the table in several languages; an engineer typing a single line of code again and again with shaking hands; medics in hazard suits; a professor trying to give a lecture to nobody; soldiers stacking sandbags in the aisle.",
 "a green targeting box appears around his face on every screen and follows him. Medics seize him, lay him on the gurney, find the welts and let him go. A delegate pushes a pen into his hand and points at the treaty. On the monitors he trips a moment before he does: a cable takes his ankle and he goes down on one knee, and bees and drones settle across his back and shoulders. The engineer presses Enter; half the drones fall out of the air like hail; he gets up and walks on wearing the rest.",
 None,60),
door(7,"cinema",7,7.0,"The arrival of a train",["08 Heist 1855","09 Steam","10 Lumière"],
 ["GuardVanNightMail","ChubbWorkshop1850s","ChubbLockMechanism1855","WaxWorkshopApothecary1854","SmeltingFurnace1855","LondonBridgeTicketOffice1855","OldBaileyCourtroom1857","GreenManTavern1850s","ScotlandYardDesk1855","RoyalMint1850s","NewgatePrisonRegistry1855","FireboxLabor","MobilePostalArchitecture","KineticExchange","ConcentratedCorrespondence","HumanMachineInterface","GranularSocialNetwork","CinematographeTripodSite","SalonIndienGrandCafe","CrankHandleInterface","EmulsionMixingVats","WomanInPlaidCape","SteamLocomotiveDriveWheels","NitrateNegativeArchiveShelf","MélièsSeat","LuggageCart","TrainCarriageWindowThreshold","EditingSplicingBlock","BoxOfficeTill","LensGrindingWorkstation","ProjectionScreenCanvas","ChildLookingAtCamera","PlatformFloorboards","HandPaintedMoviePoster","DarkroomChemicalBath","PocketWatch","ArcLampCarbonRods","AIUpscaleServerRack","YouTubeCommentSection"],
 "assets/worlds/cinema.jpg",D+"Darkness, then a flickering beam. The next carriage is a cinema, a mail van and a strongroom at once.",
 "A railway carriage converted into a tiny gaslit cinema: rows of velvet seats, a brass hand-cranked projector on a wooden tripod, an arc lamp spitting between carbon rods, a canvas screen at the far end where a steam train arrives at a station head on. Around the seats the carriage is also a Victorian night mail: a wall of pigeonholes where sorters fling letters without looking; a net and leather pouch hung out of the side door to snatch a mail bag at speed; an open firebox roaring where a fireman shovels coal; and a guard's van, with two iron safes, their doors open, gold bars being swapped for bags of lead shot. A locksmith's bench of keys and wax impressions; a small smelting furnace pouring gold; a ticket window; a judge's bench and dock built into the back row; a tavern table of conspirators; vats of silver emulsion; shelves of film cans; a splicing block; a darkroom tray with an image coming up in it; a hand-painted poster; a luggage cart; a box-office till; a humming server rack re-drawing the film sharper than it ever was; a scroll of comments unrolling down one wall.",
 "the projector beam is solid with them; their shadows are the film.",
 "an audience in 1895 dress who flinch from the screen and laugh; a man in the third row taking notes on how it is done; a woman in a plaid cape; a child in white who turns and stares straight at the camera; top-hatted robbers working in silence; a judge in a wig; mail sorters who never stop.",
 "a robber presses a gold bar into his arms, heavy enough to bend him, and a guard immediately takes it back and gives him a bag of lead shot instead. A sorter stuffs letters into his coat pockets. The judge points at him and the whole audience turns. He is lifted off his feet and carried overhead, hand over hand, to the front row and set down before the screen, his coat more bees than cloth. The locomotive on the screen does not stop at the edge of the picture.",
 None,60),
door(8,"hive",8,6.9,"Inside the hive",["11 Bee Movie","all chapters return"],
 ["DreamWorksRenderFarm2006","AmagansettPitch2000s","AdeeHoneyFarmsMigration2007","TumblrBeeMovieScript2013","USDACCDDiscovery2006","GoldenBlossomPackaging2007","McDonaldsBeeMovieToys2007","CaliforniaBeesAsFishRuling2022"],
 "assets/worlds/beecam.jpg","He walks into the screen. It parts like a curtain of wings. There is no next carriage; there is the hive.",
 "The last carriage has the proportions of a carriage and nothing else of one: walls, arched ceiling and floor are living golden honeycomb, some cells lit from inside like windows. In the lit cells, in miniature, are the rooms he has walked through: the dining car in snow, the greenhouse cliff, the armoury behind the honey jars, the monochrome corridor, the wall of screens, the cinema. Set into the comb like fossils: flatbed trucks stacked with white bee boxes; a bottling line filling plastic honey bears; a heap of cheap plastic cartoon bee toys; rows of computers rendering a single cartoon bee, frame by frame; an endless printed script unrolling from the ceiling like flypaper; a courtroom bench where a judge's ruling declares that a bee is legally a fish, with a goldfish bowl beside the gavel; laboratory trays of dead bees with labels. Honey pools on the soft wax floor. At the far end the queen's cell glows.",
 "all of them. The air is bees; the sound is a single chord.",
 "none. The figures who sway here are bees in the shape of the passengers he has passed: the diners, the beekeeper with the half comb, the agents, the angels, the operators, the audience.",
 "he is entirely covered in bees and is no longer being stung. His steps slow in the wax. The script from the ceiling sticks to his shoulders and trails behind him. As he passes each lit cell the small room inside goes dark. He reaches the queen's cell, takes off his hat and kneels.",
 None,40),
]
d['seeds']=[s for s in d['seeds'] if 'run' not in s]+R
tot=sum(len(s['worlds']) for s in R)
d['run']={"title":"One empty carriage, then seven doors","lock":LOCK,"corpus":"island-ecology · BEES ON A TRAIN/worlds.json (228 worlds, 12 chapters)","covered":tot,
 "how":"One session. It starts in an empty carriage so there is nothing to compete with what the doors bring. Each door cue pours whole chapters of the worlds file into the next carriage as things that are physically there, with people doing something to him. Everything is described by role and object, not by the names of real people or film titles.","ids":[s['id'] for s in R]}
json.dump(d,open(p,'w'),indent=1)
first=R[0]
sess={"session":2,"name":"The Sealed Line: one empty carriage, then seven doors","note":"One world-model session. One request starts it: the empty-carriage seed and the opening prompt. Everything after is sent into the running session: W held down, and one cue each time he opens a door. The other pictures in seeds/ are references and are never sent.",
"corpus":d['run']['corpus'],"worlds_covered":tot,
"request":{"image":f"seeds/{first['id']}.jpg","size":[1280,720],"prompt":first['genie']},
"controls":{"view":"third person, locked behind him","move":"W forward down the aisle, S back, A and D to sidestep or turn","note":"Hold W. Stop at a door only long enough to send its cue."},
"cues":[{"n":s['run'],"carriage":s['title'].split('. ',1)[1],"chapters":s['chapters'],"worlds":len(s['worlds']),"when":f"as he opens door {s['run']-1}, with his hand on the handle","send":[s['genie']],"then":s['events'],"check":s['deed'],"reference":f"seeds/{s['id']}.jpg","chars":len(s['genie'])} for s in R[1:]]}
json.dump(sess,open(os.path.join(HERE,'..','data','session.json'),'w'),indent=1)
print(tot,[(s['run'],len(s['worlds']),len(s['genie'])) for s in R])

# ---- the hand-off: everything a Genie-enabled agent needs, in one file
RAW='https://raw.githubusercontent.com/hartswf0/make-photo/main/train/'
L=["# The Sealed Line: hand-off for a Genie run","",
"You are being asked to run ONE Genie 3 session and steer it with prompts sent into the running world. Do not start a new session per carriage.","",
"## The idea","",
"Bees on a Train. A man walks the length of a train in third person, video-game style. Each time he opens the door to the next carriage, a new prompt is sent, so the change of world is hidden behind the door and the dark gangway between carriages. The first carriage is empty. Each later carriage is packed with one or more chapters of a 228-world corpus (island-ecology, `BEES ON A TRAIN/worlds.json`), placed as physical things in the room, with people doing something to him. Bees go from none, to one, to all of them; the last carriage is the inside of a hive.","",
"The test is whether (a) the third-person lock and the carriage architecture survive eight rooms, (b) each door's contents visibly arrive, and (c) what happens to him leaves a mark you can see on his body.","",
"## What to do","",
"1. Start one session with the seed image and the opening prompt below. Resolution 1280 x 720.",
"2. Movement is WASD. Hold W so he walks down the aisle. Keep the view third person, behind him.",
"3. When he reaches the closed door at the far end and opens it, send that door's cue as an in-world prompt. Send it once, at the door, not earlier.",
"4. While he walks that carriage, send its follow-ups one at a time.",
"5. Before the next door, check the mark listed under 'Check' is visible on him. Record yes or no.",
"6. Repeat for all seven doors. Record the whole take as video. Do not cut.","",
"If a cue is too long for the interface, keep its first sentence (the door), the 'What happens to him' sentence and the final lock paragraph, and send the room description as a second prompt immediately after.","",
"If the session cannot run long enough for seven doors, run as many doors as fit and report where it ended. Do not restart with a new seed mid-train; if you must restart, say so.","",
"## Rules that hold for every prompt","",LOCK,"",
"## The one request","",f"Seed image: `train/seeds/{first['id']}.jpg`  ",f"{RAW}seeds/{first['id']}.jpg","","Opening prompt:","","```",first['genie'],"```","",
"Follow-ups in the empty carriage: "+" / ".join(first['events']),""]
for s in R[1:]:
    L+=[f"## Door {s['run']-1}: {s['title'].split('. ',1)[1]}","",f"Source chapters: {', '.join(s['chapters'])} ({len(s['worlds'])} worlds). Send as he opens the door.","","```",s['genie'],"```","","Follow-ups, one at a time:",""]+[f"- {e}" for e in s['events']]+["",f"Check: {s['deed']}","",f"Room and framing reference only, not an input (it predates these contents): {RAW}seeds/{s['id']}.jpg",""]
L+=["## What to report back","",
"- The video of the take, and a still from each carriage about five seconds after its door.",
"- Per door: did the new carriage arrive behind the door, or was the change visible? Did the lock hold? Which listed contents appeared? Was the mark on him visible?",
"- How far the session got, and anything that reset him, the camera or the train.",
"- The exact prompts sent if you had to shorten any.","",
"## Where this comes from","",
"- Playable 3D version and rehearsal of this run: `train/index.html?run` in make-photo (the Run button). It shows each cue as its door opens.",
"- All cues as data: `train/data/session.json`. Seeds, prompts and world lists: `train/seeds.html`.",
"- The cue text is authored in `train/tools/build_run.py`.",
"- Prompts describe by role and object. Do not add the names of real people or film titles.",""]
open(os.path.join(HERE,'..','GENIE-HANDOFF.md'),'w').write("\n".join(L))
