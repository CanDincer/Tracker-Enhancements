import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { getHealthData, parseHpInput } from '../module/health.js';
import { CeUtility } from '../module/utility.js';
import { environment, combatant } from './helpers.mjs';
let env;
beforeEach(() => { env = environment(); });

test('zero HP remains a valid editable resource without a configured token bar', () => {
  const c = combatant('zero', 10, { hp: 0 });
  const health = getHealthData(c);
  assert.equal(health.path, 'system.attributes.hp.value');
  assert.equal(health.value, 0);
  assert.equal(health.current, 0);
  assert.equal(health.editable, true);
  assert.equal(health.displayHealth, true);
  assert.equal(Object.hasOwn(c, 'combatAttr'), false);
});

test('custom Bar 1 resources and scalar attributes resolve their own update paths', () => {
  const c = combatant('custom');
  c.actor.system.wounds = { value: 3, max: 8 };
  c.token.bar1.attribute = 'wounds';
  assert.equal(getHealthData(c).path, 'system.wounds.value');
  assert.equal(getHealthData(c).current, 3);
  c.actor.system.wounds = 4;
  assert.equal(getHealthData(c).path, 'system.wounds');
  assert.equal(getHealthData(c).value, 4);
  assert.equal(getHealthData(c).displayHealth, false);
});

test('missing actors, missing tokens and unsupported resources are safe', () => {
  assert.equal(getHealthData({ actor: null }), null);
  assert.equal(getHealthData(combatant('off-scene', 0, { token: false })).value, 10);
  const c = combatant('missing');
  c.token.bar1.attribute = 'no.such.resource';
  assert.equal(getHealthData(c).displayHealth, false);
  assert.equal(getHealthData(c).editable, false);
});

test('token bar visibility and actor update permission are independently enforced', () => {
  game.user.isGM = false;
  const c = combatant('enemy');
  for (const mode of [0, 20, 40, 99]) {
    c.token.displayBars = mode;
    assert.equal(getHealthData(c).displayHealth, false);
    assert.equal(getHealthData(c).editable, false);
  }
  for (const mode of [10, 30, 50]) {
    c.token.displayBars = mode;
    assert.equal(getHealthData(c).displayHealth, true);
    assert.equal(getHealthData(c).editable, false);
  }
  c.actor.isOwner = true;
  c.token.displayBars = 40;
  assert.equal(getHealthData(c).displayHealth, true);
  assert.equal(getHealthData(c).editable, true);
  c.actor.canUserModify = () => false;
  assert.equal(getHealthData(c).editable, false);
});

test('actor type override and feature toggles take effect immediately', () => {
  game.user.isGM = false;
  const c = combatant('enemy');
  env.settings.set('showHpForType', 'npc');
  assert.equal(getHealthData(c).displayHealth, true);
  env.settings.set('enableHpRadial', false);
  assert.equal(getHealthData(c).displayHealth, false);
  game.user.isGM = true;
  env.settings.set('enableHpField', false);
  assert.equal(getHealthData(c).editable, false);
});

test('Bar Brawl visibility veto is applied and missing APIs fall back to core bars', () => {
  const c = combatant('bar');
  game.modules.set('barbrawl', { active: true });
  assert.equal(getHealthData(c).current, 10);
  globalThis.BarBrawlApi = { getBar: () => ({}), getActualBarValue: () => ({ value: 4, max: 12 }), isBarVisible: () => false };
  assert.equal(getHealthData(c).current, 4);
  assert.equal(getHealthData(c).displayHealth, false);
  BarBrawlApi.isBarVisible = () => true;
  assert.equal(getHealthData(c).displayHealth, true);
  c.token.object = null;
  game.user.isGM = false;
  c.token.displayBars = 50;
  assert.equal(getHealthData(c).displayHealth, false);
});

test('derived resources marked non-editable do not receive an HP input', () => {
  const c = combatant('derived', 10, { resource: { type: 'bar', value: 5, max: 10, editable: false } });
  assert.equal(getHealthData(c).editable, false);
});

test('HP input accepts decimal absolutes and deltas and rejects malformed values', () => {
  for (const [input, expected] of [['0', 0], ['25', 25], ['-10', 10], ['+3', 23], ['  +2.5 ', 22.5], ['.5', 0.5]]) {
    assert.equal(parseHpInput(input, 20), expected, input);
  }
  for (const input of ['', ' ', '--3', '+-2', '3-2', '1e3', 'Infinity', 'NaN', '0x10', '1,2', '1'.repeat(400)]) {
    assert.equal(parseHpInput(input, 20), null, input);
  }
});

test('rings clamp negative/over-max values and never produce non-finite geometry', () => {
  for (const [current, max, expected] of [[0, 20, 0], [-5, 20, 0], [30, 20, 100], [10, 20, 50], [0, 0, 0], [NaN, 20, 0]]) {
    const circle = CeUtility.getProgressCircle({ current, max });
    assert.equal(circle.class, expected);
    assert.ok(Number.isFinite(circle.offset));
    assert.ok(circle.offset >= 0 && circle.offset <= circle.circumference);
  }
  assert.equal(getHealthData(combatant('max-zero', 0, { max: 0 })).displayHealth, false);
});
