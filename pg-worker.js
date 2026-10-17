/**
 * ZUNO TECHNOLOGIES — PostgreSQL worker.
 *
 * Runs inside a worker thread and owns the real `pg` connection. It receives
 * query requests from the main thread over the message port, executes them
 * against Postgres, and writes the JSON result back into a SharedArrayBuffer
 * so the main thread can read it synchronously.
 *
 * This lets the existing synchronous database code (db.prepare(...).get/all/run)
 * run unchanged on top of a networked Postgres database (Neon / Supabase / Render).
 */
const { parentPort, workerData } = require('node:worker_threads');
const { Client, types } = require('pg');

/* Return bigint / numeric as JS numbers so `COUNT(*) === 0` style checks work. */
types.setTypeParser(20, (v) => (v == null ? null : parseInt(v, 10)));   // int8
types.setTypeParser(1700, (v) => (v == null ? null : parseFloat(v)));   // numeric

const SHARED = workerData.SHARED;
const ctrl = new Int32Array(SHARED, 0, 2);       // [0] = flag, [1] = payload length
const data = new Uint8Array(SHARED, 8);          // payload region

let client = null;
let connectError = null;
const queue = [];

const url = workerData.url;
const needsSsl = !/localhost|127\.0\.0\.1/.test(url) && !/sslmode=disable/.test(url);

/* ------------------------------------------------------------------ */
/* SQL translation: SQLite dialect -> PostgreSQL dialect               */
/* ------------------------------------------------------------------ */
function translate(sql) {
  let s = String(sql).trim();
  if (/^PRAGMA/i.test(s)) return null;                 // no-op on Postgres

  // INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
  if (/INSERT\s+OR\s+IGNORE/i.test(s)) {
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    if (!/ON CONFLICT/i.test(s)) s += ' ON CONFLICT DO NOTHING';
  }
  // INSERT OR REPLACE -> INSERT ... (best effort) ON CONFLICT DO NOTHING
  if (/INSERT\s+OR\s+REPLACE/i.test(s)) {
    s = s.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
    if (!/ON CONFLICT/i.test(s)) s += ' ON CONFLICT DO NOTHING';
  }

  // date/time functions (SQLite -> Postgres). Timestamp columns are TEXT.
  const FMT = "'YYYY-MM-DD HH24:MI:SS'";
  // datetime('now', '-7 days')  /  datetime('now', ?)   (2-arg form first)
  s = s.replace(/datetime\(\s*'now'\s*,\s*'([^']*)'\s*\)/gi,
    (m, iv) => `to_char(now() at time zone 'utc' + interval '${iv}', ${FMT})`);
  s = s.replace(/datetime\(\s*'now'\s*,\s*(\?)\s*\)/gi,
    () => `to_char(now() at time zone 'utc' + ((?)::interval), ${FMT})`);
  // datetime('now')
  s = s.replace(/datetime\(\s*'now'\s*\)/gi, `to_char(now() at time zone 'utc', ${FMT})`);
  // date('now')
  s = s.replace(/date\(\s*'now'\s*\)/gi, 'CURRENT_DATE');
  // date(column) -> left(column, 10)
  s = s.replace(/\bdate\(\s*([a-z_][a-z0-9_.]*)\s*\)/gi, 'left($1, 10)');
  s = s.replace(/strftime\(\s*'%Y-%m-%d'\s*,\s*'now'\s*\)/gi, "to_char(now() at time zone 'utc','YYYY-MM-DD')");

  // case-insensitive search (SQLite LIKE is case-insensitive for ASCII)
  s = s.replace(/\bLIKE\b/g, 'ILIKE');

  // positional placeholders ? -> $1, $2, ...
  let i = 0;
  s = s.replace(/\?/g, () => '$' + (++i));

  return s;
}

async function run(msg) {
  let sql = translate(msg.sql);
  if (sql === null) return { changes: 0 };

  const params = Array.isArray(msg.params) ? msg.params : [];

  // For INSERTs, ask Postgres to return the new row so we can expose lastInsertRowid.
  if (msg.mode === 'run' && /^\s*INSERT\b/i.test(sql) && !/RETURNING/i.test(sql)) {
    sql += ' RETURNING *';
  }

  const res = await client.query(sql, params);

  if (msg.mode === 'all') return res.rows;
  if (msg.mode === 'get') return res.rows[0] || undefined;

  const out = { changes: res.rowCount };
  if (res.rows && res.rows[0] && Object.prototype.hasOwnProperty.call(res.rows[0], 'id')) {
    out.lastInsertRowid = res.rows[0].id;
  }
  return out;
}

function respond(msg, payload) {
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  if (bytes.length > data.length) {
    const err = Buffer.from(JSON.stringify({ __error: 'Result too large for shared buffer' }), 'utf8');
    data.set(err);
    Atomics.store(ctrl, 1, err.length);
  } else {
    data.set(bytes);
    Atomics.store(ctrl, 1, bytes.length);
  }
  Atomics.store(ctrl, 0, 1);
  Atomics.notify(ctrl, 0);
}

async function handle(msg) {
  let payload;
  try {
    if (connectError) throw new Error(connectError);
    const value = await run(msg);
    payload = { value };
  } catch (e) {
    payload = { __error: e && e.message ? e.message : String(e) };
  }
  respond(msg, payload);
}

parentPort.on('message', (msg) => {
  if (!client) { queue.push(msg); return; }
  handle(msg);
});

(async () => {
  try {
    const cfg = { connectionString: url, max: 4, connectionTimeoutMillis: 20000 };
    if (needsSsl) cfg.ssl = { rejectUnauthorized: false };
    client = new Client(cfg);
    await client.connect();
    parentPort.postMessage('ready');
    while (queue.length) handle(queue.shift());
  } catch (e) {
    connectError = 'Database connection failed: ' + (e && e.message ? e.message : String(e));
    parentPort.postMessage('error');
    while (queue.length) handle(queue.shift());
  }
})();

process.on('unhandledRejection', (e) => { console.error('[pg-worker] unhandledRejection', e); });
