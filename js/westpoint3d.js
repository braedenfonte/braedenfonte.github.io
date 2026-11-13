/* 3D West Point (Three.js, vendored in /vendor). Loaded in the background by js/shell.js when the device can handle it.
   Built from real data in /campus/westpoint.json: true building footprints raised to height on the real terrain,
   with the painted map (roads, fields, the Plain) draped over the hills. Draws a frame only when something changes. */
import * as THREE from "/vendor/three.module.min.js";

export async function create(o){
  const { stage, canvas, map } = o, D = map.data, BB = map.bounds;
  const S = 0.05, VE = 1.0;                                   // world units per meter, vertical stretch
  const gy = (x, y) => Math.max(map.heightAt(x, y), 0.2)*S*VE; // ground height in world units
  const V = (x, y, h) => new THREE.Vector3(x*S, gy(x, y) + (h || 0)*S, -y*S);
  const dark = () => o.dark();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;   // filmic color: richer greens, softer highlights
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(34, 1, 0.08, 2000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1), sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.05;
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 90, bottom: -90, near: 1, far: 420 });
  sun.position.set(90, 120, 60); scene.add(hemi, sun);
  const disposables = [];
  const keep = x => { disposables.push(x); return x; };

  /* ---------- terrain with the painted map on it ---------- */
  const e = D.elev, tcv = document.createElement("canvas");
  const tex = keep(new THREE.CanvasTexture(tcv)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  let onPhoto = false;   // true while the Google photo ground is showing (our ground texture is then painted in daylight)
  function paintGround(){ map.paint(tcv, { pxPerM: 0.85, dark: dark() && !onPhoto, footprintOnly: true }); tex.needsUpdate = true; }
  { const pos = [], uv = [], idx = [];
    for (let j = 0; j < e.rows; j++) for (let i = 0; i < e.cols; i++){ const h = e.h[j*e.cols + i]; pos.push((e.x0 + i*e.step)*S, (h < 0.4 ? -4 : h)*S*VE, -(e.y0 + j*e.step)*S); uv.push(i/(e.cols - 1), j/(e.rows - 1)); }
    for (let j = 0; j < e.rows - 1; j++) for (let i = 0; i < e.cols - 1; i++){ const a = j*e.cols + i, b = a + 1, c = a + e.cols, d = c + 1; idx.push(a, b, d, a, d, c); }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 1, side: THREE.DoubleSide }))); m.receiveShadow = true; scene.add(m); }
  const w = BB.x1 - BB.x0, hgt = BB.y1 - BB.y0, cx = (BB.x0 + BB.x1)/2*S, cz = -(BB.y0 + BB.y1)/2*S;
  const waterMat = keep(new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0.15 }));
  { const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w*S, hgt*S)), waterMat); m.rotation.x = -Math.PI/2; m.position.set(cx, 0.15*S, cz); m.receiveShadow = true; scene.add(m); }
  const slabMat = keep(new THREE.MeshStandardMaterial({ roughness: 1 }));
  { const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w*S + 1.2, 3, hgt*S + 1.2)), slabMat); m.position.set(cx, -1.5 - 4*S*VE, cz); scene.add(m); }

  /* ---------- buildings: real footprints -> walls with windows + roofs ---------- */
  const wallTex = document.createElement("canvas"), glowTex = document.createElement("canvas"); wallTex.width = wallTex.height = glowTex.width = glowTex.height = 256;
  { const a = wallTex.getContext("2d"), b = glowTex.getContext("2d"); a.fillStyle = "#fff"; a.fillRect(0, 0, 256, 256); b.fillStyle = "#000"; b.fillRect(0, 0, 256, 256); let s = 5;
    const rnd = () => (s = (s*9301 + 49297) % 233280)/233280;
    for (let y = 0; y < 256; y += 8) for (let x = -((y/8) % 2)*11; x < 256; x += 22){ const v = 228 + Math.round(rnd()*27); a.fillStyle = "rgb(" + v + "," + v + "," + (v - 4) + ")"; a.fillRect(x + 1, y + 1, 20, 6); }   // granite courses
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++){ const x = i*64 + 25, y = j*64 + 12;   // narrow, tall windows with a pointed head
      a.fillStyle = "#2f3640"; a.fillRect(x, y + 4, 14, 38);
      a.fillStyle = "#8c939b"; a.fillRect(x + 6, y + 6, 2, 36); a.fillRect(x - 2, y + 42, 18, 3);
      if (rnd() < 0.4){ b.fillStyle = rnd() < 0.8 ? "#ffd89a" : "#cfe4ff"; b.fillRect(x, y + 6, 14, 36); } } }
  const wT = keep(new THREE.CanvasTexture(wallTex)), gT = keep(new THREE.CanvasTexture(glowTex));
  [wT, gT].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }); wT.colorSpace = THREE.SRGBColorSpace; gT.colorSpace = THREE.SRGBColorSpace;
  const wallMat = keep(new THREE.MeshStandardMaterial({ map: wT, emissiveMap: gT, emissive: 0xffffff, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  const roofMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  const WALL = { barracks: [0.70, 0.68, 0.64], hall: [0.74, 0.72, 0.67] }, HOUSE = [[0.9, 0.88, 0.83], [0.78, 0.72, 0.62], [0.62, 0.4, 0.33], [0.82, 0.8, 0.74]];
  const ROOF = { barracks: [0.3, 0.33, 0.38], hall: [0.38, 0.4, 0.44], house: [0.42, 0.27, 0.22] };
  const PLAIN_FRONT_RX = /^(Washington Hall|MacArthur Barracks|Eisenhower Barracks)$/;
  const wp = [], wu = [], wc = [], wl = [], rp = [], rc = [], rl = [];   // wl / rl: which landmark each triangle belongs to (-1 = none)
  const lmOf = {}; o.landmarks.forEach((l, i) => { if (l.bi != null) lmOf[l.bi] = i; });
  const tops = {};
  let curB = -1;   // which named building is being built (for hover names)
  function tri(arrP, arrC, arrL, pts3, color, lm){ for (const p of pts3){ arrP.push(p[0]*S, p[1], -p[2]*S); arrC.push(color[0], color[1], color[2]); } arrL.push(lm); (arrL.b || (arrL.b = [])).push(curB); }
  function extrude(P, baseY, topY, wallColor, roofColor, lm, noRoof){
    let u = 0; const n = P.length, vh = (topY - baseY)/S/(4.2*4);
    for (let i = 0; i < n; i++){ const a = P[i], c = P[(i + 1) % n], len = Math.hypot(c[0] - a[0], c[1] - a[1]), u1 = u/(5.5*4), u2 = (u + len)/(5.5*4);
      tri(wp, wc, wl, [[a[0], baseY, a[1]], [c[0], baseY, c[1]], [c[0], topY, c[1]]], wallColor, lm); wu.push(u1, 0, u2, 0, u2, vh);
      tri(wp, wc, wl, [[a[0], baseY, a[1]], [c[0], topY, c[1]], [a[0], topY, a[1]]], wallColor, lm); wu.push(u1, 0, u2, vh, u1, vh); u += len; }
    if (noRoof) return;
    const faces = THREE.ShapeUtils.triangulateShape(P.map(p => new THREE.Vector2(p[0], p[1])), []);
    faces.forEach(f => tri(rp, rc, rl, f.map(k => [P[k][0], topY, P[k][1]]), roofColor, lm));
  }
  D.buildings.forEach(b => {
    const P = map.pts(b.p); let lo = 1e9, hi = -1e9; P.forEach(p => { const h = gy(p[0], p[1]); if (h < lo) lo = h; if (h > hi) hi = h; });
    const hh = { "Washington Hall": 16, "MacArthur Barracks": 23.4, "Eisenhower Barracks": 23.4 }[b.n] || b.h;
    const top = Math.min(hi, lo + 9*S) + hh*S, lm = lmOf[b.i] != null ? lmOf[b.i] : -1; tops[b.i] = { P, lo, top };
    const jit = 0.94 + ((b.i*37) % 13)/100, wcol = (b.k === "house" ? HOUSE[b.i % HOUSE.length] : b.n && PLAIN_FRONT_RX.test(b.n) ? [0.8, 0.8, 0.77] : WALL[b.k]).map(v => v*jit);
    curB = b.n ? b.i : -1;
    extrude(P, lo - 2*S, top, wcol, ROOF[b.k].map(v => v*jit), lm);
    if (b.k !== "house" && b.h >= 16 && P.length >= 4 && !(b.n && PLAIN_FRONT_RX.test(b.n))){ // a low parapet block so big halls don't look like plain boxes
      const c = b.c, Q = P.map(p => [c[0] + (p[0] - c[0])*0.9, c[1] + (p[1] - c[1])*0.9]); extrude(Q, top, top + 1.6*S, wcol.map(v => v*0.93), ROOF[b.k].map(v => v*0.9), lm); }
  });
  /* ---------- Military Gothic detail (Central Area barracks, Thayer Hall, Bartlett Hall, Washington Hall): granite battlements,
     square corner towers and stone buttresses, the way these buildings look from the Plain ---------- */
  const GOTHIC = /Barracks|Thayer Hall|Bartlett Hall/, PLAIN_FRONT = /^(Washington Hall|MacArthur Barracks|Eisenhower Barracks)$/;
  function box(cx, cy, ux, uy, L, Dp, y0, y1, col, lm){   // a block centered at (cx, cy) in map meters, long side along (ux, uy)
    const vx = -uy, vy = ux, c = [[-L/2, -Dp/2], [L/2, -Dp/2], [L/2, Dp/2], [-L/2, Dp/2]].map(([a, d]) => [cx + ux*a + vx*d, cy + uy*a + vy*d]);
    for (let k = 0; k < 4; k++){ const a = c[k], q = c[(k + 1) % 4];
      tri(wp, wc, wl, [[a[0], y0, a[1]], [q[0], y0, q[1]], [q[0], y1, q[1]]], col, lm); wu.push(0.02, 0.02, 0.03, 0.02, 0.03, 0.03);
      tri(wp, wc, wl, [[a[0], y0, a[1]], [q[0], y1, q[1]], [a[0], y1, a[1]]], col, lm); wu.push(0.02, 0.02, 0.03, 0.03, 0.02, 0.03); }
    tri(rp, rc, rl, [[c[0][0], y1, c[0][1]], [c[1][0], y1, c[1][1]], [c[2][0], y1, c[2][1]]], col, lm); tri(rp, rc, rl, [[c[0][0], y1, c[0][1]], [c[2][0], y1, c[2][1]], [c[3][0], y1, c[3][1]]], col, lm);
  }
  function battlements(P, y, col, lm, step){ const n = P.length;   // merlons along every edge
    for (let i = 0; i < n; i++){ const a = P[i], q = P[(i + 1) % n], L = Math.hypot(q[0] - a[0], q[1] - a[1]); if (L < 2) continue; const ux = (q[0] - a[0])/L, uy = (q[1] - a[1])/L;
      for (let t = step/2; t < L; t += step) box(a[0] + ux*t, a[1] + uy*t, ux, uy, step*0.5, 0.9, y, y + 1.3*S, col, lm); } }
  D.buildings.forEach(b => { if (!b.n || !GOTHIC.test(b.n) || PLAIN_FRONT.test(b.n)) return; const T = tops[b.i]; if (!T) return;
    const P = T.P, n = P.length, lm = lmOf[b.i] != null ? lmOf[b.i] : -1, col = [0.66, 0.65, 0.62], dark2 = [0.58, 0.57, 0.55]; curB = b.i;
    let ar = 0; for (let i = 0; i < n; i++){ const a = P[i], q = P[(i + 1) % n]; ar += a[0]*q[1] - q[0]*a[1]; } const sg = Math.sign(ar) || 1;
    battlements(P, T.top, col, lm, 3.2);
    for (let i = 0; i < n; i++){ const a = P[(i + n - 1) % n], c = P[i], q = P[(i + 1) % n];
      const L1 = Math.hypot(c[0] - a[0], c[1] - a[1]), L2 = Math.hypot(q[0] - c[0], q[1] - c[1]), cr = (c[0] - a[0])*(q[1] - c[1]) - (c[1] - a[1])*(q[0] - c[0]);
      if (cr*sg > 0 && L1 > 9 && L2 > 9){   // convex corner: a square tower that rises above the roof, with its own battlements
        const ux = (q[0] - c[0])/L2, uy = (q[1] - c[1])/L2, w = 6.5, tcx = c[0] + ux*(w/2 - 1) - (c[0] - a[0])/L1*(w/2 - 1), tcy = c[1] + uy*(w/2 - 1) - (c[1] - a[1])/L1*(w/2 - 1);
        const ty = T.top + 6*S; box(tcx, tcy, ux, uy, w, w, T.lo, ty, dark2, lm);
        const hw = w/2, sq = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]].map(([p1, p2]) => [tcx + ux*p1 - uy*p2, tcy + uy*p1 + ux*p2]); battlements(sq, ty, dark2, lm, 2.2); }
      if (L2 > 14) for (let t = 9; t < L2 - 5; t += 9){ const ux = (q[0] - c[0])/L2, uy = (q[1] - c[1])/L2, ox = uy*sg*0.45, oy = -ux*sg*0.45;   // buttresses stepping out from the wall
        box(c[0] + ux*t + ox, c[1] + uy*t + oy, ux, uy, 1.3, 0.9, T.lo, T.top + 0.4*S, dark2, lm); } }
  });
  curB = -1;
  // The Thayer Hall footbridge (OSM: footway, bridge, layer 2) from Thayer Hall west to the Taylor / Bartlett level: a granite deck with
  // battlemented parapets on two stone piers, at the height of the upper (Plain-side) end.
  { const A = [398, 498], B2 = [362, 499], L = Math.hypot(B2[0] - A[0], B2[1] - A[1]), ux = (B2[0] - A[0])/L, uy = (B2[1] - A[1])/L, mx = (A[0] + B2[0])/2, my = (A[1] + B2[1])/2;
    const top = Math.max(gy(A[0], A[1]), gy(B2[0], B2[1])) + 0.6*S, g = [0.64, 0.63, 0.6], g2 = [0.56, 0.55, 0.53];
    box(mx, my, ux, uy, L + 2, 4.2, top - 1.1*S, top, g, -1);   // deck
    for (const sd of [-1, 1]){ const ox = -uy*sd*1.9, oy = ux*sd*1.9; box(mx + ox, my + oy, ux, uy, L + 2, 0.5, top, top + 1.1*S, g, -1);   // parapets
      for (let t = -L/2 + 1.5; t < L/2; t += 2.6) box(mx + ox + ux*t, my + oy + uy*t, ux, uy, 1.2, 0.55, top + 1.1*S, top + 1.7*S, g, -1); }
    for (const f of [-0.17, 0.17]){ const px = mx + ux*L*f, py = my + uy*L*f; box(px, py, ux, uy, 2.2, 4.6, gy(px, py) - 1*S, top - 1.1*S, g2, -1); } }

  /* ---------- Washington Hall: the Plain-side front, measured from photos (Wikimedia Commons, "West Point Washington Hall 03/04").
     Front = NE end of the OSM footprint, facing the Washington statue (OSM node at 188, 697). Pavilion 27.7 m wide (pylons 7.1 m,
     center 13.5 m), 29.6 m tall; pylons step 0.8 m forward. Center, top to bottom: eagle shield, 3 pointed windows, 2 rows of grouped
     windows, 3 tall lancet groups, 3 entrance arches with brown doors. Wide granite steps, then the equestrian statue. ---------- */
  const WH = (() => { const bi = D.buildings.findIndex(b => b.n === "Washington Hall"); if (bi < 0) return null;
    const A = [168, 649], B = [147, 667], W = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0])/W, uy = (B[1] - A[1])/W, nx = uy, ny = -ux;   // u along the front, n out toward the Plain
    const g0 = Math.min(gy(A[0], A[1]), gy(B[0], B[1])), H = 29.6, PY = 7.1, DEP = 12, PF = 0.8, at = (t, d) => [A[0] + ux*t + nx*d, A[1] + uy*t + ny*d];
    const lm = lmOf[bi] != null ? lmOf[bi] : -1, stone = [0.8, 0.8, 0.77]; curB = bi;
    const blk = (t0, t1, d0, d1, h, col) => { const c = at((t0 + t1)/2, (d0 + d1)/2); box(c[0], c[1], ux, uy, t1 - t0, d1 - d0, g0 - 1*S, g0 + h*S, col, lm); };
    blk(PY, W - PY, -DEP, 0, H, stone); blk(0, PY, -DEP, PF, H + 0.9, stone); blk(W - PY, W, -DEP, PF, H + 0.9, stone);   // center + two pylons
    for (const t of [0.5, PY - 0.5, W - PY + 0.5, W - 0.5]) for (const d of [PF - 0.5, -DEP + 0.5]){ const c = at(t, d); box(c[0], c[1], ux, uy, 1.1, 1.1, g0 + (H + 0.9)*S, g0 + (H + 2.4)*S, stone, lm); }   // pylon corner pinnacles
    for (let k = 0; k < 3; k++){ const c = at(W/2, 1.2 + k*2.2 + 1.1); box(c[0], c[1], ux, uy, 15 + (2 - k)*3, 2.2, g0 - 1*S, g0 + (1.4 - k*0.45)*S, [0.78, 0.77, 0.74], lm); }   // front steps
    curB = -1;
    // the hand-drawn front: one canvas for the center panel, one for a pylon face
    const fc = document.createElement("canvas"), pc = document.createElement("canvas"); fc.width = 512; fc.height = 1120; pc.width = 256; pc.height = 1120;
    const stoneFill = (x, w2, h2, seed) => { let sd = seed; const r = () => (sd = (sd*9301 + 49297) % 233280)/233280; x.fillStyle = "#cfcdc6"; x.fillRect(0, 0, w2, h2);
      for (let yy = 0; yy < h2; yy += 14) for (let xx = -((yy/14) % 2)*19; xx < w2; xx += 38){ const v = 196 + Math.round(r()*40); x.fillStyle = "rgb(" + v + "," + (v - 1) + "," + (v - 6) + ")"; x.fillRect(xx + 1, yy + 1, 36, 12); } };
    const glass = "#2a323d", trim = "#e4e2dc", door = "#6e3b22";
    const lancet = (x, X, Y, w2, h2) => { x.fillStyle = trim; x.beginPath(); x.moveTo(X - 4, Y + h2 + 4); x.lineTo(X - 4, Y + w2*0.55); x.quadraticCurveTo(X + w2/2, Y - w2*0.45, X + w2 + 4, Y + w2*0.55); x.lineTo(X + w2 + 4, Y + h2 + 4); x.fill();
      x.fillStyle = glass; x.beginPath(); x.moveTo(X, Y + h2); x.lineTo(X, Y + w2*0.6); x.quadraticCurveTo(X + w2/2, Y - w2*0.3, X + w2, Y + w2*0.6); x.lineTo(X + w2, Y + h2); x.fill(); };
    { const x = fc.getContext("2d"), F = 1120; stoneFill(x, 512, F, 7);
      x.fillStyle = "#bdbab2"; [0.11, 0.5, 0.765].forEach(f => x.fillRect(0, f*F, 512, 10));   // string courses
      x.fillStyle = "#b9b6ad"; x.beginPath(); x.moveTo(256 - 34, 0.025*F); x.lineTo(256 + 34, 0.025*F); x.lineTo(256 + 30, 0.075*F); x.quadraticCurveTo(256, 0.105*F, 256 - 30, 0.075*F); x.closePath(); x.fill();   // carved shield + eagle
      x.fillStyle = "#a9a59c"; x.beginPath(); x.ellipse(256, 0.03*F, 46, 12, 0, 0, Math.PI*2); x.fill();
      [[70, 90], [211, 90], [352, 90]].forEach(([X, w2]) => lancet(x, X, 0.15*F, w2, 0.075*F));   // 3 pointed windows
      [0.275, 0.395].forEach(f => [60, 196, 332].forEach(X => { x.fillStyle = trim; x.fillRect(X - 5, f*F - 5, 130, 0.075*F + 10); x.fillStyle = glass; for (let k = 0; k < 3; k++) x.fillRect(X + k*41, f*F, 37, 0.075*F); }));
      [60, 196, 332].forEach(X => { for (let k = 0; k < 3; k++) lancet(x, X + k*41, 0.54*F, 36, 0.195*F); x.fillStyle = trim; x.fillRect(X - 4, 0.64*F, 128, 6); });   // tall lancets with a transom
      x.fillStyle = "#b2aea5"; x.fillRect(0, 0.79*F, 512, 0.21*F);   // base course
      [[60, 92, 0.86], [190, 132, 0.82], [360, 92, 0.86]].forEach(([X, w2, f]) => { x.fillStyle = "#9d998f"; x.beginPath(); x.moveTo(X - 8, F); x.lineTo(X - 8, f*F + w2/2); x.arc(X + w2/2, f*F + w2/2, w2/2 + 8, Math.PI, 0); x.lineTo(X + w2 + 8, F); x.fill();
        x.fillStyle = door; x.beginPath(); x.moveTo(X, F); x.lineTo(X, f*F + w2/2); x.arc(X + w2/2, f*F + w2/2, w2/2, Math.PI, 0); x.lineTo(X + w2, F); x.fill(); x.fillStyle = "#4a2716"; x.fillRect(X + w2/2 - 2, f*F + w2/2, 4, F); }); }
    { const x = pc.getContext("2d"), F = 1120; stoneFill(x, 256, F, 3); x.fillStyle = "#bdbab2"; [0.11, 0.5, 0.765].forEach(f => x.fillRect(0, f*F, 256, 10));
      x.fillStyle = glass; [[0.2, 0.06], [0.33, 0.06], [0.45, 0.05], [0.58, 0.07]].forEach(([f, hh]) => x.fillRect(116, f*F, 24, hh*F)); x.fillStyle = "#b2aea5"; x.fillRect(0, 0.79*F, 256, 0.21*F); }
    const mk = cv => { const t = keep(new THREE.CanvasTexture(cv)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return keep(new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 })); };
    const quad = (t0, t1, d, h0, h1, mat) => { const a = at(t0, d), b = at(t1, d), y0 = g0 + h0*S, y1 = g0 + h1*S, g = keep(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.Float32BufferAttribute([a[0]*S, y0, -a[1]*S, b[0]*S, y0, -b[1]*S, b[0]*S, y1, -b[1]*S, a[0]*S, y1, -a[1]*S], 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.userData.keep = true; scene.add(m); return m; };
    const front = mk(fc), side = mk(pc), out = [quad(PY, W - PY, 0.04, 0, H, front), quad(0, PY, PF + 0.04, 0, H + 0.9, side), quad(W - PY, W, PF + 0.04, 0, H + 0.9, side)];
    // George Washington on horseback (bronze, green patina) on a white granite pedestal, at the OSM statue node
    const SX = 188, SY = 697, sg = gy(SX, SY), bronze = keep(new THREE.MeshStandardMaterial({ color: 0x5f8f7f, roughness: 0.55, metalness: 0.35 })), white = keep(new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.8 }));
    const rot = Math.atan2(ny, nx), put = (geo, mat, dx, dy, h, sx, sy, sz, rx) => { const m = new THREE.Mesh(keep(geo), mat); m.position.set((SX + dx)*S, sg + h*S, -(SY + dy)*S); m.scale.set(sx*S, sy*S, sz*S); m.rotation.set(0, rot, rx || 0, "YXZ"); m.castShadow = true; m.userData.keep = true; scene.add(m); out.push(m); return m; };
    const fwd = (k) => [Math.cos(rot)*k, Math.sin(rot)*k];
    put(new THREE.BoxGeometry(1, 1, 1), white, 0, 0, 0.35, 6.5, 0.7, 4.2); put(new THREE.BoxGeometry(1, 1, 1), white, 0, 0, 2.4, 4.4, 3.4, 2.2);   // base + pedestal
    put(new THREE.SphereGeometry(1, 14, 10), bronze, 0, 0, 5.4, 1.75, 0.75, 0.62);   // horse body
    for (const [a, b] of [[0.95, 0.35], [0.95, -0.35], [-0.95, 0.35], [-0.95, -0.35]]){ const f = fwd(a); put(new THREE.CylinderGeometry(0.11, 0.09, 1, 6), bronze, f[0] - Math.sin(rot)*b, f[1] + Math.cos(rot)*b, 4.55, 1, 1.15, 1); }
    { const f = fwd(1.75); put(new THREE.CylinderGeometry(0.22, 0.32, 1, 8), bronze, f[0], f[1], 6.2, 1, 1.25, 1, -0.5); const h2 = fwd(2.15); put(new THREE.BoxGeometry(1, 1, 1), bronze, h2[0], h2[1], 6.8, 0.75, 0.35, 0.3); }   // neck + head
    put(new THREE.CylinderGeometry(0.24, 0.3, 1, 8), bronze, 0, 0, 6.6, 1, 1.15, 1); put(new THREE.SphereGeometry(0.2, 10, 8), bronze, 0, 0, 7.4, 1, 1.1, 1);   // rider + head
    return out; })();

  /* ---------- statues and monuments (positions from OpenStreetMap). Bronze figures on granite pedestals face the Plain;
     Battle Monument and Kosciuszko are tall columns with a figure on top; the Great Chain is a row of giant iron links. ---------- */
  { const bronze = keep(new THREE.MeshStandardMaterial({ color: 0x5f8574, roughness: 0.45, metalness: 0.5 })), granite = keep(new THREE.MeshStandardMaterial({ color: 0xbab6ae, roughness: 0.85 })),
      polished = keep(new THREE.MeshStandardMaterial({ color: 0x9a968f, roughness: 0.3, metalness: 0.15 })), iron = keep(new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6, metalness: 0.6 }));
    const K = 1.7;   // statues a bit larger than life so you can see them from above
    const at = (x, y) => { const g = new THREE.Group(); g.position.set(x*S, gy(x, y), -y*S); g.rotation.y = Math.atan2(800 - y, 190 - x); g.userData.keep = true; scene.add(g); return g; };
    const mk = (g, geo, mat, px, py, pz, rx, rz) => { const m = new THREE.Mesh(keep(geo), mat); m.position.set(px*S, py*S, pz*S); if (rx) m.rotation.x = rx; if (rz) m.rotation.z = rz; m.castShadow = true; g.add(m); return m; };
    const B = (w, h, d) => new THREE.BoxGeometry(w*S, h*S, d*S), C = (r1, r2, h, n) => new THREE.CylinderGeometry(r1*S, r2*S, h*S, n || 12);
    function figure(g, base, opts){ const k = K*(opts && opts.k || 1), m = bronze;   // standing figure facing +x (toward the Plain)
      mk(g, B(0.3*k, 0.95*k, 0.18*k), m, 0, base + 0.48*k, -0.12*k); mk(g, B(0.3*k, 0.95*k, 0.18*k), m, 0, base + 0.48*k, 0.12*k);   // legs
      mk(g, B(0.36*k, 0.8*k, 0.55*k), m, 0, base + 1.35*k, 0);   // coat / torso
      mk(g, B(0.16*k, 0.7*k, 0.16*k), m, 0.02*k, base + 1.32*k, -0.36*k, 0, 0.1); mk(g, B(0.16*k, 0.7*k, 0.16*k), m, opts && opts.salute ? 0.18*k : 0.02*k, base + (opts && opts.salute ? 1.65 : 1.32)*k, 0.36*k, opts && opts.salute ? -1.2 : 0, 0);   // arms
      mk(g, new THREE.SphereGeometry(0.15*k*S, 12, 10), m, 0, base + 1.93*k, 0); mk(g, C(0.17*k, 0.17*k, 0.06*k), m, 0, base + 2.07*k, 0); }   // head + cap
    const pedestal = (g, w, h) => { mk(g, B(w + 0.6, 0.4, w + 0.6), granite, 0, 0.2, 0); mk(g, B(w, h, w), granite, 0, 0.4 + h/2, 0); mk(g, B(w + 0.3, 0.3, w + 0.3), granite, 0, 0.4 + h + 0.15, 0); return 0.4 + h + 0.3; };
    // standing generals and founders
    [[89, 890, "Thayer"], [100, 783, "MacArthur"], [303, 681, "Eisenhower"], [329, 668, "Patton"], [283, 970, "Sedgwick"]].forEach(([x, y, n]) => { const g = at(x, y), top = pedestal(g, 2.6, 3.2); figure(g, top, { salute: n === "MacArthur" }); });
    // Battle Monument: polished granite column topped by Fame
    { const g = at(265, 997); mk(g, B(8, 1, 8), granite, 0, 0.5, 0); mk(g, B(6, 3.5, 6), granite, 0, 2.75, 0); mk(g, C(1.25, 1.35, 21, 20), polished, 0, 15, 0); mk(g, B(3, 1.2, 3), granite, 0, 26.1, 0); mk(g, C(1, 1.2, 1, 12), polished, 0, 27.2, 0); figure(g, 27.7, { k: 1.2 }); }
    // Kosciuszko: column with his figure on top, by Fort Clinton
    { const g = at(616, 990); mk(g, B(5, 3, 5), granite, 0, 1.5, 0); mk(g, C(0.8, 0.9, 11, 16), granite, 0, 8.5, 0); mk(g, B(2, 0.8, 2), granite, 0, 14.4, 0); figure(g, 14.8); }
    // L'Ecole Polytechnique monument: a small pedestal with a bronze bust
    { const g = at(234, 602); const top = pedestal(g, 1.4, 2.2); mk(g, B(0.5*K, 0.6*K, 0.7*K), bronze, 0, top + 0.3*K, 0); mk(g, new THREE.SphereGeometry(0.2*K*S, 12, 10), bronze, 0, top + 0.8*K, 0); }
    // Cadet Honor Code memorial: a granite block with two bronze cadets beside it
    { const g = at(299, 630); mk(g, B(1.6, 1.6, 5.5), granite, 0, 0.8, 0); [-1.7, 1.7].forEach(dz => { const sub = new THREE.Group(); sub.position.z = dz*S; g.add(sub); figure(sub, 0, {}); }); }
    // Dade monument: a granite obelisk
    { const g = at(-587, 1295); mk(g, B(2.4, 1, 2.4), granite, 0, 0.5, 0); const ob = mk(g, C(0.5, 0.9, 7, 4), granite, 0, 4.5, 0); ob.rotation.y = Math.PI/4; mk(g, new THREE.ConeGeometry(0.5*S, 0.8*S, 4), granite, 0, 8.4, 0).rotation.y = Math.PI/4; }
    // the Great Chain: giant iron links laid out at Trophy Point
    { const g = at(360, 1093); for (let i = 0; i < 13; i++){ const l = mk(g, new THREE.TorusGeometry(0.75*S, 0.2*S, 8, 16), iron, 0, 0.3, -9 + i*1.4); l.scale.set(1, 1.6, 1); l.rotation.set(i % 2 ? 0 : Math.PI/2, 0, Math.PI/2); } }
  }

  // Michie Stadium: a bowl of stands around the field
  const stad = D.areas.find(a => a.k === "stadium"), stadLm = o.landmarks.findIndex(l => l.id === "stadium");
  curB = -1;
  if (stad){ const P = map.pts(stad.p), c = stad.c, g0 = gy(c[0], c[1]), n = P.length, inner = P.map(p => [c[0] + (p[0] - c[0])*0.52, c[1] + (p[1] - c[1])*0.52]);
    extrude(P, g0 - 2*S, g0 + 17*S, [0.6, 0.6, 0.62], null, stadLm, true);
    for (let i = 0; i < n; i++){ const a = P[i], b2 = P[(i + 1) % n], ai = inner[i], bi = inner[(i + 1) % n], col = i % 2 ? [0.5, 0.52, 0.56] : [0.56, 0.58, 0.62];
      tri(rp, rc, rl, [[a[0], g0 + 17*S, a[1]], [b2[0], g0 + 17*S, b2[1]], [bi[0], g0 + 1.5*S, bi[1]]], col, stadLm); tri(rp, rc, rl, [[a[0], g0 + 17*S, a[1]], [bi[0], g0 + 1.5*S, bi[1]], [ai[0], g0 + 1.5*S, ai[1]]], col, stadLm); } }
  function meshOf(P, C, U, mat){ const g = keep(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    if (U) g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; scene.add(m); return m; }
  const walls = meshOf(wp, wc, wu, wallMat), roofs = meshOf(rp, rc, null, roofMat); walls.userData.lm = wl; roofs.userData.lm = rl;

  const forest = [];   // tree InstancedMeshes (built-in cones + photo-placed 3D trees), recolored by season
  /* ---------- trees on the open hillsides ---------- */
  { const grid = map.busyGrid(), spots = []; let s = 3; const rnd = () => (s = (s*9301 + 49297) % 233280)/233280;
    for (let i = 0; i < 16000 && spots.length < 3400; i++){ const x = BB.x0 + rnd()*w, y = BB.y0 + rnd()*hgt; if (map.heightAt(x, y) < 2 || grid.busy(x, y)) continue; spots.push([x, y, 0.7 + rnd()*0.7, rnd()]); }
    const inst = new THREE.InstancedMesh(keep(new THREE.ConeGeometry(5*S, 15*S, 5)), keep(new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true })), spots.length), d = new THREE.Object3D(), c = new THREE.Color();
    spots.forEach((t, i) => { d.position.set(t[0]*S, gy(t[0], t[1]) + 7*S*t[2], -t[1]*S); d.scale.setScalar(t[2]); d.rotation.y = i; d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      inst.setColorAt(i, t[3] < 0.1 ? c.setRGB(0.62, 0.42, 0.16) : t[3] < 0.18 ? c.setRGB(0.66, 0.56, 0.2) : c.setRGB(0.16 + t[3]*0.1, 0.36 + t[3]*0.14, 0.17)); });
    inst.castShadow = true; inst.receiveShadow = true; scene.add(inst); forest.push(inst); }

  /* ---------- extras: monuments, flagpole, South Dock, signposts, accent outlines ---------- */
  const accent = keep(new THREE.MeshStandardMaterial({ color: 0xe0243c, emissive: 0xe0243c, emissiveIntensity: 0.4, roughness: 0.6 })), stone = keep(new THREE.MeshStandardMaterial({ color: 0xcfcabd, roughness: 0.9 }));
  const picks = [];
  function add(geo, mat, x, y, up, shadow){ const m = new THREE.Mesh(keep(geo), mat); m.position.copy(V(x, y, up)); m.castShadow = shadow !== false; scene.add(m); return m; }
  function pick(l, r, hh){ const m = add(new THREE.CylinderGeometry(r*S, r*S, hh*S, 8), stone, l.x, l.y, hh/2, false); m.visible = false; m.userData.id = l.id; picks.push(m); }
  D.nodes.forEach(n => { if (false && /Monument|Chain/.test(n.n)){ const big = n.n === "Battle Monument"; add(new THREE.CylinderGeometry((big ? 1.6 : 0.9)*S, (big ? 2.2 : 1.4)*S, (big ? 22 : 7)*S, 8), stone, n.p[0], n.p[1], big ? 11 : 3.5);
      if (big) add(new THREE.SphereGeometry(2*S, 10, 8), accent, n.p[0], n.p[1], 23.5); }
    if (false && n.n === "Flagpole"){ add(new THREE.CylinderGeometry(0.35*S, 0.35*S, 34*S, 5), stone, n.p[0], n.p[1], 17); add(new THREE.BoxGeometry(9*S, 5*S, 0.3*S), accent, n.p[0] + 4.6, n.p[1], 31); } });
  o.landmarks.forEach(l => {
    if (l.id === "trophy") pick(l, 26, 30);
    if (l.id === "stadium") pick(l, 60, 6);
    if (l.id === "dock"){ add(new THREE.BoxGeometry(80*S, 2.5*S, 10*S), stone, l.x + 45, l.y, 1.2); add(new THREE.BoxGeometry(14*S, 5*S, 5*S), accent, l.x + 70, l.y, 3.5); pick(l, 45, 14); }
    if (l.sign) signpost(l);
  });
  // direction signposts: a black iron post with a gold cap and finial, and an arrow-shaped black board with a gold edge
  // that points off the map toward the real place (away from the cadet area)
  function signpost(l){
    const g0 = gy(l.x, l.y), dir = Math.atan2(l.y - 620, l.x - 160), grp = new THREE.Group(); grp.position.set(l.x*S, g0, -l.y*S); grp.userData.keep = true;
    const iron = keep(new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.45, metalness: 0.6 })), gold = keep(new THREE.MeshStandardMaterial({ color: 0xc9a54a, roughness: 0.35, metalness: 0.8, emissive: 0x3a2a08 }));
    const m = (geo, mat, y) => { const k = new THREE.Mesh(keep(geo), mat); k.position.y = y*S; k.castShadow = true; grp.add(k); return k; };
    m(new THREE.CylinderGeometry(1.4*S, 1.8*S, 1.2*S, 12), iron, 0.6); m(new THREE.CylinderGeometry(0.55*S, 0.65*S, 30*S, 10), iron, 15);
    m(new THREE.CylinderGeometry(1*S, 1*S, 0.8*S, 12), gold, 30.4); m(new THREE.SphereGeometry(1*S, 12, 10), gold, 31.6);
    const arrow = (L, H, T) => { const sh = new THREE.Shape(); sh.moveTo(0, -H/2); sh.lineTo(L - H*0.6, -H/2); sh.lineTo(L, 0); sh.lineTo(L - H*0.6, H/2); sh.lineTo(0, H/2); sh.lineTo(0, -H/2);
      const g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false }); g.translate(-1.2, 0, -T/2); g.scale(S, S, S); return g; };
    const board = new THREE.Group(); board.position.y = 23*S; board.rotation.y = dir; grp.add(board);
    const edge = new THREE.Mesh(keep(arrow(26, 8.4, 0.5)), gold), face = new THREE.Mesh(keep(arrow(25, 7, 0.9)), iron); face.position.x = 0.3*S; edge.castShadow = true; board.add(edge, face);
    scene.add(grp); pick(l, 18, 34);
  }
  const lineBase = keep(new THREE.LineBasicMaterial({ color: 0xe0243c })), outlines = {};
  o.landmarks.forEach((l, i) => { const t = l.bi != null && tops[l.bi]; if (!t) return; const pts = [], n = t.P.length;
    for (let k = 0; k < n; k++){ const a = t.P[k], b = t.P[(k + 1) % n]; pts.push(a[0]*S, t.top + 0.02, -a[1]*S, b[0]*S, t.top + 0.02, -b[1]*S, a[0]*S, t.lo, -a[1]*S, a[0]*S, t.top, -a[1]*S); }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); const ln = new THREE.LineSegments(g, lineBase); ln.visible = !!l.mine; scene.add(ln); outlines[l.id] = { ln, mine: !!l.mine }; });

  function retheme(){
    onPhoto = tilesOn; const dk = dark() && !tilesOn; paintGround();   // the Google ground is a daytime photo, so buildings use daylight on it
    waterMat.color.set(dk ? 0x16324a : 0x3f80b3); slabMat.color.set(dk ? 0x0b0c10 : 0xcfd2d6);
    wallMat.emissiveIntensity = dk ? 0.9 : 0; wallMat.color.set(dk ? 0xb4bccb : 0xffffff); roofMat.color.set(dk ? 0xa9b2c4 : 0xffffff);
    hemi.color.set(dk ? 0x8ea6d6 : 0xffffff); hemi.groundColor.set(dk ? 0x0a0d14 : 0x6f7a66); hemi.intensity = dk ? 1.25 : 1.5;
    sun.color.set(dk ? 0xb9c8ff : 0xfff3df); sun.intensity = dk ? 1.7 : 2.5;
    
    renderer.shadowMap.needsUpdate = true; invalidate(); if (worldReady) world.apply();
  }

  /* ---------- camera rig ---------- */
  const c0 = V(380, 660, 0), HOME = { tx: c0.x, ty: c0.y, tz: c0.z, az: 1.2, pol: 1.0, dist: 86 };
  const c1 = V(330, 560, 0), HOME3D = { tx: c1.x, ty: c1.y, tz: c1.z, az: 1.15, pol: 1.08, dist: 58 };   // real tiles: low and angled, like tilting Google Earth
  const cur = Object.assign({}, HOME);
  let tween = null, raf = 0, active = true, dead = false, atHome = true, vw = 1, vh = 1;
  const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
  const homeFor = () => { const H = tilesOn ? HOME3D : HOME; return Object.assign({}, H, { dist: H.dist*Math.max(1, 1.7/(vw/vh)) }); };
  function applyCam(){ const s = Math.sin(cur.pol); cam.position.set(cur.tx + cur.dist*s*Math.sin(cur.az), cur.ty + cur.dist*Math.cos(cur.pol), cur.tz + cur.dist*s*Math.cos(cur.az)); cam.lookAt(cur.tx, cur.ty, cur.tz); }
  function fly(to, dur, done){ if (tween && tween.done){ const d = tween.done; tween = null; d(); }
    if (!dur){ Object.assign(cur, to); tween = null; invalidate(); if (done) done(); return; }
    tween = { from: Object.assign({}, cur), to, t0: performance.now(), dur, done, frames: 0, slowMs: 0 }; invalidate(); }
  function skip(){ if (!tween) return; const t = tween; tween = null; Object.assign(cur, t.to); invalidate(); if (t.done) t.done(); }

  /* ---------- labels ---------- */
  const v = new THREE.Vector3();
  function placeLabels(){
    const L = o.landmarks.map(l => { v.copy(V(l.x, l.y, (l.h || 0) + 10)).project(cam); let x = (v.x*0.5 + 0.5)*vw, y = (-v.y*0.5 + 0.5)*vh; if (v.z > 1){ x = vw - x; y = vh + 100; } return { l, x, y, sx: x, sy: y }; });
    const sm = vw < 700, lw = sm ? 92 : 196, lh = sm ? 16 : 32, mg = sm ? 46 : 100, clamp = q => { q.sx = Math.min(vw - mg, Math.max(mg, q.sx)); q.sy = Math.min(vh - 8, Math.max(sm ? 60 : q.sx < 470 ? 170 : 96, q.sy)); };   // phones: small labels, small gaps
    L.forEach(clamp);
    for (let it = 0; it < 40; it++){ let moved = false;   // nudge overlapping labels apart
      for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++){ const p = L[a], q = L[b], dx = q.sx - p.sx, dy = q.sy - p.sy, ox = lw - Math.abs(dx), oy = lh - Math.abs(dy);
        if (ox > 0 && oy > 0){ moved = true; if (ox < oy){ const m = ox/2*(dx < 0 ? -1 : 1); p.sx -= m; q.sx += m; } else { const m = oy/2*(dy < 0 ? -1 : 1); p.sy -= m; q.sy += m; } } }
      L.forEach(clamp); if (!moved) break; }
    L.forEach(q => o.place(q.l.id, q.sx, q.sy, true, Math.abs(q.sx - q.x) > 90 || Math.abs(q.sy - q.y) > 90));
    o.minor.forEach((m, i) => { v.copy(V(m.x, m.y, m.h + 5)).project(cam); const x = (v.x*0.5 + 0.5)*vw, y = (-v.y*0.5 + 0.5)*vh; o.placeMinor(i, x, y, false && v.z < 1 && x > 30 && x < vw - 30 && y > 60 && y < vh - 10); });
  }

  /* ---------- draw only when needed ---------- */
  let watched = false, lastT = 0;
  function frame(now){
    raf = 0; if (dead || !active) return;
    if (tween){ const k = Math.min(1, (now - tween.t0)/tween.dur), q = ease(k), f = tween.from, t = tween.to;
      for (const key in t) cur[key] = f[key] + (t[key] - f[key])*q;
      if (lastT && tween.frames++ > 4) tween.slowMs += now - lastT;
      if (o.watch && !watched && tween.frames > 34){ watched = true; if (tween.slowMs/(tween.frames - 5) > 45){ if (tween.done) tween.done(); tween = null; o.onSlow(); return; } }
      if (k >= 1){ const d = tween.done; tween = null; if (d) d(); } }
    lastT = tween ? now : 0;
    applyCam(); if (tiles){ cam.updateMatrixWorld(); tiles.update(); } renderer.render(scene, cam); placeLabels();
    if (tiles && tiles.stats.downloading + tiles.stats.parsing > 0) tilesAct = now;
    const busy = tiles && now - tilesAct < 2500;   // the tile loader only asks for the next, sharper pieces when update() runs, so keep running until it settles
    world.step(now); life.step(now); movers.step(now); sky.step(now); events.step(now);
    if (tween || busy || world.live() || life.on) raf = requestAnimationFrame(frame);
  }
  function invalidate(){ if (!raf && active && !dead) raf = requestAnimationFrame(frame); }
  function resize(){ const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return; vw = r.width; vh = r.height; renderer.setSize(vw, vh, false); cam.aspect = vw/vh; cam.updateProjectionMatrix();
    if (tiles) tiles.setResolutionFromRenderer(cam, renderer);
    if (atHome && !tween) Object.assign(cur, homeFor()); invalidate(); }
  const ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null; if (ro) ro.observe(stage); else addEventListener("resize", resize);

  /* ---------- hover, click, drag ---------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let hot = null, drag = null, overName = null;
  function pickAt(ev){ const r = canvas.getBoundingClientRect(); ptr.set(((ev.clientX - r.left)/r.width)*2 - 1, -((ev.clientY - r.top)/r.height)*2 + 1); ray.setFromCamera(ptr, cam);
    picks.forEach(p => { p.visible = true; }); const hit = ray.intersectObjects([walls, roofs].concat(picks), false)[0]; picks.forEach(p => { p.visible = false; });
    overName = null; if (!hit) return null; if (hit.object.userData.id) return hit.object.userData.id; const arr = hit.object.userData.lm, i = arr[hit.faceIndex], bi = arr.b[hit.faceIndex];
    if (i < 0 && bi >= 0) overName = D.buildings[bi].n; return i >= 0 ? o.landmarks[i].id : null; }
  function highlight(id){ if (id === hot) return; hot = id; for (const k in outlines) outlines[k].ln.visible = !tilesOn && (outlines[k].mine || k === id); invalidate(); }
  const touches = new Map(); let pinch = null;
  const pinchState = () => { const [a, b] = [...touches.values()]; return { d: Math.max(10, Math.hypot(b[0] - a[0], b[1] - a[1])), a: Math.atan2(b[1] - a[1], b[0] - a[0]), mx: (a[0] + b[0])/2, my: (a[1] + b[1])/2 }; };
  const L = (el, evn, fn, opt) => { el.addEventListener(evn, fn, opt); return () => el.removeEventListener(evn, fn, opt); };
  const off = [
    L(canvas, "pointerdown", ev => { touches.set(ev.pointerId, [ev.clientX, ev.clientY]); if (touches.size === 2){ drag = null; pinch = pinchState(); return; } if (tween) return; drag = { x: ev.clientX, y: ev.clientY, moved: 0, id: ev.pointerId, rot: ev.button === 2 || ev.shiftKey || ev.ctrlKey || ev.altKey }; }),   // drag = move around; right-drag or Shift-drag = turn/tilt
    L(canvas, "contextmenu", ev => ev.preventDefault()),
    L(canvas, "pointermove", ev => {
      if (touches.has(ev.pointerId)) touches.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pinch && touches.size === 2){ const p2 = pinchState(); zoom(pinch.d/p2.d); cur.az += p2.a - pinch.a; cur.pol = Math.min(tilesOn ? 1.5 : 1.4, Math.max(0.3, cur.pol - (p2.my - pinch.my)*0.004));
        pan(p2.mx - pinch.mx, 0); pinch = p2; atHome = false; invalidate(); return; }   // two fingers: pinch = zoom, twist = turn, slide up/down = tilt
      if (drag && drag.id === ev.pointerId){ const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = ev.clientX; drag.y = ev.clientY;
        if (drag.moved > 5){ if (!drag.cap){ drag.cap = true; try{ canvas.setPointerCapture(ev.pointerId); }catch(x){} } if (drag.rot){ cur.az -= dx*0.005; cur.pol = Math.min(tilesOn ? 1.5 : 1.4, Math.max(0.3, cur.pol - dy*0.003)); } else pan(dx, dy); atHome = false; invalidate(); } return; }
      if (ev.pointerType === "mouse" && !tween){ const id = pickAt(ev); if (o.tip) o.tip(overName, ev.clientX, ev.clientY); if (id !== hot){ highlight(id); o.onHover(id); } } }),
    L(canvas, "pointerup", ev => { touches.delete(ev.pointerId); if (pinch){ if (touches.size < 2) pinch = null; drag = null; return; } const d = drag; drag = null; if (d && d.moved <= 5 && !tween){ const id = pickAt(ev); if (id) o.onOpen(id); } }),
    L(canvas, "pointercancel", ev => { touches.delete(ev.pointerId); pinch = null; drag = null; }),
    L(canvas, "pointerleave", () => { if (o.tip) o.tip(null); if (hot){ highlight(null); o.onHover(null); } }),
    L(canvas, "wheel", ev => { if (tween) return; ev.preventDefault(); zoomAt(1 + Math.max(-0.3, Math.min(0.3, ev.deltaY*0.0015)), ev); }, { passive: false }),   // scroll = zoom toward the cursor
    L(document, "keydown", ev => { if (!active || /input|textarea/i.test(ev.target.tagName)) return; const k = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40], a: [-40, 0], d: [40, 0], w: [0, -40], s: [0, 40] }[ev.key]; if (k){ pan(-k[0], -k[1]); atHome = false; invalidate(); } }),   // arrows / WASD move around
    L(document, "visibilitychange", () => { if (!document.hidden) invalidate(); })
  ];
  function zoom(f){ cur.dist = Math.min(230, Math.max(tilesOn ? 1.6 : 9, cur.dist*f)); atHome = false; invalidate(); }
  // move the point the camera looks at across the ground, so you can go anywhere on the map (stays inside the map edges)
  function pan(dx, dy){ const k = 2*cur.dist*Math.tan(cam.fov*Math.PI/360)/Math.max(1, vh), sa = Math.sin(cur.az), ca = Math.cos(cur.az);
    cur.tx -= (ca*dx + sa*dy)*k; cur.tz -= (-sa*dx + ca*dy)*k;
    cur.tx = Math.min(BB.x1*S, Math.max(BB.x0*S, cur.tx)); cur.tz = Math.min(-BB.y0*S, Math.max(-BB.y1*S, cur.tz)); cur.ty = gy(cur.tx/S, -cur.tz/S); }
  // zoom toward whatever is under the mouse, not just the middle of the screen
  const zp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), zr = new THREE.Raycaster(), zv = new THREE.Vector2(), zh = new THREE.Vector3();
  function zoomAt(f, ev){ const before = cur.dist; zoom(f); const r = canvas.getBoundingClientRect(); zv.set(((ev.clientX - r.left)/r.width)*2 - 1, -((ev.clientY - r.top)/r.height)*2 + 1);
    applyCam(); cam.updateMatrixWorld(); zr.setFromCamera(zv, cam); zp.constant = -cur.ty; if (!zr.ray.intersectPlane(zp, zh)) return; const m = 1 - cur.dist/before;
    cur.tx += (zh.x - cur.tx)*m; cur.tz += (zh.z - cur.tz)*m; cur.ty = gy(cur.tx/S, -cur.tz/S); invalidate(); }

  /* ---------- Google Photorealistic 3D Tiles: the real look. The model above stays underneath as the fallback
     (no key, low-power/data-saver, quota used up, or any load error) and stays invisible-but-pickable for hovers. ---------- */
  let tiles = null, tilesOn = false, credit = null, tilesAct = 0, hold = null, calib = 0;
 const tileMats = new Set();
  const own = scene.children.filter(c => (c.isMesh || c.isInstancedMesh) && !c.userData.keep && !picks.includes(c) && c !== walls && c !== roofs);   // Google has no 3D buildings here, so ours stay
  function showOwn(on){ own.forEach(c => { c.visible = on; }); renderer.shadowMap.needsUpdate = true; }
  function stopTiles(why){ if (!tiles) return; console.warn("Google 3D tiles off, using the built-in map:", why);
    tiles.group.parent && tiles.group.parent.removeFromParent(); tiles.dispose(); tiles = null; tilesOn = false; tileMats.clear(); retheme();
    if (credit){ credit.remove(); credit = null; } treeMeshes.forEach(m => m.removeFromParent()); showOwn(true); for (const k in outlines) outlines[k].ln.visible = outlines[k].mine; if (atHome) fly(homeFor(), 600); invalidate(); }
  // Google's ground and our terrain come from different surveys: measure the height gap at ~150 open-ground points and shift the
  // tiles so the two agree. Then our buildings (built on our terrain) sit exactly on Google's ground. Re-run as sharper tiles arrive.
  function calibrate(){
    if (!tiles || !hold || calib >= 3) return;
    const rc = new THREE.Raycaster(), dn = new THREE.Vector3(0, -1, 0), grid = map.busyGrid(), diffs = []; hold.updateMatrixWorld(true);
    for (let j = 0; j < 14; j++) for (let i = 0; i < 12; i++){ const x = -700 + i*140, y = -700 + j*150;
      if (map.heightAt(x, y) < 2 || grid.busy(x, y)) continue;
      rc.set(new THREE.Vector3(x*S, 600, -y*S), dn); const hit = rc.intersectObject(tiles.group, true)[0]; if (hit) diffs.push(gy(x, y) - hit.point.y); }
    if (diffs.length < 15) return;
    diffs.sort((a, b) => a - b); const med = diffs[diffs.length >> 1], iqr = diffs[(diffs.length*3) >> 2] - diffs[diffs.length >> 2];
        if (Math.abs(med) > 60*S || iqr > 12*S) return;   // still the rough first-pass globe: wait for the detailed ground
    calib++; hold.position.y += med; hold.updateMatrixWorld(true);
    renderer.shadowMap.needsUpdate = true; invalidate();
  }
  /* 3D trees where the trees really are: look straight down at Google's photo once it is sharp, find tree canopy (dark green,
     darker than lawns), and grow a leafy 3D tree there, tinted with the photo's own color. Skips buildings, roads, fields and lawns. */
  let planted = false, treeMeshes = [], treeTries = 0;
  function plantTrees(){
    if (!tiles || planted || ++treeTries < 4) return; planted = true;   // wait for a few loading rounds so the photo is sharp
    const phone = matchMedia("(pointer: coarse)").matches, R = phone ? 480 : 760, CX = 200, CY = 620, STEP = phone ? 9 : 7;
    const N = 1024, X0 = CX - R, Y0 = CY - R, W2 = 2*R, rt = new THREE.WebGLRenderTarget(N, N), buf = new Uint8Array(N*N*4);
    const oc = new THREE.OrthographicCamera(-R*S, R*S, R*S, -R*S, 1, 2000); oc.position.set(CX*S, 900, -CY*S); oc.up.set(0, 0, -1); oc.lookAt(CX*S, 0, -CY*S); oc.updateMatrixWorld();
    const vis = scene.children.map(c => c.visible); scene.children.forEach(c => { c.visible = c === hold || c.isLight; });
    renderer.setRenderTarget(rt); renderer.render(scene, oc); renderer.readRenderTargetPixels(rt, 0, 0, N, N, buf); renderer.setRenderTarget(null);
    scene.children.forEach((c, k) => { c.visible = vis[k]; }); rt.dispose();
    const px = (x, y) => { const i = Math.floor((x - X0)/W2*N), j = Math.floor((y - Y0)/W2*N); return (Math.min(N - 1, Math.max(0, j))*N + Math.min(N - 1, Math.max(0, i)))*4; };
    const green = [], grid = map.busyGrid();
    for (let k = 0; k < N*N*4; k += 64){ const r = buf[k], g = buf[k + 1], b = buf[k + 2]; if (g > r && g >= b) green.push(r + g + b); }
    if (green.length < 200) return; green.sort((a, b) => a - b); const dark = green[Math.floor(green.length*0.62)];   // lawns are the brightest greens
    const spots = []; let sd = 11; const rnd = () => (sd = (sd*9301 + 49297) % 233280)/233280;
    for (let y = CY - R; y < CY + R; y += STEP) for (let x = CX - R; x < CX + R; x += STEP){
      const jx = x + (rnd() - 0.5)*STEP, jy = y + (rnd() - 0.5)*STEP; if ((jx - CX)**2 + (jy - CY)**2 > R*R || map.heightAt(jx, jy) < 1.5 || grid.busy(jx, jy)) continue;
      const k = px(jx, jy), r = buf[k], g = buf[k + 1], b = buf[k + 2]; if (!(g > r && g >= b && r + g + b <= dark)) continue;
      spots.push([jx, jy, r, g, b, 0.75 + rnd()*0.55, rnd()]); }
    if (!spots.length) return;
    const crown = new THREE.IcosahedronGeometry(1, 1), pa = crown.attributes.position;   // lumpy, leafy crown
    for (let i = 0; i < pa.count; i++){ const f = 0.82 + ((i*7919) % 23)/23*0.36; pa.setXYZ(i, pa.getX(i)*f, pa.getY(i)*f*0.85, pa.getZ(i)*f); } crown.computeVertexNormals();
    const leaves = new THREE.InstancedMesh(keep(crown), keep(new THREE.MeshStandardMaterial({ roughness: 0.95 })), spots.length*2);
    const trunks = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.22, 0.32, 1, 5)), keep(new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 1 })), spots.length);
    const d = new THREE.Object3D(), c = new THREE.Color(); let n = 0;
    spots.forEach((t, i) => { const sc = t[5], h = (11 + t[6]*7)*sc, cr = (3.2 + t[6]*1.6)*sc, gy0 = gy(t[0], t[1]);
      d.position.set(t[0]*S, gy0 + h*0.3*S, -t[1]*S); d.rotation.set(0, 0, 0); d.scale.set(S, h*0.6*S, S); d.updateMatrix(); trunks.setMatrixAt(i, d.matrix);
      c.setRGB(t[2]/255*1.15, t[3]/255*1.15, t[4]/255*1.1);   // the photo's own canopy color (render target is linear)
      for (let q = 0; q < 2; q++){ const ox = q ? (t[6] - 0.5)*cr*0.9 : 0, oz = q ? (0.5 - t[6])*cr*0.7 : 0, s2 = q ? 0.72 : 1;
        d.position.set((t[0] + ox)*S, gy0 + (h - cr*(q ? 1.3 : 0.9))*S, -(t[1] + oz)*S); d.rotation.set(t[6]*3, i, 0); d.scale.set(cr*s2*S, cr*s2*1.05*S, cr*s2*S); d.updateMatrix();
        leaves.setMatrixAt(n, d.matrix); leaves.setColorAt(n, c.clone().multiplyScalar(q ? 0.92 : 1)); n++; } });
    forest.push(leaves); if (worldReady) world.apply();
    leaves.count = n; leaves.castShadow = trunks.castShadow = true; leaves.receiveShadow = true; scene.add(leaves, trunks); treeMeshes = [leaves, trunks];
    renderer.shadowMap.needsUpdate = true; invalidate();
  }
  async function startTiles(){
    const nc = navigator.connection; if (nc && nc.saveData) return;
    if (!/(^|\.)braedenfonte\.com$|^localhost$/.test(location.hostname)) return;   // the key only works there anyway
    const key = await import("/js/mapkey.js?v=20261114x").then(m => (m.GOOGLE_TILES_KEY || "").trim()).catch(() => "");
    if (!key || dead) return;
    const T = await import("/vendor/tiles3d.module.min.js?v=20261114x"); if (dead) return;
    const t = tiles = new T.TilesRenderer("https://tile.googleapis.com/v1/3dtiles/root.json"), auth = new T.GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: false });
    const f0 = auth.fetchData.bind(auth);   // any refused request (quota hit, bad key, outage) -> back to the built-in map
    auth.fetchData = (uri, opt) => f0(uri, opt).then(r => { if (r.status === 403 || r.status === 429 || (!r.ok && /root\.json/.test(uri))) setTimeout(() => stopTiles("HTTP " + r.status)); return r; },
      e => { if (/root\.json/.test(uri)) setTimeout(() => stopTiles(e)); throw e; });
    t.registerPlugin(auth);
    const draco = new T.DRACOLoader().setDecoderPath("/vendor/draco/"), gltf = new T.GLTFLoader(t.manager); gltf.setDRACOLoader(draco);
    t.manager.addHandler(/\.(gltf|glb)(\?.*)?$/i, gltf);   // Google tile URLs end in ?session=..., and Draco is needed for the detailed pieces
    t.setLatLonToYUp(map.data.lat0*Math.PI/180, map.data.lon0*Math.PI/180);   // tiles: X north, Y up, Z east (meters)
    hold = new THREE.Group(); hold.rotation.y = Math.PI/2; hold.scale.setScalar(S);   // uniform, or the tiles pick the wrong detail level
    hold.position.y = 32*S*VE;   // ellipsoid -> sea level (geoid is ~32 m below the ellipsoid at West Point)
    hold.add(t.group); scene.add(hold); hold.updateMatrixWorld(true);
    t.setCamera(cam); t.setResolutionFromRenderer(cam, renderer);
    t.addEventListener("load-model", ev => { if (!tiles) return; ev.scene.traverse(c => { if (c.material){ tileMats.add(c.material); if (c.material.color) c.material.color.set(world.tint());  } });
      if (!tilesOn){ tilesOn = true; showOwn(false); retheme(); for (const k in outlines) outlines[k].ln.visible = false; if (atHome && !tween) fly(homeFor(), 1100); credit = document.createElement("div"); credit.className = "tiles-credit"; stage.appendChild(credit); } invalidate(); });
    ["load-model", "load-tile-set", "tiles-load-start"].forEach(n => t.addEventListener(n, () => { tilesAct = performance.now(); }));
    t.addEventListener("load-tile-set", () => { const phone = matchMedia("(pointer: coarse)").matches; t.errorTarget = phone ? 12 : 8;
      t.lruCache.minSize = phone ? 500 : 900; t.lruCache.maxSize = phone ? 800 : 1400; invalidate(); });   // cap memory (Google's suggested 6000-8000 tiles is far too heavy for a laptop or phone)   // much sharper than Google's default; only the first (root) request of a visit is billed   // keep asking for tiles while they stream in
    t.addEventListener("tiles-load-end", () => setTimeout(plantTrees, 1800));   // (ground auto-matching is off: it misfired on partly loaded tiles; the fixed 32 m geoid offset lines up)
    t.addEventListener("tiles-load-end", () => { if (credit && tiles){ const a = [...new Set(tiles.getAttributions().filter(x => x.type === "string").flatMap(x => x.value.split(/[;,]\s*/)).filter(Boolean))]; credit.textContent = "Map data: " + (a.length ? a.join(", ") : "Google"); } invalidate(); });
    invalidate();
  }

  /* ---------- weather + time of day. Default "Live": real West Point weather (open-meteo, no key) and the real clock.
     A small panel lets you switch to sunny / rain / snow / fog and day / sunset / night. ---------- */
  /* ---------- campus life: cadets walking the paths, runners all over campus, cars on the real roads (all follow OSM lines) ---------- */
  const life = (() => {
    const lines = D.roads.map(r => ({ c: r.c, P: map.pts(r.p) })).filter(l => l.P.length > 1).map(l => { let L = 0; const cum = [0];
      for (let i = 1; i < l.P.length; i++){ L += Math.hypot(l.P[i][0] - l.P[i - 1][0], l.P[i][1] - l.P[i - 1][1]); cum.push(L); } return Object.assign(l, { L, cum }); }).filter(l => l.L > 30);
    const drive = lines.filter(l => l.c <= 2), walk = lines.filter(l => l.c >= 2), any = lines;
    if (!drive.length || !walk.length) return { on: false, step(){} };
    const pick = (arr, r) => arr[Math.floor(r*arr.length)];
    const at = (l, d) => { let i = 1; while (i < l.cum.length - 1 && l.cum[i] < d) i++; const a = l.P[i - 1], b = l.P[i], f = (d - l.cum[i - 1])/Math.max(0.01, l.cum[i] - l.cum[i - 1]);
      return [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f, Math.atan2(b[1] - a[1], b[0] - a[0])]; };
    let sd = 99; const rnd = () => (sd = (sd*9301 + 49297) % 233280)/233280;
    const mk = (n, arr, speed, side) => Array.from({ length: n }, () => { const l = pick(arr, rnd()); return { l, d: rnd()*l.L, v: speed*(0.8 + rnd()*0.4)*(rnd() < 0.5 ? 1 : -1), side: (rnd() - 0.5)*side }; });
    const mid = l => l.P[Math.floor(l.P.length/2)], core = walk.filter(l => { const m = mid(l); return m[0] > -160 && m[0] < 520 && m[1] > 330 && m[1] < 1120; });
    const crowd = core.length ? core.concat(core, core, core, walk) : walk;   // ~4x more people on the main-campus paths
    const cars = mk(46, drive, 9, 0), walkers = mk(420, crowd, 1.25, 3.5), runners = mk(60, any, 5.2, 2.5);
    const merge = parts => { const pos = [], nor = [], col = []; parts.forEach(([g, c]) => { const n = g.index ? g.toNonIndexed() : g, P = n.attributes.position, N = n.attributes.normal;
        for (let i = 0; i < P.count; i++){ pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c, c, c); } });
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); return g; };
    const part = (g, x, y, z) => { g.translate(x, y, z); return g; };
    // a person: legs, torso, arms, head (skin tone), about 1.75 m; body color comes from the instance color
    // a person: torso, arms, head, cap (body color from the instance), plus two legs that swing as they walk or run
    const person = merge([[part(new THREE.BoxGeometry(0.46, 0.62, 0.26), 0, 1.16, 0), 1], [part(new THREE.BoxGeometry(0.11, 0.58, 0.14), -0.29, 1.15, 0), 1], [part(new THREE.BoxGeometry(0.11, 0.58, 0.14), 0.29, 1.15, 0), 1],
      [part(new THREE.SphereGeometry(0.12, 8, 6), 0, 1.6, 0), 1.7], [part(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 10), 0, 1.71, 0), 0.6]]);
    const legG = new THREE.BoxGeometry(0.15, 0.85, 0.19); legG.translate(0, -0.425, 0);   // hinged at the hip
    // vehicles: sedan, SUV, pickup and a white shuttle bus (body color from the instance, glass and wheels dark)
    const wheels = (xs, r, w) => xs.flatMap(x => [[part(new THREE.CylinderGeometry(r, r, 0.24, 10).rotateX(Math.PI/2), x, r, w), 0.08], [part(new THREE.CylinderGeometry(r, r, 0.24, 10).rotateX(Math.PI/2), x, r, -w), 0.08]]);
    const sedan = merge([[part(new THREE.BoxGeometry(4.5, 0.7, 1.85), 0, 0.62, 0), 1], [part(new THREE.BoxGeometry(2.2, 0.55, 1.7), -0.25, 1.24, 0), 0.22], [part(new THREE.BoxGeometry(0.1, 0.2, 1.5), 2.26, 0.7, 0), 1.6], ...wheels([1.4, -1.4], 0.34, 0.85)]);
    const suv = merge([[part(new THREE.BoxGeometry(4.8, 1.0, 1.95), 0, 0.85, 0), 1], [part(new THREE.BoxGeometry(3.3, 0.7, 1.85), -0.4, 1.7, 0), 0.22], ...wheels([1.55, -1.5], 0.4, 0.9)]);
    const pickup = merge([[part(new THREE.BoxGeometry(5.6, 0.85, 2), 0, 0.8, 0), 1], [part(new THREE.BoxGeometry(1.9, 0.75, 1.9), 0.9, 1.6, 0), 0.22], [part(new THREE.BoxGeometry(2.4, 0.25, 1.9), -1.4, 1.35, 0), 0.5], ...wheels([1.8, -1.8], 0.42, 0.95)]);
    const bus = merge([[part(new THREE.BoxGeometry(12, 2.6, 2.55), 0, 1.75, 0), 1], [part(new THREE.BoxGeometry(11.6, 0.9, 2.6), 0, 2.2, 0), 0.25], [part(new THREE.BoxGeometry(12.05, 0.3, 2.6), 0, 1.1, 0), 0.35], ...wheels([4, -4], 0.5, 1.15)]);
    const im = (geo, n, mat) => { const m = new THREE.InstancedMesh(keep(geo), keep(mat), Math.max(1, n)); m.castShadow = true; m.frustumCulled = false; m.userData.keep = true; scene.add(m); return m; };
    const paint = () => new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.45, vertexColors: true }), cloth = () => new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: true });
    const KIND = cars.map((a, i) => i % 15 === 0 && a.l.c <= 1 ? 3 : i % 4 === 1 ? 1 : i % 7 === 3 ? 2 : 0), CM = [sedan, suv, pickup, bus].map((g, k) => im(g, KIND.filter(q => q === k).length, paint()));
    const walkM = im(person, walkers.length, cloth()), runM = im(person.clone(), runners.length, cloth());
    const legs = im(legG, (walkers.length + runners.length)*2, new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    const c = new THREE.Color(), CAR = [0x1d1f24, 0xe8e8e6, 0x8c929a, 0x24365e, 0x7b1c22, 0x2f4a3a, 0xc9c2b4, 0x3b3f46];
    const slot = KIND.map((k, i) => KIND.slice(0, i).filter(q => q === k).length); cars.forEach((a, i) => CM[KIND[i]].setColorAt(slot[i], c.set(KIND[i] === 3 ? 0xf2f2ee : CAR[i % CAR.length])));
    // cadets in OCP (tan-green), Army gray and black; a few visitors in color. Runners in gray Army PT shirts, black shorts.
    const UNI = [0x7d7a5c, 0x6f6c50, 0x5a606a, 0x2a2e35, 0x7d7a5c, 0x3d6fb5, 0xb03a2e]; walkers.forEach((a, i) => walkM.setColorAt(i, c.set(UNI[i % UNI.length])));
    runners.forEach((a, i) => runM.setColorAt(i, c.set(i % 5 ? 0xa3a8ae : 0x1f2226)));
    let li = 0; [walkers, runners].forEach((arr, r) => arr.forEach((a, i) => { const col = r ? 0x141414 : UNI[i % UNI.length] === 0x7d7a5c || UNI[i % UNI.length] === 0x6f6c50 ? 0x6b6850 : 0x22252a; legs.setColorAt(li++, c.set(col)); legs.setColorAt(li++, c.set(col)); }));
    const o = new THREE.Object3D(); let last = 0;
    const move = (a, k) => { a.d += a.v*k; if (a.d < 0 || a.d > a.l.L){ a.v = -a.v; a.d = Math.max(0, Math.min(a.l.L, a.d)); } const p = at(a.l, a.d), h = p[2] + (a.v < 0 ? Math.PI : 0);
      return [p[0] - Math.sin(p[2])*a.side, p[1] + Math.cos(p[2])*a.side, h]; };
    function placeCars(k){ const n = [0, 0, 0, 0]; cars.forEach((a, i) => { const q = move(a, k), lane = 1.7*Math.sign(a.v), x = q[0] - Math.sin(q[2] - (a.v < 0 ? Math.PI : 0))*lane, y = q[1] + Math.cos(q[2] - (a.v < 0 ? Math.PI : 0))*lane;
        o.position.set(x*S, gy(x, y), -y*S); o.rotation.set(0, q[2], 0); o.scale.setScalar(S*1.9); o.updateMatrix(); CM[KIND[i]].setMatrixAt(n[KIND[i]]++, o.matrix); }); CM.forEach(m => { m.instanceMatrix.needsUpdate = true; }); }
    function placePeople(arr, mesh, run, k, now, l0){ const Z = 2.6, sp = run ? 95 : 190, amp = run ? 0.85 : 0.42; arr.forEach((a, i) => { const q = move(a, k), x = q[0], y = q[1], h = q[2], ph = now/sp + i*1.7, sw = Math.sin(ph)*amp;
        const g = gy(x, y) + (run ? Math.abs(Math.cos(ph))*0.16 : Math.abs(Math.cos(ph))*0.03)*S*Z;
        o.position.set(x*S, g, -y*S); o.rotation.set(0, h, 0, "YXZ"); o.scale.setScalar(S*Z); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
        for (const sd of [-1, 1]){ const ox = Math.sin(h)*0.11*sd*Z, oz = Math.cos(h)*0.11*sd*Z; o.position.set(x*S + ox*S, g + 0.85*S*Z, -y*S + oz*S); o.rotation.set(0, h, sw*sd, "YXZ"); o.updateMatrix(); legs.setMatrixAt(l0++, o.matrix); } });
      mesh.instanceMatrix.needsUpdate = true; legs.instanceMatrix.needsUpdate = true; }
    function step(now){ const k = Math.min(0.1, (now - (last || now))/1000); last = now; if (!api.on) return;
      placeCars(k); placePeople(walkers, walkM, false, k, now, 0); placePeople(runners, runM, true, k, now, walkers.length*2); }
    const api = { on: true, step, show(v){ api.on = v; CM.concat([walkM, runM, legs]).forEach(m => { m.visible = v; }); } };
    step(performance.now()); return api;
  })();

  /* ---------- trains and boats. Tracks are the real OSM lines in /campus/movers.json: CSX River Subdivision on the West Point
     shore (into the tunnel under the Plain), Metro-North / Amtrak Hudson Line on the Garrison shore. Boats follow the Hudson's centerline.
     Everything is one batch of instanced blocks (hulls, cabins, sails, rail cars) so it stays cheap. ---------- */
  const movers = (() => {
    const MAX = 420, box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(keep(box), keep(new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.2 })), MAX); mesh.castShadow = true; mesh.frustumCulled = false; mesh.userData.keep = true; { const w = new THREE.Color(1, 1, 1); for (let i = 0; i < MAX; i++) mesh.setColorAt(i, w); } mesh.count = 0; scene.add(mesh);
    const o = new THREE.Object3D(), col = new THREE.Color(); let n = 0, data = null, last = 0;
    const prep = P => { const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return { P, cum, L: cum[cum.length - 1] }; };
    const at = (l, d) => { let i = 1; while (i < l.cum.length - 1 && l.cum[i] < d) i++; const a = l.P[i - 1], b = l.P[i], f = (d - l.cum[i - 1])/Math.max(0.01, l.cum[i] - l.cum[i - 1]);
      return { x: a[0] + (b[0] - a[0])*f, y: a[1] + (b[1] - a[1])*f, h: Math.atan2(b[1] - a[1], b[0] - a[0]), tun: a[2] && b[2] }; };
    // one block: (x, y) map meters, heading h, length/width/height in meters, lift above base, color
    function blk(x, y, h, len, wid, hei, lift, base, c, fx, fy){ if (n >= MAX) return; const ch = Math.cos(h), sh = Math.sin(h), px = x + ch*(fx || 0) - sh*(fy || 0), py = y + sh*(fx || 0) + ch*(fy || 0);
      o.position.set(px*S, base + lift*S, -py*S); o.rotation.set(0, h, 0); o.scale.set(len*S, hei*S, wid*S); o.updateMatrix(); mesh.setMatrixAt(n, o.matrix); mesh.setColorAt(n, col.set(c)); n++; }
    const trains = [], boats = []; let nextTrain = 4, nextBoat = 2, clock = 0;
    const month = new Date().getMonth(), summer = month >= 4 && month <= 9;
    function spawnTrain(){ if (!data || trains.length >= 2) return; const r = Math.random(), line = data.rail[r < 0.55 ? 0 : 1] || data.rail[0];
      const freight = /River/.test(line.name), dir = Math.random() < 0.5 ? 1 : -1;
      const kind = freight ? { cars: 28 + Math.floor(Math.random()*16), len: 17, gap: 1.2, v: 14, loco: 0x1d2a52, stripe: 0xf2c230, car: [0x5a3a2a, 0x6b6f75, 0x2f3a46, 0x7a4b2e] }
        : Math.random() < 0.7 ? { cars: 6 + Math.floor(Math.random()*3), len: 25.9, gap: 0.8, v: 26, loco: 0xc8ccd2, stripe: 0x1e4f9c, car: [0xc9cdd3] }   // Metro-North
        : { cars: 5, len: 26, gap: 0.8, v: 30, loco: 0x9aa0a8, stripe: 0x1f3c6e, car: [0xc2c6cc] };                                                       // Amtrak
      trains.push(Object.assign({ line, dir, s: dir > 0 ? -30 : line.L + 30 }, kind)); }
    function spawnBoat(){ if (!data || boats.length >= (summer ? 4 : 2)) return; const r = Math.random(), dir = Math.random() < 0.5 ? 1 : -1;
      const kind = summer && r < 0.35 ? { t: "sail", v: 3, len: 9 } : summer && r < 0.5 ? { t: "tour", v: 5, len: 38 } : { t: "tow", v: 3.2, len: 140, barges: 2 + Math.floor(Math.random()*2) };
      boats.push(Object.assign({ dir, s: dir > 0 ? 0 : data.river.L, off: (Math.random() - 0.5)*120 }, kind)); }
    function step(now){ if (!data) return; const dt = Math.min(0.1, (now - (last || now))/1000); last = now; clock += dt; n = 0;
      if (clock > nextTrain){ spawnTrain(); nextTrain = clock + 45 + Math.random()*90; }
      if (clock > nextBoat){ spawnBoat(); nextBoat = clock + 30 + Math.random()*60; }
      for (let i = trains.length - 1; i >= 0; i--){ const t = trains[i]; t.s += t.v*t.dir*dt; const tot = (t.cars + 1)*(t.len + t.gap);
        if ((t.dir > 0 && t.s - tot > t.line.L) || (t.dir < 0 && t.s + tot < 0)){ trains.splice(i, 1); continue; }
        for (let k = 0; k <= t.cars; k++){ const d = t.s - t.dir*k*(t.len + t.gap); if (d < 0 || d > t.line.L) continue; const q = at(t.line, d); if (q.tun) continue;
          const g = gy(q.x, q.y) + 0.4*S, h = q.h + (t.dir < 0 ? Math.PI : 0);
          if (k === 0){ blk(q.x, q.y, h, t.len, 3.1, 4.3, 0, g, t.loco); blk(q.x, q.y, h, t.len + 0.1, 3.15, 0.5, 2.2, g, t.stripe); }
          else { blk(q.x, q.y, h, t.len, 3.0, t.car.length > 1 ? 3.9 : 4.1, 0, g, t.car[k % t.car.length]); if (t.car.length === 1) blk(q.x, q.y, h, t.len + 0.05, 3.05, 0.35, 1.2, g, t.stripe); } } }
      const R = data.river, w0 = 0.25*S;
      for (let i = boats.length - 1; i >= 0; i--){ const b = boats[i]; b.s += b.v*b.dir*dt; if (b.s < -200 || b.s > R.L + 200){ boats.splice(i, 1); continue; }
        const q = at(R, Math.max(0, Math.min(R.L, b.s))), h = q.h + (b.dir < 0 ? Math.PI : 0), side = b.off;
        const x = q.x - Math.sin(q.h)*side, y = q.y + Math.cos(q.h)*side;
        if (b.t === "sail"){ blk(x, y, h, 9, 3, 1.2, 0, w0, 0xf4f4f2); blk(x, y, h, 0.15, 0.15, 11, 1.2, w0, 0xdddddd); blk(x, y, h, 4.5, 0.08, 9, 2, w0, 0xffffff, -1.2); }
        else if (b.t === "tour"){ blk(x, y, h, 38, 9, 2.4, 0, w0, 0xf2f2ef); blk(x, y, h, 26, 7.5, 2.6, 2.4, w0, 0xe6e8ea, -2); blk(x, y, h, 20, 7, 0.3, 5, w0, 0x1d3f6e, -2); }
        else { blk(x, y, h, 20, 8, 3.2, 0, w0, 0x9b2a24); blk(x, y, h, 7, 6, 4, 3.2, w0, 0xf0efe9, -3); blk(x, y, h, 1, 1, 3, 7.2, w0, 0x222222, -3);   // tug pushing
          for (let k = 0; k < b.barges; k++){ const f = 10 + 32 + k*62; blk(x, y, h, 60, 11, 3, 0, w0, 0x3b3a38, f); blk(x, y, h, 54, 9.5, 1.6, 3, w0, k % 2 ? 0x6b5a45 : 0x4a4f55, f); } } }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    fetch("/campus/movers.json?v=20261114x").then(r => r.json()).then(j => { data = { rail: j.rail.map(r => Object.assign(prep(r.p), { name: r.name })), river: prep(j.river) }; }).catch(() => {});
    return { step };
  })();

  /* ---------- sky and wildlife: songbird flocks, hawks over the river cliffs, Canada geese on the Plain, deer on the wooded hills,
     and a rare Army Black Hawk up the Hudson that sometimes drops parachutists onto the Plain ---------- */
  const sky = (() => {
    const MAX = 700, box = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(keep(box), keep(new THREE.MeshStandardMaterial({ roughness: 0.8 })), MAX); mesh.castShadow = true; mesh.frustumCulled = false; mesh.userData.keep = true;
    { const w = new THREE.Color(1, 1, 1); for (let i = 0; i < MAX; i++) mesh.setColorAt(i, w); } mesh.count = 0; scene.add(mesh);
    const o = new THREE.Object3D(), col = new THREE.Color(); let n = 0, last = 0, clock = 0;
    // block centered at map (x, y), world height wy, heading h (+ optional pitch / roll), size in meters
    function blk(x, y, wy, h, len, wid, hei, c, fx, fy, fz, pitch, roll){ if (n >= MAX) return; const ch = Math.cos(h), sh = Math.sin(h), px = x + ch*(fx || 0) - sh*(fy || 0), py = y + sh*(fx || 0) + ch*(fy || 0);
      o.position.set(px*S, wy + (fz || 0)*S, -py*S); o.rotation.set(roll || 0, h, pitch || 0, "YZX"); o.scale.set(len*S, hei*S, wid*S); o.updateMatrix(); mesh.setMatrixAt(n, o.matrix); mesh.setColorAt(n, col.set(c)); n++; }
    const rnd = Math.random, grid = map.busyGrid();
    // songbird flocks circling over campus and the river
    const flocks = Array.from({ length: 6 }, () => ({ cx: -300 + rnd()*1400, cy: 0 + rnd()*1700, r: 200 + rnd()*300, alt: 170 + rnd()*150, sp: 0.12 + rnd()*0.1, ph: rnd()*6, birds: Array.from({ length: 7 + Math.floor(rnd()*9) }, () => [(rnd() - 0.5)*30, (rnd() - 0.5)*30, (rnd() - 0.5)*8, rnd()*6]) }));
    const hawks = Array.from({ length: 3 }, (_, i) => ({ cx: 620 + i*90, cy: 450 + i*260, r: 60 + rnd()*50, alt: 230 + rnd()*90, sp: 0.05 + rnd()*0.03, ph: rnd()*6 }));
    const geese = Array.from({ length: 22 }, () => ({ x: 120 + (rnd() - 0.5)*160, y: 840 + (rnd() - 0.5)*140, h: rnd()*6, t: rnd()*10 }));
    const deer = []; for (let k = 0; k < 2000 && deer.length < 28; k++){ const x = -700 + rnd()*1500, y = -400 + rnd()*1700; if (map.heightAt(x, y) < 8 || grid.busy(x, y) || Math.hypot(x - 150, y - 600) > 1000) continue; deer.push({ hx: x, hy: y, x, y, h: rnd()*6, t: rnd()*10 }); }
    // Black Hawk route up the river; on drop runs it swings over the Plain
    const RIVER = [[420, -1500], [760, -100], [1050, 700], [880, 1450], [100, 2150]], PLAIN = [178, 828];
    const force = /[?&]heli=1/.test(location.search); let heli = null, nextHeli = force ? 3 : 50 + rnd()*60; const jumpers = [];   // ?heli=1 shows the drop right away
    const path = (pts, d) => { let acc = 0; for (let i = 1; i < pts.length; i++){ const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc + L >= d){ const f = (d - acc)/L; return [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f, Math.atan2(b[1] - a[1], b[0] - a[0])]; } acc += L; } return null; };
    const total = pts => pts.reduce((a, p, i) => i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0);
    function step(now){ const dt = Math.min(0.1, (now - (last || now))/1000); last = now; clock += dt; n = 0; const t = clock;
      flocks.forEach(f => { const a = f.ph + t*f.sp, cx = f.cx + Math.cos(a)*f.r, cy = f.cy + Math.sin(a)*f.r, h = a + Math.PI/2;
        f.birds.forEach(b => { const fl = 0.35 + Math.abs(Math.sin(t*14 + b[3]))*0.65, x = cx + b[0], y = cy + b[1]; blk(x, y, gy(x, y) + (f.alt + b[2])*S, h, 1.3, 3.4*fl, 0.3, 0x2b2b2b); }); });
      hawks.forEach(k => { const a = k.ph + t*k.sp, x = k.cx + Math.cos(a)*k.r, y = k.cy + Math.sin(a)*k.r, wy = gy(x, y) + k.alt*S; blk(x, y, wy, a + Math.PI/2, 2.6, 7, 0.4, 0x5a4330, 0, 0, 0, 0, 0.25); blk(x, y, wy, a + Math.PI/2, 1.2, 1, 0.5, 0xe9e3d6, 1); });
      geese.forEach((g, i) => { g.t -= dt; if (g.t < 0){ g.t = 3 + rnd()*8; g.h += (rnd() - 0.5)*2; } const v = Math.sin(t*0.5 + i) > 0.6 ? 0.35 : 0; g.x += Math.cos(g.h)*v*dt; g.y += Math.sin(g.h)*v*dt;
        const gw = gy(g.x, g.y); blk(g.x, g.y, gw, g.h, 0.9, 0.45, 0.45, 0x7a6a58, 0, 0, 0.25); blk(g.x, g.y, gw, g.h, 0.12, 0.12, 0.55, 0x161616, 0.42, 0, 0.45); blk(g.x, g.y, gw, g.h, 0.25, 0.14, 0.1, 0xe8e4dc, 0.48, 0, 0.92); });
      deer.forEach((d, i) => { d.t -= dt; if (d.t < 0){ d.t = 4 + rnd()*10; d.h = Math.atan2(d.hy - d.y + (rnd() - 0.5)*40, d.hx - d.x + (rnd() - 0.5)*40); } const v = Math.sin(t*0.3 + i*2) > 0.3 ? 0.6 : 0; d.x += Math.cos(d.h)*v*dt; d.y += Math.sin(d.h)*v*dt;
        const dw = gy(d.x, d.y), K = 2.4; blk(d.x, d.y, dw, d.h, 1.5*K, 0.45*K, 0.6*K, 0x8a6240, 0, 0, 0.8*K); blk(d.x, d.y, dw, d.h, 0.4*K, 0.3*K, 0.6*K, 0x7b5537, 0.8*K, 0, 1.15*K); blk(d.x, d.y, dw, d.h, 0.3*K, 0.2*K, 0.25*K, 0xf1ece4, -0.8*K, 0, 0.95*K);
        for (const [lx, ly] of [[0.6, 0.15], [0.6, -0.15], [-0.6, 0.15], [-0.6, -0.15]]) blk(d.x, d.y, dw, d.h, 0.1*K, 0.1*K, 0.8*K, 0x5c4028, lx*K, ly*K, 0.4*K); });
      // Black Hawk
      if (!heli && clock > nextHeli){ const drop = force || rnd() < 0.45, pts = drop ? [RIVER[0], RIVER[1], [600, 500], PLAIN, [700, 1300], RIVER[4]] : RIVER; heli = { pts, L: total(pts), d: 0, drop, dropped: false }; nextHeli = clock + 240 + rnd()*300; }
      if (heli){ heli.d += 62*dt; const q = path(heli.pts, heli.d); if (!q) heli = null; else {
          const nearPlain = Math.hypot(q[0] - PLAIN[0], q[1] - PLAIN[1]), alt = heli.drop ? 160 + Math.max(0, 260 - nearPlain*0.4) : 150, wy = gy(q[0], q[1]) + alt*S, C = 0x2d3328;
          blk(q[0], q[1], wy, q[2], 11, 2.4, 2.6, C); blk(q[0], q[1], wy, q[2], 7, 0.6, 0.8, C, -8.5, 0, 1.4); blk(q[0], q[1], wy, q[2], 0.3, 0.2, 2, C, -12, 0, 1.6);   // body, tail boom, tail fin
          blk(q[0], q[1], wy, q[2], 1.8, 1.9, 0.6, 0x1b2330, 4.6, 0, 1.2);   // cockpit glass
          for (let r = 0; r < 4; r++) blk(q[0], q[1], wy, q[2] + clock*28 + r*Math.PI/2, 8, 0.45, 0.08, 0x151515, 0, 0, 3.1);   // spinning main rotor
          if (heli.drop && !heli.dropped && nearPlain < 40){ heli.dropped = true; for (let k = 0; k < 6; k++) jumpers.push({ x: q[0] + (k - 2.5)*14*Math.cos(q[2]), y: q[1] + (k - 2.5)*14*Math.sin(q[2]), alt: alt - 4, h: rnd()*6, land: 0 }); } } }
      for (let i = jumpers.length - 1; i >= 0; i--){ const j = jumpers[i];
        if (j.alt > 0){ j.alt = Math.max(0, j.alt - 7*dt); j.x += (PLAIN[0] - j.x)*0.02*dt + Math.cos(t*0.3 + i)*2*dt; j.y += (PLAIN[1] - j.y)*0.02*dt; j.h += 0.2*dt; } else if ((j.land += dt) > 25){ jumpers.splice(i, 1); continue; }
        const wy = gy(j.x, j.y) + j.alt*S; blk(j.x, j.y, wy, j.h, 0.45, 0.45, 1.75, 0x4b5320, 0, 0, 0.9);   // jumper in OCP
        if (j.alt > 0) blk(j.x, j.y, wy, j.h, 3.2, 7, 0.6, j.alt > 40 && i % 2 ? 0x3a4030 : 0x2a2f24, 0, 0, 7.5); }   // canopy
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    return { step, drop(){ const pts = [[820, 300], [600, 560], PLAIN, [700, 1300], RIVER[4]]; heli = { pts, L: total(pts), d: 0, drop: true, dropped: false }; } };
  })();

  /* ---------- campus events on the real clock (America/New_York), and on demand from the panel:
     flag up at reveille (06:30) and down at retreat (17:00) with the cannon at Trophy Point; company formations on the Plain (weekday
     mornings, Saturday parades in season, with the band); PT runs in formation at dawn; Army home football from /data/daily.json
     (crowds at Michie, tailgates in the lots, a jet flyover before kickoff); baseball at Doubleday Field; soccer on Daly Field;
     visitors and tour buses at Trophy Point and the Thayer Hotel. ---------- */
  const events = (() => {
    const MAX = 2600, box = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(keep(box), keep(new THREE.MeshStandardMaterial({ roughness: 0.75 })), MAX); mesh.castShadow = true; mesh.frustumCulled = false; mesh.userData.keep = true;
    { const w = new THREE.Color(1, 1, 1); for (let i = 0; i < MAX; i++) mesh.setColorAt(i, w); } mesh.count = 0; scene.add(mesh);
    const smokeMat = keep(new THREE.MeshStandardMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.6, roughness: 1 })), smoke = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 12, 10)), smokeMat); smoke.visible = false; smoke.userData.keep = true; scene.add(smoke);
    const o = new THREE.Object3D(), col = new THREE.Color(); let n = 0, last = 0, clock = 0;
    function blk(x, y, wy, h, len, wid, hei, c, fx, fy, fz){ if (n >= MAX) return; const ch = Math.cos(h), sh = Math.sin(h), px = x + ch*(fx || 0) - sh*(fy || 0), py = y + sh*(fx || 0) + ch*(fy || 0);
      o.position.set(px*S, wy + ((fz || 0) + hei/2)*S, -py*S); o.rotation.set(0, h, 0); o.scale.set(len*S, hei*S, wid*S); o.updateMatrix(); mesh.setMatrixAt(n, o.matrix); mesh.setColorAt(n, col.set(c)); n++; }
    const P = 2.2, person = (x, y, h, c, bob, legs) => { const g = gy(x, y) + (bob || 0)*S; blk(x, y, g, h, 0.22*P, 0.42*P, 0.85*P, legs || 0x22252a); blk(x, y, g, h, 0.28*P, 0.48*P, 0.65*P, c, 0, 0, 0.85*P); blk(x, y, g, h, 0.22*P, 0.22*P, 0.24*P, 0xd9b38c, 0, 0, 1.5*P); };
    // real New York time
    const nyNow = () => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit", month: "numeric", day: "numeric", year: "numeric" }).formatToParts(new Date());
      const g = t => (p.find(q => q.type === t) || {}).value; return { h: +g("hour") % 24 + +g("minute")/60, wd: g("weekday"), mo: +g("month"), d: +g("day"), y: +g("year") }; };
    let manual = null, manualT = 0;   // an event started from the panel runs for a few minutes
    let homeGame = null;
    fetch("/data/daily.json", { cache: "no-store" }).then(r => r.json()).then(j => { const t = nyNow(); (((j.football || {}).upcoming) || []).forEach(g => { if (!g.army || !/home|michie/i.test((g.note || "") + g.home)) return;
      const k = new Date(g.kick), kd = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "numeric", day: "numeric" }).format(k);
      if (kd === t.mo + "/" + t.d) homeGame = { kick: k, vs: g.away }; }); }).catch(() => {});
    const FLAG = [150, 926], CANNON = [262, 1004], PLAIN = [190, 800], MICHIE = [-356, 185], DOUBLEDAY = [437, 730], DALY = [366, 922], TROPHY = [234, 1015], HOTEL = [-103, -955];
    const LOTS = [[-510, 287], [-578, 319], [-639, 221], [-795, 297], [-564, 532]], rnd = Math.random;
    // fixed random layouts (made once so people don't jump around)
    const R = k => Array.from({ length: k }, () => [rnd(), rnd(), rnd()]);
    const crowd = R(380), tail = R(90), fans = R(40), visitors = R(46), soccer = R(22), ptCols = R(4);
    let flagH = -1, smokeT = -1, lastFire = -1, jets = -1;
    function active(t){ const wk = !/Sat|Sun/.test(t.wd), parSeason = [4, 5, 8, 9, 10].includes(t.mo);
      const m = manual && clock - manualT < 240 ? manual : null;
      return { form: m === "parade" || (wk && t.h > 6.75 && t.h < 7.25) || (t.wd === "Sat" && parSeason && t.h > 10 && t.h < 11.5), band: m === "parade" || (t.wd === "Sat" && parSeason && t.h > 10 && t.h < 11.5),
        pt: m === "pt" || (wk && t.h > 5.75 && t.h < 6.9), game: m === "game" || (homeGame && Math.abs(Date.now() - homeGame.kick)/36e5 < 4),
        baseball: m === "ball" || ([3, 4, 5].includes(t.mo) && t.h > 13 && t.h < 17), soccer: m === "ball" || ([8, 9, 10, 11].includes(t.mo) && t.h > 15 && t.h < 18.5),
        visitors: t.h > 9 && t.h < 17.5, retreat: m === "retreat" }; }
    function step(now){ const dt = Math.min(0.1, (now - (last || now))/1000); last = now; clock += dt; n = 0; const t = nyNow(), A = active(t), T = clock;
      // flag: up 06:30-17:00, eased over a minute; "Retreat" from the panel lowers it now; cannon smoke at reveille and retreat
      const up = A.retreat ? 0 : t.h >= 6.5 && t.h < 17 ? 1 : 0; flagH = flagH < 0 ? up : flagH + Math.sign(up - flagH)*Math.min(Math.abs(up - flagH), dt/60*(A.retreat ? 4 : 1));
      const fg = gy(FLAG[0], FLAG[1]); blk(FLAG[0], FLAG[1], fg, 0, 0.45, 0.45, 32, 0xdddddd); blk(FLAG[0], FLAG[1], fg, 0, 0.9, 0.9, 0.7, 0xc9a54a, 0, 0, 32);
      const wave = Math.sin(T*3)*0.12; blk(FLAG[0], FLAG[1], fg, 0.3 + wave, 7, 0.12, 4.2, 0xb22234, 3.6, 0, 3 + flagH*24.5); blk(FLAG[0], FLAG[1], fg, 0.3 + wave, 2.8, 0.13, 2.2, 0x3c3b6e, 1.5, 0, 5 + flagH*24.5);
      const fire = (Math.abs(t.h - 6.5) < 0.004 || Math.abs(t.h - 17) < 0.004 || (A.retreat && clock - manualT < 0.5)); if (fire && clock - lastFire > 60){ lastFire = clock; smokeT = 0; }
      const cg = gy(CANNON[0], CANNON[1]); blk(CANNON[0], CANNON[1], cg, 0.6, 3, 0.6, 0.6, 0x2b2b2b, 0, 0, 0.9); blk(CANNON[0], CANNON[1], cg, 0.6, 1.4, 1.5, 1.2, 0x5a4a35);
      if (smokeT >= 0){ smokeT += dt; const k = smokeT/14; smoke.visible = k < 1; smoke.position.set((CANNON[0] + 6 + k*20)*S, cg + (2 + k*14)*S, -(CANNON[1] + k*6)*S); smoke.scale.setScalar((2 + k*16)*S); smokeMat.opacity = 0.7*(1 - k); if (k >= 1) smokeT = -1; }
      // company formations marching across the Plain, band in front on parade days
      if (A.form){ for (let c = 0; c < 6; c++){ const lane = -150 + c*58, prog = ((T*1.1 + c*35) % 300) - 150;
          for (let r = 0; r < 9; r++) for (let f = 0; f < 4; f++){ const x = PLAIN[0] + prog - r*1.6, y = PLAIN[1] + lane*0.6 + f*1.4 + (c % 2 ? 40 : -40); person(x, y, 0, 0x50565f, Math.abs(Math.sin(T*6 + r))*0.06, 0xdcdcd6); } }
        if (A.band) for (let r = 0; r < 6; r++) for (let f = 0; f < 6; f++){ const x = PLAIN[0] - 20 + ((T*1.1) % 300) - 150 - r*1.6, y = PLAIN[1] - 110 + f*1.5; person(x, y, 0, 0x1a1f2e, 0, 0x1a1f2e); if (f % 2 === 0) blk(x, y, gy(x, y), 0, 0.4, 0.4, 0.3, 0xd4af37, 0, 0, 1.75); } }
      // PT: columns of runners in formation looping the Plain road
      if (A.pt) ptCols.forEach((q, c) => { const a = T*0.035 + c*1.6; for (let r = 0; r < 12; r++) for (let f = 0; f < 3; f++){ const aa = a - r*0.006, x = PLAIN[0] + Math.cos(aa)*(150 + f*1.5), y = PLAIN[1] + Math.sin(aa)*(95 + f*1.5); person(x, y, aa + Math.PI/2, f === 0 && r === 0 ? 0xf1c232 : 0x9aa0a6, Math.abs(Math.sin(T*9 + r))*0.15, 0x111111); } });
      // Army home football: crowd around Michie, tailgates in the lots, jet flyover 10 minutes before kick (or right away from the panel)
      if (A.game){ crowd.forEach((q, i) => { const a = q[0]*6.28, r = 85 + q[1]*55; person(MICHIE[0] + Math.cos(a)*r, MICHIE[1] + Math.sin(a)*r*0.8, a, [0x111111, 0xd4af37, 0x1d1d1d, 0x6b6b6b][i % 4], Math.abs(Math.sin(T*2 + i))*0.05); });
        tail.forEach((q, i) => { const L = LOTS[i % LOTS.length], x = L[0] + (q[0] - 0.5)*60, y = L[1] + (q[1] - 0.5)*40, g = gy(x, y); blk(x, y, g, q[2]*0.4, 4.6, 1.9, 1.5, [0xeeeeee, 0x222222, 0x8a1c1c, 0x2a4b7c][i % 4]);
          if (i % 3 === 0){ blk(x, y, g, 0, 3, 3, 0.08, 0xd4af37, 4, 0, 2.6); blk(x, y, g, 0, 0.1, 0.1, 2.6, 0x555555, 4, 0, 0); person(x + 3, y + 2, i, 0x111111); person(x + 5, y - 1, i + 1, 0xd4af37); } });
        if (jets < 0 && (manual === "game" || (homeGame && homeGame.kick - Date.now() < 6e5 && homeGame.kick - Date.now() > 0))) jets = 0; }
      if (jets >= 0){ jets += dt; const k = jets/22; if (k > 1) jets = -1; else for (let j = 0; j < 4; j++){ const x = 800 - k*2000 + j*-14, y = MICHIE[1] + 200 - k*300 + (j % 2 ? 12 : -12)*(j > 1 ? 2 : 1), g = 280*S + gy(MICHIE[0], MICHIE[1]); blk(x, y, g, Math.atan2(-300, -2000), 16, 2, 2, 0x5d6168); blk(x, y, g, Math.atan2(-300, -2000), 5, 11, 0.4, 0x5d6168, -2); } }
      // baseball at Doubleday: 9 fielders, a batter, catcher, umpire, fans on the side
      if (A.baseball){ const B = DOUBLEDAY, pos = [[0, 0], [-18, 18], [18, 18], [0, 30], [-26, 30], [26, 30], [-45, 60], [0, 75], [45, 60]];
        pos.forEach((q, i) => person(B[0] + q[0], B[1] - 35 + q[1], -Math.PI/2, 0xd8d8d8, i === 0 ? Math.abs(Math.sin(T*1.5))*0.2 : 0, 0x222222));
        person(B[0], B[1] - 45, Math.PI/2, 0x1a1a1a, 0, 0xd4af37); person(B[0], B[1] - 47, Math.PI/2, 0x555555); person(B[0], B[1] - 49, Math.PI/2, 0x111111);
        const ph = (T % 6)/6; if (ph < 0.5){ const k = ph*2; blk(B[0], B[1] - 35 - k*10, gy(B[0], B[1]) + (1.5 + Math.sin(k*3.14)*2)*S, 0, 0.3, 0.3, 0.3, 0xffffff); }
        fans.forEach((q, i) => person(B[0] - 70 + q[0]*30, B[1] - 60 + q[1]*40, 0, [0x111111, 0xd4af37, 0x777777][i % 3])); }
      // soccer on Daly Field: two teams chasing the ball
      if (A.soccer){ const bx = DALY[0] + Math.sin(T*0.37)*18, by = DALY[1] + Math.sin(T*0.23)*40;
        soccer.forEach((q, i) => { const tx = bx + (q[0] - 0.5)*30, ty = by + (q[1] - 0.5)*55 + Math.sin(T*0.8 + i)*4; person(tx, ty, Math.atan2(by - ty, bx - tx), i < 11 ? 0x111111 : 0xf2f2f2, Math.abs(Math.sin(T*8 + i))*0.12, i < 11 ? 0xd4af37 : 0x1d3f6e); });
        blk(bx, by, gy(bx, by), 0, 0.35, 0.35, 0.35, 0xffffff); }
      // visitors with cameras at Trophy Point and outside the Thayer Hotel, two tour buses
      if (A.visitors){ visitors.forEach((q, i) => { const P = i < 32 ? TROPHY : HOTEL, x = P[0] + (q[0] - 0.5)*70 + Math.sin(T*0.05 + i)*3, y = P[1] + (q[1] - 0.5)*50; person(x, y, q[2]*6, [0x2f6db5, 0xc0392b, 0xf1c40f, 0x27ae60, 0xffffff, 0x8e44ad][i % 6]); });
        [[305, 1065, 0.3], [-60, -910, 1.9]].forEach(([x, y, h]) => { const g = gy(x, y); blk(x, y, g, h, 12.5, 2.6, 3.4, 0xf4f4f4, 0, 0, 0.4); blk(x, y, g, h, 12.6, 2.65, 0.9, 0x1d3f6e, 0, 0, 1.6); }); }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    return { step, start(k){ if (k === "cannon"){ smokeT = 0; lastFire = clock; return; } manual = k; manualT = clock; if (k === "retreat"){ smokeT = 0; lastFire = clock; } } };
  })();

  let worldReady = false;
  const world = (() => {
    let tintNow = 0xffffff; const st = { season: "live", wx: "live", tod: "live", liveWx: "clear", liveTod: "day" }, N = 6000, pos = new Float32Array(N*6), vel = new Float32Array(N);
    const g = keep(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const rainMat = keep(new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.55 })), snowMat = keep(new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.9 }));
    const rain = new THREE.LineSegments(g, rainMat), snow = new THREE.Points(g, snowMat); rain.frustumCulled = snow.frustumCulled = false; rain.visible = snow.visible = false; rain.userData.keep = snow.userData.keep = true; scene.add(rain, snow);
    let kind = "clear", last = 0, box = 40; const rnd = Math.random;
    function seed(){ box = Math.max(12, cur.dist*0.9); for (let i = 0; i < N; i++){ const x = cur.tx + (rnd() - 0.5)*box*2, y = cur.ty + rnd()*box*0.9, z = cur.tz + (rnd() - 0.5)*box*2; pos.set([x, y, z, x, y - 0.012*box, z], i*6); vel[i] = 0.6 + rnd()*0.5; } g.attributes.position.needsUpdate = true; }
    const wxNow = () => st.wx === "live" ? st.liveWx : st.wx, todNow = () => st.tod === "live" ? st.liveTod : st.tod;
    const seasonNow = () => { if (st.season !== "live") return st.season; const m = new Date().getMonth() + 1; return m === 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : m <= 11 ? "fall" : "winter"; };
    // street lamps along the campus roads: warm glows that switch on at sunset and night
    const lampPts = []; D.roads.filter(r => r.c <= 2).forEach(r => { const P = map.pts(r.p); let acc = 0;
      for (let i = 1; i < P.length; i++){ const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = (40 - acc % 40); d < L; d += 40){ const x = a[0] + (b[0] - a[0])*d/L, y = a[1] + (b[1] - a[1])*d/L;
        if (Math.hypot(x - 200, y - 600) < 1100) lampPts.push(x*S, gy(x, y) + 6*S, -y*S); } acc += L; } });
    const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,230,170,1)"); r.addColorStop(0.25, "rgba(255,200,120,.65)"); r.addColorStop(1, "rgba(255,180,90,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return keep(new THREE.CanvasTexture(c)); })();
    const lg = keep(new THREE.BufferGeometry()); lg.setAttribute("position", new THREE.Float32BufferAttribute(lampPts, 3));
    const lamps = new THREE.Points(lg, keep(new THREE.PointsMaterial({ map: glowTex, size: 11, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    lamps.visible = false; lamps.userData.keep = true; scene.add(lamps);
    // seasons: fall reds/oranges/golds, bare winter branches (evergreens stay), fresh spring green, full summer green
    const base = new Map(), cc = new THREE.Color(), FALL = [0xc8551e, 0xb5321e, 0xd99a22, 0xe0b23a, 0x8a3a1c];
    function applySeason(){ const se = seasonNow(); forest.forEach(m => { if (!m.instanceColor) return; if (!base.has(m)) base.set(m, m.instanceColor.array.slice()); const b = base.get(m), a = m.instanceColor.array;
      for (let i = 0; i < m.count; i++){ const k = i*3, h = (i*2654435761 >>> 0) % 100; cc.setRGB(b[k], b[k + 1], b[k + 2]);
        if (se === "fall" && h < 78) cc.lerp(new THREE.Color(FALL[h % FALL.length]), 0.75);
        else if (se === "winter" && h < 70) cc.setRGB(0.36, 0.31, 0.27);
        else if (se === "spring") cc.lerp(new THREE.Color(0x8fcf5a), 0.35);
        a[k] = cc.r; a[k + 1] = cc.g; a[k + 2] = cc.b; } m.instanceColor.needsUpdate = true; }); }
    function apply(){
      kind = wxNow(); const tod = todNow(), night = tod === "night", dusk = tod === "sunset";
      rain.visible = kind === "rain"; snow.visible = kind === "snow"; if (rain.visible || snow.visible) seed();
      const fogCol = night ? 0x1b2640 : kind === "fog" ? 0xc9ccd0 : kind === "rain" ? 0x8d949c : kind === "snow" ? 0xd7dbe0 : dusk ? 0xe8b48c : 0xbcd2ea;
      fogK = kind === "fog" ? [0.55, 2.8] : kind === "rain" || kind === "snow" ? [1.3, 5.5] : night ? [3, 12] : null;
      scene.fog = fogK ? new THREE.Fog(fogCol, cur.dist*fogK[0], cur.dist*fogK[1]) : null;
      scene.background = kind === "clear" || night ? skyTex(night ? ["#0c1424", "#1d2c4a", "#3a4d73"] : dusk ? ["#3b4f86", "#d98a63", "#ffd3a1"] : ["#3f7fd0", "#8fbbe8", "#e3eef7"]) : new THREE.Color(fogCol);
      const tint = night ? 0x7380a0 : dusk ? 0xffd2b0 : kind === "rain" ? 0xb4b8bd : kind === "snow" ? 0xe9edf2 : kind === "fog" ? 0xd0d3d6 : 0xffffff;
      tintNow = tint; tileMats.forEach(m => m.color && m.color.set(tint));
      hemi.intensity = night ? 0.9 : kind === "clear" ? 1.5 : 1.15; sun.intensity = night ? 0.25 : kind === "clear" ? (dusk ? 1.6 : 2.5) : 0.9; sun.color.set(dusk ? 0xffb37a : night ? 0x9fb4ff : 0xfff3df);
      wallMat.emissiveIntensity = night ? 0.9 : 0; lamps.visible = night || dusk; applySeason(); renderer.shadowMap.needsUpdate = true;
      panel.querySelectorAll("button[data-k]").forEach(b => b.classList.toggle("on", st[b.dataset.k] === b.dataset.v)); invalidate();
    }
    let fogK = null;
    const skies = {}; function skyTex(stops){ const k = stops.join(); if (skies[k]) return skies[k]; const c = document.createElement("canvas"); c.width = 4; c.height = 256; const g = c.getContext("2d"), lg = g.createLinearGradient(0, 0, 0, 256);
      lg.addColorStop(0, stops[0]); lg.addColorStop(0.55, stops[1]); lg.addColorStop(1, stops[2]); g.fillStyle = lg; g.fillRect(0, 0, 4, 256); const t = keep(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return (skies[k] = t); }
    function step(now){ if (scene.fog && fogK){ scene.fog.near = cur.dist*fogK[0]; scene.fog.far = cur.dist*fogK[1]; }
      if (!rain.visible && !snow.visible){ last = now; return false; }
      const dt = Math.min(0.05, (now - (last || now))/1000); last = now; const fall = (kind === "rain" ? 2.2 : 0.18)*box*dt, bot = cur.ty - box*0.1;
      for (let i = 0; i < N; i++){ const k = i*6; let y = pos[k + 1] - fall*vel[i];
        if (kind === "snow"){ pos[k] += Math.sin(now/900 + i)*0.002*box; pos[k + 2] += Math.cos(now/1100 + i)*0.002*box; }
        if (y < bot){ y = cur.ty + box*0.9; pos[k] = cur.tx + (rnd() - 0.5)*box*2; pos[k + 2] = cur.tz + (rnd() - 0.5)*box*2; }
        pos[k + 1] = y; pos[k + 3] = pos[k]; pos[k + 4] = y - (kind === "rain" ? 0.02*box : 0); pos[k + 5] = pos[k + 2]; }
      g.attributes.position.needsUpdate = true; return true; }
    const panel = document.createElement("div"); panel.className = "wx-panel";
    panel.innerHTML = '<span class="wx-h">Weather</span>' + [["live", "Live"], ["clear", "Sun"], ["rain", "Rain"], ["snow", "Snow"], ["fog", "Fog"]].map(([v, t]) => '<button type="button" data-k="wx" data-v="' + v + '">' + t + '</button>').join("") +
      '<span class="wx-h">Time</span>' + [["live", "Live"], ["day", "Day"], ["sunset", "Sunset"], ["night", "Night"]].map(([v, t]) => '<button type="button" data-k="tod" data-v="' + v + '">' + t + '</button>').join("") +
      '<span class="wx-h">Season</span>' + [["live", "Live"], ["spring", "Spring"], ["summer", "Summer"], ["fall", "Fall"], ["winter", "Winter"]].map(([v, t]) => '<button type="button" data-k="season" data-v="' + v + '">' + t + '</button>').join("") +
      '<span class="wx-h">Start an event</span>' + [["chute", "Parachute drop"], ["cannon", "Fire cannon"], ["parade", "Parade"], ["retreat", "Retreat"], ["pt", "PT run"], ["game", "Game day"], ["ball", "Ball games"]].map(([v, t]) => '<button type="button" data-ev="' + v + '">' + t + '</button>').join("");
    panel.insertAdjacentHTML("afterbegin", '<button type="button" class="wx-toggle" aria-expanded="true">Controls</button>');
    if (matchMedia("(max-width:860px)").matches) panel.classList.add("closed");
    panel.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("wx-toggle")){ panel.classList.toggle("closed"); b.setAttribute("aria-expanded", panel.classList.contains("closed") ? "false" : "true"); return; }
      if (b.dataset.ev === "chute"){ sky.drop(); return; } if (b.dataset.ev){ events.start(b.dataset.ev); return; } st[b.dataset.k] = b.dataset.v; apply(); });
    stage.appendChild(panel);
    // live: real weather + daylight at West Point right now (falls back to clear/day if offline)
    fetch("https://api.open-meteo.com/v1/forecast?latitude=41.39&longitude=-73.96&current=weather_code,is_day&timezone=America%2FNew_York").then(r => r.json()).then(j => {
      const c = j.current.weather_code, h = new Date().getHours();
      st.liveWx = c === 45 || c === 48 ? "fog" : (c >= 71 && c <= 77) || c === 85 || c === 86 ? "snow" : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95 ? "rain" : "clear";
      st.liveTod = !j.current.is_day ? "night" : (h >= 17 && h <= 19) ? "sunset" : "day"; apply(); }).catch(() => apply());
    return { step, live: () => rain.visible || snow.visible, apply, panel, tint: () => tintNow };
  })();

  worldReady = true;
  retheme(); resize(); applyCam(); renderer.render(scene, cam); placeLabels();
  startTiles().catch(e => stopTiles(e));
  return {
    highlight, retheme, skip, zoom,
    setActive(on){ active = on; if (on){ resize(); invalidate(); } else { skip(); if (raf){ cancelAnimationFrame(raf); raf = 0; } } },
    flyHome(instant){ atHome = true; fly(homeFor(), instant ? 0 : 520); },
    focus(id, done){ const l = o.landmarks.find(q => q.id === id); if (!l){ if (done) done(); return; } atHome = false; const p = V(l.x, l.y, (l.h || 0)/2);
      fly(tilesOn ? { tx: p.x, ty: p.y, tz: p.z, az: HOME3D.az + 0.35, pol: 1.22, dist: 9 } : { tx: p.x, ty: p.y, tz: p.z, az: HOME.az + 0.4, pol: 1.08, dist: 17 }, 650, done); },
    playIntro(done){ const to = homeFor(), p = V(650, 1250, 0); atHome = true; Object.assign(cur, { tx: p.x, ty: 0, tz: p.z, az: 0.15, pol: 1.44, dist: 200 }); fly(to, 4600, done); },
    dispose(){ dead = true; world.panel.remove(); if (tiles){ tiles.dispose(); tiles = null; } if (credit) credit.remove(); if (raf) cancelAnimationFrame(raf); off.forEach(f => f()); if (ro) ro.disconnect(); disposables.forEach(d => d.dispose()); renderer.dispose(); }
  };
}
