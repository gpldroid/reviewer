const $ = s => document.querySelector(s);

// Google PageSpeed Insights API configuration.
// NOTE: this static version keeps the existing key for compatibility.
// For production, move PageSpeed requests behind a server/Cloudflare Worker secret.
const PAGESPEED_API_KEY = 'AIzaSyBb_vtTMLnYeQyKzwrWM7eJQ-MQxnk1Mpw';
const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const normalize = value => { value = value.trim(); if (!value) return null; if (!/^https?:\/\//i.test(value)) value = 'https://' + value; try { return new URL(value).href; } catch { return null; } };
const score = (result, name) => { const value = result?.categories?.[name]?.score; return value == null ? null : Math.round(value * 100); };
const audit = (result, key) => { const item = result?.audits?.[key]; if (!item) return '—'; return item.displayValue ?? (item.numericValue != null ? String(item.numericValue) : item.score != null ? Math.round(item.score * 100) : '—'); };

function renderLighthouse(url, data, strategy = 'mobile') {
  const result = data?.lighthouseResult || data?.result || data;
  if (!result?.categories) throw new Error('Invalid Lighthouse response');
  const scores = [['Performance', score(result, 'performance')], ['SEO', score(result, 'seo')], ['Accessibility', score(result, 'accessibility')], ['Best Practices', score(result, 'best-practices')]];
  $('#status').textContent = 'Complete'; $('#empty').hidden = true; $('#report').hidden = false;
  $('#report').innerHTML = `<div class="score-grid">${scores.map(([name, value]) => `<div class="score-card"><strong>${value ?? '—'}</strong><span>${name}</span></div>`).join('')}</div><p><b>${url}</b> · ${strategy === 'desktop' ? 'Desktop' : 'Mobile'}</p><div class="metric pass"><strong>Performance metrics</strong><span>FCP: ${audit(result,'first-contentful-paint')} · LCP: ${audit(result,'largest-contentful-paint')} · TBT: ${audit(result,'total-blocking-time')} · CLS: ${audit(result,'cumulative-layout-shift')} · Speed Index: ${audit(result,'speed-index')}</span></div><div class="metric pass"><strong>SEO checks</strong><span>Meta description: ${audit(result,'meta-description')} · Crawlable: ${audit(result,'is-crawlable')} · Canonical: ${audit(result,'canonical')} · Link text: ${audit(result,'link-text')}</span></div><div class="metric pass"><strong>Accessibility</strong><span>Image alt: ${audit(result,'image-alt')} · Language: ${audit(result,'html-has-lang')} · ARIA: ${audit(result,'aria-allowed-attr')} · Contrast: ${audit(result,'color-contrast')}</span></div><div class="metric pass"><strong>Best practices</strong><span>HTTPS: ${audit(result,'is-on-https')} · Doctype: ${audit(result,'doctype')} · Responsive images: ${audit(result,'image-size-responsive')} · Console errors: ${audit(result,'errors-in-console')}</span></div>`;
}

async function analyze(url, strategy = 'mobile') {
  if (!PAGESPEED_API_KEY) throw new Error('PageSpeed analysis is temporarily unavailable. Please try again later.');
  const params = new URLSearchParams({ url, strategy, key: PAGESPEED_API_KEY, locale: 'en-US' });
  ['performance', 'seo', 'accessibility', 'best-practices'].forEach(category => params.append('category', category));
  let response;
  try { response = await fetch(`${PAGESPEED_API_URL}?${params.toString()}`, { headers: { Accept: 'application/json' }, cache: 'no-store' }); } catch { throw new Error('The PageSpeed service could not be reached. Please check your connection and try again.'); }
  let data = null; try { data = await response.json(); } catch {}
  if (!response.ok) {
    if (response.status === 429) throw new Error('PageSpeed quota/rate limit reached. Please wait and try again.');
    if (response.status === 400) throw new Error(data?.error?.message || data?.error || 'The website URL could not be analyzed. Please check the URL and try again.');
    if (response.status === 401 || response.status === 403) throw new Error('PageSpeed authorization failed. The analysis service is temporarily unavailable.');
    throw new Error(data?.error?.message || data?.error || 'PageSpeed analysis failed. Please try again.');
  }
  return data;
}

$('#analyze')?.addEventListener('click', async () => { const url = normalize($('#url').value); if (!url) { $('#notice').textContent = 'Please enter a valid URL.'; return; } $('#status').textContent = 'Analyzing'; $('#notice').textContent = 'Analyzing with Google PageSpeed Insights…'; try { const data = await analyze(url, 'mobile'); renderLighthouse(url, data, 'mobile'); $('#notice').textContent = 'Analysis completed successfully.'; } catch (error) { $('#status').textContent = 'Error'; $('#empty').hidden = true; $('#report').hidden = false; $('#report').innerHTML = `<div class="metric warn"><strong>Analysis unavailable</strong><span>${error.message}</span></div>`; $('#notice').textContent = 'The analysis service could not complete the request. Please try again.'; } });
$('#compareBtn')?.addEventListener('click', async () => { const a = normalize($('#url1').value), b = normalize($('#url2').value); if (!a || !b) { $('#compareResult').innerHTML = '<div class="metric warn">Enter two valid URLs.</div>'; return; } $('#compareResult').innerHTML = '<div class="metric">Comparing both websites…</div>'; try { const [left, right] = await Promise.all([analyze(a, 'mobile'), analyze(b, 'mobile')]); const l = left.lighthouseResult || left, r = right.lighthouseResult || right; $('#compareResult').innerHTML = `<div class="metric pass"><strong>PageSpeed comparison</strong><span>${a} — Performance ${score(l,'performance') ?? '—'}, SEO ${score(l,'seo') ?? '—'} · ${b} — Performance ${score(r,'performance') ?? '—'}, SEO ${score(r,'seo') ?? '—'}</span></div>`; } catch (error) { $('#compareResult').innerHTML = `<div class="metric warn"><strong>Comparison unavailable</strong><span>${error.message}</span></div>`; } });

const menuToggle = $('#menuToggle'); const mainNav = $('#mainNav'); const dropdowns = document.querySelectorAll('.nav-dropdown');
function closeDropdowns(except) { dropdowns.forEach(item => { if (item !== except) { item.classList.remove('open'); item.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded','false'); } }); }
function closeMenu() { mainNav?.classList.remove('open'); menuToggle?.classList.remove('open'); menuToggle?.setAttribute('aria-expanded','false'); menuToggle?.setAttribute('aria-label','Open navigation'); closeDropdowns(); }
menuToggle?.addEventListener('click', () => { const open = mainNav.classList.toggle('open'); menuToggle.classList.toggle('open', open); menuToggle.setAttribute('aria-expanded', String(open)); menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); if (!open) closeDropdowns(); });
dropdowns.forEach(dropdown => { const button = dropdown.querySelector('.dropdown-toggle'); button?.addEventListener('click', event => { event.stopPropagation(); const open = dropdown.classList.toggle('open'); button.setAttribute('aria-expanded', String(open)); closeDropdowns(open ? dropdown : null); }); });
document.addEventListener('click', event => { if (!event.target.closest('.nav')) closeMenu(); }); document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); }); mainNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
const currentPath = location.pathname.replace(/\/$/, '') || '/'; mainNav?.querySelectorAll('a[data-page]').forEach(link => { const href = link.getAttribute('href'); const targetPath = href === './' || href === '/' ? '/' : new URL(href, location.href).pathname.replace(/\/$/, ''); if (targetPath === currentPath || (link.dataset.page === 'analyze' && location.hash === '#analyzer')) { link.classList.add('active'); link.setAttribute('aria-current','page'); link.closest('.nav-dropdown')?.classList.add('has-active'); } });
const themeButton = $('#theme'); const THEME_KEY = 'reviewer_theme';
if (localStorage.getItem(THEME_KEY) === 'dark') document.body.classList.add('dark');
themeButton?.addEventListener('click', () => { const dark = document.body.classList.toggle('dark'); localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); themeButton.textContent = dark ? '☀' : '◐'; themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); });
if (document.body.classList.contains('dark') && themeButton) themeButton.textContent = '☀';
const COOKIE_KEY = 'reviewer_cookie_consent'; const cookieBanner = $('#cookieBanner'); if (cookieBanner && !localStorage.getItem(COOKIE_KEY)) cookieBanner.hidden = false;
$('#cookieAccept')?.addEventListener('click', () => { localStorage.setItem(COOKIE_KEY, 'accepted'); cookieBanner.hidden = true; }); $('#cookieReject')?.addEventListener('click', () => { localStorage.setItem(COOKIE_KEY, 'rejected'); cookieBanner.hidden = true; });
