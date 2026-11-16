import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const base = join(process.cwd(), 'node_modules', '@nicktcode', 'swissgroceries-mcp');
const candidates = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];
const path = candidates.map(name => join(base, name)).find(existsSync);
if (!path) {
  console.error('MIT-Lizenzdatei von swissgroceries-mcp@0.7.4 nicht im Paket vorhanden. Bitte Original-Lizenz aus dem v0.7.4-Release beilegen.');
  process.exitCode = 1;
} else {
  copyFileSync(path, join(process.cwd(), 'LICENSE.swissgroceries-mcp'));
  console.log('Original-MIT-Lizenz von swissgroceries-mcp@0.7.4 kopiert.');
}
