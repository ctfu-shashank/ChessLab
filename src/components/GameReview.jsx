import { TAG_LABEL } from '../utils/analysis';

const TAG_ORDER = ['brilliant', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];

export default function GameReview({ moves, accuracy, whiteAccuracy, blackAccuracy, onSelect, analyzing }) {
  const analyzedMoves = moves.filter((move) => move && typeof move.accuracy === 'number');
  const counts = TAG_ORDER.reduce((acc, tag) => {
    acc[tag] = moves.filter((move) => move?.tag === tag).length;
    return acc;
  }, {});
  const critical = moves.filter((move) => ['brilliant', 'inaccuracy', 'mistake', 'blunder'].includes(move?.tag));

  return (
    <div className="panel game-review-panel">
      <div className="review-heading">
        <div>
          <span className="review-eyebrow">GAME REVIEW</span>
          <h2>How did you play?</h2>
        </div>
        <div className="review-accuracy">
          <strong>{accuracy}%</strong>
          <span>{analyzing ? `${analyzedMoves.length}/${moves.length} moves reviewed` : 'game accuracy'}</span>
        </div>
      </div>

      <div className="review-sides">
        <div><span>White</span><strong>{whiteAccuracy}%</strong></div>
        <div><span>Black</span><strong>{blackAccuracy}%</strong></div>
      </div>

      <div className="review-grid">
        {TAG_ORDER.map((tag) => (
          <div className={`review-stat review-${tag}`} key={tag}>
            <span className="review-stat-dot" />
            <div>
              <strong>{counts[tag]}</strong>
              <span>{TAG_LABEL[tag]}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="review-divider" />
      <div className="review-section-title">Key moments</div>
      {critical.length === 0 ? (
        <div className="review-empty">
          {analyzing ? 'Critical moments will appear as Stockfish reviews the game.' : 'No inaccuracies, mistakes, blunders, or brilliant moves were detected.'}
        </div>
      ) : (
        <div className="review-moments">
          {critical.slice(0, 8).map((move) => (
            <button className="review-moment" key={move.index} onClick={() => onSelect(move.index)}>
              <span className={`review-moment-dot review-dot-${move.tag}`} />
              <span className="review-move-number">{Math.floor(move.index / 2) + 1}{move.color === 'b' ? '...' : '.'}</span>
              <span className="review-move-san">{move.san}</span>
              <span className="review-move-tag">{TAG_LABEL[move.tag]}</span>
              {move.bestMoveInstead && move.tag !== 'brilliant' && <span className="review-best">Best: {move.bestMoveInstead}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="review-footer">Move labels are generated from Stockfish evaluation, move quality, and tactical/forcing-move heuristics.</div>
    </div>
  );
}
