// src/lib/cms/crypto.ts
// PBKDF2-SHA256 + SHA-256 utilities — Phase 3 IMPLEMENTATION
//
// Reference: scripts/seed-admin.mjs (already implements hash for seeding)
// Format: pbkdf2_sha256$<iterations>$<salt_b64url>$<hash_b64url>

// ────────────────────────────────────────────────────
// Constants (must match scripts/seed-admin.mjs)
// ────────────────────────────────────────────────────

export const PBKDF2_ITERATIONS = 100_000;
export const SALT_BYTES         = 16;
export const HASH_BYTES         = 32;

// ────────────────────────────────────────────────────
// Phase 3 — Implement
// ────────────────────────────────────────────────────

/** Hash plain password → "pbkdf2_sha256$<iterations>$<salt_b64url>$<hash_b64url>" */
export async function hashPassword(password: string): Promise<string> {
  // TODO Phase 3: Web Crypto subtle.deriveBits(PBKDF2) → base64url
  throw new Error('Not implemented — Phase 3 (see scripts/seed-admin.mjs for reference)');
}

/** Parse stored hash string → { iterations, salt, hash } for verification */
export function parsePasswordHash(stored: string): {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
} {
  // TODO Phase 3: split on $, base64url decode salt + hash
  throw new Error('Not implemented — Phase 3');
}

/** SHA-256 of input → hex string (for session token hashing) */
export async function sha256Hex(input: string): Promise<string> {
  // TODO Phase 3: TextEncoder + crypto.subtle.digest('SHA-256') → hex
  throw new Error('Not implemented — Phase 3');
}

/** Random N bytes → Uint8Array (for session tokens, salts) */
export function randomBytes(n: number): Uint8Array {
  // TODO Phase 3: crypto.getRandomValues(new Uint8Array(n))
  throw new Error('Not implemented — Phase 3');
}

/** Base64URL encode (no padding) — matches scripts/seed-admin.mjs format */
export function toBase64Url(bytes: Uint8Array): string {
  // TODO Phase 3: Buffer.from(bytes).toString('base64') → replace +/= chars
  throw new Error('Not implemented — Phase 3');
}
