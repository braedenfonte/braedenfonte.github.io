# Shared rules for every routine

Read this file first, then the routine's own file.

## Time
Get the current date/time from the clock tool first. Use America/New_York for everything.
Nobody is watching these runs: never stop to ask a question. Make the best call and note gaps.

## Web searches
Always put the current month and year in search queries (e.g. "Bills news October 2026"), or results come back from old seasons.

## Python
Install packages with `python3 -m pip install <name>` (not plain `pip`, which can install for a different Python).

## Canvas (no browser needed)
- Read Canvas with `python3 tools/canvas.py` from the repo root (see the top of that file for commands).
- Wherever a class-prep skill says "use Claude in Chrome for Canvas", use `tools/canvas.py` instead.
  Example: modules for a course: `python3 tools/canvas.py get "/courses/<id>/modules?include[]=items"`.
  Files: `python3 tools/canvas.py download <file_id> /tmp/<name>`, then read the file.
  Pages: `python3 tools/canvas.py get /courses/<id>/pages/<page_url>` (HTML in "body").
  Calendar/assignments: `/courses/<id>/assignments?bucket=upcoming`, `/calendar_events?context_codes[]=course_<id>&start_date=...`.
- Run `python3 tools/canvas.py check` once at the start. If it exits with code 2, the Canvas key
  expired: skip every Canvas part, and the alert must say "Canvas key expired, make a new one".
- To find a file by name (schedules, syllabi, calendars):
  `python3 tools/canvas.py get "/courses/<id>/files?search_term=<word>"` (e.g. search_term=schedule), then download it.
  The SS388 course schedule spreadsheet is NOT reachable from the cloud through a Project: always find it on Canvas this way.
- Known course ids: MA376 = 12755, EM481 = 12497. For others, run `python3 tools/canvas.py courses`.
- Never submit, post or change anything in Canvas. Read only.

## Chrome
Chrome (Claude in Chrome) works only when Braeden's laptop is on. Only use it where a routine
says so. If it can't be reached, skip that part quietly (it is NOT a failure, log it as "skipped").

## Run log (routines/runs.log)
At the very end, append exactly one line to `routines/runs.log`:
`<ISO time> | <routine name> | OK or FAIL | <what was done, short> | <what failed and why, or blank>`
Example: `2026-10-28T18:52-04:00 | nightly-prep | OK | MA376 L24, SS388 L20, EM481 skipped (drop) |`
A run is FAIL if any part that should have worked did not. A part that can't run because of an outside
limit is "skipped", not a failure: Chrome/laptop off, Era plan hiding accounts, no class tomorrow.
If a website is blocked (error mentions "not allowed", 403 or host_not_allowed), say so in the log line with
the website name and add: "fix: set Routines environment network access to Full".
Keep only the newest 200 lines (delete the oldest).

## Alerts
If the run is FAIL, send a phone notification with the PushNotification tool (load it with
ToolSearch). One short line: which routine, what broke, the likely fix. No numbers from finance.
If everything worked, send nothing.

## Committing
- Commit as "Braeden Fonte <bfonte18@gmail.com>".
- Only stage the files the routine's own file allows, plus `routines/runs.log`.
- `git fetch origin main` and `git rebase origin/main` first, then push to main. If the push is
  rejected, fetch, rebase again and push. Never force-push.
- Never edit `index.html`, anything in `routines/` except runs.log, or `tools/`.
