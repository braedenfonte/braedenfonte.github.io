// Prints the classes Braeden actually has on a date, with times.
// Run: node tools/classes.js             (today in New York)
//      node tools/classes.js 2026-11-20  (any date)
//
// Friday drop rule: the 75-minute classes (SS388, MS300, EM481) are DROPPED on a Friday
// if that class already met twice earlier the same week (Mon-Thu).
const fs = require("fs"), path = require("path");
const codes = JSON.parse(fs.readFileSync(path.join(__dirname, "../routines/day-codes.json"), "utf8"));

const DAY1 = [["MA376","0740"],["SS388","0905"],["EM481","1410"]];
const DAY2 = [["MA486","0740"],["MA481X","0845"],["MS300","1035"]];
const LONG = ["SS388","MS300","EM481"];   // the 75-minute classes

// "2026-11-20" -> date one or more days earlier/later
const shift = (ds, n) => { const d = new Date(ds + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); };
const weekday = ds => new Date(ds + "T12:00:00Z").getUTCDay();   // 0 Sun ... 5 Fri
const dayType = ds => { const c = codes[ds] || ""; return c.startsWith("1-") ? 1 : c.startsWith("2-") ? 2 : 0; };

function classesOn(ds){
  const t = dayType(ds);
  if (!t) return {date: ds, code: codes[ds] || "N/A", classes: [], dropped: []};
  let list = t === 1 ? DAY1 : DAY2, dropped = [];
  if (weekday(ds) === 5){
    // how many times did this Day type meet Mon-Thu of the same week?
    let met = 0; for (let i = 1; i <= 4; i++) if (dayType(shift(ds, -i)) === t) met++;
    if (met >= 2){ dropped = list.filter(c => LONG.includes(c[0])).map(c => c[0]); list = list.filter(c => !LONG.includes(c[0])); }
  }
  return {date: ds, code: codes[ds], classes: list.map(c => c[0] + " " + c[1]), dropped};
}

if (require.main === module){
  const ds = process.argv[2] || new Date().toLocaleDateString("en-CA", {timeZone: "America/New_York"});
  console.log(JSON.stringify(classesOn(ds)));
}
module.exports = {classesOn};
