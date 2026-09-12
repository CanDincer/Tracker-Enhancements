# Validation for the V14 repair

## Automated coverage

The regression suite contains 31 tests covering:

- HP resource resolution, zero HP, invalid values, permissions, visibility, and optional Bar Brawl APIs.
- Native and legacy tracker roots, repeated renders, separate documents, the viewed encounter, and preservation of core control events.
- Actor update failures, refreshes of open trackers, and settings changes.
- Before/after initiative moves, decimal values, ties, floating-point exhaustion, stale or foreign drag data, shared groups, and active-combatant preservation.
- Target clearing on relevant turn/round/end events without system-specific HP assumptions.

The Playwright smoke test runs actual browser input and drag/drop events against a tracker fixture. It checks Enter, Escape, blur validation, core controls, narrow rows with long names, dark/light themes, active-turn preservation, player edit permissions, and hidden initiative. It produces screenshots in `test-results/`.

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:browser
git diff --exit-code -- module.json lang styles/dist
```

An existing compatible Chromium executable can be selected with `CE_CHROMIUM_PATH`. Set `CE_CORE_CSS` to a locally available Foundry core CSS file to repeat the layout checks with that stylesheet.

## What was checked

The implementation was checked against the official V14 APIs for [CombatTracker](https://foundryvtt.com/api/v14/classes/foundry.applications.sidebar.tabs.CombatTracker.html), [TokenDocument](https://foundryvtt.com/api/v14/classes/foundry.documents.TokenDocument.html), and [Combat](https://foundryvtt.com/api/v14/classes/foundry.documents.Combat.html), and the V14.365 client served by the public Foundry demo.

Local validation passed all 31 regressions, the build, and the browser smoke test in Chromium 134. The browser test also passed with the public demo's V14.365 core stylesheet, and screenshots were inspected. GitHub Actions repeats the regression, build, and browser checks; use its current run for the result on a particular commit.

Tests model Foundry documents and tracker markup. They do not launch a licensed Foundry server, exercise socket synchronization, or establish compatibility with every game system and third-party module. No live-world validation is claimed.

## Live-world checks before release

Use a disposable encounter in your actual V14 build and game system, with a GM and a player connected. Record the build, system version, browser, enabled modules, and any console errors.

| Area | Exercise | Expected result |
| --- | --- | --- |
| Tracker rendering | Open sidebar, pop-out, and detached tracker; switch viewed encounters; repeatedly render or change settings | One set of module controls per row; each window operates on its own encounter |
| Core and system controls | Use portrait ping, visibility, defeated, targeting, initiative entry, and group controls | Existing actions still work |
| Resources | Try linked and unlinked tokens, zero HP, custom Bar 1, scalar resources, missing tokens/actors, and zero maximum | Correct editable resource; valid rings only; no errors |
| HP editing | Enter absolute and signed values; save by Enter and blur; cancel with Escape; try blank/invalid input | Correct actor update, one save, cancellation and useful feedback |
| Permissions | Compare GM, owner, observer, and non-owner; change ownership while a tracker is open | HP editing follows current actor update permission |
| Visibility | Exercise public/owner/hidden token bars and actor-type override | Rings follow the configured rules; no unexpected enemy HP controls |
| Layout | Use dark/light themes, narrow sidebar, long names, and many system controls | Fields fit; names truncate; portrait and action targets remain usable |
| Reordering | Move before first, after last, and between rows, including decimals and ties | Requested order; ties explain the reflow option; active combatant stays active |
| Group/custom initiative | Use native shared groups and any system-specific sort mode | Core/system controls remain usable; unsupported module moves explain the limitation |
| Other drag data | Drop actors and tokens from elsewhere, and drag between encounters | No unintended initiative writes |
| Target clearing | Toggle the setting without reload; advance/reverse turn or round; rename/edit another encounter; reorder initiative; end combat | Targets clear only for relevant turn/round/end events when enabled |
| Bar Brawl and scene changes | If used, test its bar visibility rules on current-scene and off-scene combatants | No visibility bypass or missing-canvas errors |
| Multiple clients | Change HP and turns as GM while observing the player and detached tracker | Clients refresh correctly without stale fields or duplicate saves |

## Packaging

After the live-world checks, bump the release version in `yaml/module.yaml` and run the full validation commands. Build the release ZIP with `module.json` at its root together with `module/`, `lang/`, and `styles/dist/`. Keep development dependencies and tests out of the release archive.

The current manifest's download URL points to the literal release tag `latest` and asset name `combat-enhancements.zip`. Update the published manifest and its corresponding archive together. Finally, install through the manifest into a clean test world and repeat an HP edit and initiative move. A source merge alone does not update an existing release asset.
