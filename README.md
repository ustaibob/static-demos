# static-demos

## USDA FAS OpenData Explorer

This workspace now includes a complete Swagger-driven client and API explorer for:

`https://apps.fas.usda.gov/opendatawebV2/assets/swagger/swagger.json`

### Files

- `fas-api-client.js`: reusable API client that loads the Swagger spec, indexes all operations, builds request URLs, and executes calls.
- `usda-fas-explorer_1.html`: endpoint explorer UI that lets you search operations, edit path/query parameters, run calls, and view response data as a table or raw JSON.
- `index.html`: root landing page that links to all dashboards and tools.
- `fas-supply-chain-dashboard.html`: manager-focused dashboard for commodity outlook, country exposure, partner trade pulse, and data freshness signals.
- `fas-lane-companion.html`: companion lane dashboard for customs district import/export exposure and timing risk by partner country.
- `fas-plan-builder.html`: create, save, and launch planning baselines into dashboards.
- `api/fas/[...path].js`: proxy route for both OpenData API paths and Swagger asset paths.

### Run locally

Serve from the repo root with any static server so relative imports and API routes resolve correctly.

Example:

```powershell
npx vercel dev
```

Then open:

`http://localhost:3000/usda-fas-explorer_1.html`

Root home page:

`http://localhost:3000/`

Plan builder route:

`http://localhost:3000/fas-plan-builder`

Manager dashboard route:

`http://localhost:3000/fas-supply-chain-dashboard`

Lane companion route:

`http://localhost:3000/fas-lane-companion`
