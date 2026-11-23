// Builds data/uniform.json for Braeden's 6:30 AM uniform heads-up Shortcut.
// Lookup:  uniform.json["<Weekday>"]["<feels-like °F, rounded>"]  -> uniform text
//          uniform.json["rain"]["<Weekday>"]["<weather code>"]    -> extra rain/snow line
// Mon-Thu = As For Class (AFC). Fri = ACU. No weekends.
// Run after changing the rules:  node tools/makeuniform.js
const fs = require("fs"), path = require("path");

function afc(t){
  if (t >= 60) return "short-sleeve shirt and M/E trousers.";
  if (t >= 50) return "short-sleeve shirt, M/E trousers, and black jacket.";
  if (t >= 40) return "long-sleeve shirt, M/E trousers, black jacket, and black dress gloves.";
  if (t >= 33) return "long-sleeve shirt, M/E trousers, black jacket, and black dress gloves. No short-sleeve shirt.";
  return "long-sleeve shirt, M/E trousers, black jacket, black dress gloves, PLUS parka, knit hat, and scarf.";
}
function acu(t){
  if (t >= 50) return "ACU top, bottoms, and patrol cap.";
  if (t >= 40) return "ACU top, bottoms, patrol cap, ECWCS Level V, and black gloves.";
  return "ACU top, bottoms, ECWCS Level V, black gloves, and fleece cap (or patrol cap).";
}

// open-meteo weather codes
const RAIN = [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99];
const SNOW = [71,73,75,77,85,86];

const out = {rain: {}};
for (const day of ["Monday","Tuesday","Wednesday","Thursday","Friday"]){
  const isAcu = day === "Friday", name = isAcu ? "ACU" : "As For Class";
  out[day] = {};
  for (let t = -40; t <= 115; t++)
    out[day][String(t)] = name + " today (feels like " + t + "°): " + (isAcu ? acu(t) : afc(t));
  out.rain[day] = {};
  for (const c of RAIN) out.rain[day][String(c)] = isAcu ? " Raining: add Gore-Tex (ECWCS Level VI)." : " Raining: bring the raincoat.";
  for (const c of SNOW) out.rain[day][String(c)] = isAcu ? " Snowing: add ECWCS Level V." : " Snowing: bundle up and bring the raincoat.";
}
fs.writeFileSync(path.join(__dirname, "../data/uniform.json"), JSON.stringify(out) + "\n");
console.log("ok");
