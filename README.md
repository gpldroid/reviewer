# Reviewer — SEO & PageSpeed Tools

A lightweight HTML/CSS/JavaScript website analyzer with a secure serverless Google PageSpeed Insights integration.

## Included
- Responsive SaaS-style header and mobile navigation
- Website URL validation
- Google PageSpeed Insights analysis for Mobile and Desktop
- Performance, SEO, Accessibility and Best Practices scores
- Core Web Vitals and Lighthouse audit checks
- Website comparison
- Dark mode
- Cookie consent
- Static SEO pages: Guide, About, Contact, Privacy and Terms
- `robots.txt` and `sitemap.xml`

## PageSpeed API

The frontend calls `/api/pagespeed`. The endpoint is implemented as a Cloudflare Pages Function in:

`functions/api/pagespeed.js`

The server function keeps the Google API key on the server and never exposes it to browser JavaScript. It validates the requested URL, blocks private/local targets, handles CORS and OPTIONS requests, forwards useful Google errors, applies a short cache to successful reports, and times out long-running requests safely.

### Required secret

Configure this secret/environment variable on the deployment platform:

`PAGESPEED_API_KEY`

Create the key in Google Cloud with the PageSpeed Insights API enabled. Do not put the key in `index.html`, `app.js`, GitHub source code, or any public JavaScript file.

### Recommended deployment: Cloudflare Pages

Connect this repository to Cloudflare Pages and use the repository root as the build output directory. No frontend build step is required.

The `functions/api/pagespeed.js` file is automatically exposed as:

`/api/pagespeed`

After adding `PAGESPEED_API_KEY` as a production secret, the analyzer can make real PageSpeed requests.

### GitHub Pages

GitHub Pages can host the static frontend, but it does **not** execute Cloudflare Pages Functions. If the frontend remains on GitHub Pages, deploy the `functions/api/pagespeed.js` endpoint separately and set:

`window.REVIEWER_API_ENDPOINT`

to the full HTTPS URL of that API endpoint before loading `app.js`.

## Local development

For a local Cloudflare Pages Functions environment, install Wrangler and run the project through Cloudflare Pages rather than opening `index.html` directly. Add `PAGESPEED_API_KEY` as a local secret/environment value. Never commit `.dev.vars` or API keys.

## Security notes

- Only HTTP/HTTPS target URLs are accepted.
- Localhost, loopback, private IPv4 ranges and common internal hostnames are rejected.
- The Google API key is server-side only.
- CORS is restricted to the official GitHub Pages origin and Cloudflare Pages deployments.
- Successful API responses are briefly cached to reduce duplicate PageSpeed requests.
