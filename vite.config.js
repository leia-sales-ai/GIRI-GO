// GIRI Go build: entry app/index.html → built index.html + assets/ in the repo root (what GitHub Pages serves).
// Static files (fonts/, icons/, vendor/, sw.js, manifest, login.jpg) live in the root as well and are served as-is.
import { defineConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(__dirname);
const STATIC = ['fonts', 'icons', 'vendor', 'sw.js', 'manifest.webmanifest', 'login.jpg', 'icon.svg'];
const MIME = {'.js':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.woff2':'font/woff2'};
// dev server: serve the root static files exactly like GitHub Pages does
const serveRootStatic = () => ({ name:'giri-root-static', configureServer(server){ server.middlewares.use((req, res, next) => { const u = decodeURIComponent((req.url||'').split('?')[0]).replace(/^\//,''); if(!STATIC.some(s => u===s || u.startsWith(s+'/'))) return next(); const f = path.join(root, u); if(!fs.existsSync(f) || fs.statSync(f).isDirectory()) return next(); res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); }); } });
export default defineConfig({
  root: 'app',
  base: './',
  publicDir: false,
  plugins: [serveRootStatic()],
  build: { outDir: '..', emptyOutDir: false, target: 'es2020', assetsDir: 'assets', sourcemap: false }
});
