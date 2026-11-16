import http from 'node:http';

const PORT = Number(process.env.PORT || 10000);
const CHAINS = Object.freeze(['coop', 'migros', 'aldi', 'lidl', 'denner', 'volgshop', 'ottos', 'coopcity']);
const send = (res, status, body, extra = {}) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
  });
  res.end(JSON.stringify(body));
};

export function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' }, { allow: 'GET' });
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch { return send(res, 400, { error: 'invalid_url' }); }
  if (url.pathname === '/health') {
    return send(res, 200, { status: 'ok', service: 'einkaufen-preisserver', priceProvider: 'not_configured' });
  }
  if (url.pathname === '/api/chains') {
    return send(res, 200, { chains: CHAINS.map(id => ({ id, onlinePricesAvailable: false })), source: 'configuration_only' });
  }
  if (url.pathname === '/api/search') {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q || q.length > 100) return send(res, 400, { error: 'query_required', message: 'q muss 1 bis 100 Zeichen enthalten' });
    const requested = (url.searchParams.get('chains') || CHAINS.join(',')).split(',').map(x => x.trim().toLowerCase());
    if (requested.some(x => !CHAINS.includes(x))) return send(res, 400, { error: 'invalid_chain', supportedChains: CHAINS });
    return send(res, 503, {
      error: 'price_provider_not_configured',
      message: 'Die Livepreis-Anbindung ist noch nicht aktiviert. Es werden keine Preise erfunden.',
      query: q,
      chains: [...new Set(requested)],
      products: []
    });
  }
  return send(res, 404, { error: 'not_found' });
}

if (process.env.NODE_ENV !== 'test') {
  http.createServer(handler).listen(PORT, '0.0.0.0', () => {
    console.log(`Einkaufen Preisserver bereit auf Port ${PORT}`);
  });
}
