# Morning text (daily ~7:04 AM ET)

Read `routines/common.md`, then `routines/texting.md`. Routine name for the log: `morning-text`.
Edit ONLY `routines/runs.log`. Commit and push it as in common.md.

## 1) Gather
- Today's date (clock tool, America/New_York) and its code in `routines/day-codes.json`.
- `data/brief.json`. If its "date" is not today (the morning update hasn't finished), wait 10 minutes and
  `git pull` once more. Still old: build the text from day-codes.json and data/todos.json only, and add
  "(site update still running)" at the end.

- Song and quote of the day: run `node tools/daypicks.js` (same picks the website shows today).

## 2) Write one text (about 900 characters max)
Easy to read on a phone: a short header per section, one item per line, and a BLANK LINE between
every section. Leave out any section that has nothing in it (no empty headers).
```
☀️ Mon Nov 9 · Day 1 (L30)

📚 CLASSES
MA376 · 0740
SS388 · 0905
EM481 · 1410

📝 DUE THIS WEEK
• MA376 Memo 5 (Wed)
• SS388 Quiz 5 (Fri)

🎯 TESTS / QUIZZES
• SS388 WPR 2 (Dec 2)

✅ TO-DO TODAY
• Turn in Memo 4

🏈 Army @ Navy Sat 3PM
🦬 Bills 6-2, next vs MIA Sun
📈 S&P 500 +0.4%

🎵 SONG OF THE DAY
Hotline Bling · Drake

💬 QUOTE OF THE DAY
“Do what you can, with what you have, where you are.” — Theodore Roosevelt
```
- No classes ("N/A" or weekend): put "📚 No classes today" in place of the Classes section.
- Song and quote always go last. Copy them exactly from tools/daypicks.js (song title and artist only, never lyrics).
- Due list: from brief.json "due" (next 7 days, soonest first, max 6). Quizzes/tests within 14 days.
- To-do today: data/todos.json sessions dated today (max 3).
- Headlines: brief.json "headlines" (max 3, one line each).
- Alerts: if brief.json "alerts" is non-empty, start the text with "🚨 ALERT" on its own line, then each alert on its own line, then a blank line.

## 3) Send, log, done
Send with `inkbox_imessage_send`. Log: `<time> | morning-text | OK | sent (N due, M alerts) |`.
Never put prices, balances or his number in the log.
