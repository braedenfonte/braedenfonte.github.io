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
 */
const PUB = {"kty":"RSA","alg":"RSA-OAEP-256","e":"AQAB","n":"q-2JOdKVCRO5HUhaqMY82-FPM4WBE1t0R6xTZlwme8vdYx7DyuZ11cZc0X2Ow7LUnRqhkF1ADom8fDpnMwYv7WW1AivMfEPDbwGHtDR3TjjPtJ3FmaJXJqlYeSzHBn37GcNXEpOg61pyJbIJeZbxuOajig516S_PlR3EQz83wIYLPHYw13s8uBTMvStNKo_UdigYUIzids6ltHS0Tzy-LZxPDGgnWJZxjYvOGMRER75z7ShpAQBpVq0bCX90IshN43LKMVWIS7TcwKRRxRz7qfFL5ohn0MWsf6Sf2z_ADKL7uWbKErRWHi9-TQX2eaMFY2P6mIaTQSWCkXzulHf5nQ","ext":true,"key_ops":["encrypt"]};
const ORIGINS = ["https://braedenfonte.com", "https://www.braedenfonte.com", "https://braedenfonte.github.io", "http://localhost:8765"];
const WANT = ["Chase", "Capital One", "Robinhood", "American Express"];
const CACHE_SECONDS = 300;
const PLAID = "https://production.plaid.com";

export default {
  async fetch(req, env) {
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
