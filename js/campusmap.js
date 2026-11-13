/* West Point map data + painter. Used by BOTH the flat 2D map (js/shell.js) and the 3D campus (js/campus3d.js),
   so the two always match. Data: /campus/westpoint.json (real building footprints, roads, fields and terrain).
   Units are meters: x = east, y = north. Map data (c) OpenStreetMap contributors. */
(function(){
"use strict";
let D = null, loading = null;
const B = { x0: -1050, y0: -1400, x1: 1050, y1: 1400 };
const pts = p => { const o = []; for (let i = 0; i < p.length; i += 2) o.push([p[i], p[i + 1]]); return o; };
function centroid(p){ let x = 0, y = 0; for (let i = 0; i < p.length; i += 2){ x += p[i]; y += p[i + 1]; } const n = p.length/2; return [x/n, y/n]; }
function load(){
  return loading || (loading = fetch("/campus/westpoint.json?v=20261113").then(r => { if (!r.ok) throw new Error("map data"); return r.json(); }).then(j => {
    D = j; B.x1 = j.elev.x0 + (j.elev.cols - 1)*j.elev.step; B.y1 = j.elev.y0 + (j.elev.rows - 1)*j.elev.step; D.buildings.forEach((b, i) => { b.i = i; b.c = centroid(b.p); }); D.areas.forEach(a => { a.c = centroid(a.p); }); return D; }));
}
/* ground height (m) at any point, from the terrain grid */
function heightAt(x, y){
  const e = D.elev, fx = Math.min(e.cols - 1.001, Math.max(0, (x - e.x0)/e.step)), fy = Math.min(e.rows - 1.001, Math.max(0, (y - e.y0)/e.step));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, h = e.h, c = e.cols;
  return (h[j*c + i]*(1 - u) + h[j*c + i + 1]*u)*(1 - v) + (h[(j + 1)*c + i]*(1 - u) + h[(j + 1)*c + i + 1]*u)*v;
}
/* find a real place: {b:"building name"} | {a:"area name"} | {n:"monument name"} | {xy:[x,y]} */
function locate(s){
  if (s.xy) return { x: s.xy[0], y: s.xy[1], h: s.h || 0 };
  if (s.b){ const b = D.buildings.filter(q => q.n === s.b).sort((p, q) => q.p.length - p.p.length)[0]; if (b) return { x: b.c[0], y: b.c[1], h: b.h, bi: b.i }; }
  if (s.a){ const a = D.areas.find(q => q.n === s.a); if (a) return { x: a.c[0], y: a.c[1], h: s.h || 0 }; }
  if (s.n){ const n = D.nodes.find(q => q.n === s.n); if (n) return { x: n.p[0], y: n.p[1], h: s.h || 0 }; }
  return { x: 0, y: 0, h: 0 };
}

/* ---------- colors ---------- */
const DAY = { forest:"#4c7647", halo:"#6c9756", lawn:"#84b264", plain:"#8dc26b", pitch:"#5ca552", pitchLine:"#e9f2e4", road:"#8e9094", roadMain:"#a3a5a8", ped:"#cdc6b6", foot:"#d6cfbf",
  parking:"#7c7f84", water:"#3d7cad", tennis:"#3f6f9f", infield:"#c7a574", cemetery:"#7aa55d", stand:"#9a9da3",
  roofBarracks:"#565d69", roofHall:"#6a6f79", roofHouse:"#86594a", outline:"#2f3238", text:"#18201a", textHalo:"rgba(255,255,255,.75)", accent:"#e0243c" };
function mix(a, b, t){ const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v)*t).toString(16).padStart(2, "0")).join(""); }
function palette(dark){
  if (!dark) return DAY; const N = {};
  for (const k in DAY) N[k] = DAY[k][0] === "#" ? mix(DAY[k], "#0a1020", k === "water" ? 0.55 : 0.42) : DAY[k];
  N.text = "#e9edf2"; N.textHalo = "rgba(5,8,14,.8)"; N.accent = DAY.accent; N.pitchLine = "#9fb0a0"; return N;
}
const ROAD_W = [9, 7, 4.5, 6, 1.8];   // meters, by road class

/* ---------- paint the whole map onto a canvas ---------- */
function paint(cv, o){
  o = o || {}; const k = o.pxPerM || 0.6, W = Math.round((B.x1 - B.x0)*k), H = Math.round((B.y1 - B.y0)*k), C = palette(!!o.dark);
  cv.width = W; cv.height = H; const x = cv.getContext("2d");
  const X = v => (v - B.x0)*k, Y = v => (B.y1 - v)*k;
  const path = (p, close) => { x.beginPath(); for (let i = 0; i < p.length; i += 2) i ? x.lineTo(X(p[i]), Y(p[i + 1])) : x.moveTo(X(p[0]), Y(p[1])); if (close) x.closePath(); };
  x.fillStyle = C.forest; x.fillRect(0, 0, W, H); x.lineJoin = "round"; x.lineCap = "round";
  // mown ground around roads and buildings; everything else stays forest
  x.globalAlpha = 0.5; x.strokeStyle = C.halo;
  D.roads.forEach(r => { if (r.c > 2) return; x.lineWidth = 46*k; path(r.p); x.stroke(); });
  D.buildings.forEach(b => { x.lineWidth = 60*k; path(b.p, true); x.stroke(); });
  x.globalAlpha = 1;
  const e = D.elev, small = document.createElement("canvas"); small.width = e.cols; small.height = e.rows; const sx = small.getContext("2d"), im = sx.createImageData(e.cols, e.rows);
  const smallTo = () => { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(small, -0.5*W/(e.cols - 1), -0.5*H/(e.rows - 1), W*e.cols/(e.cols - 1), H*e.rows/(e.rows - 1)); };
  D.areas.forEach(a => {
    const t = a.k; if (t === "water" || t === "stadium") return;
    x.fillStyle = t === "plain" ? C.plain : t === "lawn" ? C.lawn : t === "cemetery" ? C.cemetery : t === "parking" ? C.parking : t === "pitch:tennis" ? C.tennis : t === "pitch:basketball" ? C.parking : C.pitch;
    path(a.p, true); x.fill();
    if (t.indexOf("pitch") === 0){ x.strokeStyle = C.pitchLine; x.lineWidth = Math.max(1, 1.2*k); x.stroke();
      if (t === "pitch:baseball" || t === "pitch:softball"){ x.fillStyle = C.infield; x.beginPath(); x.arc(X(a.c[0]), Y(a.c[1]), 16*k, 0, 7); x.fill(); } }
  });
  D.areas.forEach(a => { if (a.k === "stadium"){ x.fillStyle = C.stand; path(a.p, true); x.fill(); } });
  D.areas.forEach(a => { if (a.k === "pitch:american_football"){ x.fillStyle = C.pitch; path(a.p, true); x.fill(); x.strokeStyle = C.pitchLine; x.lineWidth = Math.max(1, 1.2*k); x.stroke(); } });
  [4, 3, 2, 1, 0].forEach(c => { x.strokeStyle = c === 0 ? C.roadMain : c === 3 ? C.ped : c === 4 ? C.foot : C.road; x.lineWidth = Math.max(0.8, ROAD_W[c]*k);
    D.roads.forEach(r => { if (r.c === c){ path(r.p); x.stroke(); } }); });
  D.areas.forEach(a => { if (a.k === "water"){ x.fillStyle = C.water; path(a.p, true); x.fill(); } });
  // the Hudson: wherever the terrain is at river level
  const wc = [1, 3, 5].map(i => parseInt(C.water.slice(i, i + 2), 16));
  for (let j = 0; j < e.rows; j++) for (let i = 0; i < e.cols; i++){ const q = ((e.rows - 1 - j)*e.cols + i)*4, hv = e.h[j*e.cols + i]; im.data[q] = wc[0]; im.data[q + 1] = wc[1]; im.data[q + 2] = wc[2]; im.data[q + 3] = hv < 0.4 ? 255 : hv < 1.2 ? 120 : 0; }
  sx.putImageData(im, 0, 0); smallTo();
  if (o.hillshade){ // soft relief so the flat map still shows the hills
    for (let j = 0; j < e.rows; j++) for (let i = 0; i < e.cols; i++){ const q = ((e.rows - 1 - j)*e.cols + i)*4, g = (a, b) => e.h[Math.min(e.rows - 1, Math.max(0, b))*e.cols + Math.min(e.cols - 1, Math.max(0, a))];
      const s = Math.max(-1, Math.min(1, ((g(i - 1, j) - g(i + 1, j)) + (g(i, j + 1) - g(i, j - 1)))/26)); im.data[q] = im.data[q + 1] = im.data[q + 2] = s > 0 ? 255 : 0; im.data[q + 3] = Math.abs(s)*(s > 0 ? 70 : 110); }
    sx.putImageData(im, 0, 0); smallTo(); }
  if (o.buildings !== false){
    D.buildings.forEach(b => { x.fillStyle = o.footprintOnly ? C.outline : b.k === "barracks" ? C.roofBarracks : b.k === "house" ? C.roofHouse : C.roofHall; path(b.p, true); x.fill();
      if (!o.footprintOnly){ x.strokeStyle = C.outline; x.lineWidth = Math.max(0.6, 0.7*k); x.stroke(); } });
    if (o.hot) D.buildings.forEach(b => { if (o.hot.indexOf(b.i) >= 0){ x.strokeStyle = C.accent; x.lineWidth = Math.max(2, 2.6*k); path(b.p, true); x.stroke(); } });
  }
  if (o.labels){
    const f = Math.max(9, 15*k), txt = (s, px, py, size, col, bold) => { x.font = (bold ? "700 " : "600 ") + (size || f) + "px Inter, system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
      x.lineWidth = Math.max(2.5, f*0.3); x.strokeStyle = C.textHalo; x.strokeText(s, px, py); x.fillStyle = col || C.text; x.fillText(s, px, py); };
    const seen = {}; D.buildings.forEach(b => { if (!b.n || seen[b.n] || o.skip && o.skip.indexOf(b.n) >= 0) return; const big = b.k === "barracks" || MINOR.indexOf(b.n) >= 0; if (!big) return; seen[b.n] = 1;
      txt(b.n.replace(" Barracks", ""), X(b.c[0]), Y(b.c[1]), f*(b.k === "barracks" ? 0.92 : 0.86), b.n === MINE ? C.accent : null, b.k === "barracks"); });
    D.areas.forEach(a => { if (a.n === "The Plain" || a.n === "Lusk Reservoir" || a.n === "Buffalo Soldier Field" || a.n === "West Point Cemetery") txt(a.n, X(a.c[0]), Y(a.c[1]), f*0.9); });
    x.save(); x.translate(X(B.x1 - 380), Y(500)); x.rotate(-Math.PI/2); txt("HUDSON RIVER", 0, 0, f*1.15, o.dark ? "#9fc3e0" : "#eaf4fb"); x.restore();
  }
  return { W, H, k };
}
/* 10 m grid of "something is here" (buildings, roads, fields, water) so trees only grow on open hillside */
function busyGrid(){
  const cell = 10, cols = Math.round((B.x1 - B.x0)/cell), rows = Math.round((B.y1 - B.y0)/cell), cv = document.createElement("canvas"); cv.width = cols; cv.height = rows;
  const x = cv.getContext("2d", { willReadFrequently: true }), k = 1/cell, X = v => (v - B.x0)*k, Y = v => (B.y1 - v)*k;
  const path = (p, close) => { x.beginPath(); for (let i = 0; i < p.length; i += 2) i ? x.lineTo(X(p[i]), Y(p[i + 1])) : x.moveTo(X(p[0]), Y(p[1])); if (close) x.closePath(); };
  x.fillStyle = "#000"; x.fillRect(0, 0, cols, rows); x.fillStyle = x.strokeStyle = "#fff"; x.lineJoin = "round";
  D.buildings.forEach(b => { x.lineWidth = 5; path(b.p, true); x.fill(); x.stroke(); });
  D.roads.forEach(r => { x.lineWidth = r.c < 3 ? 3.2 : 1.6; path(r.p); x.stroke(); });
  D.areas.forEach(a => { x.lineWidth = 2; path(a.p, true); x.fill(); x.stroke(); });
  const d = x.getImageData(0, 0, cols, rows).data;
  return { busy: (px, py) => { const i = Math.floor((px - B.x0)/cell), j = Math.floor((B.y1 - py)/cell); return i < 0 || j < 0 || i >= cols || j >= rows || d[(j*cols + i)*4] > 40; } };
}
const MINE = "Pershing Barracks";
const MINOR = ["Washington Hall", "Cadet Chapel", "Eisenhower Hall", "Arvin Gymnasium", "Mahan Hall", "Bartlett Hall", "Cullum Hall", "Lincoln Hall", "Thayer Hotel", "Holleder Center", "Grant Barracks", "Old Central Barracks", "Jefferson Hall Library", "Thayer Hall", "Taylor Hall"];
window.BFMap = { load, paint, heightAt, locate, palette, busyGrid, pts, bounds: B, MINE, MINOR, get data(){ return D; } };
})();
