// Builds data/sleep.json for tonight's bedtime brief.
// Key = the time he turns on Night Focus ("22:47"), value = a spoken line about hours of sleep
// until tomorrow's wake time (from data/days.json: 6:40 AM class days, 9:00 AM otherwise).
// Run in the nightly routine:  node tools/makesleep.js YYYY-MM-DD   (date = TOMORROW)
const fs = require("fs"), path = require("path");
const tomorrow = process.argv[2];
if (!tomorrow) { console.error("usage: node tools/makesleep.js YYYY-MM-DD"); process.exit(1); }
const days = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/days.json"), "utf8"));
const wakeTxt = (days[tomorrow] && days[tomorrow].wake) || "6:40 AM";

// wake time as minutes after midnight
const [hm, ap] = wakeTxt.split(" ");
let [wh, wm] = hm.split(":").map(Number);
if (ap === "PM" && wh !== 12) wh += 12;
if (ap === "AM" && wh === 12) wh = 0;
const wake = wh * 60 + wm;

const pad = n => String(n).padStart(2, "0");
const out = {};
for (let t = 18 * 60; t < 30 * 60; t++) {          // 6:00 PM tonight to 5:59 AM
  const mins = wake + 24 * 60 - t;                  // minutes until tomorrow's wake time
  if (mins <= 0) continue;
  const hrs = Math.round(mins / 6) / 10;            // tenths of an hour
  const key = pad(Math.floor(t / 60) % 24) + ":" + pad(t % 60);
  out[key] = "If you fall asleep now, you'll get " + hrs + " hours of sleep before your " + wakeTxt + " alarm.";
}
fs.writeFileSync(path.join(__dirname, "../data/sleep.json"), JSON.stringify(out) + "\n");
console.log("wake", wakeTxt, "-", Object.keys(out).length, "times");
