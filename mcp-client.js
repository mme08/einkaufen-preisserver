import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// Generic stdio MCP client. Does not contain or install any retailer adapter.
export function callMcpTool({ command, args = [], tool, input, timeoutMs = 25000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    let settled = false;
    let initialized = false;
    let stderr = '';
    const timer = setTimeout(() => fail(new Error('mcp_timeout')), timeoutMs);
    function finish(err, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      err ? reject(err) : resolve(result);
    }
    function fail(err) { finish(err); }
    function send(message) { if (!settled) child.stdin.write(JSON.stringify(message) + '\n'); }
    child.on('error', fail);
    child.on('exit', code => { if (!settled) fail(new Error(`mcp_exited_${code}: ${stderr.slice(-150)}`)); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-2000); });
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg.id === 1) {
        if (msg.error) return fail(new Error('mcp_initialize_failed'));
        if (initialized) return;
        initialized = true;
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: input } });
      } else if (msg.id === 2) {
        if (msg.error || msg.result?.isError) return fail(new Error('mcp_tool_failed'));
        finish(null, msg.result);
      }
    });
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'einkaufen-preisserver', version: '0.2.0' }
    } });
  });
}

export function extractSearchResult(toolResult) {
  const structured = toolResult?.structuredContent;
  if (structured?.byChain) return structured;
  for (const block of toolResult?.content ?? []) {
    if (block.type !== 'text') continue;
    try { const parsed = JSON.parse(block.text); if (parsed.byChain) return parsed; } catch { /* ignore */ }
  }
  throw new Error('unexpected_mcp_response');
}
