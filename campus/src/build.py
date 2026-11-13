"""Turn the raw OpenStreetMap + terrain export into the compact campus file the site loads (campus/westpoint.json).
Units: meters. x = east, y = north, measured from lat0/lon0. Map data (c) OpenStreetMap contributors (ODbL)."""
import gzip, json, math, sys
d = json.load(gzip.open(__file__.replace('build.py', 'westpoint-raw.json.gz'))); E = d['elems']; ev = d['elev']
try: ev = json.load(gzip.open(__file__.replace('build.py', 'westpoint-elev-wide.json.gz')))   # wider terrain from widen.py: whole Hudson + Garrison shore
except FileNotFoundError: pass
def ring(g): return [(g[i]/10, g[i+1]/10) for i in range(0, len(g), 2)]
def area(p): return abs(sum(p[i][0]*p[(i+1)%len(p)][1] - p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p))))/2
def cen(p): return (sum(q[0] for q in p)/len(p), sum(q[1] for q in p)/len(p))
def simp(p, tol):   # Douglas-Peucker
    if len(p) < 3: return p
    a, b = p[0], p[-1]; dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy) or 1e-9
    k, md = 0, 0
    for i in range(1, len(p)-1):
        dd = abs((p[i][0]-a[0])*dy - (p[i][1]-a[1])*dx)/L if L > 1e-6 else math.hypot(p[i][0]-a[0], p[i][1]-a[1])
        if dd > md: k, md = i, dd
    return simp(p[:k+1], tol)[:-1] + simp(p[k:], tol) if md > tol else [a, b]
def poly(p, tol):
    if p[0] == p[-1]: p = p[:-1]
    if len(p) < 3: return None
    h = len(p)//2; q = simp(p[:h+1], tol)[:-1] + simp(p[h:] + [p[0]], tol)[:-1]
    return q if len(q) >= 3 else None
flat = lambda p: [round(v, 1) for q in p for v in q]
RENAME = {'Lee Barracks': 'Ridgway Barracks', 'Grant Hall': 'Grant Barracks', 'United States Military Academy Library': 'Jefferson Hall Library', 'Westpoint Cadet Chapel': 'Cadet Chapel',
          'CEAC - Cyber and Engineering Academic Center': 'Cyber & Engineering Center', 'The Thayer Hotel at West Point': 'Thayer Hotel', 'Security Checkpoint': 'Thayer Gate'}
HEIGHT = {'Pershing Barracks': 24, 'Bradley Barracks': 24, 'Davis Barracks': 26, 'Eisenhower Barracks': 24, 'Ridgway Barracks': 22, 'MacArthur Barracks': 24, 'Scott Barracks': 22, 'Sherman Barracks': 22, 'Grant Barracks': 20,
          'Old Central Barracks': 18, 'Washington Hall': 26, 'Thayer Hall': 22, 'Jefferson Hall Library': 28, 'Taylor Hall': 34, 'Cadet Chapel': 30, 'Eisenhower Hall': 26, 'Mahan Hall': 30, 'Bartlett Hall': 24, 'Lincoln Hall': 18,
          'Cullum Hall': 18, 'Arvin Gymnasium': 24, 'Holleder Center': 22, 'Gillis Field House': 20, 'Thayer Hotel': 26, 'Cyber & Engineering Center': 24, 'Foley Indoor Practice Center': 20, 'Administration Building': 20,
          'Old Cadet Chapel': 12, 'Most Holy Trinity Chapel': 14, 'West Point Jewish Chapel': 14, 'Herbert Alumni Center': 12, 'West Point Club': 12, 'Kimsey Athletic Center': 22, 'Thayer Gate': 6, 'Fort Putnam': 5}
B, R, A, N = [], [], [], []
for e in E:
    t = e['t']
    if e['k'] == 'n':
        if t.get('name') or t.get('man_made') == 'flagpole': N.append({'n': t.get('name', 'Flagpole'), 'p': [e['g'][0]/10, e['g'][1]/10]})
        continue
    rings = [ring(e['g'])] if e['k'] == 'w' else [ring(m['g']) for m in e['m'] if m['r'] == 'outer' and len(m['g']) >= 8]
    for p in rings:
        if t.get('building'):
            q = poly(p, 0.5)
            if not q or area(q) < 30: continue
            name = RENAME.get(t.get('name'), t.get('name')); a = area(q)
            h = HEIGHT.get(name) or (float(t['height']) if 'height' in t else float(t['building:levels'])*3.6 if 'building:levels' in t else 5.5 if a < 150 else 8 if a < 500 else 12 if a < 1800 else 16)
            if t['building'] == 'roof': h = 6
            b = {'h': h, 'p': flat(q)}
            if name: b['n'] = name
            kind = 'barracks' if name and 'Barracks' in name else 'house' if (a < 320 and not name) else 'hall'
            b['k'] = kind; B.append(b)
        elif t.get('highway'):
            hw = t['highway']; c = 0 if hw in ('tertiary', 'secondary', 'primary') else 1 if hw in ('residential', 'unclassified') else 2 if hw == 'service' else 3 if hw == 'pedestrian' else 4
            if hw in ('steps',) or t.get('tunnel'): continue
            q = simp(p, 0.8 if c < 4 else 1.2); L = sum(math.dist(q[i], q[i+1]) for i in range(len(q)-1))
            if L < (25 if c >= 2 else 8): continue
            R.append({'c': c, 'p': flat(q)})
        else:
            kind = None
            if t.get('natural') == 'water' and t.get('water') != 'river': kind = 'water'
            elif t.get('leisure') == 'pitch': kind = 'pitch:' + (t.get('sport') or 'field').split(';')[0]
            elif t.get('leisure') == 'stadium': kind = 'stadium'
            elif t.get('amenity') == 'parking': kind = 'parking'
            elif t.get('military') == 'parade_field': kind = 'plain'
            elif t.get('landuse') in ('grass', 'recreation_ground') or t.get('leisure') in ('park', 'garden'): kind = 'lawn'
            elif t.get('landuse') == 'cemetery': kind = 'cemetery'
            if not kind: continue
            q = poly(p, 0.8)
            if not q: continue
            a = {'k': kind, 'p': flat(q)}
            if t.get('name'): a['n'] = t['name']
            A.append(a)
h = [(-30 if v < -500 else v)/10 for v in ev['h']]   # bad readings in the river -> below water
# The Hudson: flood-fill outward from every cell at river level. With the wide grid both banks are inside the map.
cols, rows = ev['cols'], ev['rows']
# river level = the most common low height (a river surface is flat, so it shows up as a spike)
import collections
bins = collections.Counter(round(v*2)/2 for v in h if -2.9 < v < 6); LEVEL = 0.5; T = 5.5   # this terrain source shows the river surface as noisy 0-5 m, so seed at <1 m and fill up to 5.5 m
print('low-height spike:', sorted(bins.items())[:14])
water = [False]*len(h); stack = [k for k, v in enumerate(h) if v < 1.0]
while stack:
    k = stack.pop()
    if water[k] or h[k] >= T: continue
    water[k] = True; i, j = k % cols, k//cols
    if i > 0: stack.append(k - 1)
    if i < cols - 1: stack.append(k + 1)
    if j > 0: stack.append(k - cols)
    if j < rows - 1: stack.append(k + cols)
# Better: the real Hudson outline from OpenStreetMap (hudson-osm.json.gz). The DEM over the river is noisy (1-20 m),
# so height alone leaves holes. Each cell is water if a ray from the cell to the west crosses the river outline an odd number of times.
try:
    hud = json.load(gzip.open(__file__.replace('build.py', 'hudson-osm.json.gz')))
    segs = [(l[k], l[k+1]) for l in hud['lines'] for k in range(len(l) - 1)]
    def inside(px, py):
        n = 0
        for (ax, ay), (bx, by) in segs:
            if (ay > py) != (by > py) and ax + (py - ay)*(bx - ax)/(by - ay) < px: n += 1
        return n % 2 == 1
    water = [inside(ev['x0'] + (k % cols)*ev['step'], ev['y0'] + (k//cols)*ev['step']) for k in range(len(h))]
    print('Hudson from OSM outline')
except FileNotFoundError: pass
EXT = 0
h2 = []
for j in range(rows): h2 += [(-3.0 if water[j*cols + i] else max(h[j*cols + i], 1.3)) for i in range(cols)] + [-3.0]*EXT
print('river level', LEVEL, 'water share', round(sum(water)/len(water), 3)); h = h2; ev = dict(ev, cols=cols + EXT)
out = {'src': 'Map data (c) OpenStreetMap contributors, ODbL. Terrain: Mapzen/AWS terrain tiles (USGS 3DEP).', 'lat0': d['lat0'], 'lon0': d['lon0'],
       'elev': {'cols': ev['cols'], 'rows': ev['rows'], 'x0': ev['x0'], 'y0': ev['y0'], 'step': ev['step'], 'h': [round(v, 1) for v in h]},
       'buildings': B, 'roads': R, 'areas': A, 'nodes': N}
s = json.dumps(out, separators=(',', ':')); open(sys.argv[1], 'w').write(s)
print(len(s), 'bytes |', len(B), 'buildings', len(R), 'roads', len(A), 'areas', len(N), 'nodes | gz', len(gzip.compress(s.encode())))
for n in ['Pershing Barracks','Bradley Barracks','Davis Barracks','Eisenhower Barracks','Ridgway Barracks','MacArthur Barracks','Scott Barracks','Sherman Barracks','Grant Barracks','Washington Hall','Jefferson Hall Library','Thayer Hall','Taylor Hall','Cadet Chapel','Thayer Gate','Thayer Hotel','Eisenhower Hall','Arvin Gymnasium']:
    bs = [b for b in B if b.get('n') == n]
    print(' ', n, len(bs), [tuple(round(v) for v in cen(ring([x*10 for x in b['p']]))) + (round(area(ring([x*10 for x in b['p']]))),) for b in bs])
for a in A:
    if a.get('n'): print('  area', a['k'], a['n'], tuple(round(v) for v in cen(ring([x*10 for x in a['p']]))))
for n in N: print('  node', n['n'], [round(v) for v in n['p']])
