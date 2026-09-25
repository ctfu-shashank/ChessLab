import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import openings from '../data/openingAcademy.json';

// Pre-computes the FEN after each half-move so stepping through an opening
// line doesn't need to re-run chess.js on every click.
function buildLine(moves) {
  const game = new Chess();
  const positions = [{ san: null, fen: game.fen() }];
  for (const move of moves) {
    game.move(move);
    positions.push({ san: move, fen: game.fen() });
  }
  return positions;
}

export default function OpeningAcademy({ onBack }) {
  const [selectedId, setSelectedId] = useState(openings[0]?.id ?? null);
  const [ply, setPly] = useState(openings[0]?.moves.length ?? 0);

  const selected = useMemo(
    () => openings.find((o) => o.id === selectedId) ?? openings[0],
    [selectedId]
  );

  const line = useMemo(() => (selected ? buildLine(selected.moves) : []), [selected]);
  const currentFen = line[ply]?.fen ?? line[line.length - 1]?.fen;

  const selectOpening = (opening) => {
    setSelectedId(opening.id);
    setPly(opening.moves.length); // jump straight to the final position of the line
  };

  if (!selected) return null;

  return (
    <div className="academy-shell">
      <div className="academy-intro">
        <button className="academy-back" onClick={onBack}>← Back to analysis</button>
        <span className="auth-kicker"><span /> OPENING ACADEMY</span>
        <h2>Learn {openings.length} popular openings</h2>
        <p>Pick an opening, step through the main line move by move, and read the ideas and plans behind it.</p>
      </div>

      <div className="academy-layout">
        <div className="academy-list">
          {openings.map((opening) => (
            <button
              key={opening.id}
              className={`academy-list-item ${opening.id === selected.id ? 'active' : ''}`}
              onClick={() => selectOpening(opening)}
            >
              <span className="academy-list-eco">{opening.eco}</span>
              <span className="academy-list-copy">
                <strong>{opening.name}</strong>
                <span>{opening.variation}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="academy-detail">
          <div className="academy-board-wrap">
            <Chessboard
              position={currentFen}
              arePiecesDraggable={false}
              boardWidth={360}
              customBoardStyle={{ borderRadius: '14px', boxShadow: '0 22px 55px rgba(0,0,0,0.28)' }}
            />
            <div className="academy-board-controls">
              <button onClick={() => setPly(0)} disabled={ply === 0}>⏮ Start</button>
              <button onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0}>◀ Prev</button>
              <button onClick={() => setPly((p) => Math.min(line.length - 1, p + 1))} disabled={ply >= line.length - 1}>Next ▶</button>
              <button onClick={() => setPly(line.length - 1)} disabled={ply >= line.length - 1}>End ⏭</button>
            </div>
            <div className="academy-move-line">
              {selected.moves.map((san, i) => (
                <span
                  key={`${san}-${i}`}
                  className={i + 1 === ply ? 'active' : ''}
                  onClick={() => setPly(i + 1)}
                >
                  {i % 2 === 0 ? `${i / 2 + 1}.` : ''}{san}
                </span>
              ))}
            </div>
          </div>

          <div className="academy-copy">
            <span className="academy-detail-eco">ECO {selected.eco}</span>
            <h3>{selected.name}</h3>
            <span className="academy-detail-variation">{selected.variation}</span>
            <p className="academy-idea">{selected.idea}</p>
            <strong className="academy-plans-title">Typical plans</strong>
            <ul className="academy-plans">
              {selected.plans.map((plan) => (
                <li key={plan}>{plan}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
