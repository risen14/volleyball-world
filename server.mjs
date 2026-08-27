// 纯 Node.js（零依赖）HTTP 服务器：托管前端 + /api/matches 接口，每小时自动刷新数据
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refresh, getState } from './scraper.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 8787);
const HOUR = 60 * 60 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function safePath(urlPath) {
  const rel = decodeURIComponent(urlPath.split('?')[0]).replace(/^[/\\]+/, '') || 'index.html';
  const abs = path.resolve(PUBLIC, rel);
  if (abs !== PUBLIC && !abs.startsWith(PUBLIC + path.sep)) return null;
  return abs;
}

async function serveStatic(req, res) {
  const abs = safePath(req.url);
  if (!abs) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const data = await readFile(abs);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/matches') {
    const s = getState();
    if (!s) { json(res, 503, { error: '数据尚未就绪' }); return; }
    json(res, 200, s);
    return;
  }
  if (url === '/api/health') {
    const s = getState();
    json(res, 200, { ok: true, updatedAt: s?.updatedAt, nextUpdate: s?.nextUpdate, liveSource: s?.liveSource, matches: s?.matches.length });
    return;
  }
  await serveStatic(req, res);
});

// 启动即抓取一次，之后每 1 小时刷新
await refresh().catch(e => console.error('initial refresh failed', e));
setInterval(() => { refresh().catch(e => console.error('hourly refresh failed', e)); }, HOUR);

server.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================');
  console.log('  HBTv / Volleyball World 赛事中心 已启动');
  console.log(`  本地访问:   http://localhost:${PORT}`);
  console.log(`  局域网访问: http://<本机IP>:${PORT}`);
  console.log('==================================================');
});
