"""One-time helper (needs Pillow + internet): widen the terrain grid east and north so the map shows the whole Hudson,
the Garrison shore and Constitution Island. Keeps every original cell; new cells come from the same public
Mapzen/AWS terrain tiles (terrarium, zoom 14). Writes campus/src/westpoint-elev-wide.json.gz, which build.py uses if present.
Usage: python campus/src/widen.py [east_m] [north_m]"""
import gzip, io, json, math, sys, urllib.request
from PIL import Image
EAST, NORTH = (int(sys.argv[1]) if len(sys.argv) > 1 else 1200), (int(sys.argv[2]) if len(sys.argv) > 2 else 800)
src = __file__.replace('widen.py', '')
d = json.load(gzip.open(src + 'westpoint-raw.json.gz')); ev = d['elev']; lat0, lon0 = d['lat0'], d['lon0']
Z, R = 14, 6378137.0; MY = math.pi/180*R; MX = MY*math.cos(math.radians(lat0))
cache = {}
def tile(x, y):
    if (x, y) not in cache:
        url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'
        cache[x, y] = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=30).read())).convert('RGB').load()
    return cache[x, y]
def height(lat, lon):   # meters, bilinear-free nearest pixel is fine at 20 m cells (z14 pixel ~7 m)
    n = 2**Z; fx = (lon + 180)/360*n*256; fy = (1 - math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n*256
    tx, ty, px, py = int(fx//256), int(fy//256), int(fx % 256), int(fy % 256); r, g, b = tile(tx, ty)[px, py]
    return r*256 + g + b/256 - 32768
def at(x, y): return height(lat0 + y/MY, lon0 + x/MX)
cols, rows, st = ev['cols'], ev['rows'], ev['step']
# check the projection against the original grid before trusting new cells
diffs = [abs(at(ev['x0'] + i*st, ev['y0'] + j*st) - ev['h'][j*cols + i]/10) for j in range(0, rows, 10) for i in range(0, cols, 10) if ev['h'][j*cols + i] > -500]
print('check vs original grid: median diff', round(sorted(diffs)[len(diffs)//2], 2), 'm over', len(diffs), 'points')
ec, nr = cols + EAST//st, rows + NORTH//st; h = []
for j in range(nr):
    for i in range(ec):
        h.append(ev['h'][j*cols + i] if (i < cols and j < rows) else round(at(ev['x0'] + i*st, ev['y0'] + j*st)*10))
out = dict(ev, cols=ec, rows=nr, h=h)
with gzip.open(src + 'westpoint-elev-wide.json.gz', 'wt') as f: json.dump(out, f, separators=(',', ':'))
print('wrote', ec, 'x', nr, 'cells; tiles fetched', len(cache))
