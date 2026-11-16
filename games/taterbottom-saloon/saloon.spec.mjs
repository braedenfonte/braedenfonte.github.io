import { expect, test } from '@playwright/test';

const url = new URL('./index.html', import.meta.url).href;
const slim = 'Slim Pickens Taterbottom';
const dusty = 'Dusty Two Teeth Carson';

test('enter, talk to each cowboy, inspect the sock, and leave the backdoor inactive', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const artwork = page.locator('.scene img');
  await expect(artwork).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.locator('.room')).toHaveJSProperty('inert', true);
  await page.screenshot({ path: info.outputPath('entrance.png') });

  const activate = info.project.use.hasTouch
    ? (x, y) => page.touchscreen.tap(x, y)
    : (x, y) => page.mouse.click(x, y);
  const enter = page.getByRole('button', { name: /push open/i });
  if (info.project.use.hasTouch) await enter.tap();
  else await enter.click();

  // Freeze the entry partway through so the swing and camera framing are reproducible.
  const animations = await page.locator('.stage').evaluateHandle(async stage => {
    const transitions = stage.getAnimations({ subtree: true });
    if (!transitions.length) throw new Error("Expected entry transitions");
    for (const transition of transitions) {
      transition.pause();
      transition.currentTime = 240;
    }
    await Promise.all(transitions.map(transition => transition.ready));
    return transitions;
  });
  await page.screenshot({ path: info.outputPath('door-swing.png') });
  await animations.evaluate(transitions => transitions.forEach(transition => transition.finish()));
  await expect(page.locator('.storefront')).toHaveCSS('opacity', '0');
  await page.screenshot({ path: info.outputPath('interior.png') });

  const art = await artwork.boundingBox();
  expect(art.x).toBeGreaterThanOrEqual(0);
  expect(art.x + art.width).toBeLessThanOrEqual(info.project.use.viewport.width);
  const hit = (x, y) => activate(art.x + art.width * x, art.y + art.height * y);
  const dialog = page.getByRole('dialog', { name: 'At the bar' });
  for (const [x, y, speaker] of [[.30, .25, 'Slim'], [.57, .30, 'Dusty']]) {
    await hit(x, y);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#cowboy-line')).toHaveText(new RegExp('^' + speaker + ':'));
    await dialog.getByRole('button', { name: 'Back to the bar' }).click();
    await expect(dialog).toBeHidden();
  }
  await hit(.15, .80);
  await expect(page.getByRole('status')).toHaveText('Hmmmm...');
  await page.screenshot({ path: info.outputPath('sock.png') });
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).tagName, {
    x: art.x + art.width * .89, y: art.y + art.height * .4,
  })).toBe('IMG');
  await hit(.89, .40);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toHaveText('Hmmmm...');
  expect(page.url()).toBe(url);
  expect(errors).toEqual([]);
});

test('keyboard entry, modal dismissal and focus restoration', async ({ page }) => {
  await page.goto(url);
  const enter = page.getByRole('button', { name: /push open/i });
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
  await page.getByRole('button', { name: /push open/i }).click();
  await expect(page.locator('.storefront')).toHaveCSS('opacity', '0');
  await expect(page.locator('.room')).toHaveCSS('transform', 'none');
  expect(await page.locator('.stage').evaluate(stage => stage.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.getByRole('button', { name: slim })).toBeFocused();
});
