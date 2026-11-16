import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { callMcpTool, extractSearchResult } from './mcp-client.js';

const PORT = Number(process.env.PORT || 10000);
const CHAINS = Object.freeze(['coop', 'migros', 'aldi', 'lidl', 'denner', 'volgshop', 'ottos', 'coopcity']);
const enabled = () => process.env.PRICE_PROVIDER_ENABLED === 'true';
const send = (res, status, body, extra = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
  res.end(JSON.stringify(body));
};
const safeToken = value => typeof value === 'string' && value.length >= 32 && value.length <= 256;
function authorized(req) {
  const secret = process.env.PRICE_API_TOKEN;
  if (!safeToken(secret)) return false;
  const supplied = req.headers?.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!safeToken(supplied)) return false;
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
function normalize(data, requested) {
  const groups = data.byChain ?? data.by_chain ?? data.results ?? {};
  const products = [];
  const all = Array.isArray(data) ? data : Array.isArray(data.products) ? data.products : null;
  const inputs = all ? all.map(p => ({ chain: (p.chain ?? p.store ?? '').toLowerCase(), p })) :
    requested.flatMap(chain => (Array.isArray(groups[chain]) ? groups[chain] :
      Array.isArray(groups[chain]?.products) ? groups[chain].products : []).map(p => ({ chain, p })));
  for (const { chain, p } of inputs) {
    if (!requested.includes(chain)) continue;
    const price = p.price?.current ?? p.price?.amount ?? (typeof p.price === 'number' ? p.price : null);
    const cents = typeof price === 'number' && Number.isFinite(price) && price >= 0 && price < 100000
      ? Math.round(price * 100) : null;
    if (!p.name || cents == null) continue;
    const size = p.size && Number.isFinite(p.size.value) && p.size.unit
      ? `${p.size.value} ${p.size.unit}` : (p.sizeLabel ?? '');
    products.push({ name: String(p.name).slice(0, 200), chain, priceCents: cents,
      sizeLabel: String(size).slice(0, 70), priceSource: 'swissgroceries-mcp@0.7.4',
      fetchedAt: data.sources?.[chain]?.fetchedAt ?? new Date().toISOString(),
      productUrl: typeof p.productUrl === 'string' && /^https:\/\//.test(p.productUrl) ? p.productUrl : null,
      productId: p.id == null ? null : String(p.id).slice(0, 100) });
  }
  return products.slice(0, 80);
}
const cache = new Map();
const CACHE_MS = 5 * 60_000;
const requests = new Map();
function limited(req) {
  const ip = req.socket?.remoteAddress ?? 'unknown';
  const now = Date.now();
  const bucket = requests.get(ip) ?? [];
  const current = bucket.filter(t => now - t < 60_000);
  current.push(now);
  requests.set(ip, current);
  if (requests.size > 1000) requests.clear();
  return current.length > 20;
}
export async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' }, { allow: 'GET' });
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, 400, { error: 'invalid_url' }); }
  // Health contains no personal data and does not reveal the API secret.
  if (url.pathname === '/health') return send(res, 200, {
    status: 'ok', service: 'einkaufen-preisserver',
    priceProvider: enabled() ? 'enabled' : 'not_configured',
    authConfigured: safeToken(process.env.PRICE_API_TOKEN)
  });
  if (!authorized(req)) return send(res, 401, { error: 'unauthorized', products: [] });
  if (limited(req)) return send(res, 429, { error: 'rate_limited', products: [] }, { 'retry-after': '60' });
  if (url.pathname === '/api/chains') return send(res, 200, { chains: CHAINS.map(id => ({ id, onlinePricesAvailable: enabled() })), source: 'swissgroceries-mcp@0.7.4' });
  if (url.pathname !== '/api/search') return send(res, 404, { error: 'not_found' });
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2 || q.length > 100) return send(res, 400, { error: 'query_invalid', message: 'q: 2–100 Zeichen' });
  const requested = [...new Set((url.searchParams.get('chains') || 'coop,migros').split(',').map(x => x.trim().toLowerCase()))];
  if (requested.some(x => !CHAINS.includes(x))) return send(res, 400, { error: 'invalid_chain', supportedChains: CHAINS });
  if (!enabled()) return send(res, 503, { error: 'price_provider_not_configured', products: [] });
  const cacheKey = `${q.toLocaleLowerCase('de-CH')}|${requested.join(',')}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return send(res, 200, { ...hit.body, cachedByPreisserver: true });
  try {
    const toolResult = await callMcpTool({ tool: 'search_products', input: { query: q, chains: requested, limit: 10 } });
    const data = extractSearchResult(toolResult);
    const body = { query: q, products: normalize(data, requested),
      errors: data.errors ?? [], sources: data.sources ?? {}, localPricesVerified: false };
    if (cache.size >= 150) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { at: Date.now(), body });
    return send(res, 200, body);
  } catch (err) {
    console.error('MCP search failed:', err.message);
    return send(res, 502, { error: 'external_price_search_failed', reason: err.message, products: [] });
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  http.createServer((req, res) => { void handler(req, res); }).listen(PORT, '0.0.0.0',
    () => console.log(`Einkaufen Preisserver auf Port ${PORT}`));
