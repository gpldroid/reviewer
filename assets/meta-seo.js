/* Reviewer Meta SEO Analyzer
 * Extracts the target page's <head> metadata when the target permits browser CORS,
 * then evaluates the signals against practical Google Search SEO guidance.
 */
(() => {
  const $ = s => document.querySelector(s);
  const escapeHtml = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => {
    value = String(value || '').trim();
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
    try { return new URL(value).href; } catch { return null; }
  };
  const text = value => String(value || '').replace(/\s+/g, ' ').trim();
  const getMeta = (doc, selector) => doc.querySelector(selector)?.getAttribute('content') || '';
  const getLink = (doc, selector) => doc.querySelector(selector)?.getAttribute('href') || '';
  const all = (doc, selector) => [...doc.querySelectorAll(selector)];

  function collect(doc, url) {
    const metas = all(doc, 'meta').map(el => ({
      name: el.getAttribute('name') || '',
      property: el.getAttribute('property') || '',
      httpEquiv: el.getAttribute('http-equiv') || '',
      charset: el.getAttribute('charset') || '',
      content: el.getAttribute('content') || ''
    }));
    const links = all(doc, 'link').map(el => ({
      rel: el.getAttribute('rel') || '', href: el.getAttribute('href') || '', hreflang: el.getAttribute('hreflang') || '', type: el.getAttribute('type') || ''
    }));
    const title = text(doc.querySelector('title')?.textContent);
    const description = getMeta(doc, 'meta[name="description"]');
    const robots = getMeta(doc, 'meta[name="robots"]');
    const canonical = getLink(doc, 'link[rel="canonical"]');
    const viewport = getMeta(doc, 'meta[name="viewport"]');
    const lang = doc.documentElement?.getAttribute('lang') || '';
    const charset = doc.querySelector('meta[charset]')?.getAttribute('charset') || getMeta(doc, 'meta[http-equiv="Content-Type"]');
    const author = getMeta(doc, 'meta[name="author"]');
    const keywords = getMeta(doc, 'meta[name="keywords"]');
    const themeColor = getMeta(doc, 'meta[name="theme-color"]');
    const og = {
      title: getMeta(doc, 'meta[property="og:title"]'), description: getMeta(doc, 'meta[property="og:description"]'),
      type: getMeta(doc, 'meta[property="og:type"]'), url: getMeta(doc, 'meta[property="og:url"]'), image: getMeta(doc, 'meta[property="og:image"]'),
      siteName: getMeta(doc, 'meta[property="og:site_name"]'), locale: getMeta(doc, 'meta[property="og:locale"]')
    };
    const twitter = {
      card: getMeta(doc, 'meta[name="twitter:card"]'), title: getMeta(doc, 'meta[name="twitter:title"]'), description: getMeta(doc, 'meta[name="twitter:description"]'),
      image: getMeta(doc, 'meta[name="twitter:image"]'), site: getMeta(doc, 'meta[name="twitter:site"]')
    };
    const hreflang = links.filter(x => x.rel.toLowerCase().split(/\s+/).includes('alternate') && x.hreflang);
    const jsonLd = all(doc, 'script[type="application/ld+json"]').map(el => text(el.textContent)).filter(Boolean);
    const icons = links.filter(x => /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/i.test(x.rel));
    return { url, title, description, robots, canonical, viewport, lang, charset, author, keywords, themeColor, og, twitter, hreflang, jsonLd, icons, metas, links };
  }

  function status(ok, label) { return `<span class="meta-status ${ok ? 'good' : 'bad'}">${ok ? 'Pass' : 'Fix'}</span><span>${escapeHtml(label)}</span>`; }
  function rule(item, title, why, fix) {
    return `<article class="meta-rule ${item.ok ? 'good' : 'bad'}"><div class="meta-rule-head">${status(item.ok, title)}</div><p><strong>Current:</strong> ${escapeHtml(item.current || 'Missing')}</p><p><strong>Why:</strong> ${escapeHtml(why)}</p>${!item.ok ? `<p><strong>How to fix:</strong> ${escapeHtml(fix)}</p>` : ''}</article>`;
  }
  function evaluate(m) {
    const titleLen = [...m.title].length;
    const descLen = [...m.description].length;
    const canonicalUrl = m.canonical ? new URL(m.canonical, m.url).href : '';
    const target = new URL(m.url);
    const canonicalSameOrigin = canonicalUrl && new URL(canonicalUrl).origin === target.origin;
    const robotsNoindex = /(^|[,\s])noindex([,\s]|$)/i.test(m.robots);
    const checks = [
      { key:'title', ok: titleLen >= 30 && titleLen <= 60, current: m.title ? `${titleLen} characters — ${m.title}` : '', title:'Title', why:'The title is a primary search-result signal and should be concise, descriptive and unique.', fix:'Write a unique, descriptive title. As a practical target, keep it around 30–60 characters and put the main topic near the beginning.' },
      { key:'description', ok: descLen >= 70 && descLen <= 160, current: m.description ? `${descLen} characters — ${m.description}` : '', title:'Meta description', why:'A useful description can help searchers understand the page and can influence the search snippet.', fix:'Add a unique, useful description of roughly 70–160 characters that accurately summarizes the page; avoid keyword stuffing.' },
      { key:'canonical', ok: !!m.canonical && canonicalSameOrigin, current:m.canonical, title:'Canonical URL', why:'A clear canonical helps consolidate duplicate URL signals. Google treats canonicalization as a hint, not an absolute command.', fix:'Add one absolute rel="canonical" URL that points to the preferred version of this page. Keep protocol/host/path consistent and avoid conflicting canonicals.' },
      { key:'robots', ok: !robotsNoindex, current:m.robots, title:'Robots meta', why:'A noindex directive prevents the page from being indexed when Google respects it.', fix:'If this page should appear in search, remove noindex and use index,follow or omit the robots meta unless a specific directive is needed.' },
      { key:'viewport', ok:/width\s*=\s*device-width/i.test(m.viewport), current:m.viewport, title:'Viewport', why:'A mobile viewport supports responsive rendering and mobile usability.', fix:'Use <meta name="viewport" content="width=device-width, initial-scale=1">.' },
      { key:'language', ok:!!m.lang, current:m.lang, title:'HTML language', why:'The lang attribute helps user agents and accessibility technologies identify the document language.', fix:'Set the correct language on the root element, for example <html lang="en"> or <html lang="ar" dir="rtl">.' },
      { key:'charset', ok:/utf-?8/i.test(m.charset), current:m.charset, title:'Character encoding', why:'UTF-8 prevents many text-encoding problems and is the normal web standard.', fix:'Declare UTF-8 near the beginning of <head> with <meta charset="utf-8">.' },
      { key:'ogTitle', ok:!!m.og.title, current:m.og.title, title:'Open Graph title', why:'og:title provides a clear title when the page is shared on compatible platforms.', fix:'Add <meta property="og:title" content="..."> using a concise version of the page title.' },
      { key:'ogDescription', ok:!!m.og.description, current:m.og.description, title:'Open Graph description', why:'og:description controls the description used by many social previews.', fix:'Add <meta property="og:description" content="..."> with a concise, accurate summary.' },
      { key:'ogImage', ok:!!m.og.image, current:m.og.image, title:'Open Graph image', why:'An explicit social image improves link-preview consistency.', fix:'Add an absolute og:image URL to a representative image and make sure it is publicly reachable.' },
      { key:'twitterCard', ok:!!m.twitter.card, current:m.twitter.card, title:'Twitter/X card', why:'A twitter:card declaration gives supported clients an explicit preview format.', fix:'Add <meta name="twitter:card" content="summary_large_image"> when a large preview image is available.' },
      { key:'jsonLd', ok:m.jsonLd.length > 0, current:m.jsonLd.length ? `${m.jsonLd.length} JSON-LD block(s)` : '', title:'Structured data', why:'Structured data can help Google understand page entities and may enable eligible rich-result features when the markup and page meet requirements.', fix:'Add valid JSON-LD that accurately describes the visible page content. Choose a Schema.org type supported by Google when a rich result is relevant.' },
      { key:'favicon', ok:m.icons.length > 0, current:m.icons[0]?.href || '', title:'Favicon', why:'A favicon helps identify the site in browser and search interfaces where supported.', fix:'Add a valid rel="icon" link to a crawlable 1:1 favicon image.' },
      { key:'hreflang', ok:m.hreflang.length === 0 || m.hreflang.every(x => x.href), current:m.hreflang.map(x => `${x.hreflang}: ${x.href}`).join(' | '), title:'hreflang', why:'hreflang is useful for genuine localized or regional versions of substantially equivalent pages.', fix:'If localized versions exist, add reciprocal alternate links with valid language/region codes and matching URLs. If there are no variants, hreflang is not required.' }
    ];
    const passed = checks.filter(x => x.ok).length;
    return { checks, passed, total:checks.length, score:Math.round(passed / checks.length * 100) };
  }

  function renderMeta(m, evaluation, sourceLabel) {
    const rows = [
      ['Title', m.title], ['Meta description', m.description], ['Robots', m.robots], ['Canonical', m.canonical], ['Viewport', m.viewport],
      ['Language', m.lang], ['Charset', m.charset], ['Author', m.author], ['Keywords', m.keywords], ['Theme color', m.themeColor],
      ['OG title', m.og.title], ['OG description', m.og.description], ['OG type', m.og.type], ['OG URL', m.og.url], ['OG image', m.og.image], ['OG site name', m.og.siteName],
      ['Twitter card', m.twitter.card], ['Twitter title', m.twitter.title], ['Twitter description', m.twitter.description], ['Twitter image', m.twitter.image], ['Twitter site', m.twitter.site]
    ];
    const table = rows.map(([name,value]) => `<tr><th>${escapeHtml(name)}</th><td>${value ? escapeHtml(value) : '<span class="meta-missing">Missing</span>'}</td></tr>`).join('');
    const linkRows = m.links.filter(x => x.rel || x.href).map(x => `<tr><th>${escapeHtml(x.rel || 'link')}</th><td>${escapeHtml(x.hreflang ? `${x.hreflang} — ` : '')}${escapeHtml(x.href || '—')}</td></tr>`).join('');
    const rawMetaRows = m.metas.map(x => `<tr><th>${escapeHtml(x.name || x.property || x.httpEquiv || (x.charset ? 'charset' : 'meta'))}</th><td>${escapeHtml(x.content || x.charset || '—')}</td></tr>`).join('');
    return `<div id="metaSeoReport" class="meta-seo-section report-section"><div class="section-title"><div><h3>Complete Meta SEO Analysis</h3><span>${escapeHtml(sourceLabel)}</span></div><strong class="meta-score ${evaluation.score >= 90 ? 'good' : evaluation.score >= 70 ? 'warn' : 'bad'}">${evaluation.score}/100</strong></div><div class="meta-overview"><div><strong>${evaluation.passed}/${evaluation.total}</strong><span>SEO meta checks passed</span></div><div><strong>${m.metas.length}</strong><span>meta tags found</span></div><div><strong>${m.links.length}</strong><span>link elements found</span></div><div><strong>${m.jsonLd.length}</strong><span>JSON-LD blocks</span></div></div><div class="meta-table-wrap"><h4>Extracted page metadata</h4><table class="meta-table"><tbody>${table}</tbody></table></div><div class="meta-table-wrap"><h4>All link elements</h4><table class="meta-table"><tbody>${linkRows || '<tr><td>No link elements found.</td></tr>'}</tbody></table></div><div class="meta-table-wrap"><h4>All meta tags</h4><table class="meta-table"><tbody>${rawMetaRows || '<tr><td>No meta tags found.</td></tr>'}</tbody></table></div><div class="meta-rules"><h4>SEO compliance &amp; fixes</h4>${evaluation.checks.map(x => rule(x, x.title, x.why, x.fix)).join('')}</div>${m.hreflang.length ? `<div class="meta-table-wrap"><h4>hreflang annotations</h4><table class="meta-table"><tbody>${m.hreflang.map(x => `<tr><th>${escapeHtml(x.hreflang)}</th><td>${escapeHtml(x.href)}</td></tr>`).join('')}</tbody></table></div>` : ''}${m.jsonLd.length ? `<div class="meta-table-wrap"><h4>JSON-LD structured data</h4>${m.jsonLd.map(x => `<pre class="meta-code">${escapeHtml(x)}</pre>`).join('')}</div>` : ''}</div>`;
  }

  function insert(html) {
    const report = $('#report');
    if (!report) return;
    document.getElementById('metaSeoReport')?.remove();
    report.insertAdjacentHTML('beforeend', html);
  }

  async function extract(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { mode:'cors', redirect:'follow', cache:'no-store', signal:controller.signal, headers:{Accept:'text/html,application/xhtml+xml'} });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return collect(doc, url);
    } finally { clearTimeout(timer); }
  }

  function loading() { insert('<div id="metaSeoReport" class="meta-seo-section report-section"><div class="section-title"><div><h3>Complete Meta SEO Analysis</h3><span>Extracting page head…</span></div></div><div class="metric"><strong>Reading metadata</strong><span>Collecting title, description, robots, canonical, Open Graph, Twitter, hreflang, favicon and structured data.</span></div></div>'); }
  function failure(url) {
    insert(`<div id="metaSeoReport" class="meta-seo-section report-section"><div class="section-title"><div><h3>Complete Meta SEO Analysis</h3><span>Browser extraction unavailable</span></div></div><div class="metric warn"><strong>Full HTML metadata could not be fetched from this website.</strong><span>The target server blocked browser cross-origin HTML access (CORS) or did not return HTML. PageSpeed/Lighthouse SEO checks above remain available. To guarantee complete metadata extraction for every site, the production version should use a same-origin server/Cloudflare Worker proxy.</span></div><div class="meta-rules"><h4>What is still checked by PageSpeed</h4><p class="report-note">Title, meta description, crawlability, canonical, hreflang, language, viewport and other SEO audits are evaluated by Lighthouse when the page can be analyzed.</p></div></div>`);
  }

  async function run() {
    const input = $('#url');
    const url = normalize(input?.value);
    if (!url) return;
    loading();
    try {
      const meta = await extract(url);
      insert(renderMeta(meta, evaluate(meta), 'Extracted from the target HTML <head>'));
    } catch (error) {
      console.info('Meta SEO extraction:', error?.message || error);
      failure(url);
    }
  }

  document.addEventListener('click', event => {
    if (event.target?.id === 'analyze') setTimeout(run, 350);
  });
  $('#url')?.addEventListener('keydown', event => { if (event.key === 'Enter') setTimeout(run, 350); });
})();
