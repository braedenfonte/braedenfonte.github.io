# Taterbottom Saloon handoff

Continue from the latest main branch in braedenfonte/braedenfonte.github.io. The site links to the standalone saloon under Games. Its HTML, styles, and script are in this directory's index.html. Update this handoff in each saloon PR with what shipped, verification status, and the next step. Squash-merge ready website PRs when GitHub allows it.

## Current checkpoint

- The supplied artwork at `../saloon/saloon-interior.png` now fills the interior scene. Image-relative hotspots follow Slim, Dusty, and the sock on desktop and mobile. Either cowboy opens the bar dialogue, the sock announces “Hmmmm...”, and the backdoor remains scenery.
- The façade and door leaves share the camera move. The leaves swing inward before the storefront pushes forward and fades. Reduced motion switches scenes immediately.
- Verified in Playwright Chromium at 1440×900 and 390×844 with touch emulation. All six checks passed, covering entry, both conversations, sock text, the inactive backdoor, keyboard activation, Escape and focus restoration, and reduced motion. Reviewed entrance, mid-swing, interior, and sock screenshots.

## Reproduce browser checks

From `games/taterbottom-saloon`, run `npm ci`, `npx playwright install chromium`, then `npm test`. The tests open the standalone page directly and save screenshots under `test-results/`.

## Earlier checkpoints

- Reference pass: shaped, waist-high café doors with open space above and below, visible hinges, two hanging lassos, diagonal porch braces, and darker recessed lighting. The storefront and props are CSS. Browser visual verification is pending.

- The closed entrance now shows a full CSS storefront with windows, timber posts, and a porch around the unlabeled swing doors. On entry, the doors pivot and the storefront scales and drifts sideways to give the impression of stepping through. The final interior artwork is the next checkpoint.

- The entrance opens with two independently hinged doors and honors reduced motion. The facade has layered plank grain, cross rails, bolts, iron pulls, and warm top light. A prominent entrance button and a button-style home link frame the experience.
- The interior still uses CSS scenery with sample exchanges for Slim Pickens Taterbottom and Dusty Two Teeth Carson. The JavaScript parsed successfully. Browser and deployment verification are pending.
- Earlier saloon source archive in ChatGPT Library is taterbottom-saloon.zip (libfile_c8501214e76481919a0b36bfc0210ce0). The Scruffy Western Duo Portrait.png (libfile_62711537f01c819193bb09cc0e958307) can serve as a character reference. The ZIP could not be unpacked in the earlier session.

## Build order

1. Bring the still to life with subtle, ambiguous movement under the sock, flickering lights, and optional ambient chatter. Preserve reduced-motion behavior and add a mute control for audio.
2. Daily Bad Bet, more Western idioms, and a functional backdoor remain later additions.
