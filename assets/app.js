const $ = s => document.querySelector(s);

// Google PageSpeed Insights API configuration.
// NOTE: this static version intentionally keeps the existing key for compatibility.
// For production, move PageSpeed requests behind a server/Cloudflare Worker secret.
const PAGESPEED_API_KEY = 'AIzaSyBb_vtTMLnYeQyKzwrWM7eJQ-MQxnk1Mpw';
const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const normalize = value => {
  value = value.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
  try { return new URL(value).href; } catch { return null; }
};

const escapeHtml = value => String(value ?? '—').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const score = (result, name) => {
  const value = result?.categories?.[name]?.score;
  return value == null ? null : Math.round(value * 100);
};
const audit = (result, key) => {
  const item = result?.audits?.[key];
  if (!item) return null;
  return item.displayValue ?? (item.numericValue != null ? String(item.numericValue) : item.score != null ? Math.round(item.score * 100) + '/100' : '—');
};
const auditItem = (result, key) => result?.audits?.[key] || null;
const scoreClass = value => value == null ? 'neutral' : value >= 90 ? 'good' : value >= 50 ? 'warn' : 'bad';
const auditClass = item => {
  if (!item || item.score == null) return 'neutral';
  if (item.score >= .9) return 'good';
  if (item.score >= .5) return 'warn';
  return 'bad';
};

function metricValue(result, key) {
  const item = auditItem(result, key);
  if (!item) return '—';
  if (item.displayValue) return item.displayValue;
  if (item.numericValue != null) return String(item.numericValue);
  return '—';
}

function fieldMetric(data, name) {
  const metric = data?.loadingExperience?.metrics?.[name] || data?.originLoadingExperience?.metrics?.[name];
  if (!metric) return null;
  return metric;
}

function fieldMetricCard(data, key, label) {
  const metric = fieldMetric(data, key);
  if (!metric) return `<div class="report-metric unavailable"><strong>${escapeHtml(label)}</strong><span>Not available for this URL</span></div>`;
  const value = metric.percentile != null ? metric.percentile : metric.distributions?.[0]?.proportion != null ? 'Available' : '—';
  const category = metric.category || '';
  return `<div class="report-metric ${category === 'FAST' ? 'good' : category === 'AVERAGE' ? 'warn' : category === 'SLOW' ? 'bad' : 'neutral'}"><strong>${escapeHtml(label)}</strong><b>${escapeHtml(value)}${typeof value === 'number' && key === 'CUMULATIVE_LAYOUT_SHIFT' ? '' : ''}</b><span>${escapeHtml(category || 'Field data')}</span></div>`;
}

const knownAuditLabels = {
  'first-contentful-paint':'First Contentful Paint','largest-contentful-paint':'Largest Contentful Paint','total-blocking-time':'Total Blocking Time','cumulative-layout-shift':'Cumulative Layout Shift','speed-index':'Speed Index','interactive':'Time to Interactive','server-response-time':'Initial server response time','max-potential-fid':'Max Potential First Input Delay','render-blocking-resources':'Eliminate render-blocking resources','unused-javascript':'Reduce unused JavaScript','unused-css-rules':'Reduce unused CSS','uses-optimized-images':'Efficiently encode images','modern-image-formats':'Serve images in next-gen formats','offscreen-images':'Defer offscreen images','uses-responsive-images':'Properly size images','uses-text-compression':'Enable text compression','uses-long-cache-ttl':'Use efficient cache lifetimes','font-display':'Font display','total-byte-weight':'Total page size','network-requests':'Network requests','dom-size':'DOM size','bootup-time':'JavaScript execution time','mainthread-work-breakdown':'Main-thread work','third-party-summary':'Third-party code','meta-description':'Meta description','document-title':'Document title','is-crawlable':'Crawlable','canonical':'Canonical','robots-txt':'robots.txt','hreflang':'hreflang','link-text':'Descriptive link text','image-alt':'Image alternative text','html-has-lang':'HTML language','viewport':'Viewport','aria-allowed-attr':'Valid ARIA attributes','color-contrast':'Color contrast','label':'Form labels','is-on-https':'HTTPS','doctype':'Doctype','errors-in-console':'Console errors','no-document-write':'Avoid document.write','geolocation-on-start':'Geolocation on page load','no-vulnerable-libraries':'Vulnerable JavaScript libraries','password-inputs-can-be-pasted-into':'Paste into password inputs','uses-http2':'HTTP/2','uses-http3':'HTTP/3'};

function auditLabel(key, item) {
  return knownAuditLabels[key] || item?.title || key.replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderAuditCard(key, item) {
  const cls = auditClass(item);
  const title = auditLabel(key, item);
  const value = item?.displayValue ?? (item?.numericValue != null ? String(item.numericValue) : item?.scoreDisplayMode === 'binary' && item.score != null ? (item.score ? 'Passed' : 'Failed') : '—');
  const description = item?.description ? item.description.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim() : '';
  return `<article class="audit-card ${cls}"><div class="audit-head"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(value)}</span></div>${description ? `<p>${escapeHtml(description)}</p>` : ''}</article>`;
}

function getCategoryAudits(result, categoryName) {
  const category = result?.categories?.[categoryName];
  if (!category?.auditRefs) return [];
  return category.auditRefs.map(ref => ref.id).filter(id => result.audits?.[id]).map(id => [id, result.audits[id]]);
}

function renderFieldData(data) {
  const hasField = !!(data?.loadingExperience?.metrics && Object.keys(data.loadingExperience.metrics).length);
  const originHasField = !!(data?.originLoadingExperience?.metrics && Object.keys(data.originLoadingExperience.metrics).length);
  if (!hasField && !originHasField) return `<div class="metric neutral"><strong>Real-user field data</strong><span>No CrUX field data was returned for this URL. The lab results below are still available.</span></div>`;
  return `<div class="report-section"><div class="section-title"><h3>Core Web Vitals — real-user field data</h3><span>When available</span></div><div class="report-grid four">${fieldMetricCard(data,'LARGEST_CONTENTFUL_PAINT_MS','LCP')} ${fieldMetricCard(data,'INTERACTION_TO_NEXT_PAINT','INP')} ${fieldMetricCard(data,'CUMULATIVE_LAYOUT_SHIFT_SCORE','CLS')} ${fieldMetricCard(data,'FIRST_CONTENTFUL_PAINT_MS','FCP')}</div><p class="report-note">Field data represents real-user measurements when Chrome UX Report data is available. It is different from Lighthouse lab data.</p></div>`;
}

function renderLabMetrics(result) {
  const metrics = [
    ['first-contentful-paint','FCP'],['largest-contentful-paint','LCP'],['total-blocking-time','TBT'],['cumulative-layout-shift','CLS'],['speed-index','Speed Index'],['interactive','TTI'],['server-response-time','Server response']
  ];
  return `<div class="report-grid four">${metrics.map(([key,label]) => {
    const item = auditItem(result,key); const value = metricValue(result,key);
    return `<div class="report-metric ${auditClass(item)}"><strong>${label}</strong><b>${escapeHtml(value)}</b><span>Lab measurement</span></div>`;
  }).join('')}</div>`;
}

function renderScoreCards(result) {
  const scores = [['performance','Performance'],['accessibility','Accessibility'],['best-practices','Best Practices'],['seo','SEO']];
  return `<div class="score-grid report-scores">${scores.map(([key,label]) => { const value = score(result,key); return `<div class="score-card ${scoreClass(value)}"><strong>${value ?? '—'}</strong><span>${label}</span></div>`; }).join('')}</div>`;
}

function renderSummary(result) {
  const finalUrl = result?.finalUrl || result?.requestedUrl || '—';
  const fetchTime = result?.fetchTime ? new Date(result.fetchTime).toLocaleString() : '—';
  const environment = result?.environment?.networkUserAgent ? 'PageSpeed / Lighthouse' : 'PageSpeed Insights';
  return `<div class="report-summary"><div><strong>Analyzed URL</strong><span>${escapeHtml(finalUrl)}</span></div><div><strong>Run</strong><span>${escapeHtml(fetchTime)}</span></div><div><strong>Engine</strong><span>${escapeHtml(environment)}</span></div><div><strong>Strategy</strong><span>${escapeHtml(result?.configSettings?.formFactor || 'mobile')}</span></div></div>`;
}

function renderHighlights(result) {
  const keys = ['render-blocking-resources','unused-javascript','unused-css-rules','modern-image-formats','offscreen-images','uses-responsive-images','uses-text-compression','uses-long-cache-ttl','font-display','dom-size','bootup-time','total-byte-weight'];
  const items = keys.map(key => [key, auditItem(result,key)]).filter(([,item]) => item);
  return `<div class="audit-grid">${items.map(([key,item]) => renderAuditCard(key,item)).join('')}</div>`;
}

function renderCategorySection(result, category, title) {
  const entries = getCategoryAudits(result, category);
  if (!entries.length) return '';
  const failed = entries.filter(([,item]) => item.score != null && item.score < 1 && item.scoreDisplayMode !== 'notApplicable');
  const passed = entries.filter(([,item]) => item.score === 1).slice(0, 12);
  const relevant = [...failed, ...passed].filter((entry,index,array) => array.findIndex(x => x[0] === entry[0]) === index).slice(0, 40);
  return `<div class="report-section"><div class="section-title"><h3>${escapeHtml(title)}</h3><span>${failed.length} items needing attention</span></div><div class="audit-grid">${relevant.map(([key,item]) => renderAuditCard(key,item)).join('')}</div></div>`;
}

function renderDiagnostics(result) {
  const keys = ['diagnostics','network-requests','resource-summary','third-party-summary','mainthread-work-breakdown','bootup-time','uses-rel-preconnect','uses-rel-preload'];
  const items = keys.map(key => [key,auditItem(result,key)]).filter(([,item]) => item);
  return `<div class="audit-grid">${items.map(([key,item]) => renderAuditCard(key,item)).join('')}</div>`;
}

function renderLighthouse(url, data, strategy = 'mobile') {
  const result = data?.lighthouseResult || data?.result || data;
  if (!result?.categories || !result?.audits) throw new Error('Invalid PageSpeed/Lighthouse response.');
  $('#status').textContent = 'Complete';
  $('#empty').hidden = true;
  $('#report').hidden = false;
  $('#report').innerHTML = `
    <div class="report-toolbar"><div><strong>PageSpeed-style website report</strong><span>${strategy === 'desktop' ? 'Desktop' : 'Mobile'} analysis</span></div><button type="button" id="reportPrint">Print report</button></div>
    ${renderScoreCards(result)}
    ${renderSummary(result)}
    ${renderFieldData(data)}
    <div class="report-section"><div class="section-title"><h3>Core Web Vitals &amp; performance — Lighthouse lab data</h3><span>Simulated test environment</span></div>${renderLabMetrics(result)}</div>
    <div class="report-section"><div class="section-title"><h3>Performance opportunities &amp; diagnostics</h3><span>Based on Lighthouse audits</span></div>${renderHighlights(result)}${renderDiagnostics(result)}</div>
    ${renderCategorySection(result,'seo','SEO audit results')}
    ${renderCategorySection(result,'accessibility','Accessibility audit results')}
    ${renderCategorySection(result,'best-practices','Best practices audit results')}
    <div class="report-section"><div class="section-title"><h3>Technical details</h3><span>Returned by PageSpeed Insights</span></div><div class="metric neutral"><strong>Requested URL</strong><span>${escapeHtml(url)}</span></div><div class="metric neutral"><strong>Final URL</strong><span>${escapeHtml(result.finalUrl || url)}</span></div><div class="metric neutral"><strong>Lighthouse version</strong><span>${escapeHtml(result.lighthouseVersion || '—')}</span></div><div class="metric neutral"><strong>Analysis timestamp</strong><span>${escapeHtml(result.fetchTime || '—')}</span></div></div>`;
  $('#reportPrint')?.addEventListener('click', () => window.print());
}

async function analyze(url, strategy = 'mobile') {
  if (!PAGESPEED_API_KEY) throw new Error('PageSpeed analysis is temporarily unavailable. Please try again later.');
  const params = new URLSearchParams({ url, strategy, key: PAGESPEED_API_KEY, locale: 'en-US' });
  ['performance','seo','accessibility','best-practices'].forEach(category => params.append('category', category));
  let response;
  try {
    response = await fetch(`${PAGESPEED_API_URL}?${params.toString()}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  } catch {
    throw new Error('The PageSpeed service could not be reached. Please check your connection and try again.');
  }
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    if (response.status === 429) throw new Error('PageSpeed quota/rate limit reached. Please wait and try again.');
    if (response.status === 400) throw new Error(data?.error?.message || data?.error || 'The website URL could not be analyzed. Please check the URL and try again.');
    if (response.status === 401 || response.status === 403) throw new Error('PageSpeed authorization failed. The analysis service is temporarily unavailable.');
    throw new Error(data?.error?.message || data?.error || 'PageSpeed analysis failed. Please try again.');
  }
  return data;
}

async function runAnalysis(url, strategy = 'mobile') {
  $('#status').textContent = 'Analyzing';
  $('#empty').hidden = true;
  $('#report').hidden = false;
  $('#report').innerHTML = '<div class="metric"><strong>Analyzing website…</strong><span>Google PageSpeed Insights is running Lighthouse and collecting the available field and lab data. This can take several seconds.</span></div>';
  try {
    const data = await analyze(url, strategy);
    renderLighthouse(url, data, strategy);
    $('#notice').textContent = 'Analysis completed successfully using Google PageSpeed Insights data.';
    return data;
  } catch (error) {
    $('#status').textContent = 'Error';
    $('#report').innerHTML = `<div class="metric warn"><strong>Analysis unavailable</strong><span>${escapeHtml(error.message)}</span></div>`;
    $('#notice').textContent = 'The analysis service could not complete the request. Please try again.';
    throw error;
  }
}

$('#analyze')?.addEventListener('click', async () => {
  const url = normalize($('#url').value);
  if (!url) { $('#notice').textContent = 'Please enter a valid URL.'; $('#url').focus(); return; }
  await runAnalysis(url, 'mobile').catch(() => {});
});

$('#url')?.addEventListener('keydown', event => { if (event.key === 'Enter') $('#analyze')?.click(); });

$('#compareBtn')?.addEventListener('click', async () => {
  const a = normalize($('#url1').value), b = normalize($('#url2').value);
  if (!a || !b) { $('#compareResult').innerHTML = '<div class="metric warn"><strong>Invalid URLs</strong><span>Enter two valid website URLs.</span></div>'; return; }
  $('#compareResult').innerHTML = '<div class="metric"><strong>Comparing both websites…</strong><span>Running the same PageSpeed test for both URLs.</span></div>';
  try {
    const [left,right] = await Promise.all([analyze(a,'mobile'), analyze(b,'mobile')]);
    const l = left.lighthouseResult || left, r = right.lighthouseResult || right;
    const rows = [['Performance','performance'],['Accessibility','accessibility'],['Best Practices','best-practices'],['SEO','seo']];
    $('#compareResult').innerHTML = `<div class="compare-report"><div class="section-title"><h3>PageSpeed comparison</h3><span>Mobile lab scores</span></div><div class="comparison-grid"><div><strong>${escapeHtml(a)}</strong>${rows.map(([label,key]) => `<div class="comparison-row"><span>${label}</span><b>${score(l,key) ?? '—'}</b></div>`).join('')}</div><div><strong>${escapeHtml(b)}</strong>${rows.map(([label,key]) => `<div class="comparison-row"><span>${label}</span><b>${score(r,key) ?? '—'}</b></div>`).join('')}</div></div></div>`;
  } catch (error) {
    $('#compareResult').innerHTML = `<div class="metric warn"><strong>Comparison unavailable</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
});

const menuToggle = $('#menuToggle');
const mainNav = $('#mainNav');
const dropdowns = document.querySelectorAll('.nav-dropdown');
function closeDropdowns(except) { dropdowns.forEach(item => { if (item !== except) { item.classList.remove('open'); item.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded','false'); } }); }
function closeMenu() { mainNav?.classList.remove('open'); menuToggle?.classList.remove('open'); menuToggle?.setAttribute('aria-expanded','false'); menuToggle?.setAttribute('aria-label','Open navigation'); closeDropdowns(); }
menuToggle?.addEventListener('click', () => { const open = mainNav.classList.toggle('open'); menuToggle.classList.toggle('open', open); menuToggle.setAttribute('aria-expanded', String(open)); menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); if (!open) closeDropdowns(); });
dropdowns.forEach(dropdown => { const button = dropdown.querySelector('.dropdown-toggle'); button?.addEventListener('click', event => { event.stopPropagation(); const open = dropdown.classList.toggle('open'); button.setAttribute('aria-expanded', String(open)); closeDropdowns(open ? dropdown : null); }); });
document.addEventListener('click', event => { if (!event.target.closest('.nav')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
mainNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
const currentPath = location.pathname.replace(/\/$/, '') || '/';
mainNav?.querySelectorAll('a[data-page]').forEach(link => { const href = link.getAttribute('href'); const targetPath = href === './' || href === '/' ? '/' : new URL(href, location.href).pathname.replace(/\/$/, ''); if (targetPath === currentPath || (link.dataset.page === 'analyze' && location.hash === '#analyzer')) { link.classList.add('active'); link.setAttribute('aria-current','page'); link.closest('.nav-dropdown')?.classList.add('has-active'); } });

const themeButton = $('#theme');
const THEME_KEY = 'reviewer_theme';
if (localStorage.getItem(THEME_KEY) === 'dark') document.body.classList.add('dark');
themeButton?.addEventListener('click', () => { const dark = document.body.classList.toggle('dark'); localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); themeButton.textContent = dark ? '☀' : '◐'; themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); });
if (document.body.classList.contains('dark') && themeButton) themeButton.textContent = '☀';

const COOKIE_KEY = 'reviewer_cookie_consent';
const cookieBanner = $('#cookieBanner');
if (cookieBanner && !localStorage.getItem(COOKIE_KEY)) cookieBanner.hidden = false;
$('#cookieAccept')?.addEventListener('click', () => { localStorage.setItem(COOKIE_KEY, 'accepted'); cookieBanner.hidden = true; });
$('#cookieReject')?.addEventListener('click', () => { localStorage.setItem(COOKIE_KEY, 'rejected'); cookieBanner.hidden = true; });
