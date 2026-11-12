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
  {id:"barracks", name:"Barracks",       views:["brief","schedule"],         p:[78,45],  pm:[52,41],  h:5},
  {id:"library",  name:"Library",        views:["courses","study"],          p:[60,68],  pm:[28,80],  h:6},
  {id:"thayer",   name:"Thayer Hall",    views:["projects"],                 p:[112,74], pm:[68,88],  h:5},
  {id:"hq",       name:"Headquarters",   views:["about","resume","business"],p:[98,56],  pm:[56,66],  h:9},
  {id:"stadium",  name:"Michie Stadium", views:["football"],                 p:[28,50],  pm:[20,56],  h:5},
  {id:"golf",     name:"Golf Green",     views:["daily"],                    p:[56,17],  pm:[24,22],  h:3},
  {id:"helipad",  name:"Helipad",        views:["flights"],                  p:[122,44], pm:[74,50],  h:2},
  {id:"trophy",   name:"Trophy Point",   views:["place","personal"],         p:[110,20], pm:[66,24],  h:6},
  {id:"gate",     name:"Thayer Gate",    views:["contact"],                  p:[84,92],  pm:[58,113], h:4},
  {id:"vault",    name:"The Vault",      views:["finance","memory"],         p:[44,86],  pm:[24,104], h:4}
];
const VIEW_NAMES = {brief:"Morning Brief", schedule:"Schedule", courses:"Courses", study:"Study", projects:"Projects", about:"About", resume:"Resume",
  business:"Business", football:"Football", daily:"Daily Golf", flights:"Weekend Flights", place:"Place of the Day", personal:"Personal", contact:"Contact", finance:"Finance", memory:"Memory"};
const DECOR = { chapel:{p:[54,36], pm:[36,38]}, plain:{p:[94,32], pm:[60,30]} };

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
    if (id === "stadium"){ const b = BF.bills(); if (b && b.record){ const g = (b.schedule || [])[0]; return "Bills "+b.record.w+"-"+b.record.l+(g ? " · "+(g.home ? "vs " : "at ")+String(g.opp).split(" ").pop() : ""); } return "Bills & college"; }
    if (id === "golf") return "3 new holes today";
    if (id === "helipad"){ const f = BF.flights().slice().sort((a,b) => a.price - b.price)[0]; return f ? "$"+f.price+" · "+String(f.city).split(",")[0] : "Weekend deals"; }
    if (id === "trophy"){ const p = BF.place(); return p && p.name ? p.name : "Place of the day"; }
    if (id === "gate") return "Email · LinkedIn";
  }catch(e){}
  return "";
}
function paintChips(){
  LANDMARKS.forEach(l => { if (!l.el) return; const c = l.el.querySelector(".lm-chip"), t = chipFor(l.id);
    c.textContent = t; c.classList.toggle("lock", l.id === "vault");
    l.el.querySelector(".lm-b").setAttribute("aria-label", l.name+". "+t+". Opens "+l.views.map(v => VIEW_NAMES[v]).join(", ")+"."); });
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

/* ---------- flat 2D map (always drawn first; it is the whole home screen in low-power mode) ---------- */
const tall = matchMedia("(max-width:860px)");
const TOP = 10;   // room for the name bar on the tall phone map
const pos = l => tall.matches ? [l.pm[0], l.pm[1] + TOP] : l.p;
function glyph(id){
  const G = {
    barracks:'<path class="m-b" d="M-7,-4h14v8h-2.8v-5.2h-8.4v5.2h-2.8z"/><rect class="m-acc" x="-1.2" y="-4" width="2.4" height=".7"/>',
    library:'<rect class="m-b" x="-5.5" y="-3.6" width="11" height="7.2"/><rect class="m-top" x="-3.6" y="-2" width="7.2" height="4"/>',
    thayer:'<rect class="m-b" x="-8" y="-2.6" width="16" height="5.2"/><path class="m-line" d="M-4,-2.6v5.2M0,-2.6v5.2M4,-2.6v5.2"/>',
    hq:'<rect class="m-b" x="-4.5" y="-3.2" width="9" height="6.4"/><rect class="m-top" x="-1.5" y="-1.5" width="3" height="3"/>',
    stadium:'<ellipse class="m-b" rx="7.4" ry="5.2"/><ellipse class="m-grass" rx="4.4" ry="2.6" stroke="var(--faint)" stroke-width=".25"/>',
    golf:'<ellipse class="m-grass m-b" rx="6.4" ry="4"/><circle class="m-top" cx="2" cy="-.4" r=".7"/><path class="m-acc" d="M2,-.4v-3.4l2.4,.9-2.4,.9"/>',
    helipad:'<circle class="m-b" r="3.8"/><path class="m-line" d="M-1.3,-1.6v3.2M1.3,-1.6v3.2M-1.3,0h2.6" stroke-width=".6"/>',
    trophy:'<circle class="m-b" r="3"/><circle class="m-top" r="1.5"/><circle class="m-acc" r=".6"/>',
    gate:'<rect class="m-b" x="-4" y="-1.4" width="2.4" height="2.8"/><rect class="m-b" x="1.6" y="-1.4" width="2.4" height="2.8"/><path class="m-line" d="M-1.6,0h3.2"/>',
    vault:'<path class="m-b" d="M-4.5,3v-3.5a4.5,4.5 0 019,0v3.5z"/><circle cx="0" cy=".2" r="1.7" fill="none" stroke="var(--accent)" stroke-width=".6"/>'
  };
  return G[id] || "";
}
function drawMap(){
  const T = tall.matches, W = T ? 100 : 160, H = T ? 124 + TOP : 100, rx = T ? 84 : 134;   // rx = where the river starts
  let seed = 11; const rnd = () => (seed = (seed*9301+49297)%233280)/233280;
  const wave = []; for (let y = 0; y <= H; y += H/8) wave.push([rx + Math.sin(y/H*5.2)*(T?3:5) - (y < H*.35 ? (T?5:9)*(1 - y/(H*.35)) : 0), y]);
  const river = "M"+(W+400)+",-400L"+wave[0][0].toFixed(1)+",-400L"+wave.map(p => p[0].toFixed(1)+","+p[1].toFixed(1)).join("L")+"L"+wave[wave.length-1][0].toFixed(1)+","+(H+400)+"L"+(W+400)+","+(H+400)+"Z";
  const by = id => pos(LANDMARKS.find(l => l.id === id));
  const road = ids => "M"+ids.map(i => (typeof i === "string" ? by(i) : i).join(",")).join("L");
  let s = '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" style="overflow:visible">'+
    '<rect class="m-ground" x="-400" y="-400" width="'+(W+800)+'" height="'+(H+800)+'"/>';
  for (let x = -390; x < W + 400; x += 10) s += '<path class="m-grid" d="M'+x+',-400V'+(H+400)+'"/>';
  for (let y = -390; y < H + 400; y += 10) s += '<path class="m-grid" d="M-400,'+y+'H'+(W+400)+'"/>';
  s += '<path class="m-water" d="'+river+'"/>';
  const dp = d => T ? [d.pm[0], d.pm[1] + TOP] : d.p, pl = dp(DECOR.plain), ch = dp(DECOR.chapel);
  s += '<rect class="m-grass" x="'+(pl[0]-(T?9:13))+'" y="'+(pl[1]-(T?5:6))+'" width="'+(T?18:26)+'" height="'+(T?10:12)+'" rx="1.5"/>';
  s += '<path class="m-road" d="'+road(["gate","hq","barracks",pl,"trophy"])+'"/><path class="m-road" d="'+road(["library","hq","thayer"])+'"/>'+
       '<path class="m-road" d="'+road(["stadium","barracks","helipad"])+'"/><path class="m-road" d="'+road(["vault","library"])+'"/><path class="m-road" d="'+road(["golf",ch,"barracks"])+'"/>';
  for (let i = 0; i < (T ? 46 : 70); i++){
    const x = 3 + rnd()*(rx - 10), y = 3 + rnd()*(H - 6);
    if (LANDMARKS.some(l => Math.hypot(pos(l)[0]-x, pos(l)[1]-y) < 10) || Math.hypot(pl[0]-x, pl[1]-y) < 15) continue;
    s += '<circle class="m-tree" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(0.9 + rnd()*0.9).toFixed(2)+'"/>';
  }
  s += '<g transform="translate('+ch[0]+','+ch[1]+')"><rect class="m-b" x="-2.4" y="-1.4" width="4.8" height="2.8"/><rect class="m-top" x="-1" y="-1" width="2" height="2"/></g>';
  s += '<text class="m-txt" x="'+(rx+ (T?5:9))+'" y="'+(H*.62)+'" transform="rotate(90 '+(rx+(T?5:9))+' '+(H*.62)+')">Hudson River</text>';
  s += '<text class="m-txt" x="'+pl[0]+'" y="'+(pl[1]+.8)+'" text-anchor="middle">The Plain</text>';
  LANDMARKS.forEach(l => { const p = pos(l); s += '<g class="m-lm" data-lm="'+l.id+'" transform="translate('+p[0]+','+p[1]+')'+(T ? ' scale(.82)' : '')+'">'+glyph(l.id)+'</g>'; });
  map2d.innerHTML = s + '</svg>';
  place2D();
}
function place2D(){
  if (stage.dataset.state === "3d") return;
  const T = tall.matches, W = T ? 100 : 160, H = T ? 124 + TOP : 100, r = stage.getBoundingClientRect();
  if (!r.width) return;
  const k = Math.min(r.width/W, r.height/H), ox = (r.width - W*k)/2, oy = (r.height - H*k)/2;
  LANDMARKS.forEach(l => { const p = pos(l); l.el.hidden = false;
    l.el.style.transform = "translate("+(ox + p[0]*k).toFixed(1)+"px,"+(oy + (p[1] - (T ? 3.4 : 4.6))*k).toFixed(1)+"px) translate(-50%,-100%)"; });
}
map2d.addEventListener("click", e => { const g = e.target.closest(".m-lm"); if (g) openLandmark(LANDMARKS.find(l => l.id === g.dataset.lm)); });
map2d.addEventListener("pointermove", e => { const g = e.target.closest(".m-lm"); setHot(g ? g.dataset.lm : null); });
map2d.addEventListener("pointerleave", () => setHot(null));
drawMap(); paintChips();
(tall.addEventListener ? tall.addEventListener("change", drawMap) : tall.addListener(drawMap));
if ("ResizeObserver" in window) new ResizeObserver(place2D).observe(stage); else addEventListener("resize", place2D);

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
  resetBtn.hidden = !campus;
  help.textContent = campus ? "Drag to look around. Hover a building for its status, click to fly there. Everything is also in the menu."
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
    const mod = await import("/js/campus3d.js");
    if (MODE.lite) { loading = false; return; }
    campus = await mod.create({
      stage, canvas: $("#campus3d"),
      landmarks: LANDMARKS.map(l => ({id: l.id, p: l.p, h: l.h})), decor: DECOR,
      onHover: id => setHot(id, true),
      onOpen: id => openLandmark(LANDMARKS.find(l => l.id === id)),
      place: (id, x, y, vis) => { const l = LANDMARKS.find(q => q.id === id); if (!l) return; l.el.hidden = !vis; if (vis) l.el.style.transform = "translate("+x.toFixed(1)+"px,"+y.toFixed(1)+"px) translate(-50%,-100%)"; },
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
  if (!l) return; view = view || l.views[0];
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
  if (v === "projects") loadScript("/js/demos.js").catch(() => { const m = $("#demoMount"); if (m) m.innerHTML = '<p class="fine">The demos could not load. Check your connection and reload.</p>'; });
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
