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
3. Keep the Contact disclaimer. Static site only, no build step, no paid services or API keys.
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
