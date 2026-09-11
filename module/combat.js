import { CeUtility } from './utility.js';
import { getHealthData, parseHpInput } from './health.js';
import { planInitiativeMove } from './initiative.js';
import { shouldClearTargets, untargetAllTokens } from './removeTarget.js';

const MODULE_ID = 'combat-enhancements';
const ROW = '.combatant[data-combatant-id], .directory-item[data-combatant-id]';
const DRAG_TYPE = 'application/x-combat-enhancements';

/** Augment the existing tracker while preserving core and system controls. */
export class CombatSidebarCe {
  constructor() {
    this.apps = new Set();
    this.roots = new WeakMap();
    this.pendingCombats = new Set();
  }

  startup() {
    Hooks.on('renderCombatTracker', (app, html) => this.renderTracker(app, html));
    Hooks.on('closeCombatTracker', app => this.apps.delete(app));
    Hooks.on('updateActor', actor => this.refreshTrackers(c => c.actor === actor || (actor.uuid && c.actor?.uuid === actor.uuid)));
    Hooks.on('updateToken', token => this.refreshTrackers(c => c.token === token || (token.uuid && c.token?.uuid === token.uuid)));
    Hooks.on('updateCombat', (combat, changed, options) => {
      if (shouldClearTargets(combat, changed, options)) untargetAllTokens();
    });
    Hooks.on('deleteCombat', (combat, options) => {
      if (shouldClearTargets(combat, {}, options, true)) untargetAllTokens();
    });
  }

  getCombat(app) {
    // An explicitly empty tracker must not fall back to an unrelated active combat.
    return app && 'viewed' in app ? app.viewed : game.combat;
  }

  refreshTrackers(predicate = () => true) {
    for (const app of this.apps) {
      const combat = this.getCombat(app);
      if (app.rendered && combat?.combatants.some(predicate)) app.render();
    }
  }

  renderTracker(app, html) {
    // V12 passes jQuery; V13/V14 pass a native element, possibly in another window.
    const root = html?.nodeType === 1 ? html : html?.[0];
    if (!root?.querySelectorAll) return;
    this.apps.add(app);
    this.bindListeners(root, app);
    const combat = this.getCombat(app);
    for (const row of root.querySelectorAll(ROW)) {
      // The same DOM can survive partial renders. Remove only our own additions.
      row.querySelectorAll('.ce-modify-hp-wrapper, .ce-drop-indicator, .ce-image-wrapper > .progress-ring')
        .forEach(element => element.remove());
      row.querySelectorAll('.ce-image-wrapper').forEach(wrapper => wrapper.replaceWith(...wrapper.childNodes));
      if (row.dataset.ceDraggable !== undefined) {
        if (row.dataset.ceDraggable === 'unset') row.removeAttribute('draggable');
        else row.setAttribute('draggable', row.dataset.ceDraggable);
        delete row.dataset.ceDraggable;
      }
      row.classList.remove('ce-combatant', 'ce-hide-initiative', 'ce-drop-before', 'ce-drop-after');
      const combatant = combat?.combatants.get(row.dataset.combatantId);
      if (!combatant) continue;
      row.classList.add('ce-combatant');
      const health = getHealthData(combatant);
      const doc = root.ownerDocument;
      const image = row.querySelector('.token-image');
      if (health?.displayHealth && image) {
        const wrapper = doc.createElement('div');
        wrapper.className = 'ce-image-wrapper';
        image.before(wrapper);
        wrapper.append(image);
        wrapper.insertAdjacentHTML('beforeend', CeUtility.getProgressCircleHtml(
          CeUtility.getProgressCircle({ current: health.current, max: health.max })));
      }
      if (health?.editable) {
        const label = doc.createElement('label');
        label.className = 'ce-modify-hp-wrapper';
        label.append(`${game.i18n.localize('COMBAT_ENHANCEMENTS.hp.label')} `);
        const input = doc.createElement('input');
        input.className = 'ce-modify-hp';
        input.type = 'text';
        input.autocomplete = 'off';
        input.value = health.value;
        // No name: keep this field out of core/system ApplicationV2 form submissions.
        input.dataset.ceHpPath = health.path;
        input.setAttribute('aria-label', `${game.i18n.localize('COMBAT_ENHANCEMENTS.hp.label')}: ${combatant.name ?? ''}`);
        label.append(input);
        (row.querySelector('.combatant-controls') ?? row.querySelector('.token-name') ?? row).append(label);
      }
      if (game.user.isGM) {
        row.dataset.ceDraggable = row.getAttribute('draggable') ?? 'unset';
        row.draggable = true;
        const indicator = doc.createElement('span');
        indicator.className = 'ce-drop-indicator';
        row.append(indicator);
      }
      row.classList.toggle('ce-hide-initiative', Boolean(!game.user.isGM
        && game.settings.get(MODULE_ID, 'hideNonAllyInitiative')
        && combatant.token?.disposition !== CONST.TOKEN_DISPOSITIONS.FRIENDLY));
    }
  }

  bindListeners(root, app) {
    const existing = this.roots.get(root);
    if (existing) { existing.app = app; return; }
    const state = { app };
    this.roots.set(root, state);
    // Root capture prevents core row/initiative handlers from consuming HP events.
    for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick', 'keydown']) {
      root.addEventListener(type, event => {
        if (!event.target.closest?.('.ce-modify-hp-wrapper')) return;
        event.stopPropagation();
        const input = event.target.closest('.ce-modify-hp');
        if (!input) return;
        if (type === 'click') input.select();
        if (type === 'keydown' && ['Enter', 'Escape'].includes(event.key)) {
          event.preventDefault();
          if (event.key === 'Escape') {
            const row = input.closest(ROW);
            const health = getHealthData(this.getCombat(state.app)?.combatants.get(row?.dataset.combatantId));
            if (health) input.value = health.value;
          }
          input.blur();
        }
      }, true);
    }
    root.addEventListener('change', event => {
      const input = event.target.closest?.('.ce-modify-hp');
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      void this.updateHp(state.app, input);
    }, true);
    root.addEventListener('dragstart', event => this.onDragStart(state.app, event), true);
    root.addEventListener('dragover', event => this.onDragOver(root, event), true);
    root.addEventListener('dragleave', event => {
      const row = event.target.closest?.(ROW);
      if (row && !row.contains(event.relatedTarget)) row.classList.remove('ce-drop-before', 'ce-drop-after');
    });
    root.addEventListener('dragend', () => this.clearDropIndicators(root));
    root.addEventListener('drop', event => { void this.onDrop(state.app, root, event); }, true);
  }

  async updateHp(app, input) {
    if (input.disabled) return;
    const combat = this.getCombat(app);
    const combatant = combat?.combatants.get(input.closest(ROW)?.dataset.combatantId);
    const health = getHealthData(combatant);
    if (!health?.editable || input.dataset.ceHpPath !== health.path) return;
    const value = parseHpInput(input.value, health.value);
    if (value === null) {
      input.value = health.value;
      ui.notifications.warn(game.i18n.localize('COMBAT_ENHANCEMENTS.invalidHp'));
      return;
    }
    if (value === health.value) { input.value = value; return; }
    input.disabled = true;
    try {
      await health.actor.update({ [health.path]: value });
      input.value = foundry.utils.getProperty(health.actor, health.path);
    } catch (error) {
      input.value = foundry.utils.getProperty(health.actor, health.path);
      this.reportError(error);
    } finally {
      input.disabled = false;
    }
  }

  onDragStart(app, event) {
    if (!game.user.isGM || !event.dataTransfer) return;
    const row = event.target.closest?.(ROW);
    const combat = this.getCombat(app);
    if (!combat?.combatants.get(row?.dataset.combatantId)) return;
    if (event.target.closest('input, button, a, select, textarea')) {
      event.preventDefault();
      return;
    }
    const data = { type: MODULE_ID, combatId: combat.id, combatantId: row.dataset.combatantId };
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(data));
    event.dataTransfer.setData('text/plain', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
    const image = row.querySelector('.ce-image-wrapper, .token-image') ?? row;
    event.dataTransfer.setDragImage?.(image, 24, 24);
    event.stopPropagation();
  }

  clearDropIndicators(root) {
    root.querySelectorAll('.ce-drop-before, .ce-drop-after')
      .forEach(row => row.classList.remove('ce-drop-before', 'ce-drop-after'));
  }

  isOurDrag(event) {
    return game.user.isGM && Array.from(event.dataTransfer?.types ?? []).includes(DRAG_TYPE);
  }

  onDragOver(root, event) {
    if (!this.isOurDrag(event)) return;
    const row = event.target.closest?.(ROW);
    if (!row) return;
    // preventDefault is required on EVERY dragover, including over the row itself.
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    this.clearDropIndicators(root);
    const rect = row.getBoundingClientRect();
    row.classList.add(event.clientY < rect.top + rect.height / 2 ? 'ce-drop-before' : 'ce-drop-after');
  }

  async onDrop(app, root, event) {
    this.clearDropIndicators(root);
    if (!this.isOurDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const row = event.target.closest?.(ROW);
    const combat = this.getCombat(app);
    if (!row || !combat || this.pendingCombats.has(combat.id)) return;
    let data;
    try { data = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)); }
    catch { return; }
    if (data?.type !== MODULE_ID || data.combatId !== combat.id) return;
    const rect = row.getBoundingClientRect();
    const result = planInitiativeMove(combat.turns, data.combatantId, row.dataset.combatantId,
      event.clientY < rect.top + rect.height / 2, game.settings.get(MODULE_ID, 'enableInitReflow'));
    if (result.error) {
      ui.notifications.warn(game.i18n.localize(`COMBAT_ENHANCEMENTS.${result.error}`));
      return;
    }
    if (!result.updates.length) return;
    this.pendingCombats.add(combat.id);
    const activeId = combat.combatant?.id;
    const options = { combatEnhancementsReorder: true, turnEvents: false };
    try {
      await combat.updateEmbeddedDocuments('Combatant', result.updates, options);
      const turn = combat.turns.findIndex(c => c.id === activeId);
      if (activeId && turn >= 0 && turn !== combat.turn) await combat.update({ turn }, options);
      this.refreshTrackers(c => c.parent?.id === combat.id);
    } catch (error) {
      this.reportError(error);
    } finally {
      this.pendingCombats.delete(combat.id);
    }
  }

  reportError(error) {
    console.error('Combat Enhancements | Update failed', error);
    ui.notifications.error(game.i18n.localize('COMBAT_ENHANCEMENTS.updateFailed'));
  }
}
