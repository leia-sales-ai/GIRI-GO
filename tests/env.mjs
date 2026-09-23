// shared test environment: repo root, base URL of the static test server, output folder for screenshots
import path from 'node:path'; import fs from 'node:fs';
export const TESTS = path.dirname(new URL(import.meta.url).pathname);
export const ROOT = path.resolve(TESTS, '..');
export const PORT = Number(process.env.GG_PORT || 8765);
export const BASE = `http://localhost:${PORT}`;
export const OUT = path.join(TESTS, 'out'); fs.mkdirSync(path.join(OUT, 'shots'), {recursive:true});
export const CHROME = process.env.GG_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const launchArgs = (extra=[]) => ({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args:['--headless=new', ...extra] });
