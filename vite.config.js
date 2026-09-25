import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Stockfish's WASM build needs these headers for SharedArrayBuffer threading.
  // If you don't add cross-origin isolation, the engine falls back to single-threaded
  // mode automatically (slower, but still works).
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
