const MODULE_ID = 'tracker-enhancements';
const LEGACY_ID = 'combat-enhancements';
const SETTING_TYPES = {
  showHpForType: 'string',
  enableInitReflow: 'boolean',
  enableHpField: 'boolean',
  enableHpRadial: 'boolean',
  removeTargets: 'boolean',
  hideNonAllyInitiative: 'boolean',
};

/** Copy saved world settings after ready, including when the old module is disabled. */
export async function migrateLegacySettings() {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;

  const storage = game.settings.storage.get('world');
  let failed = false;
  for (const [key, type] of Object.entries(SETTING_TYPES)) {
    // Presence matters: an explicit false or empty string is still a saved preference.
    if (storage.getSetting(`${MODULE_ID}.${key}`)) continue;
    const legacy = storage.getSetting(`${LEGACY_ID}.${key}`);
    if (!legacy) continue;
    try {
      // The document source stores JSON in V12-V14; its prepared value differs by version.
      const value = JSON.parse(legacy.toObject().value);
      if (typeof value !== type) throw new TypeError(`Invalid saved value for ${key}`);
      await game.settings.set(MODULE_ID, key, value);
    } catch (error) {
      failed = true;
      console.error(`Tracker Enhancements | Could not migrate ${key}`, error);
    }
  }
  // Keep legacy documents intact. Failed copies can be retried on the next GM login.
  if (failed) ui.notifications.warn(game.i18n.localize('TRACKER_ENHANCEMENTS.migrationFailed'));
}
