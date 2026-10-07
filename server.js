import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const photoDir = path.join(root, 'photos');
fs.mkdirSync(photoDir, { recursive: true });
const dev = process.argv.includes('--dev');
const vite = dev ? await createViteServer({ server: { middlewareMode: true, host: '0.0.0.0' }, appType: 'spa' }) : null;
const port = Number(process.env.PORT || 5173);
const lanAddress = Object.values(os.networkInterfaces()).flat().find(address => address?.family === 'IPv4' && !address.internal)?.address;
let publicBase = process.env.PUBLIC_BASE_URL || (lanAddress ? `http://${lanAddress}:${port}` : '');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };
const isPublicAddress = () => /^https:\/\//i.test(publicBase) && !/localhost|127\.0\.0\.1/i.test(publicBase);
const sendFile = (res, filename, type) => {
  const stream = fs.createReadStream(filename);
  stream.on('error', () => { if (!res.headersSent) { res.writeHead(404); res.end('Not found'); } });
  res.writeHead(200, { 'Content-Type': type || mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  stream.pipe(res);
};
http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ public: isPublicAddress(), baseUrl: publicBase }));
  }
  if (url.pathname === '/api/photos' && req.method === 'POST') {
    let size = 0; const chunks = [];
    req.on('data', chunk => { size += chunk.length; if (size > 25_000_000) req.destroy(); else chunks.push(chunk); });
    req.on('end', () => {
      const data = Buffer.concat(chunks);
      const type = req.headers['content-type'];
      if (data.length < 100 || !['image/png', 'image/jpeg'].includes(type)) { res.writeHead(400); return res.end('Expected PNG or JPEG'); }
      const id = crypto.randomBytes(16).toString('hex');
      const extension = type === 'image/jpeg' ? 'jpg' : 'png';
      fs.writeFileSync(path.join(photoDir, `${id}.${extension}`), data);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: `${publicBase}/api/photos/${id}.${extension}`, public: isPublicAddress() }));
    });
    return;
  }
  const match = url.pathname.match(/^\/api\/photos\/([a-f0-9]{32})\.(png|jpg)$/);
  if (match && req.method === 'GET') {
    const extension = match[2];
    res.setHeader('Content-Disposition', `attachment; filename="afaq-career-forum.${extension}"`);
    return sendFile(res, path.join(photoDir, `${match[1]}.${extension}`), mime[`.${extension}`]);
  }
  if (vite) return vite.middlewares(req, res);
  const dist = path.join(root, 'dist');
  const target = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
  if (target.startsWith(dist + path.sep) && fs.existsSync(target) && fs.statSync(target).isFile()) return sendFile(res, target);
  return sendFile(res, path.join(dist, 'index.html'), 'text/html');
}).listen(port, '0.0.0.0', () => {
  console.log(`Photo booth running at http://localhost:${port}`);
  if (!process.argv.includes('--public')) return;
  if (process.env.PUBLIC_BASE_URL) return console.log(`Public photo URL: ${publicBase}`);
  const tunnel = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], { windowsHide: true });
  let log = '';
  tunnel.stderr.on('data', chunk => {
    log += chunk.toString();
    const match = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && publicBase !== match[0]) { publicBase = match[0]; console.log(`Public photo URL: ${publicBase}`); }
    log = log.slice(-3000);
  });
  tunnel.on('error', error => console.error(`Public tunnel unavailable: ${error.message}. Install cloudflared or set PUBLIC_BASE_URL.`));
  tunnel.on('exit', code => console.error(`Public tunnel stopped (${code}). Remote QR links will no longer work.`));
  process.on('SIGINT', () => tunnel.kill());
});
