/**
 * ZUNO TECHNOLOGIES — PostgreSQL driver (main thread).
 *
 * Exposes the SAME synchronous API the rest of the app already uses
 * (db.exec / db.prepare(sql).get|all|run) but backed by a real Postgres
 * database (Neon / Supabase / Render Postgres) through a worker-thread bridge.
 *
 * Activated automatically when DATABASE_URL is set.
 */
const { Worker } = require('node:worker_threads');
const path = require('node:path');

const SHARED = new SharedArrayBuffer(16 * 1024 * 1024); // 16 MB result buffer
const ctrl = new Int32Array(SHARED, 0, 2);
const data = new Uint8Array(SHARED, 8);

let worker = null;
let workerReady = false;
let workerFailed = false;
let seq = 0;

function startWorker() {
  worker = new Worker(path.join(__dirname, 'pg-worker.js'), {
    workerData: { SHARED, url: process.env.DATABASE_URL }
  });
  worker.on('message', (m) => {
    if (m === 'ready') workerReady = true;
    if (m === 'error') workerFailed = true;
  });
  worker.on('error', (e) => {
    workerFailed = true;
    console.error('[pg] worker error:', e && e.message ? e.message : e);
  });
}
startWorker();

/** Blocking call into the worker. Returns the decoded result. */
function call(mode, sql, params) {
  if (!worker) throw new Error('Database worker not started');
  const id = ++seq;
  Atomics.store(ctrl, 0, 0);
  worker.postMessage({ id, mode, sql, params: params || [] });

  // Wait (synchronously) for the worker to publish a result.
  const deadline = Date.now() + 60000;
  while (Atomics.load(ctrl, 0) === 0) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Database query timed out');
    Atomics.wait(ctrl, 0, 0, Math.min(remaining, 60000));
  }

  const len = Atomics.load(ctrl, 1);
  const bytes = Buffer.from(data.buffer, data.byteOffset, len);
  const res = JSON.parse(bytes.toString('utf8'));
  if (res && res.__error) throw new Error(res.__error);
  return res ? res.value : undefined;
}

/* ------------------------------------------------------------------ */
/* SCHEMA (PostgreSQL)                                                 */
/* ------------------------------------------------------------------ */
const TS = "to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT DEFAULT 'Administrator',
  role TEXT DEFAULT 'owner',
  created_at TEXT DEFAULT (${TS}),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'active',
  email_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (${TS}),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_type TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  user_agent TEXT,
  ip TEXT,
  created_at TEXT DEFAULT (${TS}),
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (${TS})
);

CREATE TABLE IF NOT EXISTS content_blocks (
  id SERIAL PRIMARY KEY,
  section_key TEXT UNIQUE NOT NULL,
  title TEXT,
  body TEXT,
  draft_title TEXT,
  draft_body TEXT,
  status TEXT DEFAULT 'published',
  visible INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (${TS}),
  draft_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS values_list (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'spark',
  sort_order INTEGER DEFAULT 0,
  visible INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'coming_soon',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (${TS})
);

CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT,
  sort_order INTEGER DEFAULT 0,
  published INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  ip TEXT,
  created_at TEXT DEFAULT (${TS})
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'General',
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT (${TS}),
  updated_at TEXT DEFAULT (${TS})
);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL,
  author_id INTEGER,
  author_name TEXT,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (${TS})
);

CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  original_name TEXT,
  stored_name TEXT,
  mimetype TEXT,
  size INTEGER,
  created_at TEXT DEFAULT (${TS})
);

CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mimetype TEXT,
  size INTEGER,
  section TEXT,
  is_public INTEGER DEFAULT 1,
  uploaded_at TEXT DEFAULT (${TS})
);

CREATE TABLE IF NOT EXISTS media_blobs (
  stored_name TEXT PRIMARY KEY,
  scope TEXT,
  mimetype TEXT,
  data TEXT,
  created_at TEXT DEFAULT (${TS})
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (${TS})
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor_type TEXT,
  actor_id INTEGER,
  actor_email TEXT,
  action TEXT,
  details TEXT,
  ip TEXT,
  created_at TEXT DEFAULT (${TS})
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  page TEXT,
  ref TEXT,
  created_at TEXT DEFAULT (${TS})
);

CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_replies_ticket ON ticket_replies(ticket_id);
`;

/* ------------------------------------------------------------------ */
/* PUBLIC API (mirrors node:sqlite)                                    */
/* ------------------------------------------------------------------ */
const db = {
  exec(sql) {
    return call('exec', sql, []);
  },
  prepare(sql) {
    return {
      get: (...params) => call('get', sql, params),
      all: (...params) => call('all', sql, params),
      run: (...params) => call('run', sql, params)
    };
  }
};

function initSchema() {
  db.exec(SCHEMA);
}

function addColumn(table, col, def) {
  try {
    const rows = db
      .prepare('SELECT column_name FROM information_schema.columns WHERE table_name = ? AND column_name = ?')
      .all(table, col);
    if (!rows || !rows.length) {
      // All migrations in this project add TEXT columns.
      const type = /INTEGER|INT/i.test(def) ? 'INTEGER' : 'TEXT';
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    }
  } catch (e) {
    /* ignore */
  }
}

module.exports = { db, initSchema, addColumn, driver: 'postgres' };
