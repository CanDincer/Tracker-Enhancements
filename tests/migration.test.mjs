import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacySettings } from '../module/migration.js';
import { environment, tracker, encounter, combatant } from './helpers.mjs';

let env, documents, writes, imports = 0;
function save(namespace, key, value) {
  const document = { key: `${namespace}.${key}`, toObject: () => ({ value: JSON.stringify(value) }) };
  documents.set(document.key, document);
  return document;
}
function legacy(key, value) { return save('combat-enhancements', key, value); }

beforeEach(async () => {
  env = environment();
  documents = new Map();
  writes = [];
  game.user.id = 'gm';
  game.users = { activeGM: game.user };
  game.settings.storage = new Map([['world', { getSetting: key => documents.get(key) }]]);
  game.settings.set = async (namespace, key, value) => {
    assert.equal(namespace, 'tracker-enhancements');
    assert.equal(env.registrations.get(key)?.scope, 'world');
    writes.push([key, value]);
    save(namespace, key, value);
    env.settings.set(key, value);
    env.registrations.get(key).onChange?.(value);
  };
  await import(`../module/tracker-enhancements.js?migration-${imports++}`);
  await env.emit('init');
});

test('ready copies all six saved settings from a disabled predecessor and refreshes trackers', async () => {
  const values = { showHpForType: '*', enableInitReflow: true, enableHpField: false,
    enableHpRadial: false, removeTargets: true, hideNonAllyInitiative: true };
  for (const [key, value] of Object.entries(values)) legacy(key, value);
  legacy('unrelated', 'keep');
  const originals = [...documents.entries()];
  const { app, root } = tracker(encounter('viewed', [combatant('a')]));
  await env.emit('renderCombatTracker', app, root);
  assert.deepEqual(writes, []);

  await env.emit('ready');

  assert.deepEqual(Object.fromEntries(writes), values);
  for (const [key, value] of Object.entries(values)) {
    assert.equal(game.settings.get('tracker-enhancements', key), value);
  }
  for (const [key, document] of originals) assert.equal(documents.get(key), document);
  assert.equal(documents.has('tracker-enhancements.unrelated'), false);
  assert.ok(app.renders > 0);
});

test('migration preserves explicit new defaults and never reapplies old preferences', async () => {
  legacy('showHpForType', '*');
  legacy('enableHpField', true);
  legacy('enableInitReflow', true);
  legacy('removeTargets', false);
  save('tracker-enhancements', 'showHpForType', '');
  save('tracker-enhancements', 'enableHpField', false);
  save('tracker-enhancements', 'enableInitReflow', false);
  const originals = [...documents.entries()];

  await env.emit('ready');
  assert.deepEqual(writes, [['removeTargets', false]]);
  for (const [key, document] of originals) assert.equal(documents.get(key), document);
  legacy('removeTargets', true);
  await migrateLegacySettings();
  assert.deepEqual(writes, [['removeTargets', false]]);
});

test('empty visibility and custom actor-type strings retain their exact meaning', async () => {
  for (const value of ['', 'npc', 'encounter', 'custom-type']) {
    documents.clear();
    legacy('showHpForType', value);
    await migrateLegacySettings();
    assert.equal(game.settings.get('tracker-enhancements', 'showHpForType'), value);
  }
});

test('fresh worlds, players, and secondary GMs do not write migration settings', async () => {
  await env.emit('ready');
  assert.deepEqual(writes, []);
  legacy('showHpForType', '*');
  game.user.isGM = false;
  await migrateLegacySettings();
  game.user.isGM = true;
  game.users.activeGM = { id: 'another-gm' };
  await migrateLegacySettings();
  game.users.activeGM = null;
  await migrateLegacySettings();
  assert.deepEqual(writes, []);
});

test('malformed or wrong-type legacy data is reported without blocking other settings', async t => {
  const errors = t.mock.method(console, 'error', () => {});
  const broken = legacy('showHpForType', '*');
  broken.toObject = () => ({ value: '{malformed' });
  legacy('enableHpField', 'false');
  legacy('removeTargets', true);

  await env.emit('ready');

  assert.deepEqual(writes, [['removeTargets', true]]);
  assert.equal(errors.mock.callCount(), 2);
  assert.equal(env.warnings.length, 1);
  assert.equal(documents.get('combat-enhancements.showHpForType'), broken);
  assert.equal(documents.has('tracker-enhancements.enableHpField'), false);
});

test('failed writes retry later without overwriting successfully migrated preferences', async t => {
  t.mock.method(console, 'error', () => {});
  legacy('showHpForType', '*');
  legacy('enableHpField', false);
  const set = game.settings.set;
  game.settings.set = async (namespace, key, value) => {
    if (key === 'showHpForType') throw new Error('Temporary write failure');
    return set(namespace, key, value);
  };
  await env.emit('ready');
  assert.deepEqual(writes, [['enableHpField', false]]);
  assert.equal(env.warnings.length, 1);

  game.settings.set = set;
  await migrateLegacySettings();
  assert.deepEqual(writes, [['enableHpField', false], ['showHpForType', '*']]);
});
