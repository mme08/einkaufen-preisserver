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
      sizeLabel: String(size).slice(0, 70), priceSource: 'swissgroceries-mcp@0.11.1-staging',
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

// Separate low-frequency promotions endpoint. Never create artificial savings.
// Normalize MCP shapes conservatively: unknown prices remain null.
function moneyCents(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 100000)
    return Math.round(value * 100);
  if (value && typeof value === 'object')
    return moneyCents(value.amount ?? value.value ?? value.current ?? value.price);
  return null;
}
function normalizePromotions(data, requested) {
  const groups = data.byChain ?? data.by_chain ?? data.results ?? {};
  const all = Array.isArray(data) ? data :
    Array.isArray(data.promotions) ? data.promotions :
    Array.isArray(data.deals) ? data.deals :
    Array.isArray(data.items) ? data.items : null;
  const entries = all ? all.map(p => ({ p, chain: String(p.chain ?? p.store ?? p.retailer ?? '').toLowerCase() })) :
    requested.flatMap(chain => {
      const group = groups[chain];
      const arr = Array.isArray(group) ? group : group?.promotions ?? group?.deals ?? group?.items ?? [];
      return Array.isArray(arr) ? arr.map(p => ({ p, chain })) : [];
    });
  const seen = new Set();
  const result = [];
  for (const { p, chain } of entries) {
    if (!requested.includes(chain) || !p || typeof p !== 'object') continue;
    const name = p.name ?? p.title ?? p.product?.name ?? p.productName;
    if (typeof name !== 'string' || !name.trim()) continue;
    const priceCents = moneyCents(p.salePrice ?? p.promoPrice ?? p.promotionPrice ?? p.price?.current ?? p.price);
    const oldPriceCents = moneyCents(p.originalPrice ?? p.regularPrice ?? p.wasPrice ?? p.price?.original);
    const percentage = p.discountPercent ?? p.discountPercentage ?? p.discount?.percent;
    const discountLabel = typeof percentage === 'number' && percentage > 0 && percentage <= 100
      ? `−${Math.round(percentage)} %` : (typeof p.discountLabel === 'string' ? p.discountLabel.slice(0, 60) : '');
    const validUntil = p.validUntil ?? p.endDate ?? p.validity?.end ?? p.end ?? '';
    const validUntilText = typeof validUntil === 'string' ? validUntil.slice(0, 32) : '';
    if (/^\d{4}-\d{2}-\d{2}/.test(validUntilText) &&
        validUntilText.slice(0, 10) < new Date().toISOString().slice(0, 10)) continue;
    const size = typeof p.size === 'string' ? p.size :
      typeof p.sizeLabel === 'string' ? p.sizeLabel :
      p.size?.value != null && p.size?.unit ? `${p.size.value} ${p.size.unit}` : '';
    const key = `${chain}|${name.trim().toLowerCase()}|${validUntilText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name: name.trim().slice(0, 200), chain,
      priceCents, oldPriceCents: oldPriceCents != null && (priceCents == null || oldPriceCents > priceCents) ? oldPriceCents : null,
      discountLabel, validUntil: validUntilText, sizeLabel: String(size).slice(0, 70) });
    if (result.length >= 100) break;
  }
  return result;
}
const promotionCache = new Map();
async function promotionsHandler(url, res) {
  const requested = [...new Set((url.searchParams.get('chains') || 'coop,migros')
    .split(',').map(x => x.trim().toLowerCase()))];
  if (!requested.length || requested.some(x => !['coop', 'migros'].includes(x)))
    return send(res, 400, { error: 'invalid_chain' });
  if (!enabled()) return send(res, 503, { error: 'price_provider_not_configured' });
  const key = requested.slice().sort().join(',');
  const hit = promotionCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 60 * 60_000)
    return send(res, 200, { ...hit.body, cachedByPreisserver: true });
  try {
    const result = await callMcpTool({ tool: 'get_promotions',
      input: { chains: requested, limit: 100 }, timeoutMs: 75000 });
    const data = extractSearchResult(result);
    const promotions = normalizePromotions(data, requested);
    // Do not silently mark unknown formats as a verified empty promotions list.
    if (data && !Array.isArray(data) && !('promotions' in data) &&
        !('deals' in data) && !('items' in data) &&
        !('byChain' in data) && !('by_chain' in data) && !('results' in data)) {
      return send(res, 502, { error: 'unrecognized_promotion_format' });
    }
    const body = { promotions, source: 'swissgroceries-mcp',
      fetchedAt: new Date().toISOString(), localPricesVerified: false };
    promotionCache.set(key, { at: Date.now(), body });
    return send(res, 200, body);
  } catch (err) {
    console.error('MCP promotions failed:', err.message);
    return send(res, 502, { error: 'mcp_promotions_unavailable' });
  }
}

export async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' }, { allow: 'GET' });
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, 400, { error: 'invalid_url' }); }
  // Health contains no personal data and does not reveal the API secret.
  if (url.pathname === '/health') return send(res, 200, {
    status: 'ok', service: 'einkaufen-preisserver-staging', staging: true, mcpVersion: '0.11.1',
    priceProvider: enabled() ? 'enabled' : 'not_configured',
    authConfigured: safeToken(process.env.PRICE_API_TOKEN)
  });
  if (!authorized(req)) return send(res, 401, { error: 'unauthorized', products: [] });
  if (limited(req)) return send(res, 429, { error: 'rate_limited', products: [] }, { 'retry-after': '60' });
  if (url.pathname === '/api/chains') return send(res, 200, { chains: CHAINS.map(id => ({ id, onlinePricesAvailable: enabled() })), source: 'swissgroceries-mcp@0.11.1-staging' });
  if (url.pathname === '/api/promotions') return promotionsHandler(url, res);
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
