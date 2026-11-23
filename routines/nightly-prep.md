# Nightly class prep

Make prep sheets for TOMORROW's classes only, then archive them on the website.
Follow `routines/common.md` (Canvas, run log, alerts, committing). Routine name for the log: `nightly-prep`.

## Rule 0: Never die silently
- Spend at most 10 minutes on any one step. If a download or site is blocked (403, 406, "not allowed"),
  do NOT try workarounds (other hosts, mirrors, browser, retries in a loop): note it and move on.
- No matter what happens, the run must END by appending a `nightly-prep` line to `routines/runs.log`
  (OK or FAIL with the reason), committing and pushing it, and sending the alert if it failed.

## Rule 1: Phone files, EVERY run (even "no classes tomorrow" runs and failed runs)
Right before the final commit, always do both (they ride along in the same commit):
- `node tools/makedays.js` (rebuilds data/days.json for his auto-alarm and class-reminder Shortcuts).
- `node tools/makesleep.js <tomorrow>` (rebuilds data/sleep.json: hours-of-sleep line for every bedtime minute).
- Write the bedtime brief his phone reads aloud when he turns on his "Night" Focus. Two PUBLIC files, spoken
  plain text, no emojis/symbols/bullets, numbers said naturally. His phone speaks night.txt, then adds his
  hours of sleep and study minutes itself, then speaks night2.txt.
  data/night.txt (under 50 words), in this order:
    1. Tomorrow's classes from `node tools/classes.js <tomorrow>` by nickname (MA376 "Stats", SS388 "Macro",
       EM481 "Simulation", MA481X "Optimization", MA486 "M A four eighty-six", MS300 "M S three hundred"),
       with times, plus any Friday drop. No class: "No classes tomorrow."
    2. Due by the end of tomorrow (brief.json "due" + Canvas if you checked it), then the next big thing this
       week (test, quiz, WPR or major assignment) from brief.json "tests"/"due".
  data/night2.txt (under 110 words), in this order:
    8. Countdowns, whole days from TODAY's date: "<N> days until Christmas leave" (Dec 19, 2026) and
       "<N> days until Puerto Rico" (Dec 26, 2026). Drop each once its date has passed.
    10. Top 3 news headlines of today, one short sentence each (WebSearch; reliable outlets; neutral wording).
    11. How the S&P 500 closed today (up/down and percent, only from a source that states it). Weekend or
        market holiday: "Markets were closed today."
    14. This day in history for TOMORROW's date: one notable, true event, one sentence.
    15. The wild fact: copy "fact" from `node tools/daypicks.js <tomorrow>` word for word.
    End with the sign-off: copy "signoff" from `node tools/daypicks.js <tomorrow>` word for word.
  Example night.txt: "Tomorrow is Tuesday. You've got M A four eighty-six at seven forty, Optimization at
  eight forty-five, and M S three hundred at ten thirty-five. Nothing due tomorrow. Next big thing: Macro WPR 2
  on Wednesday, December 2nd."
  Example night2.txt: "26 days until Christmas leave, and 33 days until Puerto Rico. In the news: ... The S&P
  500 closed up half a percent. On this day in 1863, Lincoln gave the Gettysburg Address. Wild fact: Wombats
  poop cubes. ... Goodnight, sir. Sleep amazing."
Allowed to commit with these: data/days.json, data/sleep.json, data/night.txt and data/night2.txt.

## Step 1: Is tomorrow a Day 1, a Day 2, or no class?
West Point alternates Day 1 / Day 2.
- FIRST check the saved copy: `routines/day-codes.json` ({"YYYY-MM-DD": "1-23" | "2-24" | "N/A"}).
  If tomorrow's date is in it, use that code and skip the downloads below.
- Best source: the MA376 AY27-1 Calendar spreadsheet (course 12755, file 4662829, "Calendar" sheet):
  `python3 tools/canvas.py download 4662829 /tmp/cal.xlsx`, then read it with openpyxl
  (`pip install openpyxl` if missing). Each date has a code like "1-23" (Day 1, lesson 23),
  "2-24" (Day 2) or "N/A" (no class). Use it ONLY for the Day 1 / Day 2 code; its lesson titles are out of date.
- Backup source: the EM481 AY27-1 Calendar PDF (course 12497, file 4386831), same 1-NN / 2-NN codes.
- Whenever you DO read a calendar, save every date's code (the whole term) to `routines/day-codes.json`
  (sorted keys, indent=1) so later runs don't need the download. Commit it with the run.
- If tomorrow's code still can't be found (not saved and both downloads blocked): build nothing, log
  `FAIL | couldn't tell Day 1/Day 2: <error>. Fix: set Routines environment network access to Full`, alert, finish.
- If tomorrow is "N/A", a weekend, a holiday or leave: build nothing. Append the log line
  `OK | No classes tomorrow (<date>)`, do Rule 1 (phone files), commit, push, and finish.

## Step 2: Pick the courses
- Run `node tools/classes.js <tomorrow>`. Any course in its "dropped" list is a Friday drop (SS388/EM481/MS300
  already met twice that week): build no prep for it and log it as "<course> drop", not a failure.
- Day 1 -> MA376, SS388, EM481 (skills: ma376-class-prep, ss388-class-prep, em481-class-prep)
  SS388: tomorrow's lesson comes from `routines/ss388-schedule.json`; if tomorrow isn't in it, SS388 has no class (skip, not a failure).
- Day 2 -> MA486, MA481X (skills: ma486-class-prep, ma481x-class-prep). MS300 has no prep skill; skip it.
Never run Day 1 skills before a Day 2, or Day 2 skills before a Day 1.

## Step 3: For each course, check its own schedule first
- Use that course's own lesson schedule / calendar / syllabus (the source in the "Get the lesson
  material" section of its skill; Canvas through tools/canvas.py, or the public MA486 website with WebFetch).
- SKIP the course (no skill run, no page change, no archive) if tomorrow's entry is a drop, "no class",
  "N/A", blank, a holiday, or tomorrow's date isn't on its schedule. A skip is not a failure.
- Otherwise run its skill with the Skill tool and follow it fully, including publishing to its existing
  "<COURSE> Class Prep" artifact so the link stays the same. "Next class" = tomorrow's lesson.
  For the page itself, use the layout in `routines/prep-format.md` INSTEAD of the skill's section 3.
  When the Canvas lesson page and the calendar disagree on the title, trust the lesson page.
- For each course you built, note: course, lesson number, date (YYYY-MM-DD), title, Day 1/Day 2,
  artifact URL, and the local path of the HTML file you published.
- If a course's material can't be read, log it as a failure for that course and keep going.

## Step 4: Archive on the website (only courses built in Step 3)
- In this repo, for each built course run:
  `python3 tools/prep.py add <COURSE> <html file> --lesson <N> --date <YYYY-MM-DD> --title "<title>" --day "<Day 1|Day 2>" --url <artifact URL>`
  (If the HTML file is gone, read the artifact's index.html with the Artifact tool and pass that.)
  Re-running for the same course and date replaces that sheet. `pip install cryptography` if missing.
- Validate: `python3 -c "import json;json.load(open('data/prep/manifest.json'))"`.
- Allowed files to commit: `data/prep/`, `routines/day-codes.json`, `data/days.json`, `data/sleep.json`, `data/night.txt`, `data/night2.txt` and `routines/runs.log`. Make sure no plain .json sheet is staged.
- Append the run log line (common.md) BEFORE committing, then commit once with message
  "Prep sheets <tomorrow's date>: <courses>" and push.

## Step 5: Finish
Send an alert only if something failed (see common.md), then reply:
"Tomorrow is Day 1" or "Tomorrow is Day 2", then one line per course:
"<COURSE> prep for Lesson N (<date>) is ready and archived." or "<COURSE> skipped: <reason>."
