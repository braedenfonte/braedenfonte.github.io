// Prints today's song and quote of the day, the same ones the website shows.
// Run: node tools/daypicks.js            (uses today's date in New York)
//      node tools/daypicks.js 2026-11-20 (any date)
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");

// 1) which day number is it? (days since Jan 1, 2026 — same math as js/app.js)
const arg = process.argv[2] || new Date().toLocaleDateString("en-CA", {timeZone: "America/New_York"});
const [y, m, d] = arg.split("-").map(Number);
const n = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 864e5);
const pick = list => list[((n % list.length) + list.length) % list.length];

// 2) song list lives inside js/app.js, so read it from there
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const block = app.slice(app.indexOf("const SONGS = ["), app.indexOf("function renderSong"));
const SONGS = eval(block.replace("const SONGS =", "(") .replace(/;\s*$/, "") + ")");
const s = pick(SONGS);

// 3) quotes live in data/quotes.json
const q = pick(JSON.parse(fs.readFileSync(path.join(root, "data/quotes.json"), "utf8")).quotes);

// 4) compliment of the day (alarm only) lives in data/compliments.json
const c = pick(JSON.parse(fs.readFileSync(path.join(root, "data/compliments.json"), "utf8")).compliments);

console.log(JSON.stringify({song: s[0] + " · " + s[1], quote: "“" + q.q + "” — " + q.a, compliment: c}, null, 1));
