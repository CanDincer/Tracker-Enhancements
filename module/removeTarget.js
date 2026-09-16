export function untargetAllTokens() {
  // setTarget updates Foundry's target set and broadcasts the change itself.
  for (const token of Array.from(game.user.targets ?? [])) {
    token.setTarget(false, { releaseOthers: false });
  }
}

export function shouldClearTargets(combat, changed, options = {}, deleted = false) {
  if (!game.settings.get('tracker-enhancements', 'removeTargets') || options.trackerEnhancementsReorder) return false;
  const relevant = game.combat?.id === combat.id || (combat.active
    && (!combat.scene || combat.scene.id === game.user.viewedScene));
  return Boolean(relevant && (deleted || Object.hasOwn(changed, 'turn') || Object.hasOwn(changed, 'round')));
}
