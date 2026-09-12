# Combat Enhancements

Adds editable HP fields, health rings, and drag/drop initiative reordering to Foundry VTT's combat tracker. This fork carries compatibility repairs for the V14 tracker while retaining the V12/V13 render hook interface.

The repair has automated regression and browser coverage. A licensed Foundry world with your game system and other modules still needs the checks in [TESTING.md](TESTING.md).

## Installation

The published manifest is:

https://raw.githubusercontent.com/CanDincer/Combat-Enhancements/main/module.json

That manifest downloads `combat-enhancements.zip` from the release tagged `latest`. Merging source changes does not update that ZIP. A new release archive must be built and published before Foundry's normal installer receives these repairs.

To try a development branch before release, download its source archive, extract it, rename the module directory to `combat-enhancements`, and place it under your Foundry user data directory's `Data/modules`. The installed directory must contain `module.json`, `module/`, `lang/`, and `styles/dist/`. Restart Foundry and enable Combat Enhancements in the world. The repository includes generated runtime assets, so a source-archive install does not require Node.js.

## Health display and editing

The module uses the token's Bar 1 resource, falling back to `system.attributes.hp` when no resource is configured. Both scalar values and `{value, max}` resources are supported for editing. A health ring needs a finite value and positive maximum; zero HP is valid.

GMs see health rings. Player visibility follows the configured token bar modes and the "Always show health for actor type" setting. Public hover/control bar modes display a ring in the tracker; owner-only modes require ownership. When Bar Brawl supplies a visibility rule, that rule can hide the ring. Tokens without a canvas object are handled conservatively.

HP fields require permission to update the actor. Enter an absolute value such as `20` or a signed adjustment such as `-5` or `+3`. Enter or leaving the field saves; Escape cancels. Blank and malformed values are rejected. The game system remains responsible for its own HP limits and update rules.

Each tracker edits its own viewed encounter, including pop-outs and detached windows. Core portrait actions, initiative fields, and system controls remain available. Actor and token updates refresh open trackers.

## Initiative reordering

GMs can drag a combatant's portrait or row. Drop on the top half of a row to insert before it, or on the bottom half to insert after it. Roll all initiatives first.

Ordinary moves assign a value between neighboring initiatives and preserve decimal tie breakers. If no numeric gap exists, enable initiative reflow to renumber the entire encounter in the requested order. Reflow replaces existing initiative values, including decimal tie breakers. Reordering preserves the active combatant and suppresses turn events.

For V14 combatants with shared group initiative, use the core or system group controls. Individual member drags and reflows that would overwrite shared group initiatives are rejected with an explanation. Custom turn orders that do not sort by descending initiative are also left to their system controls.

## Other settings

- **Hide non-ally initiative:** hides initiative controls for non-friendly combatants on player clients. This is a visual preference, not a restriction on document data access.
- **Remove targets:** clears the user's targets on relevant turn/round changes and encounter deletion. It does not clear them for unrelated encounter edits or initiative reordering. This setting takes effect without reloading and does not assume a system-specific HP path.
- HP fields, health rings, and initiative reflow can each be configured separately.

## Development

Use Node.js 22 or newer:

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Edit translations and the manifest in `yaml/`, and styles in `styles/src/`. `npm run build` regenerates `module.json`, `lang/`, and `styles/dist/`; commit generated files with their sources. CI runs the regression suite, build, browser smoke test, and a check that generated files are current.

See [TESTING.md](TESTING.md) for test scope and live-world verification.

Original module by Asacolips: [upstream project](https://gitlab.com/asacolips-projects/foundry-mods/combat-enhancements).
