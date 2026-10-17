/**
 * ZUNO Technologies — static export of the PUBLIC website.
 *
 * Renders every public page from the running server (which reads live DB
 * content) and writes a self-contained static site to /workspace/zuno/dist.
 * This gives a permanent, host-anywhere public website. The dynamic parts
 * (contact form submission, admin dashboard, customer portal) require the
 * Node backend and are linked to the live app.
 *
 * Usage:  node tools/export-static.js [baseUrl] [liveAppUrl]
 */
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:3000';
const LIVE = process.argv[3] || ''; // e.g. https://my-zuno.onrender.com
const OUT = path.join(__dirname, '..', 'dist');

const PAGES = [
  ['/', 'index.html'],
  ['/about', 'about.html'],
  ['/mission', 'mission.html'],
  ['/vision', 'vision.html'],
  ['/products', 'products.html'],
  ['/faq', 'faq.html'],
  ['/contact', 'contact.html']
];

function rewrite(html) {
  const map = {
    'href="/"': 'href="index.html"',
    'href="/about"': 'href="about.html"',
    'href="/mission"': 'href="mission.html"',
    'href="/vision"': 'href="vision.html"',
    'href="/products"': 'href="products.html"',
    'href="/faq"': 'href="faq.html"',
    'href="/contact"': 'href="contact.html"',
    'href="/css/': 'href="css/',
    'src="/js/': 'src="js/',
    'href="/assets/': 'href="assets/',
    'src="/assets/': 'src="assets/',
    'url(/uploads/public/': 'url(uploads/public/',
    'src="/uploads/public/': 'src="uploads/public/',
    'href="/uploads/public/': 'href="uploads/public/'
  };
  let out = html;
  for (const [from, to] of Object.entries(map)) out = out.split(from).join(to);
  // Portal + admin live on the dynamic backend.
  const portalTarget = LIVE ? LIVE + '/portal' : 'portal.html';
  const adminTarget = LIVE ? LIVE + '/admin' : 'admin.html';
  out = out.split('href="/portal"').join(`href="${portalTarget}"`);
  out = out.split('href="/admin"').join(`href="${adminTarget}"`);
  out = out.split('href="/admin/login"').join(`href="${adminTarget}"`);
  // canonical -> relative
  out = out.split('<link rel="canonical" href="/">').join('<link rel="canonical" href="index.html">');
  return out;
}

const STATIC_CONTACT_JS = `/* ZUNO static site: graceful contact + analytics fallback (no backend). */
(function () {
  var origFetch = window.fetch;
  window.fetch = function (url, opts) {
    try {
      if (typeof url === 'string' && url.indexOf('/api/contact') !== -1) {
        var data = {};
        try { data = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
        var to = 'zunocustomerscare@gmail.com';
        var subj = encodeURIComponent('[Website] ' + (data.subject || 'New enquiry'));
        var body = encodeURIComponent(
          'Name: ' + (data.name || '') + '\\n' +
          'Email: ' + (data.email || '') + '\\n\\n' + (data.message || ''));
        try { window.location.href = 'mailto:' + to + '?subject=' + subj + '&body=' + body; } catch (e) {}
        return Promise.resolve(new Response(
          JSON.stringify({ ok: true, message: 'Opening your email app to send this to ' + to + '. Please press Send.' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (typeof url === 'string' && url.indexOf('/api/track') !== -1) {
        return Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };
})();`;

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  for (const [route, file] of PAGES) {
    const res = await fetch(BASE + route);
    if (!res.ok) throw new Error(`Failed ${route}: ${res.status}`);
    let html = await res.text();
    html = rewrite(html);
    fs.writeFileSync(path.join(OUT, file), html);
    console.log(`  wrote ${file}  (${html.length} bytes)`);
  }

  // Static assets
  const pub = path.join(__dirname, '..', 'public');
  copyDir(path.join(pub, 'css'), path.join(OUT, 'css'));
  copyDir(path.join(pub, 'js'), path.join(OUT, 'js'));
  copyDir(path.join(pub, 'assets'), path.join(OUT, 'assets'));
  copyDir(path.join(__dirname, '..', 'uploads', 'public'), path.join(OUT, 'uploads', 'public'));

  // robots.txt + sitemap.xml (served dynamically by the app)
  for (const f of ['robots.txt', 'sitemap.xml']) {
    try {
      const r = await fetch(`${BASE}/${f}`);
      if (r.ok) fs.writeFileSync(path.join(OUT, f), await r.text());
    } catch (e) { /* ignore */ }
  }

  // Static contact-form fallback: the marketing site is static, so the form
  // gracefully falls back to the customer-care mailbox instead of failing.
  fs.writeFileSync(path.join(OUT, 'js', 'static-contact.js'), STATIC_CONTACT_JS);
  const contactPath = path.join(OUT, 'contact.html');
  if (fs.existsSync(contactPath)) {
    let c = fs.readFileSync(contactPath, 'utf8');
    c = c.replace('</body>', '<script src="js/static-contact.js"></script>\n</body>');
    fs.writeFileSync(contactPath, c);
  }

  // 404 page
  try {
    const r = await fetch(BASE + '/__notfound__');
    if (r.status === 404) fs.writeFileSync(path.join(OUT, '404.html'), rewrite(await r.text()));
  } catch (e) { /* ignore */ }

  console.log(`\n  Static export complete -> ${OUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
