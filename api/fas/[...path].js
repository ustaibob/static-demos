export default async function handler(req, res) {
  const { path, ...queryParams } = req.query;
  const inboundPath = Array.isArray(path) ? path.join('/') : (path || '');

  let upstreamPath = inboundPath;
  if (!upstreamPath) {
    upstreamPath = 'OpenData/api';
  } else if (!/^opendatawebv2\//i.test(upstreamPath) && !/^opendata\//i.test(upstreamPath)) {
    if (/^api\//i.test(upstreamPath)) {
      upstreamPath = `OpenData/${upstreamPath}`;
    } else {
      upstreamPath = `OpenData/api/${upstreamPath}`;
    }
  }

  const upstream = new URL(`https://apps.fas.usda.gov/${upstreamPath}`);
  Object.entries(queryParams).forEach(([k, v]) => upstream.searchParams.set(k, v));

  try {
    const usdaRes = await fetch(upstream.toString(), {
      headers: {
        Accept: req.headers.accept || 'application/json'
      }
    });

    const body = await usdaRes.text();
    const contentType = usdaRes.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', contentType);
    res.status(usdaRes.status).send(body);
  } catch (err) {
    res.status(502).json({ error: 'Upstream request failed', detail: err.message });
  }
}
