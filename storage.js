/**
 * ZUNO TECHNOLOGIES — file storage abstraction.
 *
 * Two backends, chosen automatically:
 *   • DATABASE_URL set  -> store file bytes in the database (Postgres).
 *     This is what makes uploaded images survive on free hosts whose
 *     filesystem is ephemeral (e.g. Render free web services).
 *   • otherwise         -> store files on disk (local / self-hosted with a volume).
 *
 * Public media (logos, product images) and private media (customer ticket
 * attachments) are kept in separate scopes; private files are never served
 * statically.
 */
const fs = require('fs');
const path = require('path');
const { PUBLIC_UPLOADS, PRIVATE_UPLOADS } = require('./paths');

const DB_MODE = !!process.env.DATABASE_URL;

function dirFor(scope) {
  return scope === 'private' ? PRIVATE_UPLOADS : PUBLIC_UPLOADS;
}

function ensureDirs() {
  try {
    fs.mkdirSync(PUBLIC_UPLOADS, { recursive: true });
    fs.mkdirSync(PRIVATE_UPLOADS, { recursive: true });
  } catch (e) { /* ignore */ }
}
ensureDirs();

function db() { return require('./db').db; }

/** Persist a buffer. Returns the stored name. */
function save(scope, storedName, buffer, mimetype) {
  if (DB_MODE) {
    db()
      .prepare(`INSERT INTO media_blobs (stored_name, scope, mimetype, data) VALUES (?,?,?,?)
                ON CONFLICT(stored_name) DO UPDATE SET data = excluded.data, mimetype = excluded.mimetype`)
      .run(storedName, scope, mimetype || 'application/octet-stream', buffer.toString('base64'));
  } else {
    fs.writeFileSync(path.join(dirFor(scope), storedName), buffer);
  }
  return storedName;
}

/** Read a stored file. Returns { buffer, mimetype } or null. */
function read(scope, storedName) {
  const safe = path.basename(String(storedName || ''));
  if (!safe) return null;
  if (DB_MODE) {
    const row = db().prepare('SELECT mimetype, data FROM media_blobs WHERE stored_name = ?').get(safe);
    if (!row) return null;
    return { buffer: Buffer.from(row.data || '', 'base64'), mimetype: row.mimetype };
  }
  const file = path.join(dirFor(scope), safe);
  if (!fs.existsSync(file)) return null;
  return { buffer: fs.readFileSync(file), mimetype: null };
}

/** Remove a stored file (best effort). */
function remove(scope, storedName) {
  const safe = path.basename(String(storedName || ''));
  if (!safe) return;
  if (DB_MODE) {
    try { db().prepare('DELETE FROM media_blobs WHERE stored_name = ?').run(safe); } catch (e) { /* ignore */ }
  } else {
    try { fs.unlinkSync(path.join(dirFor(scope), safe)); } catch (e) { /* ignore */ }
  }
}

/** Generate a safe unique stored filename for an upload. */
function makeName(originalName) {
  const ext = path.extname(String(originalName || '')).slice(0, 10).replace(/[^.\w]/g, '');
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
}

module.exports = { save, read, remove, makeName, DB_MODE };
