import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { parseRange } from '../cloudflare/r2-worker.js';

test('R2 byte ranges support mobile seeking and reject malformed or unsatisfiable requests', () => {
  assert.deepEqual(parseRange('bytes=0-127', 200), { offset: 0, length: 128 });
  assert.deepEqual(parseRange('bytes=150-', 200), { offset: 150, length: 50 });
  assert.deepEqual(parseRange('bytes=-50', 200), { offset: 150, length: 50 });
  assert.deepEqual(parseRange('bytes=0-999', 200), { offset: 0, length: 200 });
  for (const header of ['bytes=200-', 'bytes=50-20', 'bytes=0-10,20-30', 'bytes=-0', 'bytes=-']) assert.throws(() => parseRange(header, 200));
});

test('R2 Worker signs only authorized media and rejects tampered/expired links', async () => {
  const originalFetch = globalThis.fetch;
  const bytes = new Uint8Array(200);
  const metadata = { size: 200, etag: 'fixture', httpEtag: '"fixture"', writeHttpMetadata: (headers) => headers.set('Content-Type','video/mp4') };
  const env = { SIGNING_SECRET: 'fixture-only-secret', VIDEOS: { head: async () => metadata, list: async () => ({ objects: [] }),
    get: async (_key, options) => ({ body: bytes.slice(options.range?.offset || 0, options.range ? options.range.offset + options.range.length : 200) }) } };
  globalThis.fetch = async (_url, options) => new Response(JSON.stringify(options.body.includes('episode') ? 'Fixture/01.mp4' : false), { status: 200 });
  try {
    const denied = await worker.fetch(new Request('https://worker.example/media/Fixture/01.mp4'), env);
    assert.equal(denied.status, 403);
    const list = await worker.fetch(new Request('https://worker.example/studio/media'), env);
    assert.equal(list.status, 403);
    const response = await worker.fetch(new Request('https://worker.example/playback', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({episode:'00000000-0000-4000-8000-000000000001'}) }), env);
    assert.equal(response.status, 200);
    const { url } = await response.json();
    assert.ok(new URL(url).searchParams.get('sig'));
    const partial = await worker.fetch(new Request(url, { headers: { Range:'bytes=20-49', Origin:'https://www.draborneagle.com' } }), env);
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('Content-Range'), 'bytes 20-49/200');
    assert.equal((await partial.arrayBuffer()).byteLength, 30);
    assert.equal(partial.headers.get('Access-Control-Allow-Origin'), 'https://www.draborneagle.com');
    const tampered = new URL(url); tampered.pathname = '/media/Fixture/02.mp4';
    assert.equal((await worker.fetch(new Request(tampered), env)).status, 403);
    const expired = new URL(url); expired.searchParams.set('exp', '1');
    assert.equal((await worker.fetch(new Request(expired), env)).status, 403);
    const outside = await worker.fetch(new Request(url, { headers: { Range:'bytes=200-' } }), env);
    assert.equal(outside.status, 416);
  } finally { globalThis.fetch = originalFetch; }
});
