// Win probability / accuracy helpers inspired by the publicly documented
// Lichess accuracy model. ChessLab does not reproduce any proprietary
// Chess.com implementation.
export function cpToWinProb(cp) {
  return 1 / (1 + Math.exp(-0.00368208 * cp));
}

export function toWhitePerspective(fen, result) {
  const sideToMove = fen.split(' ')[1];
  const rawCp = result.mate !== null && result.mate !== undefined
    ? (result.mate > 0 ? 1200 : -1200)
    : result.cp ?? 0;
  const cp = sideToMove === 'w' ? rawCp : -rawCp;
  const mate = result.mate !== null && result.mate !== undefined
    ? (sideToMove === 'w' ? result.mate : -result.mate)
    : null;
  return { cp, mate };
}

export function classifyMove({ cpLossForMover, isBestMove, san = '' }) {
  const forcing = /x|[+#]|=[QRBN]/.test(san);
  if (isBestMove && cpLossForMover <= 5 && forcing) return 'brilliant';
  if (isBestMove) return 'best';
  if (cpLossForMover < 10) return 'excellent';
  if (cpLossForMover < 30) return 'good';
  if (cpLossForMover < 90) return 'inaccuracy';
  if (cpLossForMover < 200) return 'mistake';
  return 'blunder';
}

export const TAG_LABEL = {
  brilliant: 'Brilliant',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

// Published Lichess-style move accuracy. Win% is expressed from 0..100.
export function moveAccuracy(winProbBefore, winProbAfter) {
  const before = Math.max(0, Math.min(1, winProbBefore));
  const after = Math.max(0, Math.min(1, winProbAfter));
  const beforePct = before * 100;
  const afterPct = after * 100;
  if (afterPct >= beforePct) return 100;
  const winDiff = beforePct - afterPct;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * winDiff) - 3.166924740191411 + 1;
  return Math.max(0, Math.min(100, raw));
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function harmonicMean(values) {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!valid.length) return 0;
  return valid.length / valid.reduce((sum, value) => sum + (1 / value), 0);
}

// Game-level accuracy follows the same published idea as Lichess: combine a
// volatility-weighted mean with a harmonic mean instead of simply averaging
// move scores. This prevents a handful of severe errors from being hidden by
// many easy moves, while also avoiding huge penalties for moves in already
// lost/won positions.
export function gameAccuracy(moves = [], color = null, startCp = 0) {
  const analyzed = moves.filter((m) => Number.isFinite(m?.cp) && Number.isFinite(m?.accuracy));
  if (!analyzed.length) return 0;

  const cps = [Number.isFinite(startCp) ? startCp : 0, ...analyzed.map((m) => m.cp)];
  const winPercents = cps.map((cp) => cpToWinProb(cp) * 100);
  const windowSize = Math.max(2, Math.min(8, Math.floor(analyzed.length / 10)));

  // Weight each move by local evaluation volatility.
  const windows = [];
  const firstWindow = winPercents.slice(0, windowSize);
  for (let i = 0; i < Math.max(0, windowSize - 2); i += 1) windows.push(firstWindow);
  for (let i = 0; i <= winPercents.length - windowSize; i += 1) {
    windows.push(winPercents.slice(i, i + windowSize));
  }
  while (windows.length < analyzed.length) windows.push(firstWindow);

  const scored = analyzed.map((move, index) => {
    const weight = Math.max(0.5, Math.min(12, standardDeviation(windows[index] || firstWindow)));
    return { move, weight };
  }).filter(({ move }) => color === null || move.color === color);

  if (!scored.length) return 0;
  const weightedSum = scored.reduce((sum, item) => sum + item.move.accuracy * item.weight, 0);
  const weightSum = scored.reduce((sum, item) => sum + item.weight, 0);
  const weightedMean = weightSum ? weightedSum / weightSum : 0;
  const harmonic = harmonicMean(scored.map((item) => item.move.accuracy));
  return Math.round(((weightedMean + harmonic) / 2) * 10) / 10;
}
