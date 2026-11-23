// Builds data/uniform.json for Braeden's 6:30 AM uniform heads-up Shortcut.
// Lookup:  uniform.json["<Weekday>"]["<feels-like °F, rounded>"]  -> uniform text
//          uniform.json["rain"]["<Weekday>"]["<weather code>"]    -> extra rain/snow line
// Mon-Thu = As For Class (AFC). Fri = ACU. No weekends.
// Run after changing the rules:  node tools/makeuniform.js
const fs = require("fs"), path = require("path");

// Outer garments only (what to grab on the way out).
function afc(t){
  if (t >= 60) return "No jacket, no gloves.";
  if (t >= 50) return "Black jacket. No gloves.";
  if (t >= 33) return "Black jacket + gloves.";
  return "Parka + gloves + knit hat.";
}
function acu(t){
  if (t >= 50) return "No Gore-Tex, no gloves.";
  if (t >= 40) return "Gore-Tex WITH patches (Level V) + gloves.";
  return "Gore-Tex WITH patches (Level V) + gloves + fleece cap.";
}

// open-meteo weather codes
const RAIN = [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99];
const SNOW = [71,73,75,77,85,86];

const out = {rain: {}};
for (const day of ["Monday","Tuesday","Wednesday","Thursday","Friday"]){
  const isAcu = day === "Friday", name = isAcu ? "ACU" : "AFC";
  out[day] = {};
  for (let t = -40; t <= 115; t++)
    out[day][String(t)] = name + " · feels " + t + "°: " + (isAcu ? acu(t) : afc(t));
  out.rain[day] = {};
  for (const c of RAIN) out.rain[day][String(c)] = isAcu ? " RAIN: wear Gore-Tex WITHOUT patches (Level VI) instead." : " RAIN: add raincoat.";
  for (const c of SNOW) out.rain[day][String(c)] = isAcu ? " SNOW: Gore-Tex WITH patches (Level V)." : " SNOW/SLEET: add raincoat.";
}
fs.writeFileSync(path.join(__dirname, "../data/uniform.json"), JSON.stringify(out) + "\n");
console.log("ok");
