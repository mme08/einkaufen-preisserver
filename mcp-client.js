import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// Deliberately invokes the locally installed, pinned package. Never accepts
// an executable, version string or command from an HTTP caller.
function mcpRequest({ tool, input, listOnly = false, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['--no-install', '@nicktcode/swissgroceries-mcp'], {
      stdio: ['pipe', 'pipe', 'pipe'], env: process.env
    });
    let done = false;
    let stderr = '';
    const timer = setTimeout(() => finish(new Error('mcp_timeout')), timeoutMs);
    function finish(err, data) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill();
      if (err) reject(err); else resolve(data);
    }
    child.on('error', err => finish(err));
    child.on('exit', code => { if (!done) finish(new Error(`mcp_exited_${code}: ${stderr.slice(-150)}`)); });
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-1000); });
    function send(obj) { if (!done) child.stdin.write(JSON.stringify(obj) + '\n'); }
    createInterface({ input: child.stdout }).on('line', line => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg.id === 1) {
        if (msg.error) return finish(new Error('mcp_init_failed'));
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      } else if (msg.id === 2) {
        if (msg.error) return finish(new Error('mcp_tools_list_failed'));
        if (listOnly) return finish(null, msg.result?.tools ?? []);
        const schema = msg.result?.tools?.find(t => t.name === tool)?.inputSchema;
        if (!schema) return finish(new Error('mcp_search_tool_unavailable'));
        const props = schema.properties ?? {};
        const args = {};
        if ('query' in props) args.query = input.query;
        else if ('q' in props) args.q = input.query;
        else return finish(new Error('mcp_search_query_argument_unknown'));
        if ('chains' in props) args.chains = input.chains;
        else if ('chain' in props && input.chains.length === 1) args.chain = input.chains[0];
        if ('limit' in props) args.limit = input.limit;
        for (const required of schema.required ?? []) {
          if (!(required in args)) return finish(new Error(`mcp_required_argument_unsupported_${required}`));
        }
        send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: tool, arguments: args } });
      } else if (msg.id === 3) {
        if (msg.error || msg.result?.isError) return finish(new Error('mcp_search_failed'));
        finish(null, msg.result);
      }
    });
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '2025-03-26', capabilities: {},
      clientInfo: { name: 'einkaufen-preisserver', version: '0.4.1' }
    } });
  });
}
export function callMcpTool({ tool, input, timeoutMs = 30000 }) {
  return mcpRequest({ tool, input, timeoutMs });
}
export function listMcpTools({ timeoutMs = 12000 } = {}) {
  return mcpRequest({ listOnly: true, timeoutMs });
}
export function extractSearchResult(toolResult) {
  if (toolResult?.structuredContent) return toolResult.structuredContent;
  for (const block of toolResult?.content ?? []) {
    if (block.type !== 'text') continue;
    try { return JSON.parse(block.text); } catch { /* next content block */ }
  }
  throw new Error('unexpected_mcp_response');
}
