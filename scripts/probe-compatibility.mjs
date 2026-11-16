#!/usr/bin/env node
// Read-only compatibility check for whichever EXACT version is installed
// in a disposable test checkout. No calls to shop APIs.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { listMcpTools } from '../mcp-client.js';
import { inspectSearchTool } from '../compatibility.js';
const require = createRequire(import.meta.url);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const requested = pkg.dependencies['@nicktcode/swissgroceries-mcp'];
const report = { generatedAt: new Date().toISOString(), configuredVersion: requested,
  installedVersion: null, schema: null, liveSearchTested: false, productionEnabled: false };
try {
  const installedPath = require.resolve('@nicktcode/swissgroceries-mcp/package.json');
  const installed = JSON.parse(await readFile(installedPath, 'utf8'));
  report.installedVersion = installed.version;
  if (installed.version !== requested) throw new Error('Installierte Version weicht von package.json ab');
  report.schema = inspectSearchTool(await listMcpTools());
} catch (error) {
  report.error = String(error?.message ?? error).slice(0, 300);
}
const dest = new URL('../compatibility-report.json', import.meta.url);
await writeFile(dest, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.error || !report.schema?.schemaCompatible) process.exitCode = 1;
