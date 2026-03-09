import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Runs the database schema (CREATE TABLE IF NOT EXISTS, etc.) so the app
 * works without manually running SQL. Safe to run on every startup (idempotent).
 * Use this when the host (e.g. Render free) has no SQL query UI.
 */
export async function initDb(pool) {
  const schemaPath = path.join(__dirname, '..', 'database-schema.sql');
  let sql = readFileSync(schemaPath, 'utf8');

  // Remove single-line comments (-- ...) and split into statements
  const lines = sql.split('\n');
  const withoutComments = lines
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('--')) return '';
      return line;
    })
    .join('\n');

  const statements = withoutComments
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    const full = statement.endsWith(';') ? statement : statement + ';';
    try {
      await pool.query(full);
    } catch (err) {
      // Ignore "already exists" type errors; log others
      if (err.code !== '42P07' && err.code !== '42710') {
        console.error('Schema init warning:', err.message);
      }
    }
  }
  console.log('Database schema initialized (tables ready).');
}
