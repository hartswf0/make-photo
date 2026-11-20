#!/usr/bin/env python3
"""Bake a coarse real-DEM orbital grid (6-15N, 35-42E) from AWS Open Data Terrarium tiles (SRTM/GMTED/ETOPO1) z7.
Output: orbital_dem16.bin (uint16 LE, row-major north->south) + orbital_manifest.json"""
import io, json, math, urllib.request
import numpy as np
from PIL import Image
Z=7; N=2**Z
LAT0,LAT1,LON0,LON1=6.0,15.0,35.0,42.0
W,H=420,540  # 1/60 deg per px
def tile_xy(lat,lon):
    x=(lon+180)/360*N
    y=(1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*N
    return x,y
x0,y1=tile_xy(LAT0,LON0); x1,y0=tile_xy(LAT1,LON1)
tx0,tx1,ty0,ty1=int(x0),int(x1),int(y0),int(y1)
mos=np.zeros(((ty1-ty0+1)*256,(tx1-tx0+1)*256),np.float32)
for ty in range(ty0,ty1+1):
    for tx in range(tx0,tx1+1):
        u=f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png"
        im=np.array(Image.open(io.BytesIO(urllib.request.urlopen(u,timeout=30).read())).convert("RGB"),np.float32)
        mos[(ty-ty0)*256:(ty-ty0+1)*256,(tx-tx0)*256:(tx-tx0+1)*256]=im[...,0]*256+im[...,1]+im[...,2]/256-32768
out=np.zeros((H,W),np.float32)
for r in range(H):
    lat=LAT1-(r+0.5)/H*(LAT1-LAT0)
    _,py=tile_xy(lat,LON0); py=(py-ty0)*256-0.5
    j=int(np.clip(math.floor(py),0,mos.shape[0]-2)); fy=py-j
    for c in range(0,W,1):
        pass
    lons=LON0+(np.arange(W)+0.5)/W*(LON1-LON0)
    px=((lons+180)/360*N-tx0)*256-0.5
    i=np.clip(np.floor(px).astype(int),0,mos.shape[1]-2); fx=px-i
    a=mos[j,i]*(1-fx)+mos[j,i+1]*fx; b=mos[j+1,i]*(1-fx)+mos[j+1,i+1]*fx
    out[r]=a*(1-fy)+b*fy
mn,mx=float(out.min()),float(out.max())
u16=np.round((out-mn)/(mx-mn)*65535).astype('<u2')
u16.tofile("orbital_dem16.bin")
json.dump({"pack":"abyssinian-orbital-dem-v1","width":W,"height":H,"latSouth":LAT0,"latNorth":LAT1,"lonWest":LON0,"lonEast":LON1,
 "minElevM":round(mn,1),"maxElevM":round(mx,1),"source":"AWS Open Data Terrain Tiles (Terrarium: SRTM/GMTED/ETOPO1) z7, https://registry.opendata.aws/terrain-tiles/ ; bilinear resample to 1/60 deg grid",
 "note":"Real elevations; mesh rendering is stylized (vertical exaggeration, hillshade colouring)."},open("orbital_manifest.json","w"),indent=1)
print(mn,mx,out.shape)
