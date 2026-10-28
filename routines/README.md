# Routines

The instructions for Braeden's scheduled tasks live here, one file per task.
Each scheduled task's own prompt is only one line: "follow routines/<file>.md".
To change or fix a routine, edit its file here. Nothing else needs to be rebuilt.

| File | When it runs | What it does |
|---|---|---|
| `nightly-prep.md` | Sun-Thu 6:43 PM ET | Prep sheets for tomorrow's classes, archived on the site |
| `morning-update.md` | Daily 6:30 AM ET | Football, Bills, place of the day, markets, finance, study decks, flights |
| `health-check.md` | Daily 7:13 AM ET | Checks the other two ran, turns a paused one back on, alerts on problems |
| `common.md` | (read by all) | Shared rules: Canvas, run log, alerts, how to commit |
| `runs.log` | (written by all) | One line per run: what worked, what failed and why |

Fixing a broken routine: open `runs.log`, find the FAIL line, fix the step in that routine's file.
No keys or passwords ever go in these files. The Canvas key is a network secret in the
"Routines" cloud environment.
