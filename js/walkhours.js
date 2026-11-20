/* Walk-off countdown (Schedule tab, locked).
   Tracks punishment-tour hours left, projects the day you're free,
   and throws a big celebration every time you log hours.
   Saved on this device only (localStorage key "bf-walk"). */
(function(){
"use strict";

/* ---------- the rules (edit here if the calendar changes) ---------- */
const START_HOURS = 60;      // total hours given
const PER_WEEKEND = 7;       // hours you can walk on a normal Sat+Sun
const PER_HOLIDAY = 7;       // extra hours on a day-off Monday
const BREAKS = [             // no walking on weekends that touch these dates
  {name:"Thanksgiving break", from:"2026-11-25", to:"2026-11-30"},
  {name:"Winter break",       from:"2026-12-19", to:"2027-01-03"}
];
const HOLIDAYS = [           // extra walk days (school days off)
  {name:"MLK Day",           d:"2027-01-18"},
  {name:"Presidents' Day",   d:"2027-02-15"}
];

/* ---------- small helpers ---------- */
const box = document.getElementById("walkBox");
if (!box) return;
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const pad = n => String(n).padStart(2,"0");
const key = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const today0 = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
const fmt = d => DOW[d.getDay()]+", "+MON[d.getMonth()]+" "+d.getDate();
const fmtH = h => (Math.round(h*10)/10).toString();
const lite = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.mode === "lite";

/* ---------- saved state ---------- */
function load(){
  try{ const s = JSON.parse(localStorage.getItem("bf-walk")); if (s && typeof s.total === "number") return s; }catch(e){}
  return {total:START_HOURS, logs:[], skip:[]};
}
let S = load();
function save(){ try{ localStorage.setItem("bf-walk", JSON.stringify(S)); }catch(e){} }
const walked = () => S.logs.reduce((a,l) => a + l.h, 0);
const left = () => Math.max(0, S.total - walked());

/* ---------- every chance to walk, from this weekend on ---------- */
function inBreak(d){
  const k = key(d);
  return BREAKS.find(b => k >= b.from && k <= b.to);
}
function chances(){
  const t = today0(), out = [];
  // this weekend's Saturday (yesterday if today is Sunday)
  let sat = t.getDay() === 0 ? addDays(t,-1) : addDays(t, (6 - t.getDay() + 7) % 7);
  for (let i = 0; i < 60; i++, sat = addDays(sat,7)){
    const sun = addDays(sat,1), br = inBreak(sat) || inBreak(sun);
    out.push({id:key(sat), type:"wk", a:sat, b:sun, cap:PER_WEEKEND, block: br ? br.name : null});
  }
  HOLIDAYS.forEach(h => { const d = parse(h.d); if (d >= t) out.push({id:h.d, type:"hol", a:d, b:d, cap:PER_HOLIDAY, name:h.name, block: inBreak(d) ? inBreak(d).name : null}); });
  out.sort((x,y) => x.a - y.a);
  // hours already logged inside a chance use up part of it
  out.forEach(c => {
    const used = S.logs.filter(l => l.d >= key(c.a) && l.d <= key(c.b)).reduce((a,l) => a + l.h, 0);
    c.cap = Math.max(0, c.cap - used);
  });
  return out;
}

/* walk forward through the calendar until the hours run out */
function project(){
  let r = left();
  const list = chances(), rows = [];
  if (r <= 0) return {rows, free:null, done:true};
  for (const c of list){
    if (c.block){ rows.push({c, state:"block"}); continue; }
    if (S.skip.includes(c.id)){ rows.push({c, state:"skip"}); continue; }
    if (c.cap <= 0) continue;
    const take = Math.min(r, c.cap); r -= take;
    if (r <= 0){
      // weekend: assume the hours split evenly, so a short last weekend ends Saturday
      const last = (c.type === "wk" && take > c.cap/2) ? c.b : c.a;
      rows.push({c, state:"free", take, after:0, last});
      return {rows, free:last, done:false};
    }
    rows.push({c, state:"walk", take, after:r});
  }
  return {rows, free:null, done:false};
}

/* ---------- drawing ---------- */
box.innerHTML =
  '<div class="wk-top">'+
    '<div class="wk-ring" id="wkRing"><svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="52"/><circle class="bar" id="wkBar" cx="60" cy="60" r="52"/></svg>'+
      '<div class="wk-num"><b id="wkNum">0</b><small>hours left</small></div></div>'+
    '<div class="wk-main">'+
      '<span class="eyebrow">Walk-off countdown</span>'+
      '<h3 id="wkFree"></h3><p id="wkSub" class="wk-sub"></p>'+
      '<div class="clock" id="wkClock"></div>'+
    '</div>'+
  '</div>'+
  '<form class="wk-log" id="wkForm">'+
    '<label>Hours walked <input id="wkIn" type="number" min="0.5" step="0.5" value="7" inputmode="decimal"></label>'+
    '<button class="btn primary" type="submit">Log hours</button>'+
    '<div class="wk-quick"><button type="button" class="small-btn" data-q="1">−1</button><button type="button" class="small-btn" data-q="3.5">−3.5</button><button type="button" class="small-btn" data-q="7">−7</button></div>'+
    '<button type="button" class="link-btn" id="wkUndo">Undo last</button>'+
    '<button type="button" class="link-btn" id="wkEdit">Edit total</button>'+
  '</form>'+
  '<div class="wk-line" id="wkLine"></div>'+
  '<p class="wk-fine">Tap a weekend to mark that you can\'t walk it (a trip, a game, leave). Tap again to undo. Saved on this device.</p>'+
  '<details class="wk-hist"><summary>Walk log</summary><div id="wkHist"></div></details>';

let shown = left(), target = null;

function clock(ms){
  ms = Math.max(0, ms);
  const d = Math.floor(ms/864e5), h = Math.floor(ms/36e5)%24, m = Math.floor(ms/6e4)%60, s = Math.floor(ms/1e3)%60;
  const u = (v,l,r) => '<div class="unit'+(r?' red':'')+'"><b>'+(l==="days"?v:pad(v))+'</b><small>'+l+'</small></div>';
  return u(d,"days",true)+u(h,"hrs")+u(m,"min")+u(s,"sec");
}

function paintNum(v){
  document.getElementById("wkNum").textContent = fmtH(v);
  const frac = S.total ? (S.total - v) / S.total : 1;
  const C = 2*Math.PI*52;
  const bar = document.getElementById("wkBar");
  bar.style.strokeDasharray = C;
  bar.style.strokeDashoffset = C * (1 - Math.min(1, Math.max(0, frac)));
}

function render(){
  const P = project(), L = left();
  paintNum(shown);
  box.classList.toggle("wk-done", P.done);
  const free = document.getElementById("wkFree"), sub = document.getElementById("wkSub");
  if (P.done){
    free.textContent = "You're free. Tours complete.";
    sub.textContent = fmtH(walked())+" of "+fmtH(S.total)+" hours walked.";
    target = null;
    document.getElementById("wkClock").innerHTML = "";
  } else if (P.free){
    const walks = P.rows.filter(r => r.state === "walk" || r.state === "free").length;
    free.innerHTML = 'Free on <em>'+fmt(P.free)+(P.free.getFullYear() !== new Date().getFullYear() ? ", "+P.free.getFullYear() : "")+'</em>';
    sub.textContent = fmtH(L)+" hours over "+walks+" more walk "+(walks === 1 ? "day" : "days")+" · "+fmtH(walked())+" of "+fmtH(S.total)+" done";
    target = +addDays(P.free, 1);  // end of your last walk day
  } else {
    free.textContent = "Not enough walk days found";
    sub.textContent = "Un-skip a weekend to see your free day.";
    target = null;
  }
  tick();

  // weekend timeline
  const line = document.getElementById("wkLine");
  line.innerHTML = P.rows.map((r,i) => {
    const c = r.c, same = c.a.getMonth() === c.b.getMonth();
    const when = c.type === "hol" ? MON[c.a.getMonth()]+" "+c.a.getDate()
      : MON[c.a.getMonth()]+" "+c.a.getDate()+"–"+(same ? "" : MON[c.b.getMonth()]+" ")+c.b.getDate();
    const tag = r.state === "block" ? c.block : r.state === "skip" ? "Can't walk" : c.type === "hol" ? c.name : "Weekend";
    const big = r.state === "free" ? "FREE" : r.state === "walk" ? "−"+fmtH(r.take) : "—";
    const after = r.state === "walk" ? fmtH(r.after)+" left" : r.state === "free" ? "after "+DOW[r.last.getDay()] : "no walking";
    const tap = (r.state === "walk" || r.state === "free" || r.state === "skip") && c.type === "wk";
    return '<'+(tap?'button type="button" data-skip="'+c.id+'"':'div')+' class="wk-chip '+r.state+(c.type==="hol"?" hol":"")+'" style="--i:'+i+'">'+
      '<small>'+tag+'</small><b>'+when+'</b><span class="big">'+big+'</span><small>'+after+'</small></'+(tap?'button':'div')+'>';
  }).join("");

  // log
  document.getElementById("wkHist").innerHTML = S.logs.length
    ? S.logs.slice().reverse().map(l => '<div class="wk-h"><span>'+fmt(parse(l.d))+'</span><b>−'+fmtH(l.h)+' hrs</b></div>').join("")
    : '<p class="wk-fine">No hours logged yet.</p>';
}

function tick(){
  const el = document.getElementById("wkClock");
  if (target) el.innerHTML = clock(target - Date.now());
}
setInterval(() => { if (box.offsetParent) tick(); }, 1000);

/* ---------- logging ---------- */
function logHours(h){
  h = Math.round(Number(h)*2)/2;
  if (!(h > 0)) return;
  const before = left();
  if (before <= 0) return;
  h = Math.min(h, before);
  S.logs.push({d:key(new Date()), h});
  save();
  const after = left();
  render();
  rollTo(before, after);
  celebrate(h, after);
}

document.getElementById("wkForm").addEventListener("submit", e => { e.preventDefault(); logHours(document.getElementById("wkIn").value); });
box.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => logHours(b.dataset.q)));
document.getElementById("wkUndo").addEventListener("click", () => {
  if (!S.logs.length) return;
  S.logs.pop(); save(); shown = left(); render();
});
document.getElementById("wkEdit").addEventListener("click", () => {
  const v = prompt("Hours left right now? (this resets the log)", fmtH(left()));
  if (v === null) return;
  const n = Number(v);
  if (!(n >= 0)) return;
  S = {total: Math.max(n, 0), logs: [], skip: S.skip}; save(); shown = left(); render();
});
document.getElementById("wkLine").addEventListener("click", e => {
  const b = e.target.closest("[data-skip]"); if (!b) return;
  const id = b.dataset.skip, i = S.skip.indexOf(id);
  if (i >= 0) S.skip.splice(i,1); else S.skip.push(id);
  save(); render();
});

/* number counts down instead of jumping */
function rollTo(from, to){
  if (lite()){ shown = to; paintNum(to); return; }
  const t0 = performance.now(), dur = 1400;
  (function step(t){
    const p = Math.min(1, (t - t0)/dur), e = 1 - Math.pow(1-p, 4);
    shown = from + (to - from)*e; paintNum(shown);
    if (p < 1) requestAnimationFrame(step); else { shown = to; paintNum(to); }
  })(t0);
}

/* ---------- the over-the-top celebration ---------- */
const HYPE = ["BOOTS ON GROUND","AREA = CONQUERED","TOURS CRUSHED","ONE STEP CLOSER","HOOAH!","LEGENDARY MARCH","CENTRAL AREA BOSS","KEEP MARCHING"];
function celebrate(h, after){
  const fin = after <= 0;
  if (lite()){ banner(fin ? "FREE!" : "−"+fmtH(h)+" HRS", fin ? "Tours complete" : fmtH(after)+" hours left", fin); return; }
  document.body.classList.remove("wk-shake"); void document.body.offsetWidth; document.body.classList.add("wk-shake");
  setTimeout(() => document.body.classList.remove("wk-shake"), 900);
  const ring = document.getElementById("wkRing");
  ring.classList.remove("pop"); void ring.offsetWidth; ring.classList.add("pop");
  flash(fin);
  banner(fin ? "YOU'RE FREE!" : "−"+fmtH(h)+" HOURS", fin ? "60 hours. Done. Go live your life." : HYPE[Math.floor(Math.random()*HYPE.length)]+" · "+fmtH(after)+" left", fin);
  burst(fin);
}

function flash(fin){
  const f = document.createElement("div"); f.className = "wk-flash"+(fin?" gold":"");
  document.body.appendChild(f); setTimeout(() => f.remove(), 900);
  const w = document.createElement("div"); w.className = "wk-wave"+(fin?" gold":"");
  document.body.appendChild(w); setTimeout(() => w.remove(), 1200);
}

function banner(big, small, fin){
  const b = document.createElement("div"); b.className = "wk-banner"+(fin?" gold":"");
  b.innerHTML = '<b>'+big+'</b><small>'+small+'</small>';
  document.body.appendChild(b); setTimeout(() => b.remove(), fin ? 4200 : 2600);
}

function burst(fin){
  const cv = document.createElement("canvas"); cv.className = "wk-fx";
  document.body.appendChild(cv);
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.width = W*dpr; cv.height = H*dpr;
  const g = cv.getContext("2d"); g.scale(dpr,dpr);
  const cols = fin ? ["#ffd23f","#fff3b0","#ff4a5f","#ffffff","#35c7a5","#4fa3ff"] : ["#e0243c","#ff4a5f","#ffd23f","#ffffff","#4fa3ff","#b48cff"];
  const emo = ["🎉","🔥","💪","🎖️","🥾","⭐","🚀"];
  const P = [];
  const add = (x,y,ang,spd,n,spread) => { for (let i=0;i<n;i++){ const a = ang + (Math.random()-.5)*spread, v = spd*(.5+Math.random());
    P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:4+Math.random()*6,c:cols[i%cols.length],rot:Math.random()*6,vr:(Math.random()-.5)*.4,
      e: Math.random() < .12 ? emo[Math.floor(Math.random()*emo.length)] : null, life:1, shape:Math.random()<.5}); } };
  // cannons from both bottom corners + a pop from the middle
  add(0, H, -Math.PI/3, 22, 120, .8);
  add(W, H, -2*Math.PI/3, 22, 120, .8);
  add(W/2, H*.4, 0, 14, 90, Math.PI*2);
  let fireworks = fin ? 8 : 0, nextFw = 0;
  const t0 = performance.now(), dur = fin ? 5200 : 3200;
  (function frame(t){
    const el = t - t0;
    if (fireworks > 0 && el > nextFw){ fireworks--; nextFw = el + 450; add(W*(.15+Math.random()*.7), H*(.15+Math.random()*.35), 0, 11, 80, Math.PI*2); }
    g.clearRect(0,0,W,H);
    for (const p of P){
      p.vy += .45; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (el > dur - 900) p.life = Math.max(0, p.life - .03);
      g.save(); g.globalAlpha = p.life; g.translate(p.x,p.y); g.rotate(p.rot);
      if (p.e){ g.font = (p.r*4)+"px serif"; g.fillText(p.e, -p.r*2, p.r*2); }
      else { g.fillStyle = p.c; if (p.shape) g.fillRect(-p.r/2,-p.r,p.r,p.r*2); else { g.beginPath(); g.arc(0,0,p.r/1.6,0,7); g.fill(); } }
      g.restore();
    }
    if (el < dur) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

render();
})();
