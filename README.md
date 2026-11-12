# static-demos

Classroom and analysis demos for foreign agriculture data, network design, and operations. `index.html` is the landing page and links to every demo page.

## Demo pages

- `index.html`: home page.
- `fas-plan-builder.html`: create, save, and launch planning baselines into the FAS dashboards.
- `fas-supply-chain-dashboard.html`: commodity outlook, country exposure, partner trade pulse, and data freshness.
- `fas-lane-companion.html`: customs district import/export exposure and timing risk by partner country.
- `usda-fas-explorer_1.html`: search USDA FAS OpenData operations, edit path and query parameters, run calls, and view the response as a table or raw JSON.
- `fas-opendata-docs.html`: Redoc reference for the FAS Open Data Services spec (ESR, GATS, and PSD).
- `network-scenario-simulator.html`: compare distribution-network designs against demand scenarios for annual cost and a 3-day delivery contract.
- `shortage-contracts.html`: classroom activity for designing information contracts across a drug-shortage supply chain.
- `ops_explorer.html`: interactive explorer for Little's Law, process analysis, Kingman's equation, EOQ, and safety stock.

## FAS API tooling

The explorer and dashboards call USDA FAS OpenData through a local proxy. The Swagger spec is `https://apps.fas.usda.gov/opendatawebV2/assets/swagger/swagger.json`.

- `fas-api-client.js`: reusable client that loads the Swagger spec, indexes operations, builds request URLs, and executes calls.
- `api/fas.js` and `api/fas/[...path].js`: proxy OpenData requests and inject `FAS_API_KEY` when it is set.
- `api/swagger.js`: cached proxy for the Swagger spec.
- `mcp-server.js`: stdio MCP server (`npm run mcp`) with `fas_list_operations`, `fas_describe_operation`, and `fas_call_operation`.
- `api/mcp.js`: the same three tools over streamable HTTP on Vercel.

## Dispatch Day

`dispatch-challenge/` is the reference engine for a delivery-route classroom simulation. Prompts never change scores; `engine.py` applies every effect.

- `engine.py`: score one plan, or enumerate the plan menu and print anchors.
- `scenario_challenge.json`, `scenario_generate.json`, `test_fixtures.json`: scenario inputs.
- `ai_prompts.md`: prompts and guardrails for scenario skin, dispatch messages, reveal narration, debrief clusters, and the optional reflection coach.

## Other

- `students_as_products.tsx`: React component that maps SCOR processes onto a talent-pipeline model. It is not a served page.

## Run locally

Serve from the repo root so relative imports and API routes resolve. `vercel.json` turns on clean URLs, so each demo is available without the `.html` suffix.

```powershell
npx vercel dev
```

Then open `http://localhost:3000/`.

| Route | Page |
| --- | --- |
| `/` | Home |
| `/fas-plan-builder` | Plan Builder |
| `/fas-supply-chain-dashboard` | Supply Chain Dashboard |
| `/fas-lane-companion` | Lane Companion |
| `/usda-fas-explorer_1` | Endpoint Explorer |
| `/fas-opendata-docs` | Open Data Docs |
| `/network-scenario-simulator` | Network Scenario Simulator |
| `/shortage-contracts` | Shortage Chain Contracts |
| `/ops_explorer` | Equation Explorer |

The stdio MCP server runs separately:

```powershell
npm run mcp
```
