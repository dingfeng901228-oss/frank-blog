// src/lib/cms/crypto.ts
// PBKDF2-SHA256 + SHA-256 + base64url utilities
// Reference: scripts/seed-admin.mjs (same hash format for seeding)
//
// Format: pbkdf2_sha256$<iterations>$<salt_b64url>$<hash_b64url>

// ────────────────────────────────────────────────────
// Constants (must match scripts/seed-admin.mjs)
// ────────────────────────────────────────────────────

export const PBKDF2_ITERATIONS = 100_000;
export const SALT_BYTES         = 16;
export const HASH_BYTES         = 32;

// ────────────────────────────────────────────────────
// Password hashing (PBKDF2-SHA256)
// ────────────────────────────────────────────────────

/** Hash plain password → "pbkdf2_sha256$<iterations>$<salt_b64url>$<hash_b64url>" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
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
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    HASH_BYTES * 8
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

/** Parse stored hash string → { iterations, salt, hash } for verification. */
export function parsePasswordHash(stored: string): {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
} {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
    throw new Error('Invalid password hash format');
  }
  return {
    iterations: parseInt(parts[1], 10),
    salt: fromBase64Url(parts[2]),
    hash: fromBase64Url(parts[3]),
  };
}

// ────────────────────────────────────────────────────
// SHA-256 + random bytes
// ────────────────────────────────────────────────────

/** SHA-256 of input string → lowercase hex (for session token hashing). */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(hashBuffer));
}

/** Random N bytes → Uint8Array (for session tokens, salts). */
export function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

// ────────────────────────────────────────────────────
// Base64URL encode/decode (no padding)
// ────────────────────────────────────────────────────

/** Base64URL encode (RFC 4648 §5). */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Base64URL decode (RFC 4648 §5). */
export function fromBase64Url(s: string): Uint8Array {
  let padded = s.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
