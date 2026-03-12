export default async function handler(req, res) {
  const rawPath = req.query.path;
  const inboundPath = Array.isArray(rawPath)
    ? rawPath.join('/')
    : typeof rawPath === 'string'
      ? rawPath
      : '';

  const normalizedPath = inboundPath.replace(/^\/+|\/+$/g, '');
  const upstreamUrl = new URL(`https://apps.fas.usda.gov/OpenData/api/${normalizedPath}`);

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        upstreamUrl.searchParams.append(key, item);
      }
      continue;
    }

    if (value !== undefined) {
      upstreamUrl.searchParams.set(key, value);
    }
  }

  const apiKey = process.env.FAS_API_KEY?.trim();
  if (apiKey) {
    upstreamUrl.searchParams.set('apiKey', apiKey);
  }

  try {
    const usdaRes = await fetch(upstreamUrl.toString(), {
      method: req.method,
      headers: {
        Accept: req.headers.accept || 'application/json'
      }
    });

    const body = await usdaRes.text();
    const contentType = usdaRes.headers.get('content-type') || 'application/json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(usdaRes.status).send(body);
  } catch (err) {
    res.status(502).json({
      error: 'Failed to reach USDA FAS API',
      detail: err instanceof Error ? err.message : String(err)
    });
  }
}