# Pokémon Emerald Quest — Legend of the Sky Serpent

A complete, playable Pokémon Emerald-style RPG in **one self-contained HTML file**.
No external assets, no dependencies — every tile, sprite, menu and sound effect is
generated programmatically (Canvas pixel art + WebAudio chiptune SFX).

**Play it:** open [`pokemon-emerald.html`](pokemon-emerald.html) in any modern browser.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / WASD | D-pad |
| A (confirm / interact) | Z or Space | A |
| B (cancel / run) | X or Esc | B |
| Menu | Enter | START |
| Run (hold) | Shift or B | hold B |
| Battle fast-forward ×2 | F | — (toggle in Options) |

On-screen D-pad and A/B buttons appear automatically on touch devices.

## The game

- **Hoenn-style region**: 4 towns (Verdant, Slatecliff, Summit, Marinport), grass
  routes, a rainy surfing route across the bay, and the Granite Tunnel cave —
  each town with its own Poké Mart and Pokémon Center.
- **36 original creatures** (Gen 3 vibes) with full stats, 2-stage evolutions and
  level-up movesets — plus **Rayquaza** waiting at the Sky Altar.
- **Faithful battle engine**: Gen 3 type chart, physical/special split, STAB,
  crits, accuracy/evasion stages, PSN/BRN/PAR/SLP/FRZ, real Gen 3 catch-rate
  formula, and weather (rain/sun/sandstorm) that genuinely matters.
- **Story**: pick a starter (your rival picks the counter), earn 2 gym badges,
  and rout Team Ember before their Admin angers the Sky Serpent into ending
  rain forever.

## Modern tweaks

- HGSS-style **following partner** behind you
- **No HMs** — Surf/Cut come as key items (Tide Amulet, Power Gauntlet)
- **Set-style battles** with a ×2 fast-forward toggle
- IVs/EVs simplified into a clean **Potential** screen (S/A/B/C/D grades)
- **Autosave + 3 manual save slots** (localStorage)
- Toggleable whole-party **Exp Share**
- **Type-effectiveness hints** on move buttons once you've fought that species
- Mobile touch controls, optional **CRT filter**, chiptune SFX via WebAudio

## Development

```
node tests/smoke.test.js
```

Runs 880+ checks against the game's logic: boot, map connectivity (BFS proves
both gym leaders, the Admin and Rayquaza are reachable), damage math (a
super-effective STAB move ≈ 3× a neutral non-STAB move), catch/exp/save
round-trips, and a scripted playthrough of starter selection, a wild battle,
a full gym battle and a capture.

*A non-commercial fan tribute. Pokémon is © Nintendo / Creatures / GAME FREAK.*
