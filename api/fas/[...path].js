export default async function handler(req, res) {
  // Reconstruct the USDA path from the catch-all segments
  const { path, ...queryParams } = req.query;
  const usdaPath = Array.isArray(path) ? path.join('/') : (path || '');

  const upstream = new URL(`https://apps.fas.usda.gov/OpenData/api/${usdaPath}`);
  Object.entries(queryParams).forEach(([k, v]) => upstream.searchParams.set(k, v));

  try {
    const usdaRes = await fetch(upstream.toString(), {
      headers: { 'Accept': 'application/json' }
    });

    const body = await usdaRes.text();

    res.setHeader('Content-Type', 'application/json');
    res.status(usdaRes.status).send(body);
  } catch (err) {
    res.status(502).json({ error: 'Upstream request failed', detail: err.message });
  }
}
