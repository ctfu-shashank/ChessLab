# Chess Analyzer

Free, unlimited chess game review in the browser — paste a PGN, get a move-by-move
Stockfish analysis, an accuracy score, and blunder/mistake tagging, without a backend
or a paid subscription.

## How it works

- `chess.js` parses the PGN and replays it move by move.
- Each resulting position is sent to **Stockfish**, running fully client-side as a
  WASM Web Worker (no server round-trip, no API cost, no rate limit).
- The engine's centipawn evaluation is converted to a win-probability curve, and the
  drop in win probability caused by each move is what drives the move tags
  (Best / Excellent / Good / Inaccuracy / Mistake / Blunder) and the accuracy score —
  this mirrors how chess.com/lichess actually compute theirs.

## Setup

```bash
npm install
```

The project pins `stockfish@18.0.8` as a dependency. After `npm install`, a small
postinstall script automatically copies the Stockfish 18 lite single-threaded worker
and WASM files into `public/stockfish/`, so no manual engine download is required.

Then:

```bash
npm run dev
```

Open the printed local URL, click **"Try sample game"** to sanity-check the engine
is wired up, then paste in your own PGN.

## Project structure

```
src/
  App.jsx                 - top-level state: loads PGN, drives analysis, renders layout
  hooks/useStockfish.js    - Web Worker wrapper around the Stockfish UCI protocol
  utils/analysis.js        - centipawn -> win% conversion, move tagging, accuracy math
  components/
    PgnInput.jsx            - PGN textarea + sample game loader
    EvalBar.jsx             - vertical evaluation bar next to the board
    EvalGraph.jsx           - eval-over-time chart (click to jump to a move)
    MoveList.jsx             - move list with quality-tag dots
```

## Changelog

**MultiPV support added.** Stockfish's `MultiPV` UCI option now requests its top
3 candidate lines per position, not just its single best move (see
`setoption name MultiPV value 3` in `useStockfish.js`). These surface in a new
"Top engine moves" panel for whichever position is on the board.

Wiring this up surfaced a real bug in the original move-tagging logic: it was
comparing each played move against the engine's best move for the position
*after* that move (i.e. what the opponent should do next), instead of the
position the move was actually chosen from. Fixed by reusing the previous
ply's already-computed candidates (`analyzed[i-1].candidates`, or
`startCandidates` for move 1) as the comparison baseline — see the comment
above the tagging loop in `App.jsx` for the full explanation. This is worth
mentioning in your report/viva as an example of a subtle off-by-one-position
bug in engine-based analysis tooling.

## Roadmap / good next additions for your resume writeup

- **Import from chess.com / lichess**: both expose public REST APIs for a user's
  games with no auth needed — turns this from "paste a PGN" into "type a username."
- **Opening detection**: match the game's first few moves against an ECO opening
  database (several small open JSON datasets exist) and show the opening name.
- **Mistake tracker**: persist tagged mistakes per user (needs a backend + DB) and
  surface recurring patterns ("you blunder pieces in the endgame 40% more than
  average") — this is the feature that most differentiates it from just re-building
  chess.com's analysis board.
- **Multi-PV analysis**: request Stockfish's top 2-3 candidate moves (`MultiPV`
  UCI option) instead of just the best one, to show "why" alternatives were worse.
- **Depth/quality toggle**: let users trade off analysis speed vs. depth, since
  full-game analysis at high depth can take a while on weaker devices.

## Notes on accuracy

The accuracy formula here is a reasonable approximation, not an exact reproduction
of chess.com's (their precise formula isn't public). It's good enough to be
directionally correct and to demo well; if you want to go deeper for your
final-year report, this is a good place to add your own weighting or compare
it against known games with published accuracy scores.
