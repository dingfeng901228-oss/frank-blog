// src/lib/cms/db.ts
// D1 query helpers — typed wrapper around env.DB
// Per D-3: binding="DB", database_name="frank-blog-db"

import type { Env, D1Database, D1Result } from './types';

/** Get typed D1 binding; throws if not configured. */
export function getDB(env: Env): D1Database {
  if (!env.DB) {
    throw new Error(
      'D1 binding "DB" not configured — check wrangler.toml [[d1_databases]] block.'
    );
  }
  return env.DB;
}

/** SELECT … LIMIT 1 — returns first row or null. */
export async function queryFirst<T = unknown>(
  env: Env,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const stmt = getDB(env).prepare(sql).bind(...params);
  return await stmt.first<T>();
}

/** SELECT … — returns all rows (empty array if none). */
export async function queryAll<T = unknown>(
  env: Env,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const stmt = getDB(env).prepare(sql).bind(...params);
  const result = await stmt.all<T>();
  return result.results ?? [];
}

/** INSERT / UPDATE / DELETE — returns D1Result with meta (last_row_id, changes, etc.). */
export async function execute(
  env: Env,
  sql: string,
  params: unknown[] = []
): Promise<D1Result> {
  const stmt = getDB(env).prepare(sql).bind(...params);
  return await stmt.run();
}

/** Multi-statement batch (atomic transaction). */
export async function executeBatch(
  env: Env,
  statements: { sql: string; params?: unknown[] }[]
): Promise<D1Result[]> {
  const db = getDB(env);
  const prepared = statements.map((s) =>
    db.prepare(s.sql).bind(...(s.params ?? []))
  );
  return await db.batch(prepared);
}
