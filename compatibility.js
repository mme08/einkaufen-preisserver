// Schema inspection only: no retailer calls and no network requests.
// A "compatible" result means tools/list can be mapped, NOT that prices work.
export const requiredChains = ['coop', 'migros'];
export function inspectSearchTool(tools) {
  const tool = (tools ?? []).find(t => t.name === 'search_products');
  if (!tool) return { schemaCompatible: false, issues: ['search_products fehlt'], fields: [] };
  const schema = tool.inputSchema ?? {};
  const fields = Object.keys(schema.properties ?? {});
  const issues = [];
  if (!fields.includes('query') && !fields.includes('q')) issues.push('Suchbegriff-Feld query/q fehlt');
  const unknownRequired = (schema.required ?? []).filter(key =>
    !['query', 'q', 'chains', 'chain', 'limit'].includes(key));
  if (unknownRequired.length) issues.push(`Unbekannte Pflichtparameter: ${unknownRequired.join(', ')}`);
  const list = schema.properties?.chains;
  const single = schema.properties?.chain;
  if (!list && !single) issues.push('Keine Händler-Filter chains/chain (Integration prüfen)');
  if (single && !list) issues.push('Nur chain statt chains: mehrere Händler brauchen getrennte Abfragen');
  return { schemaCompatible: issues.length === 0, issues, fields,
    required: schema.required ?? [], toolNames: tools.map(t => t.name) };
}

export function examineNormalizedSearch(data) {
  const report = { shape: 'unknown', chains: [], products: 0,
    sampleFieldNames: [], priceFieldNames: [], warning: '' };
  const groups = data?.byChain ?? data?.by_chain ?? data?.results;
  if (Array.isArray(data)) {
    report.shape = 'array'; report.products = data.length;
    report.chains = [...new Set(data.map(x => x?.chain).filter(Boolean))];
  } else if (Array.isArray(data?.products)) {
    report.shape = 'products-array'; report.products = data.products.length;
    report.chains = [...new Set(data.products.map(x => x?.chain).filter(Boolean))];
  } else if (groups && typeof groups === 'object') {
    report.shape = 'by-chain'; report.chains = Object.keys(groups);
    report.products = Object.values(groups).reduce((sum, x) => sum +
      (Array.isArray(x) ? x.length : Array.isArray(x?.products) ? x.products.length : 0), 0);
  } else report.warning = 'Antwortformat unbekannt – Adapter vor Upgrade anpassen';
  const sample = Array.isArray(data) ? data[0] : Array.isArray(data?.products)
    ? data.products[0] : Object.values(groups ?? {}).flatMap(x => Array.isArray(x)
      ? x : x?.products ?? [])[0];
  if (sample) {
    report.sampleFieldNames = Object.keys(sample);
    report.priceFieldNames = typeof sample.price === 'object' && sample.price
      ? Object.keys(sample.price) : ['price'];
  }
  return report;
}
