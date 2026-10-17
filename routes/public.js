/**
 * Public API — read-only content + contact form. No authentication required.
 * Only PUBLISHED content is ever exposed here.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { db, getSetting, trackEvent } = require('../db');

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please try again later.' }
});

function publicSettings() {
  const keys = [
    'site_title', 'meta_description', 'brand_name', 'brand_full', 'slogan',
    'care_email', 'care_phone', 'care_whatsapp', 'support_hours', 'care_message',
    'contact_form_enabled', 'hero_heading', 'hero_text', 'hero_btn1', 'hero_btn2',
    'accent_primary', 'accent_secondary', 'logo_url', 'favicon_url', 'footer_text',
    'nav_home', 'nav_about', 'nav_mission', 'nav_vision', 'nav_products',
    'nav_faq', 'nav_contact', 'nav_portal', 'og_image', 'robots', 'analytics_enabled'
  ];
  const out = {};
  for (const k of keys) out[k] = getSetting(k, '');
  return out;
}

/* Full published site content in one call */
router.get('/content', (req, res) => {
  const blocks = {};
  for (const b of db.prepare("SELECT section_key, title, body, sort_order FROM content_blocks WHERE status='published' AND visible=1 ORDER BY sort_order").all()) {
    blocks[b.section_key] = { title: b.title, body: b.body };
  }
  const products = db.prepare("SELECT id, name, category, description, image_url, status, sort_order FROM products WHERE status != 'archived' ORDER BY sort_order, id").all();
  const values = db.prepare('SELECT id, title, description, icon FROM values_list WHERE visible=1 ORDER BY sort_order, id').all();
  const faqs = db.prepare('SELECT id, question, answer FROM faqs WHERE published=1 ORDER BY sort_order, id').all();
  res.json({ settings: publicSettings(), blocks, products, values, faqs });
});

router.get('/products', (req, res) => {
  res.json(db.prepare("SELECT id, name, category, description, image_url, status FROM products WHERE status != 'archived' ORDER BY sort_order, id").all());
});

router.get('/faqs', (req, res) => {
  res.json(db.prepare('SELECT id, question, answer FROM faqs WHERE published=1 ORDER BY sort_order, id').all());
});

/* Contact form */
router.post('/contact', contactLimiter, (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (getSetting('contact_form_enabled', '1') !== '1')
    return res.status(503).json({ error: 'The contact form is temporarily unavailable.' });

  const clean = (s) => (typeof s === 'string' ? s.trim() : '');
  const n = clean(name), e = clean(email), s = clean(subject), m = clean(message);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (n.length < 2 || n.length > 120) return res.status(400).json({ error: 'Please enter a valid name.' });
  if (!emailRe.test(e) || e.length > 160) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (m.length < 10 || m.length > 5000) return res.status(400).json({ error: 'Your message must be between 10 and 5000 characters.' });
  if (s.length > 160) return res.status(400).json({ error: 'Subject is too long.' });
  // basic spam heuristics
  const links = (m.match(/https?:\/\//g) || []).length;
  if (links > 4) return res.status(400).json({ error: 'Your message was flagged as spam.' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;
  const info = db.prepare('INSERT INTO contact_messages (name, email, subject, message, ip) VALUES (?,?,?,?,?)')
    .run(n, e, s || 'Website enquiry', m, ip);
  trackEvent('contact_submit', '/contact', null);

  res.json({
    ok: true,
    id: info.lastInsertRowid,
    message: 'Thank you. Your message has been received and saved. Our customer care team will respond to you by email.'
  });
});

/* Privacy-conscious first-party analytics beacon */
router.post('/track', (req, res) => {
  if (getSetting('analytics_enabled', '1') !== '1') return res.json({ ok: true });
  const { type, page } = req.body || {};
  const allowed = ['pageview', 'product_view'];
  if (!allowed.includes(type)) return res.json({ ok: true });
  const cleanPage = typeof page === 'string' ? page.slice(0, 200) : null;
  const ref = (req.headers.referer || '').slice(0, 200) || null;
  trackEvent(type, cleanPage, ref);
  res.json({ ok: true });
});

module.exports = router;
