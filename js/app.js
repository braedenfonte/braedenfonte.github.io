(function(){
"use strict";
let SCHED = {"events":[],"days":{}};

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const parseD = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const key = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const CATS = {
  due:{label:"Due dates"}, exam:{label:"Quizzes & exams"}, soccer:{label:"Soccer"}, game:{label:"Football games"},
  corps:{label:"Corps events"}, break:{label:"Breaks & leave"}, personal:{label:"Personal"}
};
const STAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';

/* events with ids and dates (filled in after the private data is unlocked) */
let EVENTS = [];
/* AY27-1 class periods (24h "HHMM" start-end). Course events get their class time,
   so the countdown runs to the start of class instead of flipping to "Now" at midnight. */
const CLASS_TIMES = {
  MA376:["0740","0835"], SS388:["0905","1020"], EM481:["1410","1525"],
  MA486:["0740","0835"], MA481X:["0845","0940"], MA481:["0845","0940"], MS300:["1035","1150"]
};
const atHM = (d, hm) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), +hm.slice(0,2), +hm.slice(2,4), 0);
function eventTime(e){
  const t = (e.time || "").replace(":", "");
  if (/^\d{4}$/.test(t)) return [t, (e.endTime || "").replace(":", "") || null];
  if (e.end && e.end !== e.start) return null;
  const m = String(e.t).toUpperCase().match(/\b(MA481X|MA481|MA376|SS388|EM481|MA486|MS300)\b/);
  return m ? CLASS_TIMES[m[1]] : null;
}
function buildEvents(){
  EVENTS = SCHED.events.map((e,i) => {
    let s = parseD(e.start), en = e.end ? parseD(e.end) : parseD(e.start);
    let endT = new Date(en.getFullYear(), en.getMonth(), en.getDate(), 23, 59, 59), timed = false;
    const tm = eventTime(e);
    if (tm) { timed = true; s = atHM(s, tm[0]); endT = tm[1] ? atHM(en, tm[1]) : new Date(+s + 60*6e4); en = new Date(endT); }
    return { id: e.start+"-"+i, t: e.t, cat: e.cat, s, e: en, endT, timed };
  });
}
let stars = new Set(store.get("bf-stars", []));
const saveStars = () => store.set("bf-stars", [...stars]);

function fmtRange(ev){
  const a = ev.s, b = ev.e;
  const d1 = DOW[a.getDay()]+", "+MON[a.getMonth()]+" "+a.getDate();
  if (ev.timed) return d1+" · "+a.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
  if (+a === +b) return d1;
  return d1+" – "+(a.getMonth()===b.getMonth() ? b.getDate() : MON[b.getMonth()]+" "+b.getDate());
}
function parts(ms){
  ms = Math.max(0, ms);
  return { d: Math.floor(ms/864e5), h: Math.floor(ms/36e5)%24, m: Math.floor(ms/6e4)%60, s: Math.floor(ms/1e3)%60 };
}
function cdText(ev, now){
  if (now > ev.endT) return {main:"Done", sub:"past"};
  if (now >= ev.s) return {main:"Now", sub: ev.timed ? "in class" : "happening"};
  const p = parts(ev.s - now);
  if (p.d >= 1) return {main: p.d+"d "+p.h+"h", sub: p.d===1 ? "tomorrow" : "to go"};
  return {main: p.h+"h "+p.m+"m", sub:"today"};
}
function clockHTML(ms, red){
  const p = parts(ms);
  const u = (v,l,r) => '<div class="unit'+(r?' red':'')+'"><b data-u="'+l+'">'+String(v).padStart(l==="days"?1:2,"0")+'</b><small>'+l+'</small></div>';
  return u(p.d,"days",red)+u(p.h,"hrs")+u(p.m,"min")+u(p.s,"sec");
}
function setClock(el, ms){
  const p = parts(ms), m = {days:p.d, hrs:p.h, min:p.m, sec:p.s};
  el.querySelectorAll("[data-u]").forEach(b => { const l = b.dataset.u; b.textContent = String(m[l]).padStart(l==="days"?1:2,"0"); });
}
function toast(msg){
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}
function upcoming(now){ return EVENTS.filter(e => !(e.cat === "soccer" && /^Practice/.test(e.t)) && e.endT >= now).sort((a,b) => a.s - b.s); }

/* ---------- theme ---------- */
const root = document.documentElement;
function curTheme(){
  const a = root.getAttribute("data-theme");
  if (a) return a;
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function paintThemeBtn(){ $("#themeLbl").textContent = curTheme()==="dark" ? "Light" : "Dark"; }
const savedTheme = store.get("bf-theme", null);
if (savedTheme) root.setAttribute("data-theme", savedTheme);
paintThemeBtn();
$("#themeBtn").addEventListener("click", () => {
  const next = curTheme()==="dark" ? "light" : "dark";
  root.setAttribute("data-theme", next); store.set("bf-theme", next); paintThemeBtn(); drawArt(); GG.draw(); document.dispatchEvent(new CustomEvent("bf:theme", {detail: next}));
});

/* ---------- private tabs: password gate + encrypted data ---------- */
// Tabs that need the password. Edit this list to lock or unlock more tabs.
const LOCKED = ["brief","schedule","about","resume","courses","study","finance","memory","personal"];
// The private data (schedule, resume, courses, travel places, About and Golf/Gallery text) lives in
// data/private.enc, encrypted with AES-256-GCM using a key derived from the password (PBKDF2-SHA256).
// Without the password it cannot be read. See tools/private.py to change it.
let PRIVATE = null;
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64e = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
let encBlob = null;
async function getBlob(){
  if (!encBlob) { const r = await fetch("/data/private.enc", {cache:"no-store"}); if (!r.ok) throw new Error("fetch"); encBlob = await r.json(); }
  return encBlob;
}
async function deriveBits(pw, blob){
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", salt:b64d(blob.salt), iterations:blob.iter}, k, 256);
}
async function openWith(bits, blob){
  const key = await crypto.subtle.importKey("raw", bits, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({name:"AES-GCM", iv:b64d(blob.iv)}, key, b64d(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
function isUnlocked(){ return !!PRIVATE; }
function paintAuth(){
  document.body.classList.toggle("authed", !!PRIVATE);
  $("#lockBtn").hidden = !PRIVATE;
  document.dispatchEvent(new CustomEvent("bf:auth", {detail: !!PRIVATE}));
}
function applyPrivate(P){
  PRIVATE = P;
  SCHED = P.sched; RES = P.res; COURSES = P.courses; MAP.places = P.places; VISITED_STATES = P.visited; STUDY = P.study || {}; TODO = P.todo || [];
  buildEvents();
  hubs = MAP.places.filter(p => p.type === "hub");
  ZOOMS = { all:[0,0,MAP.W,MAP.H], ne:fitBox(["New York","Northeast","Mid-Atlantic"], 40), ny:fitBox(["New York"], 22) };
  $("#privAbout").innerHTML = P.html.about;
  $("#privPersonal").innerHTML = P.html.personal;
  paintAuth();
  renderHome(); renderSched(); renderResume(); renderCourses(); renderTravel(); renderDaily(); renderStudy(); renderFinance();
  if (P.finKey){ loadFinance(P.finKey); loadStudy(); loadTrip(); loadSchedFix(); if (cView === "prep") renderPrep(); if (projOpen){ const f = projOpen; projOpen = ""; openProjFolder(f); } }
}
async function bootAuth(){
  let k = null;
  try{ k = sessionStorage.getItem("bf-key") || localStorage.getItem("bf-key"); }catch(e){}
  if (!k || !(window.crypto && crypto.subtle)) return;
  try{ applyPrivate(await openWith(b64d(k), await getBlob())); }
  catch(e){ if (e && e.name === "OperationError") { try{ sessionStorage.removeItem("bf-key"); localStorage.removeItem("bf-key"); }catch(x){} } }
}
let gateTarget = null, gateFrom = null, gateFails = 0, gateWait = 0;
function openGate(v){
  gateTarget = v; gateFrom = document.activeElement;
  const a = document.querySelector('#nav a[data-v="'+v+'"]');
  const name = a ? a.textContent.trim() : "This tab";
  $("#gateT").textContent = name + " is locked";
  $("#gateErr").textContent = "";
  $("#gatePw").value = "";
  $("#gate").classList.remove("ok");
  $("#gate").hidden = false;
  document.body.classList.add("gate-open");
  document.body.classList.remove("nav-open");
  setTimeout(() => $("#gatePw").focus(), 60);
}
function closeGate(){
  $("#gate").hidden = true;
  document.body.classList.remove("gate-open");
  gateTarget = null;
  if (gateFrom && gateFrom.focus) { try{ gateFrom.focus(); }catch(e){} }
}
$("#gateX").addEventListener("click", closeGate);
$("#gate").addEventListener("click", e => { if (e.target.id === "gate") closeGate(); });
addEventListener("keydown", e => {
  if ($("#gate").hidden) return;
  if (e.key === "Escape") closeGate();
  if (e.key === "Tab") {
    const f = [...$("#gate").querySelectorAll("input,button")].filter(x => !x.disabled);
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length-1].focus(); }
    else if (!e.shiftKey && i === f.length-1) { e.preventDefault(); f[0].focus(); }
  }
});
$("#gateForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#gateErr"), val = $("#gatePw").value;
  if (!val) return;
  if (Date.now() < gateWait) { err.textContent = "Too many tries. Wait a few seconds."; return; }
  if (!(window.crypto && crypto.subtle)) { err.textContent = "This browser can't unlock here. Open the site over https."; return; }
  $("#gateGo").disabled = true;
  let bits = null, P = null, bad = false;
  try{ const blob = await getBlob(); bits = await deriveBits(val, blob); P = await openWith(bits, blob); }
  catch(x){
    if (x && x.name === "OperationError") bad = true;
    else { err.textContent = "Couldn't load the private data. Check your connection and try again."; $("#gateGo").disabled = false; return; }
  }
  $("#gateGo").disabled = false;
  if (bad) {
    gateFails++;
    if (gateFails >= 5) { gateWait = Date.now() + 30000; gateFails = 0; err.textContent = "Too many tries. Wait 30 seconds."; }
    else err.textContent = "Wrong password.";
    const c = $("#gateForm"); c.classList.remove("bad"); void c.offsetWidth; c.classList.add("bad");
    $("#gatePw").select();
    return;
  }
  gateFails = 0;
  try{ (($("#gateRem").checked) ? localStorage : sessionStorage).setItem("bf-key", b64e(bits)); }catch(x){}
  applyPrivate(P);
  const go = gateTarget;
  $("#gate").classList.add("ok");
  setTimeout(() => { closeGate(); if (go) location.hash = "#"+go; }, reduce.matches ? 0 : 520);
});
$("#lockBtn").addEventListener("click", () => {
  try{ sessionStorage.removeItem("bf-key"); localStorage.removeItem("bf-key"); }catch(e){}
  history.replaceState(null, "", "#home");
  location.reload();   // drops the decrypted data from memory
});
document.querySelectorAll("#nav a").forEach(a => { if (LOCKED.includes(a.dataset.v)) a.classList.add("lk"); });

/* ---------- cinematic transitions ---------- */
const reduceMQ = matchMedia("(prefers-reduced-motion: reduce)");
/* low-power mode (see index.html head + js/shell.js) counts as reduced motion too */
const reduce = { get matches(){ return reduceMQ.matches || document.documentElement.dataset.mode === "lite"; } };
const cine = document.createElement("div");
cine.id = "cine"; cine.setAttribute("aria-hidden","true");
cine.innerHTML = '<i class="cb t"></i><i class="cb b"></i><i class="cs"></i>';
document.body.appendChild(cine);
let cineT = [], firstPaint = true;
function cinematic(swap){ firstPaint = false; cine.className = ""; swap(); }

/* focus-pull reveal as a page opens and as blocks scroll into view */
const REVEAL = ".page-h > *, .hero > *, .panel, .place-hero, .sec-h, .wk-strip";
const io = ("IntersectionObserver" in window) ? new IntersectionObserver(es => es.forEach(en => {
  if (!en.isIntersecting) return;
  const el = en.target; io.unobserve(el); el.classList.add("in");
  setTimeout(() => el.classList.remove("rv","in"), 1500);
}), {threshold:.06, rootMargin:"0px 0px -5% 0px"}) : null;
function revealView(sec){
  if (!io || reduce.matches || !sec) return;
  const all = [...sec.querySelectorAll(REVEAL)].filter(el => !el.closest(".stagger") && !el.closest(".tl-row") && !el.matches(".name"));
  all.filter(el => !all.some(o => o !== el && o.contains(el))).forEach((el,i) => {
    el.style.setProperty("--d", Math.min(i*70, 560)+"ms");
    el.classList.remove("in"); el.classList.add("rv"); io.observe(el);
  });
}
/* cursor spotlight on cards */
if (matchMedia("(hover:hover)").matches) {
  let raf = 0, ev = null, prev = null;
  document.addEventListener("pointermove", e => {
    ev = e; if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const p = ev.target.closest ? ev.target.closest(".panel") : null;
      if (prev && prev !== p) { prev.style.removeProperty("--mx"); prev.style.removeProperty("--my"); }
      prev = p; if (!p) return;
      const r = p.getBoundingClientRect();
      p.style.setProperty("--mx", (ev.clientX - r.left)+"px"); p.style.setProperty("--my", (ev.clientY - r.top)+"px");
    });
  }, {passive:true});
}

/* ---------- routing ---------- */
const VIEWS = ["home","brief","flights","football","daily","place","schedule","about","resume","courses","study","projects","business","finance","memory","personal","contact"];
let curView = null;
function showView(v){
  curView = v;
  document.querySelectorAll(".view").forEach(s => s.classList.toggle("on", s.id === "v-"+v));
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.v === v));
  document.body.classList.remove("nav-open");
  window.scrollTo(0,0);
  if (v === "projects") drawArt();
  if (v === "daily") GG.draw();
  if (v === "memory") GX.open(); else GX.close();
  revealView($("#v-"+v));
  document.body.dataset.view = v;
  document.dispatchEvent(new CustomEvent("bf:view", {detail: v}));
}

function route(){
  let v = (location.hash || "#home").slice(1);
  if (!VIEWS.includes(v)) v = "home";
  if (LOCKED.includes(v) && !isUnlocked()) {
    // stay on the page you were on, then ask for the password
    const back = curView || "home";
    history.replaceState(null, "", "#"+back);
    if (!curView) { firstPaint = false; showView("home"); }
    openGate(v);
    return;
  }
  if (v === curView) return;
  cinematic(() => showView(v));
}
addEventListener("hashchange", route);
$("#menuBtn").addEventListener("click", () => document.body.classList.add("nav-open"));
$("#scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));
paintAuth();

/* ---------- event row ---------- */
function rowHTML(ev, now){
  const c = cdText(ev, now), on = stars.has(ev.id), past = now > ev.endT;
  return '<div class="panel up'+(past?' past':'')+(on?' star-on':'')+'" data-cat="'+ev.cat+'" data-open="'+ev.id+'" role="button" tabindex="0">'+
    '<div class="datebox"><small>'+MON[ev.s.getMonth()]+'</small><b>'+ev.s.getDate()+'</b></div>'+
    '<div style="min-width:0"><h4>'+esc(ev.t)+'</h4><p>'+fmtRange(ev)+' · '+CATS[ev.cat].label+'</p></div>'+
    '<div class="row-end"><div class="cd" data-cd="'+ev.id+'">'+c.main+'<small>'+c.sub+'</small></div>'+
    '<button class="star'+(on?' on':'')+'" type="button" data-star="'+ev.id+'" aria-label="'+(on?'Unstar':'Star')+' '+esc(ev.t)+'">'+STAR_SVG+'</button></div></div>';
}

/* ---------- home ---------- */
const GRAD = new Date(2028, 4, 20, 10, 0, 0);
const TERM_S = new Date(2026, 7, 9), TERM_E = new Date(2026, 11, 20);
function renderHome(){
  const now = new Date();
  $("#gradClock").innerHTML = clockHTML(GRAD - now, true);
  const pct = Math.min(100, Math.max(0, (now - TERM_S) / (TERM_E - TERM_S) * 100));
  $("#termBar").style.width = pct.toFixed(1)+"%";
  $("#termPct").textContent = Math.round(pct)+"% through the term";
  const dLeave = Math.ceil((TERM_E - now)/864e5);
  $("#stDays").textContent = dLeave > 0 ? dLeave : "0";
  const wk = new Date(now); wk.setDate(wk.getDate()+7);
  $("#stWeek").textContent = PRIVATE ? EVENTS.filter(e => e.s >= new Date(now.getFullYear(),now.getMonth(),now.getDate()) && e.s < wk).length : "—";
  const starred = upcoming(now).filter(e => stars.has(e.id));
  const list = starred.length ? starred.slice(0,5) : upcoming(now).slice(0,5);
  $("#upTitle").textContent = starred.length ? "Starred countdowns" : "Next up";
  $("#homeUp").innerHTML = list.length ? list.map(e => rowHTML(e, now)).join("") :
    '<div class="panel empty-state">'+(PRIVATE ? 'No upcoming events. Enjoy the break.' : 'Unlock the private tabs to see upcoming events.')+'</div>';
}

/* ---------- schedule ---------- */
let sView = store.get("bf-sview", "cal");
let activeCats = new Set(Object.keys(CATS));
let query = "";
const today = new Date();
let calY = today.getFullYear(), calM = today.getMonth();
if (today < TERM_S) { calY = 2026; calM = 7; }
if (today > TERM_E) { calY = 2026; calM = 11; }
let selDay = key(today);

function filtered(){
  const q = query.trim().toLowerCase();
  return EVENTS.filter(e => activeCats.has(e.cat) && (!q || e.t.toLowerCase().includes(q) || CATS[e.cat].label.toLowerCase().includes(q)));
}
function renderNextHero(){
  const now = new Date();
  const pool = upcoming(now).filter(e => e.s > now && e.cat !== "break");
  const n = pool.find(e => stars.has(e.id)) || pool[0];
  const el = $("#nextHero");
  if (!n){ el.innerHTML = '<div><span class="eyebrow">Next up</span><h3>Term complete</h3></div>'; return; }
  el.dataset.cat = n.cat; el.style.setProperty("--c", "var(--c-"+n.cat+")");
  el.innerHTML = '<div><span class="eyebrow">'+(stars.has(n.id)?"Starred · next":"Next up")+'</span><h3>'+esc(n.t)+'</h3><p>'+fmtRange(n)+' · '+CATS[n.cat].label+'</p></div>'+
    '<div class="clock" id="heroClock" data-target="'+(+n.s)+'">'+clockHTML(n.s - now, true)+'</div>';
}
function renderFilters(){
  const counts = {}; EVENTS.forEach(e => counts[e.cat] = (counts[e.cat]||0)+1);
  $("#catFilters").innerHTML = Object.keys(CATS).map(c =>
    '<button type="button" class="fbtn'+(activeCats.has(c)?' on':'')+'" data-cat="'+c+'" data-cf="'+c+'"><span class="dot"></span>'+CATS[c].label+' <span class="n">'+counts[c]+'</span></button>'
  ).join("");
}
function renderCal(){
  const evs = filtered();
  const first = new Date(calY, calM, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const byDay = {};
  evs.forEach(e => { for (let d = new Date(e.s); d <= e.e; d.setDate(d.getDate()+1)) (byDay[key(d)] = byDay[key(d)] || []).push(e); });
  let cells = DOW.map(d => '<div class="cal-dow">'+d+'</div>').join("");
  const tk = key(new Date());
  for (let i = 0; i < 42; i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    if (i === 35 && d.getMonth() !== calM) break;
    const k = key(d), list = byDay[k] || [], tag = SCHED.days[k] || "";
    const shown = list.slice(0,3).map(e => '<div class="pill" data-cat="'+e.cat+'">'+esc(e.t)+'</div>').join("");
    cells += '<button type="button" class="day'+(d.getMonth()!==calM?' out':'')+(k===tk?' today':'')+(k===selDay?' sel':'')+'" data-day="'+k+'" aria-label="'+MONTH[d.getMonth()]+' '+d.getDate()+', '+list.length+' events">'+
      '<div class="dn"><b>'+d.getDate()+'</b><small>'+esc(tag)+'</small></div>'+shown+(list.length>3?'<div class="more">+'+(list.length-3)+' more</div>':'')+'</button>';
  }
  const sd = parseD(selDay), sl = byDay[selDay] || [], now = new Date();
  return '<div class="cal-head"><h3>'+MONTH[calM]+' '+calY+'</h3><div class="cal-nav">'+
    '<button class="icon-btn" type="button" id="calPrev" aria-label="Previous month"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>'+
    '<button class="small-btn" type="button" id="calToday">Today</button>'+
    '<button class="icon-btn" type="button" id="calNext" aria-label="Next month"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div></div>'+
    '<div class="cal-wrap"><div class="cal">'+cells+'</div></div>'+
    '<div class="panel day-detail"><h4>'+DOW[sd.getDay()]+', '+MONTH[sd.getMonth()]+' '+sd.getDate()+(SCHED.days[selDay]?' <span class="chip">'+esc(SCHED.days[selDay])+'</span>':'')+'</h4>'+
    (sl.length ? '<div class="up-list">'+sl.map(e => rowHTML(e, now)).join("")+'</div>' : '<p class="empty">Nothing scheduled. Pick another day.</p>')+'</div>';
}
function renderList(onlyStar){
  const now = new Date();
  let evs = filtered();
  if (onlyStar) evs = evs.filter(e => stars.has(e.id));
  const showPast = store.get("bf-past", false);
  if (!showPast) evs = evs.filter(e => e.endT >= now);
  evs.sort((a,b) => a.s - b.s);
  const head = '<label class="toggle" style="margin-bottom:16px"><input type="checkbox" id="pastT"'+(showPast?' checked':'')+'> Show past events</label>';
  if (!evs.length) return head + '<div class="panel empty-state">'+(onlyStar ? "No starred events yet. Tap the star on any event to pin its countdown to Home." : "No events match.")+'</div>';
  const groups = {};
  evs.forEach(e => { const k = MONTH[e.s.getMonth()]+" "+e.s.getFullYear(); (groups[k] = groups[k] || []).push(e); });
  return head + Object.keys(groups).map(g => '<div class="list-month"><h4><span>'+g+'</span><span>'+groups[g].length+' events</span></h4><div class="up-list">'+groups[g].map(e => rowHTML(e, now)).join("")+'</div></div>').join("");
}
function renderSched(){
  ["vCal","vList","vStar"].forEach(id => $("#"+id).classList.toggle("on", ({vCal:"cal",vList:"list",vStar:"star"})[id] === sView));
  renderFilters();
  $("#schedBody").innerHTML = sView === "cal" ? renderCal() : renderList(sView === "star");
  renderNextHero();
}
$("#vCal").addEventListener("click", () => { sView="cal"; store.set("bf-sview",sView); renderSched(); });
$("#vList").addEventListener("click", () => { sView="list"; store.set("bf-sview",sView); renderSched(); });
$("#vStar").addEventListener("click", () => { sView="star"; store.set("bf-sview",sView); renderSched(); });
$("#q").addEventListener("input", e => { query = e.target.value; if (query && sView==="cal") { sView="list"; } renderSched(); });

/* ---------- drawer ---------- */
function openEvent(id){
  const ev = EVENTS.find(e => e.id === id); if (!ev) return;
  const now = new Date(), on = stars.has(id);
  const target = now < ev.s ? ev.s : null;
  $("#drawerRoot").innerHTML = '<div class="drawer" id="drawer"><div class="sheet" data-cat="'+ev.cat+'" role="dialog" aria-modal="true" aria-label="'+esc(ev.t)+'">'+
    '<button class="icon-btn sheet-close" type="button" id="dClose" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
    '<span class="chip"><span class="dot"></span>'+CATS[ev.cat].label+'</span>'+
    '<h3>'+esc(ev.t)+'</h3><p class="meta">'+fmtRange(ev)+(SCHED.days[key(ev.s)]?' · Lesson '+esc(SCHED.days[key(ev.s)]):'')+'</p>'+
    (target ? '<div class="clock" id="dClock" data-target="'+(+target)+'">'+clockHTML(target - now, true)+'</div>' :
      '<p style="margin:22px 0;font:600 18px var(--display)">'+(now > ev.endT ? "This one's done." : "Happening now.")+'</p>')+
    '<div class="sheet-actions"><button class="btn'+(on?'':' primary')+'" type="button" id="dStar">'+(on?'Remove from Home':'Pin countdown to Home')+'</button>'+
    '<button class="link-btn" type="button" id="dDay">Show on calendar →</button></div></div></div>';
  const close = () => { $("#drawerRoot").innerHTML = ""; };
  $("#drawer").addEventListener("click", e => { if (e.target.id === "drawer") close(); });
  $("#dClose").addEventListener("click", close);
  $("#dClose").focus();
  $("#dStar").addEventListener("click", () => { toggleStar(id); close(); });
  $("#dDay").addEventListener("click", () => { close(); selDay = key(ev.s); calY = ev.s.getFullYear(); calM = ev.s.getMonth(); sView = "cal"; query = ""; $("#q").value=""; location.hash = "schedule"; renderSched(); });
}
addEventListener("keydown", e => { if (e.key === "Escape" && $("#drawer")) $("#drawerRoot").innerHTML = ""; });

function toggleStar(id){
  if (stars.has(id)) { stars.delete(id); toast("Removed from Home"); } else { stars.add(id); toast("Pinned to Home"); }
  saveStars(); renderHome(); renderSched(); renderCourses();
}

/* global delegated clicks */
document.addEventListener("click", e => {
  const st = e.target.closest("[data-star]");
  if (st) { e.stopPropagation(); toggleStar(st.dataset.star); return; }
  const op = e.target.closest("[data-open]");
  if (op) { openEvent(op.dataset.open); return; }
  const day = e.target.closest("[data-day]");
  if (day) { selDay = day.dataset.day; renderSched(); return; }
  const cf = e.target.closest("[data-cf]");
  if (cf) {
    const c = cf.dataset.cf;
    if (activeCats.size === Object.keys(CATS).length) activeCats = new Set([c]);
    else if (activeCats.has(c)) { activeCats.delete(c); if (!activeCats.size) activeCats = new Set(Object.keys(CATS)); }
    else activeCats.add(c);
    renderSched(); return;
  }
  if (e.target.closest("#calPrev")) { calM--; if (calM<0){calM=11;calY--;} renderSched(); return; }
  if (e.target.closest("#calNext")) { calM++; if (calM>11){calM=0;calY++;} renderSched(); return; }
  if (e.target.closest("#calToday")) { const t=new Date(); calY=t.getFullYear(); calM=t.getMonth(); selDay=key(t); renderSched(); return; }
  const cp = e.target.closest("[data-copy]");
  if (cp) {
    const txt = cp.dataset.copy;
    try { navigator.clipboard.writeText(txt).then(() => toast("Copied"), () => fallbackCopy(cp)); } catch(err){ fallbackCopy(cp); }
  }
});
document.addEventListener("change", e => { if (e.target.id === "pastT") { store.set("bf-past", e.target.checked); renderSched(); } });
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-open]")) { e.preventDefault(); openEvent(e.target.dataset.open); }
});
function fallbackCopy(btn){
  const v = btn.closest(".contact-card").querySelector(".val");
  const r = document.createRange(); r.selectNodeContents(v);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  toast("Selected. Press Ctrl+C to copy");
}

/* ---------- resume ---------- */
let RES = [];
const RCAT = {all:"All", academics:"Academics", leadership:"Leadership", athletics:"Athletics", military:"Military", service:"Service", work:"Work", skills:"Skills"};
let rCat = "all";
function renderResume(){
  $("#resFilters").innerHTML = Object.keys(RCAT).map(c => {
    const n = c==="all" ? RES.length : RES.filter(r => r[3]===c).length;
    return '<button type="button" class="fbtn'+(rCat===c?' on':'')+'" data-rc="'+c+'">'+RCAT[c]+' <span class="n">'+n+'</span></button>';
  }).join("");
  const rows = RES.filter(r => rCat==="all" || r[3]===rCat);
  $("#resList").innerHTML = rows.map((r,i) => '<div class="tl-row" style="animation-delay:'+Math.min(i*30,300)+'ms"><div class="yr">'+r[0]+'</div><div><h4>'+esc(r[1])+'</h4>'+(r[2]?'<p>'+esc(r[2])+'</p>':'')+(rCat==="all"?'<span class="chip">'+RCAT[r[3]]+'</span>':'')+'</div></div>').join("");
}
$("#resFilters").addEventListener("click", e => { const b = e.target.closest("[data-rc]"); if (b){ rCat = b.dataset.rc; renderResume(); } });

/* ---------- courses ---------- */
let COURSES = [];
let cGroup = store.get("bf-cgroup", "sem"), cSub = "All";
function courseEvents(code){
  const base = code.replace(/X$/,"");
  return EVENTS.filter(e => e.t.toUpperCase().startsWith(base) && (e.cat==="due"||e.cat==="exam"));
}
function courseCard(c){
  const now = new Date(), current = c.term === "AY27-1";
  const evs = current ? courseEvents(c.code) : [], up = evs.filter(e => e.endT >= now).sort((a,b)=>a.s-b.s);
  const nx = up[0];
  const tags = (c.tools||[]).map(t => '<span class="chip tool">'+esc(t)+'</span>').join("")+(c.topics||[]).map(t => '<span class="chip">'+esc(t)+'</span>').join("");
  return '<div class="panel course'+(current?'':' past-course')+'"><div class="course-top"><div class="code">'+c.code+'</div><span class="chip">'+c.term+'</span></div>'+
    '<h4>'+esc(c.title)+'</h4>'+(c.desc?'<p>'+esc(c.desc)+'</p>':'')+(tags?'<div class="tags">'+tags+'</div>':'')+
    (current ? (nx ? '<div class="course-next" data-open="'+nx.id+'" role="button" tabindex="0" style="cursor:pointer"><span>Next: '+esc(nx.t.replace(/^[A-Z]{2}\d{3}X?\s*/,""))+'</span><b data-cd="'+nx.id+'">'+cdText(nx, now).main+'</b></div>' : '<div class="course-next"><span>No upcoming graded events</span></div>') : '')+
    '<div class="course-foot">'+(c.folder ? '<a class="folder" href="'+esc(c.folder)+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M3 6h6l2 2h10v11H3z"/></svg>Files ↗</a>' : '<span class="folder">Folder link coming</span>')+
    (c.canvas ? '<a class="small-btn" href="https://westpoint.instructure.com/courses/'+c.canvas+'" target="_blank" rel="noopener" title="Requires West Point login">Canvas ↗</a>' : '')+'</div>'+
    (current ? '<div style="display:flex;flex-wrap:wrap;gap:8px"><button class="small-btn" type="button" data-grade="'+c.code+'">Grade calculator</button>'+(prepCount(c.code) ? '<button class="small-btn" type="button" data-prepc="'+c.code+'">Prep sheets ('+prepCount(c.code)+')</button>' : '')+'</div>' : '')+(current && evs.length ? '<p class="course-count">'+up.length+' graded events left this term</p>' : '')+'</div>';
}
function renderCourses(){
  $("#gSem").classList.toggle("on", cGroup==="sem"); $("#gSub").classList.toggle("on", cGroup==="sub");
  const subs = ["All", ...new Set(COURSES.map(c => c.subject))];
  $("#subFilters").innerHTML = subs.map(s => '<button type="button" class="fbtn'+(cSub===s?' on':'')+'" data-sub="'+esc(s)+'">'+esc(s)+'</button>').join("");
  const list = COURSES.filter(c => cSub==="All" || c.subject===cSub);
  const groups = {};
  list.forEach(c => { const k = cGroup==="sem" ? c.term : c.subject; (groups[k] = groups[k] || []).push(c); });
  const SEM = {"AY27-1":"Fall 2026 · AY27-1 · Cow year","AY26-2":"Spring 2026 · AY26-2","AY26-1":"Fall 2025 · AY26-1 · Yuk year","AY25-2":"Spring 2025 · AY25-2","AY25-1":"Fall 2024 · AY25-1 · Plebe year"};
  const label = k => cGroup==="sem" ? (SEM[k] || k) : k;
  const keys = Object.keys(groups).sort((a,b) => cGroup==="sem" ? b.localeCompare(a) : a.localeCompare(b));
  $("#courseBody").innerHTML = keys.map(k =>
    '<div class="group-h"><h3>'+esc(label(k))+'</h3><span>'+groups[k].length+' course'+(groups[k].length>1?'s':'')+'</span></div><div class="grid g3">'+groups[k].map(courseCard).join("")+'</div>'
  ).join("") ;
}
$("#gSem").addEventListener("click", () => { cGroup="sem"; store.set("bf-cgroup",cGroup); renderCourses(); });
$("#gSub").addEventListener("click", () => { cGroup="sub"; store.set("bf-cgroup",cGroup); renderCourses(); });
$("#subFilters").addEventListener("click", e => { const b = e.target.closest("[data-sub]"); if (b){ cSub = b.dataset.sub; renderCourses(); } });

/* ---------- prep sheets ----------
   data/prep/manifest.json lists every archived pre-class sheet (course, lesson, date, file).
   Each sheet is its own data/prep/<COURSE>/<date>-L<N>.enc, sealed with the finance public key
   by tools/prep.py, so titles and pages open only after unlock. The nightly class-prep task adds them. */
const FOLDER_COURSES = ["MA376","SS388","EM481","MA486","MA481X"];   // class folders (MS300 left out on purpose)
/* data/links/manifest.json lists files and links filed into class and project folders.
   Each one is its own data/links/<folder>/<id>.enc, sealed by tools/links.py (opens after unlock). */
let LINKS = [];
const LINK_CACHE = {};
const linkCount = f => LINKS.filter(x => x.folder === f).length;
async function loadLinksManifest(){
  try{ const r = await fetch("/data/links/manifest.json", {cache: "no-store"}); if (!r.ok) return;
    LINKS = ((await r.json()).items || []); renderProjects(); if (cView === "prep") renderPrep(); }catch(e){}
}
async function linkItem(x){
  if (LINK_CACHE[x.file]) return LINK_CACHE[x.file];
  const r = await fetch("/data/links/"+x.file, {cache: "no-store"}); if (!r.ok) throw new Error("fetch");
  return (LINK_CACHE[x.file] = await openFin(await r.json()));
}
const LK_IC = {
  artifact: '<path d="M4 5h16v14H4z"/><path d="M4 9h16"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  drive: '<path d="M6 3h8l4 4v14H6z"/><path d="M9 13h6M9 17h6"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>'};
const LK_KIND = {artifact:"Claude page", folder:"Drive folder", file:"File", drive:"Drive", link:"Link"};
async function renderLinks(folder, el){
  const items = LINKS.filter(x => x.folder === folder).sort((a,b) => a.order - b.order);
  if (!finKey){ el.innerHTML = '<p class="fine" style="padding:12px 14px">Unlock the site to see these files.</p>'; return; }
  const got = await Promise.all(items.map(x => linkItem(x).catch(() => null)));
  el.innerHTML = got.map(L => L ? '<a class="lk" href="'+esc(L.url)+'" target="_blank" rel="noopener"><span class="lk-ic"><svg viewBox="0 0 24 24">'+(LK_IC[L.kind]||LK_IC.link)+'</svg></span><span class="lk-tx"><b>'+esc(L.title)+'</b>'+(L.note?'<span>'+esc(L.note)+'</span>':'')+'</span><span class="lk-k">'+(LK_KIND[L.kind]||"Link")+' ↗</span></a>'
    : '<p class="fine" style="padding:12px 14px">Couldn\'t open one item.</p>').join("") || '<p class="fine" style="padding:12px 14px">Empty folder.</p>';
}
let projOpen = "";
function openProjFolder(f){
  const P = PROJ.find(p => p.folder === f), box = $("#projFolder"); if (!P) return;
  if (projOpen === f && !box.hidden){ box.hidden = true; projOpen = ""; return; }
  projOpen = f; box.hidden = false;
  box.innerHTML = '<div class="pf-head"><div><span class="eyebrow">'+esc(P.course)+' · Folder</span><h3>'+esc(P.t)+'</h3></div><button class="small-btn" type="button" id="pfClose">Close</button></div>'+
    (linkCount(f) ? '<div class="lk-list" id="pfList"><p class="fine" style="padding:12px 14px">Opening…</p></div>' : '<p class="fine">Nothing filed here yet.</p>')+
    (!finKey && linkCount(f) ? '<div style="margin-top:12px"><button class="btn primary" type="button" id="pfUnlock">Unlock to see files</button></div>' : '');
  $("#pfClose").addEventListener("click", e => { e.stopPropagation(); box.hidden = true; projOpen = ""; });
  const u = $("#pfUnlock"); if (u) u.addEventListener("click", () => openGate("projects"));
  if (linkCount(f)) renderLinks(f, $("#pfList"));
  box.scrollIntoView({behavior: "smooth", block: "start"});
}
document.addEventListener("click", e => { const c = e.target.closest("[data-projf]"); if (c) openProjFolder(c.dataset.projf); });
document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-projf]")){ e.preventDefault(); openProjFolder(e.target.dataset.projf); } });

let PREP = [], prepCode = store.get("bf-prepc", ""), prepOpen = null, prepQ = "", cView = "courses";
const PREP_CACHE = {};   // file -> decrypted sheet
const prepCount = code => PREP.filter(p => p.course === code).length;
async function loadPrepManifest(){
  try{ const r = await fetch("/data/prep/manifest.json", {cache: "no-store"}); if (!r.ok) return;
    PREP = ((await r.json()).sheets || []); renderCourses(); if (cView === "prep") renderPrep(); }catch(e){}
}
async function prepSheet(p){
  if (PREP_CACHE[p.file]) return PREP_CACHE[p.file];
  const r = await fetch("/data/prep/"+p.file, {cache: "no-store"}); if (!r.ok) throw new Error("fetch");
  return (PREP_CACHE[p.file] = await openFin(await r.json()));
}
function setCView(v){
  cView = v; $("#cvCourses").classList.toggle("on", v==="courses"); $("#cvPrep").classList.toggle("on", v==="prep");
  $("#courseWrap").hidden = v !== "courses"; $("#cGroupSeg").hidden = v !== "courses"; $("#prepWrap").hidden = v !== "prep";
  if (v === "prep") renderPrep();
}
const prepFmt = d => new Date(d+"T12:00:00").toLocaleDateString("en-US", {weekday:"short", day:"numeric", month:"short"});
async function renderPrep(){
  const codes = FOLDER_COURSES;
  if (!codes.includes(prepCode)) prepCode = codes[0];
  $("#prepTabs").innerHTML = codes.map(c => {
    const t = (COURSES.find(x => x.code === c) || {}).title, n = prepCount(c) + linkCount(c);
    return '<button type="button" role="tab" class="'+(c===prepCode?'on':'')+'" data-prept="'+c+'"'+(t?' title="'+esc(t)+'"':'')+'>'+esc(c)+(n?' · '+n:'')+'</button>';
  }).join("");
  if (!finKey){ $("#prepBody").innerHTML = '<div class="panel empty-state">Unlock to read your prep sheets.</div>'; return; }
  const list = PREP.filter(p => p.course === prepCode).sort((a,b) => a.lesson - b.lesson || a.date.localeCompare(b.date));
  if (prepOpen && prepOpen.course === prepCode) return renderPrepSheet(list);
  prepOpen = null;
  const today = key(new Date()), next = list.find(p => p.date >= today);
  const body = $("#prepBody");
  const hasLinks = linkCount(prepCode) > 0;
  body.innerHTML = '<div class="prep-head"><input class="prep-search" id="prepSearch" type="search" placeholder="Search this class folder" aria-label="Search prep sheets and files in '+esc(prepCode)+'" value="'+esc(prepQ)+'"></div><div class="fold-sec"><h3>Prep sheets <span>'+list.length+' · in lesson order</span></h3>'+
    (list.length ? '<div class="panel prep-list" id="prepList"><p class="fine" style="padding:12px 14px">Opening sheets…</p></div>'
      : '<div class="panel empty-state">No prep sheets yet. They are added each night the class-prep task runs for '+esc(prepCode)+'.</div>')+'</div>'+
    (hasLinks ? '<div class="fold-sec"><h3>Files &amp; study help <span>'+linkCount(prepCode)+'</span></h3><div class="panel lk-list" id="prepLinks"><p class="fine" style="padding:12px 14px">Opening…</p></div></div>' : '');
  const search = $("#prepSearch"), rowsEl = $("#prepList"), linksEl = $("#prepLinks");
  let got = list.map(() => null);
  function drawLinks(){
    if (!search.isConnected || !linksEl) return;
    const q = prepQ.trim().toLowerCase();
    const links = [...linksEl.querySelectorAll(".lk")];
    links.forEach(a => { a.hidden = !!q && !a.textContent.toLowerCase().includes(q); a.style.display = a.hidden ? "none" : ""; });
    let empty = linksEl.querySelector("[data-search-empty]");
    if (!empty){ empty = document.createElement("p"); empty.className = "fine"; empty.style.padding = "12px 14px"; empty.dataset.searchEmpty = ""; linksEl.appendChild(empty); }
    empty.textContent = "No files match your search.";
    empty.hidden = !q || !links.length || links.some(a => !a.hidden);
  }
  if (hasLinks) renderLinks(prepCode, linksEl).then(drawLinks);
  $("#prepSearch").addEventListener("input", e => { prepQ = e.target.value; drawRows(); drawLinks(); });
  got = await Promise.all(list.map(p => prepSheet(p).catch(() => null)));
  if (!search.isConnected || cView !== "prep" || prepOpen) return;
  function drawRows(){
    if (!rowsEl || !search.isConnected) return;
    const q = prepQ.trim().toLowerCase();
    const rows = list.map((p,i) => ({p, s: got[i]})).filter(({p,s}) => !q || ("l"+p.lesson+" lesson "+p.lesson+" "+p.date+" "+prepFmt(p.date)+" "+(s ? s.title+" "+(s.day || "") : "")).toLowerCase().includes(q));
    rowsEl.innerHTML = rows.length ? rows.map(({p,s}) =>
      '<button type="button" class="prep-row'+(next && p.file===next.file?' next':'')+'" data-prepf="'+esc(p.file)+'"><span class="prep-l">L'+p.lesson+'</span><span class="prep-t">'+esc(s ? s.title : "Couldn't open this sheet")+'</span><span class="prep-d">'+(next && p.file===next.file ? 'Next · ' : '')+prepFmt(p.date)+(s && s.day ? ' · '+esc(s.day) : '')+'</span></button>'
    ).join("") : '<p class="fine" style="padding:12px 14px">No sheets match “'+esc(prepQ)+'”.</p>';
  }
  drawRows();
}
async function renderPrepSheet(list){
  const i = list.findIndex(p => p.file === prepOpen.file), p = list[i];
  if (!p){ prepOpen = null; return renderPrep(); }
  const prev = list[i-1], nxt = list[i+1];
  $("#prepBody").innerHTML = '<div class="prep-view"><div class="prep-bar"><div class="grp"><button class="small-btn" type="button" id="prepBack">← All '+esc(p.course)+' sheets</button></div><div class="grp">'+
    (prev ? '<button class="small-btn" type="button" data-prepf="'+esc(prev.file)+'">← L'+prev.lesson+'</button>' : '')+
    (nxt ? '<button class="small-btn" type="button" data-prepf="'+esc(nxt.file)+'">L'+nxt.lesson+' →</button>' : '')+
    '<button class="small-btn" type="button" id="prepNew">Open in new tab ↗</button></div>'+
    '<h3 id="prepTitle">Lesson '+p.lesson+'</h3><p class="fine" id="prepSub" style="margin:0">'+prepFmt(p.date)+'</p></div>'+
    '<iframe class="prep-frame" id="prepFrame" title="Prep sheet" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe></div>';
  $("#prepBack").addEventListener("click", () => { prepOpen = null; renderPrep(); });
  try{
    const s = await prepSheet(p); if (!prepOpen || prepOpen.file !== p.file) return;
    $("#prepTitle").textContent = "Lesson "+p.lesson+": "+s.title;
    $("#prepSub").textContent = prepFmt(p.date)+(s.day ? " · "+s.day : "");
    const doc = /^\s*<(!doctype|html)/i.test(s.html) ? s.html : '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"></head><body>'+s.html+'</body></html>';
    $("#prepFrame").srcdoc = doc;
    $("#prepNew").addEventListener("click", () => { const u = URL.createObjectURL(new Blob([doc], {type: "text/html"})); window.open(u, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(u), 60000); });
  }catch(e){ $("#prepFrame").replaceWith(Object.assign(document.createElement("div"), {className: "panel empty-state", textContent: "Couldn't open this sheet."})); }
}
$("#cvCourses").addEventListener("click", () => setCView("courses"));
$("#cvPrep").addEventListener("click", () => setCView("prep"));
$("#prepTabs").addEventListener("click", e => { const b = e.target.closest("[data-prept]"); if (b){ prepCode = b.dataset.prept; store.set("bf-prepc", prepCode); prepOpen = null; prepQ = ""; renderPrep(); } });
$("#prepBody").addEventListener("click", e => { const b = e.target.closest("[data-prepf]"); if (b && b.dataset.prepf){ prepOpen = PREP.find(p => p.file === b.dataset.prepf) || null; renderPrep(); window.scrollTo({top: $("#v-courses").offsetTop - 70, behavior: "smooth"}); } });
document.addEventListener("click", e => { const b = e.target.closest("[data-prepc]"); if (b){ prepCode = b.dataset.prepc; store.set("bf-prepc", prepCode); prepOpen = null; prepQ = ""; setCView("prep"); } });

/* ---------- projects ---------- */
const FEATURED = {t:"Shortsmith", url:"https://shortsmith.braedenfonte.com/create", status:"Live",
  d:"My app for making short-form AI videos in different styles. It posts them automatically to Instagram, YouTube, Facebook and TikTok.",
  tags:["AI video","Auto-posting","Instagram","YouTube","Facebook","TikTok"]};
const PROJ = [
  {t:"TSP Optimization Dashboard", folder:"proj-tsp", course:"MA481X", art:"tsp", status:"In progress", d:"An interactive simulation that shows an optimization method solving the Traveling Salesman Problem step by step, built for Optimization II.", tags:["Optimization","Heuristics","JavaScript"]},
  {t:"Combat Field Test Simulation", folder:"proj-cft", course:"EM481", art:"sim", status:"In progress", d:"A ProModel discrete-event model of the Combat Field Test, used to study flow, bottlenecks, and throughput.", tags:["Simulation","ProModel","Systems"]},
  {t:"NFL Travel Effect", folder:"proj-nfl", course:"Research", art:"nfl", status:"Research", d:"A study of whether travel distance and time zones affect NFL team performance.", tags:["Statistics","Sports analytics","Research"]},
  {t:"Website AI Assistant", folder:"proj-bot", course:"Business", art:"bot", status:"Live", d:"An AI assistant powered by Claude that plugs into any website to answer visitors and promote what the site offers.", tags:["AI","Claude","Web"]}
];
function renderProjects(){
  const f = $("#projFeat");
  if (f) f.innerHTML = '<a class="panel feat" href="'+FEATURED.url+'" target="_blank" rel="noopener"><div class="feat-txt"><span class="eyebrow">Featured app</span><h3>'+FEATURED.t+'</h3><p>'+FEATURED.d+'</p>'+
    '<div class="tags">'+FEATURED.tags.map(t => '<span class="chip">'+t+'</span>').join("")+'</div></div>'+
    '<div class="feat-go"><span class="status live">'+FEATURED.status+'</span><span class="btn primary">Open Shortsmith ↗</span></div></a>';
  $("#projGrid").innerHTML = PROJ.map(p =>
    '<article class="panel proj" data-projf="'+p.folder+'" role="button" tabindex="0" aria-label="Open the '+esc(p.t)+' folder"><div class="proj-art"><canvas data-art="'+p.art+'"></canvas></div>'+
    '<span class="status'+(p.status==="Live"?' live':'')+'">'+p.status+'</span>'+
    '<span class="eyebrow">'+p.course+'</span><h3>'+p.t+'</h3><p>'+p.d+'</p><div class="tags">'+p.tags.map(t => '<span class="chip">'+t+'</span>').join("")+'</div><span class="small-btn proj-open"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h6l2 2h10v11H3z"/></svg>Open folder'+(linkCount(p.folder)?' · '+linkCount(p.folder):'')+'</span></article>'
  ).join("");
}
function css(v){ return getComputedStyle(root).getPropertyValue(v).trim(); }
function drawArt(){
  document.querySelectorAll("canvas[data-art]").forEach(cv => {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    const dpr = devicePixelRatio || 1; cv.width = w*dpr; cv.height = h*dpr;
    const x = cv.getContext("2d"); x.scale(dpr,dpr);
    const A = css("--accent"), F = css("--faint"), L = css("--line"), M = css("--muted");
    let seed = 7; const rnd = () => (seed = (seed*9301+49297)%233280)/233280;
    const kind = cv.dataset.art;
    if (kind === "tsp"){
      const pts = Array.from({length:16}, () => [20+rnd()*(w-40), 16+rnd()*(h-32)]);
      const tour = [0], used = new Set([0]);
      while (tour.length < pts.length){ const l = pts[tour[tour.length-1]]; let b=-1,bd=1e9; pts.forEach((p,i)=>{ if(!used.has(i)){ const d=Math.hypot(p[0]-l[0],p[1]-l[1]); if(d<bd){bd=d;b=i;} } }); tour.push(b); used.add(b); }
      x.strokeStyle = A; x.lineWidth = 2; x.beginPath(); tour.forEach((i,k) => k ? x.lineTo(...pts[i]) : x.moveTo(...pts[i])); x.closePath(); x.stroke();
      pts.forEach((p,i) => { x.fillStyle = i===0 ? A : css("--fg"); x.beginPath(); x.arc(p[0],p[1],i===0?5:3.5,0,7); x.fill(); });
    } else if (kind === "sim"){
      const st = [0.12,0.37,0.62,0.87].map(f => f*w);
      x.strokeStyle = L; x.lineWidth = 2; x.beginPath(); x.moveTo(10,h/2); x.lineTo(w-10,h/2); x.stroke();
      st.forEach((sx,i) => { x.fillStyle = i===2 ? A : css("--surface"); x.strokeStyle = i===2 ? A : F; x.beginPath(); x.roundRect ? x.roundRect(sx-20,h/2-18,40,36,8) : x.rect(sx-20,h/2-18,40,36); x.fill(); x.stroke();
        const q = [2,4,9,1][i]; for (let k=0;k<q;k++){ x.fillStyle = i===2 ? A : M; x.beginPath(); x.arc(sx-30-k*9, h/2, 3, 0, 7); x.fill(); } });
    } else if (kind === "nfl"){
      const n = 14; x.strokeStyle = L; x.lineWidth = 1; for (let i=1;i<4;i++){ x.beginPath(); x.moveTo(0,i*h/4); x.lineTo(w,i*h/4); x.stroke(); }
      for (let i=0;i<n;i++){ const bx = 14 + i*(w-28)/n, v = 0.25 + 0.55*(Math.sin(i*0.7)+1)/2 - i*0.02; x.fillStyle = i > n-4 ? A : F; x.fillRect(bx, h-14-v*(h-28), (w-28)/n-6, v*(h-28)); }
    } else {
      const bub = (bx,by,bw,mine) => { x.fillStyle = mine ? A : css("--surface"); x.strokeStyle = mine ? A : L; x.beginPath(); x.roundRect ? x.roundRect(bx,by,bw,22,11) : x.rect(bx,by,bw,22); x.fill(); x.stroke(); };
      bub(16,16,w*0.5,false); bub(w-16-w*0.4,48,w*0.4,true); bub(16,80,w*0.55,false);
    }
  });
}
let artT; addEventListener("resize", () => { clearTimeout(artT); artT = setTimeout(drawArt, 150); });

/* ---------- travel map ---------- */
const MAP = window.BF_MAP;
let VISITED_STATES = [];
const SVGNS = "http://www.w3.org/2000/svg";
let selPlace = "westpoint", vb = [0, 0, MAP.W, MAP.H], vbAnim = null;
let hubs = [];

function fitBox(ids, pad){
  const ps = MAP.places.filter(p => ids.includes(p.region) && p.id !== "pr");
  let x0 = Math.min(...ps.map(p=>p.x)) - pad, x1 = Math.max(...ps.map(p=>p.x)) + pad;
  let y0 = Math.min(...ps.map(p=>p.y)) - pad, y1 = Math.max(...ps.map(p=>p.y)) + pad;
  let w = x1-x0, h = y1-y0; const ar = MAP.W/MAP.H;
  if (w/h > ar){ const nh = w/ar; y0 -= (nh-h)/2; h = nh; } else { const nw = h*ar; x0 -= (nw-w)/2; w = nw; }
  return [x0, y0, w, h];
}
let ZOOMS = { all:[0,0,MAP.W,MAP.H], ne:[0,0,MAP.W,MAP.H], ny:[0,0,MAP.W,MAP.H] };

function visitsText(p){
  if (p.type === "hub") return p.id === "westpoint" ? "Home base · USMA" : "Hometown";
  if (typeof p.visits === "string") return p.visits;
  return p.visits === 1 ? "Visited once" : "Visited "+p.visits+" times";
}
function buildMap(){
  const lit = new Set(VISITED_STATES);
  const st = MAP.states.map(s => '<path class="st'+(lit.has(s.n)?' lit':'')+'" d="'+s.d+'"><title>'+esc(s.n)+'</title></path>').join("");
  const pr = MAP.pr;
  const inset = '<rect class="inset" x="'+pr.x+'" y="'+pr.y+'" width="'+pr.w+'" height="'+pr.h+'" rx="8"/><text class="inset-lbl" x="'+(pr.x+8)+'" y="'+(pr.y+14)+'">PUERTO RICO</text><path class="st lit" d="'+pr.d+'"/>';
  $("#travelMap").innerHTML = '<svg id="mapSvg" viewBox="'+vb.join(" ")+'" role="img" aria-label="Map of places I have traveled"><g>'+st+inset+'</g><g id="arcs"></g><g id="pins"></g><g id="labels"></g></svg>';
  const pins = $("#pins");
  MAP.places.slice().sort((a,b) => (a.type==="hub") - (b.type==="hub")).forEach(p => {
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "pin"+(p.type==="hub"?" hub":""));
    g.setAttribute("tabindex", "0"); g.setAttribute("role", "button"); g.setAttribute("aria-label", p.n);
    g.dataset.place = p.id;
    g.innerHTML = '<circle class="halo"/>'+(p.type==="hub"?'<circle class="ring"/>':'')+'<circle class="core"/>';
    pins.appendChild(g);
  });
  bindMap();
  paintMap();
}
function k(){ return vb[2] / MAP.W; }
function paintMap(){
  const svg = $("#mapSvg"); if (!svg) return;
  svg.setAttribute("viewBox", vb.join(" "));
  const s = k();
  document.querySelectorAll("#pins .pin").forEach(g => {
    const p = MAP.places.find(q => q.id === g.dataset.place), hub = p.type === "hub";
    const r = (hub ? 6.5 : 4.5) * Math.max(s, .28);
    g.classList.toggle("sel", p.id === selPlace);
    g.querySelectorAll("circle").forEach(c => { c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); });
    g.querySelector(".core").setAttribute("r", r);
    g.querySelector(".halo").setAttribute("r", r*2.6);
    const ring = g.querySelector(".ring"); if (ring) ring.setAttribute("r", r*1.6);
  });
  const zoomed = s < .55, fs = 12.5 * Math.max(s, .3);
  $("#labels").innerHTML = MAP.places.filter(p => p.type==="hub" || p.id===selPlace || (zoomed && inView(p))).map(p => {
    const hub = p.type==="hub";
    return '<text class="pin-lbl" x="'+(p.x + 9*Math.max(s,.3))+'" y="'+(p.y + 4*Math.max(s,.3))+'" font-size="'+(hub?fs*1.08:fs)+'" stroke-width="'+(3*Math.max(s,.3))+'">'+esc(p.n.replace(/, [A-Z]{2}$/,""))+'</text>';
  }).join("");
  drawArcs();
}
function inView(p){ return p.x > vb[0] && p.x < vb[0]+vb[2] && p.y > vb[1] && p.y < vb[1]+vb[3]; }
function drawArcs(){
  const p = MAP.places.find(q => q.id === selPlace);
  if (!p || p.type === "hub" || p.id === "pr"){ $("#arcs").innerHTML = ""; return; }
  $("#arcs").innerHTML = hubs.map(h => {
    const mx = (h.x+p.x)/2, my = (h.y+p.y)/2, dx = p.x-h.x, dy = p.y-h.y, len = Math.hypot(dx,dy) || 1;
    const bend = Math.min(len*.25, 80);
    return '<path class="arc" d="M'+h.x+' '+h.y+' Q'+(mx - dy/len*bend)+' '+(my + dx/len*bend)+' '+p.x+' '+p.y+'"/>';
  }).join("");
}
function zoomTo(target){
  const from = vb.slice(), t0 = performance.now(), dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 520;
  cancelAnimationFrame(vbAnim);
  const step = now => {
    const t = dur ? Math.min(1, (now - t0)/dur) : 1, e = 1 - Math.pow(1-t, 3);
    vb = from.map((v,i) => v + (target[i]-v)*e); paintMap();
    if (t < 1) vbAnim = requestAnimationFrame(step);
  };
  vbAnim = requestAnimationFrame(step);
}
function setZoomBtn(z){ document.querySelectorAll("[data-zoom]").forEach(b => b.classList.toggle("on", b.dataset.zoom === z)); }
function selectPlace(id, recenter){
  selPlace = id;
  const p = MAP.places.find(q => q.id === id);
  if (recenter && !inView(p)) { zoomTo(ZOOMS.all); setZoomBtn("all"); }
  paintMap(); renderPlaceCard(); renderPlaceChips();
}
function renderPlaceCard(){
  const list = MAP.places, i = list.findIndex(q => q.id === selPlace), p = list[i];
  const photos = p.photos.length ? p.photos.map(src => '<img src="'+esc(src)+'" alt="'+esc(p.n)+'" loading="lazy">').join("") :
    [1,2,3].map(() => '<div class="ph"><div><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>Photo</div></div>').join("");
  $("#placeCard").innerHTML = '<span class="chip">'+(p.type==="hub"?'<span class="dot" style="--c:var(--accent)"></span>Hub · ':'')+esc(p.region)+'</span>'+
    '<h4>'+esc(p.n)+'</h4><p class="meta">'+esc(visitsText(p))+'</p>'+(p.note?'<p class="note">'+esc(p.note)+'</p>':'')+
    '<div class="photo-row">'+photos+'</div>'+(p.photos.length?'':'<p class="meta" style="font-size:12.5px">Photos coming soon. Send your iPhone photos and they will show up here.</p>')+
    '<div class="pc-nav"><button class="small-btn" type="button" data-pstep="-1">← Prev</button><span class="mono" style="font-size:12px;color:var(--faint);align-self:center">'+(i+1)+' / '+list.length+'</span><button class="small-btn" type="button" data-pstep="1">Next →</button></div>';
}
function renderPlaceChips(){
  const regions = ["New York","Northeast","Mid-Atlantic","South","Midwest","Caribbean"];
  $("#places").innerHTML = regions.map(r => '<span class="rg">'+r+'</span>'+MAP.places.filter(p => p.region===r).map(p =>
    '<button type="button" class="chip'+(p.id===selPlace?' on':'')+'" data-pchip="'+p.id+'">'+(p.type==="hub"?'<span class="dot" style="--c:var(--accent)"></span>':'')+esc(p.n)+'</button>').join("")).join("");
  const nonHub = MAP.places.filter(p => p.type !== "hub").length;
  $("#travelSub").textContent = nonHub+" places · 9 states, DC, and Puerto Rico · tap a pin to explore";
}
function bindMap(){
  const box = $("#travelMap"), svg = $("#mapSvg");
  let drag = null, moved = 0;
  const tip = document.createElement("div"); tip.className = "map-tip"; tip.hidden = true; box.appendChild(tip);
  svg.addEventListener("pointerdown", e => { drag = {x:e.clientX, y:e.clientY, vb:vb.slice()}; moved = 0; });
  addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
    if (moved < 4) return;
    svg.classList.add("drag");
    const sc = vb[2] / svg.clientWidth;
    vb = [drag.vb[0] - dx*sc, drag.vb[1] - dy*sc, vb[2], vb[3]];
    setZoomBtn(""); paintMap();
  });
  addEventListener("pointerup", () => { drag = null; svg.classList.remove("drag"); });
  svg.addEventListener("click", e => {
    if (moved >= 4) return;
    const pin = e.target.closest(".pin");
    if (pin) selectPlace(pin.dataset.place, false);
  });
  svg.addEventListener("dblclick", e => {
    const r = svg.getBoundingClientRect(), fx = (e.clientX - r.left)/r.width, fy = (e.clientY - r.top)/r.height;
    const cx = vb[0] + fx*vb[2], cy = vb[1] + fy*vb[3], nw = Math.max(vb[2]/2, MAP.W*.12), nh = nw*MAP.H/MAP.W;
    zoomTo([cx - nw/2, cy - nh/2, nw, nh]); setZoomBtn("");
  });
  svg.addEventListener("keydown", e => { const pin = e.target.closest && e.target.closest(".pin"); if (pin && (e.key==="Enter"||e.key===" ")) { e.preventDefault(); selectPlace(pin.dataset.place, false); } });
  svg.addEventListener("pointerover", e => {
    const pin = e.target.closest(".pin"); if (!pin) { tip.hidden = true; return; }
    const p = MAP.places.find(q => q.id === pin.dataset.place), r = svg.getBoundingClientRect(), br = box.getBoundingClientRect();
    tip.textContent = p.n; tip.hidden = false;
    tip.style.left = ((p.x - vb[0]) / vb[2] * r.width + r.left - br.left)+"px";
    tip.style.top = ((p.y - vb[1]) / vb[3] * r.height + r.top - br.top)+"px";
  });
  svg.addEventListener("pointerleave", () => tip.hidden = true);
}
document.addEventListener("click", e => {
  const z = e.target.closest("[data-zoom]"); if (z) { zoomTo(ZOOMS[z.dataset.zoom]); setZoomBtn(z.dataset.zoom); return; }
  const c = e.target.closest("[data-pchip]"); if (c) { selectPlace(c.dataset.pchip, true); return; }
  const s = e.target.closest("[data-pstep]");
  if (s) { const L = MAP.places, i = L.findIndex(q => q.id === selPlace); selectPlace(L[(i + +s.dataset.pstep + L.length) % L.length].id, true); }
});
function renderTravel(){ buildMap(); renderPlaceCard(); renderPlaceChips(); }

/* ---------- daily data (flights, football, place) ---------- */
let DAILY = {"updated": "2026-10-15T14:30:00-04:00", "flights": [{"from": "LGA", "to": "CHS", "city": "Charleston, SC", "tag": "City", "price": 229, "airline": "American", "depart": "2026-11-14", "departTime": "10:40", "returnDate": "2026-11-16", "returnDepart": "07:00", "returnArrive": null, "stops": "Nonstop", "url": "https://www.kayak.com/flights/LGA-CHS/2026-11-14/2026-11-16?sort=price_a"}, {"from": "JFK", "to": "MIA", "city": "Miami, FL", "tag": "Beach", "price": 248, "airline": "Delta", "depart": "2026-11-14", "departTime": "14:00", "returnDate": "2026-11-16", "returnDepart": "07:19", "returnArrive": "10:14", "stops": "1 stop out, nonstop back", "url": "https://www.kayak.com/flights/JFK-MIA/2026-11-14/2026-11-16?sort=price_a"}, {"from": "JFK", "to": "BNA", "city": "Nashville, TN", "tag": "City", "price": 213, "airline": "Delta", "depart": "2026-10-31", "departTime": "19:00", "returnDate": "2026-11-02", "returnDepart": "07:15", "returnArrive": null, "stops": "Nonstop", "url": "https://www.kayak.com/flights/JFK-BNA/2026-10-31/2026-11-02?sort=price_a"}, {"from": "LGA", "to": "BNA", "city": "Nashville, TN", "tag": "City", "price": 247, "airline": "American", "depart": "2026-10-30", "departTime": "19:59", "returnDate": "2026-11-02", "returnDepart": "18:41", "returnArrive": null, "stops": "Nonstop", "url": "https://www.kayak.com/flights/LGA-BNA/2026-10-30/2026-11-02?sort=price_a"}, {"from": "EWR", "to": "ORD", "city": "Chicago, IL", "tag": "City", "price": 277, "airline": "United", "depart": "2026-10-24", "departTime": "10:22", "returnDate": "2026-10-26", "returnDepart": "06:59", "returnArrive": "10:07", "stops": "Nonstop", "url": "https://www.kayak.com/flights/EWR-ORD/2026-10-24/2026-10-26?sort=price_a"}, {"from": "JFK", "to": "CHS", "city": "Charleston, SC", "tag": "City", "price": 230, "airline": "JetBlue", "depart": "2026-11-14", "departTime": "06:30", "returnDate": "2026-11-16", "returnDepart": "20:25", "returnArrive": null, "stops": "Nonstop", "url": "https://www.kayak.com/flights/JFK-CHS/2026-11-14/2026-11-16?sort=price_a"}, {"from": "LGA", "to": "FLL", "city": "Fort Lauderdale, FL", "tag": "Beach", "price": 197, "airline": "Frontier", "depart": "2026-10-31", "departTime": null, "returnDate": "2026-11-03", "returnDepart": null, "returnArrive": null, "stops": "", "url": "https://www.kayak.com/flights/LGA-FLL/2026-10-31/2026-11-03?sort=price_a"}], "football": {"label": "Week 7 recap", "results": [{"away": "Georgia", "home": "Alabama", "as": 20, "hs": 17, "blurb": "Georgia escaped Tuscaloosa on Woodring's 23-yard field goal with 5:27 left.", "stats": ["Stockton: 18/22, 249 yds, TD + 14-yd TD run", "UGA outgained ALA 455-346", "4 sacks for Georgia's defense"]}, {"away": "USC", "home": "Penn State", "as": 31, "hs": 23, "blurb": "USC won in Happy Valley behind three Maiava touchdown passes.", "stats": ["Maiava: 3 pass TD, 301 team pass yds", "PSU held to 68 rushing yds", "Barker 3/3 on field goals for PSU"]}, {"away": "LSU", "home": "Kentucky", "as": 34, "hs": 35, "blurb": "Kentucky went for two in overtime and won it on Minchey's conversion.", "stats": ["Coffman 55-yd punt return TD", "Baxter: 2 rush TD incl. OT score", "LSU: 26/35, 316 pass yds, 3 TD"]}, {"away": "Air Force", "home": "Northern Illinois", "as": 28, "hs": 7, "blurb": "Service-academy rival Air Force rolled on the road.", "stats": []}, {"away": "Kansas", "home": "Utah", "as": 24, "hs": 41, "blurb": "Utah pulled away at home.", "stats": []}, {"away": "Minnesota", "home": "Purdue", "as": 13, "hs": 41, "blurb": "Purdue's biggest Big Ten win of the year.", "stats": []}, {"away": "Syracuse", "home": "Virginia", "as": 25, "hs": 28, "blurb": "Virginia held on in a one-score game.", "stats": []}, {"away": "Boise State", "home": "Fresno State", "as": 38, "hs": 31, "blurb": "Boise State won a Mountain West shootout.", "stats": []}], "upcoming": [{"away": "FAU", "home": "Army", "kick": "2026-10-17T16:00:00Z", "note": "Home at Michie Stadium", "army": true}, {"away": "Washington", "home": "Purdue", "kick": "2026-10-17T00:00:00Z", "note": "Purdue 63% to win"}, {"away": "Florida", "home": "Texas", "kick": "2026-10-17T16:00:00Z", "note": ""}, {"away": "Kansas", "home": "Kansas State", "kick": "2026-10-17T16:00:00Z", "note": "Sunflower Showdown, K-State 65%"}, {"away": "Mississippi State", "home": "LSU", "kick": "2026-10-17T16:00:00Z", "note": "LSU bounces back from OT loss?"}]}, "location": {"name": "Petra", "wiki": "Petra", "country": "Jordan", "region": "Ma'an Governorate, southern Jordan", "lat": 30.3285, "lon": 35.4444, "tagline": "A whole city carved into rose-red cliffs.", "intro": "Petra was the capital of the Nabataeans, desert traders who got rich controlling the incense routes between Arabia and the Mediterranean. Instead of building with stone, they carved temples, tombs and a theater straight into the sandstone canyon walls.", "stats": [{"label": "Country", "value": "Jordan"}, {"label": "Built by", "value": "Nabataeans"}, {"label": "UNESCO site since", "value": "1985"}, {"label": "New 7 Wonders", "value": "Named 2007"}], "facts": ["You reach the city through the Siq, a narrow gorge about 1.2 km long with walls that tower overhead.", "The famous Treasury (Al-Khazneh) is a tomb, not a treasury. The name comes from a legend that pirates hid gold in the urn on top, and you can still see the bullet marks from people shooting at it.", "The West lost track of Petra for centuries until the Swiss explorer Johann Ludwig Burckhardt reached it in disguise in 1812.", "The Nabataeans engineered dams, cisterns and channels to collect flash-flood water, which let a large city survive in the desert.", "The Treasury's facade is the temple at the end of Indiana Jones and the Last Crusade (1989)."], "bestTime": "March to May or September to November, when it's warm but not scorching.", "gettingThere": "Fly JFK to Amman (Royal Jordanian flies nonstop), then about a 3-hour drive south.", "tip": "Hike the 800-plus steps up to the Monastery (Ad Deir). It's bigger than the Treasury and far less crowded."}, "flightsNote": "Fares spotted Oct 15 on Kayak route pages. None matched every rule today, so the closest ones are shown as near misses."};
const fmtDay = s => { const d = parseD(s); return DOW[d.getDay()]+" "+MON[d.getMonth()]+" "+d.getDate(); };
function renderDaily(){
  renderFlights(); renderFootball(); renderPlace(); renderBrief();
}
function loadDaily(){
  try {
    fetch("/data/daily.json", {cache:"no-store"}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.updated) { DAILY = j; renderDaily(); renderMarkets(); document.dispatchEvent(new CustomEvent("bf:data")); } }).catch(() => {});
  } catch(e){}
}

/* flights */
const AIRPORTS = ["JFK","LGA","EWR"];
let apOn = new Set(AIRPORTS), tagOn = "All", wkSel = -1, showNear = true;
const DESTS = [["MCO","Orlando"],["FLL","Fort Lauderdale"],["MIA","Miami"],["TPA","Tampa"],["SJU","San Juan, Puerto Rico"],["BQN","Aguadilla, Puerto Rico"],["CHS","Charleston"],["SAV","Savannah"],["MYR","Myrtle Beach"],["BNA","Nashville"],["MSY","New Orleans"],["ATL","Atlanta"],["CLT","Charlotte"],["ORD","Chicago"],["BOS","Boston"],["DEN","Denver"],["AUS","Austin"],["LAS","Las Vegas"],["SAN","San Diego"],["LAX","Los Angeles"]];
const KFS_FRI = "takeoff=1500,2359__;landing=__0000,1600", KFS_SAT = "takeoff=0000,1500__;landing=__0000,1600";
const kayakURL = (dest, out, back, fs) => "https://www.kayak.com/flights/EWR,JFK,LGA-"+dest+"/"+out+"/"+back+"?sort=price_a&fs="+fs;
const ymd = d => key(d);
const atTime = (dateStr, hhmm) => { const d = parseD(dateStr); const [h,m] = hhmm.split(":").map(Number); d.setHours(h, m, 0, 0); return d; };
const fmt12 = hhmm => { if (!hhmm) return "time TBD"; let [h,m] = hhmm.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h+":"+String(m).padStart(2,"0")+" "+ap; };
function mondayOff(mon){ const k = key(mon); return EVENTS.some(e => e.cat === "break" && key(e.s) <= k && key(e.e) >= k) || mon > TERM_E; }
function weekends(n){
  const out = [], d = new Date(); d.setHours(0,0,0,0);
  while (d.getDay() !== 5) d.setDate(d.getDate()+1);
  for (let i = 0; i < n; i++){
    const fri = new Date(d); fri.setDate(d.getDate() + i*7);
    const sat = new Date(fri); sat.setDate(fri.getDate()+1);
    const sun = new Date(fri); sun.setDate(fri.getDate()+2);
    const mon = new Date(fri); mon.setDate(fri.getDate()+3);
    const long = mondayOff(mon), back = long ? mon : sun;
    const busy = EVENTS.filter(e => e.cat !== "break" && key(e.s) <= key(back) && key(e.e) >= key(fri));
    out.push({fri, sat, sun, mon, long, back, busy});
  }
  return out;
}
const WKS = weekends(8);
function checkFare(f){
  const why = [];
  const dep = parseD(f.depart), day = dep.getDay();
  const fri = new Date(dep); fri.setDate(dep.getDate() - (day === 6 ? 1 : 0));
  if (day !== 5 && day !== 6) why.push("Leaves on a "+DOW[day]);
  else if (f.departTime){
    const hr = +f.departTime.split(":")[0] + (+f.departTime.split(":")[1])/60;
    if (day === 5 && hr < 15) why.push("Leaves Friday before 3 PM");
    if (day === 6 && hr >= 15) why.push("Leaves Saturday after 3 PM");
  }
  const mon = new Date(fri); mon.setDate(fri.getDate()+3);
  const long = mondayOff(mon), back = new Date(fri); back.setDate(fri.getDate() + (long ? 3 : 2));
  if (!f.returnDate) why.push("One-way fare");
  else {
    const rd = parseD(f.returnDate);
    if (+rd > +back) why.push("Returns "+DOW[rd.getDay()]+(rd.getDay()===1 ? " (not a day off)" : ""));
    else if (+rd === +back){
      const arr = f.returnArrive || null;
      if (arr && +arr.split(":")[0] >= 16) why.push("Lands after 4 PM");
      if (!arr && f.returnDepart && +f.returnDepart.split(":")[0] >= 13) why.push("Likely lands after 4 PM");
    }
  }
  const unknown = !f.departTime || (!f.returnArrive && !f.returnDepart);
  return {fits: !why.length && !unknown, why: why.length ? why : (unknown ? ["Times not listed, check before booking"] : []), fri: ymd(fri)};
}
function renderWeekends(){
  const lbl = (w,i) => '<b>'+MON[w.fri.getMonth()]+' '+w.fri.getDate()+'–'+(w.back.getMonth()!==w.fri.getMonth()?MON[w.back.getMonth()]+' ':'')+w.back.getDate()+'</b><small>'+(i===0?'This weekend':i===1?'Next weekend':'In '+i+' weeks')+'</small>'+
    (w.long ? '<span class="badge">Mon off</span>' : w.busy.length ? '<span class="badge busy">'+w.busy.length+' event'+(w.busy.length>1?'s':'')+'</span>' : '');
  $("#wkStrip").innerHTML = '<button type="button" class="wk'+(wkSel<0?' on':'')+'" data-wk="-1"><b>All weekends</b><small>Next 8</small></button>' + WKS.map((w,i) => '<button type="button" class="wk'+(i===wkSel?' on':'')+'" data-wk="'+i+'">'+lbl(w,i)+'</button>').join("");
  const w = WKS[Math.max(0, wkSel)];
  if (wkSel < 0){
    const longs = WKS.filter(x => x.long).map(x => MON[x.fri.getMonth()]+' '+x.fri.getDate());
    $("#wkInfo").innerHTML = '<span><b>Leave:</b> Fri after 3 PM or Sat before 3 PM</span><span><b>Back by:</b> Sun 4 PM, or Mon 4 PM on long weekends'+(longs.length ? ' ('+longs.join(", ")+')' : '')+'</span><span>Pick a weekend to see what\'s on your schedule.</span>';
  } else {
    const ev = w.busy.map(e => esc(e.t)+' ('+DOW[e.s.getDay()]+')');
    $("#wkInfo").innerHTML = '<span><b>Leave:</b> Fri '+MON[w.fri.getMonth()]+' '+w.fri.getDate()+' after 3 PM or Sat before 3 PM</span><span><b>Back by:</b> '+DOW[w.back.getDay()]+' '+MON[w.back.getMonth()]+' '+w.back.getDate()+', 4 PM'+(w.long?' (Monday off)':'')+'</span>'+
      (ev.length ? '<span class="warn"><b>Heads up:</b> '+ev.join(", ")+'</span>' : '<span>No events on your schedule this weekend.</span>');
  }
  const dest = $("#lsDest").value || "MCO", name = (DESTS.find(d => d[0]===dest)||["","there"])[1];
  const out = ymd(w.fri), sat = ymd(w.sat), back = ymd(w.back);
  $("#lsDates").textContent = "New York to "+name+", "+MON[w.fri.getMonth()]+" "+w.fri.getDate()+" weekend, back "+DOW[w.back.getDay()]+" "+MON[w.back.getMonth()]+" "+w.back.getDate()+(wkSel<0?" (pick a weekend above to change dates)":"");
  $("#lsKayak").href = kayakURL(dest, out, back, KFS_FRI);
  $("#lsKayakSat").href = kayakURL(dest, sat, back, KFS_SAT);
  $("#lsGoogle").href = "https://www.google.com/travel/flights?q="+encodeURIComponent("Flights from NYC to "+dest+" on "+out+" through "+back);
}
function renderFlights(){
  if (!$("#lsDest").options.length) $("#lsDest").innerHTML = DESTS.map(d => '<option value="'+d[0]+'">'+d[1]+' ('+d[0]+')</option>').join("");
  $("#apChips").innerHTML = AIRPORTS.map(a => '<button type="button" data-apc="'+a+'" class="'+(apOn.has(a)?'on':'')+'">'+a+'</button>').join("");
  const tags = ["All", ...new Set((DAILY.flights||[]).map(f => f.tag).filter(Boolean))];
  $("#tagChips").innerHTML = tags.map(g => '<button type="button" data-tag="'+esc(g)+'" class="'+(g===tagOn?'on':'')+'">'+esc(g)+'</button>').join("");
  renderWeekends();
  const max = +$("#maxP").value; $("#maxPVal").textContent = "$"+max;
  const wk = wkSel < 0 ? null : ymd(WKS[wkSel].fri), sort = $("#flSort").value;
  const all = (DAILY.flights||[]).map(f => ({...f, chk: checkFare(f)}))
    .filter(f => f.chk.fits && apOn.has(f.from) && (tagOn==="All" || f.tag===tagOn) && (!wk || f.chk.fri === wk));
  const fits = all.filter(f => f.price <= max);
  const near = all.filter(f => f.price > max && f.price <= max + 150).map(f => ({...f, chk: {...f.chk, why: ["$"+(f.price - max)+" over your budget"]}}));
  const srt = l => l.sort((a,b) => sort==="price" ? a.price-b.price : sort==="city" ? a.city.localeCompare(b.city) : (a.depart+(a.departTime||"")).localeCompare(b.depart+(b.departTime||"")));
  const card = (f,i,isNear) => '<a class="panel flight'+(isNear?' near':'')+'" href="'+esc(f.url)+'" target="_blank" rel="noopener"><span class="rank">'+(isNear?'~':i+1)+'</span>'+
    '<div style="min-width:0"><div class="route">'+f.from+' <i>→</i> '+esc(f.city)+'</div><div class="legs">'+
    '<span>Out: '+fmtDay(f.depart)+' · '+fmt12(f.departTime)+' · '+esc(f.airline)+(f.stops?' · '+esc(f.stops):'')+'</span>'+
    (f.returnDate ? '<span>Back: '+fmtDay(f.returnDate)+' · '+fmt12(f.returnDepart)+' → lands '+fmt12(f.returnArrive)+(f.returnTo && f.returnTo!==f.from ? ' at '+f.returnTo : '')+(f.returnAirline && f.returnAirline!==f.airline ? ' · '+esc(f.returnAirline) : '')+(f.returnStops?' · '+esc(f.returnStops):'')+'</span>' : '')+'</div>'+
    (isNear ? '<div class="why">'+f.chk.why.map(esc).join(" · ")+'</div>' : '')+'</div>'+
    '<div class="price"><b>$'+f.price+'</b><small>'+(f.returnDate?'round-trip':'one-way')+'</small></div></a>';
  $("#flHead").textContent = "In budget · "+fits.length;
  $("#flightList").innerHTML = (fits.length ? srt(fits).map((f,i) => card(f,i,false)).join("") :
      '<div class="panel empty-state">Nothing under $'+max+(wk ? ' this weekend' : '')+' yet. '+(near.length ? 'A few trips are just over budget below.' : 'Raise your budget or try the live search below.')+'</div>')
    + (showNear && near.length ? '<div class="mini-h" style="margin-top:14px">Just over budget · up to $'+(max+150)+'</div>'+srt(near).map((f,i) => card(f,i,true)).join("") : "");
  const u = new Date(DAILY.updated);
  $("#flightUpdated").textContent = (DAILY.flightsNote ? DAILY.flightsNote+" " : "")+"Updated "+DOW[u.getDay()]+" "+MON[u.getMonth()]+" "+u.getDate()+", "+u.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})+". Prices change fast, so tap a fare to check it live.";
}
document.addEventListener("click", e => {
  const w = e.target.closest("[data-wk]"); if (w){ wkSel = +w.dataset.wk; renderFlights(); return; }
  const a = e.target.closest("[data-apc]"); if (a){ const k = a.dataset.apc; if (apOn.has(k) && apOn.size > 1) apOn.delete(k); else apOn.add(k); renderFlights(); return; }
  const g = e.target.closest("[data-tag]"); if (g){ tagOn = g.dataset.tag; renderFlights(); }
});
$("#maxP").addEventListener("input", renderFlights);
$("#flSort").addEventListener("change", renderFlights);
$("#showNear").addEventListener("change", e => { showNear = e.target.checked; renderFlights(); });
$("#lsDest").addEventListener("change", renderWeekends);

/* football */
function kickText(iso){ const d = new Date(iso); return DOW[d.getDay()]+" "+MON[d.getMonth()]+" "+d.getDate()+" · "+d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}); }
/* ---------- to-do checklist (items live in the encrypted data) ---------- */
let TODO = [];
const todoDone = () => new Set(store.get("bf-todo-done", []));
function renderTodo(){
  const card = $("#todoCard"); if (!card) return;
  const today = key(new Date()), done = todoDone();
  const items = (TODO||[]).filter(t => t.date <= today);
  card.hidden = !items.length; if (!items.length) return;
  $("#todoCount").textContent = items.filter(t => done.has(t.id)).length+" / "+items.length;
  $("#todoList").innerHTML = items.map(t => '<label><input type="checkbox" data-todo="'+esc(t.id)+'"'+(done.has(t.id)?' checked':'')+'><span>'+esc(t.t)+'</span></label>').join("");
}
document.addEventListener("change", e => {
  const c = e.target.closest("[data-todo]"); if (!c) return;
  const d = todoDone(); c.checked ? d.add(c.dataset.todo) : d.delete(c.dataset.todo);
  store.set("bf-todo-done", [...d]); renderTodo();
  const items = (TODO||[]).filter(t => t.date <= key(new Date()));
  if (c.checked && items.length && items.every(t => d.has(t.id))) celebrate($("#todoCard"));
});
const rk = n => n ? "No. "+n+" " : "";
function renderFootball(){
  const fb = DAILY.football || {results:[], upcoming:[]};
  $("#fbLabel").textContent = "College football · "+(fb.label || "");
  $("#fbResults").innerHTML = (fb.results||[]).map(g => {
    const aw = g.as > g.hs;
    return '<div class="panel game"><div class="score-row '+(aw?'win':'lose')+'"><span>'+rk(g.awayRank)+esc(g.away)+'</span><b>'+g.as+'</b></div><div class="score-row '+(aw?'lose':'win')+'"><span>@ '+rk(g.homeRank)+esc(g.home)+'</span><b>'+g.hs+'</b></div>'+
      '<p>'+esc(g.blurb)+'</p>'+((g.stats||[]).length ? '<ul>'+g.stats.map(s => '<li>'+esc(s)+'</li>').join("")+'</ul>' : '')+'</div>';
  }).join("");
  $("#fbUpcoming").innerHTML = (fb.upcoming||[]).map(g => '<div class="panel up" style="cursor:default"><div class="datebox" style="--c:'+(g.army?'#c9a23a':'var(--accent)')+'"><small>'+MON[new Date(g.kick).getMonth()]+'</small><b>'+new Date(g.kick).getDate()+'</b></div><div style="min-width:0"><h4>'+rk(g.awayRank)+esc(g.away)+' at '+rk(g.homeRank)+esc(g.home)+'</h4><p>'+kickText(g.kick)+(g.note ? ' · '+esc(g.note) : '')+'</p></div><div></div></div>').join("");
}



/* ---------- bills / nfl ---------- */
let BILLS = null;
const nextBills = () => BILLS && (BILLS.schedule||[]).find(g => new Date(g.kick) > new Date());
function loadBills(){
  try { fetch("/data/bills.json?"+Date.now()).then(r => r.json()).then(j => { BILLS = j; renderBills(); renderBillsTile(); document.dispatchEvent(new CustomEvent("bf:data")); }).catch(() => {}); } catch(e){}
}
function renderBillsTile(){
  const g = nextBills(), el = $("#bBills"); if (!el) return;
  if (!g){ el.textContent = BILLS ? "Season over" : "—"; return; }
  const d = Math.max(0, Math.ceil((new Date(g.kick) - new Date())/864e5));
  el.textContent = (d === 0 ? "Today" : d+" day"+(d>1?"s":""))+" · "+(g.home?"vs ":"at ")+g.opp.split(" ").slice(-1)[0];
  $("#bBillsSub").textContent = kickText(g.kick)+(BILLS.record ? " · "+BILLS.record.w+"-"+BILLS.record.l : "");
}
function renderBills(){
  const B = BILLS; if (!B) return;
  const g = nextBills();
  $("#billsStrip").innerHTML = g ? '<div><span class="eyebrow" style="color:#3a7bff">Go Bills · Next game</span><h3>Bills '+(g.home?'vs':'at')+' '+esc(g.opp)+'</h3><p>'+kickText(g.kick)+(g.note ? ' · '+esc(g.note) : '')+'</p></div><div class="clock" data-target="'+(+new Date(g.kick))+'">'+clockHTML(new Date(g.kick) - new Date(), false)+'</div>' : '<div><h3>No more games scheduled</h3></div>';
  $("#billsRec").innerHTML = '<b>'+B.record.w+'-'+B.record.l+'</b><span>'+esc(B.standing||"")+' · PF '+B.pf+' · PA '+B.pa+'</span>';
  $("#billsStand").innerHTML = (B.afcEast||[]).map(t => '<div class="'+(t.me?'me':'')+'"><span>'+esc(t.team)+'</span><b>'+t.w+'-'+t.l+'</b></div>').join("");
  $("#billsLastT").textContent = B.lastGame.title;
  $("#billsLast").innerHTML = B.lastGame.stats.map(x => '<li>'+esc(x)+'</li>').join("");
  $("#billsResults").innerHTML = B.results.slice().reverse().map(r => '<div class="panel res-row"><span>Wk '+r.wk+' · '+esc(r.opp)+'<br><small style="color:var(--faint)">'+esc(r.date)+(r.note?' · '+esc(r.note):'')+'</small></span><b class="'+(r.res==="W"?'w':'l')+'">'+r.res+' '+r.bs+'-'+r.os+'</b></div>').join("");
  $("#billsNews").innerHTML = B.news.map(n => '<div class="panel news-i"><h4>'+esc(n.h)+'</h4><p>'+esc(n.b)+'</p></div>').join("");
  $("#billsSched").innerHTML = B.schedule.map(g => { const d = new Date(g.kick); return '<div class="panel up" style="cursor:default"><div class="datebox" style="--c:#3a7bff"><small>'+MON[d.getMonth()]+'</small><b>'+d.getDate()+'</b></div><div style="min-width:0"><h4>'+(g.home?'vs':'at')+' '+esc(g.opp)+'</h4><p>'+kickText(g.kick)+(g.note?' · '+esc(g.note):'')+'</p></div><div></div></div>'; }).join("");
  $("#billsSrc").textContent = (B.source||"")+" Updated "+new Date(B.updated).toLocaleDateString([], {month:"short", day:"numeric"})+".";
}

/* ---------- quote of the day ---------- */
let QUOTES = [{q:"What stands in the way becomes the way.", a:"Marcus Aurelius"}];
function renderQuote(){
  if (!$("#quoteText")) return;
  const d = new Date(), n = Math.floor((new Date(d.getFullYear(),d.getMonth(),d.getDate()) - new Date(2026,0,1))/864e5);
  const q = QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length];
  $("#quoteText").textContent = "“"+q.q+"”"; $("#quoteBy").textContent = "— "+q.a;
}
try { fetch("/data/quotes.json").then(r => r.json()).then(j => { if (j.quotes && j.quotes.length){ QUOTES = j.quotes; renderQuote(); } }).catch(() => {}); } catch(e){}

/* ---------- study ---------- */
/* text with \( inline \) and \[ display \] math (KaTeX) and `code` */
function rich(s){
  const km = (t, disp) => window.katex ? katex.renderToString(t, {displayMode: disp, throwOnError: false}) : '<span class="mono">'+esc(t)+'</span>';
  return String(s).split(/(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]+?\$\$|(?<!\\)\$(?![\s\d])[^$\n]+?(?<![\s\\])\$(?!\d)|`[^`]+`)/).map((p, i) =>
    i % 2 === 0 ? esc(p).replace(/\\\$/g, "$") :
    p.startsWith("\\[") ? km(p.slice(2,-2), true) :
    p.startsWith("\\(") ? km(p.slice(2,-2), false) :
    p.startsWith("$$") ? km(p.slice(2,-2), true) :
    p[0] === "$" ? km(p.slice(1,-1), false) :
    '<code>'+esc(p.slice(1,-1))+'</code>').join("");
}
let STUDY = {}, STUDY_DAILY = null;
/* data/trip.enc: the San Juan return-flight tracker (sealed; refreshed by the morning update) */
const usd0 = n => "$"+Math.round(n).toLocaleString("en-US");
async function loadTrip(){
  if (!finKey) return;
  try{
    const r = await fetch("/data/trip.enc", {cache: "no-store"}); if (!r.ok) return;
    const T = await openFin(await r.json()); if (!T || !T.ret) return;
    const t12 = hm => { if (!hm) return ""; let [h,m] = hm.split(":").map(Number); const ap = h>=12?"PM":"AM"; h = h%12||12; return h+":"+String(m).padStart(2,"0")+" "+ap; };
    const box = (lbl, o) => o ? '<div><small>'+esc(lbl)+'</small><b>'+usd0(o.price)+'</b><small>'+esc(o.airline)+' · '+esc(o.stops)+' · '+t12(o.depart)+' → '+t12(o.arrive)+(o.nextDay?' (+1)':'')+'</small><br><small>Trip total with your $'+T.paid.price+' flight: <strong>'+usd0(T.paid.price+o.price)+'</strong></small></div>' : '';
    const d = new Date(T.ret.date+"T12:00:00"), c = new Date(T.checked);
    $("#sjTrip").innerHTML = '<span class="eyebrow">Your trip · '+esc(T.ret.from)+' → '+esc(T.ret.to)+'</span><h3>San Juan return: '+DOW[d.getDay()]+', '+MON[d.getMonth()]+' '+d.getDate()+'</h3>'+
      '<p class="meta">Paid '+usd0(T.paid.price)+' for '+esc(T.paid.leg)+'. One-way prices back, checked '+MON[c.getMonth()]+' '+c.getDate()+'.</p>'+
      '<div class="sj-row">'+box("Your tracked flight · Google Flights", T.tracked.google)+box("Your tracked flight · Expedia", T.tracked.expedia)+box("Best price · Google Flights", T.best.google)+box("Best price · Expedia", T.best.expedia)+'</div>'+
      (T.alert ? '<p class="sj-alert"><strong>Google Flights alert:</strong> '+esc(T.alert.text)+' ('+esc(T.alert.when)+')</p>' : '')+
      '<p class="fine" style="margin-top:8px"><a href="'+esc(T.links.google)+'" target="_blank" rel="noopener">Google Flights ↗</a> · <a href="'+esc(T.links.expedia)+'" target="_blank" rel="noopener">Expedia ↗</a></p>';
    $("#sjTrip").hidden = false;
  }catch(e){}
}
/* data/sched.enc: schedule fixes applied on top of the locked schedule (sealed; written by tools/sealjson.py) */
async function loadSchedFix(){
  if (!finKey || !SCHED || !SCHED.events) return;
  try{
    const r = await fetch("/data/sched.enc", {cache: "no-store"}); if (!r.ok) return;
    const F = await openFin(await r.json()); if (!F) return;
    const hit = (e, w) => new RegExp(w.re, "i").test(e.t) && (!w.and || new RegExp(w.and, "i").test(e.t) || (w.dates||[]).includes(e.start)) && (!w.date || e.start === w.date || (e.end && e.start <= w.date && e.end >= w.date));
    let ev = SCHED.events.map(e => Object.assign({}, e));
    (F.remove||[]).forEach(w => { ev = ev.filter(e => !hit(e, w)); });
    (F.set||[]).forEach(w => {
      let m = ev.filter(e => hit(e, w)); if (w.cat) { const c = m.filter(e => e.cat === w.cat); if (c.length) m = c; }
      if (m.length) m.forEach(e => { Object.keys(w.to).forEach(k => { if (w.to[k] === null) delete e[k]; else e[k] = w.to[k]; }); });
      else if (w.add) ev.push(Object.assign({}, w.add));
    });
    (F.add||[]).forEach(a => { if (!ev.some(e => e.start === a.start && e.t === a.t)) ev.push(Object.assign({}, a)); });
    SCHED.events = ev.sort((a,b) => a.start.localeCompare(b.start));
    Object.assign(SCHED.days, F.days || {});
    buildEvents(); renderHome(); renderSched(); renderCourses(); renderBrief();
  }catch(e){}
}
/* data/study.enc: today's lesson decks, refreshed every morning by the daily task (sealed with the same public key as finance.enc) */
async function loadStudy(){
  if (!finKey) return;
  try{
    const r = await fetch("/data/study.enc", {cache: "no-store"}); if (!r.ok) return;
    const D = await openFin(await r.json()); if (!D || !D.courses) return;
    STUDY_DAILY = D; STUDY = {...STUDY, ...D.courses};
    const today = key(new Date()), first = Object.keys(D.courses).find(c => D.courses[c].lessonDate === today) || Object.keys(D.courses)[0];
    if (first && store.get("bf-stday", "") !== today){ stCode = first; store.set("bf-stday", today); }
    Object.keys(D.courses).forEach(c => { delete stState[c]; });
    renderStudy();
  }catch(e){}
}
let stCode = store.get("bf-stcode", ""), stMode = store.get("bf-stmode", "cards");
const stState = {};   // per course: {order, i, flip}
const knKey = code => "bf-known-"+code+(STUDY[code] && STUDY[code].lessonDate ? "-"+STUDY[code].lessonDate : "");
const stKnown = code => new Set(store.get(knKey(code), []));
function stOrder(code, shuffle){
  const n = (STUDY[code].cards||[]).length, o = [...Array(n).keys()];
  if (shuffle) for (let i = n-1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [o[i],o[j]] = [o[j],o[i]]; }
  return o;
}
function renderStudy(){
  const today = key(new Date()), rank = c => { const d = STUDY[c].lessonDate || ""; return d === today ? 0 : d > today ? 1 : 2; };
  const codes = Object.keys(STUDY).sort((a,b) => rank(a) - rank(b) || (STUDY[a].lessonDate||"9").localeCompare(STUDY[b].lessonDate||"9"));
  if (!codes.length){ $("#studyTabs").innerHTML = ""; $("#studyBody").innerHTML = '<div class="panel empty-state">Unlock to see your decks.</div>'; return; }
  if (!STUDY[stCode]) stCode = codes[0];
  $("#studyTabs").innerHTML = codes.map(c => '<button type="button" role="tab" class="'+(c===stCode?'on':'')+'" data-stc="'+c+'">'+esc(c)+' · '+esc(STUDY[c].short)+(STUDY[c].lessonDate===today?' · today':'')+'</button>').join("");
  const S = STUDY[stCode];
  if (!stState[stCode]) stState[stCode] = {order: stOrder(stCode, false), i: 0, flip: false};
  const modes = [["cards","Flashcards ("+(S.cards||[]).length+")"],["probs","Practice problems ("+(S.problems||[]).length+")"],["recap","Recap &amp; coming up"]];
  let html = '<div class="st-head"><div><span class="eyebrow">'+esc(S.lesson ? S.lesson+(S.lessonDate===today?' · Today':'') : S.term)+'</span><h3>'+esc(S.title)+'</h3>'+(S.lesson && S.term ? '<p class="fine" style="margin:4px 0 0">'+esc(S.term)+(STUDY_DAILY && STUDY_DAILY.updated ? ' · refreshed '+esc(STUDY_DAILY.updated.slice(0,10)) : '')+'</p>' : '')+'</div><div class="seg">'+modes.map(m => '<button type="button" data-stm="'+m[0]+'" class="'+(m[0]===stMode?'on':'')+'">'+m[1]+'</button>').join("")+'</div></div>';
  if (stMode === "cards"){
    const st = stState[stCode], known = stKnown(stCode);
    if (!(S.cards||[]).length) html += '<div class="panel empty-state">No cards yet.</div>';
    else {
      const idx = st.order[st.i], c = S.cards[idx];
      const tag = ' · '+(st.i+1)+' / '+st.order.length+(known.has(idx)?' · got it':'');
      html += '<div class="flash3d" id="flash" tabindex="0" role="button" aria-label="Flip card"><div class="fi'+(st.flip?' flipped':'')+'">'+
        '<div class="panel flash face front"><div><small>Question'+tag+'</small>'+rich(c[0])+'</div></div>'+
        '<div class="panel flash back face"><div><small>Answer'+tag+'</small>'+rich(c[1])+'</div></div></div></div>'+
        '<div class="fc-bar"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="small-btn" type="button" data-fc="prev">← Prev</button><button class="small-btn" type="button" data-fc="flip">Flip</button><button class="small-btn" type="button" data-fc="next">Next →</button></div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="small-btn" type="button" data-fc="again">Again</button><button class="btn primary" type="button" data-fc="got">Got it</button></div></div>'+
        '<div class="fc-bar"><span class="mono">'+known.size+' of '+S.cards.length+' marked got it</span><div style="display:flex;gap:8px"><button class="link-btn" type="button" data-fc="shuffle">Shuffle</button><button class="link-btn" type="button" data-fc="reset">Reset progress</button></div></div>';
    }
  } else if (stMode === "probs"){
    html += (S.problems||[]).length ? '<div class="up-list">'+S.problems.map((p,i) => '<div class="panel prob"><span class="eyebrow">Problem '+(i+1)+'</span><p class="q">'+rich(p.q)+'</p><button class="small-btn" type="button" data-prob="'+i+'" style="margin-top:10px">Show answer</button><div class="a" id="pa'+i+'" hidden>'+rich(p.a)+'</div></div>').join("")+'</div>' : '<div class="panel empty-state">No problems yet.</div>';
  } else {
    html += '<div class="grid g2"><div class="panel recap"><span class="eyebrow">What you just covered</span><ul class="list-tight">'+(S.recap||[]).map(x => '<li>'+esc(x)+'</li>').join("")+'</ul></div>'+
      '<div class="panel recap"><span class="eyebrow">What you need to know next</span><ul class="list-tight">'+((S.prep||[]).length ? S.prep.map(x => '<li>'+esc(x)+'</li>').join("") : '<li>Nothing flagged yet.</li>')+'</ul>'+
      (stUpcoming(stCode) ? '<span class="eyebrow" style="display:block;margin-top:16px">On the schedule</span>'+stUpcoming(stCode) : '')+'</div></div>'+
      ((S.sources||[]).length ? '<p class="fine">Built from: '+S.sources.map(esc).join(" · ")+'</p>' : '');
  }
  $("#studyBody").innerHTML = html;
}
function stUpcoming(code){
  const now = new Date();
  const l = courseEvents(code).filter(e => e.endT >= now).sort((a,b) => a.s - b.s).slice(0,4);
  return l.length ? '<ul class="list-tight">'+l.map(e => '<li>'+esc(e.t)+' · '+fmtRange(e)+'</li>').join("")+'</ul>' : '';
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-stc]"); if (t){ stCode = t.dataset.stc; store.set("bf-stcode", stCode); renderStudy(); return; }
  const m = e.target.closest("[data-stm]"); if (m){ stMode = m.dataset.stm; store.set("bf-stmode", stMode); renderStudy(); return; }
  const p = e.target.closest("[data-prob]"); if (p){ const a = $("#pa"+p.dataset.prob); a.hidden = !a.hidden; p.textContent = a.hidden ? "Show answer" : "Hide answer"; return; }
  if (e.target.closest("#flash")){ stFc("flip"); return; }
  const f = e.target.closest("[data-fc]"); if (f) stFc(f.dataset.fc);
});
function stFc(act){
  const st = stState[stCode]; if (!st) return;
  const n = st.order.length, idx = st.order[st.i], known = stKnown(stCode);
  if (act === "flip"){ st.flip = !st.flip; const fi = $("#flash .fi"); if (fi){ fi.classList.toggle("flipped", st.flip); return; } }
  else if (act === "next"){ st.i = (st.i+1) % n; st.flip = false; }
  else if (act === "prev"){ st.i = (st.i-1+n) % n; st.flip = false; }
  else if (act === "got"){ known.add(idx); store.set(knKey(stCode), [...known]); st.i = (st.i+1) % n; st.flip = false; }
  else if (act === "again"){ known.delete(idx); store.set(knKey(stCode), [...known]); st.i = (st.i+1) % n; st.flip = false; }
  else if (act === "shuffle"){ st.order = stOrder(stCode, true); st.i = 0; st.flip = false; }
  else if (act === "reset"){ store.set(knKey(stCode), []); }
  renderStudy();
}
addEventListener("keydown", e => {
  if (curView !== "study" || stMode !== "cards" || /INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||"")) return;
  if (e.key === " "){ e.preventDefault(); stFc("flip"); } else if (e.key === "ArrowRight") stFc("next"); else if (e.key === "ArrowLeft") stFc("prev");
});

/* ---------- grade calculator ---------- */
const letter = g => g >= 93 ? "A" : g >= 90 ? "A-" : g >= 87 ? "B+" : g >= 83 ? "B" : g >= 80 ? "B-" : g >= 77 ? "C+" : g >= 73 ? "C" : g >= 70 ? "C-" : g >= 67 ? "D+" : g >= 60 ? "D" : "F";
function openGrade(code){
  const now = new Date(), up = courseEvents(code).filter(e => e.endT >= now).sort((a,b) => a.s - b.s).slice(0,3);
  const c = COURSES.find(x => x.code === code) || {title: code};
  const saved = store.get("bf-grade-"+code, null) || {cur: 90, done: 50, rest: null, w: [10,10,10], s: [90,90,90]};
  const stt = saved;
  const rows = up.length ? up.map((e,i) =>
    '<div class="gc-row"><span>'+esc(e.t.replace(/^[A-Z]{2}\d{3}X?\s*/,""))+'<br><small style="color:var(--faint)">'+fmtRange(e)+'</small></span>'+
    '<input type="number" min="0" max="100" step="1" data-gw="'+i+'" value="'+stt.w[i]+'" aria-label="Weight percent"><input class="gc-sl" type="range" min="0" max="110" step="1" data-gs="'+i+'" value="'+stt.s[i]+'" aria-label="Score"><b class="gc-v mono" id="gv'+i+'">'+stt.s[i]+'</b></div>').join("") :
    '<p class="meta">No upcoming graded events for this class.</p>';
  $("#drawerRoot").innerHTML = '<div class="drawer" id="drawer"><div class="sheet wide" style="--c:var(--accent)" role="dialog" aria-modal="true" aria-label="Grade calculator">'+
    '<button class="icon-btn sheet-close" type="button" id="dClose" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
    '<span class="chip">Grade calculator</span><h3 style="font-size:24px">'+esc(code)+' · '+esc(c.title)+'</h3>'+
    '<p class="meta" style="font-size:13.5px">Enter your current grade and how much of the course is already graded, then slide the next three scores to see what happens. Weights are yours to set from the syllabus.</p>'+
    '<div class="gc-lbl"><span>Current grade (%)</span><input class="gc-in" type="number" id="gcCur" min="0" max="110" step="0.1" value="'+stt.cur+'"></div>'+
    '<div class="gc-lbl"><span>Share of course already graded (%)</span><input class="gc-in" type="number" id="gcDone" min="0" max="100" step="1" value="'+stt.done+'"></div>'+
    '<div class="gc-lbl"><span>Assume everything else scores (%)</span><input class="gc-in" type="number" id="gcRest" min="0" max="110" step="1" value="'+(stt.rest==null?stt.cur:stt.rest)+'"></div>'+
    '<div class="gc-row" style="font:600 11px var(--mono);color:var(--faint)"><span>NEXT 3 GRADED ITEMS</span><span>WEIGHT %</span><span>WHAT-IF SCORE</span><span></span></div>'+rows+
    '<div class="gc-out"><b id="gcFinal">—</b><span id="gcLetter"></span><span id="gcDelta"></span></div><p class="fine" id="gcNote" style="margin-top:0"></p></div></div>';
  const calc = () => {
    const cur = +$("#gcCur").value||0, done = Math.min(100, Math.max(0, +$("#gcDone").value||0)), restS = +$("#gcRest").value||0;
    const w = up.map((_,i) => Math.max(0, +document.querySelector('[data-gw="'+i+'"]').value||0)), sc = up.map((_,i) => +document.querySelector('[data-gs="'+i+'"]').value||0);
    up.forEach((_,i) => $("#gv"+i).textContent = sc[i]);
    const sumW = w.reduce((a,b)=>a+b,0), remain = 100 - done, other = Math.max(0, remain - sumW);
    const fin = (cur*done + w.reduce((a,x,i)=>a+x*sc[i],0) + other*restS)/100;
    const base = (cur*done + sumW*cur + other*restS)/100;
    $("#gcFinal").textContent = fin.toFixed(1)+"%"; $("#gcLetter").textContent = letter(fin);
    const dl = fin - base; $("#gcDelta").textContent = (dl>=0?"+":"")+dl.toFixed(1)+" vs. scoring your current grade on these three";
    $("#gcNote").textContent = sumW > remain ? "Those weights add up to more than the part of the course left ("+remain+"%)." : "";
    store.set("bf-grade-"+code, {cur, done, rest: restS, w, s: sc});
  };
  $("#drawer").addEventListener("input", calc); calc();
  $("#drawer").addEventListener("click", e => { if (e.target.id === "drawer") $("#drawerRoot").innerHTML = ""; });
  $("#dClose").addEventListener("click", () => { $("#drawerRoot").innerHTML = ""; }); $("#dClose").focus();
}
document.addEventListener("click", e => { const g = e.target.closest("[data-grade]"); if (g){ e.stopPropagation(); openGrade(g.dataset.grade); } }, true);

/* ---------- finance (placeholders until accounts are linked) ---------- */
let WL = store.get("bf-watch", []);
let FIN = null;
const usd = v => (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
/* finance.enc: AES-GCM data whose key is wrapped with RSA-OAEP; the private key lives in the password-locked data */
/* Live source: your Cloudflare Worker (tools/worker/worker.js). Leave "" to use only the daily snapshot. */
const FIN_LIVE = "https://bf-finance.bfonte18.workers.dev";
let finKey = null, finTimer = 0;
async function openFin(blob){
  const priv = await crypto.subtle.importKey("jwk", finKey, {name: "RSA-OAEP", hash: "SHA-256"}, false, ["decrypt"]);
  const raw = await crypto.subtle.decrypt({name: "RSA-OAEP"}, priv, b64d(blob.k));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({name: "AES-GCM", iv: b64d(blob.iv)}, key, b64d(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function loadFinance(jwk){
  if (jwk) finKey = jwk; if (!finKey) return;
  let got = null;
  if (FIN_LIVE){ try{ const r = await fetch(FIN_LIVE.replace(/\/+$/,"")+"/live", {cache: "no-store"}); if (r.ok) got = await openFin(await r.json()); }catch(e){} }
  if (!got || !got.accounts || !got.accounts.length){ try{ got = await openFin(await (await fetch("/data/finance.enc", {cache: "no-store"})).json()); }catch(e){} }
  if (got){ FIN = got; renderFinance(); }
  clearTimeout(finTimer); if (FIN_LIVE) finTimer = setTimeout(() => loadFinance(), 5*60*1000);
}
function renderFinance(){
  const F = FIN;
  if (!F){
    $("#finAsOf").textContent = PRIVATE ? "Loading…" : "Locked";
    $("#acctGrid").innerHTML = ["Chase","Capital One","Robinhood","American Express"].map(n => '<div class="panel acct"><b>'+n+'</b><span class="st">'+(PRIVATE ? "Loading" : "Unlock to see")+'</span><span class="bal">—</span></div>').join("");
    $("#finSnap").innerHTML = ["Net worth","Spent this month","Cash flow"].map(n => '<div class="panel fin-p"><span class="eyebrow">'+n+'</span><span class="fin-big">—</span></div>').join("");
    $("#finCats").innerHTML = '<p class="fine">Unlock to see.</p>'; $("#finCmp").innerHTML = ""; $("#finFlagSec").hidden = true;
  } else {
    const d = new Date(F.asOf+"T12:00:00");
    $("#finAsOf").textContent = F.live && F.at ? "Live · "+new Date(F.at).toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit"}) : "Updated "+MON[d.getMonth()]+" "+d.getDate();
    $("#acctGrid").innerHTML = F.accounts.map(a => '<div class="panel acct"><b>'+esc(a.inst)+'</b><span class="st">'+esc(a.name)+' ··'+esc(a.mask)+'</span><span class="bal">'+usd(a.bal)+'</span><span class="st">'+(a.debt ? "Owed on card" : esc(a.type))+'</span></div>').join("") +
      (F.pending||[]).map(n => '<div class="panel acct"><b>'+esc(n)+'</b><span class="st">Not linked yet</span><span class="bal">—</span></div>').join("");
    const m = F.month, l = F.lastMonth;
    $("#finSnap").innerHTML =
      '<div class="panel fin-p"><span class="eyebrow">Net worth</span><span class="fin-big">'+usd(F.netWorth)+'</span><p class="fine">Linked cash minus card balances.</p></div>'+
      '<div class="panel fin-p"><span class="eyebrow">Spent '+esc(m.label)+'</span><span class="fin-big">'+usd(m.spending)+'</span><p class="fine">'+esc(l.label)+': '+usd(l.spending)+'</p></div>'+
      '<div class="panel fin-p"><span class="eyebrow">Cash flow '+esc(m.label)+'</span><span class="fin-big" style="color:'+(m.net >= 0 ? 'var(--c-break)' : 'var(--c-due)')+'">'+usd(m.net)+'</span><p class="fine">Income '+usd(m.income)+' minus spending.</p></div>';
    const top = Math.max(...F.categories.map(c => c[1]), 1);
    $("#finCatLbl").textContent = "Spending by category · "+m.label;
    $("#finCats").innerHTML = F.categories.map(c => '<div class="fin-cat"><span>'+esc(c[0])+'</span><b>'+usd(c[1])+'</b><div class="bar"><i style="width:'+(c[1]/top*100).toFixed(1)+'%"></i></div></div>').join("");
    const mx = Math.max(m.income, m.spending, l.income, l.spending, 1);
    const row = (lbl, v, col) => '<span>'+lbl+'</span><div class="bar"><i style="width:'+(v/mx*100).toFixed(1)+'%;background:'+col+'"></i></div><b>'+usd(v)+'</b>';
    $("#finCmp").innerHTML = '<div class="fin-cmp">'+row(esc(m.label)+" in", m.income, "var(--c-break)")+row(esc(m.label)+" out", m.spending, "var(--accent)")+row(esc(l.label)+" in", l.income, "var(--c-break)")+row(esc(l.label)+" out", l.spending, "var(--accent)")+'</div><p class="fine" style="margin-top:12px">'+esc(F.spendNote || "Spending includes card payments and transfers, so some money is counted twice.")+'</p>';
    $("#finFlagSec").hidden = !(F.flags||[]).length;
    $("#finFlags").innerHTML = (F.flags||[]).map(f => '<li>'+esc(f)+'</li>').join("");
  }
  $("#wlList").innerHTML = WL.length ? WL.map(t => '<div class="wl-i"><a href="https://www.google.com/finance/quote/'+encodeURIComponent(t)+'" target="_blank" rel="noopener">'+esc(t)+' ↗</a><button type="button" data-wlx="'+esc(t)+'" aria-label="Remove '+esc(t)+'">×</button></div>').join("") : '<p class="fine">Nothing on your watchlist yet.</p>';
}
document.addEventListener("submit", e => {
  if (e.target.id !== "wlForm") return; e.preventDefault();
  const t = $("#wlIn").value.trim().toUpperCase().replace(/[^A-Z.\-]/g,"").slice(0,8);
  if (t && !WL.includes(t)){ WL.push(t); store.set("bf-watch", WL); }
  $("#wlIn").value = ""; renderFinance();
});
document.addEventListener("click", e => { const x = e.target.closest("[data-wlx]"); if (x){ WL = WL.filter(t => t !== x.dataset.wlx); store.set("bf-watch", WL); renderFinance(); } });

/* place of the day */
function renderPlace(){
  const p = DAILY.location; if (!p) return;
  const now = new Date();
  $("#placeDate").textContent = "Place of the day · "+MON[now.getMonth()]+" "+now.getDate();
  $("#placeName").textContent = p.name; $("#placeTag").textContent = p.tagline || p.region;
  $("#placeIntro").textContent = p.intro || p.blurb || "";
  $("#placeFacts").innerHTML = (p.facts||[]).map(f => '<li>'+esc(f)+'</li>').join("");
  $("#placeTip").innerHTML = p.tip ? '<span class="eyebrow">Insider tip</span><p style="margin-top:6px">'+esc(p.tip)+'</p>' : ''; $("#placeTip").hidden = !p.tip;
  $("#placeStats").innerHTML = [{label:"Where", value:p.region}, ...(p.stats||[])].map(s => '<div class="fact"><span>'+esc(s.label)+'</span><b>'+esc(s.value)+'</b></div>').join("");
  $("#placeBest").textContent = p.bestTime || "—"; $("#placeGo").textContent = p.gettingThere || "—";
  $("#placeLink").href = "https://en.wikipedia.org/wiki/"+encodeURIComponent(p.wiki);
  $("#placeMap").href = p.lat ? "https://www.google.com/maps/search/?api=1&query="+p.lat+","+p.lon : "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(p.name);
  const ph = n => '<div class="ph"><div><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>'+n+'</div></div>';
  $("#placeGallery").innerHTML = ph("Photos load on the live site")+ph("")+ph("");
  $("#placeHeroImg").style.backgroundImage = "";
  try {
    fetch("https://en.wikipedia.org/api/rest_v1/page/media-list/"+encodeURIComponent(p.wiki)).then(r => r.json()).then(j => {
      const imgs = (j.items||[]).filter(i => i.type==="image" && i.srcset && i.srcset.length && !/\.(svg|png)$/i.test(i.title) && !/map|flag|logo|icon|locator/i.test(i.title))
        .slice(0,7).map(i => { const s = i.srcset[i.srcset.length-1].src; return s.startsWith("//") ? "https:"+s : s; });
      if (!imgs.length) return;
      $("#placeHeroImg").style.backgroundImage = 'url("'+imgs[0].replace(/"/g,"")+'")';
      $("#placeGallery").innerHTML = imgs.slice(1).map(s => '<img src="'+esc(s)+'" alt="'+esc(p.name)+'" loading="lazy">').join("");
    }).catch(() => {});
  } catch(e){}
}

/* morning brief */
const WX = {0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Rain showers",81:"Rain showers",82:"Heavy showers",95:"Thunderstorms",96:"Thunderstorms",99:"Thunderstorms"};
function loadWeather(){
  try {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=41.39&longitude=-73.96&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=1")
      .then(r => r.json()).then(j => {
        $("#wxTemp").textContent = Math.round(j.current.temperature_2m)+"°";
        $("#wxDesc").textContent = (WX[j.current.weather_code] || "—")+" · wind "+Math.round(j.current.wind_speed_10m)+" mph";
        $("#wxRow").innerHTML = '<div><small>High</small><b>'+Math.round(j.daily.temperature_2m_max[0])+'°</b></div><div><small>Low</small><b>'+Math.round(j.daily.temperature_2m_min[0])+'°</b></div><div><small>Rain</small><b>'+j.daily.precipitation_probability_max[0]+'%</b></div>';
      }).catch(() => { $("#wxDesc").textContent = "Live weather shows on the public site."; });
  } catch(e){ $("#wxDesc").textContent = "Live weather shows on the public site."; }
}
function renderBrief(){
  const now = new Date(), h = now.getHours();
  $("#briefHello").textContent = (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening")+", Braeden.";
  $("#briefDate").textContent = DOW[now.getDay()]+", "+MONTH[now.getMonth()]+" "+now.getDate();
  const tk = key(now), tm = new Date(now); tm.setDate(tm.getDate()+1); const tmk = key(tm);
  const on = k => EVENTS.filter(e => key(e.s) <= k && key(e.e) >= k);
  const tag = k => SCHED.days[k] ? ' <span>'+esc(SCHED.days[k])+'</span>' : '';
  const block = (lbl, k) => { const l = on(k); return '<div class="mini-h">'+lbl+'</div>'+(l.length ? l.map(e => '<div class="mini" data-cat="'+e.cat+'"><span class="dot"></span><span>'+esc(e.t)+'</span><span>'+CATS[e.cat].label+'</span></div>').join("") : '<div class="mini" style="color:var(--muted)">Nothing scheduled'+(SCHED.days[k] ? ' · Lesson '+esc(SCHED.days[k]) : '')+'</div>'); };
  $("#briefToday").innerHTML = block("Today", tk) + block("Tomorrow", tmk);
  $("#briefSub").textContent = SCHED.days[tk] ? "Lesson day "+SCHED.days[tk]+"." : "Here's your day at a glance.";
  const fl = (DAILY.flights||[]).map(f => ({...f, chk: checkFare(f)})), fitL = fl.filter(f => f.chk.fits).sort((a,b)=>a.price-b.price);
  const f = fitL[0] || fl.sort((a,b)=>a.price-b.price)[0];
  if (f){ $("#bFlight").textContent = "$"+f.price+" to "+f.city.split(",")[0]; $("#bFlightSub").textContent = fitL.length ? f.from+" · "+fmtDay(f.depart)+" · fits your pass" : "Closest deal today · see weekend options"; }
  renderBillsTile();
  renderQuote();
  if (DAILY.location){ $("#bPlace").textContent = DAILY.location.name; $("#bPlaceSub").textContent = DAILY.location.tagline || DAILY.location.region; }
  const wk = new Date(now); wk.setDate(wk.getDate()+7);
  const due = upcoming(now).filter(e => (e.cat==="due"||e.cat==="exam") && e.s < wk);
  $("#bDueCount").textContent = due.length;
  $("#briefDue").innerHTML = due.length ? due.map(e => rowHTML(e, now)).join("") : '<div class="panel empty-state">Nothing due in the next 7 days.</div>';
  $("#dailyDate").textContent = "Daily · "+MON[now.getMonth()]+" "+now.getDate();
}

/* ---------- to-do list (data/todos.json; checkmarks are saved in this browser) ---------- */
let TDL = null, tdView = store.get("bf-todoview", "next");
const tdDone = new Set(store.get("bf-tododone", []));
const tdAt = (d, hm) => { const [h,m] = (hm||"00:00").split(":").map(Number); const x = parseD(d); x.setHours(h, m, 0, 0); return x; };
const tdClock = hm => { let [h,m] = hm.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h+":"+String(m).padStart(2,"0")+" "+ap; };
const tdRange = s => { if (s.label) return s.label; if (!s.end) return tdClock(s.start);
  const a = tdClock(s.start), b = tdClock(s.end); return a.slice(-2) === b.slice(-2) ? a.slice(0,-3)+"–"+b : a+"–"+b; };
function tdDayName(d, now){
  const t = key(now), tm = new Date(now); tm.setDate(tm.getDate()+1);
  if (d === t) return "Today"; if (d === key(tm)) return "Tomorrow";
  const x = parseD(d); return DOW[x.getDay()]+", "+MON[x.getMonth()]+" "+x.getDate();
}
function tdSessions(it, now){
  return it.sessions.map(s => { const a = tdAt(s.date, s.start), b = tdAt(s.date, s.end || s.start); if (!s.end) b.setHours(b.getHours()+1);
    return {...s, a, b, st: now > b ? "past" : now >= a ? "live" : (a - now < 864e5 ? "soon" : "")}; }).sort((x,y) => x.a - y.a);
}
function tdWhen(next, now){
  if (!next) return "All planned times have passed";
  const day = tdDayName(next.date, now), r = tdRange(next);
  if (next.st === "live") return next.label && next.label !== "Tonight" && next.label !== "All day" ? "Happening now: "+next.label.charAt(0).toLowerCase()+next.label.slice(1) : next.label ? "Happening now" : "Happening now, until "+tdClock(next.end || next.start);
  if (day === "Today" && next.label === "Tonight") return "Next up: tonight";
  return "Next up: "+day+(next.label === "All day" ? " (all day)" : ", "+(next.label ? next.label.charAt(0).toLowerCase()+next.label.slice(1) : r));
}
function renderTdl(){
  const card = $("#tdCard"); if (!card) return;
  if (!TDL || !(TDL.items||[]).length){ card.hidden = true; return; }
  card.hidden = false;
  const now = new Date(), items = TDL.items.map(it => { const ss = tdSessions(it, now); return {...it, ss, next: ss.find(s => s.st !== "past"), done: tdDone.has(it.id)}; });
  const nDone = items.filter(i => i.done).length;
  $("#tdCount").textContent = nDone+" of "+items.length+" done";
  $("#tdBar").style.width = Math.round(100*nDone/items.length)+"%";
  document.querySelectorAll("[data-tdv]").forEach(b => b.classList.toggle("on", b.dataset.tdv === tdView));
  const ck = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const card1 = it => {
    const live = it.next && it.next.st === "live", late = !it.done && !it.next;
    return '<div class="td'+(it.done ? " done" : live ? " now" : late ? " late" : "")+'" data-td="'+esc(it.id)+'">'+
      '<button type="button" class="td-ck" aria-pressed="'+it.done+'" aria-label="'+(it.done ? "Mark not done: " : "Mark done: ")+esc(it.title)+'">'+ck+'</button>'+
      '<div><div class="td-t">'+esc(it.title)+'</div><div class="td-ss">'+it.ss.map(s => '<span class="chip'+(s.st ? " "+s.st : "")+'">'+esc(tdDayName(s.date, now))+' · '+esc(tdRange(s))+'</span>').join("")+'</div></div>'+
      '<span class="td-tag">'+esc(it.tag||"")+'</span>'+
      (it.done ? '' : '<div class="td-when">'+esc(tdWhen(it.next, now))+'</div>')+'</div>';
  };
  let html = "";
  if (tdView === "done"){
    const d = items.filter(i => i.done);
    html = d.length ? d.map(card1).join("") : '<div class="empty-state" style="padding:22px">Nothing checked off yet. Tap a circle when you finish something.</div>';
  } else if (tdView === "day"){
    const days = {};
    items.forEach(it => it.ss.forEach(s => (days[s.date] = days[s.date] || []).push({it, s})));
    html = Object.keys(days).sort().filter(d => d >= key(now) || days[d].some(x => !x.it.done)).map(d => {
      const name = tdDayName(d, now);
      return '<div class="td-day">'+(name === "Today" ? "<b>Today</b>" : esc(name))+'</div>'+days[d].sort((x,y) => x.s.a - y.s.a).map(x =>
        '<div class="td-row'+(x.it.done || x.s.st === "past" ? " done" : "")+'" data-cat="due"><span class="dot"'+(x.s.st === "live" ? ' style="background:var(--accent)"' : '')+'></span><span>'+esc(x.it.title)+'</span><span>'+esc(tdRange(x.s))+'</span></div>').join("");
    }).join("") || '<div class="empty-state" style="padding:22px">Nothing left on the calendar.</div>';
  } else {
    const open = items.filter(i => !i.done).sort((a,b) => (a.next ? a.next.a : -Infinity) - (b.next ? b.next.a : -Infinity));
    html = open.length ? open.map(card1).join("") : '<div class="empty-state" style="padding:22px">All done. Nice work.</div>';
  }
  $("#tdList").innerHTML = html;
}
function loadTdl(){
  try { fetch("/data/todos.json", {cache:"no-store"}).then(r => r.ok ? r.json() : null).then(j => { if (j) { TDL = j; renderTdl(); } }).catch(() => {}); } catch(e){}
}
document.addEventListener("click", e => {
  const v = e.target.closest("[data-tdv]"); if (v){ tdView = v.dataset.tdv; store.set("bf-todoview", tdView); renderTdl(); return; }
  const b = e.target.closest(".td-ck"); if (!b) return;
  const id = b.closest("[data-td]").dataset.td, it = TDL.items.find(i => i.id === id);
  if (tdDone.has(id)) { tdDone.delete(id); toast("Moved back to your list"); } else { tdDone.add(id); toast("Done: "+it.title); }
  store.set("bf-tododone", [...tdDone]); renderTdl();
});
setInterval(renderTdl, 60000);

/* ---------- countdowns ---------- */
const TRIPS = [
  {id:"pr", cls:"pr", eyebrow:"Puerto Rico · with the boys", title:"Puerto Rico trip", start:new Date(2026,11,27,6,0,0), end:new Date(2027,0,2,23,59,0), sub:"Dec 27 – Jan 2", tag:"Trip"},
  {id:"n500", cls:"n500", eyebrow:"Class of 2028", title:"500th Night", start:new Date(2027,0,22,18,0,0), end:new Date(2027,0,22,23,59,0), sub:"Friday, Jan 22, 2027", tag:"Event"}
];
function renderCountdowns(){
  const now = new Date();
  $("#cdPair").innerHTML = TRIPS.map(c => {
    const live = now >= c.start && now <= c.end, past = now > c.end;
    return '<div class="panel '+c.cls+'"><span class="tag">'+c.tag+'</span><div><span class="eyebrow">'+esc(c.eyebrow)+'</span><h3>'+esc(c.title)+'</h3><p>'+esc(c.sub)+'</p></div>'+
      (live ? '<p style="font:700 22px var(--display);color:var(--fg)">'+(c.id==="pr"?"You're in Puerto Rico. Enjoy it.":"Tonight's the night.")+'</p>' : past ? '<p>Done. Hope it was a great one.</p>' :
      '<div class="clock" data-target="'+(+c.start)+'">'+clockHTML(c.start - now, true)+'</div>')+'</div>';
  }).join("");
  $("#cdMini").innerHTML = TRIPS.filter(c => now <= c.end).map(c => { const d = Math.max(0, Math.ceil((c.start - now)/864e5)); return '<a href="#home"><span>'+esc(c.title)+'</span><b>'+(now >= c.start ? "Now" : d+" day"+(d===1?"":"s"))+'</b></a>'; }).join("");
}

/* ---------- song of the day (title, artist, links only; lyrics stay on licensed sites) ---------- */
const SONGS = [
  ["HUMBLE.","Kendrick Lamar",2017,"DAMN.","Kendrick's first No. 1 on the Hot 100 as a lead artist."],
  ["God's Plan","Drake",2018,"Scorpion","Spent 11 weeks at No. 1. In the video, Drake gave away the music video's budget, about $1 million, to people in Miami."],
  ["SICKO MODE","Travis Scott ft. Drake",2018,"Astroworld","A three-part song with multiple beat switches that still reached No. 1."],
  ["rockstar","Post Malone ft. 21 Savage",2017,"beerbongs & bentleys","Held No. 1 on the Hot 100 for eight weeks."],
  ["Hotline Bling","Drake",2015,"Views","The dance moves in the video became one of the biggest memes of 2015."],
  ["Love the Way You Lie","Eminem ft. Rihanna",2010,"Recovery","Spent seven weeks at No. 1 in 2010."],
  ["Not Afraid","Eminem",2010,"Recovery","Debuted at No. 1 on the Hot 100."],
  ["Old Town Road","Lil Nas X ft. Billy Ray Cyrus",2019,"7","Spent 19 weeks at No. 1, a record at the time."],
  ["Alright","Kendrick Lamar",2015,"To Pimp a Butterfly","Its hook became a chant at protests across the country."],
  ["Started From the Bottom","Drake",2013,"Nothing Was the Same",""],
  ["Bad and Boujee","Migos ft. Lil Uzi Vert",2016,"Culture","Went to No. 1 after blowing up online in late 2016."],
  ["Bodak Yellow","Cardi B",2017,"Invasion of Privacy","Made Cardi the first solo female rapper to hit No. 1 without a feature since Lauryn Hill in 1998."],
  ["Lucid Dreams","Juice WRLD",2018,"Goodbye & Good Riddance","Built on a sample of Sting's \"Shape of My Heart.\""],
  ["goosebumps","Travis Scott ft. Kendrick Lamar",2016,"Birds in the Trap Sing McKnight",""],
  ["XO Tour Llif3","Lil Uzi Vert",2017,"Luv Is Rage 2","Started as a SoundCloud loosie before becoming his biggest hit."],
  ["Mask Off","Future",2017,"FUTURE","That flute loop is sampled from \"Prison Song\" from the 1970s musical Selma."],
  ["Black Beatles","Rae Sremmurd ft. Gucci Mane",2016,"SremmLife 2","The soundtrack to the Mannequin Challenge, which pushed it to No. 1."],
  ["Thrift Shop","Macklemore & Ryan Lewis ft. Wanz",2012,"The Heist","Hit No. 1 without a major record label behind it."],
  ["Can't Hold Us","Macklemore & Ryan Lewis ft. Ray Dalton",2011,"The Heist","Their second straight No. 1."],
  ["Swimming Pools (Drank)","Kendrick Lamar",2012,"good kid, m.A.A.d city",""],
  ["No Role Modelz","J. Cole",2014,"2014 Forest Hills Drive","The album went platinum with no features, which became a running joke."],
  ["See You Again","Wiz Khalifa ft. Charlie Puth",2015,"Furious 7 soundtrack","Written as a tribute to Paul Walker; spent 12 weeks at No. 1."],
  ["Black and Yellow","Wiz Khalifa",2010,"Rolling Papers","A tribute to Pittsburgh that became a Steelers anthem."],
  ["All of the Lights","Kanye West",2010,"My Beautiful Dark Twisted Fantasy","Features a long list of guests, including Rihanna, Kid Cudi and Elton John."],
  ["Power","Kanye West",2010,"My Beautiful Dark Twisted Fantasy",""],
  ["Super Bass","Nicki Minaj",2011,"Pink Friday","Went viral when Taylor Swift and Selena Gomez rapped it on video."],
  ["Bounce Back","Big Sean",2016,"I Decided",""],
  ["ROCKSTAR","DaBaby ft. Roddy Ricch",2020,"Blame It on Baby","Spent seven weeks at No. 1 in 2020."],
  ["The Box","Roddy Ricch",2019,"Please Excuse Me for Being Antisocial","Spent 11 weeks at No. 1, helped by that \"eee-err\" sound."],
  ["First Class","Jack Harlow",2022,"Come Home the Kids Miss You","Built on Fergie's \"Glamorous\" and debuted at No. 1."],
  ["One Dance","Drake ft. Wizkid & Kyla",2016,"Views","Drake's first No. 1 as a lead artist."],
  ["HIGHEST IN THE ROOM","Travis Scott",2019,"JACKBOYS","Debuted at No. 1."],
  ["Dior","Pop Smoke",2019,"Meet the Woo","Brought Brooklyn drill into the mainstream."],
  ["a lot","21 Savage ft. J. Cole",2018,"i am > i was","Won the Grammy for Best Rap Song."],
  ["Rack City","Tyga",2011,"Careless World",""],
  ["6 Foot 7 Foot","Lil Wayne ft. Cory Gunz",2010,"Tha Carter IV",""],
  ["Dreams and Nightmares (Intro)","Meek Mill",2012,"Dreams and Nightmares","The Philadelphia Eagles played it during their Super Bowl LII run."],
  ["King Kunta","Kendrick Lamar",2015,"To Pimp a Butterfly",""],
  ["Panda","Desiigner",2016,"New English","Went to No. 1 after Kanye sampled it on \"Pt. 2.\""],
  ["Congratulations","Post Malone ft. Quavo",2016,"Stoney",""],
  ["Jumpman","Drake & Future",2015,"What a Time to Be Alive",""],
  ["Godzilla","Eminem ft. Juice WRLD",2020,"Music to Be Murdered By","Eminem's closing verse is one of the fastest ever on a hit song."],
  ["All the Stars","Kendrick Lamar & SZA",2018,"Black Panther: The Album",""],
  ["Trap Queen","Fetty Wap",2014,"Fetty Wap",""],
  ["RAPSTAR","Polo G",2021,"Hall of Fame","Debuted at No. 1."],
  ["INDUSTRY BABY","Lil Nas X & Jack Harlow",2021,"Montero",""],
  ["Savage Remix","Megan Thee Stallion ft. Beyoncé",2020,"Suga","Megan's first No. 1."],
  ["DNA.","Kendrick Lamar",2017,"DAMN.",""],
  ["Antidote","Travis Scott",2015,"Rodeo",""],
  ["Middle Child","J. Cole",2019,"Revenge of the Dreamers III",""],
  ["Drip Too Hard","Lil Baby & Gunna",2018,"Drip Harder",""],
  ["Nonstop","Drake",2018,"Scorpion",""],
  ["Self Care","Mac Miller",2018,"Swimming",""]
].filter(s => s[2] >= 2010 && s[2] <= 2023);
function renderSong(){
  const now = new Date(), day = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(2026,0,1)) / 864e5);
  const s = SONGS[((day % SONGS.length) + SONGS.length) % SONGS.length], q = encodeURIComponent(s[0]+" "+s[1].split(" ft.")[0]);
  $("#songCard").innerHTML = '<div class="disc" aria-hidden="true"></div><div style="min-width:0"><span class="eyebrow">Song of the day</span><h3>'+esc(s[0])+'</h3><div class="meta">'+esc(s[1])+' · '+s[2]+' · '+esc(s[3])+'</div>'+
    (s[4] ? '<p class="fact">'+esc(s[4])+'</p>' : '')+
    '<div class="acts"><a class="small-btn" href="https://open.spotify.com/search/'+q+'" target="_blank" rel="noopener">Spotify ↗</a><a class="small-btn" href="https://music.apple.com/us/search?term='+q+'" target="_blank" rel="noopener">Apple Music ↗</a><a class="small-btn" href="https://www.youtube.com/results?search_query='+q+'" target="_blank" rel="noopener">YouTube ↗</a><a class="small-btn" href="https://genius.com/search?q='+q+'" target="_blank" rel="noopener">Chorus lyrics on Genius ↗</a></div></div>';
}

/* ---------- football sub-tabs ---------- */
function setFbTab(k){
  document.querySelectorAll("[data-fbt]").forEach(b => b.classList.toggle("on", b.dataset.fbt === k));
  $("#fbBills").hidden = k !== "bills"; $("#fbCollege").hidden = k !== "college";
  store.set("bf-fbtab", k);
}
document.addEventListener("click", e => { const b = e.target.closest("[data-fbt]"); if (b) setFbTab(b.dataset.fbt); });

/* ---------- golf v3: daily 3-hole round + practice ----------
   Everything that happens to the ball follows from the player's choices (club, power, timing,
   aim, trajectory, shape) and the hole (wind, lie, elevation, green slope). No hidden dice. */
const GG = (function(){
  const W = 400, H = 500, G = 10.7;            // canvas units; gravity in yd/s^2
  const CLUBS = [
    {k:"Dr", n:"Driver",          carry:250, apex:32, roll:.13, loft:10},
    {k:"3W", n:"3-wood",          carry:225, apex:31, roll:.11, loft:15},
    {k:"5W", n:"5-wood",          carry:210, apex:31, roll:.10, loft:18},
    {k:"4H", n:"4-hybrid",        carry:195, apex:30, roll:.085, loft:21},
    {k:"5i", n:"5-iron",          carry:185, apex:30, roll:.075, loft:24},
    {k:"6i", n:"6-iron",          carry:175, apex:30, roll:.068, loft:27},
    {k:"7i", n:"7-iron",          carry:162, apex:29, roll:.06, loft:31},
    {k:"8i", n:"8-iron",          carry:150, apex:28, roll:.052, loft:35},
    {k:"9i", n:"9-iron",          carry:138, apex:27, roll:.045, loft:39},
    {k:"PW", n:"Pitching wedge",  carry:125, apex:26, roll:.035, loft:44},
    {k:"GW", n:"Gap wedge",       carry:110, apex:25, roll:.026, loft:50},
    {k:"SW", n:"Sand wedge",      carry:95,  apex:24, roll:.016, loft:56},
    {k:"LW", n:"Lob wedge",       carry:75,  apex:23, roll:.01,  loft:60},
    {k:"Pt", n:"Putter",          carry:0,   apex:0,  roll:0,    loft:3}
  ];
  const PUTTER = CLUBS.length - 1;
  const TRAJ = {low:{apex:.62, carry:.96, roll:1.8, wind:.55, label:"Low"}, mid:{apex:1, carry:1, roll:1, wind:1, label:"Normal"}, high:{apex:1.3, carry:.97, roll:.5, wind:1.35, label:"High"}};
  const LIE = {
    tee:    {m:1,   sweet:2.4, err:1,   name:"Tee box"},
    fairway:{m:1,   sweet:2.25,err:1,   name:"Fairway"},
    rough:  {m:.86, sweet:1.6, err:1.35,name:"Rough"},
    sand:   {m:.78, sweet:1.2, err:1.8, name:"Bunker"},
    fringe: {m:.97, sweet:2.25,err:1,   name:"Fringe"},
    green:  {m:1,   sweet:2.25,err:1,   name:"Green"}
  };
  const FRICTION = {green:.65, fringe:1.8, fairway:3.2, rough:7.5, tee:3.2};   // rolling decel, yd/s^2
  const CUP = .065;                                                          // capture radius in yards
  const NAMES = ["Hudson Bend","Cadet Ridge","Thayer's Dogleg","Plain View","Constitution Island","Storm King","Buckner Lake","Lusk Reservoir","Black Knight","Trophy Point","Flirtation Walk","Crow's Nest","Michie Rise","Washington Gate","Bull Pond","Round Pond","Target Hill","Camp Natural Bridge"];

  /* ---------- seeded randomness (holes only, never the shot) ---------- */
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = s => [...s].reduce((a,c) => (Math.imul(a,31) + c.charCodeAt(0)) >>> 0, 7);
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const ss = t => t <= 0 ? 0 : t >= 1 ? 1 : t*t*(3-2*t);
  const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
  const r1 = v => Math.round(v*10)/10;

  function makeHole(rng, par, idx){
    const L = par===3 ? 135+Math.round(rng()*70) : par===4 ? 340+Math.round(rng()*110) : 480+Math.round(rng()*80);
    const dog = par===3 || rng() < .25 ? 0 : (rng()<.5?-1:1) * (18 + rng()*30);
    const d0 = L*(par===5?.5:.45), d1 = L*(par===5?.8:.75);
    const cx = y => dog * ss((y-d0)/(d1-d0));
    const fwBase = 30 + rng()*8, ph = rng()*6;
    const fw = y => fwBase + 5*Math.sin(y/37 + ph);
    const gx = cx(L), gy = L, grx = 13 + rng()*5, gry = 11 + rng()*4;
    const pin = {x: gx + (rng()-.5)*grx*1.1, y: gy + (rng()-.5)*gry*1.1};
    const sl = {px:(rng()-.5)*.036, py:(rng()-.5)*.036, bx: gx + (rng()-.5)*grx, by: gy + (rng()-.5)*gry, A:(rng()-.5)*.36, s: 6 + rng()*3};
    const elev = Math.round((rng()-.5)*(par===3 ? 30 : 22));
    const wind = {dir: rng()*Math.PI*2, mph: Math.round(2 + rng()*18)};
    const bunkers = [], water = [], trees = [];
    const nGs = 1 + (rng() < .6 ? 1 : 0);
    const spots = [-Math.PI/2 - .9, -Math.PI/2 + .9, Math.PI, 0, Math.PI/2].sort(() => rng() - .5);
    for (let i = 0; i < nGs; i++){ const a = spots[i]; bunkers.push({x: gx + Math.cos(a)*(grx+4.5), y: gy + Math.sin(a)*(gry+4.5), rx: 5+rng()*2.5, ry: 3.5+rng()*1.5}); }
    if (par > 3){ const y = 232 + rng()*38, s = rng()<.5?-1:1; bunkers.push({x: cx(y) + s*(fw(y)/2 - 1), y, rx: 6+rng()*2, ry: 4}); }
    if (par === 5){ const y = L - 85 - rng()*25, s = rng()<.5?-1:1; bunkers.push({x: cx(y) + s*(fw(y)/2 - 2), y, rx: 6, ry: 4}); }
    if (par === 3 && rng() < .55) water.push({kind:"pond", x: gx + (rng()-.5)*6, y: gy - gry - 13, rx: grx + 7, ry: 8});
    if (par === 4 && rng() < .55){ const y = L*(.42 + rng()*.2), s = rng()<.5?-1:1; water.push({kind:"pond", x: cx(y) + s*(fw(y)/2 + 15), y, rx: 18+rng()*8, ry: 13+rng()*6}); }
    if (par === 5 && rng() < .6) water.push({kind:"creek", y: L - 105 + rng()*30, w: 7});
    for (let y = 35; y < L - 15; y += 18 + rng()*10){
      for (const s of [-1, 1]) if (rng() < .7){ trees.push({x: cx(y) + s*(fw(y)/2 + 13 + rng()*24), y: y + (rng()-.5)*8, r: 4 + rng()*3, h: 14 + rng()*10}); }
    }
    if (dog){ const s = Math.sign(dog); for (let k = 0; k < 3; k++){ const y = d0 + (d1-d0)*(.05 + k*.12); trees.push({x: cx(y) + s*(fw(y)/2 + 5 + k*2), y, r: 5 + rng()*2, h: 20 + rng()*6}); } }
    for (let k = 0; k < 4; k++) trees.push({x: gx + (k-1.5)*11 + (rng()-.5)*4, y: gy + gry + 16 + rng()*8, r: 5 + rng()*2, h: 18});
    const clearOf = t => !water.some(w => inWater(w, t, 4)) && !bunkers.some(b => inEll(b, t, 3)) && dist(t, pin) > 22;
    const hole = {par, L, dog, cx, fw, gx, gy, grx, gry, pin, sl, elev, wind, bunkers, water, trees: trees.filter(clearOf),
      name: NAMES[Math.floor(rng()*NAMES.length)], tee: {x: 0, y: 0}};
    return hole;
  }
  function inEll(e, p, pad){ pad = pad||0; return ((p.x-e.x)/(e.rx+pad))**2 + ((p.y-e.y)/(e.ry+pad))**2 <= 1; }
  function inWater(w, p, pad){ pad = pad||0; return w.kind === "creek" ? Math.abs(p.y - w.y) < w.w/2 + pad : inEll(w, p, pad); }

  /* ---------- hole geometry helpers (use current hole) ---------- */
  let HL = null;
  const obHalf = y => HL.fw(y)/2 + 55;
  const isOB = p => p.y < -14 || p.y > HL.gy + HL.gry + 32 || Math.abs(p.x - HL.cx(clamp(p.y,0,HL.L))) > obHalf(clamp(p.y,0,HL.L));
  const hAt = p => HL.elev * clamp(p.y / HL.L, 0, 1);
  function lieAt(p){
    if (HL.water.some(w => inWater(w, p))) return "water";
    if (isOB(p)) return "ob";
    if (HL.bunkers.some(b => inEll(b, p))) return "sand";
    if (((p.x-HL.gx)/HL.grx)**2 + ((p.y-HL.gy)/HL.gry)**2 <= 1) return "green";
    if (((p.x-HL.gx)/(HL.grx+2.5))**2 + ((p.y-HL.gy)/(HL.gry+2.5))**2 <= 1) return "fringe";
    if (p.y < 5 && p.y > -5 && Math.abs(p.x) < 6) return "tee";
    const start = HL.par === 3 ? HL.L - HL.gry - 26 : 18;
    if (p.y > start && p.y < HL.gy && Math.abs(p.x - HL.cx(p.y)) < HL.fw(p.y)/2) return "fairway";
    return "rough";
  }
  function grade(p){   // uphill gradient (dh/dx, dh/dy), dimensionless
    const s = HL.sl, dx = p.x - s.bx, dy = p.y - s.by, e = Math.exp(-(dx*dx + dy*dy)/(s.s*s.s)), k = -2*s.A/(s.s*s.s)*e;
    return {x: s.px + k*dx, y: s.py + k*dy};
  }
  const headingTo = (a, b) => Math.atan2(b.x - a.x, b.y - a.y);      // radians, 0 = straight up the hole, + = right
  const dirOf = ang => ({x: Math.sin(ang), y: Math.cos(ang)});
  const rightOf = ang => ({x: Math.cos(ang), y: -Math.sin(ang)});
  const windVec = () => { const d = dirOf(HL.wind.dir); return {x: d.x*HL.wind.mph, y: d.y*HL.wind.mph}; };

  /* ---------- state ---------- */
  const today = key(new Date());
  const st = {mode:"daily", holes:[], hi:0, scores:[], ball:{x:0,y:0}, lie:"tee", strokes:0, putts:0, club:0, traj:"mid", shape:0,
    aim:0, phase:"aim", log:[], trail:[], vis:null, tracer:[], caddie: store.get("bf-golf3-caddie", true), last:null, holeStats:null, practicePar:0};
  let cv, ctx, cam = {x:0, y:0, s:1}, camT = {x:0, y:0, s:1}, frames = null, fi = 0, raf = 0, ambient = 0, tClock = 0;

  function dailyHoles(){
    const rng = mulberry(hash("golf3-" + today));
    const pars = [[4,3,5],[3,5,4],[5,4,3],[4,5,3],[3,4,5]][Math.floor(rng()*5)];
    return pars.map((p, i) => makeHole(rng, p, i));
  }
  function practiceHole(){
    const rng = mulberry((Date.now() ^ Math.floor(Math.random()*1e9)) >>> 0);
    const p = st.practicePar || [3,4,4,5][Math.floor(rng()*4)];
    return makeHole(rng, p, 0);
  }

  /* ---------- shot planning: turns inputs into a full ball path ---------- */
  function playsLike(target, clubIdx, traj){
    // distance the shot "plays" after wind and elevation, using a normal strike
    const c = CLUBS[clubIdx], tr = TRAJ[traj], ang = headingTo(st.ball, target), d = dirOf(ang), wv = windVec();
    const along = wv.x*d.x + wv.y*d.y, apex = (c.apex||28)*tr.apex, hF = apex/30*tr.wind;
    const raw = dist(st.ball, target);
    const windPct = (along >= 0 ? .005 : .01) * along * hF;
    const dh = hAt(target) - hAt(st.ball);
    return {raw, pl: raw / (1 + windPct) + dh, windYds: -raw*windPct, elevYds: dh, along};
  }
  function suggestClub(target){
    const lieM = (LIE[st.lie]||LIE.rough).m;
    const longest = st.lie === "tee" ? 0 : st.lie === "sand" ? 6 : 1;   // no driver off the deck; long clubs are poor from sand
    let best = -1;
    for (let i = 0; i < PUTTER; i++){ const pl = playsLike(target, i, st.traj).pl; if (CLUBS[i].carry * lieM * TRAJ[st.traj].carry >= pl - 3) best = i; }
    if (best < longest) best = longest;
    if (st.lie === "tee" && HL.par > 3) best = 0;
    return best;
  }
  function plan(pow, e, dry){
    const c = CLUBS[st.club], tr = TRAJ[st.traj], L = LIE[st.lie] || LIE.rough, start = {...st.ball};
    const ae = Math.abs(e), sweet = L.sweet;
    let lieM = L.m; if (st.lie === "sand" && c.carry > 170) lieM = .55;
    const solid = clamp(1 - Math.max(0, ae - sweet)*.022, .62, 1);
    const dirErr = (ae <= sweet*.5 ? 0 : Math.sign(e)*Math.min(ae, 14)) * .75 * L.err;   // worst slice/hook ~10° (more from bad lies)
    const heading = headingTo(start, HL.pin) + st.aim*Math.PI/180, ang = heading + dirErr*Math.PI/180;
    const d = dirOf(ang), n = rightOf(ang), wv = windVec();
    const along = wv.x*d.x + wv.y*d.y, cross = wv.x*n.x + wv.y*n.y;
    const base = c.carry * pow;
    let apex = c.apex * tr.apex * Math.pow(pow, .6) * (st.lie === "rough" ? .9 : 1) * (solid < .85 ? .72 : 1);
    let carry = base * lieM * solid * tr.carry * (st.shape > 0 ? .96 : 1);
    const hF = apex/30*tr.wind;
    const windCarry = carry * (along >= 0 ? .005 : .01) * along * hF;
    carry += windCarry;
    const est = {x: start.x + d.x*carry, y: start.y + d.y*carry};
    const elevYds = -(hAt(est) - hAt(start));
    carry = Math.max(5, carry + elevYds);
    const T = Math.max(1.2, 2*Math.sqrt(2*apex/G)*1.15);
    const drift = cross * .19 * T * tr.wind * Math.sqrt(apex/30);
    const curve = st.shape * carry * .065 * (st.lie === "sand" ? .5 : 1);
    const B = {club: c, pow, base, lieM, lieName: L.name, solid, e, ae, sweet, dirErr, windCarry, elevYds, drift, curve, carry, apex, along, cross};
    if (dry) return {land: {x: est.x + d.x*elevYds + n.x*(curve+drift), y: est.y + d.y*elevYds + n.y*(curve+drift)}, B};
    // flight frames
    const out = [], N = Math.max(30, Math.round(T*60/1.8));
    let hitTree = null, prev = start;
    for (let i = 1; i <= N; i++){
      const u = i/N, s = carry*(1 - Math.pow(1-u, 1.35)), lat = curve*u*u + drift*Math.pow(u, 1.6);
      const p = {x: start.x + d.x*s + n.x*lat, y: start.y + d.y*s + n.y*lat, z: apex*Math.sin(Math.PI*Math.pow(u, .82))};
      const tr2 = i > 3 && HL.trees.find(t => Math.hypot(p.x-t.x, p.y-t.y) < t.r && p.z < t.h);
      if (tr2){ hitTree = tr2; const back = {x: p.x - d.x*1.5, y: p.y - d.y*1.5}; for (let k = 1; k <= 14; k++) out.push({x: back.x, y: back.y, z: p.z*(1-k/14), ph:"fall"}); break; }
      out.push({...p, ph:"fly"}); prev = p;
    }
    const lastF = out[out.length-1], land = {x: lastF.x, y: lastF.y};
    B.landing = {...land}; B.tree = !!hitTree;
    const pre = out.length > 2 ? out[out.length-3] : start;
    let rdir = Math.atan2(land.x - pre.x, land.y - pre.y);
    // landing in the cup on the fly
    if (!hitTree && lieAt(land) === "green" && dist(land, HL.pin) < CUP*.8){ B.rollYds = 0; return {frames: out, end: {...HL.pin}, result:"holed", B}; }
    const surf = lieAt(land);
    if (surf === "water" || surf === "ob" || surf === "sand" || hitTree){ B.rollYds = 0; return {frames: out, end: land, result: surf === "water" ? "water" : surf === "ob" ? "ob" : "rest", B}; }
    // roll distance from club, trajectory, surface, wind; wedges into greens can spin back
    let R = carry * c.roll * tr.roll * ({green:.55, fringe:.6, fairway:1, rough:.3, tee:1}[surf] || .3) + Math.max(0, along)*.05;
    if (surf === "green" && c.loft >= 50 && pow > .85 && st.traj !== "low" && solid > .92){ R = -(1 + (c.loft-50)*.25); }
    const fr = FRICTION[surf] || 3;
    let v0 = Math.sqrt(2*fr*Math.abs(R));
    if (R < 0) rdir += Math.PI;
    const rolled = roll(land, {x: Math.sin(rdir)*v0, y: Math.cos(rdir)*v0}, apex*.06);
    rolled.frames.forEach(f => out.push(f));
    B.rollYds = dist(land, rolled.end) * (R < 0 ? -1 : 1);
    B.lip = rolled.lip;
    return {frames: out, end: rolled.end, result: rolled.result, B};
  }
  // rolling physics: friction against motion, gravity down the green's slope, cup capture
  function roll(p0, v, bounce){
    const frames = [], dt = 1/60; let p = {...p0}, lip = false, t = 0;
    for (let step = 0; step < 60*25; step++){
      const surf = lieAt(p);
      if (surf === "water") return {frames, end: p, result: "water", lip};
      if (surf === "ob") return {frames, end: p, result: "ob", lip};
      if (surf === "sand") return {frames, end: p, result: "rest", lip};
      const sp = Math.hypot(v.x, v.y), fr = FRICTION[surf] || 3, g = (surf === "green" || surf === "fringe") ? grade(p) : {x:0, y:0};
      const gm = Math.hypot(g.x, g.y);
      if (sp < .03 && gm < .06){ break; }
      const ax = (sp > 1e-6 ? -fr*v.x/sp : 0) - 7.66*g.x, ay = (sp > 1e-6 ? -fr*v.y/sp : 0) - 7.66*g.y;
      const nv = {x: v.x + ax*dt, y: v.y + ay*dt};
      if (sp > 1e-6 && (nv.x*v.x + nv.y*v.y) < 0 && gm < .06){ break; }   // friction stops it, it can't reverse on its own
      const np = {x: p.x + nv.x*dt, y: p.y + nv.y*dt};
      // cup: closest approach on this step
      const sx = np.x - p.x, sy = np.y - p.y, L2 = sx*sx + sy*sy || 1e-9;
      const k = clamp(((HL.pin.x - p.x)*sx + (HL.pin.y - p.y)*sy)/L2, 0, 1);
      const cd = Math.hypot(p.x + sx*k - HL.pin.x, p.y + sy*k - HL.pin.y), spd = Math.hypot(nv.x, nv.y);
      if (cd < CUP && (spd < 1.45 || (spd < 2 && cd < CUP*.45))){ frames.push({x: HL.pin.x, y: HL.pin.y, z: 0, ph: "cup"}); return {frames, end: {...HL.pin}, result: "holed", lip}; }
      if (cd < CUP) lip = true;
      p = np; v = nv; t += dt;
      const z = t < .5 ? bounce * Math.abs(Math.sin(t*Math.PI*3)) * (1 - t/.5) : 0;
      if (step % 2 === 0) frames.push({x: p.x, y: p.y, z, ph: "roll"});
    }
    frames.push({x: p.x, y: p.y, z: 0, ph: "roll"});
    return {frames, end: p, result: "rest", lip};
  }
  function planPutt(pow, e){
    const c = CLUBS[PUTTER], start = {...st.ball}, L = LIE[st.lie] || LIE.green;
    const ae = Math.abs(e), dirErr = (ae <= L.sweet*.5 ? 0 : Math.sign(e)*Math.min(ae, 14)) * .15;
    const ang = headingTo(start, HL.pin) + (st.aim + dirErr)*Math.PI/180;
    const flat = pow * puttMax() * Math.max(.85, 1 - Math.max(0, ae - L.sweet)*.01);
    const fr = FRICTION[lieAt(start)] || FRICTION.green;
    const v0 = Math.sqrt(2*FRICTION.green*flat);
    const r = roll(start, {x: Math.sin(ang)*v0, y: Math.cos(ang)*v0}, 0);
    const B = {club: c, pow, e, ae, sweet: L.sweet, dirErr, flat, putt: true, fr};
    return {frames: r.frames, end: r.end, result: r.result, B: {...B, lip: r.lip}};
  }
  const puttMax = () => { const ft = dist(st.ball, HL.pin)*3; return Math.max(15, Math.ceil(ft*1.6/5)*5)/3; };   // yards
  const putting = () => st.club === PUTTER;

  /* ---------- swing meter ---------- */
  const MIN = -10, MAX = 100, IMPACT = 6;
  const mt = {phase:"idle", p:IMPACT, pow:0, raf:0, t0:0};
  const pct = v => ((v - MIN) / (MAX - MIN) * 100) + "%";
  const meterSpeed = () => putting() ? .08 : .08 + .045*(CLUBS[st.club].carry/250);
  function puttNeed(){ return clamp((dist(st.ball, HL.pin)*3 + 1.5) / (puttMax()*3), 0, 1); }
  function prevPow(){ if (mt.phase === "up") return Math.max(.05, mt.p/100); if (mt.phase === "down") return mt.pow; return putting() ? puttNeed() : 1; }
  function paintMeter(){
    $("#ggNeedle").style.left = pct(mt.p);
    const f = $("#ggFill"); f.style.left = pct(0); f.style.width = (mt.phase==="up" ? Math.max(0,mt.p) : mt.phase==="down" ? mt.pow*100 : 0) / (MAX-MIN) * 100 + "%";
    const pm = $("#ggPMark"); pm.hidden = mt.phase !== "down"; pm.style.left = pct(mt.pow*100);
    const tg = $("#ggTarget"); tg.hidden = !putting() || !st.caddie || st.phase !== "aim"; tg.style.left = pct(puttNeed()*100);
    const sw = (LIE[st.lie]||LIE.rough).sweet, sweet = $("#ggSweet");
    sweet.style.left = pct(IMPACT - sw); sweet.style.width = (2*sw)/(MAX-MIN)*100 + "%";
    const pv = mt.phase==="up" ? Math.max(0,mt.p)/100 : mt.phase==="down" ? mt.pow : null;
    $("#ggPowVal").textContent = pv === null ? (putting() ? "stroke length" : "ready") : putting() ? Math.round(pv*puttMax()*3)+" ft flat" : Math.round(pv*100)+"% · "+Math.round(CLUBS[st.club].carry*pv)+" yds";
    $("#ggTicks").innerHTML = putting() ? [0,.25,.5,.75,1].map(t => '<span style="left:'+pct(t*100)+'">'+Math.round(t*puttMax()*3)+'ft</span>').join("") : [0,.5,.75,1].map(t => '<span style="left:'+pct(t*100)+'">'+Math.round(t*100)+'%</span>').join("");
    $("#ggSwing").textContent = st.phase === "holed" ? (st.mode==="daily" && st.hi < 2 ? "Next hole" : st.mode==="daily" ? "Round done" : "New hole") : mt.phase==="idle" ? (putting() ? "Putt" : "Swing") : mt.phase==="up" ? "Set power" : "Strike";
  }
  function meterLoop(ts){
    if (!mt.t0) mt.t0 = ts; const dt = Math.min(50, ts - mt.t0); mt.t0 = ts;
    if (mt.phase === "up"){ mt.p += dt*meterSpeed(); if (mt.p >= MAX){ mt.p = MAX; mt.pow = 1; mt.phase = "down"; } }
    else if (mt.phase === "down"){ mt.p -= dt*meterSpeed()*1.3; if (mt.p <= MIN){ mt.p = MIN; return strike(MIN - IMPACT); } }
    paintMeter(); mt.raf = requestAnimationFrame(meterLoop);
  }
  function meterTap(){
    if (st.phase === "holed"){ return advance(); }
    if (st.phase !== "aim") return;
    if (mt.phase === "idle"){ mt.phase = "up"; mt.p = 0; mt.t0 = 0; cancelAnimationFrame(mt.raf); mt.raf = requestAnimationFrame(meterLoop); say("Backswing… tap to set "+(putting() ? "stroke length." : "power.")); }
    else if (mt.phase === "up"){ mt.pow = Math.max(.02, mt.p/100); mt.phase = "down"; say("Now strike it in the green zone."); }
    else if (mt.phase === "down") strike(mt.p - IMPACT);
  }
  function strikeWord(e, sweet){ const a = Math.abs(e); return a <= sweet*.5 ? "Pure strike" : a <= sweet ? "Good contact" : a <= 6 ? (e>0?"A touch early":"A touch late") : (e>0?"Way early":"Way late"); }
  function strike(e){
    cancelAnimationFrame(mt.raf); const pow = mt.pow; mt.phase = "idle"; mt.p = IMPACT;
    const shot = putting() ? planPutt(pow, e) : plan(pow, e);
    shot.word = strikeWord(e, (LIE[st.lie]||LIE.rough).sweet);
    shot.from = {...st.ball}; shot.fromLie = st.lie; shot.clubIdx = st.club;
    st.strokes++; if (st.lie === "green" && putting()) st.putts++;
    st.phase = "flight"; frames = shot.frames; fi = 0; st.tracer = [{...st.ball}]; st.cur = shot;
    paintMeter(); paintScore(); say(shot.word + "…");
    cancelAnimationFrame(raf); raf = requestAnimationFrame(animate);
  }

  /* ---------- animation ---------- */
  function animate(){
    if (!frames) return;
    const f = frames[Math.min(fi, frames.length-1)];
    st.vis = f; if (f.ph === "fly" || f.ph === "fall") st.tracer.push({x: f.x, y: f.y});
    fi += 1;
    tClock += 1/60; updateCam(true); draw();
    if (fi < frames.length) raf = requestAnimationFrame(animate);
    else { frames = null; st.vis = null; settle(st.cur); }
  }
  function settle(shot){
    const B = shot.B, prevBall = shot.from, holedBefore = false;
    let note = "", penalty = 0;
    if (shot.result === "water"){
      penalty = 1; st.strokes++;
      const path = shot.frames.filter(f => lieAt(f) !== "water"); let drop = path.length ? path[path.length-1] : prevBall;
      const w = HL.water.find(w2 => inWater(w2, drop, 2)); if (w){ const away = w.kind === "creek" ? {x: drop.x, y: w.y - w.w/2 - 3} : drop; drop = away; }
      st.ball = {x: drop.x, y: drop.y}; st.lie = lieAt(st.ball); if (st.lie === "water" || st.lie === "ob") { st.ball = {...prevBall}; st.lie = shot.fromLie; }
      note = "Splash. One-stroke penalty, dropped where it crossed the hazard.";
    } else if (shot.result === "ob"){
      penalty = 1; st.strokes++; st.ball = {...prevBall}; st.lie = shot.fromLie;
      note = "Out of bounds. Stroke and distance: hitting again from the same spot.";
    } else if (shot.result === "holed"){
      st.ball = {...HL.pin}; st.lie = "green";
    } else { st.ball = {x: shot.end.x, y: shot.end.y}; st.lie = lieAt(st.ball); }
    st.trail.push({from: prevBall, to: shot.result === "ob" ? shot.end : {...st.ball}, putt: !!B.putt});
    // stats for the hole
    const hs = st.holeStats;
    if (shot.fromLie === "tee" && HL.par > 3 && !hs.firDone){ hs.firDone = true; hs.fir = shot.result === "rest" && lieAt(shot.end) === "fairway"; }
    if (!hs.gir && (st.lie === "green" || shot.result === "holed") && st.strokes <= HL.par - 2 + (shot.result === "holed" ? 1 : 0)) hs.gir = true;
    if (!B.putt){ hs.strikes.push(B.ae); }
    hs.penalties += penalty;
    st.log.push({club: CLUBS[shot.clubIdx].k, word: shot.word, result: shot.result, left: shot.result === "holed" ? 0 : dist(st.ball, HL.pin), lie: st.lie, penalty, putt: !!B.putt});
    const card = breakdown(shot, note);
    st.last = card;
    if (shot.result === "holed") return holed(shot.word);
    if (st.strokes >= HL.par + 5){ st.strokes = HL.par + 5; paintScore(); return holed("Picked up at the max of par + 5", true); }
    st.club = st.lie === "green" ? PUTTER : suggestClub(HL.pin); st.aim = 0; syncAim();
    st.phase = "aim"; paintClubs(); paintLie(); paintMeter(); paintScore(); paintLog(); updateCam(false); draw();
    say(card.headline);
    paintCaddie();
  }

  /* ---------- the caddie: explain what happened and why ---------- */
  function breakdown(shot, note){
    const B = shot.B, rows = [], left = dist(st.ball, HL.pin), on = st.lie;
    const yd = v => (v >= 0 ? "+" : "−") + Math.abs(Math.round(v)) + " yds";
    let headline = shot.word + ". ", tip = "";
    if (B.putt){
      const ft = left*3;
      rows.push(["Stroke", Math.round(B.pow*100)+"% of a "+Math.round(puttMax()*3)+" ft stroke = "+r1(B.flat*3)+" ft on a flat green"]);
      rows.push(["Strike", B.ae <= B.sweet*.5 ? "Pure, started on your line" : (B.dirErr>0?"Early, pushed ":"Late, pulled ")+Math.abs(r1(B.dirErr))+"° "+(B.dirErr>0?"right":"left")]);
      if (shot.result === "holed"){ headline += "Drained it."; tip = "Good read. Note how much break you played so you can repeat it."; }
      else {
        const s = shot.from, need = dist(s, HL.pin), g = grade({x:(s.x+HL.pin.x)/2, y:(s.y+HL.pin.y)/2}), ang = headingTo(s, HL.pin), d = dirOf(ang), n = rightOf(ang);
        const upPct = (g.x*d.x + g.y*d.y)*100, sidePct = (g.x*n.x + g.y*n.y)*100;
        rows.push(["Green", (Math.abs(upPct) < .3 ? "flat" : upPct > 0 ? "uphill "+r1(upPct)+"%" : "downhill "+r1(-upPct)+"%")+", "+(Math.abs(sidePct) < .3 ? "no side slope" : "falls "+(sidePct > 0 ? "left" : "right")+" "+r1(Math.abs(sidePct))+"%")]);
        const longBy = (dist(s, shot.end) - need)*3;
        headline += B.lip ? "Lipped out! " : "";
        headline += (longBy > 0 ? "Ran it "+Math.round(longBy)+" ft by" : "Left it "+Math.round(-longBy)+" ft short")+". "+Math.round(ft)+" ft to go.";
        tip = Math.abs(sidePct) > .5 ? "Side slope pulls the ball "+(sidePct > 0 ? "left" : "right")+": aim more to the "+(sidePct > 0 ? "right" : "left")+" and let it fall in." : longBy < -1 ? "Uphill putts need a longer stroke than the distance." : "Downhill putts need less stroke than the distance; aim to stop it 1–2 ft past.";
        if (B.lip) tip = "It caught the cup going too fast. Firm putts only drop if they hit the center.";
      }
      return {headline, rows, tip};
    }
    rows.push(["Club", B.club.n+" at "+Math.round(B.pow*100)+"% = "+Math.round(B.base)+" yds"]);
    if (B.lieM < 1) rows.push(["Lie", B.lieName+": "+yd(-(1-B.lieM)*B.base)]);
    rows.push(["Strike", B.ae <= B.sweet*.5 ? "Pure, no curve from contact" : (B.ae <= B.sweet ? "Solid. " : "Off-center, lost "+Math.round((1-B.solid)*100)+"%. ")+(Math.abs(B.dirErr) >= .5 ? (B.dirErr>0?"Early, pushed ":"Late, pulled ")+Math.abs(r1(B.dirErr))+"° "+(B.dirErr>0?"right":"left") : "")]);
    if (Math.abs(B.windCarry) >= 1) rows.push(["Wind", (B.along < 0 ? "Into " : "Helping ")+Math.round(Math.abs(B.along))+" mph: "+yd(B.windCarry)]);
    if (Math.abs(B.drift) >= 1) rows.push(["Crosswind", "moved it "+Math.abs(Math.round(B.drift))+" yds "+(B.drift > 0 ? "right" : "left")]);
    if (Math.abs(B.elevYds) >= 1) rows.push(["Elevation", (B.elevYds < 0 ? "Uphill: " : "Downhill: ")+yd(B.elevYds)]);
    if (Math.abs(B.curve) >= 1) rows.push(["Shape", (B.curve < 0 ? "Draw curved " : "Fade curved ")+Math.abs(Math.round(B.curve))+" yds "+(B.curve < 0 ? "left" : "right")]);
    rows.push(["Result", B.tree ? "Hit a tree and dropped" : "Carry "+Math.round(dist(shot.from, B.landing))+" yds, roll "+(B.rollYds < 0 ? "spun back "+Math.abs(Math.round(B.rollYds)) : Math.round(B.rollYds))+" yds"]);
    if (note) headline += note + " ";
    else if (shot.result === "holed") headline += "It went in!";
    else headline += ({green:"On the green, "+Math.round(left*3)+" ft away.", fringe:"On the fringe, "+Math.round(left*3)+" ft.", fairway:"Fairway, "+Math.round(left)+" yds left.", rough:"Rough, "+Math.round(left)+" yds left.", sand:"Bunker, "+Math.round(left)+" yds left.", tee:"", water:"", ob:""}[on] || "");
    // biggest lesson first
    const issues = [
      [Math.abs(B.dirErr)*dist(shot.from, B.landing)*.0175, "Your timing sent it "+(B.dirErr>0?"right":"left")+". Strike when the needle is inside the green zone; the zone shrinks in rough and sand."],
      [Math.abs(B.windCarry), B.windCarry < 0 ? "Into the wind costs about 1% per mph on a normal shot. Club up, or hit it Low to cut the wind's effect." : "A helping wind adds about 0.5% per mph. Club down or the ball flies long."],
      [Math.abs(B.drift), "The crosswind moved it "+Math.abs(Math.round(B.drift))+" yds. Aim into the wind, or shape the shot against it."],
      [Math.abs(B.elevYds), "Elevation changes how far it plays: about 1 yd per yd of rise or drop."],
      [B.lieM < 1 ? (1-B.lieM)*B.base : 0, "From the "+B.lieName.toLowerCase()+" the ball comes out short. Take more club."],
      [B.tree ? 99 : 0, "Trees stop low shots. Hit it High to go over, Low to go under branches, or shape it around."]
    ].sort((a,b) => b[0]-a[0]);
    tip = issues[0][0] >= 3 ? issues[0][1] : "Good process. Check the plays-like number before every shot.";
    if (shot.result === "rest" && on === "green" && B.rollYds < 0) tip = "That's backspin: full, high wedges stop fast and can spin back on greens.";
    return {headline: headline.trim(), rows, tip};
  }

  /* ---------- hole flow ---------- */
  function startHole(i){
    if (st.mode === "daily"){ st.hi = i; HL = st.holes[i]; } else HL = st.holes[0];
    st.ball = {...HL.tee}; st.lie = "tee"; st.strokes = 0; st.putts = 0; st.trail = []; st.log = []; st.tracer = []; st.last = null; st.vis = null;
    st.holeStats = {fir:false, firDone: HL.par === 3, gir:false, strikes:[], penalties:0};
    st.traj = "mid"; st.shape = 0; st.aim = 0; st.phase = "aim";
    st.club = suggestClub(HL.pin);
    document.querySelectorAll("[data-traj]").forEach(b => b.classList.toggle("on", b.dataset.traj === st.traj));
    document.querySelectorAll("[data-shape]").forEach(b => b.classList.toggle("on", +b.dataset.shape === st.shape));
    cancelAnimationFrame(mt.raf); mt.phase = "idle"; mt.p = IMPACT;
    syncAim(); paintHead(); paintClubs(); paintLie(); paintMeter(); paintScore(); paintLog(); paintCard();
    updateCam(false); cam = {...camT}; draw();
    say((st.mode === "daily" ? "Hole "+(i+1)+" of 3" : "Practice hole")+": par "+HL.par+", "+HL.L+" yds. Check the wind and pick your club.");
    paintCaddie();
  }
  function holed(word, pickup){
    st.phase = "holed"; cancelAnimationFrame(mt.raf); mt.phase = "idle";
    const sc = st.strokes, d = sc - HL.par;
    st.scores[st.mode === "daily" ? st.hi : 0] = {s: sc, p: HL.par, putts: st.putts};
    recordHole(sc, pickup);
    const name = sc === 1 ? "Hole in one" : d <= -3 ? "Albatross" : d === -2 ? "Eagle" : d === -1 ? "Birdie" : d === 0 ? "Par" : d === 1 ? "Bogey" : d === 2 ? "Double bogey" : "+"+d;
    let extra = "";
    if (st.mode === "daily" && st.hi === 2){
      const tot = st.scores.reduce((a,x) => a + (x ? x.s : 0), 0), par = st.scores.reduce((a,x) => a + (x ? x.p : 0), 0);
      const prev = store.get("bf-golf3-"+today, null);
      if (!prev || tot < prev.s) store.set("bf-golf3-"+today, {s: tot, p: par, caddie: st.caddie});
      const S = stats(); S.rounds++; if (S.best === null || tot - par < S.best) S.best = tot - par; saveStats(S);
      extra = " Round finished: "+tot+" ("+fmtTo(tot-par)+"). New course tomorrow.";
      renderWeek();
    } else if (st.mode === "daily") extra = " Tap Next hole when you're ready.";
    else extra = " Tap New hole to play another.";
    paintScore(); paintMeter(); paintLog(); paintCard(); renderStats(); draw();
    say((word ? word+". " : "")+"<b>"+name+"!</b> "+sc+" stroke"+(sc>1?"s":"")+", "+st.putts+" putt"+(st.putts===1?"":"s")+"."+extra);
    paintCaddie();
  }
  function advance(){
    if (st.mode === "daily"){ if (st.hi < 2) startHole(st.hi+1); else say("That's today's round. Replay it, or try Practice."); }
    else { st.holes = [practiceHole()]; startHole(0); }
  }
  const fmtTo = v => v === 0 ? "E" : (v > 0 ? "+" : "")+v;

  /* ---------- lifetime stats (this browser) ---------- */
  function stats(){ return store.get("bf-golf3-stats", null) || {holes:0, toPar:0, fir:0, firN:0, gir:0, putts:0, strikes:0, strikeN:0, pure:0, pens:0, rounds:0, best:null, birdies:0}; }
  function saveStats(S){ store.set("bf-golf3-stats", S); }
  function recordHole(sc, pickup){
    const S = stats(), hs = st.holeStats;
    S.holes++; S.toPar += sc - HL.par; if (HL.par > 3){ S.firN++; if (hs.fir) S.fir++; }
    if (hs.gir) S.gir++; S.putts += st.putts; S.pens += hs.penalties; if (sc < HL.par) S.birdies++;
    hs.strikes.forEach(a => { S.strikes += a; S.strikeN++; if (a <= 1.2) S.pure++; });
    saveStats(S); renderStats();
  }
  function renderStats(){
    const S = stats(), pc = (a,b) => b ? Math.round(a/b*100)+"%" : "–";
    $("#ggStats").innerHTML = [
      ["Holes", S.holes], ["Avg to par", S.holes ? fmtTo(r1(S.toPar/S.holes)) : "–"], ["Fairways", pc(S.fir, S.firN)], ["Greens in reg.", pc(S.gir, S.holes)],
      ["Putts / hole", S.holes ? r1(S.putts/S.holes) : "–"], ["Pure strikes", pc(S.pure, S.strikeN)], ["Birdies or better", S.birdies], ["Best round", S.best === null ? "–" : fmtTo(S.best)]
    ].map(x => '<div><small>'+x[0]+'</small><b>'+x[1]+'</b></div>').join("");
  }
  function getDay(k){ return store.get("bf-golf3-"+k, null) || store.get("bf-golf2-"+k, null); }
  function renderWeek(){
    let tot = 0, played = 0, html = "";
    for (let i = 6; i >= 0; i--){
      const d = new Date(); d.setDate(d.getDate()-i); const v = getDay(key(d));
      if (v){ tot += v.s - v.p; played++; }
      const diff = v ? v.s - v.p : null;
      html += '<div class="'+(diff===null?'':diff<0?'under':diff>0?'over':'')+'"><small>'+DOW[d.getDay()]+'</small><b>'+(diff===null?'–':fmtTo(diff))+'</b></div>';
    }
    $("#ggWeek").innerHTML = html;
    $("#ggStreak").textContent = played ? played+" played · "+fmtTo(tot) : "Play today's round";
  }

  /* ---------- panel painting ---------- */
  function say(h){ $("#ggMsg").innerHTML = h; }
  function paintHead(){
    const comp = ["N","NE","E","SE","S","SW","W","NW"][Math.round((((HL.wind.dir % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI)) / (Math.PI/4)) % 8];
    $("#ggTitle").textContent = HL.name;
    $("#ggMeta").textContent = (st.mode === "daily" ? "Hole "+(st.hi+1)+" of 3 · " : "Practice · ")+"Par "+HL.par+" · "+HL.L+" yds"+(HL.dog > 0 ? " · doglegs right" : HL.dog < 0 ? " · doglegs left" : "")+(HL.water.length ? " · water" : "");
    $("#ggWind").innerHTML = '<svg viewBox="0 0 24 24" style="transform:rotate('+((HL.wind.dir*180/Math.PI) - 90)+'deg)"><path d="M4 12h15M14 7l5 5-5 5"/></svg> Wind <b>'+HL.wind.mph+' mph</b> toward '+comp+(HL.elev ? ' · green '+Math.abs(HL.elev)+' yds '+(HL.elev > 0 ? 'uphill' : 'downhill') : ' · flat');
  }
  function paintScore(){
    $("#ggStrokes").textContent = st.strokes; $("#ggPar").textContent = HL.par;
    const done = st.scores.filter(Boolean), tot = done.reduce((a,x) => a + x.s - x.p, 0);
    $("#ggTot").textContent = st.mode === "daily" ? fmtTo(tot + (st.phase === "holed" ? 0 : 0)) : "—";
    const best = getDay(today); $("#ggBest").textContent = best ? fmtTo(best.s - best.p) : "—";
  }
  function paintCard(){
    if (st.mode !== "daily"){ $("#ggCard").innerHTML = ""; return; }
    const cells = st.holes.map((h, i) => { const s = st.scores[i]; const d = s ? s.s - s.p : null;
      return '<div class="'+(i===st.hi?'cur ':'')+(d===null?'':d<0?'under':d>0?'over':'')+'"><small>H'+(i+1)+' · P'+h.par+'</small><b>'+(s ? s.s : i===st.hi ? st.strokes||"·" : "–")+'</b></div>'; }).join("");
    $("#ggCard").innerHTML = cells;
  }
  function paintClubs(){
    const lieM = (LIE[st.lie]||LIE.rough).m;
    $("#ggClubs").innerHTML = CLUBS.map((c,i) => '<button type="button" data-club="'+i+'" class="'+(i===st.club?'on':'')+'"'+(st.lie==="green" && i!==PUTTER ? ' disabled' : '')+' title="'+c.n+'">'+c.k+'<small>'+(c.carry ? Math.round(c.carry*lieM*TRAJ[st.traj].carry) : "putt")+'</small></button>').join("");
  }
  function paintLie(){
    const L = LIE[st.lie] || LIE.rough;
    $("#ggLie").innerHTML = '<span class="gg-pill lie-'+st.lie+'">'+L.name+'</span>'+(st.lie === "rough" ? ' −14% distance, smaller sweet spot' : st.lie === "sand" ? ' −22% distance (long clubs much worse), tiny sweet spot' : st.lie === "fringe" ? ' putter or chip' : st.lie === "green" ? ' read the slope arrows' : '');
  }
  function paintLog(){
    $("#ggLog").innerHTML = st.log.length ? st.log.map((l, i) => '<li><b>'+(i+1)+'</b><span>'+l.club+' · '+l.word+(l.penalty ? ' · penalty' : '')+'</span><em>'+(l.result === "holed" ? "in" : l.lie === "green" ? Math.round(l.left*3)+" ft" : Math.round(l.left)+" yds")+'</em></li>').join("") : '<li class="empty">No shots yet on this hole.</li>';
  }
  function paintCaddie(){
    const box = $("#ggCaddie");
    let html = "";
    if (st.last){
      html += '<div class="cd-sec"><span class="eyebrow">Last shot</span><dl>'+st.last.rows.map(r => '<dt>'+r[0]+'</dt><dd>'+r[1]+'</dd>').join("")+'</dl><p class="cd-tip">'+st.last.tip+'</p></div>';
    }
    if (st.phase === "aim"){
      if (putting()){
        const s = st.ball, g = grade({x:(s.x+HL.pin.x)/2, y:(s.y+HL.pin.y)/2}), ang = headingTo(s, HL.pin), d = dirOf(ang), n = rightOf(ang);
        const up = (g.x*d.x + g.y*d.y)*100, side = (g.x*n.x + g.y*n.y)*100;
        html += '<div class="cd-sec"><span class="eyebrow">Read</span><p>'+Math.round(dist(s, HL.pin)*3)+' ft. '+(st.caddie ? (Math.abs(up) < .3 ? 'Flat' : up > 0 ? 'Uphill '+r1(up)+'%' : 'Downhill '+r1(-up)+'%')+', '+(Math.abs(side) < .3 ? 'little side slope.' : 'falls '+(side>0?'left':'right')+' '+r1(Math.abs(side))+'%. Start it '+(side>0?'right':'left')+' of the hole.')+' The orange mark on the meter is the length for a flat putt.' : 'Caddie off: read the arrows yourself.')+'</p></div>';
      } else if (st.caddie){
        const P = playsLike(HL.pin, st.club, st.traj), sug = suggestClub(HL.pin);
        html += '<div class="cd-sec"><span class="eyebrow">Caddie</span><p><b>'+Math.round(P.raw)+' yds</b> to the pin, plays like <b>'+Math.round(P.pl)+'</b>'+(Math.abs(P.windYds) >= 1 ? ' (wind '+(P.windYds>0?'+':'−')+Math.abs(Math.round(P.windYds))+')' : '')+(Math.abs(P.elevYds) >= 1 ? ' (elevation '+(P.elevYds>0?'+':'−')+Math.abs(Math.round(P.elevYds))+')' : '')+'. Suggested: <b>'+CLUBS[sug].n+'</b>. The ghost circle shows a pure strike with your settings.</p></div>';
      } else html += '<div class="cd-sec"><span class="eyebrow">Caddie off</span><p>'+Math.round(dist(st.ball, HL.pin))+' yds to the pin. You judge wind and elevation yourself.</p></div>';
    }
    box.innerHTML = html;
  }
  function syncAim(){
    const a = $("#ggAim"); const p = putting();
    a.min = p ? -20 : -60; a.max = p ? 20 : 60; a.step = p ? .5 : 1; a.value = st.aim;
    $("#ggAimVal").textContent = (st.aim > 0 ? "+" : "")+st.aim+"° "+(st.aim === 0 ? "at pin" : st.aim > 0 ? "right" : "left");
  }

  /* ---------- camera ---------- */
  function boxCam(pts, minS, maxS, pad){
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    const s = clamp(Math.min(W/(x1-x0+pad*2), H/(y1-y0+pad*2)), minS, maxS);
    return {x: (x0+x1)/2, y: (y0+y1)/2, s};
  }
  function previewLand(){
    if (putting()) return null;
    return plan(prevPow(), 0, true).land;
  }
  function updateCam(lerp){
    let t;
    const near = dist(st.ball, HL.pin) < 32 || st.lie === "green" || st.lie === "fringe";
    if (st.phase === "flight" && st.vis){
      const sh = st.cur, end = sh.end;
      t = (sh.B.putt || near) ? boxCam([sh.from, end, HL.pin], 6, 40, 6) : boxCam([sh.from, st.vis, end], .7, 8, 30);
    } else if (near){
      t = boxCam([st.ball, HL.pin, {x: HL.gx - HL.grx - 3, y: HL.gy}, {x: HL.gx + HL.grx + 3, y: HL.gy}, {x: HL.gx, y: HL.gy - HL.gry - 3}, {x: HL.gx, y: HL.gy + HL.gry + 3}], 6, 40, 4);
    } else {
      const pl = previewLand(); const pts = [st.ball, HL.pin, {x: HL.gx, y: HL.gy + HL.gry}]; if (pl) pts.push(pl);
      t = boxCam(pts, .7, 8, 28);
    }
    camT = t;
    if (!lerp){ cam = {...t}; return; }
    cam.x += (t.x - cam.x)*.12; cam.y += (t.y - cam.y)*.12; cam.s += (t.s - cam.s)*.12;
  }
  const SX = p => W/2 + (p.x - cam.x)*cam.s, SY = p => H/2 - (p.y - cam.y)*cam.s;

  /* ---------- drawing ---------- */
  function pal(){
    const dark = curTheme() === "dark";
    return dark ? {out:"#0c1a10", rough:"#173a20", roughL:"#1b4325", fw:"#2c6b38", fwL:"#327740", tee:"#3a8246", fringe:"#3d8a48", green:"#4aa357", greenL:"#52ad5f", sand:"#b9a46f", sandD:"#8f7c4f", water:"#1f5a87", waterL:"#2c6fa3", tree:"#0e3018", treeL:"#1c4f2a", shadow:"rgba(0,0,0,.35)", ob:"rgba(255,255,255,.7)", text:"rgba(255,255,255,.92)", sub:"rgba(255,255,255,.65)", line:"rgba(255,255,255,.75)", arrow:"rgba(255,255,255,", hud:"rgba(10,14,11,.62)"}
                : {out:"#8db27c", rough:"#a9cf92", roughL:"#b3d79c", fw:"#7cc464", fwL:"#86cd6e", tee:"#92d67a", fringe:"#8fd476", green:"#9ee283", greenL:"#a8e88e", sand:"#efdfae", sandD:"#d6c288", water:"#6fb0e0", waterL:"#86c0ea", tree:"#2f7a3c", treeL:"#4a9a55", shadow:"rgba(0,0,0,.18)", ob:"rgba(255,255,255,.95)", text:"rgba(20,24,20,.92)", sub:"rgba(20,24,20,.62)", line:"rgba(20,20,20,.65)", arrow:"rgba(20,40,20,", hud:"rgba(255,255,255,.78)"};
  }
  function ell(e, fill, pad){ pad = pad||0; ctx.beginPath(); ctx.ellipse(SX(e), SY(e), (e.rx+pad)*cam.s, (e.ry+pad)*cam.s, 0, 0, 7); ctx.fillStyle = fill; ctx.fill(); }
  function draw(){
    if (!cv || !HL) return;
    const dpr = devicePixelRatio || 1, cw = cv.clientWidth; if (!cw) return;
    if (cv.width !== Math.round(cw*dpr)){ cv.width = Math.round(cw*dpr); cv.height = Math.round(cw*1.25*dpr); }
    ctx = cv.getContext("2d"); ctx.setTransform(cw*dpr/W, 0, 0, cw*dpr/W, 0, 0);
    const P = pal(), s = cam.s, yTop = cam.y + H/2/s + 10, yBot = cam.y - H/2/s - 10;
    ctx.fillStyle = P.out; ctx.fillRect(0, 0, W, H);
    // in-bounds rough
    const y0 = Math.max(-14, yBot), y1 = Math.min(HL.gy + HL.gry + 32, yTop), step = Math.max(2, 6/s);
    ctx.beginPath();
    for (let y = y0; y <= y1; y += step){ const yy = clamp(y,0,HL.L), x = HL.cx(yy) - obHalf(yy); y === y0 ? ctx.moveTo(SX({x}), SY({y})) : ctx.lineTo(SX({x}), SY({y})); }
    for (let y = y1; y >= y0; y -= step){ const yy = clamp(y,0,HL.L), x = HL.cx(yy) + obHalf(yy); ctx.lineTo(SX({x}), SY({y})); }
    ctx.closePath(); ctx.fillStyle = P.rough; ctx.fill();
    // rough texture stripes
    ctx.save(); ctx.clip(); ctx.fillStyle = P.roughL; for (let y = Math.floor(y0/14)*14; y < y1; y += 28){ ctx.fillRect(0, SY({y: y+14}), W, 14*s); } ctx.restore();
    // OB stakes
    ctx.fillStyle = P.ob;
    for (let y = Math.ceil(Math.max(0,y0)/15)*15; y <= Math.min(HL.L, y1); y += 15) for (const sd of [-1,1]){ const x = HL.cx(y) + sd*obHalf(y); ctx.fillRect(SX({x})-1.5, SY({y})-4, 3, 8); }
    // fairway with mowing stripes
    const fs = HL.par === 3 ? HL.L - HL.gry - 26 : 18, fe = HL.gy - HL.gry*.6;
    ctx.beginPath();
    for (let y = fs; y <= fe; y += 4) { const x = HL.cx(y) - HL.fw(y)/2; y === fs ? ctx.moveTo(SX({x}), SY({y})) : ctx.lineTo(SX({x}), SY({y})); }
    for (let y = fe; y >= fs; y -= 4) { const x = HL.cx(y) + HL.fw(y)/2; ctx.lineTo(SX({x}), SY({y})); }
    ctx.closePath(); ctx.fillStyle = P.fw; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = P.fwL; for (let y = Math.floor(fs/10)*10; y < fe; y += 20) ctx.fillRect(0, SY({y: y+10}), W, 10*s); ctx.restore();
    // tee
    ctx.fillStyle = P.tee; ctx.fillRect(SX({x:-6}), SY({y:4}), 12*s, 9*s);
    ctx.fillStyle = "#e33"; [-3,3].forEach(x => { ctx.beginPath(); ctx.arc(SX({x}), SY({y:0}), Math.max(1.5, .4*s), 0, 7); ctx.fill(); });
    // water
    HL.water.forEach(w => {
      if (w.kind === "creek"){ const a = SY({y: w.y + w.w/2}), b = SY({y: w.y - w.w/2}); ctx.fillStyle = P.water; ctx.fillRect(0, a, W, b - a); ctx.strokeStyle = P.waterL; ctx.lineWidth = 1.2; for (let k = 0; k < 3; k++){ ctx.beginPath(); for (let x = 0; x <= W; x += 8) { const yy = a + (b-a)*(k+1)/4 + Math.sin(x/14 + tClock*2 + k)*1.5; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); } }
      else { ell(w, P.water); ctx.save(); ctx.beginPath(); ctx.ellipse(SX(w), SY(w), w.rx*s, w.ry*s, 0, 0, 7); ctx.clip(); ctx.strokeStyle = P.waterL; ctx.lineWidth = 1.2; for (let k = -3; k <= 3; k++){ ctx.beginPath(); for (let x = SX(w) - w.rx*s; x <= SX(w) + w.rx*s; x += 6){ const yy = SY(w) + k*w.ry*s/4 + Math.sin(x/12 + tClock*2 + k)*1.4; x === SX(w) - w.rx*s ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); } ctx.restore(); }
    });
    // bunkers
    HL.bunkers.forEach(b => { ell(b, P.sandD, .6); ell(b, P.sand); });
    // green
    ell({x: HL.gx, y: HL.gy, rx: HL.grx, ry: HL.gry}, P.fringe, 2.5);
    ell({x: HL.gx, y: HL.gy, rx: HL.grx, ry: HL.gry}, P.green);
    if (s > 4){
      ctx.save(); ctx.beginPath(); ctx.ellipse(SX({x:HL.gx}), SY({y:HL.gy}), HL.grx*s, HL.gry*s, 0, 0, 7); ctx.clip();
      ctx.fillStyle = P.greenL; for (let x = HL.gx - HL.grx; x < HL.gx + HL.grx; x += 4) ctx.fillRect(SX({x}), 0, 2*s, H);
      // slope arrows point downhill
      const sp = s > 12 ? 1.5 : 2.2;
      for (let x = HL.gx - HL.grx; x <= HL.gx + HL.grx; x += sp) for (let y = HL.gy - HL.gry; y <= HL.gy + HL.gry; y += sp){
        const g = grade({x, y}), m = Math.hypot(g.x, g.y); if (m < .004) continue;
        const len = Math.min(sp*.85, m*40), ux = -g.x/m, uy = -g.y/m, ax = SX({x}), ay = SY({y}), bx = ax + ux*len*s, by = ay - uy*len*s;
        ctx.strokeStyle = P.arrow + clamp(m*18, .3, .85) + ")"; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        const hx = -ux*3, hy = uy*3; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + hx - hy*.6, by + hy + hx*.6); ctx.moveTo(bx, by); ctx.lineTo(bx + hx + hy*.6, by + hy - hx*.6); ctx.stroke();
      }
      ctx.restore();
    }
    // previous shots
    ctx.setLineDash([3,4]); ctx.lineWidth = 1.4; ctx.strokeStyle = P.sub;
    st.trail.forEach(t => { ctx.beginPath(); ctx.moveTo(SX(t.from), SY(t.from)); ctx.lineTo(SX(t.to), SY(t.to)); ctx.stroke(); });
    ctx.setLineDash([]);
    st.trail.forEach(t => { ctx.fillStyle = P.sub; ctx.beginPath(); ctx.arc(SX(t.to), SY(t.to), 2, 0, 7); ctx.fill(); });
    // cup + flag (flag streams with the wind)
    const cx0 = SX(HL.pin), cy0 = SY(HL.pin);
    if (s > 4){ ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx0, cy0, Math.max(5, CUP*s + 3), 0, 7); ctx.stroke(); }
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(cx0, cy0, Math.max(2.6, CUP*s), 0, 7); ctx.fill();
    const poleH = 28;
    if (!(st.phase === "aim" && putting() && dist(st.ball, HL.pin)*3 < 25)){
      ctx.strokeStyle = P.text; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0, cy0 - poleH); ctx.stroke();
      const wd = dirOf(HL.wind.dir), fl = 6 + HL.wind.mph*.55, wav = Math.sin(tClock*6)*2.5*(HL.wind.mph/12);
      const fx = wd.x*fl, fy = -wd.y*fl*.5;
      ctx.fillStyle = getComputedStyle(root).getPropertyValue("--accent").trim() || "#e0243c";
      ctx.beginPath(); ctx.moveTo(cx0, cy0 - poleH); ctx.quadraticCurveTo(cx0 + fx*.5, cy0 - poleH + fy*.5 + wav, cx0 + fx, cy0 - poleH + 3 + fy); ctx.lineTo(cx0, cy0 - poleH + 8); ctx.fill();
    }
    // aim line + ghost landing
    if (st.phase === "aim"){
      const heading = headingTo(st.ball, HL.pin) + st.aim*Math.PI/180, d = dirOf(heading);
      const len = putting() ? (st.caddie ? prevPow()*puttMax() : dist(st.ball, HL.pin)) : CLUBS[st.club].carry * prevPow() * (LIE[st.lie]||LIE.rough).m * TRAJ[st.traj].carry;
      const e = {x: st.ball.x + d.x*len, y: st.ball.y + d.y*len};
      ctx.setLineDash([5,5]); ctx.strokeStyle = P.line; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(SX(st.ball), SY(st.ball)); ctx.lineTo(SX(e), SY(e)); ctx.stroke(); ctx.setLineDash([]);
      if (!putting()){
        ctx.beginPath(); ctx.arc(SX(e), SY(e), Math.max(5, 4*s), 0, 7); ctx.stroke();
        if (st.caddie){ const g = previewLand(); ctx.fillStyle = "rgba(255,200,40,.35)"; ctx.strokeStyle = "rgba(255,200,40,.95)"; ctx.beginPath(); ctx.arc(SX(g), SY(g), Math.max(4, 3*s), 0, 7); ctx.fill(); ctx.stroke(); }
      }
    }
    // tracer
    if (st.tracer.length > 1 && (st.phase === "flight")){
      ctx.strokeStyle = "rgba(255,210,60,.9)"; ctx.lineWidth = 2; ctx.beginPath();
      st.tracer.forEach((p, i) => i ? ctx.lineTo(SX(p), SY(p)) : ctx.moveTo(SX(p), SY(p))); ctx.stroke();
    }
    // trees (drawn over the ground, ball can fly above them)
    HL.trees.forEach(t => {
      const x = SX(t), y = SY(t), r = t.r*s; if (x < -r*2 || x > W + r*2 || y < -r*2 || y > H + r*2) return;
      ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(x + r*.35, y + r*.3, r, r*.85, 0, 0, 7); ctx.fill();
      ctx.fillStyle = P.tree; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.fillStyle = P.treeL; ctx.beginPath(); ctx.arc(x - r*.25, y - r*.25, r*.6, 0, 7); ctx.fill();
    });
    // ball (shadow on the ground, ball lifted by its height)
    const b = st.vis || {...st.ball, z: 0};
    if (!(st.phase === "holed")){
      const bx = SX(b), by = SY(b), lift = (b.z||0)*Math.min(s, 3)*.9, br = clamp(2.8 + (b.z||0)*.05, 2.8, 5.5);
      ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(bx + lift*.25, by, br*.95, br*.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#222"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by - lift, br, 0, 7); ctx.fill(); ctx.stroke();
    }
    // HUD
    ctx.fillStyle = P.hud; ctx.fillRect(0, H - 30, W, 30);
    ctx.fillStyle = P.text; ctx.font = "600 13px DM Sans, system-ui, sans-serif";
    const toPin = dist(st.ball, HL.pin);
    ctx.fillText(st.phase === "holed" ? "In the hole" : st.phase === "flight" ? (st.cur.B.putt ? "Rolling…" : (b.z > .5 ? Math.round(b.z*3)+" ft high · " : "")+Math.round(dist(st.cur.from, b))+" yds") : (toPin < 30 ? Math.round(toPin*3)+" ft to the cup" : Math.round(toPin)+" yds to pin")+" · "+(LIE[st.lie]||{name:st.lie}).name, 10, H - 11);
    // wind dial
    const wx = W - 30, wy = 30, wd = dirOf(HL.wind.dir);
    ctx.fillStyle = P.hud; ctx.beginPath(); ctx.arc(wx, wy, 22, 0, 7); ctx.fill();
    ctx.strokeStyle = P.text; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(wx - wd.x*12, wy + wd.y*12); ctx.lineTo(wx + wd.x*12, wy - wd.y*12); ctx.stroke();
    ctx.beginPath(); ctx.arc(wx + wd.x*12, wy - wd.y*12, 3, 0, 7); ctx.fillStyle = P.text; ctx.fill();
    ctx.font = "700 10px DM Sans, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(HL.wind.mph+" mph", wx, wy + 34); ctx.textAlign = "left";
  }
  function ambientLoop(){
    if (cv && cv.offsetParent && st.phase !== "flight"){ tClock += 1/30; updateCam(true); draw(); }
    ambient = setTimeout(() => requestAnimationFrame(ambientLoop), cv && cv.offsetParent ? 33 : 600);
  }

  /* ---------- wiring ---------- */
  function setMode(m){
    st.mode = m; document.querySelectorAll("[data-gmode]").forEach(b => b.classList.toggle("on", b.dataset.gmode === m));
    $("#ggParPick").hidden = m !== "practice";
    st.scores = []; st.holes = m === "daily" ? dailyHoles() : [practiceHole()];
    startHole(0);
  }
  function init(){
    cv = $("#ggCanvas");
    $("#ggClubs").addEventListener("click", e => { const b = e.target.closest("[data-club]"); if (!b || b.disabled || mt.phase !== "idle" || st.phase !== "aim") return; st.club = +b.dataset.club; syncAim(); paintClubs(); paintMeter(); paintCaddie(); });
    $("#ggTraj").addEventListener("click", e => { const b = e.target.closest("[data-traj]"); if (!b || st.phase !== "aim") return; st.traj = b.dataset.traj; document.querySelectorAll("[data-traj]").forEach(x => x.classList.toggle("on", x===b)); paintClubs(); paintCaddie(); });
    $("#ggShape").addEventListener("click", e => { const b = e.target.closest("[data-shape]"); if (!b || st.phase !== "aim") return; st.shape = +b.dataset.shape; document.querySelectorAll("[data-shape]").forEach(x => x.classList.toggle("on", x===b)); paintCaddie(); });
    $("#ggAim").addEventListener("input", e => { if (st.phase !== "aim") return; st.aim = +e.target.value; syncAim(); });
    $("#ggSwing").addEventListener("click", meterTap);
    $("#ggMeter").addEventListener("pointerdown", e => { e.preventDefault(); meterTap(); });
    $("#ggModes").addEventListener("click", e => { const b = e.target.closest("[data-gmode]"); if (b && b.dataset.gmode !== st.mode && mt.phase === "idle" && st.phase !== "flight") setMode(b.dataset.gmode); });
    $("#ggParPick").addEventListener("change", e => { st.practicePar = +e.target.value; if (st.mode === "practice" && st.phase !== "flight"){ st.holes = [practiceHole()]; startHole(0); } });
    $("#ggCaddieT").checked = st.caddie;
    $("#ggCaddieT").addEventListener("change", e => { st.caddie = e.target.checked; store.set("bf-golf3-caddie", st.caddie); paintMeter(); paintCaddie(); });
    $("#ggReset").addEventListener("click", () => { if (st.phase === "flight") return; if (st.mode === "daily"){ st.scores = []; startHole(0); } else startHole(0); });
    $("#ggNew").addEventListener("click", () => { if (st.phase === "flight") return; if (st.mode !== "practice") setMode("practice"); else { st.holes = [practiceHole()]; startHole(0); } });
    addEventListener("keydown", e => {
      if (!cv.offsetParent || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.code === "Space"){ if (document.activeElement.tagName === "BUTTON") return; e.preventDefault(); meterTap(); }
      else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && st.phase === "aim"){ e.preventDefault(); const stp = (putting() ? .5 : 1) * (e.shiftKey ? 5 : 1); st.aim = clamp(st.aim + (e.key === "ArrowLeft" ? -stp : stp), putting() ? -20 : -60, putting() ? 20 : 60); syncAim(); }
      else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && st.phase === "aim" && mt.phase === "idle" && st.lie !== "green"){ e.preventDefault(); st.club = clamp(st.club + (e.key === "ArrowUp" ? -1 : 1), 0, PUTTER); syncAim(); paintClubs(); paintMeter(); paintCaddie(); }
    });
    cv.addEventListener("pointerdown", e => {
      if (st.phase !== "aim") return;
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * W / r.width;
      const wp = {x: cam.x + (x - W/2)/cam.s, y: cam.y - (y - H/2)/cam.s};
      let dd = (headingTo(st.ball, wp) - headingTo(st.ball, HL.pin)) * 180/Math.PI; dd = ((dd + 540) % 360) - 180;
      const lim = putting() ? 20 : 60; st.aim = clamp(putting() ? Math.round(dd*2)/2 : Math.round(dd), -lim, lim); syncAim();
    });
    renderStats(); renderWeek(); setMode("daily"); ambientLoop();
  }
  return {init, draw: () => { updateCam(false); draw(); }};
})();
GG.init();

/* ---------- live tick ---------- */
function tick(){
  const now = new Date();
  const gc = $("#gradClock"); if (gc) setClock(gc, GRAD - now);
  document.querySelectorAll("[data-target]").forEach(el => setClock(el, +el.dataset.target - now));
  document.querySelectorAll("[data-cd]").forEach(el => {
    const ev = EVENTS.find(e => e.id === el.dataset.cd); if (!ev) return;
    const c = cdText(ev, now);
    if (el.tagName === "B") el.textContent = c.main;
    else el.innerHTML = c.main+'<small>'+c.sub+'</small>';
  });
}

/* ---------- markets & game lines (info only, no picks) ---------- */
function renderMarkets(){
  const m = DAILY && DAILY.markets, card = $("#mkCard"); if (!card) return;
  if (!m){ card.hidden = true; return; }
  card.hidden = false;
  const pct = v => '<span class="'+(v >= 0 ? 'mk-up' : 'mk-dn')+'">'+(v >= 0 ? '▲ ' : '▼ ')+Math.abs(v).toFixed(2)+'%</span>';
  const when = iso => new Date(iso).toLocaleString("en-US", {weekday:"short", hour:"numeric", minute:"2-digit", timeZone:"America/New_York"});
  card.innerHTML = '<div class="mk-h"><div><span class="eyebrow">Markets &amp; lines</span><h3>Stocks and games to watch</h3></div><span class="chip">'+esc(m.asOf||"")+'</span></div>'+
    (m.story ? '<p class="meta">'+esc(m.story)+'</p>' : '')+
    '<div class="mk-idx">'+(m.indices||[]).map(x => '<div><small>'+esc(x.name)+'</small><b>'+esc(x.value)+'</b>'+pct(x.chg)+'</div>').join("")+'</div>'+
    '<div class="mk-cols"><div><span class="eyebrow">Stocks in the news</span>'+(m.movers||[]).map(x => '<div class="mk-row"><b>'+esc(x.sym)+'</b><p><em class="'+(x.dir > 0 ? 'mk-up' : 'mk-dn')+'">'+esc(x.move)+'</em>'+esc(x.why)+'</p></div>').join("")+'</div>'+
    '<div><span class="eyebrow">Lines</span>'+(m.lines||[]).map(x => '<div class="mk-line'+(x.bills ? ' bills' : '')+'"><b>'+esc(x.game)+'</b><span>'+when(x.kick)+' · '+esc(x.spread)+' · O/U '+esc(x.total)+' · '+esc(x.ml)+'</span></div>').join("")+
      ((m.probs||[]).length ? '<span class="eyebrow" style="display:block;margin-top:14px">Biggest favorites</span>'+m.probs.map(x => '<div class="mk-line"><b>'+esc(x.game)+'</b><span>'+esc(x.fav)+' '+x.p+'% to win</span><div class="prob-bar"><i style="width:'+x.p+'%"></i></div></div>').join("") : '')+
    '</div></div>'+
    '<p class="fine">Info only, not picks or advice. '+esc(m.sources||"")+'</p>';
}

/* ---------- memory galaxy (memories come encrypted from the worker) ---------- */
const GX = (() => {
  const COL = {me:"#ff5a6e",school:"#4fa3ff",military:"#b48cff",website:"#35c7a5",finance:"#e9e26a",sports:"#ff9f43",travel:"#7fd1ff",golf:"#7bed9f",business:"#f2a33a",people:"#ff8ad8",ideas:"#c8d6e5",other:"#a4b0be"};
  let mem = [], stars = [], clusters = [], bg = [], loaded = false, running = false, raf = 0;
  let scl = 1, rotY = 0.6, rotX = -0.35, vel = 0.0012, zoom = 1, focus = null, hover = null, sel = null, q = "", drag = null, lastMove = 0;
  const cv = () => $("#gxCanvas");
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  function layout(){
    const topics = [...new Set(mem.map(m => m.topic))];
    clusters = topics.map((t, i) => { const n = topics.length, y = n === 1 ? 0 : 1 - 2*(i+.5)/n, r = Math.sqrt(1-y*y), a = i*2.39996; return {t, x: Math.cos(a)*r*250, y: y*170, z: Math.sin(a)*r*250, n: mem.filter(m => m.topic === t).length}; });
    stars = mem.map(m => { const c = clusters.find(k => k.t === m.topic); const u = hash(m.id), v = hash(m.id+"v"), w = hash(m.id+"w"); const rr = 30 + 55*Math.cbrt(u), th = v*Math.PI*2, ph = Math.acos(2*w-1);
      const age = (Date.now() - Date.parse(m.updated || m.created || 0)) / 864e5; return {m, x: c.x + rr*Math.sin(ph)*Math.cos(th), y: c.y + rr*Math.cos(ph)*.6, z: c.z + rr*Math.sin(ph)*Math.sin(th), col: COL[m.topic] || COL.other, size: 3.4 + 3*Math.max(0, 1 - age/30), tw: u*6.28}; });
    if (!bg.length) bg = Array.from({length: 420}, () => ({x: (Math.random()-.5)*1600, y: (Math.random()-.5)*1100, z: (Math.random()-.5)*700, s: Math.random()}));
    $("#gxLegend").innerHTML = clusters.map(c => '<button type="button" data-gxt="'+esc(c.t)+'" class="'+(focus===c.t?'on':'')+'"><i style="color:'+(COL[c.t]||COL.other)+';background:'+(COL[c.t]||COL.other)+'"></i>'+esc(c.t)+' · '+c.n+'</button>').join("");
    $("#gxCount").textContent = mem.length + (mem.length === 1 ? " memory" : " memories");
  }
  function proj(p, W, H){
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    let x = p.x*cy - p.z*sy, z = p.x*sy + p.z*cy, y = p.y*cx - z*sx; z = p.y*sx + z*cx;
    const f = 980*zoom*scl / (760 + z); return {X: W/2 + x*f, Y: H/2 + y*f, f, z};
  }
  function frame(t){
    const c = cv(); if (!c || !running) return; const W = c.clientWidth, H = c.clientHeight, dpr = Math.min(2, devicePixelRatio||1);
    scl = Math.max(.42, Math.min(1, W/860)); if (c.width !== W*dpr){ c.width = W*dpr; c.height = H*dpr; } const g = c.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
    if (!drag && !reduce.matches) rotY += vel;
    for (const b of bg){ const p = proj(b, W, H); if (p.f <= 0) continue; g.fillStyle = "rgba(255,255,255,"+(0.25+0.6*b.s)+")"; g.beginPath(); g.arc(p.X, p.Y, .4+b.s*1.1, 0, 7); g.fill(); }
    for (const k of clusters){ const p = proj(k, W, H); if (p.f <= 0) continue; const r = 110*p.f, col = COL[k.t]||COL.other; const gr = g.createRadialGradient(p.X,p.Y,0,p.X,p.Y,r); gr.addColorStop(0, col+(focus && focus!==k.t?"10":"40")); gr.addColorStop(1, col+"00"); g.fillStyle = gr; g.beginPath(); g.arc(p.X,p.Y,r,0,7); g.fill();
      g.fillStyle = "rgba(255,255,255,"+(focus && focus!==k.t ? .25 : .75)+")"; g.font = "600 "+Math.max(10, 13*p.f)+"px "+getComputedStyle(document.body).getPropertyValue("--mono"); g.textAlign = "center"; g.fillText(k.t.toUpperCase(), p.X, p.Y - r*0.75); }
    const P = stars.map(s => ({s, ...proj(s, W, H)}));
    g.lineWidth = 1;
    for (let i = 0; i < P.length; i++) for (let j = i+1; j < P.length; j++){ const a = P[i].s.m, b = P[j].s.m; const shared = (a.tags||[]).some(x => (b.tags||[]).includes(x)); if (!shared && a.topic !== b.topic) continue; if (!shared && hash(a.id+b.id) > .25) continue;
      g.strokeStyle = shared ? "rgba(255,255,255,.18)" : (P[i].s.col+"22"); g.beginPath(); g.moveTo(P[i].X,P[i].Y); g.lineTo(P[j].X,P[j].Y); g.stroke(); }
    P.sort((a,b) => b.z - a.z);
    const ql = q.toLowerCase();
    for (const p of P){ if (p.f <= 0) continue; const m = p.s.m; const match = !ql || (m.text+" "+(m.tags||[]).join(" ")+" "+m.topic).toLowerCase().includes(ql); const dim = (focus && focus !== m.topic) || !match;
      const tw = reduce.matches ? 1 : .8 + .2*Math.sin(t/600 + p.s.tw), r = p.s.size*p.f*tw*(p.s===hover||p.s===sel ? 1.8 : 1);
      const gr = g.createRadialGradient(p.X,p.Y,0,p.X,p.Y,r*4); gr.addColorStop(0, p.s.col+(dim?"30":"cc")); gr.addColorStop(1, p.s.col+"00"); g.fillStyle = gr; g.beginPath(); g.arc(p.X,p.Y,r*4,0,7); g.fill();
      g.fillStyle = dim ? "rgba(255,255,255,.25)" : "#fff"; g.beginPath(); g.arc(p.X,p.Y,Math.max(.8,r*.55),0,7); g.fill(); p.s._X = p.X; p.s._Y = p.Y; p.s._r = Math.max(6, r*2); }
    raf = requestAnimationFrame(frame);
  }
  function pick(e){ const r = cv().getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 1e9; for (const s of stars){ if (s._X == null) continue; const d = Math.hypot(s._X-x, s._Y-y); if (d < s._r && d < bd){ bd = d; best = s; } } return best; }
  function show(s){ sel = s; const m = s.m; $("#gxCard").hidden = false; $("#gxCard").innerHTML = '<button type="button" id="gxClose" aria-label="Close">×</button><small style="color:'+s.col+'">'+esc(m.topic)+' · saved by '+esc(m.by||"AI")+' · '+esc((m.updated||m.created||"").slice(0,10))+'</small><p>'+esc(m.text)+'</p><div class="tags">'+(m.tags||[]).map(x => '<span>'+esc(x)+'</span>').join("")+'</div>'; }
  function bind(){
    const c = cv(); if (c._b) return; c._b = 1;
    c.addEventListener("pointerdown", e => { drag = {x: e.clientX, y: e.clientY, rx: rotY, ry: rotX, moved: 0}; c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", e => { if (drag){ const dx = e.clientX-drag.x, dy = e.clientY-drag.y; drag.moved = Math.max(drag.moved, Math.abs(dx)+Math.abs(dy)); rotY = drag.rx + dx*.006; rotX = Math.max(-1.3, Math.min(1.3, drag.ry + dy*.006)); vel = 0; return; }
      hover = pick(e); const tip = $("#gxTip"); if (hover){ tip.hidden = false; const r = c.getBoundingClientRect(); tip.style.left = (e.clientX-r.left)+"px"; tip.style.top = (e.clientY-r.top)+"px"; tip.textContent = hover.m.text.slice(0, 90)+(hover.m.text.length>90?"…":""); } else tip.hidden = true; });
    c.addEventListener("pointerup", e => { const d = drag; drag = null; if (d && d.moved < 5){ const s = pick(e); if (s) show(s); } if (!reduce.matches) setTimeout(() => { if (!drag) vel = 0.0012; }, 2500); });
    c.addEventListener("wheel", e => { e.preventDefault(); zoom = Math.max(.5, Math.min(3.2, zoom * (e.deltaY < 0 ? 1.1 : .9))); }, {passive: false});
    $("#gxSearch").addEventListener("input", e => { q = e.target.value.trim(); });
    $("#gx").addEventListener("click", e => { if (e.target.id === "gxClose"){ $("#gxCard").hidden = true; sel = null; } const b = e.target.closest("[data-gxt]"); if (b){ focus = focus === b.dataset.gxt ? null : b.dataset.gxt; layout(); } });
  }
  async function load(){
    if (!finKey || !FIN_LIVE){ $("#gxCount").textContent = "Unlock to see your memories"; return; }
    try { const r = await fetch(FIN_LIVE.replace(/\/+$/,"")+"/memory", {cache: "no-store"}); const d = await openFin(await r.json()); mem = d.memories || []; loaded = true; layout();
      if (!mem.length) $("#gxCount").textContent = "No memories yet. Ask Claude or ChatGPT to remember something!"; }
    catch(e){ $("#gxCount").textContent = "Memory bank not set up yet"; }
  }
  return {
    open(){ bind(); running = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); load(); },
    close(){ running = false; cancelAnimationFrame(raf); },
  };
})();

/* ---------- motion extras ---------- */
function celebrate(card){
  if (reduce.matches || !card) return;
  card.classList.remove("all-done"); void card.offsetWidth; card.classList.add("all-done");
  const r = card.getBoundingClientRect(), cols = ["var(--accent)","var(--c-break)","var(--c-exam)","var(--c-game)","var(--c-corps)"];
  for (let i = 0; i < 46; i++){
    const c = document.createElement("i"); c.className = "confetti";
    c.style.left = (r.left + r.width/2)+"px"; c.style.top = (r.top + 30)+"px"; c.style.background = cols[i % cols.length];
    const a = Math.random()*Math.PI*2, v = 120 + Math.random()*260;
    c.style.setProperty("--dx", Math.cos(a)*v+"px"); c.style.setProperty("--dy", (Math.sin(a)*v - 120 + Math.random()*400)+"px");
    c.style.setProperty("--r", (Math.random()*900-450)+"deg");
    document.body.appendChild(c); setTimeout(() => c.remove(), 1500);
  }
}
document.addEventListener("pointerdown", e => {
  if (reduce.matches) return;
  const b = e.target.closest(".btn,.small-btn,.seg button,.tabs button,.link-btn"); if (!b) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height)*2.2, s = document.createElement("span");
  b.classList.add("rip-host"); s.className = "rip";
  s.style.width = s.style.height = d+"px"; s.style.left = (e.clientX - r.left - d/2)+"px"; s.style.top = (e.clientY - r.top - d/2)+"px";
  b.appendChild(s); setTimeout(() => s.remove(), 650);
});
if (matchMedia("(hover:hover)").matches){
  const TILT = ".course,.cd-pair>*,.song,.place-hero";
  document.addEventListener("pointermove", e => {
    if (reduce.matches) return;
    const el = e.target.closest && e.target.closest(TILT); if (!el) return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left)/r.width - .5, y = (e.clientY - r.top)/r.height - .5;
    el.classList.add("tilt"); el.style.transform = "perspective(900px) rotateX("+(-y*5).toFixed(2)+"deg) rotateY("+(x*6).toFixed(2)+"deg) translateY(-3px)";
  });
  document.addEventListener("pointerout", e => {
    const el = e.target.closest && e.target.closest(TILT); if (!el || el.contains(e.relatedTarget)) return;
    el.style.transform = "";
  });
}
(() => {
  const bar = document.createElement("div"); bar.id = "sprog"; document.body.appendChild(bar);
  let q = 0; const upd = () => { q = 0; const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = "scaleX("+(h > 0 ? Math.min(1, scrollY/h) : 0)+")"; };
  addEventListener("scroll", () => { if (!q) q = requestAnimationFrame(upd); }, {passive: true}); addEventListener("resize", upd);
})();

window.BF = { get view(){ return curView; }, unlocked: isUnlocked,
  rerenderStudy: () => renderStudy(),
  flights: () => (DAILY && DAILY.flights) || [], place: () => (DAILY && DAILY.location) || null, bills: () => BILLS };
renderCountdowns(); renderSong(); setFbTab(store.get("bf-fbtab", "bills"));
renderHome(); renderSched(); renderResume(); renderCourses(); renderProjects(); renderDaily(); loadDaily(); loadTdl(); loadPrepManifest(); loadLinksManifest(); loadWeather(); loadBills(); renderFinance(); renderQuote(); bootAuth().then(route, route);
addEventListener("resize", () => GG.draw());
setInterval(tick, 1000);
})();
