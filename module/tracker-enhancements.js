import { TrackerEnhancements } from './tracker.js';
import { migrateLegacySettings } from './migration.js';

Hooks.once('init', function() {
  const combatSidebar = new TrackerEnhancements();
  const refresh = () => combatSidebar.refreshTrackers();

  const actorTypes = game.system?.documentTypes?.Actor ?? CONFIG.Actor?.documentTypes ?? {};
  const types = Array.isArray(actorTypes) ? actorTypes : Object.keys(actorTypes);
  const choices = {
    '': 'TRACKER_ENHANCEMENTS.setting.showHpForType.tokenVisibility',
    '*': 'TRACKER_ENHANCEMENTS.setting.showHpForType.all',
  };
  for (const type of types) {
    choices[type] = type;
  }

  // Translations load after init. Compound labels cannot be translated by the settings form.
  Hooks.once('i18nInit', () => {
    const prefix = game.i18n.localize('TRACKER_ENHANCEMENTS.setting.showHpForType.actorType');
    for (const type of types) {
      const key = CONFIG.Actor?.typeLabels?.[type] ?? `TYPES.Actor.${type}`;
      const label = game.i18n.localize(key);
      choices[type] = `${prefix}: ${label === key ? type : label}`;
    }
  });

  // HP disclosure is a GM-controlled world policy shared by all player clients.
  // Keep the existing setting key and actor-type values so saved choices remain valid.
  game.settings.register('tracker-enhancements', 'showHpForType', {
    name: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.showHpForType.label'),
    hint: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.showHPForType.description'),
    scope: 'world',
    config: true,
    default: '',
    type: String,
    choices: choices,
    onChange: refresh,
  });

  game.settings.register('tracker-enhancements', 'enableInitReflow', {
    name: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.reflow.label'),
    hint: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.reflow.description'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register('tracker-enhancements', 'enableHpField', {
    name: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.enableHpField.label'),
    hint: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.enableHpField.description'),
    scope: 'world',
    config: true,
    default: true,
    type: Boolean,
    onChange: refresh,
  });

  game.settings.register('tracker-enhancements', 'enableHpRadial', {
    name: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.enableHpRadial.label'),
    hint: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.enableHpRadial.description'),
    scope: 'world',
    config: true,
    default: true,
    type: Boolean,
    onChange: refresh,
  });

  game.settings.register('tracker-enhancements', 'removeTargets', {
    name: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.removeTargets.label'),
    hint: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.removeTargets.description'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register('tracker-enhancements', 'hideNonAllyInitiative', {
    name: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.hideNonAllyInitiative.label'),
    hint: game.i18n.localize('TRACKER_ENHANCEMENTS.setting.hideNonAllyInitiative.description'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: refresh,
  });

  combatSidebar.startup();
  Hooks.once('ready', migrateLegacySettings);
});
