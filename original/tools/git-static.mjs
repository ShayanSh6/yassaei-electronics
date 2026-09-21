// سرو مخزن گیت برای Render: هم smart HTTP (کلون/ls-remote) هم dumb fallback
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.env.DEPLOY_ROOT || fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 3005);
const pkt = (s) => { const b = Buffer.from(s); return Buffer.concat([Buffer.from((b.length + 4).toString(16).padStart(4, '0')), b]); };

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT });
    const out = [];
    p.stdout.on('data', (d) => out.push(d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`exit ${code}`))));
    if (input) p.stdin.end(input); else p.stdin.end();
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '');
  if (p === 'repo.git' || p === 'repo.git/') p = '';
  if (p.startsWith('repo.git/')) p = p.slice('repo.git/'.length);

  try {
    // ── smart HTTP: تبلیغ مرجع‌ها ──
    if (req.method === 'GET' && p === 'info/refs' && url.searchParams.get('service') === 'git-upload-pack') {
      const adv = await run('git', ['upload-pack', '--stateless-rpc', '--advertise-refs', '.']);
      res.writeHead(200, { 'content-type': 'application/x-git-upload-pack-advertisement', 'cache-control': 'no-store' });
      res.end(Buffer.concat([pkt('# service=git-upload-pack\n'), Buffer.from('0000'), adv]));
      return;
    }
    // ── smart HTTP: دریافت اشیاء ──
    if (req.method === 'POST' && p === 'git-upload-pack') {
      const body = [];
      for await (const c of req) body.push(c);
      res.writeHead(200, { 'content-type': 'application/x-git-upload-pack-result', 'cache-control': 'no-store' });
      const child = spawn('git', ['upload-pack', '--stateless-rpc', '.'], { cwd: ROOT });
      child.stdout.pipe(res);
      child.stdin.end(Buffer.concat(body));
      return;
    }
    // ── dumb fallback ──
    const file = join(ROOT, '.git', p || '.');
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, '0.0.0.0', () => console.log(`git-static(smart+dumb) on ${PORT}`));
