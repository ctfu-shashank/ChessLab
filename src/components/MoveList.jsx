import { TAG_LABEL } from '../utils/analysis';

export default function MoveList({ moves, currentIndex, onSelect }) {
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push([moves[i], moves[i + 1]]);
  }

  return (
    <div className="move-list">
      {rows.map(([whiteMove, blackMove], rowIdx) => (
        <div key={rowIdx} style={{ display: 'contents' }}>
          <div className="move-num">{rowIdx + 1}.</div>
          <MoveCell move={whiteMove} active={whiteMove?.index === currentIndex} onSelect={onSelect} />
          <MoveCell move={blackMove} active={blackMove?.index === currentIndex} onSelect={onSelect} />
        </div>
      ))}
    </div>
  );
}

function MoveCell({ move, active, onSelect }) {
  if (!move) return <div />;
  return (
    <div
      className={`move-cell ${active ? 'active' : ''}`}
      onClick={() => onSelect(move.index)}
      title={move.tag ? TAG_LABEL[move.tag] : undefined}
    >
      {move.tag && <span className={`tag-dot tag-${move.tag}`} />}
      {move.san}
    </div>
  );
}
