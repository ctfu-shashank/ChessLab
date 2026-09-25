import { useEffect, useState } from 'react';

const SAMPLE_PGN = `[Event "Casual Game"]
[White "Player"]
[Black "Opponent"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5
7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 *`;

export default function PgnInput({ onLoad, disabled, initialValue = '', draftKey = 'chesslab-pgn-draft' }) {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(draftKey) || initialValue; } catch { return initialValue; }
  });

  useEffect(() => {
    try {
      if (value.trim()) localStorage.setItem(draftKey, value);
      else localStorage.removeItem(draftKey);
    } catch { /* storage can be unavailable in private/restricted browsers */ }
  }, [value, draftKey]);

  return (
    <div className="panel">
      <h2>Load a game</h2>
      <textarea
        className="pgn-input"
        placeholder="Paste your PGN here..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="load-btn" disabled={disabled} onClick={() => onLoad(value)}>
          Analyze game
        </button>
        <button
          className="load-btn"
          style={{ background: 'transparent', color: 'var(--ivory-dim)', border: '1px solid rgba(241,234,217,0.15)' }}
          onClick={() => {
            setValue(SAMPLE_PGN);
            onLoad(SAMPLE_PGN);
          }}
        >
          Try sample game
        </button>
      </div>
    </div>
  );
}
