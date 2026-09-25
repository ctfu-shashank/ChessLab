import { mkdir, copyFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(root, 'node_modules', 'stockfish', 'bin');
const targetDir = resolve(root, 'public', 'stockfish');
const files = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm'];

await mkdir(targetDir, { recursive: true });
for (const file of files) {
  const source = resolve(sourceDir, file);
  const target = resolve(targetDir, file);
  try {
    await access(source);
  } catch {
    throw new Error(`Stockfish asset missing after npm install: ${source}`);
  }
  await copyFile(source, target);
}
console.log('Stockfish 18 lite single-threaded engine copied to public/stockfish.');
