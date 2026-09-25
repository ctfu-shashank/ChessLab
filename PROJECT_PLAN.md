# Chess Analyzer — Final Year Project Plan

## Problem statement

Free chess platforms limit in-depth post-game analysis behind a paywall (e.g.
chess.com's full game review is a premium feature). This project builds a free,
unlimited alternative: a web app where a player pastes or imports a game and gets
a full engine-backed review — evaluation graph, move-quality tags, best-move
suggestions, and an accuracy score.

## Why this is a good final-year project

- Touches a real, complete stack: frontend state management, a WASM engine running
  in a Web Worker, data visualization, and (in phase 2) a backend + database.
- Has a genuine, demoable "wow" moment — pasting in a real game and watching it get
  analyzed live is intuitive to any evaluator, chess player or not.
- Scopes cleanly: MVP is fully achievable solo in a few weeks, with clear, resume-
  worthy stretch goals if you have more time.

## Architecture

```
┌─────────────────────────────┐
│         Browser              │
│  ┌────────────┐  ┌─────────┐ │
│  │   React UI  │◄─┤chess.js │ │   PGN parsing, move validation,
│  │ (board,     │  └─────────┘ │   FEN generation
│  │  eval graph,│               │
│  │  move list) │  ┌─────────┐ │
│  │             │◄─┤Stockfish│ │   Runs as a Web Worker (WASM),
│  └─────────────┘  │ (WASM)  │ │   fully client-side, no backend
│                    └─────────┘ │   needed for analysis itself
└──────────────┬────────────────┘
               │ (phase 2 only)
       ┌───────▼────────┐
       │ Node/Express API │   Auth, saved games, mistake history
       └───────┬────────┘
               │
         ┌─────▼─────┐
         │  MongoDB   │
         └───────────┘
```

**Why run Stockfish client-side instead of on a server?** It's the difference
between "free" and "I need to pay for compute every time someone analyzes a game."
Running the engine in-browser via WebAssembly means the whole MVP can be hosted as
a static site for $0.

## Milestones

| Phase | Deliverable | Est. time |
|---|---|---|
| 1 | PGN upload + board rendering + move navigation (no engine yet) | 1 week |
| 2 | Wire up Stockfish, get single-position evaluation working | 1 week |
| 3 | Full-game analysis loop, eval graph, move tagging, accuracy score | 1-2 weeks |
| 4 | Polish UI, best-move arrows, error handling, deploy | 1 week |
| 5 (stretch) | chess.com/lichess import via public API | 3-5 days |
| 6 (stretch) | Backend + auth + saved game history | 2-3 weeks |
| 7 (stretch) | Personal mistake pattern tracker | 1-2 weeks |

The MVP (phases 1-4) is what's scaffolded in this repo already — see `README.md`
for setup.

## Resume bullet point (once built)

> Built a full-stack chess analysis platform using React and a client-side
> WebAssembly build of Stockfish, enabling free, unlimited engine-backed game
> review (move classification, accuracy scoring, evaluation graphing) with zero
> backend compute cost.

Adjust once you've actually built it — evaluators like specific, truthful details
(e.g. "processed N positions per game at depth 14 in an average of X seconds")
more than generic phrasing.

## Report-writing tip

For your final-year report/viva, be ready to explain, in your own words:
- Why centipawn loss is converted to a win-probability curve instead of scored
  directly (raw centipawns are not linear in "how bad" a mistake is — losing 50cp
  in an already-winning position matters far less than losing 50cp in an even one).
- Why the engine runs in a Web Worker rather than the main thread (keeps the UI
  responsive during analysis instead of freezing the tab).
- The trade-off in your chosen search depth (higher = more accurate, slower).
