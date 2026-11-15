# Groundhog Air Rally

A 2D, top-down browser battle royale inspired by Copter Royale. The player flies a groundhog in a 12-pilot match against 11 side-character bots. The game is designed for short, replayable matches on phones and computers.

- Live game: [braedenfonte.com/games/groundhog-air-rally/](https://braedenfonte.com/games/groundhog-air-rally/)
- Source: [index.html](./index.html) on `main` in `braedenfonte/braedenfonte.github.io`
- This file is the handoff. Read the current `index.html` before editing because tuning and content can change.

## Run and publish

The entire game is one HTML file with inline CSS and vanilla JavaScript. Canvas 2D draws the arena, pilots, and projectiles. DOM controls handle the menus and HUD. Audio uses Web Audio. There is no package install, build step, game server, or external asset dependency.

Open the HTML file in a browser for a quick smoke test. For predictable browser storage and phone testing, serve the repository locally. From the repository root, run `python -m http.server 8000` and open `http://localhost:8000/games/groundhog-air-rally/`. To test a real phone, use the computer's LAN address from the same Wi-Fi network if the firewall permits it.

The live site uses GitHub Pages and the existing custom domain. Changes to the game file on `main` are picked up by the Pages deployment. Keep game changes under this folder so the rest of the site is unaffected. A successful commit alone does not verify that Pages has deployed it. Open the public URL and check that the new behavior is present.

## Match rules

- Be the last groundhog flying. You are eliminated at zero HP. Leaving the shrinking safe circle shows a fog warning; after 1.5 seconds outside, the fog drains 8 HP per second plus 2 more for every time the circle has shrunk (`fogGrace`, `fogDps`). Shields don't block fog damage.
- Desktop uses WASD to fly, mouse aim and left-click to fire, and E to activate a held power. Touch uses a left movement stick, a right aim-and-fire stick, and a Power button.
- The arena is 3,200 world units across. Pilots spawn spaced around the map with five seconds of opening damage protection. Fixed landmarks block flight and shots. Igloo Wall provides temporary, destructible cover.
- Shoot crates and fly over drops. Normal crates give a trait about 94% of the time and a power about 6%. Crates say **LOOT**. Only the **Irish Pot of Gold** uses the gold chest marked **GOLD**.
- The Irish Pot of Gold appears 30–45 seconds into a match at a clear random spot inside the current safe circle, with a top-screen announcement and a minimap marker. It drops two **different +3 trait boosts** and one power from Kia Turbo, Igloo Wall, Ramon's Healthy Lotion, Marist Camera, or MAJ P’s Blabber. Pot of Gold pickups have a gold rim, a name tag such as **+3 SPEED** with the level you would reach, and a minimap marker until claimed. Every power pickup shows its name and icon.
- Speed, Health, Shield, and Fire Rate cap at 5 each match. Pickup color shows the level you would reach. Grey 1, green 2, blue 3, purple 4, gold 5. Icons identify the trait. Fire Rate uses an arrow aimed at a ball.
- Health adds 15 maximum HP per level without healing you. After five seconds without taking damage, pilots heal 6 HP per second inside the circle. Ramon's Healthy Lotion heals up to 65 HP instantly.
- One held power slot. Eliminated pilots drop their unused power. Other powers are Froot Loops Burst (rapid fire), Salmon Shield (temporary shot immunity), Kia Turbo (speed burst), Igloo Wall (temporary cover), Marist Camera (briefly reveals nearby opponents on the minimap), and MAJ P’s Blabber (rivals within 280 units fall asleep for 3.5 seconds and can't move or shoot; a hit wakes them).
- The kill feed lists eliminations. The player gets a big knockout notice for their own kills and an assist if another pilot finishes a target within eight seconds of the player's last damaging hit.

## Pilots and cosmetics

Selecting a pilot applies their preset. **Custom** enables editing, and clicking a cosmetic tile also switches to Custom while retaining the rest of the active loadout. Match and hangar art share drawing routines. Accessories are attached to the rotating pilot model, with glasses over the eyes and hats or hair on the head.

| Pilot | Home | Skin | Projectile | Accessory |
|---|---|---|---|---|
| Braeden Fonte | Caledonia, NY | White with overlapping maroon C and M | Basketballs | Blue-light glasses |
| Ethan Ploetz | Alexandria, VA | Black and blue | Volleyballs | Blond hair |
| Josh Brancamp | Fishkill, NY | Irish flag | Spinning Beers | Irish baby shoes |
| Casey Adams | Cleveland, OH | Pink and black | Froot Loops | Camera |
| Owen Beckwith | San Diego, CA | Sunset orange and pale sun | Milky shot glasses | Surfboard |
| Bridger Beck | Kenai, AK | Icy blue and white | Salmon | Fishing pole |
| Jimmy Benne | San Antonio, TX | Navy and orange Bears-inspired C | Deep-dish pizzas | Cowboy boots (on the back feet) |
| Cole Bryant | West, TX | Texas flag | Cowboy spurs | Cowboy hat |
| Jess Joe Augustine | Mount Sinai, NY | Black M and red S | Pringles | Bacon, egg, and cheese |

The CM, MS, and Bears-inspired C crests sit upright on the pilot's back and are drawn larger in the match view on phone-sized zoom (`emblemBoost`). Ethan has short blond hair on the crown, leaving the eyes clear. The MS crest interlocks a small red S inside a large black M. The selected outline is black. Alternative projectiles and gear are available in the cosmetic picker. Cosmetic projectiles share collision and base combat behavior even when their artwork differs in size. The hangar includes a live rotating preview and test fire.

The nine playable pilots are excluded from the bot pool. Side characters include Maggie, Molly, Lili, Carli, Jade, Sophia, Adriann, Adrianna, Mila, Robin, Rachel, Ramon, CPT William Reynolds, MAJ P, CPT Derek Swanson, LTC Dusty Turner, MAJ Austin Semmel, Claude, Reese, Irish Woman, and Emma Beck. Reese and Irish Woman are side characters with Scrapbook cameos, just like the other non-playable friends. Adriann and Adrianna are separate people.

## Progression and arenas

CPT Derek Swanson's Amex points determine rank. Placement is the main source of points. Eliminations and assists add a capped bonus, good finishes earn less at higher ranks, and poor finishes lose more. Demotions are possible. The hangar shows the rank card, points to the next rank, and the last three match results.

| Rank | Points | Arena |
|---|---:|---|
| Starter | 0 | Rally Grounds |
| Green | 150 | Volleyball Weekend |
| Gold | 450 | Kenai Icefield |
| Platinum | 950 | Dublin After Dark |
| Reserve | 1,800 | Cleveland Fight Night |
| Centurion | 3,200 | Centurion Circuit |

The named reference landmarks (and their Scrapbook pages) are shared, but each arena has its own layout in `arenaLayouts`: roads, location slots, and cover. Volleyball Weekend adds bleachers and nets, Kenai icy ridges, Dublin rows of houses, Cleveland a boxing-ring rope square, and Centurion a circle of marble pillars. Generated cover skips any spot that would overlap a landmark, a location, or a Scrapbook page. Kenai has snowfall and snowy trees. Each match draws nine locations from the 18-entry landmark pool. The pool includes Pershing Balcony, Spur Overlooking a Lake, Slide Mountain, Army Navy Houses 1 and 2, Labor Day Houses 1 and 2, La Placita, Queens Apartment, Gas Station on the Way to Annapolis, 1 BR Annapolis House, Hoboken, Grant Hall, Buffalo Traffic Jam Concert, Philadelphia Soccer Hotel, Halloween Airbnb with Pool, South Gate Tavern, and The Firstie.

Keep the references recognizable through scenery and play. Examples include Iona vs. University of Alaska Anchorage women's volleyball, Turner vs. Semmel boxing, the lost Marist camera, Phebes, the Kia Soul, the Kenai salmon run and 10-mile trail, and the Dena’ina homelands postcard. The `finds` array is the source for current Scrapbook details, including names, schools, and locations. Keep the Scrapbook, but look for opportunities to make important references visible or interactive on the map.

## Achievements and daily challenge

The hangar's **Achievements & daily challenge** button lists 11 achievements (for example Triple KO, Pot of Gold, Fog Dancer, Hangar Regular) and today's challenge. One challenge rotates each local day from `dailyList`; completing it once per day adds 10 Amex points. New unlocks appear on the results screen.

## Code tour

| Area | Where to look |
|---|---|
| Pilot defaults, colors, and cosmetic catalogs | `pilots`, `pilotKits`, `presets`, `outfits`, `streams`, `accessories` |
| Hangar selection and preview | `select`, `applyPreset`, `syncLab`, `renderHangar` |
| Match lifecycle and controls | `begin`, `step`, `eliminate`, `finish`, `frame`, keyboard and pointer handlers |
| Combat, loot, and recovery | `fire`, `activate`, `collect`, `recoverHealth`, projectile and crate handling in `step` |
| Arena selection and cover | `arenas`, `landmarks`, `locationPool`, `randomLandmarks`, `blocked`, `radius`, `dropPoint` |
| Match and cosmetic art | `render`, `drawPilot`, `drawPattern`, `drawGear`, `drawShot`, `drawLocation`, `drawArenaScene` |
| Rank and history | `ranks`, `placementPoints`, `recordResult`, `showRank`, `refreshArenas` |

## Browser saves

These `localStorage` values are local to the browser and origin. Preserve their keys and compatibility when changing the code.

- `groundhog-air-rally-loadout` — pilot and selected loadout options.
- `groundhog-air-rally-amex-points` — rank points.
- `groundhog-air-rally-amex-points-history` — last three match results.
- `groundhog-air-rally-scrapbook` — collected entries.
- `groundhog-air-rally-achievements` — unlocked achievements, pilots who have won, and today's daily-challenge status.
- `groundhog-air-rally-rules-seen` — first-visit rules dismissal. The How to play button always reopens the rules.

## What to preserve and verify

Keep the title **Groundhog Air Rally**. Keep the game 2D for now. Free building and live multiplayer are future decisions. The current build has the Igloo Wall power and local bots. Ask Braeden before making new names final when naming is part of the change.

For visual edits, check both the hangar and actual match scale on desktop and a narrow touch viewport. For gameplay changes, play a full match and check restart, fog, rank and assist scoring, and saved progress. Check that the safe-circle drop lands clear of obstacles and that scenery sold as cover actually blocks movement and shots. Previous automated checks exercised the JavaScript and mocked drawing calls. Real browser visuals and touch feel need hands-on verification.
