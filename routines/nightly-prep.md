# Nightly class prep

Make prep sheets for TOMORROW's classes only, then archive them on the website.
Follow `routines/common.md` (Canvas, run log, alerts, committing). Routine name for the log: `nightly-prep`.

## Step 1: Is tomorrow a Day 1, a Day 2, or no class?
West Point alternates Day 1 / Day 2.
- Best source: the MA376 AY27-1 Calendar spreadsheet (course 12755, file 4662829, "Calendar" sheet):
  `python3 tools/canvas.py download 4662829 /tmp/cal.xlsx`, then read it with openpyxl
  (`pip install openpyxl` if missing). Each date has a code like "1-23" (Day 1, lesson 23),
  "2-24" (Day 2) or "N/A" (no class). Use it ONLY for the Day 1 / Day 2 code; its lesson titles are out of date.
- Backup source: the EM481 AY27-1 Calendar PDF (course 12497, file 4386831), same 1-NN / 2-NN codes.
- If tomorrow is "N/A", a weekend, a holiday or leave: build nothing. Append the log line
  `OK | No classes tomorrow (<date>)`, commit just routines/runs.log, push, and finish.

## Step 2: Pick the courses
- Day 1 -> MA376, SS388, EM481 (skills: ma376-class-prep, ss388-class-prep, em481-class-prep)
- Day 2 -> MA486, MA481X (skills: ma486-class-prep, ma481x-class-prep). MS300 has no prep skill; skip it.
Never run Day 1 skills before a Day 2, or Day 2 skills before a Day 1.

## Step 3: For each course, check its own schedule first
- Use that course's own lesson schedule / calendar / syllabus (the source in the "Get the lesson
  material" section of its skill; Canvas through tools/canvas.py, or the public MA486 website with WebFetch).
- SKIP the course (no skill run, no page change, no archive) if tomorrow's entry is a drop, "no class",
  "N/A", blank, a holiday, or tomorrow's date isn't on its schedule. A skip is not a failure.
- Otherwise run its skill with the Skill tool and follow it fully, including publishing to its existing
  "<COURSE> Class Prep" artifact so the link stays the same. "Next class" = tomorrow's lesson.
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
- Allowed files to commit: `data/prep/` and `routines/runs.log`. Make sure no plain .json sheet is staged.
- Append the run log line (common.md) BEFORE committing, then commit once with message
  "Prep sheets <tomorrow's date>: <courses>" and push.

## Step 5: Finish
Send an alert only if something failed (see common.md), then reply:
"Tomorrow is Day 1" or "Tomorrow is Day 2", then one line per course:
"<COURSE> prep for Lesson N (<date>) is ready and archived." or "<COURSE> skipped: <reason>."
