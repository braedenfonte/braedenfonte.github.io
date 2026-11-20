// Builds data/days.json, which Braeden's iPhone Shortcuts read.
// For every date in routines/day-codes.json:
//   "alarm": "on" on class days, "off" on weekends / N/A days
//   "7", "8", "10", "14": class reminder text for the automation that fires in that hour
//     (10 minutes before class: 7:30, 8:35 or 8:55, 10:25, 2:00 PM)
// Run after day-codes.json changes:  node tools/makedays.js
const fs = require("fs"), path = require("path");
const {classesOn} = require("./classes.js");
const codes = JSON.parse(fs.readFileSync(path.join(__dirname, "../routines/day-codes.json"), "utf8"));

const NAME = {MA376:"Stats (MA376)", SS388:"Macro (SS388)", EM481:"Simulation (EM481)",
              MA481X:"Optimization (MA481X)", MA486:"MA486", MS300:"MS300"};
const pretty = hm => { let h = +hm.slice(0,2); const m = hm.slice(2); const ap = h >= 12 ? "PM" : "AM"; if (h > 12) h -= 12; return h + ":" + m + " " + ap; };
const hourOfReminder = hm => { const mins = +hm.slice(0,2)*60 + +hm.slice(2) - 10; return String(Math.floor(mins/60)); };

const out = {};
for (const ds of Object.keys(codes).sort()){
  const r = classesOn(ds), day = {alarm: r.classes.length ? "on" : "off"};
  for (const c of r.classes){
    const [code, hm] = c.split(" ");
    day[hourOfReminder(hm)] = NAME[code] + " starts at " + pretty(hm) + ". Tap to open your prep.";
  }
  if (r.dropped.length) day.drops = r.dropped.map(c => NAME[c]).join(", ");
  out[ds] = day;
}
fs.writeFileSync(path.join(__dirname, "../data/days.json"), JSON.stringify(out, null, 1) + "\n");
console.log("wrote", Object.keys(out).length, "days");
