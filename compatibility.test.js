import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectSearchTool, examineNormalizedSearch } from './compatibility.js';
test('0.7.4-style tool schema is recognized', () => {
  const result = inspectSearchTool([{name:'search_products', inputSchema: {
    properties: { query:{type:'string'}, chains:{type:'array'}, limit:{type:'integer'} },
    required:['query'] }}]);
  assert.equal(result.schemaCompatible, true);
});
test('unknown mandatory fields block upgrade until adapted', () => {
  const result = inspectSearchTool([{name:'search_products',inputSchema:{
    properties:{query:{},chains:{},region:{}}, required:['query','region']}}]);
  assert.equal(result.schemaCompatible,false);
  assert.match(result.issues.join(' '),/region/);
});
test('single-chain variant is detected', () => {
  assert.equal(inspectSearchTool([{name:'search_products', inputSchema: {
    properties:{q:{},chain:{}},required:['q'] }}]).schemaCompatible,false);
});
test('recognized result shapes report metadata without retailer calls', () => {
  const r = examineNormalizedSearch({byChain:{coop:[{name:'Milch',price:{current:1.95}}], migros:[]}});
  assert.equal(r.shape,'by-chain'); assert.equal(r.products,1);
  assert.deepEqual(r.priceFieldNames,['current']);
});
