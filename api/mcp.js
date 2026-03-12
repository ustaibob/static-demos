import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const SWAGGER_URL = 'https://apps.fas.usda.gov/opendatawebV2/assets/swagger/swagger.json';
const FAS_BASE = 'https://apps.fas.usda.gov/OpenData/api';

// Module-level cache survives warm Lambda invocations
let cachedOperations = null;
let cacheTime = 0;
const CACHE_TTL = 3_600_000;

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
      const parameters = [...pathParams, ...opParams].filter((p) => p?.name && p?.in);

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

async function getOperations() {
  const now = Date.now();
  if (cachedOperations && now - cacheTime < CACHE_TTL) return cachedOperations;

  const res = await fetch(SWAGGER_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Swagger fetch failed: ${res.status} ${res.statusText}`);

  const spec = await res.json();
  cachedOperations = parseOperations(spec);
  cacheTime = now;
  return cachedOperations;
}

function buildUrl(operation, params) {
  const apiKey = process.env.FAS_API_KEY?.trim();

  let urlPath = operation.pathTemplate.replace(/\{([^}]+)\}/g, (_, name) => {
    const val = params[name];
    if (val == null || String(val).trim() === '') throw new Error(`Missing path param: ${name}`);
    return encodeURIComponent(String(val));
  });

  urlPath = urlPath.replace(/^\/api/, '');

  const url = new URL(`${FAS_BASE}${urlPath}`);

  for (const p of operation.parameters) {
    if (p.in !== 'query') continue;
    const val = params[p.name];
    if (val != null && String(val).trim() !== '') url.searchParams.set(p.name, String(val));
  }

  if (apiKey) url.searchParams.set('apiKey', apiKey);
  return url.toString();
}

// ── Tool registration ────────────────────────────────────────────────────────

function registerTools(server, operations) {
  const operationIndex = new Map(operations.map((op) => [op.id, op]));

  server.registerTool(
    'fas_list_operations',
    {
      description: 'List all available USDA FAS API operations. Optionally filter by tag or keyword.',
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
      if (!op) return { content: [{ type: 'text', text: `Unknown operation: ${operationId}` }] };

      const paramLines = op.parameters.map((p) => {
        const type = p.type || p.schema?.type || 'string';
        const req = p.required ? ' (required)' : ' (optional)';
        const desc = p.description ? ` — ${p.description}` : '';
        return `  ${p.name}: ${type}${req} [${p.in}]${desc}`;
      });

      const text = [
        op.id,
        `  ${op.method} ${op.pathTemplate}`,
        `  ${op.summary}`,
        '',
        'Parameters:',
        paramLines.length ? paramLines.join('\n') : '  (none)',
      ].join('\n');

      return { content: [{ type: 'text', text }] };
    }
  );

  server.registerTool(
    'fas_call_operation',
    {
      description:
        'Call a USDA FAS API operation by ID. Use fas_describe_operation first to check required params.',
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
      if (!op) return { content: [{ type: 'text', text: `Unknown operation: ${operationId}` }] };

      let url;
      try {
        url = buildUrl(op, params);
      } catch (err) {
        return { content: [{ type: 'text', text: `Parameter error: ${err.message}` }] };
      }

      try {
        const res = await fetch(url, {
          method: op.method,
          headers: { Accept: 'application/json' },
        });
        const ct = res.headers.get('content-type') || '';
        const body = ct.includes('application/json') ? await res.json() : await res.text();
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
}

// ── Vercel handler ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS — allow any MCP client origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only POST is used in stateless mode
  if (req.method !== 'POST') {
    return res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Only POST is supported in stateless mode.' },
      id: null,
    });
  }

  try {
    const operations = await getOperations();

    const server = new McpServer({ name: 'fas-api', version: '1.0.0' });
    registerTools(server, operations);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — no session tracking
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[FAS MCP HTTP]', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Internal server error', data: err.message },
        id: null,
      });
    }
  }
}
