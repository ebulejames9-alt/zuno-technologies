/**
 * ZUNO TECHNOLOGIES — application server
 * Serves the public website (server-rendered), the admin dashboard SPA,
 * the customer portal SPA, and the JSON API. Real backend + real database.
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { db, getSetting, trackEvent } = require('./db');
const { currentAdmin, currentCustomer } = require('./auth');
const storage = require('./storage');
const views = require('./views');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ----------------------------- Security ---------------------------- */
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "same-site" }
}));

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(cookieParser());

/* --------------------------- Static assets ------------------------- */
app.use('/css', express.static(path.join(__dirname, 'public', 'css'), { maxAge: '1h' }));
app.use('/js', express.static(path.join(__dirname, 'public', 'js'), { maxAge: '1h' }));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), { maxAge: '1d' }));
// Public media uploads (admin-managed images) — served from disk or the database
app.get('/uploads/public/:name', (req, res) => {
  const file = storage.read('public', req.params.name);
  if (!file) return res.status(404).end();
  if (file.mimetype) res.type(file.mimetype);
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(file.buffer);
});
// NOTE: /uploads/private is intentionally NOT served statically — private
// customer attachments are only reachable through authenticated API routes.

/* ------------------------------- API ------------------------------- */
app.use('/api', require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/portal', require('./routes/portal'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'zuno', time: new Date().toISOString() }));

/* --------------------------- SEO files ----------------------------- */
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /portal\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`
  );
});
app.get('/sitemap.xml', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const urls = ['/', '/about', '/mission', '/vision', '/products', '/faq', '/contact'];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${base}${u}</loc><changefreq>weekly</changefreq></url>`).join('\n') +
    `\n</urlset>`;
  res.type('application/xml').send(xml);
});

/* ------------------------- Public website -------------------------- */
function pageview(req) {
  try { trackEvent('pageview', req.path, (req.headers.referer || '').slice(0, 200) || null); } catch {}
}
app.get('/', (req, res) => { pageview(req); res.send(views.renderHome()); });
for (const route of ['/about', '/mission', '/vision', '/products', '/faq', '/contact']) {
  app.get(route, (req, res) => { pageview(req); res.send(views.renderSection(route)); });
}

/* ------------------------ Admin dashboard SPA ---------------------- */
app.get(['/admin', '/admin/login'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/* --------------------------- Portal SPA ---------------------------- */
app.get(['/portal', '/portal/login', '/portal/register'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

/* ----------------------------- 404 --------------------------------- */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.status(404).send(views.renderNotFound());
});

/* --------------------------- Error handler ------------------------- */
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  res.status(500).send('Server error');
});

app.listen(PORT, () => {
  console.log(`\n  ZUNO Technologies running → http://localhost:${PORT}`);
  console.log(`  Admin dashboard          → http://localhost:${PORT}/admin`);
  console.log(`  Customer portal          → http://localhost:${PORT}/portal\n`);
});

module.exports = app;
