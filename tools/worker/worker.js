/* Live finance for braedenfonte.com — a Cloudflare Worker (free plan).
 *
 * It holds your Plaid keys and bank access tokens (never the browser), pulls
 * real-time balances + this/last month's transactions from Plaid, and returns
 * them ENCRYPTED with the site's public key. Only someone who unlocked the
 * site with the password can read the numbers.
 *
 * Settings (Worker > Settings > Variables and Secrets):
 *   PLAID_CLIENT_ID  (secret)  from dashboard.plaid.com > Developers > Keys
 *   PLAID_SECRET     (secret)  the Production secret
 *   ADMIN_TOKEN      (secret)  any long random phrase you make up; needed only to link banks
 * Binding (Worker > Settings > Bindings > KV namespace):
 *   TOKENS  -> a KV namespace (stores the bank access tokens)
 *
 * Endpoints:
 *   GET  /live           encrypted finance snapshot (cached 5 minutes)
 *   POST /link-token     {kind:"bank"|"invest"}  (admin)  -> Plaid Link token
 *   POST /exchange       {public_token, institution}  (admin) -> saves the bank
 *   GET  /items          (admin) -> linked institution names
 *   POST /remove         {item_id} (admin)
 *   POST /mcp/<MEMORY_KEY>   shared memory bank (MCP) for Claude and ChatGPT
 *   GET  /memory         all memories, ENCRYPTED for the site's galaxy page
 * Extra secret for the memory bank:
 *   MEMORY_KEY       (secret)  a long random string; it becomes part of the connector URL
 *
 * Instant texting (Inkbox iMessage), see texts section at the bottom:
 *   INKBOX_API_KEY   (secret)  admin API key from the Inkbox Console
 *   INKBOX_IDENTITY  (secret)  the agent identity id
 *   INKBOX_HOOK_TOKEN(secret)  any long random phrase (Inkbox sends it with every text)
 *   MY_PHONE         (secret)  Braeden's number, +1XXXXXXXXXX (the only number it answers)
 *   GITHUB_TOKEN     (secret)  fine-grained token, this repo only, Contents: read and write
 *   LA_FIRE_URL / LA_FIRE_TOKEN (secrets) the L&A scheduled task's API trigger URL + token
 * Binding: AI -> Workers AI (free tier)
 * Cron trigger: 0 0 * * 1 and 0 23 * * 0  (Sunday 7 PM ET, either side of daylight saving)
 * One-time: open https://<worker>/inkbox/setup?admin=<ADMIN_TOKEN> to subscribe Inkbox to this worker.
 */
const PUB = {"kty":"RSA","alg":"RSA-OAEP-256","e":"AQAB","n":"q-2JOdKVCRO5HUhaqMY82-FPM4WBE1t0R6xTZlwme8vdYx7DyuZ11cZc0X2Ow7LUnRqhkF1ADom8fDpnMwYv7WW1AivMfEPDbwGHtDR3TjjPtJ3FmaJXJqlYeSzHBn37GcNXEpOg61pyJbIJeZbxuOajig516S_PlR3EQz83wIYLPHYw13s8uBTMvStNKo_UdigYUIzids6ltHS0Tzy-LZxPDGgnWJZxjYvOGMRER75z7ShpAQBpVq0bCX90IshN43LKMVWIS7TcwKRRxRz7qfFL5ohn0MWsf6Sf2z_ADKL7uWbKErRWHi9-TQX2eaMFY2P6mIaTQSWCkXzulHf5nQ","ext":true,"key_ops":["encrypt"]};
const ORIGINS = ["https://braedenfonte.com", "https://www.braedenfonte.com", "https://braedenfonte.github.io", "http://localhost:8765"];
const WANT = ["Chase", "Capital One", "Robinhood", "American Express"];
const CACHE_SECONDS = 300;
const PLAID = "https://production.plaid.com";

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
      "Access-Control-Allow-Headers": "Content-Type, X-Admin",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Vary": "Origin",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    const path = new URL(req.url).pathname;
    // No OAuth here: answer discovery probes with 404 so MCP clients connect without sign-in
    if (path.startsWith("/.well-known/") || path === "/register" || path === "/authorize" || path === "/token")
      return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
    // Shared memory bank (MCP server for Claude + ChatGPT). URL: /mcp/<MEMORY_KEY>
    if (path.startsWith("/mcp/")) {
      if (!env.MEMORY_KEY || path !== "/mcp/" + env.MEMORY_KEY) return new Response("Not found", { status: 404 });
      return mcp(req, env);
    }
    // Instant texting (Inkbox iMessage)
    if (path === "/inkbox" && req.method === "POST") return inkboxHook(req, env, ctx);
    if (path === "/inkbox/setup" && req.method === "GET") return inkboxSetup(req, env);
    if (path === "/memory" && req.method === "GET") {
      try { return json(await seal({ memories: await loadMem(env), at: new Date().toISOString() })); }
      catch (e) { return json({ error: String(e.message || e) }, 500); }
    }
    try {
      if (path === "/live" && req.method === "GET") {
        const fresh = new URL(req.url).searchParams.has("fresh");
        const cached = await env.TOKENS.get("cache", "json");
        if (cached && !fresh && Date.now() - cached.t < CACHE_SECONDS * 1000) return json(cached.blob);
        const blob = await seal(await snapshot(env));
        await env.TOKENS.put("cache", JSON.stringify({ t: Date.now(), blob }));
        return json(blob);
      }
      // everything below changes or reveals what is linked: admin only
      if (!["/link-token", "/exchange", "/items", "/remove"].includes(path)) return json({ error: "Not found" }, 404);
      if (!env.ADMIN_TOKEN || req.headers.get("X-Admin") !== env.ADMIN_TOKEN) return json({ error: "Wrong admin token" }, 401);
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      if (path === "/link-token") {
        const invest = body.kind === "invest";
        const r = await plaid(env, "/link/token/create", {
          user: { client_user_id: "braeden" }, client_name: "Braeden Fonte", language: "en", country_codes: ["US"],
          products: invest ? ["investments"] : ["transactions"],
          ...(invest ? {} : { transactions: { days_requested: 90 } }),
        });
        return json({ link_token: r.link_token });
      }
      if (path === "/exchange") {
        const r = await plaid(env, "/item/public_token/exchange", { public_token: body.public_token });
        const items = (await env.TOKENS.get("items", "json")) || [];
        items.push({ item_id: r.item_id, access_token: r.access_token, inst: body.institution || "Bank", invest: !!body.invest });
        await env.TOKENS.put("items", JSON.stringify(items));
        await env.TOKENS.delete("cache");
        return json({ ok: true, linked: items.map(i => i.inst) });
      }
      if (path === "/items") {
        const items = (await env.TOKENS.get("items", "json")) || [];
        return json({ linked: items.map(i => ({ inst: i.inst, item_id: i.item_id })) });
      }
      if (path === "/remove") {
        let items = (await env.TOKENS.get("items", "json")) || [];
        const it = items.find(i => i.item_id === body.item_id);
        if (it) await plaid(env, "/item/remove", { access_token: it.access_token }).catch(() => {});
        items = items.filter(i => i.item_id !== body.item_id);
        await env.TOKENS.put("items", JSON.stringify(items)); await env.TOKENS.delete("cache");
        return json({ ok: true });
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  },
  // Cloudflare cron: Sunday 7 PM ET "log in to CIS" text for the L&A tracker
  async scheduled(evt, env, ctx) { ctx.waitUntil(sundayPing(env)); },
};

async function plaid(env, path, body) {
  const r = await fetch(PLAID + path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env.PLAID_CLIENT_ID, secret: env.PLAID_SECRET, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_message || j.error_code || "Plaid error");
  return j;
}

const short = n => /chase/i.test(n) ? "Chase" : /capital one/i.test(n) ? "Capital One" : /robinhood/i.test(n) ? "Robinhood" : /american express|amex/i.test(n) ? "American Express" : n;
const nice = s => (s || "OTHER").toLowerCase().split("_").map((w, i) => i ? w : w[0].toUpperCase() + w.slice(1)).join(" ").replace(" and ", " and ");
const cents = v => Math.round(v * 100) / 100;

async function snapshot(env) {
  const items = (await env.TOKENS.get("items", "json")) || [];
  const tz = "America/New_York";
  const now = new Date();
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number);
  const iso = (Y, M, D) => `${Y}-${String(M).padStart(2, "0")}-${String(D).padStart(2, "0")}`;
  const thisStart = iso(y, m, 1), today = iso(y, m, d);
  const lm = m === 1 ? 12 : m - 1, ly = m === 1 ? y - 1 : y;
  const lastStart = iso(ly, lm, 1), lastEnd = iso(ly, lm, new Date(Date.UTC(ly, lm, 0)).getUTCDate());
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const accounts = [], errors = [];
  const month = { income: 0, spending: 0 }, last = { income: 0, spending: 0 }, cats = {};
  let pendingCount = 0;
  for (const it of items) {
    const inst = short(it.inst);
    try {
      const b = await plaid(env, "/accounts/balance/get", { access_token: it.access_token });
      for (const a of b.accounts) {
        const debt = a.type === "credit" || a.type === "loan";
        const bal = a.balances.current ?? a.balances.available ?? 0;
        accounts.push({ inst, name: a.official_name || a.name, type: debt ? "Credit card" : a.type === "investment" ? "Investing" : (a.subtype ? a.subtype[0].toUpperCase() + a.subtype.slice(1) : "Account"), mask: a.mask || "", bal: cents(bal), debt });
      }
    } catch (e) { errors.push(inst + ": " + e.message); }
    if (it.invest) continue;
    try {
      let offset = 0, total = 1;
      while (offset < total && offset < 2000) {
        const t = await plaid(env, "/transactions/get", { access_token: it.access_token, start_date: lastStart, end_date: today, options: { count: 500, offset } });
        total = t.total_transactions; offset += t.transactions.length;
        if (!t.transactions.length) break;
        for (const x of t.transactions) {
          if (x.pending) { pendingCount++; continue; }
          const cat = (x.personal_finance_category && x.personal_finance_category.primary) || "OTHER";
          if (/^TRANSFER_|^LOAN_PAYMENTS/.test(cat)) continue; // card payments and moving your own money aren't spending
          const bucket = x.date >= thisStart ? month : last;
          if (x.amount > 0) { bucket.spending += x.amount; if (bucket === month) cats[cat] = (cats[cat] || 0) + x.amount; }
          else if (cat === "INCOME") bucket.income += -x.amount;
        }
      }
    } catch (e) { errors.push(inst + " transactions: " + e.message); }
  }
  const linked = new Set(accounts.map(a => a.inst));
  const netWorth = accounts.reduce((s, a) => s + (a.debt ? -a.bal : a.bal), 0);
  return {
    asOf: today, live: true, at: now.toISOString(),
    accounts, pending: WANT.filter(n => !linked.has(n)),
    netWorth: cents(netWorth),
    month: { label: `${MON[m - 1]} 1–${d}`, income: cents(month.income), spending: cents(month.spending), net: cents(month.income - month.spending) },
    lastMonth: { label: LONG[lm - 1], income: cents(last.income), spending: cents(last.spending), net: cents(last.income - last.spending) },
    categories: Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [nice(k), cents(v)]),
    flags: [...(pendingCount ? [pendingCount + " pending transactions not counted yet"] : []), ...errors],
    spendNote: "Card payments and transfers between your own accounts are left out.",
  };
}

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function seal(obj) {
  const pub = await crypto.subtle.importKey("jwk", PUB, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  const k = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, await crypto.subtle.exportKey("raw", key));
  return { v: 1, k: b64(k), iv: b64(iv), ct: b64(ct) };
}

/* ===================== Shared memory bank (MCP over HTTP) ===================== */
const TOPICS = ["me", "school", "military", "website", "finance", "sports", "travel", "golf", "business", "people", "ideas", "other"];
async function loadMem(env) { return (await env.TOKENS.get("mem:all", "json")) || []; }
async function saveMem(env, list) { await env.TOKENS.put("mem:all", JSON.stringify(list)); }
const words = s => (s || "").toLowerCase().match(/[a-z0-9]+/g) || [];
function score(m, q) {
  const qw = words(q); if (!qw.length) return 0;
  const hay = words(m.text + " " + m.topic + " " + (m.tags || []).join(" "));
  let s = 0; for (const w of qw) { if (hay.includes(w)) s += 2; else if (hay.some(h => h.startsWith(w) || w.startsWith(h))) s += 1; }
  return s / qw.length;
}
const fmt = m => `[${m.id}] (${m.topic}${m.tags && m.tags.length ? "; " + m.tags.join(", ") : ""}) ${m.text}  — saved by ${m.by} ${m.created.slice(0, 10)}`;

const TOOLS = [
  { name: "remember", description: "Save a durable fact, preference, plan or decision about Braeden to his shared memory bank (shared by Claude and ChatGPT). Check with search first to avoid duplicates; use update_memory to change an existing one. Never save passwords, account numbers, or other secrets.",
    inputSchema: { type: "object", properties: { text: { type: "string", description: "One clear, self-contained fact in plain language." }, topic: { type: "string", enum: TOPICS }, tags: { type: "array", items: { type: "string" }, description: "1-4 short lowercase keywords" } }, required: ["text", "topic"] } },
  { name: "search", description: "Search Braeden's shared memory bank by keywords. Use before answering questions about him, his classes, website, plans or preferences.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "fetch", description: "Get one memory by its id.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "list_memories", description: "List memories, optionally for one topic, newest first.", inputSchema: { type: "object", properties: { topic: { type: "string", enum: TOPICS }, limit: { type: "number" } } } },
  { name: "update_memory", description: "Change an existing memory's text, topic or tags.", inputSchema: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, topic: { type: "string", enum: TOPICS }, tags: { type: "array", items: { type: "string" } } }, required: ["id"] } },
  { name: "forget", description: "Delete a memory by id (only when Braeden asks).", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
];

async function runTool(name, a, env, by) {
  const list = await loadMem(env);
  const now = new Date().toISOString();
  if (name === "remember") {
    const text = String(a.text || "").trim().slice(0, 2000); if (!text) throw new Error("text is required");
    if (/\b\d{12,19}\b|password|passcode|\bssn\b|routing number/i.test(text)) throw new Error("That looks like sensitive data (a password or account number). Not saved.");
    const m = { id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, topic: TOPICS.includes(a.topic) ? a.topic : "other", tags: (a.tags || []).map(t => String(t).toLowerCase().slice(0, 24)).slice(0, 4), by, created: now, updated: now };
    list.push(m); await saveMem(env, list); return "Saved " + fmt(m);
  }
  if (name === "search") {
    const hits = list.map(m => [score(m, a.query), m]).filter(x => x[0] > 0).sort((x, y) => y[0] - x[0]).slice(0, Math.min(+a.limit || 10, 30));
    return hits.length ? hits.map(x => fmt(x[1])).join("\n") : "No matching memories.";
  }
  if (name === "fetch") { const m = list.find(x => x.id === a.id); return m ? fmt(m) : "Not found."; }
  if (name === "list_memories") {
    const l = list.filter(m => !a.topic || m.topic === a.topic).sort((x, y) => y.updated.localeCompare(x.updated)).slice(0, Math.min(+a.limit || 25, 100));
    return l.length ? `${list.length} memories total.\n` + l.map(fmt).join("\n") : "No memories yet.";
  }
  if (name === "update_memory") {
    const m = list.find(x => x.id === a.id); if (!m) return "Not found.";
    if (a.text) m.text = String(a.text).slice(0, 2000); if (TOPICS.includes(a.topic)) m.topic = a.topic; if (a.tags) m.tags = a.tags.map(t => String(t).toLowerCase()).slice(0, 4);
    m.updated = now; m.by = by; await saveMem(env, list); return "Updated " + fmt(m);
  }
  if (name === "forget") { const n = list.length; const l = list.filter(x => x.id !== a.id); await saveMem(env, l); return n === l.length ? "Not found." : "Forgot " + a.id; }
  throw new Error("Unknown tool " + name);
}

async function mcp(req, env) {
  const h = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE" };
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...h, Allow: "POST" } });
  const ua = (req.headers.get("User-Agent") || "").toLowerCase();
  const by = /openai|chatgpt/.test(ua) ? "ChatGPT" : /claude|anthropic/.test(ua) ? "Claude" : "AI";
  let body; try { body = await req.json(); } catch { return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }), { status: 400, headers: h }); }
  const handle = async msg => {
    const { id, method, params = {} } = msg;
    if (id === undefined || id === null) return null; // notification
    const ok = result => ({ jsonrpc: "2.0", id, result });
    try {
      if (method === "initialize") return ok({ protocolVersion: params.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "braeden-memory", version: "1.0.0" }, instructions: "Braeden Fonte's shared memory bank, used by both Claude and ChatGPT. Search it when a question depends on Braeden's life, classes, website, plans or preferences. Save durable facts he states with remember (one fact each, search first to avoid duplicates). Never store passwords, account numbers or other secrets." });
      if (method === "ping") return ok({});
      if (method === "tools/list") return ok({ tools: TOOLS });
      if (method === "tools/call") {
        try { return ok({ content: [{ type: "text", text: await runTool(params.name, params.arguments || {}, env, by) }] }); }
        catch (e) { return ok({ content: [{ type: "text", text: "Error: " + e.message }], isError: true }); }
      }
      if (method === "resources/list") return ok({ resources: [] });
      if (method === "prompts/list") return ok({ prompts: [] });
      return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } };
    } catch (e) { return { jsonrpc: "2.0", id, error: { code: -32603, message: String(e.message || e) } }; }
  };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter(Boolean);
    return out.length ? new Response(JSON.stringify(out), { headers: h }) : new Response(null, { status: 202, headers: h });
  }
  const r = await handle(body);
  return r ? new Response(JSON.stringify(r), { headers: h }) : new Response(null, { status: 202, headers: h });
}

/* ======================= Instant texting (Inkbox iMessage) ======================= */
const INKBOX = "https://inkbox.ai/api/v1";
const REPO = "braedenfonte/braedenfonte.github.io";
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const TZ = "America/New_York";

function etParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short", timeZoneName: "shortOffset" });
  const o = Object.fromEntries(f.formatToParts(d).map(p => [p.type, p.value]));
  const m = /GMT([+-]\d+)/.exec(o.timeZoneName || "GMT-5"); const h = parseInt(m ? m[1] : "-5", 10);
  const off = (h < 0 ? "-" : "+") + String(Math.abs(h)).padStart(2, "0") + ":00";
  const hour = o.hour === "24" ? "00" : o.hour;
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${hour}:${o.minute}`, hour: +hour, wd: o.weekday,
           iso: `${o.year}-${o.month}-${o.day}T${hour}:${o.minute}:00${off}` };
}

async function gh(env, path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, { ...opts,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "bf-texts", Accept: "application/vnd.github+json", ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`GitHub ${path} ${r.status}`);
  return r.json();
}
const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), c => c.charCodeAt(0)));
const b64enc = s => { const b = new TextEncoder().encode(s); let t = ""; for (const x of b) t += String.fromCharCode(x); return btoa(t); };
async function ghJson(env, path) { const f = await gh(env, path); return { data: JSON.parse(b64dec(f.content)), sha: f.sha }; }

async function sendText(env, text) {
  const r = await fetch(`${INKBOX}/imessage/messages?agent_identity_id=${env.INKBOX_IDENTITY}`, { method: "POST",
    headers: { "X-API-Key": env.INKBOX_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ to: env.MY_PHONE, text: String(text).slice(0, 1500) }) });
  if (!r.ok) throw new Error(`Inkbox send ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function inkboxSetup(req, env) {
  const u = new URL(req.url);
  if (!env.ADMIN_TOKEN || u.searchParams.get("admin") !== env.ADMIN_TOKEN) return new Response("Wrong admin token", { status: 401 });
  const out = {};
  if (!(await env.TOKENS.get("txt:subscribed"))) {
    const r = await fetch(`${INKBOX}/webhooks/subscriptions`, { method: "POST",
      headers: { "X-API-Key": env.INKBOX_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ agent_identity_id: env.INKBOX_IDENTITY, url: `${u.origin}/inkbox`,
        event_types: ["imessage.received"], auth_token: env.INKBOX_HOOK_TOKEN }) });
    out.subscribe = r.status;
    const t = await r.text();
    if (!r.ok) return new Response(`Inkbox subscribe failed (${r.status}): ${t.slice(0, 300)}`, { status: 500 });
    await env.TOKENS.put("txt:subscribed", "1");
  } else out.subscribe = "already done";
  try { await ghJson(env, "data/todos.json"); out.github = "ok"; } catch (e) { out.github = String(e.message); }
  try { await sendText(env, "Instant texting is live. Text me anything."); out.text = "sent"; } catch (e) { out.text = String(e.message); }
  return new Response(JSON.stringify(out, null, 1), { headers: { "Content-Type": "application/json" } });
}

async function inkboxHook(req, env, ctx) {
  if (!env.INKBOX_HOOK_TOKEN || req.headers.get("Authorization") !== `Bearer ${env.INKBOX_HOOK_TOKEN}`)
    return new Response("no", { status: 401 });
  const ev = await req.json().catch(() => null);
  const m = ev && ev.data && ev.data.message;
  if (!ev || ev.event_type !== "imessage.received" || !m || m.direction !== "inbound") return new Response(null, { status: 204 });
  if ((m.remote_number || "") !== env.MY_PHONE || m.is_group) return new Response(null, { status: 204 });
  const key = "txt:seen:" + (ev.id || m.id);
  if (await env.TOKENS.get(key)) return new Response(null, { status: 204 });
  await env.TOKENS.put(key, "1", { expirationTtl: 172800 });
  ctx.waitUntil(handleText(env, String(m.content || "").trim()).catch(async e => {
    try { await sendText(env, "Something broke on my end (" + String(e.message || e).slice(0, 80) + "). Try again in a minute."); } catch (_) {}
  }));
  return new Response(null, { status: 204 });
}

async function sundayPing(env) {
  const n = etParts();
  if (n.wd !== "Sun" || n.hour !== 19) return;
  const k = "txt:cisping:" + n.date;
  if (await env.TOKENS.get(k)) return;
  await env.TOKENS.put(k, "1", { expirationTtl: 172800 });
  await sendText(env, "L&A tracker: log in to CIS in Chrome on your laptop and close the H3 L&A Excel file, then reply go.");
}

const HELP = `WHAT I CAN DO (instant, any wording)
1) MORNING TEXT (automatic 7:04am): day, classes, due, tests, to-dos, headlines
2) TO-DO LIST: add to-do haircut Fri 4pm / done haircut / clear all / todos
3) SCHEDULE: due / today / tomorrow / what's on Thursday
4) L&A TRACKER: Sunday ~7pm CIS text, reply go
5) PRICE ALERTS (in the morning text): SJU to BWI under $700, weekend fare $250 or less
Plus: ask me anything.`;

async function handleText(env, text) {
  const now = etParts();
  const [todos, brief, codes] = await Promise.all([
    ghJson(env, "data/todos.json"), ghJson(env, "data/brief.json").catch(() => ({ data: {} })),
    ghJson(env, "routines/day-codes.json").catch(() => ({ data: {} }))]);
  const soon = {}; for (let i = -1; i < 21; i++) {
    const d = etParts(new Date(Date.now() + i * 864e5)).date; const c = codes.data[d] || (codes.data.codes || {})[d];
    soon[d + " " + new Date(d + "T12:00:00Z").toUTCString().slice(0, 3)] = c || "?";
  }
  const hist = (await env.TOKENS.get("txt:hist", "json")) || [];
  const sys = `You are Braeden's texting assistant for his personal website. Braeden is a West Point cadet (Company H3, OR major).
Now: ${now.wd} ${now.date} ${now.time} ET.
Day codes (date: code; "1-30" = Day 1 lesson 30, "2-30" = Day 2, "N/A" = no class): ${JSON.stringify(soon)}
Class times: Day 1 = MA376 0740, SS388 0905, EM481 1410. Day 2 = MA486 0740, MA481X 0845, MS300 1035.
Site to-do list (id, title, tag, sessions): ${JSON.stringify(todos.data.items || [])}
Today's brief (due = next 7 days of assignments, tests, headlines; may be from an earlier day): ${JSON.stringify(brief.data)}
Help menu (send it verbatim if he asks for help or what you can do): ${JSON.stringify(HELP)}

Reply ONLY with one JSON object:
{"reply":"text to send back (plain, short, no markdown, under 600 chars)",
 "ops":[ {"op":"add","title":"...","tag":"MA376|SS388|EM481|MA486|MA481X|MS300|Military|Personal","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM or omit","label":"optional short label"},
         {"op":"remove","id":"<existing id>"}, {"op":"clear"} ],
 "run_la": false}
Rules: ops only when he asks to change the to-do list. Turn "Fri", "tomorrow", "tonight" into real dates (next occurrence). No time given: start "00:00", end "23:59", label "Any time".
"remove": only ids that clearly match; if unclear, ask which one and use no ops. Set run_la true only when he says go / run the L&A tracker.
For questions, answer from the data above or general knowledge; say so if you don't know (you can't browse the web). Never invent due dates.`;
  const messages = [{ role: "system", content: sys }, ...hist.slice(-8), { role: "user", content: text }];
  const out = await env.AI.run(MODEL, { messages, max_tokens: 800, temperature: 0.2 });
  let raw = typeof out.response === "string" ? out.response : JSON.stringify(out.response || "");
  let plan; try { plan = typeof out.response === "object" && out.response ? out.response : JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); }
  catch (_) { plan = { reply: raw.replace(/[{}"]/g, "").slice(0, 600) || "Sorry, I didn't get that. Text help.", ops: [] }; }

  const ops = Array.isArray(plan.ops) ? plan.ops : [];
  let items = todos.data.items || [], changed = [];
  for (const o of ops) {
    if (o.op === "clear") { changed.push(`cleared ${items.length}`); items = []; }
    else if (o.op === "remove") { const b = items.length; items = items.filter(i => i.id !== o.id); if (items.length < b) changed.push("removed " + o.id); }
    else if (o.op === "add" && o.title && /^\d{4}-\d{2}-\d{2}$/.test(o.date || "")) {
      const s = { date: o.date, start: /^\d\d:\d\d$/.test(o.start || "") ? o.start : "00:00" };
      if (o.end && /^\d\d:\d\d$/.test(o.end)) s.end = o.end; if (o.label) s.label = String(o.label).slice(0, 30);
      const id = String(o.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) + "-" + Date.now().toString(36).slice(-4);
      items.push({ id, title: String(o.title).slice(0, 120), tag: o.tag || "Personal", sessions: [s] }); changed.push("added " + id);
    }
  }
  if (changed.length) {
    const body = JSON.stringify({ ...todos.data, updated: now.iso, items }, null, 2) + "\n";
    await gh(env, "data/todos.json", { method: "PUT", body: JSON.stringify({ message: "Text update: " + changed.join(", "),
      content: b64enc(body), sha: todos.sha, committer: { name: "Braeden Fonte", email: "bfonte18@gmail.com" } }) });
  }
  let reply = String(plan.reply || "Done.");
  if (plan.run_la) {
    if (env.LA_FIRE_URL && env.LA_FIRE_TOKEN) {
      const r = await fetch(env.LA_FIRE_URL, { method: "POST", headers: { Authorization: `Bearer ${env.LA_FIRE_TOKEN}`,
        "anthropic-version": "2023-06-01", "anthropic-beta": "experimental-cc-routine-2026-04-01", "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Braeden texted go: CIS should be logged in now." }) });
      const la = r.ok ? "Running the L&A tracker now. The names will show up in Claude." : `Couldn't start the L&A tracker (${r.status}). Run it from Claude.`;
      reply = ops.length ? reply + "\n" + la : la;
    } else reply = "The L&A tracker's API trigger isn't set up yet. It'll still run at 7:38 PM.";
  }
  await sendText(env, reply);
  hist.push({ role: "user", content: text.slice(0, 500) }, { role: "assistant", content: reply.slice(0, 500) });
  await env.TOKENS.put("txt:hist", JSON.stringify(hist.slice(-12)), { expirationTtl: 86400 * 3 });
}
