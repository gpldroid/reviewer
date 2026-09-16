const ALLOWED_STRATEGIES = new Set(['mobile', 'desktop']);
const ALLOWED_CATEGORIES = ['performance', 'seo', 'accessibility', 'best-practices'];

export async function onRequestGet({ request, env }) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get('url');
  const strategy = requestUrl.searchParams.get('strategy') || 'mobile';

  if (!target) return json({ error: 'Missing url parameter' }, 400);
  if (!ALLOWED_STRATEGIES.has(strategy)) return json({ error: 'Invalid strategy' }, 400);

  let parsed;
  try { parsed = new URL(target); } catch { return json({ error: 'Invalid URL' }, 400); }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return json({ error: 'Only HTTP and HTTPS URLs are allowed' }, 400);
  }

  const apiKey = env.PAGESPEED_API_KEY;
  if (!apiKey) return json({ error: 'PageSpeed API is not configured on the server' }, 503);

  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url', parsed.href);
  api.searchParams.set('strategy', strategy);
  api.searchParams.set('locale', 'ar');
  for (const category of ALLOWED_CATEGORIES) api.searchParams.append('category', category);
  api.searchParams.set('key', apiKey);

  try {
    const upstream = await fetch(api.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(40000)
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=180, stale-while-revalidate=60',
        'vary': 'Accept',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch (error) {
    return json({
      error: error?.name === 'TimeoutError'
        ? 'انتهت مهلة خدمة التحليل. حاول مرة أخرى.'
        : 'Unable to reach PageSpeed service'
    }, 502);
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}
