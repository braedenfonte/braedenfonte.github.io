# Morning website update

Refresh the daily data, the study decks and the weekend flight deals, then commit and push ONCE.
Follow `routines/common.md` (Canvas, run log, alerts, committing). Routine name for the log: `morning-update`.

Edit ONLY: `data/daily.json`, `data/places_history.json`, `data/bills.json`, `data/finance.enc`,
`data/study.enc`, `routines/runs.log`. Keep every field name exactly as in the current files (read them
first and use them as templates). Set "updated" in daily.json to the current ISO time with offset.
If one part fails, keep that part's previous content, finish the others, and log which part failed.

## 1) Football ("football" in daily.json)
Use fetch_sports_data (league ncaafb) if available; otherwise WebSearch/WebFetch reliable recaps (ESPN,
CBS, Fox Sports, school sites). Get scores, then game stats for the 3 biggest games of the latest week.
- "label": e.g. "Week 8 recap".
- "results": up to 8 notable finished games of the latest week, each {away, home, as, hs, blurb (one
  short sentence), stats (0-3 short verified stat strings)}. Always include any Army, Navy or Air Force result.
- "upcoming": up to 5 games in the next 7 days, each {away, home, kick (ISO UTC), note}; include Army's
  next game with "army": true and a note like "Home at Michie Stadium" or "Away".

## 2) Bills (data/bills.json), every day, including bye weeks
Keep its structure exactly: updated, team, record {w,l}, standing, pf, pa, results
[{wk,date,opp,bs,os,res,note?}], afcEast [{team,w,l,me?}], lastGame {title, stats[]}, news [{h,b}]
(4 items), schedule [{kick (ISO, ET offset), opp, home, venue, note}], source.
Use WebSearch/WebFetch (buffalobills.com, ESPN, Fox Sports standings, NFL.com). Add newly finished games
to results (oldest first); update record, pf, pa, standing and all four AFC East records; rewrite lastGame
("Bills 33, Raiders 30" plus 4-5 verified stat lines); refresh the 4 news items with current verified
news; remove kicked-off games from schedule, keep all future ones. Set "updated" to now and "source" to a
short line of sources and date. Verify every number; if one can't be verified, keep its previous value.

## 3) Place of the day ("location" in daily.json)
One new place anywhere (landmark, national park, city, island, natural wonder), NOT in
data/places_history.json and NOT golf-related. Vary continents and types. Fields: name, wiki (exact
English Wikipedia title with underscores; confirm the page exists and has photos), country, region, lat,
lon, tagline, intro (2-3 sentences), stats (4 {label, value}), facts (4-5 surprising, verified facts),
bestTime, gettingThere (from New York), tip. Verify every fact. Append the name to places_history.json.

## 4) Markets & lines ("markets" in daily.json): information only, never picks or advice
- asOf: e.g. "Thu Oct 16 close" (most recent completed US trading day).
- story: 1-2 plain sentences on what drove the market.
- indices: Dow, S&P 500, Nasdaq, Russell 2000 as {name, value (string, commas, whole number), chg (%, 2 decimals)}.
- movers: 4-5 notable stocks {sym, move ("+5%", "−7%", "Upgrade"), dir (1 or -1), why}.
  Use a reliable market recap (WebSearch, then WebFetch). Only numbers stated in the source.
- lines: up to 3 upcoming games {game ("Away @ Home"), kick (ISO UTC), spread, total, ml}. Always include
  the Bills' next game with "bills": true when odds exist, plus the biggest college game in the next 7 days.
  Quote a published sportsbook article exactly; use the "−" minus sign. Remove kicked-off games.
- probs: up to 5 upcoming games (next 7 days) with the highest win probability from fetch_sports_data
  (or a named published model like ESPN FPI) as {game, fav, p (whole number)}; skip over 95%.
- sources: one short line.

## 5) Finance (encrypted: plain numbers must NEVER be committed or put in daily.json)
Call Era Context knowledge__get_financial_context_and_overview ONCE (no other Era calls). Write OUTSIDE
the repo, /tmp/finance.json:
{"asOf":"YYYY-MM-DD","accounts":[{"inst":"Chase","name":"Sapphire Reserve","type":"Credit card","mask":"3970","bal":196.87,"debt":true}, ...],
 "pending":[Robinhood / American Express / Chase / Capital One names NOT among linked institutions],
 "netWorth":<net_worth.amount>, "month":{"label":"Oct 1–16","income":..,"spending":..,"net":..},
 "lastMonth":{"label":"September","income":..,"spending":..,"net":..},
 "categories":[["Category", amount], ...top_categories in order], "flags":[short strings; omit zero counts]}
Short names: "Chase", "Capital One", "Robinhood", "American Express". Round to cents.
Run `python3 tools/finance.py seal /tmp/finance.json`, then delete /tmp/finance.json. If Era fails or
returns no accounts, leave data/finance.enc unchanged. Never print balances in the commit or summary.

## 6) Study decks (data/study.enc)
Courses: MA486 ("Python"), MA481X ("Optimization"), MA376 ("Stats"), EM481 ("Simulation"), SS388 ("Macro").
For EACH, pick today's lesson if it meets today, otherwise its next lesson within 7 days (skip if none).
Material: the "Get the lesson material" section of the matching class-prep skill. MA486 uses the public
site https://usma-ma486-mathcomp.s3.us-east-1.amazonaws.com/MA486_AY26-1/index.html (WebFetch; notes at
.../MA486_AY26-1/Lessons/ma486_ay27-01_LNN_notes.pdf). The other four: Canvas through `tools/canvas.py`
(NOT Chrome). Read the actual notes/slides/readings; never build from file names. Don't open boardsheet solutions.
Each entry: {"short":"Stats","term":"AY27-1","title":"<lesson title>","lesson":"Lesson N","lessonDate":"YYYY-MM-DD",
"cards":[["q","a"], ...8-12 on key terms, formulas, ideas], "problems":[{"q":"...","a":"worked answer"}, ...3-4],
"recap":[3-4 bullets: previous lesson], "prep":[3-5 bullets: what to know/read/finish, plus anything due with dates],
"sources":["Canvas: Lesson N notes", ...]}
Math in KaTeX ($...$ inline, \[ ... \] display; escape backslashes in JSON). Code in backticks. Plain, short.
Write {"updated":"<now ISO>","courses":{"MA376":{...}, ...}} to /tmp/study.json (OUTSIDE the repo), run
`python3 tools/study.py seal /tmp/study.json`, then delete it. Never commit plain study JSON. If no course
could be built, leave data/study.enc unchanged.

## 7) Flights ("flights" and "flightsNote" in daily.json): needs Braeden's laptop
Kayak only works through Chrome on the laptop. Try `tabs_context_mcp` once. If Chrome can't be reached,
skip this part, keep the existing flights and flightsNote exactly as they are, and log "flights skipped
(laptop off)". This is NOT a failure.
RULES: depart and return ONLY JFK, LGA or EWR. Outbound Friday 3:00 PM or later, OR Saturday before 3:00 PM.
Return lands in NY by 4:00 PM Sunday (Monday by 4:00 PM if that Monday is off: 2026-11-30, 2026-12-14).
Winter leave starts 2026-12-20: skip weekends from Dec 18 on. No +1 arrivals. Destinations (US + PR only):
MCO, FLL, MIA, TPA, SJU, BQN, CHS, SAV, MYR, BNA, MSY, ATL, CLT, ORD, BOS, DEN, AUS, LAS, SAN, LAX.
Weekends: the next 5 upcoming weekends (Friday dates) after today.
SEARCH (one Chrome tab, reused): Friday-leave:
https://www.kayak.com/flights/EWR,JFK,LGA-DEST/FRI/RET?sort=price_a&fs=takeoff=1500,2359__;landing=__0000,1600
Saturday-leave: https://www.kayak.com/flights/EWR,JFK,LGA-DEST/SAT/RET?sort=price_a&fs=takeoff=0000,1500__;landing=__0000,1600
(dates YYYY-MM-DD; RET is Sunday, or Monday on the long weekends). Friday-leave for all destinations first,
then Saturday-leave for the cheapest-looking ones; about 40 searches max. Read the top 3 result cards
(.nrc6-inner): price, airlines, outbound time and airports, stops, return times and airports. Drop anything
breaking a rule. Never click Book, sign in, accept anything or trigger dialogs. On a CAPTCHA, stop and use what you have.
WRITE: replace only "flights" and "flightsNote". Cheapest fare per destination per weekend, max 25, cheapest first:
{"from":"LGA","to":"MIA","city":"Miami, FL","tag":"Beach|City|Island|Mountains","price":259,"airline":"Delta",
"depart":"YYYY-MM-DD","departTime":"HH:MM","stops":"Nonstop|1 stop","returnDate":"YYYY-MM-DD","returnDepart":"HH:MM",
"returnArrive":"HH:MM","returnTo":"JFK","returnAirline":"Delta","returnStops":"Nonstop","url":"<Kayak URL used>"}
Keep fares over $350 too. flightsNote: "Real fares from Kayak searches run <Mon D> with your exact pass window,
JFK/LGA/EWR only." If zero valid fares, keep the existing flights. Close your Chrome tab when done.

## 8) Validate and publish
Run `python3 -c "import json;[json.load(open(f)) for f in ['data/daily.json','data/bills.json','data/places_history.json','data/finance.enc','data/study.enc']]"`
and fix any error. `git status`: only the allowed files changed, no plain finance/study JSON staged.
Append the run log line (common.md), then commit everything ONCE with message "Morning update YYYY-MM-DD"
(name any skipped or failed part) and push as in common.md. Alert only on failure.
Finish with a short summary: Army's next game, the Bills' record and next game, today's place, S&P 500 change,
the study-deck lessons, and the number of fares plus the cheapest (or "flights skipped").
