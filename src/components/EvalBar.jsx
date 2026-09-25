import { cpToWinProb } from '../utils/analysis';

export default function EvalBar({ cp, mate }) {
  let whitePct;
  let label;

  if (mate !== null && mate !== undefined) {
    whitePct = mate > 0 ? 100 : 0;
    label = `M${Math.abs(mate)}`;
  } else {
    const wp = cpToWinProb(cp ?? 0);
    whitePct = Math.round(wp * 100);
    label = ((cp ?? 0) / 100).toFixed(1);
  }

  return (
    <div>
      <div className="eval-bar-track" style={{ height: 420 }}>
        <div className="eval-bar-fill" style={{ height: `${100 - whitePct}%` }} />
      </div>
      <div className="eval-label">{label}</div>
    </div>
  );
}
