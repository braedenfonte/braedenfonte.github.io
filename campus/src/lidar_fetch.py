"""Fetch the 2022 USGS LiDAR (EPT, public AWS bucket usgs-lidar-public/NY_SE4County_1_A22) for the campus area
and save points as map coordinates (x east, y north in m from lat0/lon0; z = elevation m).
Usage: python lidar_fetch.py <repo> <out.npz> [depth]"""
import sys, json, math, io, urllib.request, concurrent.futures as cf
import numpy as np, laspy
repo, out = sys.argv[1], sys.argv[2]; DEPTH = int(sys.argv[3]) if len(sys.argv) > 3 else 10
BASE = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/NY_SE4County_1_A22/'
get = lambda u: urllib.request.urlopen(BASE + u, timeout=60).read()
ept = json.loads(get('ept.json')); bx0, by0, bz0, bx1 = ept['bounds'][0], ept['bounds'][1], ept['bounds'][2], ept['bounds'][3]; W = bx1 - bx0
d = json.load(open(repo + '/campus/westpoint.json')); lat0, lon0 = d['lat0'], d['lon0']
R = 6378137.0; MY = math.pi/180*R; MX = MY*math.cos(math.radians(lat0))
xs = [v for b in d['buildings'] for v in b['p'][0::2]]; ys = [v for b in d['buildings'] for v in b['p'][1::2]]
X0, X1 = max(min(xs), -600) - 30, min(max(xs), 1400) + 30; Y0, Y1 = max(min(ys), -900) - 30, min(max(ys), 2100) + 30
def merc(x, y):
    lon = lon0 + x/MX; lat = lat0 + y/MY
    return R*math.radians(lon), R*math.log(math.tan(math.pi/4 + math.radians(lat)/2))
mx0, my0 = merc(X0, Y0); mx1, my1 = merc(X1, Y1)
print('map bbox', X0, X1, Y0, Y1, 'merc', round(mx0), round(mx1), round(my0), round(my1))
def hits(D, X, Y):
    s = W/2**D; ax, ay = bx0 + X*s, by0 + Y*s
    return ax < mx1 and ax + s > mx0 and ay < my1 and ay + s > my0
hier = {}
def load_h(key): hier.update(json.loads(get('ept-hierarchy/%s.json' % key)))
load_h('0-0-0-0')
want = []; stack = ['0-0-0-0']
while stack:
    k = stack.pop(); D, X, Y, Z = map(int, k.split('-'))
    if k not in hier or not hits(D, X, Y): continue
    if hier[k] == -1: load_h(k)
    if hier[k] > 0: want.append(k)
    if D < DEPTH:
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1): stack.append('%d-%d-%d-%d' % (D + 1, 2*X + dx, 2*Y + dy, 2*Z + dz))
print('nodes', len(want), 'points ~', sum(hier[k] for k in want))
def fetch(k):
    las = laspy.read(io.BytesIO(get('ept-data/%s.laz' % k)))
    return np.asarray(las.x), np.asarray(las.y), np.asarray(las.z), np.asarray(las.classification)
P = []
with cf.ThreadPoolExecutor(16) as ex:
    for i, r in enumerate(ex.map(fetch, want)):
        P.append(r)
        if i % 100 == 0: print('fetched', i, flush=True)
mx = np.concatenate([p[0] for p in P]); my = np.concatenate([p[1] for p in P]); z = np.concatenate([p[2] for p in P]); c = np.concatenate([p[3] for p in P])
lon = np.degrees(mx/R); lat = np.degrees(2*np.arctan(np.exp(my/R)) - math.pi/2)
x = (lon - lon0)*MX; y = (lat - lat0)*MY
k = (x > X0) & (x < X1) & (y > Y0) & (y < Y1)
np.savez_compressed(out, x=x[k].astype(np.float32), y=y[k].astype(np.float32), z=z[k].astype(np.float32), c=c[k].astype(np.uint8))
print('saved', int(k.sum()), 'points; classes', np.unique(c[k], return_counts=True))
