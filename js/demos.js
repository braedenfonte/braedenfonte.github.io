/* Live OR demos for the Projects page: TSP (nearest neighbor vs 2-opt), Monte Carlo (pi and the card game War),
   and an M/M/c queue. Plain canvas, no libraries. Loaded only when Projects is opened (see js/shell.js). */
(function(){
"use strict";
const mount = document.getElementById("demoMount");
if (!mount || mount.dataset.ready) return; mount.dataset.ready = "1";
const root = document.documentElement;
const css = v => getComputedStyle(root).getPropertyValue(v).trim();
const lite = () => root.dataset.mode === "lite" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const onPage = () => document.body.dataset.view === "projects" && !document.hidden;
const fmt = (x, d) => isFinite(x) ? x.toFixed(d == null ? 2 : d) : "—";

mount.innerHTML =
'<article class="panel demo" id="dTsp"><div class="demo-h"><div><span class="eyebrow">Optimization</span><h3>Traveling Salesman: nearest neighbor vs. 2-opt</h3></div><span class="chip" id="tspState">Ready</span></div>'+
 '<div class="demo-body"><canvas id="tspCv" height="340" role="img" aria-label="Map of cities with the current route drawn between them"></canvas><div class="demo-side">'+
  '<div class="demo-ctl"><label for="tspN">Cities <span id="tspNv">30</span></label><input type="range" id="tspN" min="8" max="80" value="30">'+
  '<label for="tspSp">Speed <span id="tspSpv">5</span></label><input type="range" id="tspSp" min="1" max="10" value="5"></div>'+
  '<div class="demo-btns"><button class="btn primary" type="button" id="tspNN">1. Nearest neighbor</button><button class="btn" type="button" id="tspOpt">2. Improve with 2-opt</button><button class="btn" type="button" id="tspNew">New cities</button></div>'+
  '<div class="demo-stats" aria-live="polite"><div><b id="tspLnn">—</b><small>Nearest-neighbor length</small></div><div class="hl"><b id="tspLopt">—</b><small>After 2-opt</small></div><div><b id="tspGain">—</b><small>Shorter by</small></div><div><b id="tspSw">0</b><small>Swaps made</small></div></div>'+
 '</div></div><p class="demo-why"><b>What you are seeing:</b> one route must visit every city once and come home. <b>Nearest neighbor</b> is the quick guess: always drive to the closest city you have not seen. It is fast but leaves crossed paths. <b>2-opt</b> then fixes it: pick two roads, uncross them, and keep the change if the route gets shorter. Repeat until no swap helps.</p></article>'+

'<article class="panel demo" id="dMc"><div class="demo-h"><div><span class="eyebrow">Simulation</span><h3>Monte Carlo: let random trials find the answer</h3></div>'+
 '<div class="seg" role="tablist" aria-label="Monte Carlo demo"><button type="button" id="mcPi" class="on">Estimate π</button><button type="button" id="mcWar">War card game</button></div></div>'+
 '<div class="demo-body"><div class="grid g2" style="gap:10px"><canvas id="mcA" height="260" role="img" aria-label="Random trials"></canvas><canvas id="mcB" height="260" role="img" aria-label="Results chart"></canvas></div><div class="demo-side">'+
  '<div class="demo-ctl"><label for="mcSp">Trials per second <span id="mcSpv">600</span></label><input type="range" id="mcSp" min="1" max="10" value="5"></div>'+
  '<div class="demo-btns"><button class="btn primary" type="button" id="mcRun">Start</button><button class="btn" type="button" id="mcReset">Reset</button></div>'+
  '<div class="demo-stats" aria-live="off"><div><b id="mcS1">0</b><small id="mcL1">Darts thrown</small></div><div class="hl"><b id="mcS2">—</b><small id="mcL2">Estimate of π</small></div><div><b id="mcS3">—</b><small id="mcL3">Error</small></div><div><b id="mcS4">—</b><small id="mcL4">Inside the circle</small></div></div>'+
 '</div></div><p class="demo-why" id="mcWhy"></p></article>'+

'<article class="panel demo" id="dQ"><div class="demo-h"><div><span class="eyebrow">Queueing</span><h3>Waiting line: arrivals, servers and wait time</h3></div><span class="chip" id="qState">Paused</span></div>'+
 '<div class="demo-body"><canvas id="qCv" height="320" role="img" aria-label="Customers arriving, waiting in line and being served"></canvas><div class="demo-side">'+
  '<div class="demo-ctl"><label for="qLam">Arrivals per minute <span id="qLamv">4.0</span></label><input type="range" id="qLam" min="0.5" max="12" step="0.5" value="4">'+
  '<label for="qMu">Each server finishes per minute <span id="qMuv">1.5</span></label><input type="range" id="qMu" min="0.5" max="6" step="0.5" value="1.5">'+
  '<label for="qC">Servers <span id="qCv2">3</span></label><input type="range" id="qC" min="1" max="6" value="3">'+
  '<label for="qSp">Speed <span id="qSpv">5</span></label><input type="range" id="qSp" min="1" max="10" value="5"></div>'+
  '<div class="demo-btns"><button class="btn primary" type="button" id="qRun">Start</button><button class="btn" type="button" id="qReset">Reset</button></div>'+
  '<div class="demo-stats" aria-live="off"><div class="hl"><b id="qW">—</b><small>Avg wait (min)</small></div><div><b id="qWt">—</b><small>Theory says</small></div><div><b id="qL">—</b><small>Avg line length</small></div><div><b id="qU">—</b><small>Servers busy</small></div><div><b id="qN">0</b><small>Served</small></div><div><b id="qMax">—</b><small>Longest wait</small></div></div>'+
 '</div></div><p class="demo-why" id="qWhy"></p></article>';

const $ = id => document.getElementById(id);
function fit(cv){ const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = +cv.getAttribute("height"); cv.style.height = h+"px";
  if (cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
  const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); return { x, w, h }; }
/* one ticker per demo: smooth frames normally, 4 updates a second in low-power mode, stops when you leave the page */
function ticker(step){
  let raf = 0, iv = 0, last = 0, on = false;
  const f = now => { raf = 0; if (!on) return; if (!onPage()){ stop(); return; } const dt = Math.min(0.1, (now - last)/1000); last = now; step(dt); if (on) raf = requestAnimationFrame(f); };
  function start(){ if (on) return; on = true; last = performance.now();
    if (lite()) iv = setInterval(() => { if (!onPage()){ stop(); return; } step(0.25); }, 250); else raf = requestAnimationFrame(f); }
  function stop(){ on = false; if (raf) cancelAnimationFrame(raf); if (iv) clearInterval(iv); raf = iv = 0; if (t.onstop) t.onstop(); }
  const t = { start, stop, get on(){ return on; }, onstop: null }; return t;
}

/* ================= TSP ================= */
(() => {
  const cv = $("tspCv"); let pts = [], tour = [], phase = "idle", nnLen = 0, swaps = 0, flash = null, gen = null, acc = 0;
  const D = (a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
  const len = t => t.reduce((s, c, i) => s + D(c, t[(i + 1) % t.length]), 0);
  function fresh(){ const n = +$("tspN").value; pts = Array.from({length: n}, () => [0.05 + Math.random()*0.9, 0.07 + Math.random()*0.86]); tour = []; phase = "idle"; nnLen = 0; swaps = 0; flash = null; tk.stop(); paint(); }
  function* nn(){ const used = new Set([0]); tour = [0];
    while (tour.length < pts.length){ const l = tour[tour.length - 1]; let b = -1, bd = 1e9; for (let i = 0; i < pts.length; i++) if (!used.has(i)){ const d = D(l, i); if (d < bd){ bd = d; b = i; } } tour.push(b); used.add(b); yield; } }
  function* opt(){ const n = tour.length; let better = true;
    while (better){ better = false;
      for (let i = 0; i < n - 1; i++) for (let j = i + 2; j < n; j++){ if (i === 0 && j === n - 1) continue;
        const a = tour[i], b = tour[i + 1], c = tour[j], d = tour[(j + 1) % n];
        if (D(a, c) + D(b, d) - D(a, b) - D(c, d) < -1e-9){ let lo = i + 1, hi = j; while (lo < hi){ const t = tour[lo]; tour[lo] = tour[hi]; tour[hi] = t; lo++; hi--; } swaps++; flash = [a, c, b, d]; better = true; yield; } } } }
  function finish(){ if (phase === "nn"){ nnLen = len(tour); phase = "nnDone"; } else if (phase === "opt"){ phase = "done"; flash = null; } tk.stop(); paint(); }
  const tk = ticker(dt => { acc += dt * (+$("tspSp").value) * (phase === "nn" ? 9 : 5); let did = false;
    while (acc >= 1 && gen){ acc -= 1; did = true; if (gen.next().done){ gen = null; finish(); return; } } if (did) paint(); });
  function run(p){ if (p === "opt" && phase !== "nnDone" && phase !== "done") { run("nn"); return; } if (p === "opt" && phase === "done") return;
    phase = p; if (p === "nn"){ swaps = 0; nnLen = 0; } gen = p === "nn" ? nn() : opt(); acc = 0;
    if (lite()){ while (!gen.next().done); gen = null; finish(); } else tk.start(); paint(); }
  function paint(){
    const { x, w, h } = fit(cv), A = css("--accent"), F = css("--fg"), M = css("--faint"), X = p => [p[0]*w, p[1]*h];
    x.clearRect(0, 0, w, h);
    if (tour.length > 1){ x.strokeStyle = phase === "nn" || phase === "nnDone" ? M : A; x.lineWidth = 1.8; x.lineJoin = "round"; x.beginPath();
      tour.forEach((c, i) => { const p = X(pts[c]); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }); if (tour.length === pts.length) x.closePath(); x.stroke(); }
    if (flash && phase === "opt"){ x.strokeStyle = F; x.lineWidth = 3; x.beginPath(); [[flash[0], flash[1]], [flash[2], flash[3]]].forEach(e => { const p = X(pts[e[0]]), q = X(pts[e[1]]); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); }); x.stroke(); }
    pts.forEach((p, i) => { const q = X(p); x.fillStyle = i === 0 ? A : F; x.beginPath(); x.arc(q[0], q[1], i === 0 ? 5 : 3.2, 0, 7); x.fill(); });
    const cur = tour.length === pts.length ? len(tour) : 0;
    $("tspNv").textContent = $("tspN").value; $("tspSpv").textContent = $("tspSp").value;
    $("tspLnn").textContent = nnLen ? fmt(nnLen*100, 1) : "—";
    const after = phase === "opt" || phase === "done";
    $("tspLopt").textContent = after ? fmt(cur*100, 1) : "—";
    $("tspGain").textContent = after && nnLen ? fmt((1 - cur/nnLen)*100, 1)+"%" : "—";
    $("tspSw").textContent = swaps;
    $("tspState").textContent = {idle:"Ready", nn:"Building route…", nnDone:"Route built. Now try 2-opt", opt:"Uncrossing roads…", done:"No swap helps: done"}[phase];
    $("tspOpt").disabled = phase === "idle" || phase === "nn" || phase === "done";
  }
  $("tspNN").onclick = () => run("nn"); $("tspOpt").onclick = () => run("opt"); $("tspNew").onclick = fresh;
  $("tspN").oninput = fresh; $("tspSp").oninput = paint;
  addEventListener("resize", paint); document.addEventListener("bf:theme", paint); document.addEventListener("bf:view", e => { if (e.detail === "projects") paint(); });
  fresh();
})();

/* ================= Monte Carlo ================= */
(() => {
  const A = $("mcA"), B = $("mcB"); let mode = "pi", S;
  const WHY = {
    pi: "<b>What you are seeing:</b> darts land at random spots in a square. The share that lands inside the circle is about π ÷ 4, so 4 × that share estimates π. A few darts give a rough answer. Thousands give a good one. That is Monte Carlo: when the math is hard, run many random trials and count.",
    war: "<b>What you are seeing:</b> the computer plays full games of War, the card game with no choices, thousands of times. The line shows Player 1's win rate settling near 50%, which tells us the game is fair. The bars show how many rounds games take: most finish in a few hundred, but a few drag on for a very long time."
  };
  const speed = () => { const s = +$("mcSp").value; return mode === "pi" ? Math.round(20*Math.pow(1.9, s)) : Math.round(2*Math.pow(1.7, s)); };
  function reset(){ S = { n: 0, hit: 0, hist: [], wins: 0, rounds: 0, longest: 0, bins: new Array(24).fill(0), buf: [] }; tk.stop(); acc = 0;
    const a = fit(A); a.x.clearRect(0, 0, a.w, a.h); labels(); paint(); }
  function labels(){ const pi = mode === "pi";
    $("mcL1").textContent = pi ? "Darts thrown" : "Games played"; $("mcL2").textContent = pi ? "Estimate of π" : "Player 1 win rate";
    $("mcL3").textContent = pi ? "Error" : "Avg rounds per game"; $("mcL4").textContent = pi ? "Inside the circle" : "Longest game (rounds)";
    $("mcWhy").innerHTML = WHY[mode]; $("mcPi").classList.toggle("on", pi); $("mcWar").classList.toggle("on", !pi);
    $("mcPi").setAttribute("aria-selected", pi); $("mcWar").setAttribute("aria-selected", !pi); }
  function shuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function war(){ const d = shuffle(Array.from({length: 52}, (_, i) => i % 13)), a = d.slice(0, 26), b = d.slice(26); let r = 0;
    while (a.length && b.length && r < 5000){ r++; const pot = []; let ca = a.shift(), cb = b.shift(); pot.push(ca, cb);
      while (ca === cb){ if (a.length < 4 || b.length < 4) return { w: a.length === b.length ? (Math.random() < 0.5 ? 0 : 1) : (a.length > b.length ? 0 : 1), r };
        for (let k = 0; k < 3; k++) pot.push(a.shift(), b.shift()); ca = a.shift(); cb = b.shift(); pot.push(ca, cb); }
      shuffle(pot); (ca > cb ? a : b).push(...pot); }
    return { w: a.length === b.length ? (Math.random() < 0.5 ? 0 : 1) : (a.length > b.length ? 0 : 1), r }; }
  let acc = 0;
  const tk = ticker(dt => { acc += dt*speed(); const k = Math.floor(acc); acc -= k; if (!k) return;
    if (mode === "pi"){ for (let i = 0; i < k; i++){ const px = Math.random(), py = Math.random(), inside = (px - .5)*(px - .5) + (py - .5)*(py - .5) <= .25; S.n++; if (inside) S.hit++; if (S.buf.length < 4000) S.buf.push(px, py, inside); } }
    else for (let i = 0; i < k; i++){ const g = war(); S.n++; if (g.w === 0) S.wins++; S.rounds += g.r; if (g.r > S.longest) S.longest = g.r; S.bins[Math.min(23, Math.floor(g.r/50))]++; }
    const val = mode === "pi" ? 4*S.hit/S.n : 100*S.wins/S.n; S.hist.push(val); if (S.hist.length > 400) S.hist = S.hist.filter((_, i) => i % 2 === 0);
    paint(); });
  tk.onstop = () => { $("mcRun").textContent = "Start"; };
  function line(c, data, lo, hi, target, lab){ const { x, w, h } = c, Fa = css("--faint"), Ac = css("--accent"), Mu = css("--muted");
    x.clearRect(0, 0, w, h); const Y = v => 14 + (1 - (Math.min(hi, Math.max(lo, v)) - lo)/(hi - lo))*(h - 34);
    x.strokeStyle = Fa; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(8, Y(target)); x.lineTo(w - 8, Y(target)); x.stroke(); x.setLineDash([]);
    x.fillStyle = Mu; x.font = "500 10.5px "+css("--mono"); x.fillText(lab, 10, Y(target) - 5); x.fillText("trials →", w - 58, h - 6);
    if (data.length > 1){ x.strokeStyle = Ac; x.lineWidth = 1.8; x.beginPath(); data.forEach((v, i) => { const px = 8 + i/(data.length - 1)*(w - 16); i ? x.lineTo(px, Y(v)) : x.moveTo(px, Y(v)); }); x.stroke(); } }
  function paint(){
    if (A.clientWidth < 40) return;   // page not visible yet
    $("mcSpv").textContent = speed().toLocaleString()+(mode === "pi" ? " darts" : " games");
    $("mcS1").textContent = S.n.toLocaleString();
    if (mode === "pi"){
      const a = fit(A), s = Math.min(a.w, a.h) - 16, ox = (a.w - s)/2, oy = (a.h - s)/2, x = a.x;
      if (!S.n) x.clearRect(0, 0, a.w, a.h);
      x.strokeStyle = css("--faint"); x.lineWidth = 1; x.strokeRect(ox, oy, s, s); x.beginPath(); x.arc(ox + s/2, oy + s/2, s/2, 0, 7); x.stroke();
      for (let i = 0; i < S.buf.length; i += 3){ x.fillStyle = S.buf[i + 2] ? css("--accent") : css("--muted"); x.fillRect(ox + S.buf[i]*s - 1, oy + S.buf[i + 1]*s - 1, 2, 2); } S.buf = [];
      const est = S.n ? 4*S.hit/S.n : NaN;
      $("mcS2").textContent = fmt(est, 4); $("mcS3").textContent = S.n ? fmt(Math.abs(est - Math.PI), 4) : "—"; $("mcS4").textContent = S.n ? fmt(100*S.hit/S.n, 1)+"%" : "—";
      line(fit(B), S.hist, 2.6, 3.7, Math.PI, "π = 3.1416");
    } else {
      line(fit(A), S.hist, 30, 70, 50, "50% = fair game");
      const b = fit(B), x = b.x, mx = Math.max(1, ...S.bins), bw = (b.w - 16)/24; x.clearRect(0, 0, b.w, b.h);
      S.bins.forEach((v, i) => { x.fillStyle = css("--accent"); const bh = v/mx*(b.h - 40); x.fillRect(8 + i*bw + 1, b.h - 22 - bh, bw - 2, bh); });
      x.fillStyle = css("--muted"); x.font = "500 10.5px "+css("--mono"); x.fillText("rounds per game: 0", 8, b.h - 6); x.fillText("1150+", b.w - 42, b.h - 6);
      $("mcS2").textContent = S.n ? fmt(100*S.wins/S.n, 1)+"%" : "—"; $("mcS3").textContent = S.n ? Math.round(S.rounds/S.n) : "—"; $("mcS4").textContent = S.n ? S.longest.toLocaleString() : "—";
    }
  }
  $("mcRun").onclick = () => { if (tk.on) tk.stop(); else { tk.start(); $("mcRun").textContent = "Pause"; } };
  $("mcReset").onclick = reset; $("mcSp").oninput = paint;
  $("mcPi").onclick = () => { mode = "pi"; reset(); }; $("mcWar").onclick = () => { mode = "war"; reset(); };
  addEventListener("resize", () => { if (!tk.on) paint(); }); document.addEventListener("bf:theme", paint);
  reset();
})();

/* ================= Queue (M/M/c) ================= */
(() => {
  const cv = $("qCv"); let S;
  const expo = rate => -Math.log(1 - Math.random())/rate;
  const P = () => ({ lam: +$("qLam").value, mu: +$("qMu").value, c: +$("qC").value });
  function theory(p){ const rho = p.lam/(p.c*p.mu); if (rho >= 1) return { rho, wq: Infinity };
    const a = p.lam/p.mu; let sum = 0, term = 1; for (let k = 0; k < p.c; k++){ sum += term; term *= a/(k + 1); }   // term ends as a^c / c!
    const tail = term/(1 - rho), pw = tail/(sum + tail); return { rho, wq: pw/(p.c*p.mu - p.lam) }; }
  function reset(){ const p = P(); S = { t: 0, next: expo(p.lam), q: [], srv: Array.from({length: p.c}, () => ({ end: Infinity })), served: 0, wait: 0, maxW: 0, areaQ: 0, busy: 0, trace: [], traceT: 0 }; tk.stop(); paint(); }
  function advance(to){ const p = P();
    for (let guard = 0; guard < 20000; guard++){
      let ne = S.next, who = -1; S.srv.forEach((s, i) => { if (s.end < ne){ ne = s.end; who = i; } });
      if (ne > to) break;
      const dt = ne - S.t, nb = S.srv.filter(s => s.end < Infinity).length; S.areaQ += S.q.length*dt; S.busy += nb*dt; S.t = ne;
      if (who < 0){ S.q.push(S.t); S.next = S.t + expo(p.lam); } else S.srv[who].end = Infinity;
      S.srv.forEach(s => { if (s.end === Infinity && S.q.length){ const arr = S.q.shift(), wt = S.t - arr; S.wait += wt; S.served++; if (wt > S.maxW) S.maxW = wt; s.end = S.t + expo(p.mu); } });
    }
    const dt = to - S.t, nb = S.srv.filter(s => s.end < Infinity).length; S.areaQ += S.q.length*dt; S.busy += nb*dt; S.t = to;
    if (S.t - S.traceT > 0.25){ S.traceT = S.t; S.trace.push(S.q.length); if (S.trace.length > 240) S.trace.shift(); } }
  const tk = ticker(dt => { advance(S.t + dt*(+$("qSp").value)*0.8); paint(); });
  tk.onstop = () => { $("qRun").textContent = "Start"; $("qState").textContent = "Paused"; };
  function paint(){
    const p = P(), th = theory(p), { x, w, h } = fit(cv), Ac = css("--accent"), Fg = css("--fg"), Fa = css("--faint"), Mu = css("--muted"), Ln = css("--line");
    $("qLamv").textContent = p.lam.toFixed(1); $("qMuv").textContent = p.mu.toFixed(1); $("qCv2").textContent = p.c; $("qSpv").textContent = $("qSp").value;
    x.clearRect(0, 0, w, h); x.font = "500 10.5px "+css("--mono");
    const top = 150, sx = w - 86, sh = Math.min(26, (top - 30)/p.c - 6);
    S.srv.forEach((s, i) => { const y = 22 + i*(sh + 6), busy = s.end < Infinity; x.fillStyle = busy ? Ac : "transparent"; x.strokeStyle = busy ? Ac : Fa; x.lineWidth = 1.4;
      x.beginPath(); x.roundRect ? x.roundRect(sx, y, 62, sh, 6) : x.rect(sx, y, 62, sh); x.fill(); x.stroke(); x.fillStyle = busy ? "#fff" : Mu; x.fillText(busy ? "busy" : "open", sx + 16, y + sh/2 + 4); });
    const cap = Math.max(1, Math.floor((sx - 40)/13)), show = Math.min(S.q.length, cap);
    for (let i = 0; i < show; i++){ x.fillStyle = Fg; x.beginPath(); x.arc(sx - 22 - i*13, top/2 + 6, 4.5, 0, 7); x.fill(); }
    x.fillStyle = Mu; x.fillText("line: "+S.q.length+(S.q.length > cap ? " (more than fits)" : ""), 10, 16); x.fillText("servers", sx + 6, 14);
    x.strokeStyle = Ln; x.beginPath(); x.moveTo(8, top + 6); x.lineTo(w - 8, top + 6); x.stroke();
    x.fillStyle = Mu; x.fillText("line length over time", 10, top + 22);
    const mx = Math.max(4, ...S.trace), gh = h - top - 40;
    if (S.trace.length > 1){ x.strokeStyle = Ac; x.lineWidth = 1.8; x.beginPath(); S.trace.forEach((v, i) => { const px = 10 + i/239*(w - 20), py = h - 10 - v/mx*gh; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); }
    x.fillText(String(mx), w - 26, top + 22);
    $("qW").textContent = S.served ? fmt(S.wait/S.served) : "—"; $("qWt").textContent = isFinite(th.wq) ? fmt(th.wq) : "∞ (overloaded)";
    $("qL").textContent = S.t ? fmt(S.areaQ/S.t, 1) : "—"; $("qU").textContent = S.t ? fmt(100*S.busy/(S.t*p.c), 0)+"%" : "—";
    $("qN").textContent = S.served.toLocaleString(); $("qMax").textContent = S.served ? fmt(S.maxW) : "—";
    $("qWhy").innerHTML = "<b>What you are seeing:</b> customers show up at random, wait in one line, and go to the first open server. Load = arrivals ÷ (servers × service rate) = <b>"+fmt(100*th.rho, 0)+"%</b>. "+
      (th.rho >= 1 ? "That is over 100%, so work arrives faster than it can be done and <b>the line grows forever</b>. Add a server or speed up service." :
       th.rho > 0.85 ? "That is close to 100%, so waits get long and jumpy even though the servers can keep up on average." : "There is slack, so the line stays short.")+
      " The “theory” box is the textbook M/M/c answer (Erlang C). Run it longer and the simulated wait moves toward it.";
  }
  $("qRun").onclick = () => { if (tk.on) tk.stop(); else { tk.start(); $("qRun").textContent = "Pause"; $("qState").textContent = "Running"; } };
  $("qReset").onclick = reset; ["qLam", "qMu", "qC"].forEach(id => { $(id).oninput = () => { const was = tk.on; reset(); if (was) $("qRun").onclick(); }; }); $("qSp").oninput = paint;
  addEventListener("resize", () => { if (!tk.on) paint(); }); document.addEventListener("bf:theme", paint);
  reset();
})();
})();
