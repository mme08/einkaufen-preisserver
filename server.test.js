import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from './server.js';
const SECRET = 'test-private-price-secret-12345678901234567';
process.env.PRICE_API_TOKEN = SECRET;
process.env.PRICE_PROVIDER_ENABLED = 'false';
async function request(path, token) {
  const res = { status: 0, headers: {}, data: '', writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.data = JSON.parse(body); } };
  await handler({ method: 'GET', url: path, headers: token ? { authorization: `Bearer ${token}` } : {}, socket: { remoteAddress: '127.0.0.1' } }, res);
  return res;
}
test('health endpoint remains public without credentials', async () => {
  const r = await request('/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.authConfigured, true);
});
test('search requires bearer token', async () => {
  assert.equal((await request('/api/search?q=Milch')).status, 401);
  assert.equal((await request('/api/search?q=Milch', 'wrong')).status, 401);
});
test('chains are private', async () => {
  const r = await request('/api/chains', SECRET);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.chains.map(x => x.id), ['coop', 'migros', 'aldi', 'lidl', 'denner', 'volgshop', 'ottos', 'coopcity']);
});
test('disabled provider never fabricates prices', async () => {
  const r = await request('/api/search?q=Milch', SECRET);
  assert.equal(r.status, 503);
  assert.deepEqual(r.data.products, []);
});
test('invalid chain rejected', async () => {
  const r = await request('/api/search?q=Milch&chains=unknown', SECRET);
  assert.equal(r.status, 400);
});
test('short queries rejected', async () => {
  const r = await request('/api/search?q=m', SECRET);
  assert.equal(r.status, 400);
});
