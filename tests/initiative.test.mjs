import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planInitiativeMove } from '../module/initiative.js';
const make = values => values.map((initiative, i) => ({ id: String(i), initiative }));
function orderAfter(turns, plan) {
  return turns.map(c => ({ ...c, initiative: plan.updates.find(u => u._id === c.id)?.initiative ?? c.initiative }))
    .sort((a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id)).map(c => c.id);
}

test('move before the first row, after the last row and between rows', () => {
  const turns = make([20, 15, 10, 5]);
  for (const [source, target, before, expected] of [
    ['3', '0', true, ['3', '0', '1', '2']],
    ['0', '3', false, ['1', '2', '3', '0']],
    ['3', '1', false, ['0', '1', '3', '2']],
    ['0', '2', true, ['1', '0', '2', '3']],
  ]) {
    const plan = planInitiativeMove(turns, source, target, before);
    assert.deepEqual(orderAfter(turns, plan), expected);
    assert.equal(plan.updates.length, 1);
  }
  assert.deepEqual(turns.map(c => c.initiative), [20, 15, 10, 5]);
});

test('self drops, adjacent no-ops and stale IDs do not write', () => {
  const turns = make([20, 10]);
  for (const args of [['0', '0', true], ['0', '1', true], ['1', '0', false], ['gone', '0', false], ['0', 'gone', true]]) {
    assert.deepEqual(planInitiativeMove(turns, ...args), { updates: [] });
  }
});

test('decimal tie breakers are retained when there is a representable gap', () => {
  const turns = make([20.18, 20.12, 10]);
  const plan = planInitiativeMove(turns, '2', '0', false);
  assert.equal(plan.updates[0].initiative, 20.15);
  assert.deepEqual(orderAfter(turns, plan), ['0', '2', '1']);
});

test('reflow handles multi-way ties without leapfrogging the preceding combatant', () => {
  const turns = make([19, 18, 18, 18, 10]);
  assert.equal(planInitiativeMove(turns, '4', '1', false).error, 'initiativeReflowRequired');
  const plan = planInitiativeMove(turns, '4', '1', false, true);
  assert.deepEqual(orderAfter(turns, plan), ['0', '1', '4', '2', '3']);
});

test('floating-point exhaustion is treated as a tie rather than a successful no-op', () => {
  const turns = make([1 + Number.EPSILON, 1, 0]);
  assert.equal(planInitiativeMove(turns, '2', '0', false).error, 'initiativeReflowRequired');
  assert.deepEqual(orderAfter(turns, planInitiativeMove(turns, '2', '0', false, true)), ['0', '2', '1']);
});

test('unrolled and custom non-descending turn orders are not silently rewritten', () => {
  assert.equal(planInitiativeMove(make([20, null]), '1', '0', true, true).error, 'rollInitiativeFirst');
  assert.equal(planInitiativeMove(make([10, 20, 5]), '2', '0', true, true).error, 'unsupportedTurnOrder');
});

test('shared group initiatives are not overwritten by member drags or encounter reflow', () => {
  const turns = make([20, 18, 18, 10]);
  turns[1].group = turns[2].group = { id: 'shared', initiative: 18 };
  assert.equal(planInitiativeMove(turns, '1', '0', true).error, 'groupInitiative');
  assert.equal(planInitiativeMove(turns, '3', '1', false, true).error, 'groupInitiative');
  assert.deepEqual(orderAfter(turns, planInitiativeMove(turns, '3', '0', false)), ['0', '3', '1', '2']);
});
