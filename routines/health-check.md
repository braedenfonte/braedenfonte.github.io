# Health check

Makes sure the other routines worked, and re-runs one ONCE if it didn't. Routine name for the log: `health-check`.
Follow `routines/common.md` for the run log, alerts and committing (allowed file: `routines/runs.log` only).

It runs twice a day. Which routine to check depends on the time:
- **Evening run (after noon)** -> check `nightly-prep` (the task whose name starts with "Nightly class prep").
- **Morning run (before noon)** -> check `morning-update` (the task whose name starts with "Morning website update").

## Steps
1. List scheduled tasks with `list_triggers` (Claude Code Remote connector; load it with ToolSearch).
   If `list_triggers` or `fire_trigger` doesn't exist in this session, you can't retry: note
   "Health check can't re-run tasks: add the Claude Code Remote connector to this check task (Edit > Connectors)"
   and still do steps 2, 4, 5 and 6. Find the task for the routine
   you're checking. Old paused copies with the same name may exist: always use the one that is turned ON
   (the cloud one, labeled Code). Ignore paused ones.
   If none is on, note "<name> is turned off" and skip to step 5. Never turn a task on or off yourself.
2. Read the newest lines of `routines/runs.log` and decide if the routine worked:
   - Evening: there should be a `nightly-prep` line written after 3 PM today.
   - Morning: there should be a `morning-update` line from today, AND `data/daily.json` "updated" is from today.
   It worked if that line exists and says OK. It did NOT work if the line is missing or says FAIL.
3. If it did not work, and the log has NO `health-check | RETRY <routine>` line from today:
   - Re-run it now with `fire_trigger` on that task's id.
   - Write the log line `<time> | health-check | RETRY <routine> | <why: missing or the FAIL reason> |`, commit and push.
   - Then finish WITHOUT an alert. The retried routine sends its own alert if it fails again.
4. If it did not work and a retry already happened today, don't retry again: note "<routine> failed twice: <reason>".
   If the reason mentions the Canvas key expiring, note: "Canvas key expired: make a new token in Canvas
   (Account > Settings > New Access Token) and replace the 'Canvas' secret in the Routines environment".
5. If you noted anything, send ONE phone notification (PushNotification) with the notes. If all is fine, send nothing.
6. Append the log line (`OK` if the routine worked, otherwise `FAIL` with the notes), commit and push.

Never change a scheduled task's prompt, schedule, model or on/off state. The only action allowed is one re-run per routine per day.
