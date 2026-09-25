function formatEval(c) {
  if (c.mate !== null && c.mate !== undefined) return `M${Math.abs(c.mate)}`;
  return ((c.cp ?? 0) / 100).toFixed(2);
}

export default function CandidateMoves({ candidates, sideToMove }) {
  if (!candidates || candidates.length === 0) {
    return (
      <div className="panel">
        <h2>Top engine moves</h2>
        <div className="status-line" style={{ marginTop: 0 }}>No candidates for this position.</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Top engine moves {sideToMove && <span style={{ color: 'var(--ivory-dim)', fontWeight: 400 }}>({sideToMove} to move)</span>}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {candidates.slice(0, 3).map((c, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 6,
              background: i === 0 ? 'rgba(79, 143, 140, 0.15)' : 'rgba(241,234,217,0.05)',
              border: i === 0 ? '1px solid rgba(79, 143, 140, 0.3)' : '1px solid transparent',
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: i === 0 ? 'var(--best)' : 'rgba(241,234,217,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15 }}>{c.san}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'SF Mono, Consolas, monospace', fontSize: 13, color: 'var(--ivory-dim)' }}>
              {formatEval(c)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
