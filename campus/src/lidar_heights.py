"""Measure every campus building from the 2022 LiDAR: ground level, main roof height, top height, and how well
the OSM footprint lines up (best shift within +-6 m). Writes campus/src/lidar-buildings.json and prints a report.
Usage: python lidar_heights.py <repo> <campus_lidar.npz>"""
import sys, json
import numpy as np
repo, npz = sys.argv[1], sys.argv[2]
L = np.load(npz); x, y, z, c = L['x'], L['y'], L['z'], L['c']
d = json.load(open(repo + '/campus/westpoint.json'))
G = 4.0; gx0, gy0 = x.min(), y.min(); ix = ((x - gx0)//G).astype(int); iy = ((y - gy0)//G).astype(int); nx = ix.max() + 1
order = np.argsort(iy*nx + ix, kind='stable'); key = (iy*nx + ix)[order]
def pts(x0, y0, x1, y1):
    a, b = int((x0 - gx0)//G), int((x1 - gx0)//G); out = []
    for j in range(max(int((y0 - gy0)//G), 0), int((y1 - gy0)//G) + 1):
        lo, hi = np.searchsorted(key, j*nx + max(a, 0)), np.searchsorted(key, j*nx + b, 'right'); out.append(order[lo:hi])
    return np.concatenate(out) if out else np.zeros(0, int)
def inside(px, py, P):
    res = np.zeros(px.shape, bool); n = len(P)
    for i in range(n):
        (ax, ay), (bx, by) = P[i], P[(i + 1) % n]
        m = ((ay > py) != (by > py)) & (px < (bx - ax)*(py - ay)/((by - ay) or 1e-9) + ax); res ^= m
    return res
out = []; rows = []
for b in d['buildings']:
    p = b['p']; P = list(zip(p[0::2], p[1::2])); xs, ys = p[0::2], p[1::2]
    I = pts(min(xs) - 14, min(ys) - 14, max(xs) + 14, max(ys) + 14)
    if len(I) < 20: continue
    px, py, pz, pc = x[I], y[I], z[I], c[I]
    ins = inside(px, py, P); gnd = pz[(pc == 2) & ~ins]
    if len(gnd) < 5: gnd = pz[pc == 2]
    if len(gnd) < 5: continue
    g = float(np.percentile(gnd, 10))   # downhill side: where the lowest visible floor sits
    gmed = float(np.median(gnd))
    best = (-1, 0, 0)
    for dx in range(-6, 7, 2):   # footprint alignment: share of the footprint covered by raised (roof) points
        for dy in range(-6, 7, 2):
            Q = [(u + dx, v + dy) for u, v in P]; k = inside(px, py, Q); n = k.sum()
            if n < 10: continue
            f = float(((pz[k] > gmed + 2.5) & (pc[k] != 2)).mean())
            if f > best[0] + 0.02 or (abs(f - best[0]) <= 0.02 and dx*dx + dy*dy < best[1]**2 + best[2]**2): best = (f, dx, dy)
    roof = pz[ins & (pc != 2) & (pz > gmed + 2.5)]
    if len(roof) < 10 or best[0] < 0: continue
    main = float(np.median(roof)) - g; top = float(np.percentile(roof, 97)) - g
    cov0 = float(((pz[ins] > gmed + 2.5) & (pc[ins] != 2)).mean())
    r = dict(n=b.get('n', ''), cx=round(sum(xs)/len(xs), 1), cy=round(sum(ys)/len(ys), 1), ground=round(g, 1), ground_med=round(gmed, 1),
             main=round(main, 1), top=round(top, 1), map_h=b['h'], cover=round(cov0, 2), best_cover=round(best[0], 2), shift=[best[1], best[2]], pts=int(ins.sum()))
    rk = ins & (pc != 2) & (pz > g + main + 8)   # tower: a cluster well above the main roof
    if rk.sum() >= 15:
        tx, ty, tz = px[rk], py[rk], pz[rk]; j = int(np.argmax(tz)); near = np.hypot(tx - tx[j], ty - ty[j]) < 12
        if near.sum() >= 12:
            qx, qy = tx[near], ty[near]; x0_, x1_ = np.percentile(qx, [3, 97]); y0_, y1_ = np.percentile(qy, [3, 97])
            if (x1_ - x0_)*(y1_ - y0_) < 0.35*(max(xs) - min(xs))*(max(ys) - min(ys)):   # a tower, not a whole taller wing
                r['tw'] = [round(float(x0_ + x1_)/2, 1), round(float(y0_ + y1_)/2, 1), round(float(x1_ - x0_) + 1, 1), round(float(y1_ - y0_) + 1, 1), round(float(np.percentile(tz[near], 98)), 1)]
    out.append(r)
json.dump(out, open(repo + '/campus/src/lidar-buildings.json', 'w'), indent=0)
named = sorted([r for r in out if r['n']], key=lambda r: r['n'])
print('%-34s %6s %6s %6s %6s %5s %5s %s' % ('building', 'ground', 'main', 'top', 'map_h', 'cov', 'best', 'shift'))
for r in named: print('%-34s %6.1f %6.1f %6.1f %6d %5.2f %5.2f %s %s' % (r['n'][:34], r['ground'], r['main'], r['top'], r['map_h'], r['cover'], r['best_cover'], r['shift'], r.get('tw', '')))
dh = np.array([r['main'] - r['map_h'] for r in out]); print('all', len(out), 'buildings: map height minus LiDAR main roof, median', round(-float(np.median(dh)), 1), 'm; |diff|>5 m:', int((abs(dh) > 5).sum()))
print('footprints shifted >=4 m for better fit:', sum(1 for r in out if r['shift'][0]**2 + r['shift'][1]**2 >= 16 and r['best_cover'] - r['cover'] > 0.1))
print('low coverage (<0.5, maybe gone/wrong):', [r['n'] or (r['cx'], r['cy']) for r in out if r['best_cover'] < 0.5][:30])
