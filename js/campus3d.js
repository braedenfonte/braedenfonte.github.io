/* 3D campus (Three.js, vendored in /vendor). Loaded in the background by js/shell.js, only when the device can handle it.
   A stylized low-poly "architecture model" of West Point: every landmark is a section of the site.
   It only draws a frame when something changes (camera move, hover, resize), so it is idle the rest of the time. */
import * as THREE from "/vendor/three.module.min.js";

export async function create(o){
  const { stage, canvas } = o;
  const root = document.documentElement;
  const cssColor = n => new THREE.Color(getComputedStyle(root).getPropertyValue(n).trim() || "#888");
  const W2 = p => new THREE.Vector3((p[0] - 80)*0.5, 0, (p[1] - 50)*0.5);   // map units -> world

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(34, 1, 1, 800);

  /* ---------- materials (colors come from the CSS theme) ---------- */
  const std = () => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, flatShading: true });
  const M = { slab: std(), bldg: std(), top: std(), water: std(), grass: std(), tree: std(), road: std(), accent: std(), hill: std() };
  M.water.roughness = 0.35; M.bowl = std(); M.bowl.side = THREE.DoubleSide;
  const E = { base: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 }), hot: new THREE.LineBasicMaterial() };
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1), sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(-34, 52, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -58, right: 58, top: 46, bottom: -46, near: 1, far: 160 });
  scene.add(hemi, sun);
  function retheme(){
    const bg = cssColor("--bg"), fg = cssColor("--fg"), dark = (bg.r + bg.g + bg.b)/3 < 0.4;
    M.slab.color.copy(cssColor("--slab"));
    M.bldg.color.copy(cssColor("--bldg")).lerp(fg, dark ? 0.62 : 0); M.bowl.color.copy(M.bldg.color);
    M.top.color.copy(cssColor("--bldg-top")).lerp(fg, dark ? 0.72 : 0);
    M.water.color.copy(cssColor("--water")).lerp(fg, dark ? 0.06 : 0);
    M.grass.color.copy(cssColor("--grass")).lerp(fg, dark ? 0.08 : 0);
    M.tree.color.copy(cssColor("--grass")).lerp(dark ? fg : bg.clone().multiplyScalar(0.55), dark ? 0.22 : 0.3);
    M.hill.color.copy(M.slab.color).lerp(dark ? fg : bg.clone().multiplyScalar(0.7), dark ? 0.035 : 0.12);
    M.road.color.copy(cssColor("--line")).lerp(fg, dark ? 0.1 : 0);
    M.accent.color.copy(cssColor("--accent")); M.accent.emissive.copy(M.accent.color).multiplyScalar(dark ? 0.35 : 0.1);
    E.base.color.copy(dark ? fg.clone().multiplyScalar(0.55) : cssColor("--faint")); E.hot.color.copy(cssColor("--accent"));
    hemi.intensity = dark ? 0.95 : 2.1; hemi.groundColor.copy(bg); sun.intensity = dark ? 2.2 : 2.6;
    renderer.shadowMap.needsUpdate = true; invalidate();
  }

  /* ---------- small builders ---------- */
  const geos = [];
  const G = g => { geos.push(g); return g; };
  function mesh(geo, mat, x, y, z, parent){ const m = new THREE.Mesh(G(geo), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m; }
  const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y + h/2, z, parent);
  const cyl = (rt, rb, h, seg, mat, x, y, z, parent) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y + h/2, z, parent);
  function edges(m, parent){ const l = new THREE.LineSegments(G(new THREE.EdgesGeometry(m.geometry, 30)), E.base); l.position.copy(m.position); l.rotation.copy(m.rotation); l.scale.copy(m.scale); (parent || m.parent).add(l); return l; }

  /* ---------- the model base, river, Plain, hills, roads, trees ---------- */
  const slab = box(88, 2.4, 58, M.slab, 0, -2.4, 0); slab.castShadow = false; edges(slab);
  const riverX = z => { const t = (z + 25)/50; return 27 + Math.sin(t*5.2)*2.5 - (t < 0.35 ? 4.5*(1 - t/0.35) : 0); };
  { const s = new THREE.Shape(); s.moveTo(44, 29);
    for (let z = -29; z <= 29.01; z += 58/14) s.lineTo(riverX(z), -z);
    s.lineTo(44, -29); s.closePath();
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI/2);
    const w = mesh(g, M.water, 0, 0.03, 0); w.castShadow = false; }
  const plain = W2(o.decor.plain.p), chapelP = W2(o.decor.chapel.p);
  box(13, 0.12, 6, M.grass, plain.x, 0, plain.z).castShadow = false;
  const hills = [[-37, -17, 8, 4.6], [-38, -3, 6.5, 3.6], [-36, 12, 7.5, 4.2], [-19, 15.2, 6.2, 3.4], [-27, 23, 6, 3], [chapelP.x, chapelP.z - 1, 4.4, 1.6], [-22, -22, 6, 2.6]];
  hills.forEach(h => { const m = mesh(new THREE.IcosahedronGeometry(1, 1), M.hill, h[0], 0, h[1]); m.scale.set(h[2], h[3], h[2]); m.rotation.y = h[0]; });
  const LM = {}; o.landmarks.forEach(l => { LM[l.id] = { id: l.id, pos: W2(l.p), h: l.h, group: new THREE.Group(), edges: [] }; });
  const P = id => LM[id].pos;
  function road(a, b){ const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz); const r = box(len, 0.06, 0.9, M.road, (a.x + b.x)/2, 0.01, (a.z + b.z)/2); r.rotation.y = -Math.atan2(dz, dx); r.castShadow = false; }
  [["gate","hq"],["hq","barracks"],["library","hq"],["hq","thayer"],["stadium","barracks"],["barracks","helipad"],["vault","library"]].forEach(r => road(P(r[0]), P(r[1])));
  road(P("barracks"), plain); road(plain, P("trophy")); road(P("golf"), chapelP); road(chapelP, P("barracks"));
  { let seed = 7; const rnd = () => (seed = (seed*9301 + 49297) % 233280)/233280;
    const spots = [];
    for (let i = 0; i < 400 && spots.length < 120; i++){
      const x = -42 + rnd()*84, z = -27 + rnd()*54;
      if (x > riverX(z) - 2) continue;
      if (Object.values(LM).some(l => Math.hypot(l.pos.x - x, l.pos.z - z) < 7.5)) continue;
      if (Math.abs(x - plain.x) < 8.5 && Math.abs(z - plain.z) < 5) continue;
      if (Math.hypot(chapelP.x - x, chapelP.z - z) < 4) continue;
      spots.push([x, z, 0.7 + rnd()*0.7]);
    }
    const inst = new THREE.InstancedMesh(G(new THREE.ConeGeometry(0.75, 2.2, 5)), M.tree, spots.length), d = new THREE.Object3D();
    spots.forEach((s, i) => { d.position.set(s[0], 1.1*s[2], s[1]); d.scale.setScalar(s[2]); d.rotation.y = i; d.updateMatrix(); inst.setMatrixAt(i, d.matrix); });
    inst.castShadow = true; inst.receiveShadow = true; scene.add(inst); }
  { const c = new THREE.Group(); c.position.set(chapelP.x, 1.2, chapelP.z); scene.add(c);   // Cadet Chapel (scenery)
    [box(2.8, 3.2, 5, M.bldg, 0, 0, -0.6, c), box(2.2, 6.2, 2.2, M.bldg, 0, 0, 2.2, c), box(2.6, 0.4, 2.6, M.top, 0, 6.2, 2.2, c)].forEach(m => edges(m)); }

  /* ---------- landmarks (front faces +Z, toward the default camera) ---------- */
  const build = {
    barracks(g){ return [box(14, 4, 2.6, M.bldg, 0, 0, -2.7, g), box(2.6, 4, 8, M.bldg, -5.7, 0, 0, g), box(2.6, 4, 8, M.bldg, 5.7, 0, 0, g),
      box(1.7, 5.2, 1.7, M.top, -5.7, 0, 4, g), box(1.7, 5.2, 1.7, M.top, 5.7, 0, 4, g), box(1.7, 5.2, 1.7, M.top, -6.2, 0, -3.2, g), box(1.7, 5.2, 1.7, M.top, 6.2, 0, -3.2, g),
      box(3, 0.35, 0.35, M.accent, 0, 4, -1.5, g)]; },
    library(g){ return [box(11, 5, 7, M.bldg, 0, 0, 0, g), box(11.8, 0.5, 7.8, M.top, 0, 5, 0, g), box(8, 3.4, 0.2, M.top, 0, 0.8, 3.55, g)]; },
    thayer(g){ return [box(16, 4, 5.2, M.bldg, 0, 0, 0, g), box(16.6, 0.45, 5.8, M.top, 0, 4, 0, g)].concat([-6, -2, 2, 6].map(x => box(0.7, 3.2, 5.9, M.top, x, 0, 0, g))); },
    hq(g){ return [box(9, 4.5, 6.4, M.bldg, 0, 0, 0, g), box(3, 8.6, 3, M.bldg, 0, 0, 0, g), box(3.6, 0.5, 3.6, M.top, 0, 8.6, 0, g), cyl(0.07, 0.07, 2.6, 5, M.top, 0, 9.1, 0, g), box(1.5, 0.8, 0.06, M.accent, 0.8, 10.8, 0, g)]; },
    stadium(g){ const b = mesh(new THREE.CylinderGeometry(7.6, 5.2, 3.4, 18, 1, true), M.bowl, 0, 1.7, 0, g); b.scale.z = 0.72;
      const f = cyl(5, 5, 0.12, 18, M.grass, 0, 0, 0, g); f.scale.z = 0.68; return [b, f, box(0.3, 4.6, 0.3, M.top, -7.2, 0, -4.4, g), box(0.3, 4.6, 0.3, M.top, 7.2, 0, -4.4, g)]; },
    golf(g){ const gr = cyl(6, 6.2, 0.14, 22, M.grass, 0, 0, 0, g); gr.scale.z = 0.65; const bk = cyl(1.5, 1.5, 0.1, 10, M.top, -3.4, 0.08, 1.4, g); bk.scale.z = 0.6;
      return [gr, bk, cyl(0.06, 0.06, 3, 5, M.top, 1.6, 0.1, -0.4, g), box(1, 0.6, 0.05, M.accent, 2.1, 2.5, -0.4, g)]; },
    helipad(g){ const ring = mesh(new THREE.TorusGeometry(2.7, 0.13, 6, 28), M.accent, 0, 0.32, 0, g); ring.rotation.x = Math.PI/2; ring.castShadow = false;
      return [cyl(3.8, 4, 0.28, 22, M.bldg, 0, 0, 0, g), ring, box(0.3, 0.06, 2.2, M.top, -0.8, 0.28, 0, g), box(0.3, 0.06, 2.2, M.top, 0.8, 0.28, 0, g), box(1.6, 0.06, 0.3, M.top, 0, 0.28, 0, g)]; },
    trophy(g){ return [cyl(3, 3.3, 0.5, 14, M.bldg, 0, 0, 0, g), cyl(1.1, 1.3, 0.8, 10, M.top, 0, 0.5, 0, g), cyl(0.42, 0.52, 5, 10, M.top, 0, 1.3, 0, g), mesh(new THREE.SphereGeometry(0.55, 10, 8), M.accent, 0, 6.7, 0, g)]; },
    gate(g){ return [box(2.2, 3.4, 2.2, M.bldg, -3, 0, 0, g), box(2.2, 3.4, 2.2, M.bldg, 3, 0, 0, g), box(8.6, 0.6, 1.6, M.top, 0, 3.4, 0, g), box(0.3, 0.9, 0.3, M.accent, -3, 4, 0, g), box(0.3, 0.9, 0.3, M.accent, 3, 4, 0, g)]; },
    vault(g){ const door = cyl(1.5, 1.5, 0.3, 22, M.top, 0, 0, 0, g); door.rotation.x = Math.PI/2; door.position.set(0, 1.8, 0.7);
      const ring = mesh(new THREE.TorusGeometry(1.5, 0.14, 6, 28), M.accent, 0, 1.8, 0.86, g); ring.castShadow = false;
      return [box(8, 3.6, 1.2, M.bldg, 0, 0, 0, g), box(8.6, 0.4, 1.6, M.top, 0, 3.6, 0, g), door, ring]; }
  };
  const targets = [];
  Object.values(LM).forEach(l => {
    l.group.position.copy(l.pos); scene.add(l.group);
    (build[l.id] ? build[l.id](l.group) : []).forEach(m => { m.userData.id = l.id; targets.push(m); if (m.geometry.type !== "TorusGeometry" && m.geometry.type !== "SphereGeometry") l.edges.push(edges(m, l.group)); });
  });

  /* ---------- camera rig ---------- */
  const HOME = { tx: 0, ty: 0, tz: 2.5, az: -0.3, pol: 0.95, dist: 92 };
  const cur = Object.assign({}, HOME);
  let tween = null, raf = 0, active = true, dead = false, atHome = true, w = 1, h = 1;
  const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
  function homeFor(){ const a = w/h; return Object.assign({}, HOME, { dist: HOME.dist*Math.max(1, 1.75/a) }); }
  function applyCam(){
    const s = Math.sin(cur.pol);
    cam.position.set(cur.tx + cur.dist*s*Math.sin(cur.az), cur.ty + cur.dist*Math.cos(cur.pol), cur.tz + cur.dist*s*Math.cos(cur.az));
    cam.lookAt(cur.tx, cur.ty, cur.tz);
  }
  function fly(to, dur, done){
    if (tween && tween.done) { const d = tween.done; tween = null; d(); }
    if (!dur){ Object.assign(cur, to); tween = null; invalidate(); if (done) done(); return; }
    tween = { from: Object.assign({}, cur), to, t0: performance.now(), dur, done, frames: 0, slowMs: 0 }; invalidate();
  }
  function skip(){ if (!tween) return; const t = tween; tween = null; Object.assign(cur, t.to); invalidate(); if (t.done) t.done(); }

  /* ---------- labels: project each landmark to the screen ---------- */
  const v = new THREE.Vector3();
  function placeLabels(){
    Object.values(LM).forEach(l => {
      v.set(l.pos.x, l.h + 1.4, l.pos.z).project(cam);
      const x = (v.x*0.5 + 0.5)*w, y = (-v.y*0.5 + 0.5)*h;
      o.place(l.id, x, y, v.z < 1 && x > -40 && x < w + 40 && y > 0 && y < h + 60);
    });
  }

  /* ---------- draw only when needed ---------- */
  let watched = false, lastT = 0;
  function frame(now){
    raf = 0; if (dead || !active) return;
    if (tween){
      const k = Math.min(1, (now - tween.t0)/tween.dur), e = ease(k), f = tween.from, t = tween.to;
      for (const key in t) cur[key] = f[key] + (t[key] - f[key])*e;
      if (lastT && tween.frames++ > 4){ tween.slowMs += now - lastT; }
      if (o.watch && !watched && tween.frames > 34){ watched = true; if (tween.slowMs/(tween.frames - 5) > 45){ if (tween.done) tween.done(); tween = null; o.onSlow(); return; } }
      if (k >= 1){ const d = tween.done; tween = null; if (d) d(); }
    }
    lastT = tween ? now : 0;
    applyCam(); renderer.render(scene, cam); placeLabels();
    if (tween) raf = requestAnimationFrame(frame);
  }
  function invalidate(){ if (!raf && active && !dead) raf = requestAnimationFrame(frame); }
  function resize(){
    const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return;
    w = r.width; h = r.height; renderer.setSize(w, h, false); cam.aspect = w/h; cam.updateProjectionMatrix();
    if (atHome && !tween) Object.assign(cur, homeFor());
    invalidate();
  }
  const ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(stage); else addEventListener("resize", resize);

  /* ---------- hover, click, drag to look around ---------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let hot = null, drag = null;
  function pick(e){
    const r = canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left)/r.width)*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1);
    ray.setFromCamera(ptr, cam); const hit = ray.intersectObjects(targets, false)[0];
    return hit ? hit.object.userData.id : null;
  }
  function highlight(id){
    if (id === hot) return; hot = id;
    Object.values(LM).forEach(l => l.edges.forEach(e => { e.material = l.id === id ? E.hot : E.base; }));
    invalidate();
  }
  const L = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); return () => el.removeEventListener(ev, fn, opt); };
  const off = [
    L(canvas, "pointerdown", e => { if (tween) return; drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; }),
    L(canvas, "pointermove", e => {
      if (drag && drag.id === e.pointerId){
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
        if (drag.moved > 5){ if (!drag.cap){ drag.cap = true; try{ canvas.setPointerCapture(e.pointerId); }catch(x){} }
          cur.az -= dx*0.005; cur.pol = Math.min(1.25, Math.max(0.5, cur.pol - dy*0.003)); atHome = false; invalidate(); }
        return;
      }
      if (e.pointerType === "mouse" && !tween){ const id = pick(e); if (id !== hot){ highlight(id); o.onHover(id); } }
    }),
    L(canvas, "pointerup", e => { const d = drag; drag = null; if (d && d.moved <= 5 && !tween){ const id = pick(e); if (id) o.onOpen(id); } }),
    L(canvas, "pointercancel", () => { drag = null; }),
    L(canvas, "pointerleave", () => { if (hot){ highlight(null); o.onHover(null); } }),
    L(canvas, "wheel", e => { if (!e.ctrlKey || tween) return; e.preventDefault(); cur.dist = Math.min(150, Math.max(26, cur.dist*(1 + e.deltaY*0.01))); atHome = false; invalidate(); }, { passive: false }),
    L(document, "visibilitychange", () => { if (!document.hidden) invalidate(); })
  ];

  retheme(); resize(); applyCam(); renderer.render(scene, cam); placeLabels();

  return {
    highlight, retheme, skip,
    setActive(on){ active = on; if (on){ resize(); invalidate(); } else { skip(); if (raf){ cancelAnimationFrame(raf); raf = 0; } } },
    flyHome(instant){ atHome = true; fly(homeFor(), instant ? 0 : 520); },
    focus(id, done){ const l = LM[id]; if (!l) { if (done) done(); return; } atHome = false;
      fly({ tx: l.pos.x, ty: 1.5, tz: l.pos.z, az: HOME.az + 0.42, pol: 1.1, dist: 30 }, 620, done); },
    playIntro(done){ const to = homeFor(); atHome = true;
      Object.assign(cur, { tx: 26, ty: 0, tz: -34, az: 2.05, pol: 1.38, dist: 150 });
      fly(to, 4600, done); },
    dispose(){ dead = true; if (raf) cancelAnimationFrame(raf); off.forEach(f => f()); if (ro) ro.disconnect();
      geos.forEach(g => g.dispose()); Object.values(M).forEach(m => m.dispose()); E.base.dispose(); E.hot.dispose(); renderer.dispose(); }
  };
}
