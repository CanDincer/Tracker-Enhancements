/** Plan a move using the encounter's turn order, never another tracker's DOM. */
export function planInitiativeMove(turns, sourceId, targetId, before, reflow = false) {
  const source = turns.find(c => c.id === sourceId);
  if (!source || sourceId === targetId || !turns.some(c => c.id === targetId)) return { updates: [] };
  // Core derives a member's initiative from its group; individual writes would be ignored.
  const hasSharedInitiative = c => Number.isFinite(c.group?.initiative);
  if (hasSharedInitiative(source)) return { error: 'groupInitiative' };
  const ordered = turns.filter(c => c.id !== sourceId);
  const index = ordered.findIndex(c => c.id === targetId) + (before ? 0 : 1);
  ordered.splice(index, 0, source);
  if (ordered.every((c, i) => c.id === turns[i].id)) return { updates: [] };
  if (turns.some(c => !Number.isFinite(c.initiative))) return { error: 'rollInitiativeFirst' };
  // Custom systems can sort turns independently of descending initiative.
  if (turns.some((c, i) => i > 0 && c.initiative > turns[i - 1].initiative)) {
    return { error: 'unsupportedTurnOrder' };
  }

  const previous = ordered[index - 1]?.initiative;
  const next = ordered[index + 1]?.initiative;
  const initiative = previous === undefined ? next + 1
    : next === undefined ? previous - 1 : previous / 2 + next / 2;
  if (Number.isFinite(initiative) && (previous === undefined || initiative < previous)
    && (next === undefined || initiative > next)) {
    return { updates: [{ _id: sourceId, initiative }] };
  }
  if (!reflow) return { error: 'initiativeReflowRequired' };
  if (turns.some(hasSharedInitiative)) return { error: 'groupInitiative' };

  // Renumber the entire order: changing just a tied pair can leapfrog other turns.
  return {
    updates: ordered.map((c, i) => ({ _id: c.id, initiative: ordered.length - i }))
      .filter(update => turns.find(c => c.id === update._id).initiative !== update.initiative),
  };
}
