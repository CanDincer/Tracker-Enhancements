const MODULE_ID = 'combat-enhancements';

/** Resolve a fresh view model without adding properties to Foundry Documents. */
export function getHealthData(combatant) {
  const actor = combatant?.actor;
  if (!actor) return null;
  const token = combatant.token;
  const getProperty = foundry.utils.getProperty;
  const owner = game.user.isGM || actor.isOwner;
  const modes = CONST.TOKEN_DISPLAY_MODES;
  const alwaysOnType = game.settings.get(MODULE_ID, 'showHpForType');
  const mode = token?.displayBars ?? modes.NONE;
  const publicBar = [modes.ALWAYS, modes.CONTROL, modes.HOVER].includes(mode);
  const ownerBar = [modes.OWNER, modes.OWNER_HOVER].includes(mode) && owner;
  // '*' includes every combatant type; names such as 'encounter' remain literal actor types.
  let visible = game.user.isGM || publicBar || ownerBar || alwaysOnType === '*'
    || (alwaysOnType && actor.type === alwaysOnType);

  // Bar 1 overrides the conventional HP resource, including at zero HP.
  let attribute = token?.bar1?.attribute || 'attributes.hp';
  const barApi = game.modules.get('barbrawl')?.active ? globalThis.BarBrawlApi : null;
  const customBar = token && barApi?.getBar?.(token, 'bar1');
  if (customBar?.attribute) attribute = customBar.attribute;
  attribute = attribute.replace(/^system\./, '');
  const raw = getProperty(actor.system, attribute);
  const value = typeof raw === 'number' ? raw : raw?.value;
  const path = `system.${attribute}${typeof raw === 'number' ? '' : '.value'}`;
  const resource = token?.getBarAttribute?.('bar1', { alternative: attribute });
  let current = resource?.type === 'bar' ? resource.value : raw?.value;
  let max = resource?.type === 'bar' ? resource.max : raw?.max;

  if (customBar) {
    const actual = barApi.getActualBarValue?.(token, customBar);
    if (actual) ({ value: current, max } = actual);
    if (barApi.isBarVisible) {
      // A token in another scene has no canvas object to pass to Bar Brawl.
      visible = visible && (token.object
        ? barApi.isBarVisible(token.object, customBar, true) : game.user.isGM);
    }
  }

  const canUpdate = game.user.isGM || (actor.canUserModify?.(game.user, 'update') ?? actor.isOwner);
  return {
    actor, path, value, current, max,
    editable: Boolean(game.settings.get(MODULE_ID, 'enableHpField') && canUpdate
      && Number.isFinite(value) && resource?.editable !== false),
    displayHealth: Boolean(game.settings.get(MODULE_ID, 'enableHpRadial') && visible
      && Number.isFinite(current) && Number.isFinite(max) && max > 0),
  };
}

/** Absolute decimal values or a signed delta; never submit NaN/Infinity or blank text. */
export function parseHpInput(text, current) {
  const input = String(text).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input)) return null;
  const number = Number(input);
  const result = /^[+-]/.test(input) ? current + number : number;
  return Number.isFinite(current) && Number.isFinite(result) ? result : null;
}
