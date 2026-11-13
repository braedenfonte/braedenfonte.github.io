# Redesign handoff notes (read this first)

Written Nov 12, 2026 so a new Claude session can pick up the site redesign without the old chat.

## Where things stand
- Repo: `braedenfonte/braedenfonte.github.io` (GitHub Pages from `main`, domain braedenfonte.com).
- Branch **`redesign`** holds the finished new site (new `index.html` at the root). Work here.
- `main` still serves the OLD site at `/`. The new site is being tested at **braedenfonte.com/preview/**
  (`preview/index.html` is a copy of the new `index.html`; `css/ js/ vendor/ campus/` are shared).
  PR #1 (merged) added the preview. PR #2 (`redesign-preview-2`) updates it with the real West Point map.
- **Go-live ("swap it in") is NOT done.** It is one PR to `main`: replace root `index.html` with the one from
  `redesign`, delete `preview/`. Braeden must OK it first. Pushing straight to `main` is blocked for Claude; open a PR.
- README.md has the file map. All paths are absolute (`/js/...`, `/data/...`).

## Hard rules (from Braeden, do not break)
1. Locked tabs stay locked: brief, schedule, about, resume, courses, study, finance, memory, personal.
   Do not change the unlock/encryption code in `js/app.js`, the keys, or any `.enc` format. Never ask for or store the password.
2. Do not change any file path, name or JSON format in `data/`, `tools/`, `routines/` (daily routines write them).
3. Keep the Contact disclaimer. Static site only, no build step. No paid services or API keys, EXCEPT the one Braeden
   approved on Nov 13, 2026: Google Map Tiles API for the photorealistic home map (see "Update Nov 13 (later)" below).
4. PWA setup (manifest, icons, status bar) must keep working. Keep low-power 2D mode working for every section.
5. Crimson accent stays. Jarvis stays removed. Braeden wants short, plain-language replies.

## How the home map works
- `campus/westpoint.json`: real OpenStreetMap footprints (583 buildings), roads, fields, terrain grid (meters, x east, y north).
  Rebuild with `python3 campus/src/build.py campus/westpoint.json` from `campus/src/westpoint-raw.json.gz`.
  Raw bbox: lat 41.3735..41.398, lon -73.972..-73.948. Building heights are guesses in `build.py` (OSM has none).
- `js/campusmap.js`: loads the data, paints the map (2D map and the 3D ground texture), `locate()` finds places.
- `js/westpoint3d.js`: Three.js scene (terrain, extruded buildings, trees, labels, camera). `js/shell.js`: `LANDMARKS`
  list (which place opens which section), 2D map, chips, sound, intro, low-power mode.
- Claude's cloud workspace cannot reach overpass-api.de or the terrain tiles. New map data has to be fetched in
  Braeden's Chrome and saved as a file he drags into the chat (or he allows those domains).
- Testing: Playwright + system Chrome with `--use-angle=swiftshader`; force 3D with `localStorage bf-mode = "3d"`.
  Test locked tabs with FAKE data sealed by the repo's own tools and a fake key, never the real password.

## To-do list from Braeden (Nov 12, 2026), not done unless marked
1. **Scroll to zoom** on the 3D map. (Done on `redesign`, untested, not on the preview yet.)
2. **Fewer labels.** Small building names off by default; show a building's name on hover.
   (Partly done, untested: small names now only appear when zoomed in close. Hover names still to build:
   needs a per-triangle building index for raycasting in `westpoint3d.js`.)
3. **The Hudson is missing / too small.** It must read as a massive river right next to campus.
   Likely causes: water threshold in terrain (`h < 0.4`) is too low for the DEM, and the data box stops
   only ~300 m into the river. Fix: raise/inspect the threshold, extend the scene east and north with water
   (or fetch a wider box), show the far shore if possible, and aim the default camera to show the river.
4. **Missing building names.** Add labels (hover) for: Mahan Hall, Gillis Field House, Cadet Barbershop,
   the Honor building near Central Area (Nininger Hall), the BS&L building next to the library, Bartlett Hall,
   the new building across from Mahan Hall near Grant turnaround (Cyber & Engineering Academic Center),
   Cullum Hall and the buildings next to it (Lincoln Hall, West Point Club), and the soccer locker room
   (not in the data; ask Braeden where it is). Confirm unnamed ones with Braeden before labeling.
5. **Soccer stadium landmark** (Clinton Field / Malek area in the data): opens just Braeden's Army soccer
   schedule (he is team manager), future games only. Needs a data source or a small hand-kept list.
6. **Edge signposts** like the Mint and Golf Course: Josh's house (across the river in Fishkill, north-east),
   Braeden's house (near Caledonia, NY, far west/north-west), New York City (south), Highland Falls (past Thayer Gate).
   Direction labels only. Never put an address for a person's home.
7. **Statues/monuments:** Eisenhower, MacArthur, George Washington, the Honor Code monument (and others on the Plain).
   Only MacArthur and a few monuments are in the data; the rest need coordinates.
8. **Make it look like the real West Point (big job, top wish).** Right now buildings are footprints raised to a
   guessed height with a window texture. Wanted: real detail (gothic granite, towers, crenellations, sally ports,
   Cadet Chapel, Washington Hall, Taylor Hall tower, Michie Stadium stands, real roof shapes, better trees and ground).
   Plan it building by building, most-visible first, and keep 60fps and the low-power mode.
9. Still unchecked by anyone: final look of the real map after the last lighting/label fixes; Finance and Memory
   with real data; a real iPhone; real 60fps.

## Update Nov 13, 2026
- The new site is LIVE on `main` (PR #3). Work on a fresh branch from `main` and open a PR; `redesign` is old.
- Done: scroll to zoom, full-height map, hover names for every named building (3D), the Hudson (flood-filled from the
  terrain's flat river level in `campus/src/build.py`; the east bank is inside the map), direction signs (Josh/Fishkill, Home/Caledonia, NYC, Highland Falls),
  and `?v=` version tags on css/js links. **Bump the `?v=` number in index.html, shell.js and campusmap.js whenever those files change.**
- Still open: soccer stadium -> Braeden's soccer schedule, statues (need coordinates), names for buildings OSM does not name
  (honor building, BS&L building, soccer locker room: ask Braeden which footprints), and the detailed real-look buildings (#8).

## Update Nov 13, 2026 (later): Google Photorealistic 3D Tiles on the home map
- Braeden chose Google's real 3D city tiles over hand-modeling. Google Cloud project **braedenfonte-map** (separate from ShortSmith),
  billed to "My Billing Account". Key: `js/mapkey.js` (public by design). Locked to `https://braedenfonte.com/*` and to Map Tiles API only.
  Daily cap: **30** "3D Tiles root requests" (1 per page load with the 3D map) = max ~930/month, under the 1,000 free. Over that it is $6 per 1,000.
- To raise/lower the cap: Cloud console > IAM & Admin > Quotas, filter `tile.googleapis.com`, "3D Tiles root requests per day".
- Code: `startTiles()` at the bottom of `js/westpoint3d.js`, renderer bundled in `vendor/tiles3d.module.min.js` (3d-tiles-renderer 0.3.39
  built against three r160, `three` left external) plus `vendor/draco/`. The old model is still built: hidden while tiles show, but still
  used for hover names and clicks. It comes back automatically when there is no key, data-saver is on, the site is not braedenfonte.com/localhost,
  or Google refuses a request (quota hit = HTTP 429/403). Low-power mode never loads tiles. A "Map data: Google" credit is required, keep it.
- Testing locally costs 1 load per page reload and only works if `http://localhost:8765/*` is temporarily added to the key's website list
  (it was removed after testing on Nov 13).
- Hudson fixed on the built-in map too (2D + 3D fallback): the terrain grid was widened 1.2 km east and 0.8 km north
  (`campus/src/widen.py` -> `westpoint-elev-wide.json.gz`, same public terrain tiles, matches the old grid to 0.12 m), and the river
  now comes from the real OpenStreetMap Hudson outline (`campus/src/hudson-osm.json.gz`) instead of guessing from heights
  (the terrain over the river is noisy, 1-20 m). Both shores, Constitution Island and the bend are in. The 2D view is framed a bit wider/east to show them.

## Hybrid map plan (agreed with Braeden, Nov 13, 2026)
**Finding:** Google has NO 3D buildings for West Point (military post). Its tiles here are aerial photos draped on the hills.
Measured roof vs. street next to it: Washington Hall 2.8 m, Jefferson Hall 1.6 m, Pershing 1.8 m (real: 20-30 m). No tile setting can fix that.
**Plan:** keep Google's real ground, trees and river; put our own 3D buildings on top, at real heights, with real detail.

Phase 0 - tuning fixes (branch `map-tiles-tuning`): tile loader keeps updating until sharp (it stalled before), glTF handler matches
Google URLs, real colors in dark mode, no floating red outline boxes, closer zoom, angled landmark close-ups. Note: the in-app
browser pane pauses animation when hidden, so test tiles in a visible browser.

Phase 1 - foundation. DONE Nov 13 (PR #6): our buildings stay visible on top of the tiles; the tiles are shifted so Google's ground
matches our terrain (`calibrate()`, ~150 open-ground raycasts, only once the detailed ground has loaded); buildings use daylight
granite colors on the photo ground even in dark mode; tile memory capped (1,400 desktop / 800 phone). Not done yet from the list below:
real heights for every building and roof colors sampled from the photo.
Phase 1 - foundation (original plan):
- Show our building layer again while tiles are on (today it is hidden). Seat each building on the Google ground: raycast the tiles at
  the footprint and use the lowest hit, so nothing floats or sinks. Check the 32 m geoid offset the same way.
- Real heights: fill `HEIGHT` in `campus/src/build.py` for every named building (Braeden/photos), sensible defaults by type for the rest.
- Roof and wall color per building sampled from the Google photo under it, so small buildings blend in.
- Performance: one merged mesh per material, simple boxes when far away (LOD), keep 60 fps; low-power 2D untouched.

Phase 2 - hero buildings, hand-modeled from parts (towers, battlements, buttresses, pointed windows, sally ports, pitched/flat roofs),
one module per building in `js/buildings/`, most visible first:
1. Cadet Chapel (tower, nave, buttresses)  2. Washington Hall  3. Taylor Hall (tower)  4. Jefferson Hall Library
5. Central Area barracks (Pershing, Bradley, Eisenhower, MacArthur, Scott)  6. Thayer Hall  7. Michie Stadium stands
8. Eisenhower Hall  9. Cullum Hall + Lincoln Hall  10. Mahan, Bartlett, Thayer Hotel, Battle Monument, Old Cadet Chapel.
Materials: gray granite texture (procedural canvas), dark slate roofs, window rows. Check each against photos before moving on.
Needs from Braeden: OK on the order; photos or names for any building he cares about that is not listed.

Testing: `localhost:8765` is currently allowed on the Google key for this work. Remove it when the hybrid work is done.
Each test reload costs 1 of the 30 daily Google loads.

## Update Nov 13 (evening): Phase 2 started - Central Area Gothic
- All named barracks + Thayer Hall + Bartlett Hall + Washington Hall get Military Gothic detail generated from their real OSM
  footprints (`GOTHIC` in `js/westpoint3d.js`): granite battlements on every roof edge, square corner towers rising 6 m above the roof
  with their own battlements, stone buttresses every 9 m. Wall texture is now granite courses with narrow pointed windows (all buildings).
- (Removed: a clean painted ground over the campus core looked sloppy against the photo. Braeden wants the photo + real 3D trees.)
- 3D trees (`plantTrees()`): once the photo is sharp, render Google's ground straight down, find dark-green canopy (darker than the
  brightest 38% of greens = lawns), and grow a leafy tree (trunk + 2 lumpy crowns, photo-tinted) every ~7 m there, within 760 m of
  campus (480 m on phones). Skips buildings, roads, fields, lawns. About 5,000 trees.
- Reference: no free-to-use photos were found by search; style taken from documented descriptions (Military Gothic Revival, gray granite,
  Pershing 1891-95 by Richard Morris Hunt, Thayer Hall = former Riding Hall, Bartlett Hall ~1911-14).
- Thayer Hall footbridge (OSM footway layer 2, 398,498 -> 362,499) is now a 3D granite bridge with battlemented parapets on 2 piers.
- Next: real heights per building, Thayer Hall's river-side towers, Pershing's front towers/sally port, Cadet Chapel, Washington Hall wings,
  
  exact building shapes (Braeden: current Gothic is closer but details still wrong; overlay still looks sloppy in places).

## Washington Hall, built from photos (Nov 13, evening)
- References: Wikimedia Commons "West Point Washington Hall 03.JPG" (straight-on) and "...04.jpg" (wide), HABS NY-1458 (rock-faced
  granite, random-range ashlar; 1929 core, 1960s expansion wrapped the old front, which survives inside as the "Poop Deck").
- The Plain-side front = NE tip of the OSM Washington Hall footprint, (168,649)-(147,667), facing the Washington statue (OSM node 188,697).
  The long wings either side in photos are MacArthur Barracks (right) and Eisenhower Barracks (left).
- Measured off the straight-on photo: pavilion 27.7 m wide (pylons 7.1 m + center 13.5 m), 29.6 m tall, pylons 0.8 m forward with corner
  pinnacles; wings 23.4 m (0.79 of the pavilion). Dining wings behind: 16 m. No battlements on these three (flat parapets in photos).
- Center front drawn on a canvas (eagle shield, 3 pointed windows, 2 rows of grouped windows, 3 lancet groups, 3 arches with brown doors),
  pylon faces with slit windows, 3 granite steps, equestrian statue on a white pedestal. Code: `WH` block in `js/westpoint3d.js`.
- Ground auto-matching (`calibrate`) is OFF: it misfired on partly loaded tiles. The fixed 32 m geoid offset lines up.
- Testing burns Google loads fast (each reload = 1 of 30/day). Today's cap was used up by testing on Nov 13.
