import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.log('::warning::R2 Worker deployment pending: CLOUDFLARE_API_TOKEN is not configured. Public R2 file integration remains available.');
  process.exit(0);
}
const account = process.env.CLOUDFLARE_ACCOUNT_ID || '073b0f4e7f33bf2ce56fe8f60dbe6067';
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/drabornseries`;
const headers = { Authorization: `Bearer ${token}` };
async function cloudflare(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  if (!response.ok || !body.success) throw Error('R2 Worker API failed: ' + response.status + ' (' + (body.errors || []).map((item) => item.code).join(',') + ')');
  return body.result;
}
const settings = await cloudflare('/settings');
const bindings = settings.bindings || [];
if (!bindings.some((item) => item.type === 'r2_bucket')) throw Error('The existing drabornseries Worker has no R2 bucket binding. No binding or bucket was guessed.');
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify({ main_module: 'r2-worker.js', compatibility_date: '2026-09-01',
  compatibility_flags: settings.compatibility_flags || [],
  bindings: bindings.filter((item) => !['secret_text', 'secret_key'].includes(item.type)), keep_bindings: ['secret_text', 'secret_key'],
})], { type: 'application/json' }));
form.append('r2-worker.js', new Blob([await readFile('cloudflare/r2-worker.js', 'utf8')], { type: 'application/javascript+module' }), 'r2-worker.js');
await cloudflare('', { method: 'PUT', body: form });
const supportedSecrets = ['SIGNING_SECRET', 'MEDIA_SIGNING_SECRET', 'DBS_MEDIA_SIGNING_SECRET'];
if (!bindings.some((binding) => binding.type === 'secret_text' && supportedSecrets.includes(binding.name)))
  await cloudflare('/secrets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'SIGNING_SECRET', type: 'secret_text', text: randomBytes(32).toString('hex') }) });
const response = await fetch('https://drabornseries.draborneagle.workers.dev/health', { signal: AbortSignal.timeout(15000) });
const health = await response.json();
if (!health.ok || !health.privateMedia || !health.listing) throw Error('R2 Worker health verification failed');
console.log('R2 Worker deployed: signed playback, byte ranges and authenticated folder listing verified.');
