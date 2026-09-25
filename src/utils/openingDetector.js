import openings from '../data/openings.json';

const normalizeSan = (san) => san
  .replace(/[!?+#]+/g, '')
  .replace(/0-0-0/g, 'O-O-O')
  .replace(/0-0/g, 'O-O')
  .trim();

export function detectOpeningFromPgn(game) {
  if (!game) return null;
  const history = game.history();
  return detectOpening(history);
}

export function detectOpening(history = []) {
  const moves = history.map(normalizeSan);
  if (!moves.length) return null;

  let best = null;
  for (const opening of openings) {
    const line = opening.moves.map(normalizeSan);
    if (line.length > moves.length) continue;
    const matches = line.every((move, i) => move === moves[i]);
    if (!matches) continue;
    if (!best || line.length > best.movesMatched) {
      best = { ...opening, movesMatched: line.length };
    }
  }

  return best;
}
