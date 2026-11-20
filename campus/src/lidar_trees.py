"""Real tree positions from the 2022 LiDAR: canopy (unclassified returns well above the ground) on a 9 m grid,
skipping anything on or within 3 m of a building footprint. Writes campus/src/lidar-trees.json: flat [x, y, height_m, ...].
Usage: python lidar_trees.py <repo> <lidar.npz>"""
import sys, json, math
import numpy as np
repo, npz = sys.argv[1], sys.argv[2]; CELL, BUF = 9.0, 3.0
L = np.load(npz); x, y, z, c = L['x'], L['y'], L['z'], L['c']
d = json.load(open(repo + '/campus/westpoint.json'))
gx0, gy0 = float(x.min()), float(y.min()); nx = int((x.max() - gx0)//CELL) + 1; ny = int((y.max() - gy0)//CELL) + 1
ix = ((x - gx0)//CELL).astype(int); iy = ((y - gy0)//CELL).astype(int); cid = iy*nx + ix
gnd = c == 2; gmin = np.full(nx*ny, np.inf); np.minimum.at(gmin, cid[gnd], z[gnd])
# ground for cells without ground returns: nearest filled value along the row (good enough under dense canopy)
G = gmin.reshape(ny, nx)
for j in range(ny):
    r = G[j]; ok = np.isfinite(r)
    if ok.any(): G[j] = np.interp(np.arange(nx), np.flatnonzero(ok), r[ok])
gmin = G.ravel()
# mask points on/near buildings
near = np.zeros(len(x), bool); veg = (c == 1)
vi = np.flatnonzero(veg); vx, vy = x[vi], y[vi]
for b in d['buildings']:
    p = b['p']; xs, ys = np.array(p[0::2]), np.array(p[1::2]); cx, cy = xs.mean(), ys.mean()
    k = (vx > xs.min() - BUF) & (vx < xs.max() + BUF) & (vy > ys.min() - BUF) & (vy < ys.max() + BUF)
    if not k.any(): continue
    # grow the footprint by BUF metres about its centre, then point-in-polygon
    rad = np.hypot(xs - cx, ys - cy) + 1e-6; gxs = cx + (xs - cx)*(1 + BUF/rad); gys = cy + (ys - cy)*(1 + BUF/rad)
    px, py = vx[k], vy[k]; res = np.zeros(len(px), bool); n = len(gxs)
    for i in range(n):
        ax, ay, bx, by = gxs[i], gys[i], gxs[(i + 1) % n], gys[(i + 1) % n]
        res ^= ((ay > py) != (by > py)) & (px < (bx - ax)*(py - ay)/((by - ay) or 1e-9) + ax)
    idx = np.flatnonzero(k)[res]; near[vi[idx]] = True
h = z - gmin[cid]
tree = veg & ~near & (h > 4) & (h < 45)
cnt = np.bincount(cid[tree], minlength=nx*ny)
top = np.full(nx*ny, -1.0); np.maximum.at(top, cid[tree], h[tree])
# canopy position inside the cell: mean of its tallest third of points
sx = np.bincount(cid[tree], weights=x[tree], minlength=nx*ny); sy = np.bincount(cid[tree], weights=y[tree], minlength=nx*ny)
keep = np.flatnonzero(cnt >= 4)
out = []
for k in keep:
    out += [round(sx[k]/cnt[k], 1), round(sy[k]/cnt[k], 1), round(float(top[k]), 1)]
json.dump(out, open(repo + '/campus/src/lidar-trees.json', 'w'), separators=(',', ':'))
hs = np.array(out[2::3]); print(len(keep), 'trees; height median', round(float(np.median(hs)), 1), 'm, 90th pct', round(float(np.percentile(hs, 90)), 1))
