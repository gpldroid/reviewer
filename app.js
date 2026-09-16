const $ = s => document.querySelector(s);
const API_ENDPOINT = window.REVIEWER_API_ENDPOINT || '/api/pagespeed';

const normalize = value => {
  value = value.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
  try { return new URL(value).href; } catch { return null; }
};

const score = (result, name) => {
  const value = result?.categories?.[name]?.score;
  return value == null ? null : Math.round(value * 100);
};

const audit = (result, key) => {
  const item = result?.audits?.[key];
  if (!item) return '—';
  return item.displayValue ?? (item.numericValue != null ? String(item.numericValue) : item.score != null ? Math.round(item.score * 100) : '—');
};

function renderLighthouse(url, data, strategy = 'mobile') {
  const result = data?.lighthouseResult || data?.result || data;
  if (!result?.categories) throw new Error('Invalid Lighthouse response');
  const scores = [['Performance', score(result, 'performance')], ['SEO', score(result, 'seo')], ['Accessibility', score(result, 'accessibility')], ['Best Practices', score(result, 'best-practices')]];
  $('#status').textContent = 'Complete';
  $('#empty').hidden = true;
  $('#report').hidden = false;
  $('#report').innerHTML = `<div class="score-grid">${scores.map(([name, value]) => `<div class="score-card"><strong>${value ?? '—'}</strong><span>${name}</span></div>`).join('')}</div><p><b>${url}</b> · ${strategy === 'desktop' ? 'Desktop' : 'Mobile'}</p><div class="metric pass"><strong>Performance metrics</strong><span>FCP: ${audit(result,'first-contentful-paint')} · LCP: ${audit(result,'largest-contentful-paint')} · TBT: ${audit(result,'total-blocking-time')} · CLS: ${audit(result,'cumulative-layout-shift')} · Speed Index: ${audit(result,'speed-index')}</span></div><div class="metric pass"><strong>SEO checks</strong><span>Meta description: ${audit(result,'meta-description')} · Crawlable: ${audit(result,'is-crawlable')} · Canonical: ${audit(result,'canonical')} · Link text: ${audit(result,'link-text')}</span></div><div class="metric pass"><strong>Accessibility</strong><span>Image alt: ${audit(result,'image-alt')} · Language: ${audit(result,'html-has-lang')} · ARIA: ${audit(result,'aria-allowed-attr')} · Contrast: ${audit(result,'color-contrast')}</span></div><div class="metric pass"><strong>Best practices</strong><span>HTTPS: ${audit(result,'is-on-https')} · Doctype: ${audit(result,'doctype')} · Responsive images: ${audit(result,'image-size-responsive')} · Console errors: ${audit(result,'errors-in-console')}</span></div>`;
}

async function analyze(url, strategy = 'mobile') {
  const params = new URLSearchParams({ url, strategy });
  const response = await fetch(`${API_ENDPOINT}?${params}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data?.error || 'PageSpeed analysis failed');
  return data;
}

$('#analyze').onclick = async () => {
  const url = normalize($('#url').value);
  if (!url) { $('#notice').textContent = 'Please enter a valid URL.'; return; }
  $('#status').textContent = 'Analyzing';
  $('#notice').textContent = 'Analyzing with Google PageSpeed Insights…';
  try { const data = await analyze(url, 'mobile'); renderLighthouse(url, data, 'mobile'); $('#notice').textContent = 'Analysis completed successfully.'; }
  catch (error) { $('#status').textContent = 'Error'; $('#empty').hidden = true; $('#report').hidden = false; $('#report').innerHTML = `<div class="metric warn"><strong>Analysis unavailable</strong><span>${error.message}</span></div>`; $('#notice').textContent = 'Make sure the PageSpeed API key is configured in the hosting environment.'; }
};

$('#compareBtn').onclick = async () => {
  const a = normalize($('#url1').value), b = normalize($('#url2').value);
  if (!a || !b) { $('#compareResult').innerHTML = '<div class="metric warn">Enter two valid URLs.</div>'; return; }
  $('#compareResult').innerHTML = '<div class="metric">Comparing both websites…</div>';
  try { const [left, right] = await Promise.all([analyze(a, 'mobile'), analyze(b, 'mobile')]); const l = left.lighthouseResult || left; const r = right.lighthouseResult || right; $('#compareResult').innerHTML = `<div class="metric pass"><strong>PageSpeed comparison</strong><span>${a} — Performance ${score(l,'performance') ?? '—'}, SEO ${score(l,'seo') ?? '—'} · ${b} — Performance ${score(r,'performance') ?? '—'}, SEO ${score(r,'seo') ?? '—'}</span></div>`; }
  catch (error) { $('#compareResult').innerHTML = `<div class="metric warn"><strong>Comparison unavailable</strong><span>${error.message}</span></div>`; }
};

$('#theme').onclick = () => document.body.classList.toggle('dark');

const COOKIE_KEY = 'reviewer_cookie_consent';
const cookieBanner = $('#cookieBanner');
if (cookieBanner && !localStorage.getItem(COOKIE_KEY)) cookieBanner.hidden = false;
$('#cookieAccept')?.addEventListener('click', () => { localStorage.setItem(COOKIE_KEY, 'accepted'); cookieBanner.hidden = true; });
$('#cookieReject')?.addEventListener('click', () => { localStorage.setItem(COOKIE_KEY, 'rejected'); cookieBanner.hidden = true; });
