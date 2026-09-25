import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useStockfish } from './hooks/useStockfish';
import { cpToWinProb, toWhitePerspective, classifyMove, moveAccuracy, gameAccuracy } from './utils/analysis';
import { candidatesToSan } from './utils/uci';
import PgnInput from './components/PgnInput';
import EvalBar from './components/EvalBar';
import MoveList from './components/MoveList';
import EvalGraph from './components/EvalGraph';
import CandidateMoves from './components/CandidateMoves';
import GameReview from './components/GameReview';
import ChessGameImport from './components/ChessGameImport';
import AuthLanding from './components/AuthLanding';
import OpeningAcademy from './components/OpeningAcademy';
import { detectOpeningFromPgn } from './utils/openingDetector';

export default function App() {
  const { ready, engineError, analyzeFen } = useStockfish();
  const [moves, setMoves] = useState([]); // each: { san, fen, index, cp, mate, bestMove, tag, accuracy }
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 = start position
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [startCandidates, setStartCandidates] = useState([]); // engine's top moves for the initial position
  const [paused, setPaused] = useState(false);
  const [savedGames, setSavedGames] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chesslab-saved-games') || '[]'); }
    catch { return []; }
  });
  const [activeGameId, setActiveGameId] = useState(null);
  const [showSavedGames, setShowSavedGames] = useState(true);
  const [opening, setOpening] = useState(null);
  const [view, setView] = useState('lab'); // 'lab' | 'academy'
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [authUser, setAuthUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chesslab-current-user') || 'null'); }
    catch { return null; }
  });
  const [authMode, setAuthMode] = useState(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const accountGamesKey = useCallback((email) => `chesslab-saved-games:${String(email || '').trim().toLowerCase()}`, []);

  const persistGames = useCallback((games) => {
    setSavedGames(games);
    try {
      const key = authUser?.email ? accountGamesKey(authUser.email) : 'chesslab-saved-games';
      localStorage.setItem(key, JSON.stringify(games));
    } catch { /* keep the in-memory copy if browser storage is unavailable */ }
  }, [authUser, accountGamesKey]);

  const hashPassword = useCallback(async (password) => {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }, []);

  const openAuth = useCallback((mode) => {
    setAuthMode(mode);
    setAuthError('');
    setAuthForm({ name: '', email: '', password: '' });
  }, []);

  const closeAuth = useCallback(() => {
    if (authBusy) return;
    setAuthMode(null);
    setAuthError('');
  }, [authBusy]);

  const handleAuthSubmit = useCallback(async (event) => {
    event.preventDefault();
    setAuthError('');
    const name = authForm.name.trim();
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    if (!email || !password || (authMode === 'signup' && !name)) {
      setAuthError(authMode === 'signup' ? 'Please enter your name, email and password.' : 'Please enter your email and password.');
      return;
    }
    if (password.length < 6) { setAuthError('Password must be at least 6 characters.'); return; }
    setAuthBusy(true);
    try {
      const accounts = JSON.parse(localStorage.getItem('chesslab-accounts') || '{}');
      const hash = await hashPassword(password);
      if (authMode === 'signup') {
        if (accounts[email]) { setAuthError('An account with this email already exists.'); return; }
        accounts[email] = { name, email, passwordHash: hash, createdAt: new Date().toISOString() };
        localStorage.setItem('chesslab-accounts', JSON.stringify(accounts));
        const user = { name, email };
        localStorage.setItem('chesslab-current-user', JSON.stringify(user));
        setAuthUser(user);
        const userGames = JSON.parse(localStorage.getItem(accountGamesKey(email)) || '[]');
        setSavedGames(userGames);
        setAuthMode(null);
        return;
      }
      const account = accounts[email];
      if (!account || account.passwordHash !== hash) { setAuthError('Incorrect email or password.'); return; }
      const user = { name: account.name, email: account.email };
      localStorage.setItem('chesslab-current-user', JSON.stringify(user));
      setAuthUser(user);
      const userGames = JSON.parse(localStorage.getItem(accountGamesKey(email)) || '[]');
      setSavedGames(userGames);
      setAuthMode(null);
    } catch {
      setAuthError('Authentication is unavailable in this browser.');
    } finally {
      setAuthBusy(false);
    }
  }, [authForm, authMode, hashPassword, accountGamesKey]);

  const handleLogout = useCallback(() => {
    try { localStorage.removeItem('chesslab-current-user'); } catch {}
    setAuthUser(null);
    setView('lab');
    try { setSavedGames(JSON.parse(localStorage.getItem('chesslab-saved-games') || '[]')); } catch { setSavedGames([]); }
    setActiveGameId(null);
  }, []);

  useEffect(() => {
    // Keep the library resilient even if another browser tab changes it.
    const onStorage = (event) => {
      if (event.key !== 'chesslab-saved-games') return;
      try { setSavedGames(JSON.parse(event.newValue || '[]')); } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!authUser?.email) return;
    try {
      const userGames = JSON.parse(localStorage.getItem(accountGamesKey(authUser.email)) || '[]');
      setSavedGames(userGames);
    } catch { setSavedGames([]); }
  }, [authUser, accountGamesKey]);

  // A ref mirrors `paused` state so the running analysis loop (a plain async
  // function, not a component re-render) always reads the latest value
  // instead of one captured when the loop started.
  const pausedRef = useRef(false);
  const resumeWaiterRef = useRef(null); // resolve() for whoever's waiting to be un-paused

  // Called between positions in the analysis loop. If paused, blocks until
  // togglePause() flips it back off and calls resolve().
  const waitIfPaused = useCallback(() => {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      resumeWaiterRef.current = resolve;
    });
  }, []);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (!next && resumeWaiterRef.current) {
      resumeWaiterRef.current();
      resumeWaiterRef.current = null;
    }
  }, []);

  const currentFen = useMemo(() => {
    if (currentIndex === -1) return new Chess().fen();
    return moves[currentIndex]?.fen ?? new Chess().fen();
  }, [currentIndex, moves]);

  const currentMove = currentIndex >= 0 ? moves[currentIndex] : null;

  // --- Explore mode: lets the user drag pieces to try out "what if" moves
  // from whatever position is on the board, without touching the actual
  // game record. explorePath is empty when not exploring; each entry is
  // one branch move made on top of the real game position.
  const [explorePath, setExplorePath] = useState([]); // [{ san, fen }, ...]
  const [exploreEval, setExploreEval] = useState(null); // { cp, mate } in White's perspective
  const [exploreCandidates, setExploreCandidates] = useState([]);
  const [exploreThinking, setExploreThinking] = useState(false);
  const exploreRequestId = useRef(0); // guards against a stale response overwriting a newer one

  const isExploring = explorePath.length > 0;
  const exploreFen = isExploring ? explorePath[explorePath.length - 1].fen : null;

  const analyzeExplorePosition = useCallback(
    async (fen) => {
      const requestId = ++exploreRequestId.current;
      setExploreThinking(true);
      // Depth 12 rather than 14: explore mode is about quick "what if"
      // feedback, not final game-review precision, and it may be sharing
      // the engine with a background full-game analysis via the queue.
      const result = await analyzeFen(fen, 12, 3);
      if (requestId !== exploreRequestId.current) return; // a newer move/undo superseded this
      setExploreEval(toWhitePerspective(fen, result));
      setExploreCandidates(candidatesToSan(fen, result.candidates || []));
      setExploreThinking(false);
    },
    [analyzeFen]
  );

  const exitExplore = useCallback(() => {
    exploreRequestId.current++; // invalidate any in-flight explore request
    setExplorePath([]);
    setExploreEval(null);
    setExploreCandidates([]);
    setExploreThinking(false);
  }, []);

  const handleBoardDrop = useCallback(
    (sourceSquare, targetSquare) => {
      const baseFen = isExploring ? explorePath[explorePath.length - 1].fen : currentFen;
      const sandbox = new Chess(baseFen);
      let moveObj;
      try {
        moveObj = sandbox.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      } catch {
        moveObj = null;
      }
      if (!moveObj) return false; // illegal move — board snaps the piece back

      const newFen = sandbox.fen();
      setExplorePath((prev) => [...prev, { san: moveObj.san, fen: newFen }]);
      analyzeExplorePosition(newFen);
      return true;
    },
    [isExploring, explorePath, currentFen, analyzeExplorePosition]
  );

  const undoExploreMove = useCallback(() => {
    setExplorePath((prev) => {
      const next = prev.slice(0, -1);
      if (next.length === 0) {
        exploreRequestId.current++;
        setExploreEval(null);
        setExploreCandidates([]);
        setExploreThinking(false);
      } else {
        analyzeExplorePosition(next[next.length - 1].fen);
      }
      return next;
    });
  }, [analyzeExplorePosition]);

  const entryTitle = (game) => {
    const h = game.header();
    return h.Event && h.Event !== '?' ? h.Event : `Game ${new Date().toLocaleDateString()}`;
  };

  const handleLoad = useCallback(
    async (pgnText, existingId = null) => {
      setError('');
      setProgress(0);
      const trimmedPgn = pgnText.trim();
      if (!trimmedPgn) { setError('Please paste a PGN first.'); return; }
      const gameId = existingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setActiveGameId(gameId);
      let entry;
      try {
        const parsed = new Chess();
        parsed.loadPgn(trimmedPgn);
        const headers = parsed.header();
        const detectedOpening = detectOpeningFromPgn(parsed);
        setOpening(detectedOpening);
        const title = headers.Event && headers.Event !== '?' ? headers.Event : `Game ${new Date().toLocaleDateString()}`;
        const opponent = [headers.White, headers.Black].filter(Boolean).join(' vs ');
        const existingSaved = savedGames.find((g) => g.id === gameId);
        entry = { id: gameId, title, opponent, source: existingSaved?.source || 'PGN', sourceUrl: existingSaved?.sourceUrl || '', opening: detectedOpening, pgn: trimmedPgn, savedAt: new Date().toISOString(), moves: [], progress: 0, complete: false };
        const withoutCurrent = savedGames.filter((g) => g.id !== gameId);
        persistGames([entry, ...withoutCurrent].slice(0, 50));
        try { localStorage.removeItem('chesslab-pgn-draft'); } catch {}
      } catch {
        setError('Could not parse that PGN. Double check the format and try again.');
        return;
      }
      const game = new Chess();
      try { game.loadPgn(trimmedPgn); } catch { return; }

      const history = game.history({ verbose: true });
      if (history.length === 0) {
        setError('No moves found in that PGN.');
        return;
      }

      setAnalyzing(true);
      setProgress(0);
      setStartCandidates([]);
      pausedRef.current = false;
      setPaused(false);
      exitExplore();

      // Replay the game immediately and put the complete game on the board.
      // The board/navigation must not wait for Stockfish to finish analysing
      // every position. This also means Start / Prev / Next / End remain
      // usable even while analysis is still running.
      const replay = new Chess();
      const rawMoves = history.map((h, index) => {
        replay.move(h.san);
        return { san: h.san, color: h.color, fen: replay.fen(), index, from: h.from, to: h.to };
      });
      setMoves(rawMoves.map((mv) => ({ ...mv })));
      setCurrentIndex(-1);

      // Evaluate the start position, then every position after each move.
      try {
      const startFen = new Chess().fen();
      await waitIfPaused();
      if (!ready) throw new Error(engineError || 'Stockfish is still starting. Please wait a moment and try again.');
      const startEval = await analyzeFen(startFen, 14, 3);
      const localStartCandidatesForLoop = candidatesToSan(startFen, startEval.candidates || []);
      setStartCandidates(candidatesToSan(startFen, startEval.candidates || []));
      let prevWinProb = cpToWinProb(startEval.mate ? (startEval.mate > 0 ? 1200 : -1200) : startEval.cp ?? 0);
      let prevCpWhitePerspective = startEval.mate ? (startEval.mate > 0 ? 1200 : -1200) : startEval.cp ?? 0;

      const analyzed = [];
      for (let i = 0; i < rawMoves.length; i++) {
        const mv = rawMoves[i];
        await waitIfPaused();
        const result = await analyzeFen(mv.fen, 14, 3);

        // Stockfish reports score from the perspective of the side to move
        // in that FEN. Normalize everything to White's perspective so the
        // eval bar/graph read naturally.
        const sideToMoveAfter = mv.color === 'w' ? 'b' : 'w';
        const rawCp = result.mate !== null ? (result.mate > 0 ? 1200 : -1200) : result.cp ?? 0;
        const cpWhitePerspective = sideToMoveAfter === 'w' ? rawCp : -rawCp;

        // Win probability, from the mover's own perspective, before and after
        // their move, to score how much of their winning chances the move cost.
        const winProbBefore = mv.color === 'w' ? prevWinProb : 1 - prevWinProb;
        const cpAfterForMover = mv.color === 'w' ? cpWhitePerspective : -cpWhitePerspective;
        const winProbAfter = cpToWinProb(cpAfterForMover);

        const cpLossForMover = Math.max(0, (prevCpWhitePerspective * (mv.color === 'w' ? 1 : -1)) - cpAfterForMover);
        const acc = moveAccuracy(winProbBefore, winProbAfter);

        const candidates = candidatesToSan(mv.fen, result.candidates || []);
        const priorCandidates = i === 0 ? localStartCandidatesForLoop : analyzed[i - 1]?.candidates;
        const bestSanForMove = priorCandidates?.[0]?.san ?? null;
        const moveTag = classifyMove({ cpLossForMover, isBestMove: bestSanForMove === mv.san, san: mv.san });
        analyzed.push({
          san: mv.san,
          color: mv.color,
          fen: mv.fen,
          index: i,
          from: mv.from,
          to: mv.to,
          cp: cpWhitePerspective,
          mate: result.mate !== null ? (sideToMoveAfter === 'w' ? result.mate : -result.mate) : null,
          bestMoveUci: result.bestMove,
          cpLossForMover,
          accuracy: acc,
          startCp: i === 0 ? prevCpWhitePerspective : undefined,
          bestMoveInstead: bestSanForMove,
          tag: moveTag,
          // Top 2-3 candidate moves for the position AFTER this move (i.e.
          // what the engine recommends next, from mv.fen).
          candidates,
        });

        // Keep the board data in sync while analysis progresses. The user can
        // navigate the already-loaded game at any time; later engine results
        // simply enrich the corresponding move.
        setMoves((current) => {
          const next = [...current];
          next[i] = { ...next[i], ...analyzed[i] };
          return next;
        });

        prevWinProb = mv.color === 'w' ? winProbAfter : 1 - winProbAfter;
        prevCpWhitePerspective = cpWhitePerspective;
        const pct = Math.round(((i + 1) / rawMoves.length) * 100);
        setProgress(pct);
        // Save after every analyzed move so a browser crash/system error does
        // not throw away the game that was already imported.
        const saved = { id: gameId, title: entryTitle(game), opponent: game.header().White && game.header().Black ? `${game.header().White} vs ${game.header().Black}` : '', source: entry.source, sourceUrl: entry.sourceUrl, opening: detectOpeningFromPgn(game), pgn: trimmedPgn, savedAt: new Date().toISOString(), moves: analyzed, progress: pct, complete: false };
        const current = savedGames.filter((g) => g.id !== gameId);
        persistGames([saved, ...current].slice(0, 50));
      }

      // Tag each move as best/excellent/.../blunder by comparing the SAN that
      // was actually played against the engine's top choice AT THE POSITION
      // IT WAS CHOSEN FROM. That's analyzed[i-1].candidates (or startCandidates
      // for the very first move) — NOT analyzed[i].candidates, which are the
      // engine's recommendations for the position that results *after* this
      // move, i.e. what the opponent should do next. Mixing those up would
      // compare this move against a suggestion for a different position.
      const localStartCandidates = candidatesToSan(startFen, startEval.candidates || []);
      for (let i = 0; i < analyzed.length; i++) {
        const m = analyzed[i];
        const priorCandidates = i === 0 ? localStartCandidates : analyzed[i - 1].candidates;
        const bestSan = priorCandidates?.[0]?.san ?? null;
        m.bestMoveInstead = bestSan;
        m.tag = classifyMove({ cpLossForMover: m.cpLossForMover, isBestMove: bestSan === m.san, san: m.san });
      }

      setMoves(analyzed);
      setAnalyzing(false);
      setCurrentIndex(-1);
      const completed = { id: gameId, title: entryTitle(game), opponent: game.header().White && game.header().Black ? `${game.header().White} vs ${game.header().Black}` : '', source: entry.source, sourceUrl: entry.sourceUrl, opening: detectOpeningFromPgn(game), pgn: trimmedPgn, savedAt: new Date().toISOString(), moves: analyzed, progress: 100, complete: true };
      persistGames([completed, ...savedGames.filter((g) => g.id !== gameId)].slice(0, 50));
      try { localStorage.removeItem('chesslab-pgn-draft'); } catch {}
      } catch (analysisError) {
        setAnalyzing(false);
        setError(analysisError?.message || 'Analysis stopped unexpectedly. The game is still loaded on the board.');
      }
    },
    [analyzeFen, waitIfPaused, exitExplore, savedGames, persistGames, ready, engineError]
  );

  const analyzedStartCp = Number.isFinite(moves[0]?.startCp) ? moves[0].startCp : 0;
  const whiteAcc = gameAccuracy(moves, 'w', analyzedStartCp);
  const blackAcc = gameAccuracy(moves, 'b', analyzedStartCp);
  const gameAcc = whiteAcc && blackAcc ? Math.round(((whiteAcc + blackAcc) / 2) * 10) / 10 : Math.max(whiteAcc, blackAcc);

  const boardHints = useMemo(() => {
    const styles = {};
    const arrows = [];
    if (currentMove?.from && currentMove?.to) {
      styles[currentMove.from] = { background: 'rgba(245, 190, 66, 0.38)' };
      styles[currentMove.to] = { background: 'rgba(245, 190, 66, 0.52)' };
    }
    const candidates = isExploring ? exploreCandidates : (currentIndex === -1 ? startCandidates : currentMove?.candidates);
    const bestSan = candidates?.[0]?.san;
    if (bestSan) {
      try {
        const probe = new Chess(currentFen);
        const best = probe.move(bestSan);
        if (best?.from && best?.to) arrows.push([best.from, best.to, '#38d39f']);
      } catch {}
    }
    return { styles, arrows };
  }, [currentMove, isExploring, exploreCandidates, currentIndex, startCandidates, currentFen]);

  const goTo = (i) => {
    exitExplore();
    setCurrentIndex(Math.max(-1, Math.min(moves.length - 1, i)));
  };

  const loadSavedGame = useCallback((saved) => {
    exitExplore();
    setCurrentIndex(-1);
    handleLoad(saved.pgn, saved.id);
  }, [handleLoad, exitExplore]);

  const deleteSavedGame = useCallback((id) => {
    persistGames(savedGames.filter((g) => g.id !== id));
    if (activeGameId === id) setActiveGameId(null);
  }, [savedGames, activeGameId, persistGames]);

  const handleImportedGames = useCallback((games) => {
    const imported = games.map((game, index) => ({
      id: `${game.id}-${Date.now()}-${index}`,
      title: game.title || 'Imported game',
      opponent: game.opponent || '',
      pgn: game.pgn,
      source: game.source || 'Imported',
      sourceUrl: game.url || '',
      savedAt: new Date().toISOString(),
      moves: [],
      progress: 0,
      complete: false,
      opening: null,
    }));
    const merged = [...imported, ...savedGames.filter((saved) => !imported.some((item) => item.pgn === saved.pgn))].slice(0, 50);
    persistGames(merged);
  }, [savedGames, persistGames]);


  if (!authUser) {
    return (
      <AuthLanding
        mode={authMode || 'login'}
        setMode={setAuthMode}
        form={authForm}
        setForm={setAuthForm}
        error={authError}
        busy={authBusy}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">♞</div>
          <div>
            <h1>ChessLab</h1>
            <div className="tagline">Analyze. Improve. Master your game.</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="account-btn ghost" onClick={() => setView((v) => (v === 'academy' ? 'lab' : 'academy'))}>
            {view === 'academy' ? '← Back to analysis' : '♞ Learn Openings'}
          </button>
          <div className="account-menu">
            <div className="avatar">{authUser.name?.charAt(0)?.toUpperCase() || 'U'}</div>
            <div className="account-copy"><strong>{authUser.name}</strong><span>{authUser.email}</span></div>
            <button className="account-btn ghost" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </header>

      {view === 'academy' ? (
        <OpeningAcademy onBack={() => setView('lab')} />
      ) : (
      <>

      {engineError && (
        <div className="engine-status error">
          <strong>Analysis engine unavailable.</strong> {engineError}
        </div>
      )}
      {!engineError && !ready && (
        <div className="engine-status">Stockfish is starting… Analysis will be available in a moment.</div>
      )}

      {opening && (
        <div className="opening-detection">
          <div className="opening-detection-icon">♟</div>
          <div className="opening-detection-copy">
            <span className="opening-detection-label">Opening detected</span>
            <strong>{opening.name}</strong>
            <span>{opening.variation} · ECO {opening.eco}</span>
          </div>
          <div className="opening-detection-line">
            {opening.moves.slice(0, Math.min(opening.moves.length, 10)).map((m, i) => (
              <span key={`${m}-${i}`}>{m}</span>
            ))}
          </div>
          <span className="opening-detection-match">{opening.movesMatched} moves matched</span>
        </div>
      )}

      <div className="layout">
        <div className="board-column">
          <div className="board-frame">
            <EvalBar cp={isExploring ? exploreEval?.cp : currentMove?.cp} mate={isExploring ? exploreEval?.mate : currentMove?.mate} />
            <div style={{ flex: 1 }}>
              <div className="board-wrap">
                {analyzing && <div className="board-thinking"><span className="thinking-dot" /> Engine reviewing {progress}%</div>}
                {!isExploring && (currentMove?.tag || boardHints.arrows.length > 0) && (
                  <div className={`board-review-badge ${currentMove?.tag ? `board-review-${currentMove.tag}` : 'board-review-best'}`}>
                    <span>{currentMove?.tag === 'brilliant' ? '✨' : currentMove?.tag === 'blunder' ? '??' : currentMove?.tag === 'mistake' ? '?' : currentMove?.tag === 'inaccuracy' ? '?!' : '✓'}</span>
                    <strong>{currentMove?.tag ? currentMove.tag.charAt(0).toUpperCase() + currentMove.tag.slice(1) : 'Best move'}</strong>
                    {currentMove?.bestMoveInstead && currentMove.tag !== 'best' && <em>Engine: {currentMove.bestMoveInstead}</em>}
                  </div>
                )}
                <Chessboard
                  position={exploreFen ?? currentFen}
                  boardOrientation={boardOrientation}
                  arePiecesDraggable={ready}
                  onPieceDrop={handleBoardDrop}
                  customSquareStyles={boardHints.styles}
                  customArrows={boardHints.arrows}
                  customBoardStyle={{ borderRadius: '14px', boxShadow: '0 22px 55px rgba(0,0,0,0.28)' }}
                  boardWidth={420}
                />
              </div>
            </div>
          </div>

          {isExploring && (
            <div className="explore-banner">
              <span>🔍 Exploring — this line isn't part of the actual game.</span>
              <span className="explore-line">{explorePath.map((m) => m.san).join(' ')}</span>
              {exploreThinking && <span style={{ color: 'var(--ivory-dim)' }}>thinking…</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="explore-mini-btn" onClick={undoExploreMove}>Undo move</button>
                <button className="explore-mini-btn" onClick={exitExplore}>Reset to game</button>
              </div>
            </div>
          )}

          <div className="controls-row">
            <button onClick={() => goTo(-1)}>⏮ Start</button>
            <button onClick={() => goTo(currentIndex - 1)}>◀ Prev</button>
            <button onClick={() => goTo(currentIndex + 1)}>Next ▶</button>
            <button onClick={() => goTo(moves.length - 1)}>End ⏭</button>
            <button className="flip-btn" onClick={() => setBoardOrientation((o) => o === 'white' ? 'black' : 'white')}>↻ Flip board</button>
            {analyzing && (
              <button
                onClick={togglePause}
                style={{
                  background: paused ? 'var(--gold)' : 'var(--board-panel)',
                  color: paused ? '#1b2a22' : 'var(--ivory)',
                  fontWeight: paused ? 600 : 400,
                }}
              >
                {paused ? '▶ Resume engine' : '⏸ Pause engine'}
              </button>
            )}
          </div>

          {!isExploring && currentMove?.bestMoveInstead && currentMove.tag !== 'best' && (
            <div className="best-move-callout">
              Engine preferred <strong>{currentMove.bestMoveInstead}</strong> here instead of {currentMove.san}.
            </div>
          )}

          {!ready && !engineError && <div className="status-line">Loading Stockfish engine…</div>}
          {ready && !analyzing && !engineError && <div className="status-line" style={{ color: 'var(--best)' }}>● Stockfish ready · select a move to inspect engine recommendations.</div>}
          {analyzing && (
            <div className="status-line">
              {paused ? `Paused at ${progress}% — click "Resume engine" to continue.` : `Analyzing… ${progress}%`}
            </div>
          )}
          {error && <div className="status-line" style={{ color: 'var(--blunder)' }}>{error}</div>}

          <CandidateMoves
            candidates={isExploring ? exploreCandidates : currentIndex === -1 ? startCandidates : currentMove?.candidates}
            sideToMove={(exploreFen ?? currentFen).split(' ')[1] === 'w' ? 'White' : 'Black'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <PgnInput onLoad={handleLoad} disabled={!ready || analyzing} />

          <ChessGameImport onImportGames={handleImportedGames} disabled={!ready || analyzing} />

              <div className="panel accuracy-panel">
                <div className="accuracy-heading">
                  <h2>Game Accuracy</h2>
                  <span className="accuracy-badge">Overall</span>
                </div>
                <div className="game-accuracy-main">
                  <div className="game-accuracy-value">{gameAcc}%</div>
                  <div className="game-accuracy-caption">{analyzing ? `Accuracy so far · ${moves.filter((m) => typeof m.accuracy === 'number').length}/${moves.length} moves analysed` : 'Overall accuracy of the played game'}</div>
                </div>
                <div className="accuracy-row">
                  <div className="accuracy-stat">
                    <div className="value">{whiteAcc}%</div>
                    <div className="label">White</div>
                  </div>
                  <div className="accuracy-stat">
                    <div className="value">{blackAcc}%</div>
                    <div className="label">Black</div>
                  </div>
                </div>
              </div>

          <div className="panel saved-games-panel">
            <div className="saved-games-heading">
              <div>
                <h2>Saved games</h2>
                <div className="saved-games-subtitle">Your imported PGNs are saved automatically in this browser.</div>
              </div>
              <button className="library-toggle" onClick={() => setShowSavedGames((v) => !v)}>{showSavedGames ? 'Hide' : 'Show'}</button>
            </div>
            {showSavedGames && (savedGames.length === 0 ? (
              <div className="empty-library">No saved games yet. Analyze a PGN and it will appear here.</div>
            ) : (
              <div className="saved-games-list">
                {savedGames.map((saved) => (
                  <div className={`saved-game-row ${activeGameId === saved.id ? 'active' : ''}`} key={saved.id}>
                    <button className="saved-game-main" onClick={() => loadSavedGame(saved)} disabled={analyzing}>
                      <strong>{saved.title}</strong>
                      <span>{saved.opponent || 'Imported PGN'} · {saved.source ? `${saved.source} · ` : ''}{saved.opening ? `${saved.opening.name} — ${saved.opening.variation}` : 'Opening not detected'} · {saved.complete ? 'Analysis saved' : `Saved at ${saved.progress || 0}%`}</span>
                    </button>
                    <button className="delete-game" onClick={() => deleteSavedGame(saved.id)} aria-label={`Delete ${saved.title}`}>×</button>
                  </div>
                ))}
              </div>
            ))}
          </div>

              <GameReview
                moves={moves}
                accuracy={gameAcc}
                whiteAccuracy={whiteAcc}
                blackAccuracy={blackAcc}
                onSelect={goTo}
                analyzing={analyzing}
              />

              <EvalGraph moves={moves} currentIndex={currentIndex} onSelect={goTo} />

              <div className="panel">
                <h2>Moves</h2>
                <MoveList moves={moves} currentIndex={currentIndex} onSelect={goTo} />
              </div>
        </div>
      </div>
      </>
      )}

      {authMode && (
        <div className="auth-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeAuth(); }}>
          <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="auth-close" onClick={closeAuth} aria-label="Close">×</button>
            <div className="auth-logo">♞</div>
            <span className="auth-eyebrow">WELCOME TO CHESSLAB</span>
            <h2 id="auth-title">{authMode === 'login' ? 'Welcome back.' : 'Create your ChessLab account.'}</h2>
            <p className="auth-subtitle">{authMode === 'login' ? 'Pick up where your analysis left off.' : 'Save your games and build your personal chess profile.'}</p>
            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authMode === 'signup' && <input autoFocus value={authForm.name} onChange={(e) => setAuthForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" autoComplete="name" />}
              <input autoFocus={authMode === 'login'} type="email" value={authForm.email} onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email address" autoComplete="email" />
              <input type="password" value={authForm.password} onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))} placeholder="Password (6+ characters)" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
              {authError && <div className="auth-error">{authError}</div>}
              <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'login' ? 'Log in to ChessLab' : 'Create account'}</button>
            </form>
            <button className="auth-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}>
              {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </button>
            <div className="auth-note">Your demo account is stored locally in this browser. A production deployment should connect this UI to a secure authentication backend.</div>
          </div>
        </div>
      )}
    </div>
  );
}
