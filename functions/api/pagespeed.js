const ALLOWED_STRATEGIES = new Set(['mobile', 'desktop']);
const ALLOWED_CATEGORIES = ['performance', 'seo', 'accessibility', 'best-practices'];
const GITHUB_PAGES_ORIGIN = 'https://gpldroid.github.io';

export async function onRequest({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  const corsOrigin = isAllowedOrigin(origin) ? origin : '';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(corsOrigin) });
  }
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, corsOrigin, { Allow: 'GET, OPTIONS' });
  }

  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get('url');
  const strategy = (requestUrl.searchParams.get('strategy') || 'mobile').toLowerCase();

  if (!target) return json({ error: 'Missing url parameter' }, 400, corsOrigin);
  if (!ALLOWED_STRATEGIES.has(strategy)) return json({ error: 'Invalid strategy. Use mobile or desktop.' }, 400, corsOrigin);

  let parsed;
  try { parsed = new URL(target); } catch { return json({ error: 'Invalid URL' }, 400, corsOrigin); }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return json({ error: 'Only HTTP and HTTPS URLs are allowed' }, 400, corsOrigin);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isPrivateHostname(hostname)) {
    return json({ error: 'Private or local URLs are not allowed' }, 400, corsOrigin);
  }

  const apiKey = env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return json({ error: 'PageSpeed API is not configured on the server. Add PAGESPEED_API_KEY to the hosting environment.' }, 503, corsOrigin);
  }

  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url', parsed.href);
  api.searchParams.set('strategy', strategy);
  api.searchParams.set('locale', 'en-US');
  for (const category of ALLOWED_CATEGORIES) api.searchParams.append('category', category);
  api.searchParams.set('key', apiKey);

  try {
    const upstream = await fetch(api.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'Reviewer-SEO-Tools/1.0' },
      signal: AbortSignal.timeout(55000)
    });
    const body = await upstream.text();
    let payload;
    try { payload = JSON.parse(body); } catch { payload = { error: 'Invalid response received from Google PageSpeed Insights.' }; }

    if (!upstream.ok) {
      const message = payload?.error?.message || payload?.error || `PageSpeed request failed (${upstream.status})`;
      return json({ error: message, status: upstream.status, source: 'google-pagespeed' }, upstream.status, corsOrigin);
    }

    return json(payload, 200, corsOrigin, {
      'cache-control': 'public, max-age=60, s-maxage=180, stale-while-revalidate=60'
    });
  } catch (error) {
    return json({
      error: error?.name === 'TimeoutError'
        ? 'The PageSpeed analysis timed out. Try again or use a faster public URL.'
        : 'Unable to reach Google PageSpeed Insights. Please try again.'
    }, 502, corsOrigin);
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === GITHUB_PAGES_ORIGIN) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.pages.dev');
  } catch {
    return false;
  }
}

function isPrivateHostname(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname === '::1'
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function corsHeaders(origin) {
  const headers = {
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Accept, Content-Type',
    'access-control-max-age': '86400',
    'x-content-type-options': 'nosniff',
    'vary': 'Origin'
  };
  if (origin) headers['access-control-allow-origin'] = origin;
  return headers;
}

function json(data, status = 200, origin = '', extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin), ...extra }
  });
}
