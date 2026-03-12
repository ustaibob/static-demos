import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const SWAGGER_URL = 'https://apps.fas.usda.gov/opendatawebV2/assets/swagger/swagger.json';
const FAS_BASE = 'https://apps.fas.usda.gov/OpenData/api';

// ── Swagger helpers ──────────────────────────────────────────────────────────

function parseOperations(spec) {
  if (!spec?.paths) return [];

  const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];
  const ops = [];

  for (const [pathTemplate, pathConfig] of Object.entries(spec.paths)) {
    const pathParams = Array.isArray(pathConfig.parameters) ? pathConfig.parameters : [];

    for (const method of httpMethods) {
      if (!pathConfig[method]) continue;

      const opConfig = pathConfig[method];
      const opParams = Array.isArray(opConfig.parameters) ? opConfig.parameters : [];
      const parameters = [...pathParams, ...opParams].filter(
        (p) => p && p.name && p.in
      );

      ops.push({
        id: opConfig.operationId || `${method.toUpperCase()} ${pathTemplate}`,
        method: method.toUpperCase(),
        pathTemplate,
        summary: opConfig.summary || '',
        tags: Array.isArray(opConfig.tags) ? opConfig.tags : [],
        parameters,
      });
    }
  }

  return ops;
}

function buildUrl(operation, params) {
  const apiKey = process.env.FAS_API_KEY?.trim();

  let urlPath = operation.pathTemplate.replace(/\{([^}]+)\}/g, (_, name) => {
    const val = params[name];
    if (val == null || String(val).trim() === '') throw new Error(`Missing path param: ${name}`);
    return encodeURIComponent(String(val));
  });

  // Strip leading /api prefix if present (FAS_BASE already ends without it)
  urlPath = urlPath.replace(/^\/api/, '');

  const url = new URL(`${FAS_BASE}${urlPath}`);

  for (const p of operation.parameters) {
    if (p.in !== 'query') continue;
    const val = params[p.name];
    if (val != null && String(val).trim() !== '') {
      url.searchParams.set(p.name, String(val));
    }
  }

  if (apiKey) url.searchParams.set('apiKey', apiKey);

  return url.toString();
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function loadSpec() {
  const res = await fetch(SWAGGER_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Swagger fetch failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  console.error('[FAS MCP] Loading Swagger spec…');
  const spec = await loadSpec();
  const operations = parseOperations(spec);
  const operationIndex = new Map(operations.map((op) => [op.id, op]));
  console.error(`[FAS MCP] Loaded ${operations.length} operations`);

  const server = new McpServer({ name: 'fas-api', version: '1.0.0' });

  // ── Tool: list operations ────────────────────────────────────────────────
  server.registerTool(
    'fas_list_operations',
    {
      description:
        'List all available USDA FAS API operations. Optionally filter by tag or keyword.',
      inputSchema: {
        tag: z.string().optional().describe('Filter by tag (e.g. "esr", "gats")'),
        search: z.string().optional().describe('Keyword search across operation IDs and summaries'),
      },
    },
    async ({ tag, search }) => {
      let results = operations;

      if (tag) {
        const t = tag.toLowerCase();
        results = results.filter((op) => op.tags.some((tg) => tg.toLowerCase().includes(t)));
      }

      if (search) {
        const s = search.toLowerCase();
        results = results.filter(
          (op) =>
            op.id.toLowerCase().includes(s) ||
            op.summary.toLowerCase().includes(s) ||
            op.pathTemplate.toLowerCase().includes(s)
        );
      }

      const lines = results.map(
        (op) =>
          `${op.id}\n  ${op.method} ${op.pathTemplate}\n  ${op.summary}` +
          (op.tags.length ? `\n  tags: ${op.tags.join(', ')}` : '')
      );

      return {
        content: [
          {
            type: 'text',
            text: results.length
              ? `${results.length} operation(s):\n\n${lines.join('\n\n')}`
              : 'No operations matched.',
          },
        ],
      };
    }
  );

  // ── Tool: describe operation ─────────────────────────────────────────────
  server.registerTool(
    'fas_describe_operation',
    {
      description: 'Get full parameter details for a specific FAS API operation.',
      inputSchema: {
        operationId: z.string().describe('The operation ID from fas_list_operations'),
      },
    },
    async ({ operationId }) => {
      const op = operationIndex.get(operationId);
      if (!op) {
        return { content: [{ type: 'text', text: `Unknown operation: ${operationId}` }] };
      }

      const paramLines = op.parameters.map((p) => {
        const req = p.required ? ' (required)' : ' (optional)';
        const loc = ` [${p.in}]`;
        const desc = p.description ? ` — ${p.description}` : '';
        const type = p.type || p.schema?.type || 'string';
        return `  ${p.name}: ${type}${req}${loc}${desc}`;
      });

      const text = [
        `${op.id}`,
        `  ${op.method} ${op.pathTemplate}`,
        `  ${op.summary}`,
        '',
        'Parameters:',
        paramLines.length ? paramLines.join('\n') : '  (none)',
      ].join('\n');

      return { content: [{ type: 'text', text }] };
    }
  );

  // ── Tool: call operation ─────────────────────────────────────────────────
  server.registerTool(
    'fas_call_operation',
    {
      description:
        'Call a USDA FAS API operation by its ID with the given parameters. Use fas_describe_operation first to see required params.',
      inputSchema: {
        operationId: z.string().describe('Operation ID from fas_list_operations'),
        params: z
          .record(z.string())
          .optional()
          .describe('Key/value pairs for path and query parameters'),
      },
    },
    async ({ operationId, params = {} }) => {
      const op = operationIndex.get(operationId);
      if (!op) {
        return { content: [{ type: 'text', text: `Unknown operation: ${operationId}` }] };
      }

      let url;
      try {
        url = buildUrl(op, params);
      } catch (err) {
        return { content: [{ type: 'text', text: `Parameter error: ${err.message}` }] };
      }

      console.error(`[FAS MCP] ${op.method} ${url}`);

      try {
        const res = await fetch(url, {
          method: op.method,
          headers: { Accept: 'application/json' },
        });

        const contentType = res.headers.get('content-type') || '';
        const body = contentType.includes('application/json') ? await res.json() : await res.text();
        const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2);

        return {
          content: [
            {
              type: 'text',
              text: res.ok ? text : `Error ${res.status} ${res.statusText}:\n${text}`,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: `Request failed: ${err.message}` }] };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[FAS MCP] Server ready');
}

main().catch((err) => {
  console.error('[FAS MCP] Fatal:', err);
  process.exit(1);
});
