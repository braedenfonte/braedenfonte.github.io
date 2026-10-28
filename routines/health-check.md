# Daily health check

Make sure the other routines are alive and working. Routine name for the log: `health-check`.
Follow `routines/common.md` for the run log, alerts and committing (allowed file: `routines/runs.log` only).

1. List the scheduled tasks with `list_triggers` (Claude_Code_Remote connector).
   Find "Nightly class prep" and "Morning website update".
2. For each one:
   - If it is turned off (enabled = false) but NOT ended for good, turn it back on with
     `update_trigger` (enabled: true) and note "re-enabled <name>".
   - If its last_run status is not SUCCEEDED, note it with the failure reason.
3. Read the newest lines of `routines/runs.log`:
   - `morning-update` should have a line from today. `nightly-prep` should have a line from last night
     whenever last night was Sun-Thu. Missing line = note "<name> didn't finish".
   - Any FAIL line from the last 24 hours = note it.
   - Any line saying the Canvas key expired = note "Canvas key expired: make a new token in Canvas
     (Account > Settings > New Access Token) and replace the 'Canvas' secret in the Routines environment".
4. Check the site actually updated: `data/daily.json` "updated" is from today.
5. If you noted anything: send ONE phone notification (PushNotification) listing the notes, shortest first.
   If everything is fine, send nothing.
6. Append the log line, commit routines/runs.log and push.
Never change a scheduled task's prompt, schedule or model. Only turn paused ones back on.
