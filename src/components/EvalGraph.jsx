import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

export default function EvalGraph({ moves, currentIndex, onSelect }) {
  const data = moves.map((m) => ({
    index: m.index,
    cp: m.mate !== null ? (m.mate > 0 ? 1200 : -1200) : Math.max(-800, Math.min(800, m.cp ?? 0)),
  }));

  return (
    <div className="panel">
      <h2>Evaluation over the game</h2>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} onClick={(e) => e?.activePayload && onSelect(e.activePayload[0].payload.index)}>
          <defs>
            <linearGradient id="evalFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f1ead9" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#f1ead9" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <XAxis dataKey="index" hide />
          <YAxis domain={[-800, 800]} hide />
          <ReferenceLine y={0} stroke="rgba(241,234,217,0.3)" />
          {currentIndex !== null && <ReferenceLine x={currentIndex} stroke="var(--gold)" />}
          <Tooltip
            contentStyle={{ background: '#17201a', border: '1px solid rgba(241,234,217,0.15)', fontSize: 12 }}
            labelFormatter={(i) => `Move ${i + 1}`}
            formatter={(v) => [(v / 100).toFixed(2), 'Eval']}
          />
          <Area type="monotone" dataKey="cp" stroke="#f1ead9" fill="url(#evalFill)" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
