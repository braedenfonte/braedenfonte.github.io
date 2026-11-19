"""Sample the USGS 2022 1 m DEM (NY_SouthEast4County_A22, UTM 18N, NAVD88 meters) onto the campus map grid.
Writes campus/src/westpoint-elev-1m.json.gz (same format as the raw elev block: cols, rows, x0, y0, step, h in decimeters).
Usage: python dem_to_grid.py <dem.tif> <repo> [step_m]"""
import sys, json, gzip, math
import numpy as np, tifffile
from pyproj import Transformer
dem_paths, repo = sys.argv[1].split(','), sys.argv[2]; STEP = int(sys.argv[3]) if len(sys.argv) > 3 else 10
raw = json.load(gzip.open(repo + '/campus/src/westpoint-raw.json.gz')); lat0, lon0 = raw['lat0'], raw['lon0']
MY = math.pi/180*6378137.0; MX = MY*math.cos(math.radians(lat0))
X0, Y0, X1, Y1 = -1050, -1400, 2250, 2200   # same extent as the current map grid (keeps every overlay lined up)
cols, rows = (X1 - X0)//STEP + 1, (Y1 - Y0)//STEP + 1
xs = X0 + np.arange(cols)*STEP; ys = Y0 + np.arange(rows)*STEP
XX, YY = np.meshgrid(xs, ys); lon = lon0 + XX/MX; lat = lat0 + YY/MY
tr = Transformer.from_crs('EPSG:4326', 'EPSG:26918', always_xy=True); E, N = tr.transform(lon, lat)
val = np.zeros(XX.shape); bad = np.ones(XX.shape, bool)
for dem_path in dem_paths:   # newest survey first; later files only fill cells the earlier ones lack
    with tifffile.TiffFile(dem_path) as tf:
        tags = tf.pages[0].tags; tie = tags['ModelTiepointTag'].value; scale = tags['ModelPixelScaleTag'].value; arr = tf.pages[0].asarray()
    E0, N0, sx, sy = tie[3], tie[4], scale[0], scale[1]
    c = (E - E0)/sx - 0.5; r = (N0 - N)/sy - 0.5
    ci, ri = np.floor(c).astype(int), np.floor(r).astype(int); fc, fr = c - ci, r - ri
    H, W = arr.shape; ok = (ci >= 0) & (ri >= 0) & (ci < W - 1) & (ri < H - 1)
    ci, ri = np.clip(ci, 0, W - 2), np.clip(ri, 0, H - 2)
    a = arr[ri, ci]; b = arr[ri, ci + 1]; cc = arr[ri + 1, ci]; d = arr[ri + 1, ci + 1]
    v = a*(1 - fc)*(1 - fr) + b*fc*(1 - fr) + cc*(1 - fc)*fr + d*fc*fr
    nb = ~ok | (a < -500) | (b < -500) | (cc < -500) | (d < -500)
    take = bad & ~nb; val[take] = v[take]; bad &= nb
    print(dem_path[-40:], 'adds', int(take.sum()), 'cells; still missing', round(bad.mean(), 4)); del arr
print('coverage', round(1 - bad.mean(), 4), 'min', float(val[~bad].min()), 'max', float(val[~bad].max()))
wide = json.load(gzip.open(repo + '/campus/src/westpoint-elev-wide.json.gz'))   # outside this DEM tile: fall back to the older terrain grid
wc, wr, ws = wide['cols'], wide['rows'], wide['step']; wh = np.array(wide['h'], dtype=float).reshape(wr, wc)/10
fi = np.clip((XX - wide['x0'])/ws, 0, wc - 1.001); fj = np.clip((YY - wide['y0'])/ws, 0, wr - 1.001); i0, j0 = fi.astype(int), fj.astype(int); u, v = fi - i0, fj - j0
fill = wh[j0, i0]*(1 - u)*(1 - v) + wh[j0, i0 + 1]*u*(1 - v) + wh[j0 + 1, i0]*(1 - u)*v + wh[j0 + 1, i0 + 1]*u*v
val[bad] = fill[bad]
old = raw['elev']; print('old grid', old['cols'], old['rows'], old['step'])
out = {'cols': int(cols), 'rows': int(rows), 'x0': X0, 'y0': Y0, 'step': STEP, 'h': [int(round(v*10)) for v in val.ravel()],
       'src': 'USGS 3DEP 1 m DEM (2022 A22, then 2018 FEMA R2 D19 where 2022 has no data), sampled every %d m' % STEP}
with gzip.open(repo + '/campus/src/westpoint-elev-1m.json.gz', 'wt') as f: json.dump(out, f, separators=(',', ':'))
# cross-check against the old terrain at the old 20 m points
oh = old['h']; diffs = []
for j in range(0, old['rows'], 7):
    for i in range(0, old['cols'], 7):
        x, y = old['x0'] + i*old['step'], old['y0'] + j*old['step']; ii, jj = (x - X0)//STEP, (y - Y0)//STEP
        if 0 <= ii < cols and 0 <= jj < rows and oh[j*old['cols'] + i] > -500 and not bad[jj, ii]: diffs.append(abs(oh[j*old['cols'] + i]/10 - val[jj, ii]))
diffs.sort(); print('vs old terrain: median diff', round(diffs[len(diffs)//2], 2), 'm; 90th pct', round(diffs[int(len(diffs)*0.9)], 2), 'm over', len(diffs))
