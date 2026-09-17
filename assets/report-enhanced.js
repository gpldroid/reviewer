(() => {
  const clean = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = item => item && item.score != null ? Math.round(item.score * 100) : null;
  const state = item => {
    const p = pct(item);
    if (item?.scoreDisplayMode === 'notApplicable') return ['na','Not applicable'];
    if (p == null) return ['neutral','Informational'];
    if (p >= 90) return ['good','Passed'];
    if (p >= 50) return ['warn','Needs improvement'];
    return ['bad','Needs action'];
  };
  const title = (key, item) => {
    const labels = {
      'render-blocking-resources':'Render-blocking resources','unused-javascript':'Unused JavaScript','unused-css-rules':'Unused CSS','modern-image-formats':'Modern image formats','offscreen-images':'Offscreen images','uses-responsive-images':'Responsive images','uses-text-compression':'Text compression','uses-long-cache-ttl':'Cache lifetime','font-display':'Font display','dom-size':'DOM size','bootup-time':'JavaScript execution time','total-byte-weight':'Total page weight','network-requests':'Network requests','third-party-summary':'Third-party code','mainthread-work-breakdown':'Main-thread work','meta-description':'Meta description','document-title':'Document title','is-crawlable':'Crawlability','canonical':'Canonical URL','robots-txt':'robots.txt','hreflang':'hreflang','link-text':'Descriptive link text','image-alt':'Image alt text','html-has-lang':'HTML language','viewport':'Viewport','aria-allowed-attr':'ARIA attributes','color-contrast':'Color contrast','label':'Form labels','is-on-https':'HTTPS','doctype':'HTML doctype','errors-in-console':'Console errors','no-document-write':'document.write usage','geolocation-on-start':'Geolocation on page load','no-vulnerable-libraries':'JavaScript libraries','password-inputs-can-be-pasted-into':'Password paste support','uses-http2':'HTTP/2','uses-http3':'HTTP/3'
    };
    return labels[key] || item?.title || key.replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase());
  };
  const actionFor = (key, item, category) => {
    const p = pct(item);
    if (item?.scoreDisplayMode === 'notApplicable') return 'This check does not apply to the tested page.';
    if (p === 100) return 'No action is required for this check. Keep the current implementation under review.';
    const actions = {
      'render-blocking-resources':'Reduce render-blocking CSS/JavaScript, inline only critical CSS, and defer non-critical scripts.',
      'unused-javascript':'Remove unused code, split bundles, and load JavaScript only when the feature is needed.',
      'unused-css-rules':'Remove unused CSS and split stylesheets so each page loads only what it needs.',
      'modern-image-formats':'Convert suitable images to WebP or AVIF and keep quality appropriate for the content.',
      'offscreen-images':'Lazy-load images below the initial viewport and avoid loading hidden media too early.',
      'uses-responsive-images':'Serve images close to their rendered dimensions using responsive srcset/sizes.',
      'uses-text-compression':'Enable Brotli or gzip compression for text-based resources.',
      'uses-long-cache-ttl':'Use versioned static assets and longer cache lifetimes for files that rarely change.',
      'font-display':'Use font-display: swap or another suitable strategy so text remains visible while fonts load.',
      'dom-size':'Simplify deeply nested markup and remove unnecessary elements from the DOM.',
      'bootup-time':'Reduce JavaScript work, split bundles, and defer non-essential execution.',
      'total-byte-weight':'Reduce images, scripts, styles and third-party assets to lower total transfer size.',
      'network-requests':'Reduce unnecessary requests and combine or defer resources where appropriate.',
      'third-party-summary':'Remove unnecessary third-party scripts and load essential services only when needed.',
      'mainthread-work-breakdown':'Reduce expensive JavaScript, layout and rendering work on the main thread.',
      'meta-description':'Add a unique, useful meta description that accurately summarizes the page.',
      'document-title':'Add one clear, descriptive page title that reflects the main topic.',
      'is-crawlable':'Make sure important pages are accessible to search engines and are not unintentionally blocked.',
      'canonical':'Set a correct canonical URL that points to the preferred version of the page.',
      'robots-txt':'Provide a valid robots.txt file and make sure it does not block important resources or pages.',
      'hreflang':'Use valid reciprocal hreflang annotations only when the site serves localized versions.',
      'link-text':'Replace vague link labels with descriptive anchor text that explains the destination.',
      'image-alt':'Add concise, meaningful alt text to informative images; use empty alt for decorative images.',
      'html-has-lang':'Declare the correct language on the html element.',
      'viewport':'Add a responsive viewport meta tag so mobile browsers render the page correctly.',
      'aria-allowed-attr':'Remove invalid ARIA attributes or use attributes supported by the element role.',
      'color-contrast':'Increase text/background contrast so important content remains readable.',
      'label':'Associate form controls with visible, descriptive labels.',
      'is-on-https':'Serve the page and its resources over HTTPS and avoid mixed content.',
      'doctype':'Declare a standards-mode HTML5 doctype at the start of the document.',
      'errors-in-console':'Fix JavaScript errors reported by the browser console and retest the page.',
      'no-document-write':'Replace document.write with modern DOM or asynchronous loading techniques.',
      'geolocation-on-start':'Do not request location immediately; request it only after a clear user action.',
      'no-vulnerable-libraries':'Update or replace vulnerable JavaScript dependencies and retest compatibility.'
    };
    if (actions[key]) return actions[key];
    const desc = clean(item?.description);
    if (desc) return p != null && p < 90 ? `Review this check and apply the recommended fix: ${desc}` : desc;
    return category === 'seo' ? 'Review this SEO signal and make the page clearer, crawlable and technically consistent.' : category === 'accessibility' ? 'Improve the page for keyboard, screen-reader and visual accessibility, then retest.' : category === 'best-practices' ? 'Follow the audit guidance and retest after the implementation change.' : 'Review the audit details and reduce the measured cost where possible.';
  };
  const impact = item => {
    const details = item?.details;
    if (!details) return '';
    if (details.overallSavingsMs) return `Potential saving: ${Math.round(details.overallSavingsMs)} ms`;
    if (details.overallSavingsBytes) return `Potential saving: ${Math.round(details.overallSavingsBytes / 1024)} KB`;
    if (details.items?.length) return `${details.items.length} resource(s) or finding(s) reported`;
    return '';
  };
  const circle = item => {
    const [cls, label] = state(item);
    const p = pct(item);
    const value = p == null ? '—' : p;
    return `<div class="audit-score-wrap"><div class="audit-score ${cls}" style="--score:${p == null ? 0 : p * 3.6}deg"><span>${value}</span>${p != null ? '<small>/100</small>' : ''}</div><span class="audit-state ${cls}">${esc(label)}</span></div>`;
  };
  window.renderAuditCard = function(key, item, category = 'performance') {
    const [cls] = state(item);
    const desc = clean(item?.description);
    const value = item?.displayValue || (item?.numericValue != null ? String(item.numericValue) : '');
    const impactText = impact(item);
    return `<article class="audit-card audit-card-pro ${cls}">
      <div class="audit-card-top">${circle(item)}<div class="audit-card-heading"><span class="audit-kicker">${esc(category)}</span><h4>${esc(title(key,item))}</h4>${value ? `<div class="audit-value">${esc(value)}</div>` : ''}</div></div>
      ${desc ? `<div class="audit-explanation"><strong>What was found</strong><p>${esc(desc)}</p></div>` : ''}
      ${impactText ? `<div class="audit-impact">${esc(impactText)}</div>` : ''}
      <div class="audit-fix"><strong>How to fix</strong><p>${esc(actionFor(key,item,category))}</p></div>
    </article>`;
  };
  const entries = (result, category) => (result?.categories?.[category]?.auditRefs || []).map(r => [r.id,result?.audits?.[r.id]]).filter(([,item]) => item);
  window.renderCategorySection = function(result, category, sectionTitle) {
    const all = entries(result,category);
    if (!all.length) return '';
    const failed = all.filter(([,i]) => i.scoreDisplayMode !== 'notApplicable' && i.score != null && i.score < 1);
    const passed = all.filter(([,i]) => i.score === 1).slice(0,8);
    const relevant = [...failed,...passed].filter((x,i,a) => a.findIndex(y => y[0] === x[0]) === i);
    const count = failed.length;
    return `<section class="report-section audit-section-pro"><div class="section-title"><div><h3>${esc(sectionTitle)}</h3><p class="section-subtitle">Each result is converted into a score, explanation and practical correction.</p></div><span class="section-counter ${count ? 'has-issues' : 'all-good'}">${count ? `${count} need attention` : 'No failed checks'}</span></div><div class="audit-grid audit-grid-pro">${relevant.map(([k,i]) => window.renderAuditCard(k,i,category)).join('')}</div></section>`;
  };
  window.renderHighlights = function(result) {
    const keys = ['render-blocking-resources','unused-javascript','unused-css-rules','modern-image-formats','offscreen-images','uses-responsive-images','uses-text-compression','uses-long-cache-ttl','font-display','dom-size','bootup-time','total-byte-weight'];
    const items = keys.map(k => [k,result?.audits?.[k]]).filter(([,i]) => i && (i.score == null || i.score < 1));
    if (!items.length) return `<div class="audit-empty-good"><span>✓</span><div><strong>No performance opportunity requires action</strong><p>The selected opportunity checks did not report a failing item.</p></div></div>`;
    return `<div class="audit-grid audit-grid-pro">${items.map(([k,i]) => window.renderAuditCard(k,i,'performance')).join('')}</div>`;
  };
  window.renderDiagnostics = function(result) {
    const keys = ['diagnostics','network-requests','resource-summary','third-party-summary','mainthread-work-breakdown','bootup-time','uses-rel-preconnect','uses-rel-preload'];
    const items = keys.map(k => [k,result?.audits?.[k]]).filter(([,i]) => i);
    return `<div class="audit-grid audit-grid-pro">${items.map(([k,i]) => window.renderAuditCard(k,i,'diagnostics')).join('')}</div>`;
  };
  const originalRenderLighthouse = window.renderLighthouse;
  window.renderLighthouse = function(url,data,strategy='mobile') {
    const result = data?.lighthouseResult || data?.result || data;
    if (!result?.categories || !result?.audits) return originalRenderLighthouse(url,data,strategy);
    document.querySelector('#status').textContent = 'Complete';
    document.querySelector('#empty').hidden = true;
    document.querySelector('#report').hidden = false;
    const scores = [['performance','Performance'],['accessibility','Accessibility'],['best-practices','Best Practices'],['seo','SEO']];
    const scoreCards = scores.map(([k,label]) => { const v=result.categories[k]?.score; const p=v==null?null:Math.round(v*100); const c=p==null?'neutral':p>=90?'good':p>=50?'warn':'bad'; return `<div class="score-card score-card-pro ${c}"><div class="score-ring ${c}" style="--score:${p==null?0:p*3.6}deg"><span>${p??'—'}</span><small>/100</small></div><strong>${esc(label)}</strong><span>${p==null?'Data unavailable':p>=90?'Strong result':p>=50?'Needs improvement':'Priority fixes available'}</span></div>`; }).join('');
    const lab = [['first-contentful-paint','FCP'],['largest-contentful-paint','LCP'],['total-blocking-time','TBT'],['cumulative-layout-shift','CLS'],['speed-index','Speed Index'],['interactive','TTI'],['server-response-time','Server response']];
    const labCards=lab.map(([k,l])=>{const i=result.audits[k];return i?`<div class="report-metric metric-pro ${i.score!=null&&i.score<.5?'bad':''}"><strong>${esc(l)}</strong><b>${esc(i.displayValue||'—')}</b><span>${esc(clean(i.description)||'Lighthouse lab measurement')}</span></div>`:''}).join('');
    const finalUrl=result.finalUrl||url;
    document.querySelector('#report').innerHTML=`<div class="report-toolbar"><div><strong>Professional website audit report</strong><span>${strategy==='desktop'?'Desktop':'Mobile'} · Lighthouse / PageSpeed Insights</span></div><button type="button" id="reportPrint">Print report</button></div>
      <div class="score-grid report-scores score-grid-pro">${scoreCards}</div>
      <div class="report-summary"><div><strong>Analyzed URL</strong><span>${esc(finalUrl)}</span></div><div><strong>Run</strong><span>${esc(result.fetchTime||'—')}</span></div><div><strong>Engine</strong><span>Google PageSpeed Insights</span></div><div><strong>Strategy</strong><span>${esc(result.configSettings?.formFactor||strategy)}</span></div></div>
      <section class="report-section"><div class="section-title"><div><h3>Core Web Vitals &amp; performance</h3><p class="section-subtitle">Key numbers are displayed as compact indicators so the problem can be understood before opening detailed audits.</p></div></div><div class="report-grid four">${labCards}</div></section>
      <section class="report-section"><div class="section-title"><div><h3>Performance opportunities &amp; diagnostics</h3><p class="section-subtitle">Only useful findings are emphasized, with a plain-language correction under each result.</p></div></div>${window.renderHighlights(result)}${window.renderDiagnostics(result)}</section>
      ${window.renderCategorySection(result,'seo','SEO audit results')}
      ${window.renderCategorySection(result,'accessibility','Accessibility audit results')}
      ${window.renderCategorySection(result,'best-practices','Best practices audit results')}
      <section class="report-section"><div class="section-title"><div><h3>Technical details</h3><p class="section-subtitle">Original values returned by PageSpeed Insights.</p></div></div><div class="technical-grid"><div><strong>Requested URL</strong><span>${esc(url)}</span></div><div><strong>Final URL</strong><span>${esc(finalUrl)}</span></div><div><strong>Lighthouse version</strong><span>${esc(result.lighthouseVersion||'—')}</span></div><div><strong>Timestamp</strong><span>${esc(result.fetchTime||'—')}</span></div></div></section>`;
    document.querySelector('#reportPrint')?.addEventListener('click',()=>window.print());
  };
})();
