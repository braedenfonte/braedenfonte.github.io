# Morning text (daily ~7:04 AM ET)

Read `routines/common.md`, then `routines/texting.md`. Routine name for the log: `morning-text`.
Edit ONLY `routines/runs.log`. Commit and push it as in common.md.

## 1) Gather
- Today's date (clock tool, America/New_York) and its code in `routines/day-codes.json`.
- `data/brief.json`. If its "date" is not today (the morning update hasn't finished), wait 10 minutes and
  `git pull` once more. Still old: build the text from day-codes.json and data/todos.json only, and add
  "(site update still running)" at the end.

## 2) Write one text (about 600 characters max)
```
Mon Nov 9 · Day 1 (L30)
Classes: MA376 0740, SS388 0905, EM481 1410
Due this week:
- MA376 Memo 5 (Wed)
- SS388 Quiz 5 (Fri)
Tests/quizzes: SS388 WPR 2 Dec 2
To-do today: Turn in Memo 4
Army @ Navy Sat 3PM · Bills 6-2, next vs MIA Sun
S&P 500 +0.4%
```
- No classes ("N/A" or weekend): say "No classes today" and skip the Classes line.
- Due list: from brief.json "due" (next 7 days, soonest first, max 6). Quizzes/tests within 14 days.
- To-do today: data/todos.json sessions dated today (max 3).
- Headlines: brief.json "headlines" (max 3, one line each).
- Alerts: if brief.json "alerts" is non-empty, start the text with "ALERT: " + each alert on its own line.

## 3) Send, log, done
Send with `inkbox_imessage_send`. Log: `<time> | morning-text | OK | sent (N due, M alerts) |`.
Never put prices, balances or his number in the log.
