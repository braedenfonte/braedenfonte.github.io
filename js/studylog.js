/* Study session log (Study tab).
   His iPhone opens  braedenfonte.com/?study=52#study  when Study Focus turns off.
   This saves the 52 minutes, then shows streak, today, this week, and the last 7 days.
   Saved on that device only (localStorage key "bf-study"). */
(function(){
"use strict";
const pad = n => String(n).padStart(2,"0");
const key = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function load(){ try{ return JSON.parse(localStorage.getItem("bf-study")) || []; }catch(e){ return []; } }
function save(L){ try{ localStorage.setItem("bf-study", JSON.stringify(L)); }catch(e){} }

/* 1) a new session coming in from the phone */
let logged = 0;
const p = new URLSearchParams(location.search);
// ?studystart = Study Focus turned on: remember the time
if (p.has("studystart")){
  try{ localStorage.setItem("bf-study-start", String(Date.now())); }catch(e){}
  p.delete("studystart");
  history.replaceState(null, "", location.pathname + (p.toString() ? "?"+p : "") + (location.hash || "#study"));
}
// ?studyend = Study Focus turned off: minutes since the start
if (p.has("studyend")){
  let st = 0; try{ st = Number(localStorage.getItem("bf-study-start")) || 0; localStorage.removeItem("bf-study-start"); }catch(e){}
  const mins = st ? Math.round((Date.now() - st) / 60000) : 0;
  if (mins > 0 && mins < 720) p.set("study", String(mins));
  p.delete("studyend");
}
const m = Math.round(Math.abs(Number(p.get("study"))));
if (m > 0 && m < 600){
  const L = load(), now = Date.now();
  // ignore the same link opened twice within 2 minutes
  if (!L.some(s => Math.abs(s.t - now) < 120000 && s.m === m)){ L.push({d:key(new Date()), m, t:now}); save(L); }
  // also save it in the cloud so the bedtime brief can say today's and this week's minutes
  try { fetch("https://bf-finance.bfonte18.workers.dev/study", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({m})}).catch(() => {}); } catch(e){}
  logged = m;
  p.delete("study");
  history.replaceState(null, "", location.pathname + (p.toString() ? "?"+p : "") + (location.hash || "#study"));
}

/* 2) the panel at the top of the Study tab */
const body = document.getElementById("studyBody");
if (!body) return;
const box = document.createElement("div");
box.className = "panel slog"; box.id = "studyLog";
body.parentNode.insertBefore(box, body.previousElementSibling);

function minsOn(L, k){ return L.filter(s => s.d === k).reduce((a,s) => a + s.m, 0); }
const hm = n => n >= 60 ? Math.floor(n/60)+"h "+(n%60)+"m" : n+"m";

let CLOUD = null;   // sessions saved in the worker (Study Focus on the phone logs there directly)
function render(){
  const L = CLOUD || load(), t = new Date();
  // streak: days in a row with a session, counting back from today (or yesterday if nothing yet today)
  let streak = 0, d = new Date(t);
  if (!minsOn(L, key(d))) d.setDate(d.getDate()-1);
  while (minsOn(L, key(d)) > 0){ streak++; d.setDate(d.getDate()-1); }
  // this week (Monday start)
  const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay()+6)%7));
  let week = 0; for (let i = 0; i < 7; i++){ const x = new Date(mon); x.setDate(mon.getDate()+i); week += minsOn(L, key(x)); }
  // last 7 days bars
  const days = []; for (let i = 6; i >= 0; i--){ const x = new Date(t); x.setDate(t.getDate()-i); days.push({lab:DOW[x.getDay()], m:minsOn(L, key(x))}); }
  const max = Math.max(60, ...days.map(x => x.m));
  box.innerHTML =
    '<div class="slog-stats">'+
      '<div><b>'+streak+(streak ? ' 🔥' : '')+'</b><small>day streak</small></div>'+
      '<div><b>'+hm(minsOn(L, key(t)))+'</b><small>today</small></div>'+
      '<div><b>'+hm(week)+'</b><small>this week</small></div>'+
      '<div><b>'+L.length+'</b><small>sessions</small></div>'+
    '</div>'+
    '<div class="slog-bars">'+days.map(x => '<div><i style="height:'+Math.round(x.m/max*100)+'%" title="'+x.m+' min"></i><small>'+x.lab+'</small></div>').join("")+'</div>'+
    (logged ? '<p class="slog-new">+'+logged+' min logged. Nice work.</p>' : '<p class="slog-fine">Sessions log here automatically when Study Focus turns off on your phone.</p>');
}
render();
try {
  fetch("https://bf-finance.bfonte18.workers.dev/study", {cache:"no-store"}).then(r => r.json()).then(j => {
    if (j && Array.isArray(j.sessions)){ CLOUD = j.sessions; render(); }
  }).catch(() => {});
} catch(e){}
})();
