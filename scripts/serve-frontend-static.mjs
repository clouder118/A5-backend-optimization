import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'frontend', 'dist');
const port = Number.parseInt(process.env.FRONTEND_PORT ?? '5173', 10);
const entry = process.env.FRONTEND_ENTRY ?? (port === 5174 ? 'admin' : 'visitor');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.wasm', 'application/wasm'],
]);

function sendFile(response, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
}

function resolveRequestPath(url) {
  const parsed = new URL(url, `http://127.0.0.1:${port}`);
  const decodedPath = decodeURIComponent(parsed.pathname);
  const safeRelative = decodedPath.replace(/^\/+/, '');
  const requested = path.resolve(distRoot, safeRelative);
  if (!requested.startsWith(distRoot)) {
    return path.join(distRoot, 'index.html');
  }
  if (existsSync(requested) && statSync(requested).isFile()) {
    return requested;
  }
  return path.join(distRoot, 'index.html');
}

if (!existsSync(path.join(distRoot, 'index.html'))) {
  console.error(`Missing ${path.join(distRoot, 'index.html')}. Run BUILD-FRONTEND.bat first.`);
  process.exit(1);
}

const server = createServer((request, response) => {
  if (!request.url) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }
  sendFile(response, resolveRequestPath(request.url));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Static ${entry} frontend ready at http://127.0.0.1:${port}/`);
});
