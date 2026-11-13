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
  function paintGround(){ map.paint(tcv, { pxPerM: 0.85, dark: dark(), footprintOnly: true }); tex.needsUpdate = true; }
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
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++){ a.fillStyle = "#39414e"; a.fillRect(i*64 + 19, j*64 + 14, 26, 34); a.fillStyle = "#59636f"; a.fillRect(i*64 + 19, j*64 + 14, 26, 3);
      if (rnd() < 0.4){ b.fillStyle = rnd() < 0.8 ? "#ffd89a" : "#cfe4ff"; b.fillRect(i*64 + 19, j*64 + 14, 26, 34); } } }
  const wT = keep(new THREE.CanvasTexture(wallTex)), gT = keep(new THREE.CanvasTexture(glowTex));
  [wT, gT].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }); wT.colorSpace = THREE.SRGBColorSpace; gT.colorSpace = THREE.SRGBColorSpace;
  const wallMat = keep(new THREE.MeshStandardMaterial({ map: wT, emissiveMap: gT, emissive: 0xffffff, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  const roofMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  const WALL = { barracks: [0.70, 0.68, 0.64], hall: [0.74, 0.72, 0.67] }, HOUSE = [[0.9, 0.88, 0.83], [0.78, 0.72, 0.62], [0.62, 0.4, 0.33], [0.82, 0.8, 0.74]];
  const ROOF = { barracks: [0.3, 0.33, 0.38], hall: [0.38, 0.4, 0.44], house: [0.42, 0.27, 0.22] };
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
    const top = Math.min(hi, lo + 9*S) + b.h*S, lm = lmOf[b.i] != null ? lmOf[b.i] : -1; tops[b.i] = { P, lo, top };
    const jit = 0.94 + ((b.i*37) % 13)/100, wcol = (b.k === "house" ? HOUSE[b.i % HOUSE.length] : WALL[b.k]).map(v => v*jit);
    curB = b.n ? b.i : -1;
    extrude(P, lo - 2*S, top, wcol, ROOF[b.k].map(v => v*jit), lm);
    if (b.k !== "house" && b.h >= 16 && P.length >= 4){ // a low parapet block so big halls don't look like plain boxes
      const c = b.c, Q = P.map(p => [c[0] + (p[0] - c[0])*0.9, c[1] + (p[1] - c[1])*0.9]); extrude(Q, top, top + 1.6*S, wcol.map(v => v*0.93), ROOF[b.k].map(v => v*0.9), lm); }
  });
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

  /* ---------- trees on the open hillsides ---------- */
  { const grid = map.busyGrid(), spots = []; let s = 3; const rnd = () => (s = (s*9301 + 49297) % 233280)/233280;
    for (let i = 0; i < 16000 && spots.length < 3400; i++){ const x = BB.x0 + rnd()*w, y = BB.y0 + rnd()*hgt; if (map.heightAt(x, y) < 2 || grid.busy(x, y)) continue; spots.push([x, y, 0.7 + rnd()*0.7, rnd()]); }
    const inst = new THREE.InstancedMesh(keep(new THREE.ConeGeometry(5*S, 15*S, 5)), keep(new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true })), spots.length), d = new THREE.Object3D(), c = new THREE.Color();
    spots.forEach((t, i) => { d.position.set(t[0]*S, gy(t[0], t[1]) + 7*S*t[2], -t[1]*S); d.scale.setScalar(t[2]); d.rotation.y = i; d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      inst.setColorAt(i, t[3] < 0.1 ? c.setRGB(0.62, 0.42, 0.16) : t[3] < 0.18 ? c.setRGB(0.66, 0.56, 0.2) : c.setRGB(0.16 + t[3]*0.1, 0.36 + t[3]*0.14, 0.17)); });
    inst.castShadow = true; inst.receiveShadow = true; scene.add(inst); }

  /* ---------- extras: monuments, flagpole, South Dock, signposts, accent outlines ---------- */
  const accent = keep(new THREE.MeshStandardMaterial({ color: 0xe0243c, emissive: 0xe0243c, emissiveIntensity: 0.4, roughness: 0.6 })), stone = keep(new THREE.MeshStandardMaterial({ color: 0xcfcabd, roughness: 0.9 }));
  const picks = [];
  function add(geo, mat, x, y, up, shadow){ const m = new THREE.Mesh(keep(geo), mat); m.position.copy(V(x, y, up)); m.castShadow = shadow !== false; scene.add(m); return m; }
  function pick(l, r, hh){ const m = add(new THREE.CylinderGeometry(r*S, r*S, hh*S, 8), stone, l.x, l.y, hh/2, false); m.visible = false; m.userData.id = l.id; picks.push(m); }
  D.nodes.forEach(n => { if (/Monument|Chain/.test(n.n)){ const big = n.n === "Battle Monument"; add(new THREE.CylinderGeometry((big ? 1.6 : 0.9)*S, (big ? 2.2 : 1.4)*S, (big ? 22 : 7)*S, 8), stone, n.p[0], n.p[1], big ? 11 : 3.5);
      if (big) add(new THREE.SphereGeometry(2*S, 10, 8), accent, n.p[0], n.p[1], 23.5); }
    if (n.n === "Flagpole"){ add(new THREE.CylinderGeometry(0.35*S, 0.35*S, 34*S, 5), stone, n.p[0], n.p[1], 17); add(new THREE.BoxGeometry(9*S, 5*S, 0.3*S), accent, n.p[0] + 4.6, n.p[1], 31); } });
  o.landmarks.forEach(l => {
    if (l.id === "trophy") pick(l, 26, 30);
    if (l.id === "stadium") pick(l, 60, 6);
    if (l.id === "dock"){ add(new THREE.BoxGeometry(80*S, 2.5*S, 10*S), stone, l.x + 45, l.y, 1.2); add(new THREE.BoxGeometry(14*S, 5*S, 5*S), accent, l.x + 70, l.y, 3.5); pick(l, 45, 14); }
    if (l.sign){ add(new THREE.CylinderGeometry(0.7*S, 0.7*S, 16*S, 6), stone, l.x, l.y, 8).userData.keep = true; add(new THREE.BoxGeometry(2*S, 9*S, 26*S), accent, l.x, l.y, 16).userData.keep = true; pick(l, 22, 24); }
  });
  const lineBase = keep(new THREE.LineBasicMaterial({ color: 0xe0243c })), outlines = {};
  o.landmarks.forEach((l, i) => { const t = l.bi != null && tops[l.bi]; if (!t) return; const pts = [], n = t.P.length;
    for (let k = 0; k < n; k++){ const a = t.P[k], b = t.P[(k + 1) % n]; pts.push(a[0]*S, t.top + 0.02, -a[1]*S, b[0]*S, t.top + 0.02, -b[1]*S, a[0]*S, t.lo, -a[1]*S, a[0]*S, t.top, -a[1]*S); }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); const ln = new THREE.LineSegments(g, lineBase); ln.visible = !!l.mine; scene.add(ln); outlines[l.id] = { ln, mine: !!l.mine }; });

  function retheme(){
    const dk = dark(); paintGround();
    waterMat.color.set(dk ? 0x16324a : 0x3f80b3); slabMat.color.set(dk ? 0x0b0c10 : 0xcfd2d6);
    wallMat.emissiveIntensity = dk ? 0.9 : 0; wallMat.color.set(dk ? 0xb4bccb : 0xffffff); roofMat.color.set(dk ? 0xa9b2c4 : 0xffffff);
    hemi.color.set(dk ? 0x8ea6d6 : 0xffffff); hemi.groundColor.set(dk ? 0x0a0d14 : 0x6f7a66); hemi.intensity = dk ? 1.25 : 1.5;
    sun.color.set(dk ? 0xb9c8ff : 0xfff3df); sun.intensity = dk ? 1.7 : 2.5;
    
    renderer.shadowMap.needsUpdate = true; invalidate();
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
    const lw = 196, lh = 32, clamp = q => { q.sx = Math.min(vw - 100, Math.max(100, q.sx)); q.sy = Math.min(vh - 8, Math.max(q.sx < 470 ? 170 : 96, q.sy)); };
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
    if (tween || busy) raf = requestAnimationFrame(frame);
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
  const L = (el, evn, fn, opt) => { el.addEventListener(evn, fn, opt); return () => el.removeEventListener(evn, fn, opt); };
  const off = [
    L(canvas, "pointerdown", ev => { if (tween) return; drag = { x: ev.clientX, y: ev.clientY, moved: 0, id: ev.pointerId }; }),
    L(canvas, "pointermove", ev => {
      if (drag && drag.id === ev.pointerId){ const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = ev.clientX; drag.y = ev.clientY;
        if (drag.moved > 5){ if (!drag.cap){ drag.cap = true; try{ canvas.setPointerCapture(ev.pointerId); }catch(x){} } cur.az -= dx*0.005; cur.pol = Math.min(tilesOn ? 1.5 : 1.4, Math.max(0.3, cur.pol - dy*0.003)); atHome = false; invalidate(); } return; }
      if (ev.pointerType === "mouse" && !tween){ const id = pickAt(ev); if (o.tip) o.tip(overName, ev.clientX, ev.clientY); if (id !== hot){ highlight(id); o.onHover(id); } } }),
    L(canvas, "pointerup", ev => { const d = drag; drag = null; if (d && d.moved <= 5 && !tween){ const id = pickAt(ev); if (id) o.onOpen(id); } }),
    L(canvas, "pointercancel", () => { drag = null; }),
    L(canvas, "pointerleave", () => { if (o.tip) o.tip(null); if (hot){ highlight(null); o.onHover(null); } }),
    L(canvas, "wheel", ev => { if (tween) return; ev.preventDefault(); zoom(1 + Math.max(-0.3, Math.min(0.3, ev.deltaY*0.0015))); }, { passive: false }),   // scroll to zoom
    L(document, "visibilitychange", () => { if (!document.hidden) invalidate(); })
  ];
  function zoom(f){ cur.dist = Math.min(230, Math.max(tilesOn ? 1.6 : 9, cur.dist*f)); atHome = false; invalidate(); }

  /* ---------- Google Photorealistic 3D Tiles: the real look. The model above stays underneath as the fallback
     (no key, low-power/data-saver, quota used up, or any load error) and stays invisible-but-pickable for hovers. ---------- */
  let tiles = null, tilesOn = false, credit = null, tilesAct = 0; const tileMats = new Set();
  const own = scene.children.filter(c => (c.isMesh || c.isInstancedMesh) && !c.userData.keep && !picks.includes(c));
  function showOwn(on){ own.forEach(c => { c.visible = on; }); renderer.shadowMap.needsUpdate = true; }
  function stopTiles(why){ if (!tiles) return; console.warn("Google 3D tiles off, using the built-in map:", why);
    tiles.group.parent && tiles.group.parent.removeFromParent(); tiles.dispose(); tiles = null; tilesOn = false; tileMats.clear();
    if (credit){ credit.remove(); credit = null; } showOwn(true); for (const k in outlines) outlines[k].ln.visible = outlines[k].mine; if (atHome) fly(homeFor(), 600); invalidate(); }
  async function startTiles(){
    const nc = navigator.connection; if (nc && nc.saveData) return;
    if (!/(^|\.)braedenfonte\.com$|^localhost$/.test(location.hostname)) return;   // the key only works there anyway
    const key = await import("/js/mapkey.js?v=20261113j").then(m => (m.GOOGLE_TILES_KEY || "").trim()).catch(() => "");
    if (!key || dead) return;
    const T = await import("/vendor/tiles3d.module.min.js?v=20261113j"); if (dead) return;
    const t = tiles = new T.TilesRenderer("https://tile.googleapis.com/v1/3dtiles/root.json"), auth = new T.GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: false });
    const f0 = auth.fetchData.bind(auth);   // any refused request (quota hit, bad key, outage) -> back to the built-in map
    auth.fetchData = (uri, opt) => f0(uri, opt).then(r => { if (r.status === 403 || r.status === 429 || (!r.ok && /root\.json/.test(uri))) setTimeout(() => stopTiles("HTTP " + r.status)); return r; },
      e => { if (/root\.json/.test(uri)) setTimeout(() => stopTiles(e)); throw e; });
    t.registerPlugin(auth);
    const draco = new T.DRACOLoader().setDecoderPath("/vendor/draco/"), gltf = new T.GLTFLoader(t.manager); gltf.setDRACOLoader(draco);
    t.manager.addHandler(/\.(gltf|glb)(\?.*)?$/i, gltf);   // Google tile URLs end in ?session=..., and Draco is needed for the detailed pieces
    t.setLatLonToYUp(map.data.lat0*Math.PI/180, map.data.lon0*Math.PI/180);   // tiles: X north, Y up, Z east (meters)
    const hold = new THREE.Group(); hold.rotation.y = Math.PI/2; hold.scale.setScalar(S);   // uniform, or the tiles pick the wrong detail level
    hold.position.y = 32*S*VE;   // ellipsoid -> sea level (geoid is ~32 m below the ellipsoid at West Point)
    hold.add(t.group); scene.add(hold); hold.updateMatrixWorld(true);
    t.setCamera(cam); t.setResolutionFromRenderer(cam, renderer);
    t.addEventListener("load-model", ev => { if (!tiles) return; ev.scene.traverse(c => { if (c.material){ tileMats.add(c.material);  } });
      if (!tilesOn){ tilesOn = true; showOwn(false); for (const k in outlines) outlines[k].ln.visible = false; if (atHome && !tween) fly(homeFor(), 1100); credit = document.createElement("div"); credit.className = "tiles-credit"; stage.appendChild(credit); } invalidate(); });
    ["load-model", "load-tile-set", "tiles-load-start"].forEach(n => t.addEventListener(n, () => { tilesAct = performance.now(); }));
    t.addEventListener("load-tile-set", () => { t.errorTarget = matchMedia("(pointer: coarse)").matches ? 12 : 8; invalidate(); });   // much sharper than Google's default; only the first (root) request of a visit is billed   // keep asking for tiles while they stream in
    t.addEventListener("tiles-load-end", () => { if (credit && tiles){ const a = [...new Set(tiles.getAttributions().filter(x => x.type === "string").flatMap(x => x.value.split(/[;,]\s*/)).filter(Boolean))]; credit.textContent = "Map data: " + (a.length ? a.join(", ") : "Google"); } invalidate(); });
    invalidate();
  }

  retheme(); resize(); applyCam(); renderer.render(scene, cam); placeLabels();
  startTiles().catch(e => stopTiles(e));
  return {
    highlight, retheme, skip, zoom,
    setActive(on){ active = on; if (on){ resize(); invalidate(); } else { skip(); if (raf){ cancelAnimationFrame(raf); raf = 0; } } },
    flyHome(instant){ atHome = true; fly(homeFor(), instant ? 0 : 520); },
    focus(id, done){ const l = o.landmarks.find(q => q.id === id); if (!l){ if (done) done(); return; } atHome = false; const p = V(l.x, l.y, (l.h || 0)/2);
      fly(tilesOn ? { tx: p.x, ty: p.y, tz: p.z, az: HOME3D.az + 0.35, pol: 1.22, dist: 9 } : { tx: p.x, ty: p.y, tz: p.z, az: HOME.az + 0.4, pol: 1.08, dist: 17 }, 650, done); },
    playIntro(done){ const to = homeFor(), p = V(650, 1250, 0); atHome = true; Object.assign(cur, { tx: p.x, ty: 0, tz: p.z, az: 0.15, pol: 1.44, dist: 200 }); fly(to, 4600, done); },
    dispose(){ dead = true; if (tiles){ tiles.dispose(); tiles = null; } if (credit) credit.remove(); if (raf) cancelAnimationFrame(raf); off.forEach(f => f()); if (ro) ro.disconnect(); disposables.forEach(d => d.dispose()); renderer.dispose(); }
  };
}
