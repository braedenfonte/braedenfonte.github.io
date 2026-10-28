# Health check

Makes sure the other routines worked, and re-runs one ONCE if it didn't. Routine name for the log: `health-check`.
Follow `routines/common.md` for the run log, alerts and committing (allowed file: `routines/runs.log` only).

It runs twice a day. Which routine to check depends on the time:
- **Evening run (after noon)** -> check `nightly-prep` (the task whose name starts with "Nightly class prep").
- **Morning run (before noon)** -> check `morning-update` (the task whose name starts with "Morning website update").

## Steps
1. The re-run uses each task's API trigger. Its address and key are environment variables in the
   Routines environment: `NIGHTLY_FIRE_URL` + `NIGHTLY_FIRE_TOKEN` (nightly-prep) and
   `MORNING_FIRE_URL` + `MORNING_FIRE_TOKEN` (morning-update). Never print the token.
   If the pair for the routine you're checking is missing, you can't retry: note
   "Can't re-run <routine>: add its API trigger URL and token to the Routines environment" and skip step 3's re-run.
2. Read the newest lines of `routines/runs.log` and decide if the routine worked:
   - Evening: there should be a `nightly-prep` line written after 3 PM today.
   - Morning: there should be a `morning-update` line from today, AND `data/daily.json` "updated" is from today.
   It worked if that line exists and says OK. It did NOT work if the line is missing or says FAIL.
3. If it did not work, and the log has NO `health-check | RETRY <routine>` line from today:
   - Re-run it now:
     `curl -sS -X POST "$NIGHTLY_FIRE_URL" -H "Authorization: Bearer $NIGHTLY_FIRE_TOKEN" -H "anthropic-beta: experimental-cc-routine-2026-04-01" -H "anthropic-version: 2023-06-01" -H "Content-Type: application/json" -d '{"text":"Re-run by the health check"}'`
     (use the MORNING_ pair for morning-update). A reply with "claude_code_session_url" means it started.
     If it errors, note "Re-run of <routine> failed: <short error>".
   - Write the log line `<time> | health-check | RETRY <routine> | <why: missing or the FAIL reason> |`, commit and push.
   - Then finish WITHOUT an alert. The retried routine sends its own alert if it fails again.
4. If it did not work and a retry already happened today, don't retry again: note "<routine> failed twice: <reason>".
   If the reason mentions the Canvas key expiring, note: "Canvas key expired: make a new token in Canvas
   (Account > Settings > New Access Token) and replace the 'Canvas' secret in the Routines environment".
5. If you noted anything, send ONE phone notification (PushNotification) with the notes. If all is fine, send nothing.
6. Append the log line (`OK` if the routine worked, otherwise `FAIL` with the notes), commit and push.

Never change any scheduled task. The only action allowed is one re-run per routine per day.
