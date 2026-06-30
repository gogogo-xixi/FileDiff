const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 35217;
const PID_FILE = path.join(
  process.env.TEMP || '/tmp',
  '.file-diff-server.pid'
);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

function readFlatDir(dirPath) {
  try {
    let resolved = dirPath.replace(/%([^%]+)%/g, (_, key) => process.env[key] || '');
    resolved = resolved.replace(/^['\u201C\u201D]|['\u201C\u201D]$/g, '').trim();
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    return {
      name: path.basename(resolved),
      items: entries.map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory(),
      })),
    };
  } catch (err) {
    return { error: `无法读取文件夹: ${err.message}` };
  }
}

function openBrowser(url) {
  try {
    const cmd = process.platform === 'win32'
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;
    execSync(cmd, { shell: true, detached: true, stdio: 'ignore', windowsHide: true });
  } catch {}
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && req.url === '/shutdown') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    setTimeout(() => process.exit(0), 100);
    return;
  }

  if (req.method === 'POST' && req.url === '/read-folder') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { dirPath } = JSON.parse(body);
        const result = readFlatDir(dirPath);
        res.writeHead(result.error ? 400 : 200, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify(result));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求格式错误' }));
      }
    });
    return;
  }

  const filePath = path.join(
    __dirname,
    'renderer',
    req.url === '/' ? 'index.html' : req.url
  );
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

function tryListen(port) {
  server.listen(port, () => {
    try {
      fs.writeFileSync(PID_FILE, String(process.pid), 'utf-8');
    } catch {}
    const url = `http://localhost:${port}`;
    console.log(`\n  ${url}\n`);
    openBrowser(url);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      openBrowser(`http://localhost:${port}`);
      process.exit(0);
    } else {
      console.error('启动失败:', err.message);
      process.exit(1);
    }
  });
}

tryListen(PORT);
