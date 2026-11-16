import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from './server.js';

async function request(path) {
  const res = { status: 0, headers: {}, data: '', writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.data = JSON.parse(body); } };
  await handler({ method: 'GET', url: path }, res);
  return res;
}
test('health endpoint remains available', async () => {
  const r = await request('/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.priceProvider, 'not_configured');
});
test('all eight chains listed', async () => {
  const r = await request('/api/chains');
  assert.deepEqual(r.data.chains.map(x => x.id), ['coop', 'migros', 'aldi', 'lidl', 'denner', 'volgshop', 'ottos', 'coopcity']);
});
test('provider disabled by default and no fake prices', async () => {
  const r = await request('/api/search?q=Milch');
  assert.equal(r.status, 503);
  assert.deepEqual(r.data.products, []);
});
test('invalid chain rejected', async () => {
  const r = await request('/api/search?q=Milch&chains=unknown');
  assert.equal(r.status, 400);
});
