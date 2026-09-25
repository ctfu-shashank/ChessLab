import { useState } from 'react';

function formatDate(timestamp) {
  if (!timestamp) return '';
  try { return new Date(timestamp).toLocaleDateString(); } catch { return ''; }
}

function chessComPlayer(game, color) {
  return game?.[color]?.username || game?.[color]?.uuid || color;
}

function normalizeLichessPgn(game) {
  if (game.pgn) return game.pgn;
  const white = game.players?.white?.user?.name || 'White';
  const black = game.players?.black?.user?.name || 'Black';
  const result = game.winner ? (game.winner === 'white' ? '1-0' : '0-1') : (game.status === 'draw' || game.status === 'stalemate' || game.status === 'aborted' ? '1/2-1/2' : '*');
  const date = game.createdAt ? new Date(game.createdAt).toISOString().slice(0, 10).replaceAll('-', '.') : '????.??.??';
  return `[Event "Lichess game"]\n[Site "https://lichess.org/${game.id}"]\n[Date "${date}"]\n[White "${white}"]\n[Black "${black}"]\n[Result "${result}"]\n\n${game.moves || ''} ${result}`.trim();
}

export default function ChessGameImport({ onImportGames, disabled }) {
  const [platform, setPlatform] = useState('chess.com');
  const [username, setUsername] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const importGames = async () => {
    const user = username.trim();
    if (!user) { setError('Enter a Chess.com or Lichess username.'); return; }
    setLoading(true);
    setError('');
    setStatus('Fetching games…');
    try {
      let games = [];
      if (platform === 'chess.com') {
        const profileResponse = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
        if (!profileResponse.ok) throw new Error('Chess.com player not found or the public game archive is unavailable.');
        const archives = await profileResponse.json();
        const urls = (archives.archives || []).slice(-3).reverse();
        for (const archiveUrl of urls) {
          const response = await fetch(archiveUrl);
          if (!response.ok) continue;
          const data = await response.json();
          games.push(...(data.games || []));
          if (games.length >= count) break;
        }
        games = games.slice(-count).reverse().map((game, index) => ({
          id: `chesscom-${game.url || index}`,
          title: `${chessComPlayer(game, 'white')} vs ${chessComPlayer(game, 'black')}`,
          opponent: `${chessComPlayer(game, 'white')} vs ${chessComPlayer(game, 'black')}`,
          pgn: game.pgn,
          source: 'Chess.com',
          url: game.url,
          playedAt: game.end_time ? game.end_time * 1000 : null,
        })).filter((game) => game.pgn);
      } else {
        const response = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=${count}&pgnInJson=true&clocks=false&evals=false&opening=false`, {
          headers: { Accept: 'application/x-ndjson' },
        });
        if (!response.ok) throw new Error('Lichess player not found or games could not be fetched.');
        const text = await response.text();
        games = text.split('\n').filter(Boolean).map((line, index) => {
          const game = JSON.parse(line);
          const white = game.players?.white?.user?.name || 'White';
          const black = game.players?.black?.user?.name || 'Black';
          return {
            id: `lichess-${game.id || index}`,
            title: `${white} vs ${black}`,
            opponent: `${white} vs ${black}`,
            pgn: normalizeLichessPgn(game),
            source: 'Lichess',
            url: game.id ? `https://lichess.org/${game.id}` : null,
            playedAt: game.createdAt || null,
          };
        });
      }

      if (!games.length) throw new Error('No public games were found for that username.');
      onImportGames(games);
      setStatus(`${games.length} game${games.length === 1 ? '' : 's'} imported into your ChessLab library.`);
    } catch (err) {
      setError(err.message || 'Could not import games.');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel chess-import-panel">
      <div className="import-heading">
        <div>
          <h2>Import from Chess.com / Lichess</h2>
          <div className="saved-games-subtitle">Bring public games directly into your ChessLab library — no PGN copy/paste.</div>
        </div>
        <span className="import-badge">API import</span>
      </div>

      <div className="import-platforms">
        <button className={platform === 'chess.com' ? 'active' : ''} onClick={() => setPlatform('chess.com')} disabled={loading || disabled}>Chess.com</button>
        <button className={platform === 'lichess' ? 'active' : ''} onClick={() => setPlatform('lichess')} disabled={loading || disabled}>Lichess</button>
      </div>

      <div className="import-form">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={`${platform === 'chess.com' ? 'Chess.com' : 'Lichess'} username`}
          onKeyDown={(e) => { if (e.key === 'Enter') importGames(); }}
          disabled={loading || disabled}
        />
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={loading || disabled}>
          <option value={5}>5 games</option>
          <option value={10}>10 games</option>
          <option value={20}>20 games</option>
          <option value={50}>50 games</option>
        </select>
        <button className="import-action" onClick={importGames} disabled={loading || disabled}>{loading ? 'Importing…' : 'Import games'}</button>
      </div>

      {status && <div className="import-status">✓ {status}</div>}
      {error && <div className="import-error">{error}</div>}
      <div className="import-note">Only publicly available games are fetched. ChessLab stores the imported PGNs locally in this browser.</div>
    </div>
  );
}
