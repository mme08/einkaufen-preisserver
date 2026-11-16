import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { callMcpTool, extractSearchResult } from './mcp-client.js';

const PORT = Number(process.env.PORT || 10000);
const CHAINS = Object.freeze(['coop', 'migros', 'aldi', 'lidl', 'denner', 'volgshop', 'ottos', 'coopcity']);
const enabled = () => process.env.PRICE_PROVIDER_ENABLED === 'true';
const send = (res, status, body, extra = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
  res.end(JSON.stringify(body));
};

function normalize(data, requested) {
  const products = [];
  for (const chain of requested) {
    for (const product of data.byChain?.[chain] ?? []) {
      // Preserve upstream fields; do not invent prices or locations.
      products.push({ ...product, chain, priceSource: 'external', fetchedAt: data.sources?.[chain]?.fetchedAt ?? null, fromCache: data.sources?.[chain]?.fromCache ?? null });
    }
  }
  return products;
}

export async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' }, { allow: 'GET' });
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, 400, { error: 'invalid_url' }); }
  if (url.pathname === '/health') return send(res, 200, { status: 'ok', service: 'einkaufen-preisserver', priceProvider: enabled() ? 'enabled' : 'not_configured' });
  if (url.pathname === '/api/chains') return send(res, 200, { chains: CHAINS.map(id => ({ id, onlinePricesAvailable: enabled() })), source: enabled() ? 'configured_not_verified' : 'configuration_only' });
  if (url.pathname === '/api/search') {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q || q.length > 100) return send(res, 400, { error: 'query_required', message: 'q muss 1 bis 100 Zeichen enthalten' });
    const requested = [...new Set((url.searchParams.get('chains') || CHAINS.join(',')).split(',').map(x => x.trim().toLowerCase()))];
    if (requested.some(x => !CHAINS.includes(x))) return send(res, 400, { error: 'invalid_chain', supportedChains: CHAINS });
    if (!enabled()) return send(res, 503, { error: 'price_provider_not_configured', message: 'Externe Preisabfrage ist bis zur Lizenzfreigabe deaktiviert.', query: q, chains: requested, products: [] });
    if (!process.env.MCP_COMMAND) return send(res, 503, { error: 'mcp_command_missing', products: [] });
    try {
      const toolResult = await callMcpTool({ command: process.env.MCP_COMMAND, args: JSON.parse(process.env.MCP_ARGS_JSON || '[]'), tool: 'search_products', input: { query: q, chains: requested, limit: 10 } });
      const data = extractSearchResult(toolResult);
      return send(res, 200, { query: q, products: normalize(data, requested), errors: data.errors ?? [], sources: data.sources ?? {}, localPricesVerified: false });
    } catch (err) {
      console.error('MCP search failed:', err.message);
      return send(res, 502, { error: 'external_price_search_failed', products: [] });
    }
  }
  return send(res, 404, { error: 'not_found' });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) http.createServer((req, res) => { void handler(req, res); }).listen(PORT, '0.0.0.0', () => console.log(`Einkaufen Preisserver auf Port ${PORT}`));
