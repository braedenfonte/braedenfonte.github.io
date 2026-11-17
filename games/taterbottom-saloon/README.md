# Taterbottom Saloon handoff

Continue from the latest main branch in braedenfonte/braedenfonte.github.io. The site links to the standalone saloon under Games. Its HTML, styles, and script are in this directory's index.html. Update this handoff in each saloon PR with what shipped, verification status, and the next step. Squash-merge ready website PRs when GitHub allows it.

## Current checkpoint

- Slim, Dusty, and a card player move on staggered loops after the camera settles. Haze rolls across the room, and reduced motion disables the ambient effects.
- The conversation shows one response at a time. Six subjects have a follow-up from the other cowboy. The roast option combines six openings with eight endings, including some vulgar ones, and prevents immediate repeats.
- The Chromium suite checks a moving patron frame, topic choices, follow-up speaker changes, repeat roasts, and reduced motion at both viewport sizes.


- Once the camera settles, dust drifts through the lamplight and warm reflections pulse on the floor. The lamp and sock effects remain active, and reduced motion disables the ambient loops.
- Clicking Slim or Dusty starts a conversation with that cowboy. Ask about the card game or the town and both men respond in a speaker-labeled transcript. Reopening either cowboy starts a fresh conversation. Escape or Back to the bar closes the panel.
- All six Chromium checks passed at 1440×900 and 390×844, including both dialogue topics, focus restoration, and reduced motion. Reviewed the conversation screenshots.


- The doorway, wide view, and close bar view now use one image. Slim and Dusty face the entrance from the far counter. The doors clear before the camera zooms toward them, and all interactive areas stay attached to the artwork.
- The sock remains in the shadows by the right end of the bar. On a narrow screen, look right to see it. The floor corner sits above the bottom of the viewport, with room for browser chrome or a taskbar.
- The browser suite captures the open doorway and the zoom, taps both cowboys, and checks the sock at shorter viewport heights with a further 64 px of bottom clearance.


- The standalone game fills the viewport. Compact controls go back to the site, return to the entrance, or look left and right. Portrait screens crop the wide scene and use those same controls to reveal the sides.
- Entry opens on an anonymous crowd and an aisle through the card tables. The camera turns past a foreground post into a closer view of Slim and Dusty at the bar. Reduced motion goes directly to the bar.
- The sock is in the right-hand floor shadows, with two visible bumps that lift the fabric in succession. It still responds with “Hmmmm...”.
- All six Chromium checks passed at 1440×900 and 390×844. The suite checks viewport coverage, the crowd reveal, both side views, return to the entrance, and the existing interaction and accessibility checks.


- The doorway and playable room now share one image. After the doors swing inward, a first-person-style camera move clears the threshold, looks toward the card tables, and settles on Slim and Dusty. The scene becomes interactive at the end. Reduced motion skips straight to the settled view.
- The café doors use weathered timber artwork with iron hardware. The sock is smaller and tucked beside a tin cup. Two independently timed movements hint at the rats beneath the fabric. Fully animated rats are a later step.
- All six Playwright checks passed in Chromium at 1440×900 and 390×844. The suite captures the doorway, swing, pan, settled interior, and sock response.


- Click or tap either café door to enter. The doors also share a keyboard-focusable entrance control. Clean, warm wood panels swing inward with a slight stagger, then the camera pushes through the threshold.
- The entrance shows a crowded bar through the doorway. Crossing the threshold brings up matching closer artwork, with Slim and Dusty as the two interactive men at the bar, the sock on the foreground table, and the inactive backdoor at right.
- All six Chromium checks passed at 1440×900 and 390×844. Reviewed the entrance, mid-swing, and interior frames. The tests check both inward hinge directions and use image-relative coordinates for the characters, sock, and backdoor.


- The illustrated storefront uses the interior's amber lamps, worn timber, and dusk-blue windows. Its doorway is cut out along the painted jambs so the interior and independently swinging café doors appear behind it. The moving leaves use timber sampled from the storefront.
- Inside, two lamp glows flicker on different cycles and a small shadow shifts beneath the sock. Both effects respect reduced motion. All six Playwright checks passed at 1440×900 and 390×844, and screenshots were reviewed for doorway alignment and mobile framing.


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

1. Add optional ambient chatter with a mute control.
2. Daily Bad Bet, more Western idioms, and a functional backdoor remain later additions.
