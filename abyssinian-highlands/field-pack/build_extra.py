"""Fixed-window packs: DEM-tile-exact (all real polygons whose centroid-bbox falls in tile) + exemplars."""
import json, os, datetime, build_pack as B
DEM = {  # terrain-pack bounds from abyss-world (#288)
 "dem_simien":   ([38.0670,13.2358,38.1260,13.2932], ["AM","TI"]),
 "dem_gheralta": ([39.4018,13.9461,39.4554,13.9983], ["TI"]),
 "dem_gorge":    ([38.1205,10.0049,38.2629,10.1451], ["AM","OR"]),
 "dem_gerd":     ([35.0964,11.1499,35.2476,11.2981], ["BE","AM"]),
}
EX = {
 "ex_block":    ([36.35,11.31,36.39,11.35], ["BE"], "Pawe/Metekel state-farm area (best real compact >=0.8 ha parcels found in FTW Ethiopia; elsewhere than the highland tiles)"),
 "ex_riparian": ([37.06,11.69,37.10,11.73], ["AM"], "Tana basin west shore (Gilgel Abay lowland strips); densest narrow elongated polygons in the 5 regions"),
}
def run(extra_override=None):
    out = {}
    for k,(bb,fl,*note) in list(DEM.items()) + list(EX.items()):
        info,_ = B.build(k, dict(bbox=bb, files=fl), win=bb)
        info["exemplar"] = bool(note); info["note"] = note[0] if note else "clipped to real-DEM tile bounds; all real polygons whose bbox-centre lies in the tile (no density selection)"
        out[k] = info; print(k, info["fields"], info["bytes"], info["countByShape"], flush=True)
    return out
if __name__ == "__main__":
    out = run()
    man = json.load(open("manifest.json")); stats = json.load(open("field-stats.json"))
    for k,v in out.items():
        man["regions"][k] = v; stats[k] = {x: v[x] for x in ("fields","areaHistHa","medianAreaHa","shareByShape","countByShape","meanVertices")}
    man["totalBytes"] = sum(v.get("bytes",0) for v in man["regions"].values())
    json.dump(man, open("manifest.json","w"), indent=1); json.dump(stats, open("field-stats.json","w"), indent=1)
    print("total", man["totalBytes"])
