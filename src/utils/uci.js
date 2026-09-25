import { Chess } from 'chess.js';

// Converts a UCI candidate list (from Stockfish, e.g. [{ move: 'e2e4', cp: 32 }])
// into SAN so it can be shown next to the board / move list.
export function candidatesToSan(fen, candidates) {
  return candidates
    .map((c) => {
      if (!c.move) return null;
      const checker = new Chess(fen);
      try {
        const moveObj = checker.move({
          from: c.move.slice(0, 2),
          to: c.move.slice(2, 4),
          promotion: c.move.length > 4 ? c.move[4] : undefined,
        });
        if (!moveObj) return null;
        return { san: moveObj.san, cp: c.cp, mate: c.mate };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
