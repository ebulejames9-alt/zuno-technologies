/**
 * Customer Portal API — real authentication + customer-owned support tickets.
 * Every ticket query is scoped to the logged-in customer id, so a customer
 * can never read or modify another customer's records by changing an id.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { db, trackEvent } = require('../db');
const {
  hashPassword, verifyPassword, createSession, destroySession,
  requireCustomer, clientIp, logAudit
} = require('../auth');

const { PRIVATE_UPLOADS: PRIVATE_DIR } = require('../paths');
const storage = require('../storage');

const router = express.Router();

/* Guard: any :id route parameter must be a positive integer (else 404, never 500). */
router.param('id', (req, res, next, val) => {
  if (!/^\d+$/.test(String(val))) return res.status(404).json({ error: 'Not found.' });
  next();
});

const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED.includes(file.mimetype))
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ----------------------------- AUTH ----------------------------- */
router.post('/register', authLimiter, (req, res) => {
  const { name, email, password, phone } = req.body || {};
  const n = (name || '').trim(), e = (email || '').trim().toLowerCase(), p = password || '', ph = (phone || '').trim();
  if (n.length < 2 || n.length > 120) return res.status(400).json({ error: 'Please enter your full name.' });
  if (!emailRe.test(e)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (p.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return res.status(400).json({ error: 'Password must contain letters and numbers.' });
  if (db.prepare('SELECT id FROM customers WHERE email = ?').get(e))
    return res.status(409).json({ error: 'An account with this email already exists.' });

  const info = db.prepare('INSERT INTO customers (email, password_hash, name, phone) VALUES (?,?,?,?)')
    .run(e, hashPassword(p), n, ph || null);
  const customer = { id: info.lastInsertRowid, email: e, name: n };
  db.prepare('INSERT INTO notifications (customer_id, title, message) VALUES (?,?,?)')
    .run(customer.id, 'Welcome to Zuno', 'Your Zuno customer account is ready. You can now open support tickets and manage your profile.');
  createSession(res, 'customer', customer);
  trackEvent('register', '/portal/register', null);
  logAudit({ type: 'customer', id: customer.id, email: e }, 'register', 'New customer account', clientIp(req));
  res.json({ ok: true, customer: { id: customer.id, email: e, name: n } });
});

router.post('/login', authLimiter, (req, res) => {
  const e = (req.body?.email || '').trim().toLowerCase();
  const p = req.body?.password || '';
  const c = db.prepare('SELECT * FROM customers WHERE email = ?').get(e);
  if (!c || !verifyPassword(p, c.password_hash))
    return res.status(401).json({ error: 'Invalid email or password.' });
  if (c.status === 'suspended') return res.status(403).json({ error: 'This account has been suspended. Please contact customer care.' });
  db.prepare("UPDATE customers SET last_login = datetime('now') WHERE id = ?").run(c.id);
  createSession(res, 'customer', c);
  res.json({ ok: true, customer: { id: c.id, email: c.email, name: c.name } });
});

router.post('/logout', (req, res) => { destroySession(req, res, 'customer'); res.json({ ok: true }); });

router.get('/me', requireCustomer, (req, res) => {
  const c = req.customer;
  const counts = {
    tickets: db.prepare('SELECT COUNT(*) c FROM tickets WHERE customer_id = ?').get(c.id).c,
    open: db.prepare("SELECT COUNT(*) c FROM tickets WHERE customer_id = ? AND status NOT IN ('resolved','closed')").get(c.id).c,
    unread: db.prepare('SELECT COUNT(*) c FROM notifications WHERE customer_id = ? AND is_read = 0').get(c.id).c
  };
  res.json({ customer: c, counts });
});

/* --------------------------- PROFILE ---------------------------- */
router.put('/profile', requireCustomer, (req, res) => {
  const { name, phone } = req.body || {};
  const n = (name || '').trim();
  if (n.length < 2 || n.length > 120) return res.status(400).json({ error: 'Please enter a valid name.' });
  db.prepare('UPDATE customers SET name = ?, phone = ? WHERE id = ?').run(n, (phone || '').trim() || null, req.customer.id);
  logAudit({ type: 'customer', id: req.customer.id, email: req.customer.email }, 'profile_update', '', clientIp(req));
  res.json({ ok: true, message: 'Profile updated.' });
});

router.post('/change-password', requireCustomer, (req, res) => {
  const { current, next } = req.body || {};
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customer.id);
  if (!verifyPassword(current || '', c.password_hash)) return res.status(400).json({ error: 'Your current password is incorrect.' });
  if (!next || next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next))
    return res.status(400).json({ error: 'New password must be at least 8 characters and contain letters and numbers.' });
  db.prepare('UPDATE customers SET password_hash = ? WHERE id = ?').run(hashPassword(next), c.id);
  logAudit({ type: 'customer', id: c.id, email: c.email }, 'password_change', '', clientIp(req));
  res.json({ ok: true, message: 'Password changed successfully.' });
});

router.post('/delete-request', requireCustomer, (req, res) => {
  db.prepare("UPDATE customers SET status = 'deletion_requested' WHERE id = ?").run(req.customer.id);
  logAudit({ type: 'customer', id: req.customer.id, email: req.customer.email }, 'deletion_request', 'Customer requested account deletion', clientIp(req));
  res.json({ ok: true, message: 'Your account deletion request has been recorded. Our team will process it and confirm by email.' });
});

/* --------------------------- TICKETS ---------------------------- */
router.get('/tickets', requireCustomer, (req, res) => {
  const rows = db.prepare('SELECT id, category, subject, status, created_at, updated_at FROM tickets WHERE customer_id = ? ORDER BY updated_at DESC').all(req.customer.id);
  res.json(rows);
});

router.post('/tickets', requireCustomer, upload.array('attachments', 3), (req, res) => {
  const { category, subject, description } = req.body || {};
  const s = (subject || '').trim(), d = (description || '').trim(), cat = (category || 'General').trim().slice(0, 60);
  if (s.length < 3 || s.length > 160) return res.status(400).json({ error: 'Please enter a subject (3–160 characters).' });
  if (d.length < 10 || d.length > 5000) return res.status(400).json({ error: 'Please describe your issue (10–5000 characters).' });
  const info = db.prepare('INSERT INTO tickets (customer_id, category, subject, description) VALUES (?,?,?,?)')
    .run(req.customer.id, cat, s, d);
  const tid = info.lastInsertRowid;
  for (const f of (req.files || [])) {
    const storedName = storage.makeName(f.originalname);
    storage.save('private', storedName, f.buffer, f.mimetype);
    db.prepare('INSERT INTO attachments (ticket_id, original_name, stored_name, mimetype, size) VALUES (?,?,?,?,?)')
      .run(tid, f.originalname, storedName, f.mimetype, f.size);
  }
  trackEvent('ticket', '/portal/tickets', null);
  logAudit({ type: 'customer', id: req.customer.id, email: req.customer.email }, 'ticket_create', `Ticket #${tid}`, clientIp(req));
  res.json({ ok: true, id: tid, message: 'Your support request has been submitted. Our team will respond soon.' });
});

function ownedTicket(req, res) {
  const t = db.prepare('SELECT * FROM tickets WHERE id = ? AND customer_id = ?').get(req.params.id, req.customer.id);
  if (!t) { res.status(404).json({ error: 'Ticket not found.' }); return null; }
  return t;
}

router.get('/tickets/:id', requireCustomer, (req, res) => {
  const t = ownedTicket(req, res); if (!t) return;
  const replies = db.prepare('SELECT id, author_type, author_name, message, created_at FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at').all(t.id);
  const attachments = db.prepare('SELECT id, original_name, mimetype, size FROM attachments WHERE ticket_id = ?').all(t.id);
  res.json({ ticket: t, replies, attachments });
});

router.post('/tickets/:id/reply', requireCustomer, (req, res) => {
  const t = ownedTicket(req, res); if (!t) return;
  if (['closed'].includes(t.status)) return res.status(400).json({ error: 'This ticket is closed.' });
  const m = (req.body?.message || '').trim();
  if (m.length < 1 || m.length > 5000) return res.status(400).json({ error: 'Please enter a message.' });
  db.prepare('INSERT INTO ticket_replies (ticket_id, author_type, author_id, author_name, message) VALUES (?,?,?,?,?)')
    .run(t.id, 'customer', req.customer.id, req.customer.name, m);
  db.prepare("UPDATE tickets SET status = CASE WHEN status='awaiting_customer' THEN 'in_progress' ELSE status END, updated_at = datetime('now') WHERE id = ?").run(t.id);
  res.json({ ok: true, message: 'Reply sent.' });
});

router.post('/tickets/:id/close', requireCustomer, (req, res) => {
  const t = ownedTicket(req, res); if (!t) return;
  db.prepare("UPDATE tickets SET status='closed', updated_at=datetime('now') WHERE id = ?").run(t.id);
  res.json({ ok: true, message: 'Ticket closed.' });
});

/* ------------------------ NOTIFICATIONS ------------------------- */
router.get('/notifications', requireCustomer, (req, res) => {
  res.json(db.prepare('SELECT id, title, message, is_read, created_at FROM notifications WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50').all(req.customer.id));
});
router.post('/notifications/:id/read', requireCustomer, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND customer_id = ?').run(req.params.id, req.customer.id);
  res.json({ ok: true });
});
router.post('/notifications/read-all', requireCustomer, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE customer_id = ?').run(req.customer.id);
  res.json({ ok: true });
});

/* ------------------- PRIVATE ATTACHMENT ACCESS ------------------ */
router.get('/attachments/:id', requireCustomer, (req, res) => {
  const a = db.prepare(`SELECT a.*, t.customer_id FROM attachments a JOIN tickets t ON t.id = a.ticket_id WHERE a.id = ?`).get(req.params.id);
  if (!a || a.customer_id !== req.customer.id) return res.status(404).json({ error: 'Not found.' });
  const file = storage.read('private', a.stored_name);
  if (!file) return res.status(404).json({ error: 'File missing.' });
  res.setHeader('Content-Type', a.mimetype || file.mimetype || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${a.original_name}"`);
  res.send(file.buffer);
});

module.exports = router;
