/* Reviewer Meta Suggestions
 * Creates practical, copy-ready title and meta-description suggestions from the target HTML.
 * No AI/API call is required: suggestions are generated locally in the browser.
 */
(() => {
  const $ = s => document.querySelector(s);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => {
    value = String(value || '').trim();
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
    try { return new URL(value).href; } catch { return null; }
  };
  const clean = value => String(value || '').replace(/\s+/g, ' ').replace(/[|•]+/g, ' ').trim();
  const unique = items => [...new Set(items.map(clean).filter(Boolean))];

  function words(text) {
    return clean(text).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(w => w.length >= 4);
  }

  function inferKeyword(doc, title, h1) {
    const stop = new Set(['about','with','from','this','that','your','website','home','page','free','best','guide','online','official','using','into','what','when','where','will','have','more','than','the','and','for','with','على','من','هذا','هذه','إلى','عن','في','من','و','مع']);
    const source = `${h1} ${title} ${[...doc.querySelectorAll('h2,h3')].map(x => x.textContent).join(' ')}`;
    const counts = new Map();
    words(source).forEach(w => { if (!stop.has(w)) counts.set(w, (counts.get(w) || 0) + 1); });
    return [...counts.entries()].sort((a,b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] || '';
  }

  function shorten(text, max) {
    text = clean(text);
    if (text.length <= max) return text;
    const cut = text.slice(0, max + 1).replace(/\s+\S*$/, '').trim();
    return cut || text.slice(0, max).trim();
  }

  function makeTitle(title, h1, keyword, siteName) {
    const topic = clean(keyword || h1 || title || 'Website');
    const base = clean(h1 || title || topic);
    const variants = [
      base,
      `${topic} | ${shorten(base, 42)}`,
      `${shorten(base, 48)} — ${shorten(topic, 18)}`
    ];
    if (siteName) variants.push(`${shorten(base, 40)} | ${shorten(siteName, 16)}`);
    const usable = variants.map(x => clean(x)).filter(x => x.length >= 20 && x.length <= 60);
    return usable[0] || shorten(variants[1] || variants[0], 60);
  }

  function makeDescription(description, title, h1, keyword, siteName, bodyText) {
    const topic = clean(keyword || h1 || title || 'this page');
    const source = clean(description) || clean(bodyText);
    const sentence = source ? source : `${topic}${siteName ? ` on ${siteName}` : ''}. Learn the key information, features and practical details on this page.`;
    let result = sentence;
    if (!result.toLowerCase().includes(topic.toLowerCase())) result = `${topic}: ${result}`;
    result = result.replace(/\s+/g, ' ').trim();
    if (result.length < 110) result += ` Discover the main information and useful details in one place.`;
    return shorten(result, 158);
  }

  function evaluateSuggestion(title, description) {
    const t = [...title].length, d = [...description].length;
    return { titleLength:t, descriptionLength:d, titleOk:t >= 30 && t <= 60, descriptionOk:d >= 70 && d <= 160 };
  }

  async function fetchPage(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { mode:'cors', redirect:'follow', cache:'no-store', signal:controller.signal, headers:{Accept:'text/html,application/xhtml+xml'} });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      return new DOMParser().parseFromString(html, 'text/html');
    } finally { clearTimeout(timer); }
  }

  function card(label, value, type) {
    const metric = type === 'title' ? [...value].length : [...value].length;
    return `<div class="meta-suggestion-card"><div class="meta-suggestion-head"><strong>${escapeHtml(label)}</strong><span>${metric} chars</span></div><textarea readonly data-suggest-text>${escapeHtml(value)}</textarea><button type="button" class="meta-copy" data-copy-meta="${escapeHtml(value)}">Copy</button></div>`;
  }

  function render(data) {
    const target = document.getElementById('metaSuggestionReport');
    if (!target) return;
    const check = evaluateSuggestion(data.title, data.description);
    target.innerHTML = `<div class="meta-suggestion-grid">${card('Suggested SEO title', data.title, 'title')}${card('Suggested meta description', data.description, 'description')}</div><div class="meta-suggestion-notes"><p><strong>Target keyword:</strong> ${escapeHtml(data.keyword || 'Inferred from page headings/title')}</p><p><strong>How to use:</strong> Review the suggestions against the actual page content, then copy only text that accurately describes the visible page. Google may rewrite search-result titles or snippets.</p><div class="meta-suggestion-status"><span class="${check.titleOk ? 'good' : 'bad'}">Title: ${check.titleLength} characters</span><span class="${check.descriptionOk ? 'good' : 'bad'}">Description: ${check.descriptionLength} characters</span></div></div>`;
  }

  async function run() {
    const url = normalize($('#url')?.value);
    if (!url) return;
    const host = document.getElementById('metaSuggestionReport');
    if (!host) return;
    host.innerHTML = '<div class="metric"><strong>Generating suggestions…</strong><span>Reading the page title, headings and available description locally in your browser.</span></div>';
    try {
      const doc = await fetchPage(url);
      const title = clean(doc.querySelector('title')?.textContent);
      const description = clean(doc.querySelector('meta[name="description"]')?.getAttribute('content'));
      const h1 = clean(doc.querySelector('h1')?.textContent);
      const headings = [...doc.querySelectorAll('h2,h3')].map(x => clean(x.textContent)).filter(Boolean).slice(0, 8);
      const siteName = clean(doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')) || clean(doc.querySelector('meta[name="application-name"]')?.getAttribute('content'));
      const bodyText = clean(doc.body?.textContent).slice(0, 1200);
      const keywordInput = clean($('#seoKeyword')?.value);
      const keyword = keywordInput || inferKeyword(doc, title, h1);
      render({ keyword, title:makeTitle(title,h1,keyword,siteName), description:makeDescription(description,title,h1,keyword,siteName,bodyText), headings });
    } catch (error) {
      host.innerHTML = `<div class="metric warn"><strong>Suggestions could not be generated.</strong><span>Browser cross-origin restrictions prevented reading this page. A same-origin/Cloudflare Worker proxy is required for reliable extraction from sites that do not allow CORS.</span></div>`;
      console.info('Meta suggestions:', error?.message || error);
    }
  }

  function addSection() {
    const report = document.getElementById('report');
    if (!report || document.getElementById('metaSuggestions')) return;
    report.insertAdjacentHTML('beforeend', `<div id="metaSuggestions" class="meta-suggestion-section report-section"><div class="section-title"><div><h3>SEO Meta Title &amp; Description Generator</h3><span>Copy-ready suggestions based on the analyzed page</span></div></div><div class="meta-keyword-row"><label for="seoKeyword">Target keyword <small>(optional)</small></label><input id="seoKeyword" type="text" placeholder="e.g. website SEO analyzer"><button type="button" id="generateMetaSuggestions">Generate suggestions</button></div><div id="metaSuggestionReport"><div class="report-note">Enter an optional target keyword, then generate optimized title and description suggestions.</div></div></div>`);
  }

  document.addEventListener('click', event => {
    if (event.target?.id === 'analyze') setTimeout(addSection, 700);
    if (event.target?.id === 'generateMetaSuggestions') run();
    const copy = event.target?.closest('[data-copy-meta]');
    if (copy) {
      const value = copy.getAttribute('data-copy-meta') || '';
      navigator.clipboard?.writeText(value).then(() => { const old = copy.textContent; copy.textContent = 'Copied'; setTimeout(() => copy.textContent = old, 1200); }).catch(() => {});
    }
  });
})();
