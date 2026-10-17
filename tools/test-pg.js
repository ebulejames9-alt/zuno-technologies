/**
 * Quick smoke test of the PostgreSQL adapter (run with a live Postgres).
 *   DATABASE_URL=postgres://user:pass@host:5432/db node tools/test-pg.js
 */
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:zuno@localhost:5432/zuno';

const { db, getSetting, setSetting, logAudit, trackEvent } = require('../db');

function line(label, v) { console.log(label.padEnd(28), typeof v === 'object' ? JSON.stringify(v) : v); }

try {
  line('driver', process.env.DATABASE_URL.includes('postgres') ? 'postgres' : '?');
  line('setting care_email', getSetting('care_email'));
  line('setting hero_heading', getSetting('hero_heading'));

  setSetting('care_phone', '+234-000-000-0000');
  line('after setSetting', getSetting('care_phone'));
  setSetting('care_phone', '');
  line('after reset', JSON.stringify(getSetting('care_phone')));

  line('products count', db.prepare('SELECT COUNT(*) c FROM products').get().c);
  line('values count', db.prepare('SELECT COUNT(*) c FROM values_list').get().c);
  line('faqs count', db.prepare('SELECT COUNT(*) c FROM faqs').get().c);
  line('blocks count', db.prepare('SELECT COUNT(*) c FROM content_blocks').get().c);

  const pub = db.prepare("SELECT section_key, title FROM content_blocks WHERE status='published' AND visible=1 ORDER BY sort_order").all();
  line('published blocks', pub.map((b) => b.section_key));

  // INSERT returning id
  const ins = db.prepare('INSERT INTO contact_messages (name, email, subject, message, ip) VALUES (?,?,?,?,?)')
    .run('Test User', 'test@example.com', 'Hello', 'This is a test message body.', '127.0.0.1');
  line('insert lastInsertRowid', ins.lastInsertRowid);
  line('insert changes', ins.changes);

  const msg = db.prepare('SELECT id, name, email, created_at FROM contact_messages WHERE id = ?').get(ins.lastInsertRowid);
  line('fetched message', msg);

  // UPDATE + DELETE
  const upd = db.prepare("UPDATE contact_messages SET status='read' WHERE id = ?").run(ins.lastInsertRowid);
  line('update changes', upd.changes);
  const del = db.prepare('DELETE FROM contact_messages WHERE id = ?').run(ins.lastInsertRowid);
  line('delete changes', del.changes);

  // ILIKE search
  const search = db.prepare('SELECT id, name FROM products WHERE name LIKE ? ORDER BY id').all('%zuno%');
  line('ILIKE search', search.map((r) => r.name));

  // ON CONFLICT upsert (settings)
  db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
    .run('__test_key', 'v1');
  db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
    .run('__test_key', 'v2');
  line('upsert value', getSetting('__test_key'));
  db.prepare('DELETE FROM settings WHERE key = ?').run('__test_key');

  // audit + analytics
  logAudit({ type: 'system', id: 1, email: 'x@y.z' }, 'test_action', 'details', '127.0.0.1');
  trackEvent('pageview', '/test', 'ref');
  line('audit count', db.prepare('SELECT COUNT(*) c FROM audit_logs').get().c);
  line('events count', db.prepare('SELECT COUNT(*) c FROM analytics_events').get().c);

  console.log('\nPG ADAPTER TEST: PASS');
  process.exit(0);
} catch (e) {
  console.error('\nPG ADAPTER TEST: FAIL');
  console.error(e);
  process.exit(1);
}
