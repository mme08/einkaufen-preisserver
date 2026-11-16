import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from './server.js';

function request(path) {
  const res = { status: 0, headers: {}, data: '', writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.data = JSON.parse(body); } };
  handler({ method: 'GET', url: path }, res);
  return res;
}
test('health endpoint', () => {
  const r = request('/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.priceProvider, 'not_configured');
});
test('all eight chains', () => {
  const r = request('/api/chains');
  assert.equal(r.data.chains.length, 8);
});
test('search does not invent prices', () => {
  const r = request('/api/search?q=Milch');
  assert.equal(r.status, 503);
  assert.deepEqual(r.data.products, []);
});
