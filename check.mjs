/*
 * AGRIXON diagnostics. Run with:
 *   runtime\node.exe check.mjs
 * or:
 *   node check.mjs
 *
 * Prints versions, paths, required files and whether port 3000 is free.
 * Never prints secret values.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = process.env.AGRIXON_ROOT
  ? path.resolve(process.env.AGRIXON_ROOT)
  : path.dirname(fileURLToPath(import.meta.url));

console.log('AGRIXON check');
console.log('node      ', process.version);
console.log('platform  ', process.platform, process.arch);
console.log('execPath  ', process.execPath);
console.log('cwd       ', process.cwd());
console.log('pkg       ', Boolean(process.pkg));
console.log('root      ', root);
console.log('');

for (const file of ['public/index.html', 'public/tools.html', '.env.local', 'server-tools.mjs', 'server.mjs']) {
  console.log(file.padEnd(22), existsSync(path.join(root, file)) ? 'OK' : 'MISSING');
}

const envFile = path.join(root, '.env.local');
if (existsSync(envFile)) {
  const keys = readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => line.split('=')[0]);
  console.log('env keys  ', keys.join(', ') || '(empty)');
}

const port = Number(process.env.PORT ?? 3000);
const probe = net.createServer();
probe.once('error', (error) => {
  console.log('port      ', port, error.code === 'EADDRINUSE' ? 'BUSY' : error.code);
  process.exit(0);
});
probe.once('listening', () => {
  console.log('port      ', port, 'FREE');
  probe.close();
});
probe.listen(port, '127.0.0.1');
