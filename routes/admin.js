/**
 * Admin API — all routes require an authenticated administrator.
 * The server verifies admin permission on EVERY protected operation.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { db, getSetting, setSetting, logAudit } = require('../db');
const {
  verifyPassword, createSession, destroySession, requireAdmin, clientIp
} = require('../auth');

const { PUBLIC_UPLOADS: PUBLIC_DIR, PRIVATE_UPLOADS: PRIVATE_DIR } = require('../paths');
const storage = require('../storage');

const router = express.Router();

/**
 * Trigger a Cloudflare Pages deployment.
 * The secret hook URL must be stored in Render as:
 * CLOUDFLARE_DEPLOY_HOOK_URL
 */
async function triggerCloudflareDeploy() {
  const hookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK_URL;

  if (!hookUrl) {
    console.warn('Cloudflare deploy hook URL is not configured.');
    return;
  }

  try {
    const response = await fetch(hookUrl, { method: 'POST' });

    if (!response.ok) {
      console.error(
        'Cloudflare deployment trigger failed:',
        response.status
      );
      return;
    }

    console.log('Cloudflare Pages deployment triggered successfully.');
  } catch (error) {
    console.error(
      'Could not trigger Cloudflare deployment:',
      error.message
    );
  }
}

/* Guard: any :id route parameter must be a positive integer (else 404, never 500). */
router.param('id', (req, res, next, val) => {
  if (!/^\d+$/.test(String(val))) {
    return res.status(404).json({ error: 'Not found.' });
  }
  next();
});

const IMG = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, IMG.includes(file.mimetype))
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

/* ----------------------------- AUTH ----------------------------- */
router.post('/login', loginLimiter, (req, res) => {
  const e = (req.body?.email || '').trim().toLowerCase();
  const p = req.body?.password || '';
  const a = db.prepare('SELECT * FROM admins WHERE email = ?').get(e);

  if (!a || !verifyPassword(p, a.password_hash)) {
    logAudit(
      { type: 'admin', email: e },
      'login_failed',
      'Invalid credentials',
      clientIp(req)
    );

    return res.status(401).json({
      error: 'Invalid email or password.'
    });
  }

  db.prepare(
    "UPDATE admins SET last_login = datetime('now') WHERE id = ?"
  ).run(a.id);

  createSession(res, 'admin', a);

  logAudit(
    { type: 'admin', id: a.id, email: a.email },
    'login',
    'Admin signed in',
    clientIp(req)
  );

  res.json({
    ok: true,
    admin: {
      id: a.id,
      email: a.email,
      name: a.name,
      role: a.role
    }
  });
});

router.post('/logout', (req, res) => {
  const a = req.admin;

  destroySession(req, res, 'admin');

  if (a) {
    logAudit(
      { type: 'admin', id: a.id, email: a.email },
      'logout',
      '',
      clientIp(req)
    );
  }

  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

/* Everything below is protected */
router.use(requireAdmin);

/**
 * Automatically trigger a Cloudflare rebuild after successful changes
 * to public-facing content.
 *
 * Draft saves and draft discards are intentionally excluded.
 * This middleware runs before the protected route handlers below.
 */
router.use((req, res, next) => {
  const method = req.method;
  const p = req.path;

  const isPublicContentWrite =
    // Website settings
    (method === 'PUT' && p === '/settings') ||

    // Content sections: create, publish, visibility, reorder, delete
    (method === 'POST' && (
      p === '/content' ||
      /^\/content\/[^/]+\/publish$/.test(p)
    )) ||

    (method === 'PUT' && (
      /^\/content\/[^/]+\/(visible|reorder)$/.test(p)
    )) ||

    (method === 'DELETE' && (
      /^\/content\/[^/]+$/.test(p)
    )) ||

    // Company values
    (method === 'POST' && p === '/values') ||

    (method === 'PUT' && /^\/values\/\d+$/.test(p)) ||

    (method === 'DELETE' && /^\/values\/\d+$/.test(p)) ||

    // Products
    (method === 'POST' && p === '/products') ||

    (method === 'PUT' && /^\/products\/\d+$/.test(p)) ||

    (method === 'DELETE' && /^\/products\/\d+$/.test(p)) ||

    // FAQs
    (method === 'POST' && p === '/faqs') ||

    (method === 'PUT' && /^\/faqs\/\d+$/.test(p)) ||

    (method === 'DELETE' && /^\/faqs\/\d+$/.test(p)) ||

    // Public media uploads and deletion
    (method === 'POST' && p === '/media') ||

    (method === 'DELETE' && /^\/media\/\d+$/.test(p));

  if (isPublicContentWrite) {
    res.once('finish', () => {
      // Trigger only after the write request has succeeded.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void triggerCloudflareDeploy();
      }
    });
  }

  next();
});

/* --------------------- ADMIN PROFILE / PASSWORD ----------------- */
router.put('/profile', (req, res) => {
  const name = (req.body?.name || '').trim();

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({
      error: 'Please enter a valid name.'
    });
  }

  db.prepare('UPDATE admins SET name = ? WHERE id = ?')
    .run(name, req.admin.id);

  logAudit(req.admin, 'profile_update', '', clientIp(req));

  res.json({ ok: true, message: 'Profile updated.' });
});

router.post('/change-password', (req, res) => {
  const { current, next } = req.body || {};

  const a = db.prepare(
    'SELECT * FROM admins WHERE id = ?'
  ).get(req.admin.id);

  if (!verifyPassword(current || '', a.password_hash)) {
    return res.status(400).json({
      error: 'Your current password is incorrect.'
    });
  }

  if (
    !next ||
    next.length < 10 ||
    !/[A-Za-z]/.test(next) ||
    !/[0-9]/.test(next)
  ) {
    return res.status(400).json({
      error: 'New password must be at least 10 characters and contain letters and numbers.'
    });
  }

  const bcrypt = require('bcryptjs');

  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(next, 12), a.id);

  logAudit(req.admin, 'password_change', '', clientIp(req));

  res.json({
    ok: true,
    message: 'Password changed successfully.'
  });
});

/* --------------------------- OVERVIEW --------------------------- */
router.get('/overview', (req, res) => {
  const c = (sql, ...p) => db.prepare(sql).get(...p).c;
  const since7 = "datetime('now','-7 days')";

  res.json({
    stats: {
      customers: c('SELECT COUNT(*) c FROM customers'),
      newCustomers7: c(
        `SELECT COUNT(*) c FROM customers WHERE created_at >= ${since7}`
      ),
      messages: c('SELECT COUNT(*) c FROM contact_messages'),
      newMessages: c(
        "SELECT COUNT(*) c FROM contact_messages WHERE status='new'"
      ),
      tickets: c('SELECT COUNT(*) c FROM tickets'),
      openTickets: c(
        "SELECT COUNT(*) c FROM tickets WHERE status NOT IN ('resolved','closed')"
      ),
      products: c('SELECT COUNT(*) c FROM products'),
      publishedProducts: c(
        "SELECT COUNT(*) c FROM products WHERE status='available'"
      ),
      pageviews7: c(
        `SELECT COUNT(*) c FROM analytics_events WHERE event_type='pageview' AND created_at >= ${since7}`
      ),
      contacts7: c(
        `SELECT COUNT(*) c FROM analytics_events WHERE event_type='contact_submit' AND created_at >= ${since7}`
      )
    },

    recentMessages: db.prepare(
      'SELECT id, name, email, subject, status, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 5'
    ).all(),

    recentTickets: db.prepare(
      `SELECT t.id, t.subject, t.status, t.created_at,
              c.name customer, c.email
       FROM tickets t
       JOIN customers c ON c.id=t.customer_id
       ORDER BY t.updated_at DESC LIMIT 5`
    ).all()
  });
});

/* -------------------------- ANALYTICS --------------------------- */
router.get('/analytics', (req, res) => {
  if (getSetting('analytics_enabled', '1') !== '1') {
    return res.json({ enabled: false });
  }

  const days = Math.min(parseInt(req.query.days) || 14, 90);

  const series = db.prepare(
    `SELECT date(created_at) d, COUNT(*) c
     FROM analytics_events
     WHERE event_type='pageview'
       AND created_at >= datetime('now', ?)
     GROUP BY d
     ORDER BY d`
  ).all(`-${days} days`);

  const popular = db.prepare(
    `SELECT page, COUNT(*) c
     FROM analytics_events
     WHERE event_type='pageview' AND page IS NOT NULL
     GROUP BY page
     ORDER BY c DESC
     LIMIT 10`
  ).all();

  const totals = {
    pageviews: db.prepare(
      "SELECT COUNT(*) c FROM analytics_events WHERE event_type='pageview'"
    ).get().c,

    contacts: db.prepare(
      "SELECT COUNT(*) c FROM analytics_events WHERE event_type='contact_submit'"
    ).get().c,

    registrations: db.prepare(
      "SELECT COUNT(*) c FROM analytics_events WHERE event_type='register'"
    ).get().c,

    tickets: db.prepare(
      "SELECT COUNT(*) c FROM analytics_events WHERE event_type='ticket'"
    ).get().c,

    productViews: db.prepare(
      "SELECT COUNT(*) c FROM analytics_events WHERE event_type='product_view'"
    ).get().c
  };

  res.json({ enabled: true, days, series, popular, totals });
});

/* --------------------------- SETTINGS --------------------------- */
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};

  for (const r of rows) {
    out[r.key] = r.value;
  }

  res.json(out);
});

const PROTECTED_KEYS = ['admin_password'];

router.put('/settings', (req, res) => {
  const updates = req.body || {};

  const allowed = Object.keys(updates).filter(
    k => !PROTECTED_KEYS.includes(k) && /^[a-z0-9_]+$/.test(k)
  );

  for (const k of allowed) {
    setSetting(k, updates[k]);
  }

  logAudit(
    req.admin,
    'settings_update',
    `Updated: ${allowed.join(', ')}`,
    clientIp(req)
  );

  res.json({
    ok: true,
    updated: allowed,
    message: 'Settings saved and published to the live website.'
  });
});

/* ------------------------ CONTENT (CMS) ------------------------- */
router.get('/content', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM content_blocks ORDER BY sort_order, id'
  ).all();

  res.json(
    rows.map(r => ({
      ...r,
      has_draft: r.draft_body != null || r.draft_title != null
    }))
  );
});

// Save a draft for a section.
router.put('/content/:key/draft', (req, res) => {
  const { title, body } = req.body || {};

  const row = db.prepare(
    'SELECT id FROM content_blocks WHERE section_key = ?'
  ).get(req.params.key);

  if (!row) {
    return res.status(404).json({ error: 'Section not found.' });
  }

  db.prepare(
    "UPDATE content_blocks SET draft_title=?, draft_body=?, draft_updated_at=datetime('now') WHERE section_key=?"
  ).run(title ?? null, body ?? null, req.params.key);

  logAudit(req.admin, 'content_draft', req.params.key, clientIp(req));

  res.json({
    ok: true,
    message: 'Draft saved. It is not visible on the live website until you publish.'
  });
});

// Publish a section (copies draft -> live).
router.post('/content/:key/publish', (req, res) => {
  const row = db.prepare(
    'SELECT * FROM content_blocks WHERE section_key = ?'
  ).get(req.params.key);

  if (!row) {
    return res.status(404).json({ error: 'Section not found.' });
  }

  if (
    row.draft_title == null &&
    row.draft_body == null &&
    req.body?.title == null &&
    req.body?.body == null
  ) {
    return res.status(400).json({ error: 'Nothing to publish.' });
  }

  const t = req.body?.title ?? row.draft_title ?? row.title;
  const b = req.body?.body ?? row.draft_body ?? row.body;

  db.prepare(
    "UPDATE content_blocks SET title=?, body=?, draft_title=NULL, draft_body=NULL, status='published', updated_at=datetime('now') WHERE section_key=?"
  ).run(t, b, req.params.key);

  logAudit(req.admin, 'content_publish', req.params.key, clientIp(req));

  res.json({
    ok: true,
    message: 'Changes published to the live website.'
  });
});

router.post('/content/:key/discard', (req, res) => {
  db.prepare(
    'UPDATE content_blocks SET draft_title=NULL, draft_body=NULL WHERE section_key=?'
  ).run(req.params.key);

  res.json({ ok: true, message: 'Draft discarded.' });
});

// Add a new section.
router.post('/content', (req, res) => {
  const key = (req.body?.section_key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');

  const title = (req.body?.title || '').trim();
  const body = req.body?.body || '';

  if (!key) {
    return res.status(400).json({
      error: 'A section key is required.'
    });
  }

  if (
    db.prepare(
      'SELECT id FROM content_blocks WHERE section_key=?'
    ).get(key)
  ) {
    return res.status(409).json({
      error: 'A section with that key already exists.'
    });
  }

  const max = db.prepare(
    'SELECT COALESCE(MAX(sort_order),0) m FROM content_blocks'
  ).get().m;

  db.prepare(
    "INSERT INTO content_blocks (section_key, title, body, status, visible, sort_order) VALUES (?,?,?,'published',1,?)"
  ).run(key, title || key, body, max + 1);

  logAudit(req.admin, 'content_add', key, clientIp(req));

  res.json({ ok: true, message: 'Section added.' });
});

router.put('/content/:key/visible', (req, res) => {
  db.prepare(
    'UPDATE content_blocks SET visible=? WHERE section_key=?'
  ).run(req.body?.visible ? 1 : 0, req.params.key);

  res.json({ ok: true });
});

router.put('/content/:key/reorder', (req, res) => {
  db.prepare(
    'UPDATE content_blocks SET sort_order=? WHERE section_key=?'
  ).run(parseInt(req.body?.sort_order) || 0, req.params.key);

  res.json({ ok: true });
});

router.delete('/content/:key', (req, res) => {
  db.prepare(
    'DELETE FROM content_blocks WHERE section_key=?'
  ).run(req.params.key);

  logAudit(req.admin, 'content_delete', req.params.key, clientIp(req));

  res.json({ ok: true });
});

/* --------------------------- VALUES ----------------------------- */
router.get('/values', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM values_list ORDER BY sort_order, id').all()
  );
});

router.post('/values', (req, res) => {
  const { title, description, icon } = req.body || {};

  if (!title) {
    return res.status(400).json({ error: 'Title required.' });
  }

  const max = db.prepare(
    'SELECT COALESCE(MAX(sort_order),0) m FROM values_list'
  ).get().m;

  const info = db.prepare(
    'INSERT INTO values_list (title, description, icon, sort_order) VALUES (?,?,?,?)'
  ).run(title, description || '', icon || 'spark', max + 1);

  logAudit(req.admin, 'value_add', title, clientIp(req));

  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/values/:id', (req, res) => {
  const { title, description, icon, visible, sort_order } = req.body || {};

  db.prepare(
    'UPDATE values_list SET title=COALESCE(?,title), description=COALESCE(?,description), icon=COALESCE(?,icon), visible=COALESCE(?,visible), sort_order=COALESCE(?,sort_order) WHERE id=?'
  ).run(
    title ?? null,
    description ?? null,
    icon ?? null,
    visible == null ? null : (visible ? 1 : 0),
    sort_order ?? null,
    req.params.id
  );

  logAudit(req.admin, 'value_update', `#${req.params.id}`, clientIp(req));

  res.json({ ok: true });
});

router.delete('/values/:id', (req, res) => {
  db.prepare('DELETE FROM values_list WHERE id=?').run(req.params.id);

  logAudit(req.admin, 'value_delete', `#${req.params.id}`, clientIp(req));

  res.json({ ok: true });
});

/* -------------------------- PRODUCTS ---------------------------- */
router.get('/products', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM products ORDER BY sort_order, id').all()
  );
});

router.post('/products', (req, res) => {
  const { name, category, description, status, image_url } = req.body || {};

  if (!name) {
    return res.status(400).json({
      error: 'Product name required.'
    });
  }

  const st = ['coming_soon', 'available', 'archived'].includes(status)
    ? status
    : 'coming_soon';

  const max = db.prepare(
    'SELECT COALESCE(MAX(sort_order),0) m FROM products'
  ).get().m;

  const info = db.prepare(
    'INSERT INTO products (name, category, description, image_url, status, sort_order) VALUES (?,?,?,?,?,?)'
  ).run(
    name,
    category || '',
    description || '',
    image_url || null,
    st,
    max + 1
  );

  logAudit(req.admin, 'product_add', name, clientIp(req));

  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/products/:id', (req, res) => {
  const {
    name,
    category,
    description,
    status,
    image_url,
    sort_order
  } = req.body || {};

  const st = status && [
    'coming_soon',
    'available',
    'archived'
  ].includes(status) ? status : null;

  db.prepare(
    `UPDATE products SET name=COALESCE(?,name),
     category=COALESCE(?,category),
     description=COALESCE(?,description),
     image_url=COALESCE(?,image_url),
     status=COALESCE(?,status),
     sort_order=COALESCE(?,sort_order)
     WHERE id=?`
  ).run(
    name ?? null,
    category ?? null,
    description ?? null,
    image_url ?? null,
    st,
    sort_order ?? null,
    req.params.id
  );

  logAudit(req.admin, 'product_update', `#${req.params.id}`, clientIp(req));

  res.json({ ok: true, message: 'Product updated.' });
});

router.delete('/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);

  logAudit(req.admin, 'product_delete', `#${req.params.id}`, clientIp(req));

  res.json({ ok: true });
});

/* ----------------------------- FAQS ----------------------------- */
router.get('/faqs', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM faqs ORDER BY sort_order, id').all()
  );
});

router.post('/faqs', (req, res) => {
  const { question, answer } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: 'Question required.' });
  }

  const max = db.prepare(
    'SELECT COALESCE(MAX(sort_order),0) m FROM faqs'
  ).get().m;

  const info = db.prepare(
    'INSERT INTO faqs (question, answer, sort_order) VALUES (?,?,?)'
  ).run(question, answer || '', max + 1);

  logAudit(
    req.admin,
    'faq_add',
    question.slice(0, 60),
    clientIp(req)
  );

  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/faqs/:id', (req, res) => {
  const { question, answer, published, sort_order } = req.body || {};

  db.prepare(
    'UPDATE faqs SET question=COALESCE(?,question), answer=COALESCE(?,answer), published=COALESCE(?,published), sort_order=COALESCE(?,sort_order) WHERE id=?'
  ).run(
    question ?? null,
    answer ?? null,
    published == null ? null : (published ? 1 : 0),
    sort_order ?? null,
    req.params.id
  );

  logAudit(req.admin, 'faq_update', `#${req.params.id}`, clientIp(req));

  res.json({ ok: true });
});

router.delete('/faqs/:id', (req, res) => {
  db.prepare('DELETE FROM faqs WHERE id=?').run(req.params.id);

  logAudit(req.admin, 'faq_delete', `#${req.params.id}`, clientIp(req));

  res.json({ ok: true });
});

/* ----------------------- CONTACT MESSAGES ----------------------- */
router.get('/messages', (req, res) => {
  const status = req.query.status;
  const q = (req.query.q || '').trim();

  let sql = 'SELECT * FROM contact_messages WHERE 1=1';
  const p = [];

  if (status && status !== 'all') {
    sql += ' AND status=?';
    p.push(status);
  }

  if (q) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?)';
    p.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT 200';

  res.json(db.prepare(sql).all(...p));
});

router.put('/messages/:id', (req, res) => {
  
