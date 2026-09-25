import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Browser Stockfish wrapper.
 * Keeps a small FIFO queue so full-game analysis and position analysis do not
 * send overlapping UCI searches to the same worker.
 */
export function useStockfish() {
  const workerRef = useRef(null);
  const readyRef = useRef(false);
  const errorRef = useRef('');
  const pendingRef = useRef(null);
  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [engineError, setEngineError] = useState('');

  const failAll = useCallback((message) => {
    errorRef.current = message;
    readyRef.current = false;
    setReady(false);
    setEngineError(message);

    if (pendingRef.current) {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error(message));
    }

    const queued = queueRef.current.splice(0);
    queued.forEach((job) => job.reject(new Error(message)));
    processingRef.current = false;
  }, []);

  const runNextJob = useCallback(() => {
    const worker = workerRef.current;
    if (!readyRef.current || processingRef.current || !worker || queueRef.current.length === 0) return;

    const job = queueRef.current.shift();
    processingRef.current = true;
    const lines = new Map();

    const finish = (result, error = null) => {
      if (!processingRef.current) return;
      processingRef.current = false;
      pendingRef.current = null;
      if (job.timer) clearTimeout(job.timer);
      if (error) job.reject(error);
      else job.resolve(result);
      // Give React/browser one turn before starting the next search.
      setTimeout(runNextJob, 0);
    };

    const pending = {
      timer: setTimeout(() => {
        try { worker.postMessage('stop'); } catch {}
        finish(null, new Error('Stockfish took too long to analyse this position.'));
      }, 30000),
      reject: job.reject,
      resolve: job.resolve,
      lines,
      finish,
    };
    pendingRef.current = pending;

    try {
      worker.postMessage('ucinewgame');
      worker.postMessage(`setoption name MultiPV value ${job.multiPv}`);
      worker.postMessage(`position fen ${job.fen}`);
      worker.postMessage(`go depth ${job.depth}`);
    } catch (err) {
      finish(null, err instanceof Error ? err : new Error('Could not start Stockfish analysis.'));
    }
  }, []);

  useEffect(() => {
    let worker;
    try {
      worker = new Worker('/stockfish/stockfish-18-lite-single.js');
      workerRef.current = worker;
    } catch {
      failAll('Stockfish could not be loaded. Run npm install and restart the dev server.');
      return undefined;
    }

    worker.onerror = () => {
      failAll('Stockfish failed to load. Run npm install again and restart the dev server.');
    };

    worker.onmessage = (event) => {
      const line = typeof event.data === 'string' ? event.data : event.data?.data;
      if (!line) return;

      if (line === 'uciok') {
        worker.postMessage('isready');
        return;
      }

      if (line === 'readyok') {
        readyRef.current = true;
        errorRef.current = '';
        setEngineError('');
        setReady(true);
        runNextJob();
        return;
      }

      const pending = pendingRef.current;
      if (!pending) return;

      if (line.startsWith('info') && line.includes('score') && line.includes(' pv ')) {
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch = line.match(/ pv (.+)/);
        const multipvMatch = line.match(/multipv (\d+)/);
        const slot = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;

        pending.lines.set(slot, {
          cp: cpMatch ? parseInt(cpMatch[1], 10) : null,
          mate: mateMatch ? parseInt(mateMatch[1], 10) : null,
          move: pvMatch ? pvMatch[1].trim().split(/\s+/)[0] : null,
        });
      }

      if (line.startsWith('bestmove')) {
        const bestMove = line.split(/\s+/)[1];
        const candidates = Array.from(pending.lines.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, value]) => value)
          .filter((value) => value.move);
        const top = candidates[0] || {};

        pending.finish({
          bestMove: bestMove && bestMove !== '(none)' ? bestMove : null,
          cp: top.cp ?? null,
          mate: top.mate ?? null,
          candidates,
        });
      }
    };

    worker.postMessage('uci');

    return () => {
      readyRef.current = false;
      try { worker.terminate(); } catch {}
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [failAll, runNextJob]);

  const analyzeFen = useCallback((fen, depth = 14, multiPv = 3) => {
    return new Promise((resolve, reject) => {
      if (errorRef.current) {
        reject(new Error(errorRef.current));
        return;
      }
      if (!readyRef.current) {
        reject(new Error('Stockfish is still starting. Please wait a moment and try again.'));
        return;
      }
      queueRef.current.push({ fen, depth, multiPv, resolve, reject });
      runNextJob();
    });
  }, [runNextJob]);

  return { ready, engineError, analyzeFen };
}
