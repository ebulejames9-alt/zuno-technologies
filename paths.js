/**
 * Central path configuration.
 *
 * On a host with a persistent volume (or a paid Render disk), point
 * ZUNO_DATA_DIR at the mount (e.g. /data) so the SQLite database AND the
 * uploaded media survive restarts and redeploys:
 *
 *   ZUNO_DATA_DIR=/data            -> DB at /data/zuno.db, uploads at /data/uploads
 *   DB_PATH=/data/zuno.db          -> override the database file directly
 *   UPLOAD_DIR=/data/uploads       -> override the uploads root directly
 *
 * With nothing set, everything stays inside the project folder (local dev).
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.ZUNO_DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'zuno.db');
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const PUBLIC_UPLOADS = path.join(UPLOAD_ROOT, 'public');
const PRIVATE_UPLOADS = path.join(UPLOAD_ROOT, 'private');

for (const dir of [DATA_DIR, UPLOAD_ROOT, PUBLIC_UPLOADS, PRIVATE_UPLOADS]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = { DATA_DIR, DB_PATH, UPLOAD_ROOT, PUBLIC_UPLOADS, PRIVATE_UPLOADS };
