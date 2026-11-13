# braedenfonte.com

Personal site of Braeden Fonte, USMA Class of 2028. `data/daily.json` refreshes every morning at 6:30 AM ET.

## How the site is put together (no build step)

| File | What it is |
|---|---|
| `index.html` | The shell: sidebar, every section's markup, password gate |
| `css/site.css`, `css/shell.css` | Styles. `shell.css` holds the design tokens, campus map and demos |
| `js/app.js` | All section logic, the unlock/decryption code and the Daily Golf game |
| `js/mapdata.js` | US outline for the travel map |
| `js/shell.js` | Home-screen campus (2D map, labels, status chips), low-power mode, sound, intro |
| `js/campus3d.js` | The 3D campus (Three.js). Loads in the background, never on phones or low-power mode |
| `js/demos.js` | TSP, Monte Carlo and queue demos on the Projects page |
| `vendor/` | Three.js, KaTeX and fonts, stored here so nothing depends on a CDN |

All paths are absolute (`/data/...`, `/js/...`). The routines only write files in `data/` and `routines/`;
the site reads those same files, so the routines never need to touch the files above.
To add or move a campus landmark, edit the `LANDMARKS` list at the top of `js/shell.js`.
