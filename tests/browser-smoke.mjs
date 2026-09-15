import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const base = resolve(import.meta.dirname, '..');
const server = createServer(async (request, response) => {
  try {
    const path = resolve(base, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!path.startsWith(base + sep)) { response.writeHead(403).end(); return; }
    const content = await readFile(path);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }).end(content);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CE_CHROMIUM_PATH ? { executablePath: process.env.CE_CHROMIUM_PATH } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 850, height: 650 } });
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/fixtures/tracker.html`);
  await page.waitForFunction(() => window.testHarness);
  if (process.env.CE_CORE_CSS) await page.addStyleTag({ path: process.env.CE_CORE_CSS });
  const hp = page.locator('[data-combatant-id="a"] .ce-modify-hp');

  await hp.fill('-3');
  await hp.press('Enter');
  await page.waitForFunction(() => testHarness.members[0].actor.system.attributes.hp.value === 17);
  assert.equal(await page.evaluate(() => testHarness.members[0].actor.writes.length), 1);
  await hp.fill('+8');
  await hp.press('Escape');
  assert.equal(await hp.inputValue(), '17');
  assert.equal(await page.evaluate(() => testHarness.members[0].actor.writes.length), 1);
  await hp.fill('');
  await hp.press('Tab');
  assert.equal(await hp.inputValue(), '17');
  assert.equal(await page.evaluate(() => testHarness.warnings.length), 1);
  await page.locator('[data-action="toggleHidden"]').first().click();
  assert.equal(await page.evaluate(() => testHarness.coreClicks), 1);
  assert.equal(await page.evaluate(() => testHarness.coreChanges), 0);

  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => { document.body.className = `theme-${theme}`; }, theme);
    const overflow = await page.locator('.ce-modify-hp').evaluateAll(inputs => inputs.filter(input => {
      const field = input.getBoundingClientRect(), row = input.closest('li').getBoundingClientRect();
      return field.left < row.left || field.right > row.right || field.bottom > row.bottom;
    }).length);
    assert.equal(overflow, 0, `HP fields fit inside tracker rows in the ${theme} theme`);
    await mkdir(resolve(base, 'test-results'), { recursive: true });
    await page.screenshot({ path: resolve(base, `test-results/tracker-${theme}.png`) });
  }

  await page.locator('[data-combatant-id="c"]').dragTo(page.locator('[data-combatant-id="a"]'), {
    targetPosition: { x: 15, y: 3 },
  });
  await page.waitForFunction(() => testHarness.combat.turns[0].id === 'c');
  assert.equal(await page.evaluate(() => testHarness.combat.combatant.id), 'b');
  await page.evaluate(() => {
    game.user.isGM = false;
    testHarness.settings.set('hideNonAllyInitiative', true);
    testHarness.app.render();
  });
  assert.equal(await page.locator('.ce-modify-hp').count(), 1);
  assert.equal(await page.locator('.ce-hide-initiative').count(), 2);
  assert.equal(await page.locator('[data-combatant-id="b"] .token-initiative').isVisible(), false);

  // Match a player's owned PC, another player's PC and an NPC with owner-only bars.
  await page.evaluate(() => {
    testHarness.members[2].actor.type = 'npc';
    for (const c of testHarness.members) c.token.displayBars = CONST.TOKEN_DISPLAY_MODES.OWNER;
  });
  for (const [choice, expected] of [
    ['', ['a']], ['npc', ['a', 'c']], ['character', ['a', 'b']],
    ['encounter', ['a']], ['group', ['a']], ['*', ['a', 'b', 'c']], ['', ['a']],
  ]) {
    await page.evaluate(choice => {
      testHarness.settings.set('showHpForType', choice);
      testHarness.app.render();
    }, choice);
    const visible = await page.locator('.progress-ring').evaluateAll(rings =>
      rings.map(ring => ring.closest('[data-combatant-id]').dataset.combatantId).sort());
    assert.deepEqual(visible, expected, `Player HP circles for ${choice || 'token visibility'}`);
    assert.equal(await page.locator('.ce-modify-hp').count(), 1);
  }
  assert.deepEqual(await page.evaluate(() => testHarness.errors), []);
  assert.deepEqual(failures, []);
  console.log('Browser smoke passed: HP save/cancel/validation, core controls, two themes, drag/drop, active turn, player HP visibility choices.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
