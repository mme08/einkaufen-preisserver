import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from './server.js';
function request(path, { auth = false } = {}) {
  return new Promise(resolve => {
    const req = { method: 'GET', url: path,
      headers: auth ? { authorization: `Bearer ${'s'.repeat(40)}` } : {},
      socket: { remoteAddress: '127.0.0.7' } };
    const res = { statusCode: 0, writeHead(status) { this.statusCode = status; },
      end(content) { resolve({ status: this.statusCode, data: JSON.parse(content) }); } };
    void handler(req, res);
  });
}
test('promotions require bearer token', async () => {
  process.env.PRICE_API_TOKEN = 's'.repeat(40);
  assert.equal((await request('/api/promotions')).status, 401);
});
test('disabled promotions never access MCP', async () => {
  process.env.PRICE_API_TOKEN = 's'.repeat(40);
  process.env.PRICE_PROVIDER_ENABLED = 'false';
  assert.equal((await request('/api/promotions', { auth:true })).status, 503);
});
test('reject unknown retailers', async () => {
  process.env.PRICE_API_TOKEN = 's'.repeat(40);
  assert.equal((await request('/api/promotions?chains=unknown', { auth:true })).status, 400);
});

test('valid additional chain passes validation before checking provider availability', async () => {
  process.env.PRICE_API_TOKEN = 's'.repeat(40);
  process.env.PRICE_PROVIDER_ENABLED = 'false';
  for (const chain of ['aldi', 'lidl', 'denner', 'volgshop', 'ottos', 'coopcity']) {
    const response = await request(`/api/promotions?chains=${chain}`, { auth: true });
    assert.equal(response.status, 503, chain);
  }
});
test('all eight chains pass validation', async () => {
  process.env.PRICE_API_TOKEN = 's'.repeat(40);
  process.env.PRICE_PROVIDER_ENABLED = 'false';
  assert.equal((await request('/api/promotions?chains=coop,migros,aldi,lidl,denner,volgshop,ottos,coopcity', { auth: true })).status, 503);
});
