import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldClearTargets, untargetAllTokens } from '../module/removeTarget.js';
import { CombatSidebarCe } from '../module/combat.js';
import { environment, encounter, combatant, tracker } from './helpers.mjs';

let env;
beforeEach(() => { env = environment(); });

test('target removal reacts to turn/round/end, not unrelated encounter edits', () => {
  const combat = encounter('active', []);
  game.combat = combat;
  assert.equal(shouldClearTargets(combat, { turn: 1 }), false);
  env.settings.set('removeTargets', true);
  for (const changed of [{ name: 'Renamed' }, { flags: {} }, { active: false }]) {
    assert.equal(shouldClearTargets(combat, changed), false);
  }
  assert.equal(shouldClearTargets(combat, { turn: 0 }), true);
  assert.equal(shouldClearTargets(combat, { round: 0 }), true);
  assert.equal(shouldClearTargets(combat, {}, {}, true), true);
  assert.equal(shouldClearTargets(combat, { turn: 1 }, { combatEnhancementsReorder: true }), false);
  assert.equal(shouldClearTargets({ id: 'unrelated', active: false }, { turn: 2 }), false);
  assert.equal(shouldClearTargets({ id: 'other-scene', active: true, scene: { id: 'other' } }, {}, {}, true), false);
});

test('target removal is system agnostic and lets Foundry manage its target set', () => {
  let removed = 0;
  for (let i = 0; i < 3; i++) {
    const token = { actor: { system: {} }, setTarget(value, options) {
      assert.equal(value, false);
      assert.equal(options.releaseOthers, false);
      game.user.targets.delete(this);
      removed++;
    } };
    game.user.targets.add(token);
  }
  untargetAllTokens();
  assert.equal(removed, 3);
  assert.equal(game.user.targets.size, 0);
});

test('target removal settings can be changed after startup without reloading', async () => {
  new CombatSidebarCe().startup();
  const combat = encounter('active', []);
  game.combat = combat;
  let removed = 0;
  game.user.targets.add({ setTarget() { removed++; } });
  await env.emit('updateCombat', combat, { turn: 1 }, {});
  assert.equal(removed, 0);
  env.settings.set('removeTargets', true);
  await env.emit('updateCombat', combat, { round: 2 }, {});
  assert.equal(removed, 1);
  env.settings.set('removeTargets', false);
  await env.emit('deleteCombat', combat, {});
  assert.equal(removed, 1);
});

test('init accepts array and object actor-type registries without legacy globals', async () => {
  for (const [index, types] of [['array', ['character', 'npc']], ['object', { character: {}, npc: {} }]]) {
    env = environment();
    game.system.documentTypes.Actor = types;
    await import(`../module/combat-enhancements.js?${index}`);
    await env.emit('init');
    assert.deepEqual(Object.keys(env.registrations.get('showHpForType').choices), ['', '*', 'character', 'npc']);
    assert.equal(env.registrations.get('showHpForType').default, '');
    assert.equal(env.registrations.has('enableHpField'), true);
  }
});

test('visibility is a world setting and received changes refresh player trackers', async () => {
  await import('../module/combat-enhancements.js?world-visibility');
  await env.emit('init');
  const setting = env.registrations.get('showHpForType');
  assert.equal(setting.scope, 'world');
  assert.equal(setting.default, '');
  assert.ok(Object.hasOwn(setting.choices, '*'));
  game.user.isGM = false;
  const { app, root } = tracker(encounter('viewed', [combatant('a')]));
  await env.emit('renderCombatTracker', app, root);
  env.settings.set('showHpForType', '*');
  setting.onChange('*');
  assert.equal(app.renders, 1);
});
