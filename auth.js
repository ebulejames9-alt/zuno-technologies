/**
 * ZUNO TECHNOLOGIES — Authentication & authorisation
 * - bcrypt password hashing (never plaintext)
 * - JWT session tokens delivered in httpOnly, SameSite cookies
 * - Server-side session records so tokens can be revoked
 * - Role-based middleware for admin + customer areas
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, logAudit } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const ADMIN_COOKIE = 'zuno_admin';
const CUSTOMER_COOKIE = 'zuno_customer';
const SESSION_DAYS = 7;

function hashPassword(pw) { return bcrypt.hashSync(pw, 12); }
function verifyPassword(pw, hash) { try { return bcrypt.compareSync(pw, hash); } catch { return false; } }

function createSession(res, userType, user) {
  const sid = crypto.randomUUID();
  const token = jwt.sign({ sid, uid: user.id, type: userType }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (id, user_type, user_id, expires_at) VALUES (?,?,?,?)')
    .run(sid, userType, user.id, expires);
  const cookieName = userType === 'admin' ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 864e5,
    path: '/'
  });
  return token;
}

function destroySession(req, res, userType) {
  const cookieName = userType === 'admin' ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  const token = req.cookies?.[cookieName];
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(payload.sid);
    } catch { /* ignore */ }
  }
  res.clearCookie(cookieName, { path: '/' });
}

function readToken(req, cookieName) {
  const token = req.cookies?.[cookieName];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND revoked = 0').get(payload.sid);
    if (!s) return null;
    if (new Date(s.expires_at) < new Date()) return null;
    return payload;
  } catch { return null; }
}

function currentAdmin(req) {
  const p = readToken(req, ADMIN_COOKIE);
  if (!p || p.type !== 'admin') return null;
  return db.prepare('SELECT id, email, name, role FROM admins WHERE id = ?').get(p.uid) || null;
}
function currentCustomer(req) {
  const p = readToken(req, CUSTOMER_COOKIE);
  if (!p || p.type !== 'customer') return null;
  const c = db.prepare('SELECT id, email, name, phone, status, created_at FROM customers WHERE id = ?').get(p.uid);
  if (!c || c.status === 'suspended') return null;
  return c;
}

function requireAdmin(req, res, next) {
  const admin = currentAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Authentication required.' });
  req.admin = admin;
  next();
}
function requireCustomer(req, res, next) {
  const customer = currentCustomer(req);
  if (!customer) return res.status(401).json({ error: 'Authentication required.' });
  req.customer = customer;
  next();
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;
}

module.exports = {
  hashPassword, verifyPassword, createSession, destroySession,
  currentAdmin, currentCustomer, requireAdmin, requireCustomer,
  clientIp, JWT_SECRET, ADMIN_COOKIE, CUSTOMER_COOKIE, logAudit
};
