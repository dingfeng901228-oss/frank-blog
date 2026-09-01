#!/usr/bin/env node
/**
 * scripts/seed-admin.mjs
 *
 * Phase 1 admin seed — creates / updates admin@frank2025.com with PBKDF2-SHA256 password hash.
 *
 * Per D-4:
 *   username: admin@frank2025.com
 *   role: admin
 *   password: from ADMIN_PASSWORD env var (.env.local is gitignored)
 *   NEVER logged in plaintext, NEVER persisted in D1 in clear
 *
 * Password hash format (stored in users.password_hash):
 *   pbkdf2_sha256$<iterations>$<salt_b64url>$<hash_b64url>
 *   iterations = 100_000
 *   salt       = 16 random bytes
 *   hash       = 32 derived bytes (PBKDF2-SHA256)
 *
 * Usage:
 *   # 1. Set ADMIN_PASSWORD in .env.local (gitignored) — NEVER inline in shell history
 *   echo 'ADMIN_PASSWORD=YourSecurePassword!2026' >> .env.local
 *
 *   # 2. Dry-run first (no D1 write)
 *   node scripts/seed-admin.mjs --dry-run
 *
 *   # 3. Local D1
 *   node scripts/seed-admin.mjs --local
 *
 *   # 4. Remote D1 (production)
 *   node scripts/seed-admin.mjs --remote
 *
 * Idempotent:
 *   - ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash
 *   - Re-running with same email just rotates the password.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webcrypto as crypto } from 'node:crypto';

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const ADMIN_EMAIL = 'admin@frank2025.com';

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function toBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hashPassword(password) {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    HASH_BYTES * 8
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

async function main() {
  loadEnvLocal();

  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error('❌ ADMIN_PASSWORD env var required.');
    console.error('   Add to .env.local (gitignored):');
    console.error('     ADMIN_PASSWORD=YourSecurePassword!2026');
    console.error('   Then re-run: node scripts/seed-admin.mjs --local');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('❌ ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const target = args.has('--remote') ? '--remote' : args.has('--local') ? '--local' : null;

  if (!dryRun && !target) {
    console.error('❌ Specify --local or --remote (or --dry-run for SQL preview).');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const sql = `-- scripts/seed-admin.mjs -- ${new Date().toISOString()}
-- Idempotent: ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash
INSERT INTO users (username, email, password_hash, role, status, display_name)
VALUES (
  '${ADMIN_EMAIL}',
  '${ADMIN_EMAIL}',
  '${passwordHash}',
  'admin',
  'active',
  'Frank Ding'
)
ON CONFLICT(email) DO UPDATE SET
  password_hash = excluded.password_hash,
  updated_at    = datetime('now')
;
`;

  console.log(`Seeding admin: ${ADMIN_EMAIL}`);
  console.log(`Hash prefix:   ${passwordHash.slice(0, 70)}…`);

  if (dryRun) {
    console.log('\n--- DRY RUN (no D1 write) ---');
    console.log(sql);
    console.log('--- end DRY RUN ---');
    return;
  }

  // Write SQL to temp file, then wrangler d1 execute --file=
  // (avoids shell escaping issues with --command)
  const tmpFile = join(tmpdir(), `seed-admin-${process.pid}-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql, { mode: 0o600 });

  try {
    console.log(`\nExecuting via wrangler d1 (${target})…`);
    execSync(
      `npx wrangler d1 execute frank-blog-db ${target} --file="${tmpFile}"`,
      { stdio: 'inherit', cwd: process.cwd() }
    );
    console.log('\n✅ Admin user seeded successfully.');
  } catch (e) {
    console.error('\n❌ D1 execute failed.');
    console.error('   Common causes:');
    console.error('   - migrations/0001_initial.sql not yet applied — run:');
    console.error('     npx wrangler d1 migrations apply frank-blog-db ' + target);
    console.error('   - wrangler.toml missing [[d1_databases]] binding');
    console.error('   - .env.local ADMIN_PASSWORD not set');
    process.exit(1);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});