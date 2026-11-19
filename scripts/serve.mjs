#!/usr/bin/env node
/** Small static HTTP server. No installs, compilation, or third-party modules. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultRoot = resolve(projectRoot, 'dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function contained(root, target) {
  const path = relative(root, target);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}

export async function createStaticServer({ root = defaultRoot } = {}) {
  const publicRoot = await realpath(root);
  return createServer(async (request, response) => {
    const reply = (status, message, extra = {}) => {
      const body = `${message}\n`;
      response.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...extra,
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      reply(405, 'Method not allowed.', { Allow: 'GET, HEAD' });
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      reply(400, 'Invalid URL.');
      return;
    }
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(p => p.startsWith('.'))) {
      reply(403, 'Path is not served.');
      return;
    }
    let target = resolve(publicRoot, `.${pathname}`);
    if (!contained(publicRoot, target)) {
      reply(403, 'Path is not served.');
      return;
    }
    try {
      let info = await stat(target);
      if (info.isDirectory()) {
        target = resolve(target, 'index.html');
        info = await stat(target);
      }
      target = await realpath(target);
      if (!contained(publicRoot, target) || !info.isFile()) {
        reply(403, 'Path is not served.');
        return;
      }
      response.writeHead(200, {
        'Content-Type': types[extname(target).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      const stream = createReadStream(target);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch (error) {
      reply(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500,
        error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'File not found.' : 'Unable to read this file.');
    }
  });
}

async function main() {
  let host = process.env.HOST || '127.0.0.1';
  let portText = process.env.PORT || '5173';
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: npm start -- [--port 5173] [--host 127.0.0.1]\nAlso accepts PORT and HOST environment variables. Serves only dist/.');
      return;
    }
    if (args[i] === '--port' && args[i + 1] !== undefined) portText = args[++i];
    else if (args[i] === '--host' && args[i + 1]) host = args[++i];
    else throw new Error(`Unknown or incomplete option: ${args[i]}. Use --help.`);
  }
  const port = Number(portText);
  if (!/^\d+$/.test(String(portText)) || !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Port must be an integer from 0 to 65535.');
  }
  const server = await createStaticServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Try: npm start -- --port ${port === 5180 ? 5181 : 5180}`
      : error.message);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    const actualPort = server.address().port;
    const displayHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host.includes(':') ? `[${host}]` : host;
    console.log(`Maple Atlas: http://${displayHost}:${actualPort}\nServing ${defaultRoot}\nPress Ctrl+C to stop.`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(() => { process.exitCode = 0; });
      server.closeIdleConnections();
    });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(`Cannot start Maple Atlas: ${error.message}`);
    process.exitCode = 1;
  });
}
