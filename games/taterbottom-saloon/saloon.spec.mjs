import { expect, test } from '@playwright/test';

const url = new URL('./index.html', import.meta.url).href;
const slim = 'Slim Pickens Taterbottom';
const dusty = 'Dusty Two Teeth Carson';

test('enter, talk to each cowboy, inspect the sock, and leave the backdoor inactive', async ({ page }, info) => {
  test.setTimeout(45000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await expect(page.locator('.facade')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.locator('.door img').first()).toHaveJSProperty('complete', true);
  const artwork = page.locator('.scene img');
  await expect(artwork).toHaveJSProperty('naturalWidth', 1671);
  await expect(page.locator('.room')).toHaveJSProperty('inert', true);
  await page.screenshot({ path: info.outputPath('entrance.png') });

  const activate = info.project.use.hasTouch
    ? (x, y) => page.touchscreen.tap(x, y)
    : (x, y) => page.mouse.click(x, y);
  const leaf = page.locator(info.project.use.hasTouch ? '.door.right' : '.door.left');
  const door = await leaf.boundingBox();
  await activate(door.x + door.width / 2, door.y + door.height / 2);


  // Freeze the entry partway through so the swing and camera framing are reproducible.
  const animations = await page.locator('.stage').evaluateHandle(async stage => {
    const transitions = stage.getAnimations({ subtree: true })
      .filter(animation => animation instanceof CSSTransition || animation.animationName === "walk-to-bar");
    if (!transitions.length) throw new Error("Expected entry transitions");
    for (const transition of transitions) {
      transition.pause();
      transition.currentTime = 240;
    }
    await Promise.all(transitions.map(transition => transition.ready));
    return transitions;
  });
  const [leftDepth, rightDepth] = await page.locator('.door').evaluateAll(doors =>
    doors.map(door => new DOMMatrix(getComputedStyle(door).transform).m13));
  expect(leftDepth).toBeLessThan(0);
  expect(rightDepth).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('door-swing.png') });
  await expect(page.locator('.room')).toHaveJSProperty('inert', true);
  await animations.evaluate(animations => {
    for (const animation of animations) {
      if (animation instanceof CSSAnimation) animation.currentTime = 710;
      else animation.finish();
    }
  });
  const wide = await artwork.boundingBox();
  await expect(artwork).toBeVisible();
  await page.screenshot({ path: info.outputPath('crowd-arrival.png') });
  await animations.evaluate(animations => {
    for (const animation of animations) {
      if (animation instanceof CSSAnimation) animation.currentTime = 1800;
    }
  });
  await page.screenshot({ path: info.outputPath('camera-zoom.png') });
  await animations.evaluate(transitions => transitions.forEach(transition => transition.finish()));
  await expect(page.locator('.storefront')).toHaveCSS('opacity', '0');
  const patron = page.locator('.patron-motion.slim');
  await expect(patron).toHaveCSS('animation-name', 'lean-at-bar');
  await patron.evaluate(async element => {
    const motion = element.getAnimations()[0];
    motion.pause();
    motion.currentTime = 2304;
    await motion.ready;
  });
  await expect(patron).not.toHaveCSS('transform', 'none');
  await expect(page.locator('.haze')).toHaveCSS('animation-name', 'haze-roll');
  await expect(page.locator('.floor-light')).toHaveCSS('animation-name', 'floor-flicker');
  await expect(page.locator('.dust').first()).toHaveCSS('animation-name', 'dust-drift');
  await expect(page.locator('.lamp-glow').first()).toHaveCSS('animation-name', 'lamp-flicker');
  await expect(page.locator('.sock-shadow').first()).toHaveCSS('animation-name', 'sock-stir');
  expect((await artwork.boundingBox()).width).toBeGreaterThan(wide.width * 1.25);
  await page.screenshot({ path: info.outputPath('interior.png') });

  const frame = await page.locator('.stage').boundingBox();
  expect(frame).toEqual({ x: 0, y: 0, ...info.project.use.viewport });
  const hit = async (x, y) => {
    const art = await artwork.boundingBox();
    await activate(art.x + art.width * x, art.y + art.height * y);
  };
  const dialog = page.getByRole('dialog', { name: 'At the bar' });
  for (const [x, y, speaker] of [[.475, .386, 'Slim'], [.572, .389, 'Dusty']]) {
    await hit(x, y);
    await expect(dialog).toBeVisible();
    const line = dialog.locator('.exchange p');
    const name = dialog.locator('.speaker');
    await expect(name).toHaveText(speaker);
    await expect(dialog.getByRole('group').getByRole('button')).toHaveCount(7);
    await dialog.getByRole('button', { name: 'Who’s cheating at cards?' }).click();
    await expect(line).toContainText('aces');
    const other = speaker === 'Slim' ? 'Dusty' : 'Slim';
    await dialog.getByRole('button', { name: other + ', is that true?' }).click();
    await expect(name).toHaveText(other);
    await expect(line).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Ask something else' }).click();
    await dialog.getByRole('button', { name: 'Roast me' }).click();
    const firstRoast = await line.textContent();
    await dialog.getByRole('button', { name: 'Give me another' }).click();
    await expect(line).not.toHaveText(firstRoast);
    await page.screenshot({ path: info.outputPath('conversation-' + speaker.toLowerCase() + '.png') });
    await dialog.getByRole('button', { name: 'Back to the bar' }).click();
    await expect(dialog).toBeHidden();
  }
  await page.getByRole('button', { name: 'Look right' }).click();
  await expect(page.locator('.stage')).toHaveAttribute('data-look', 'right');
  // Reduce the usable height and reserve a bottom strip as a taskbar overlay.
  const { width, height } = info.project.use.viewport;
  await page.setViewportSize({ width, height: height - 48 });
  await page.locator('.scene').evaluate(async scene => {
    await Promise.all(scene.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  const sock = page.getByRole('button', { name: 'Inspect the sock' });
  await expect.poll(async () => {
    const area = await sock.boundingBox();
    return area.x >= 0 && area.x + area.width <= width &&
      area.y >= 0 && area.y + area.height < height - 112;
  }).toBe(true);
  await hit(.714, .603);
  const art = await artwork.boundingBox();
  await expect(page.getByRole('status')).toHaveText('Hmmmm...');
  await page.screenshot({ path: info.outputPath('sock.png') });
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).tagName, {
    x: art.x + art.width * .773, y: art.y + art.height * .45,
  })).toBe('IMG');
  await hit(.773, .45);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toHaveText('Hmmmm...');
  expect(page.url()).toBe(url);
  await page.getByRole('button', { name: 'Look left' }).click();
  await expect(page.locator('.stage')).toHaveAttribute('data-look', 'center');
  await page.getByRole('button', { name: 'Look left' }).click();
  await expect(page.locator('.stage')).toHaveAttribute('data-look', 'left');
  await page.getByRole('button', { name: 'Return to entrance' }).click();
  await expect(page.getByRole('button', { name: /push open the saloon doors/i })).toBeFocused();
  await expect(artwork).toBeVisible();
  await expect(page.locator('.room')).toHaveJSProperty('inert', true);
  expect(errors).toEqual([]);
});

test('keyboard entry, modal dismissal and focus restoration', async ({ page }) => {
  await page.goto(url);
  const enter = page.getByRole('button', { name: /push open the saloon doors/i });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Back to website' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(enter).toBeFocused();
  await page.keyboard.press('Enter');
  const first = page.getByRole('button', { name: slim });
  await expect(first).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(first).toBeFocused();
  await page.keyboard.press('Tab');
  const second = page.getByRole('button', { name: dusty });
  await expect(second).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(second).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Inspect the sock' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('status')).toHaveText('Hmmmm...');
});

test('reduced motion enters immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await page.getByRole('button', { name: /push open the saloon doors/i }).click();
  await expect(page.locator('.storefront')).toHaveCSS('opacity', '0');
  await expect(page.locator('.room')).not.toHaveCSS('transform', 'none');

  expect(await page.locator('.stage').evaluate(stage => stage.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.getByRole('button', { name: slim })).toBeFocused();
});
