import { CombatSidebarCe } from '../../module/combat.js';

const settings = new Map(Object.entries({
  enableHpField: true, enableHpRadial: true, showHpForType: '', enableInitReflow: false,
  removeTargets: false, hideNonAllyInitiative: false,
}));
const handlers = new Map();
globalThis.Hooks = { on(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); } };
globalThis.foundry = { utils: {
  getProperty(object, path) { return path.split('.').reduce((value, key) => value?.[key], object); },
} };
globalThis.CONST = {
  TOKEN_DISPLAY_MODES: { NONE: 0, CONTROL: 10, OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50 },
  TOKEN_DISPOSITIONS: { HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 },
};
const warnings = [], errors = [];
globalThis.ui = { notifications: { warn(message) { warnings.push(message); }, error(message) { errors.push(message); } } };
globalThis.game = {
  user: { isGM: true, targets: new Set() }, modules: new Map(),
  settings: { get(_module, key) { return settings.get(key); } },
  i18n: { localize(key) { return key === 'COMBAT_ENHANCEMENTS.hp.label' ? 'HP' : key; } },
};

const members = ['a', 'b', 'c'].map((id, index) => {
  const actor = {
    isOwner: id === 'a', type: 'character', system: { attributes: { hp: { value: 20 - 10 * index, max: 20 } } },
    writes: [],
    async update(data) {
      this.writes.push(data);
      this.system.attributes.hp.value = data['system.attributes.hp.value'];
      queueMicrotask(() => app.render());
      return this;
    },
  };
  return {
    id, name: index ? `Combatant ${id}` : 'A very long character name to exercise narrow tracker layouts',
    initiative: 20 - 5 * index, actor,
    token: {
      disposition: id === 'a' ? 1 : -1, displayBars: 50, bar1: { attribute: '' },
      getBarAttribute() { return { type: 'bar', editable: true, ...actor.system.attributes.hp }; },
    },
  };
});
const collection = new Map(members.map(c => [c.id, c]));
collection.some = fn => Array.from(collection.values()).some(fn);
const combat = {
  id: 'encounter', combatants: collection, turns: [...members], turn: 1, writes: [],
  get combatant() { return this.turns[this.turn]; },
  async updateEmbeddedDocuments(type, updates, options) {
    this.writes.push({ type, updates, options });
    for (const update of updates) this.combatants.get(update._id).initiative = update.initiative;
    this.turns.sort((a, b) => b.initiative - a.initiative);
  },
  async update(data) { Object.assign(this, data); },
};
members.forEach(c => { c.parent = combat; });
game.combat = combat;
const sidebar = new CombatSidebarCe();
const root = document.querySelector('.combat-sidebar');
const app = {
  viewed: combat, rendered: true,
  render() {
    root.querySelector('ol').innerHTML = combat.turns.map(c => `
      <li class="combatant" data-combatant-id="${c.id}">
        <img class="token-image" data-action="pingCombatant" alt="Portrait" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%236b768d'/%3E%3C/svg%3E">
        <div class="token-name">
          <h4 class="name">${c.name}</h4>
          <div class="combatant-controls">
            <button class="inline-control" data-action="toggleHidden">H</button>
            <button class="inline-control" data-action="toggleDefeated">D</button>
            <button class="inline-control" data-action="pingCombatant">P</button>
            <button class="inline-control" data-action="targetCombatant">T</button>
          </div>
        </div>
        <div class="token-initiative"><input class="initiative-input" value="${c.initiative}"></div>
      </li>`).join('');
    sidebar.renderTracker(this, root);
  },
};
let coreClicks = 0, coreChanges = 0;
root.addEventListener('click', event => { if (event.target.closest('[data-action]')) coreClicks++; });
root.addEventListener('change', event => { if (event.target.matches('.initiative-input')) coreChanges++; });
app.render();
globalThis.testHarness = {
  app, root, sidebar, combat, members, settings, warnings, errors,
  get coreClicks() { return coreClicks; }, get coreChanges() { return coreChanges; },
};
