/* Campus shell: the home-screen map (flat 2D first, 3D when the device can handle it),
   landmark labels with live status chips, low-power mode, sound, and the first-visit intro.
   Reads PUBLIC data only (data/brief.json, data/daily.json, data/bills.json). Nothing decrypted is used here. */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const root = document.documentElement;
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
const BF = window.BF || { view: "home", unlocked: () => false, flights: () => [], place: () => null, bills: () => null };
const stage = $("#campus"), map2d = $("#campus2d"), labels = $("#campusLabels");
if (!stage) return;

/* ---------- landmarks: one list drives the 2D map, the 3D campus and the labels ----------
   p = position on the wide map (160 x 100), pm = position on the tall phone map (100 x 124). North is up, the Hudson is on the right. */
const LANDMARKS = [
  {id:"barracks", name:"Pershing Barracks",      views:["brief","schedule"],          at:{b:"Pershing Barracks"}, mine:true},
  {id:"library",  name:"Jefferson Hall Library", views:["courses","study"],           at:{b:"Jefferson Hall Library"}},
  {id:"thayer",   name:"Thayer Hall",            views:["projects"],                  at:{b:"Thayer Hall"}},
  {id:"hq",       name:"Taylor Hall",            views:["about","resume","business"], at:{b:"Taylor Hall"}},
  {id:"stadium",  name:"Michie Stadium",         views:["football"],                  at:{a:"Michie Stadium", h:17}},
  {id:"golf",     name:"Golf Course",            views:["daily"],                     at:{xy:[-1010,430], h:16}, sign:true},   // real course is 1.5 mi west, off this map
  {id:"dock",     name:"South Dock",             views:["flights"],                   at:{a:"South Dock Park", h:4}},
  {id:"trophy",   name:"Trophy Point",           views:["place","personal"],          at:{n:"Battle Monument", h:22}},
  {id:"gate",     name:"Thayer Gate",            views:["contact"],                   at:{b:"Thayer Gate"}},
  {id:"vault",    name:"West Point Mint",        views:["finance","memory"],          at:{xy:[-1010,1180], h:16}, sign:true},  // real Mint is west of the cadet area, off this map
  // direction signs only: they point toward real places that are off this map and do not open anything
  {id:"josh",     name:"Josh's House",           views:[], at:{xy:[1010,1330], h:16},  sign:true, note:"Fishkill · across the river"},
  {id:"home",     name:"Home",                   views:[], at:{xy:[-1010,820], h:16},  sign:true, note:"Caledonia, NY · far west"},
  {id:"nyc",      name:"New York City",          views:[], at:{xy:[420,-1370], h:16},  sign:true, note:"about 50 miles south"},
  {id:"hfalls",   name:"Highland Falls",         views:[], at:{xy:[-150,-1370], h:16}, sign:true, note:"just past Thayer Gate"}
];
const VIEW_NAMES = {brief:"Morning Brief", schedule:"Schedule", courses:"Courses", study:"Study", projects:"Projects", about:"About", resume:"Resume",
  business:"Business", football:"Football", daily:"Daily Golf", flights:"Weekend Flights", place:"Place of the Day", personal:"Personal", contact:"Contact", finance:"Finance", memory:"Memory"};


/* ---------- live status chips (public data only) ---------- */
let BRIEF = null;
const todayKey = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function dueThisWeek(){
  if (!BRIEF || !Array.isArray(BRIEF.due)) return null;
  const now = Date.now(), wk = now + 7*864e5;
  return BRIEF.due.filter(d => { const t = +new Date(d.due); return t >= now && t <= wk; }).length;
}
function chipFor(id){
  try{
    const info = LANDMARKS.find(l => l.id === id); if (info && info.note) return info.note;
    if (id === "vault") return BF.unlocked() ? "Unlocked" : "Locked";
    if (id === "barracks"){
      if (BRIEF && BRIEF.date === todayKey() && Array.isArray(BRIEF.classes)){
        const d = new Date(), hm = String(d.getHours()).padStart(2,"0")+String(d.getMinutes()).padStart(2,"0");
        const next = BRIEF.classes.map(c => String(c).split(" ")).filter(c => c[1] && c[1] > hm)[0];
        if (next) return "Next class "+next[1];
      }
      const n = dueThisWeek(); return n == null ? "Today's brief" : n+" due this week";
    }
    if (id === "library"){
      const t = BRIEF && Array.isArray(BRIEF.tests) ? BRIEF.tests.filter(x => x.date >= todayKey())[0] : null;
      if (t){ const d = new Date(t.date+"T12:00"); return t.course+" "+(/quiz/i.test(t.title) ? "quiz" : /wpr/i.test(t.title) ? "WPR" : /tee/i.test(t.title) ? "TEE" : "event")+" · "+DOW[d.getDay()]; }
      const n = dueThisWeek(); return n ? n+" due this week" : "Notes & flashcards";
    }
    if (id === "thayer") return "3 live demos";
    if (id === "hq") return "Resume · About";
    if (id === "golf") return "1.5 mi west · 3 holes today";
    if (id === "stadium"){ const b = BF.bills(); if (b && b.record){ const g = (b.schedule || [])[0]; return "Bills "+b.record.w+"-"+b.record.l+(g ? " · "+(g.home ? "vs " : "at ")+String(g.opp).split(" ").pop() : ""); } return "Bills & college"; }
    if (id === "golf") return "3 new holes today";
    if (id === "dock"){ const f = BF.flights().slice().sort((a,b) => a.price - b.price)[0]; return f ? "$"+f.price+" · "+String(f.city).split(",")[0] : "Weekend deals"; }
    if (id === "trophy"){ const p = BF.place(); return p && p.name ? p.name : "Place of the day"; }
    if (id === "gate") return "Email · LinkedIn";
  }catch(e){}
  return "";
}
function paintChips(){
  LANDMARKS.forEach(l => { if (!l.el) return; const c = l.el.querySelector(".lm-chip"), t = chipFor(l.id);
    c.textContent = t; c.classList.toggle("lock", l.id === "vault");
    l.el.querySelector(".lm-b").setAttribute("aria-label", l.name+". "+t+(l.views.length ? ". Opens "+l.views.map(v => VIEW_NAMES[v]).join(", ")+"." : ". Direction sign only.")); });
}
fetch("/data/brief.json", {cache:"no-store"}).then(r => r.ok ? r.json() : null).then(j => { BRIEF = j; paintChips(); }).catch(() => {});
document.addEventListener("bf:data", paintChips);
document.addEventListener("bf:auth", paintChips);
setInterval(paintChips, 60000);

/* ---------- labels (real buttons: keyboard + screen-reader friendly, shared by 2D and 3D) ---------- */
LANDMARKS.forEach(l => {
  const el = document.createElement("div"); el.className = "lm"; el.dataset.lm = l.id;
  el.innerHTML = (l.views.length > 1 ? '<div class="lm-links">'+l.views.map(v => '<a href="#'+v+'">'+VIEW_NAMES[v]+'</a>').join("")+'</div>' : '')+
    '<button class="lm-b" type="button"><span class="lm-name">'+l.name+'</span><span class="lm-chip"></span><span class="lm-pin" aria-hidden="true"></span></button>';
  labels.appendChild(el); l.el = el;
  const b = el.querySelector(".lm-b");
  b.addEventListener("click", () => openLandmark(l));
  const hot = on => { setHot(on ? l.id : null); };
  b.addEventListener("pointerenter", () => hot(true)); b.addEventListener("pointerleave", () => hot(false));
  b.addEventListener("focus", () => hot(true)); b.addEventListener("blur", () => hot(false));
});
let hotId = null;
function setHot(id, from3d){
  if (id === hotId) return; hotId = id;
  LANDMARKS.forEach(l => l.el.classList.toggle("hot", l.id === id));
  map2d.querySelectorAll(".m-lm").forEach(g => g.classList.toggle("hot", g.dataset.lm === id));
  stage.classList.toggle("hot", !!id);
  if (id) Sound.tick();
  if (campus && !from3d) campus.highlight(id);
}

/* ---------- flat 2D map: the real West Point map, painted from /campus/westpoint.json (it is the whole home screen in low-power mode) ---------- */
const MAP = window.BFMap, tall = matchMedia("(max-width:860px)");
const isDark = () => { const b = getComputedStyle(root).getPropertyValue("--bg").trim(); return parseInt(b.slice(1, 3), 16) < 128; };
const cv2 = document.createElement("canvas"); map2d.appendChild(cv2);
let full = null, fullKey = "", ready = false; const MINORS = [];
LANDMARKS.forEach(l => { l.el.hidden = true; if (!l.views.length) l.el.classList.add("info"); });
const tipEl = document.createElement("div"); tipEl.className = "lm-tip"; tipEl.hidden = true; stage.appendChild(tipEl);
function resolveLandmarks(){
  if (ready) return;
  LANDMARKS.forEach(l => { const p = MAP.locate(l.at); l.x = p.x; l.y = p.y; l.h = p.h || 0; l.bi = p.bi; });
  const seen = {}; LANDMARKS.forEach(l => { seen[l.name] = 1; });
  MAP.data.buildings.forEach(b => { if (!b.n || seen[b.n] || !(b.k === "barracks" || ["Washington Hall", "Cadet Chapel", "Eisenhower Hall", "Arvin Gymnasium", "Grant Barracks"].indexOf(b.n) >= 0) || b.n === "Old Central Barracks") return; seen[b.n] = 1;
    const el = document.createElement("span"); el.className = "lm-minor"; el.textContent = b.n; el.hidden = true; labels.appendChild(el); MINORS.push({ name: b.n, x: b.c[0], y: b.c[1], h: b.h, el }); });
  ready = true;
}
function putLabel(l, x, y, off){ l.el.hidden = false; l.el.classList.toggle("off", !!off); l.el.style.transform = "translate("+x.toFixed(1)+"px,"+y.toFixed(1)+"px) translate(-50%,-100%)"; }
function drawMap(){
  if (!ready) return;
  const key = (tall.matches ? "t" : "w") + (isDark() ? "d" : "l");
  if (key !== fullKey){ full = document.createElement("canvas"); fullKey = key;
    MAP.paint(full, { pxPerM: tall.matches ? 0.55 : 0.75, dark: isDark(), labels: true, hillshade: true, hot: LANDMARKS.filter(l => l.mine).map(l => l.bi), skip: LANDMARKS.map(l => l.name) }); }
  place2D();
}
function place2D(){
  if (!ready || !full || stage.dataset.state === "3d") return;
  const r = stage.getBoundingClientRect(); if (!r.width) return;
  const T = tall.matches, b = MAP.bounds, dpr = Math.min(window.devicePixelRatio || 1, 2);
  // phones: most of the post. wide screens: the cadet area from Trophy Point to Michie Stadium, plus the whole Hudson out to the Garrison shore.
  // Places outside the view are pinned to the edge.
  const cy = T ? 350 : 600, s = r.height/(T ? 2300 : 1450), cx = T ? 400 : 480, PX = x => (x - cx)*s + r.width/2, PY = y => (cy - y)*s + r.height/2;
  cv2.width = Math.round(r.width*dpr); cv2.height = Math.round(r.height*dpr); cv2.style.width = r.width+"px"; cv2.style.height = r.height+"px";
  const x = cv2.getContext("2d"), pal = MAP.palette(isDark()); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.fillStyle = pal.forest; x.fillRect(0, 0, r.width, r.height);   // the map now reaches past the far (Garrison) shore, so the edge is land
  x.imageSmoothingQuality = "high"; x.drawImage(full, PX(b.x0), PY(b.y1), (b.x1 - b.x0)*s, (b.y1 - b.y0)*s);
  const lw = T ? 132 : 176, lh = T ? 44 : 54, top = T ? 96 : 110;
  LANDMARKS.forEach(l => { l.px = PX(l.x); l.py = PY(l.y); l.sx = l.px; l.sy = l.py - 12; });
  const clamp = l => { l.sx = Math.min(r.width - lw/2 - 4, Math.max(lw/2 + 4, l.sx)); l.sy = Math.min(r.height - 6, Math.max(top, l.sy)); };
  LANDMARKS.forEach(clamp);
  for (let it = 0; it < 60; it++){ let moved = false;   // nudge overlapping labels apart
    for (let i = 0; i < LANDMARKS.length; i++) for (let j = i + 1; j < LANDMARKS.length; j++){ const a = LANDMARKS[i], c = LANDMARKS[j], dx = c.sx - a.sx, dy = c.sy - a.sy, ox = lw - Math.abs(dx), oy = lh - Math.abs(dy);
      if (ox > 0 && oy > 0){ moved = true; if (ox < oy){ const m = ox/2*(dx < 0 ? -1 : 1); a.sx -= m; c.sx += m; } else { const m = oy/2*(dy < 0 ? -1 : 1); a.sy -= m; c.sy += m; } } }
    LANDMARKS.forEach(clamp); if (!moved) break; }
  x.strokeStyle = pal.accent; x.fillStyle = pal.accent; x.lineWidth = 1.5;
  LANDMARKS.forEach(l => { const inside = l.px > 0 && l.px < r.width && l.py > 0 && l.py < r.height;
    if (inside){ x.beginPath(); x.moveTo(l.px, l.py); x.lineTo(l.sx, l.sy); x.stroke(); x.beginPath(); x.arc(l.px, l.py, 3.5, 0, 7); x.fill(); }
    putLabel(l, l.sx, l.sy, !inside); });
  MINORS.forEach(m => { m.el.hidden = true; });
}
map2d.addEventListener("click", e => { if (!ready) return; const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const near = LANDMARKS.map(l => [Math.hypot(l.px - mx, l.py - my), l]).sort((a, b) => a[0] - b[0])[0]; if (near && near[0] < 34) openLandmark(near[1]); });
MAP.load().then(() => { resolveLandmarks(); drawMap(); paintChips(); }).catch(err => console.warn("Map data did not load.", err));
(tall.addEventListener ? tall.addEventListener("change", drawMap) : tall.addListener(drawMap));
if ("ResizeObserver" in window) new ResizeObserver(place2D).observe(stage); else addEventListener("resize", place2D);
document.addEventListener("bf:theme", drawMap);

/* ---------- sound: tiny synthesized UI sounds + quiet ambience. OFF by default, choice is remembered. ---------- */
const Sound = (() => {
  let on = !!store.get("bf-sound", false), ctx = null, out = null, amb = null;
  const btn = $("#soundBtn"), lbl = $("#soundLbl");
  function paint(){ if (!btn) return; btn.setAttribute("aria-pressed", on ? "true" : "false"); btn.setAttribute("aria-label", on ? "Sound is on. Turn sound off" : "Sound is off. Turn sound on"); lbl.textContent = on ? "Sound on" : "Sound off"; }
  function ensure(){
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); out = ctx.createGain(); out.gain.value = 0.6; out.connect(ctx.destination); return true;
  }
  function noiseBuf(sec, brown){
    const b = ctx.createBuffer(1, ctx.sampleRate*sec, ctx.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++){ const w = Math.random()*2 - 1; if (brown){ last = (last + 0.02*w)/1.02; d[i] = last*3.5; } else d[i] = w; }
    return b;
  }
  function blip(f1, f2, dur, vol){
    if (!on || !ensure()) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  function whoosh(){
    if (!on || !ensure()) return; const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf(0.7, false); f.type = "bandpass"; f.Q.value = 0.8; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.35); f.frequency.exponentialRampToValueAtTime(500, t + 0.65);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    s.connect(f); f.connect(g); g.connect(out); s.start(t);
  }
  function ambience(){
    if (!ctx) return;
    if (!on){ if (amb){ try{ amb.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2); const a = amb; setTimeout(() => { try{ a.s.stop(); }catch(e){} }, 900); }catch(e){} amb = null; } return; }
    if (amb) return;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    s.buffer = noiseBuf(4, true); s.loop = true; f.type = "lowpass"; f.frequency.value = 420;
    g.gain.value = 0; g.gain.setTargetAtTime(0.035, ctx.currentTime, 1.2);
    lfo.frequency.value = 0.07; lg.gain.value = 0.012; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(out); s.start(); lfo.start(); amb = {s, g};
  }
  function set(v){ on = v; store.set("bf-sound", on); paint(); if (on){ if (ensure()){ ambience(); blip(520, 780, 0.12, 0.05); } } else ambience(); }
  if (btn) btn.addEventListener("click", () => set(!on));
  paint();
  // A saved "on" can only start after a tap or key press (browser rule).
  if (on){ const kick = () => { removeEventListener("pointerdown", kick); removeEventListener("keydown", kick); if (on && ensure()) ambience(); }; addEventListener("pointerdown", kick); addEventListener("keydown", kick); }
  document.addEventListener("visibilitychange", () => { if (ctx) { if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); } });
  let lastTick = 0;
  return {
    tick(){ const n = performance.now(); if (n - lastTick < 70) return; lastTick = n; blip(1500, 1100, 0.035, 0.012); },
    click(){ blip(700, 520, 0.06, 0.03); },
    open(){ blip(440, 660, 0.14, 0.04); setTimeout(() => blip(660, 990, 0.16, 0.03), 90); },
    whoosh
  };
})();
document.addEventListener("click", e => { if (e.target.closest && e.target.closest("#nav a,.btn,.small-btn,.seg button,.tabs button")) Sound.click(); });
document.addEventListener("bf:auth", e => { if (e.detail) Sound.open(); });

/* ---------- toast ---------- */
function toast(msg){ const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }

/* ---------- display mode: 3D campus or low-power flat 2D ---------- */
const MODE = window.BF_MODE || {pref:"auto", lite:false, why:""};
const zin = $("#campusIn"), zout = $("#campusOut");
const modeBtn = $("#modeBtn"), modeLbl = $("#modeLbl"), modeChip = $("#campusMode"), resetBtn = $("#campusReset"), help = $("#campusHelp");
let campus = null, loading = false;
function webglOK(){ try{ const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }catch(e){ return false; } }
function paintMode(){
  const lite = MODE.lite;
  root.setAttribute("data-mode", lite ? "lite" : "3d");
  modeBtn.setAttribute("aria-pressed", lite ? "true" : "false");
  modeBtn.setAttribute("aria-label", lite ? "Low-power mode is on. Switch to the 3D campus" : "Low-power mode is off. Switch to the fast flat 2D version");
  modeLbl.textContent = lite ? "Low power on" : "Low power";
  modeChip.textContent = campus ? "3D campus" : lite ? "2D · low power" : "2D map";
  resetBtn.hidden = !campus; zin.hidden = zout.hidden = !campus;
  help.textContent = campus ? "Drag to look around, + and − to zoom. Hover a labeled building for its status, click to fly there. Everything is also in the menu."
    : "Pick a landmark to open that part of the site, or use the menu.";
}
function to2D(){
  if (campus){ try{ campus.dispose(); }catch(e){} campus = null; }
  stage.dataset.state = "2d"; stage.classList.remove("flying","playing"); $("#intro").hidden = true;
  place2D(); paintMode();
}
function setLite(lite, auto){
  MODE.lite = lite;
  if (!auto){ MODE.pref = lite ? "lite" : "3d"; store.set("bf-mode", MODE.pref); if (!lite) store.set("bf-slow", false); }
  if (lite) to2D(); else { paintMode(); start3D(); }
}
modeBtn.addEventListener("click", () => setLite(!MODE.lite, false));
const rm = matchMedia("(prefers-reduced-motion: reduce)");
(rm.addEventListener ? rm.addEventListener.bind(rm, "change") : rm.addListener.bind(rm))(() => { if (rm.matches && MODE.pref !== "3d") setLite(true, true); });

async function start3D(){
  if (campus || loading || MODE.lite) return;
  if (!webglOK()){ MODE.lite = true; paintMode(); return; }
  loading = true;
  try{
    await MAP.load(); resolveLandmarks();
    const mod = await import("/js/westpoint3d.js?v=20261113v");
    if (MODE.lite) { loading = false; return; }
    campus = await mod.create({
      stage, canvas: $("#campus3d"),
      map: MAP, dark: isDark, minor: MINORS,
      landmarks: LANDMARKS.map(l => ({id: l.id, x: l.x, y: l.y, h: l.h, bi: l.bi, sign: l.sign, mine: l.mine})),
      placeMinor: (i, x, y, vis) => { const el = MINORS[i].el; el.hidden = !vis; if (vis) el.style.transform = "translate("+x.toFixed(1)+"px,"+y.toFixed(1)+"px) translate(-50%,-50%)"; },
      onHover: id => setHot(id, true),
      onOpen: id => openLandmark(LANDMARKS.find(l => l.id === id)),
      place: (id, x, y, vis, off) => { const l = LANDMARKS.find(q => q.id === id); if (l) putLabel(l, x, y, off); },
      tip: (name, cx, cy) => { if (!name){ tipEl.hidden = true; return; } const r = stage.getBoundingClientRect(); tipEl.textContent = name; tipEl.hidden = false; tipEl.style.transform = "translate("+(cx - r.left + 14)+"px,"+(cy - r.top + 16)+"px)"; },
      watch: MODE.pref !== "3d",
      onSlow: () => { store.set("bf-slow", true); setLite(true, true); toast("3D was running slowly, so I switched to the fast 2D map."); }
    });
    stage.dataset.state = "3d";
    campus.setActive(BF.view === "home" || !BF.view);
    paintMode();
    if (!store.get("bf-intro", false) && (BF.view === "home" || !BF.view)) playIntro();
  }catch(e){ console.warn("3D campus unavailable, staying on the 2D map.", e); campus = null; stage.dataset.state = "2d"; paintMode(); }
  loading = false;
}
resetBtn.addEventListener("click", () => { if (campus) campus.flyHome(); });
zin.addEventListener("click", () => { if (campus) campus.zoom(0.75); });
zout.addEventListener("click", () => { if (campus) campus.zoom(1.33); });

/* ---------- first-visit intro (3D only, under 6 seconds, skippable, never replays) ---------- */
let introEnd = null;
function playIntro(){
  store.set("bf-intro", true);
  const box = $("#intro"); box.hidden = false; stage.classList.add("playing");
  const end = () => { introEnd = null; box.hidden = true; stage.classList.remove("playing"); removeEventListener("keydown", key); stage.removeEventListener("pointerdown", skip); };
  const skip = () => { if (campus) campus.skip(); end(); };
  const key = e => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip(); };
  $("#introSkip").onclick = skip; addEventListener("keydown", key); stage.addEventListener("pointerdown", skip);
  introEnd = skip; Sound.whoosh();
  campus.playIntro(end);
}

/* ---------- opening a landmark ---------- */
function openLandmark(l, view){
  if (!l || !l.views.length) return; view = view || l.views[0];
  if (campus && BF.view === "home" && !stage.classList.contains("playing")){
    Sound.whoosh(); stage.classList.add("flying");
    campus.focus(l.id, () => { stage.classList.remove("flying"); location.hash = "#"+view; });
  } else location.hash = "#"+view;
}
/* If a locked section asks for the password and it is cancelled, pull the camera back out. */
const gate = $("#gate");
if (gate && "MutationObserver" in window) new MutationObserver(() => { if (gate.hidden && campus && BF.view === "home") campus.flyHome(); }).observe(gate, {attributes:true, attributeFilter:["hidden"]});

/* ---------- lazy extras: KaTeX for Study, OR demos for Projects ---------- */
const once = {};
function loadScript(src){ return once[src] || (once[src] = new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); })); }
function loadKatex(){
  if (once.katex) return; once.katex = true;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/vendor/katex/katex.min.css"; document.head.appendChild(l);
  loadScript("/vendor/katex/katex.min.js").then(() => { try{ BF.rerenderStudy && BF.rerenderStudy(); }catch(e){} }).catch(() => {});
}
function onView(v){
  if (introEnd && v !== "home") introEnd();
  if (campus) { campus.setActive(v === "home"); if (v === "home") campus.flyHome(true); }
  if (v === "home") place2D();
  if (v === "study" || v === "courses") loadKatex();
  if (v === "projects") loadScript("/js/demos.js?v=20261113").catch(() => { const m = $("#demoMount"); if (m) m.innerHTML = '<p class="fine">The demos could not load. Check your connection and reload.</p>'; });
}
document.addEventListener("bf:view", e => onView(e.detail));
document.addEventListener("bf:auth", e => { if (e.detail) loadKatex(); });
document.addEventListener("bf:theme", () => { if (campus) campus.retheme(); });

paintMode();
if (BF.view) onView(BF.view);
window.BFShell = { sound: Sound, mode: MODE };
/* The 3D world loads in the background after the page is usable. */
const idle = window.requestIdleCallback ? f => requestIdleCallback(f, {timeout: 1500}) : f => setTimeout(f, 300);
if (!MODE.lite) idle(start3D);
})();
