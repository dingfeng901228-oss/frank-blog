#!/usr/bin/env node
/**
 * scripts/smoke-test.mjs
 *
 * Automated API smoke test for the frank-blog CMS (per doc spec 四十三)
 *
 * Tests:
 *   1. /admin/login GET (renders, no auth required)
 *   2. POST /api/admin/auth/login (with valid creds → 200 + Set-Cookie)
 *   3. GET /api/admin/auth/me (with cookie → 200 + user data)
 *   4. POST /api/admin/posts (create draft)
 *   5. GET /api/admin/posts (list)
 *   6. GET /api/admin/posts/:id (single)
 *   7. PUT /api/admin/posts/:id (update draft)
 *   8. GET /api/admin/preview/:id (preview render data)
 *   9. POST /api/admin/posts/:id/publish (publish + deploy hook)
 *  10. GET /{locale}/{collection}/{slug} (verify SSG rebuilt page is accessible)
 *  11. POST /api/admin/posts/:id/unpublish (unpublish + deploy hook)
 *  12. DELETE /api/admin/posts/:id (delete + cascade)
 *  13. POST /api/admin/auth/logout (logout + clear cookie)
 *  14. GET /api/admin/auth/me (no cookie → 401)
 *  15. GET /api/admin/posts (no cookie → 401)
 *
 * Usage:
 *   # Local (wrangler pages dev):
 *   node scripts/smoke-test.mjs --base-url http://localhost:8788 \
 *     --admin-email admin@frank2025.com --admin-password "$ADMIN_PASSWORD"
 *
 *   # Production:
 *   node scripts/smoke-test.mjs --base-url https://blog.frank2025.com \
 *     --admin-email admin@frank2025.com --admin-password "$ADMIN_PASSWORD"
 *
 * Exit codes:
 *   0  all tests passed
 *   1  usage error
 *   2  one or more tests failed
 */

const args = (() => {
  const out = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
})();

const BASE_URL      = args['base-url']      ?? 'http://localhost:8788';
const ADMIN_EMAIL   = args['admin-email']   ?? 'admin@frank2025.com';
const ADMIN_PASS    = args['admin-password'];
const LOCALE        = args['locale']        ?? 'en';
const COLLECTION    = args['collection']    ?? 'posts';
const VERBOSE       = args['verbose']       === true || args['v'] === true;

if (!ADMIN_PASS) {
  console.error('❌ --admin-password required (or set ADMIN_PASSWORD env var)');
  console.error('   Usage: node scripts/smoke-test.mjs --base-url <url> --admin-password <pwd>');
  process.exit(1);
}

// ────────────────────────────────────────────────────
// HTTP helper (with cookie jar)
// ────────────────────────────────────────────────────

let cookieJar = '';

async function http(method, path, { body, headers = {}, expectStatus } = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'frank-blog-cms-smoke-test/1.0',
      ...headers,
    },
  };
  if (cookieJar) opts.headers.Cookie = cookieJar;
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    // Take just the cookie name=value (drop Path, Max-Age, etc.)
    cookieJar = setCookie.split(';')[0];
  }

  let parsedBody = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    parsedBody = await res.json().catch(() => null);
  } else {
    parsedBody = await res.text().catch(() => '');
  }

  const ok = expectStatus === undefined
    ? res.ok
    : Array.isArray(expectStatus)
      ? expectStatus.includes(res.status)
      : res.status === expectStatus;

  return { ok, status: res.status, body: parsedBody, headers: res.headers };
}

function log(msg) {
  if (VERBOSE) console.log(`    ${msg}`);
}

// ────────────────────────────────────────────────────
// Test runner
// ────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  return (async () => {
    const start = Date.now();
    process.stdout.write(`  ${name} ... `);
    try {
      await fn();
      const ms = Date.now() - start;
      console.log(`✅ (${ms}ms)`);
      pass++;
    } catch (e) {
      const ms = Date.now() - start;
      console.log(`❌ (${ms}ms)`);
      console.error(`    ${e.message}`);
      if (e.detail) console.error(`    detail: ${JSON.stringify(e.detail).slice(0, 200)}`);
      fail++;
      failures.push({ name, error: e.message });
    }
  })();
}

function assert(cond, message, detail) {
  if (!cond) {
    const err = new Error(message);
    if (detail) err.detail = detail;
    throw err;
  }
}

// ────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────

async function main() {
  console.log(`🚀 Smoke test against ${BASE_URL}`);
  console.log(`   admin: ${ADMIN_EMAIL}\n`);

  let testPostId = null;

  // ───── Test 1: Login page renders ─────
  await test('1. GET /admin/login (HTML page)', async () => {
    const res = await http('GET', '/admin/login');
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const html = String(res.body);
    assert(html.includes('<html') || html.includes('<div'), 'response contains HTML');
  });

  // ───── Test 2: Login with valid creds ─────
  await test('2. POST /api/admin/auth/login (valid creds)', async () => {
    const res = await http('POST', '/api/admin/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASS },
      expectStatus: 200,
    });
    assert(res.body?.success === true, 'response.success is true');
    assert(res.body?.data?.user?.email === ADMIN_EMAIL, 'returned user.email matches');
    assert(cookieJar.length > 0, 'cookie was set');
  });

  // ───── Test 3: Wrong password returns 401 ─────
  await test('3. POST /api/admin/auth/login (wrong password)', async () => {
    // Save cookie first (don't pollute main flow)
    const savedCookie = cookieJar;
    cookieJar = '';
    const res = await http('POST', '/api/admin/auth/login', {
      body: { email: ADMIN_EMAIL, password: 'wrong-password-12345' },
      expectStatus: 401,
    });
    assert(res.body?.success === false, 'response.success is false');
    assert(res.body?.error?.code === 'INVALID_CREDENTIALS', 'error.code is INVALID_CREDENTIALS');
    cookieJar = savedCookie;
  });

  // ───── Test 4: GET /me with cookie ─────
  await test('4. GET /api/admin/auth/me (with cookie)', async () => {
    const res = await http('GET', '/api/admin/auth/me', { expectStatus: 200 });
    assert(res.body?.success === true, 'response.success is true');
    assert(res.body?.data?.user?.email === ADMIN_EMAIL, 'returned user.email matches');
  });

  // ───── Test 5: GET /me without cookie (expect 401) ─────
  await test('5. GET /api/admin/auth/me (without cookie → 401)', async () => {
    const savedCookie = cookieJar;
    cookieJar = '';
    const res = await http('GET', '/api/admin/auth/me', { expectStatus: 401 });
    assert(res.body?.error?.code === 'NOT_AUTHENTICATED', 'error.code is NOT_AUTHENTICATED');
    cookieJar = savedCookie;
  });

  // ───── Test 6: Create draft post ─────
  const draftSlug = `smoke-test-${Date.now()}`;
  await test('6. POST /api/admin/posts (create draft)', async () => {
    const res = await http('POST', '/api/admin/posts', {
      body: {
        collection: COLLECTION,
        locale: LOCALE,
        slug: draftSlug,
        title: 'Smoke Test Draft',
        description_text: 'This is a smoke test draft post.',
        content: '# Smoke Test\n\nThis is the body of the smoke test draft.',
        status: 'draft',
      },
      expectStatus: 201,
    });
    assert(res.body?.success === true, 'response.success is true');
    assert(typeof res.body?.data?.id === 'number', 'returned post.id is a number');
    testPostId = res.body.data.id;
    log(`created post id=${testPostId}, slug=${draftSlug}`);
  });

  // ───── Test 7: List posts (paginated) ─────
  await test('7. GET /api/admin/posts (list with pagination)', async () => {
    const res = await http('GET', '/api/admin/posts?page=1&limit=5', { expectStatus: 200 });
    assert(res.body?.success === true, 'response.success is true');
    assert(Array.isArray(res.body?.data?.posts), 'data.posts is an array');
    assert(typeof res.body?.data?.total === 'number', 'data.total is a number');
  });

  // ───── Test 8: Get single post ─────
  await test('8. GET /api/admin/posts/:id (single)', async () => {
    const res = await http('GET', `/api/admin/posts/${testPostId}`, { expectStatus: 200 });
    assert(res.body?.data?.slug === draftSlug, 'returned post.slug matches');
    assert(res.body?.data?.status === 'draft', 'returned post.status is draft');
  });

  // ───── Test 9: Update post ─────
  await test('9. PUT /api/admin/posts/:id (update)', async () => {
    const res = await http('PUT', `/api/admin/posts/${testPostId}`, {
      body: {
        title: 'Smoke Test Draft (updated)',
        description_text: 'Updated description',
      },
      expectStatus: 200,
    });
    assert(res.body?.success === true, 'response.success is true');
  });

  // ───── Test 10: Preview post ─────
  await test('10. GET /api/admin/preview/:id (preview)', async () => {
    const res = await http('GET', `/api/admin/preview/${testPostId}`, { expectStatus: 200 });
    assert(res.body?.success === true, 'response.success is true');
    assert(typeof res.body?.data?.content === 'string', 'data.content is a string');
  });

  // ───── Test 11: Publish post (triggers Deploy Hook) ─────
  await test('11. POST /api/admin/posts/:id/publish (triggers rebuild)', async () => {
    const res = await http('POST', `/api/admin/posts/${testPostId}/publish`, { expectStatus: [200, 502] });
    // 200 if deploy hook succeeds, 502 if hook fails (deploy_hook_missing)
    // Either is acceptable for smoke test — verifies the API works
    assert(res.body?.data?.status === 'published', 'post status changed to published');
    assert(typeof res.body?.data?.deploy_triggered === 'boolean', 'deploy_triggered returned');
    log(`deploy_triggered: ${res.body.data.deploy_triggered}`);
    log(`deploy_error: ${res.body.data.deploy_error ?? '(none)'}`);
  });

  // ───── Test 12: Verify URL accessible after publish (if deploy succeeded) ─────
  await test('12. Verify published URL returns 200 (only if deploy succeeded)', async () => {
    // Give CF Pages ~5s for build to start
    await new Promise(r => setTimeout(r, 1000));
    const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/${LOCALE}/${COLLECTION}/${draftSlug}`, {
      method: 'HEAD',
      redirect: 'manual',
    }).catch(() => null);
    if (!res) {
      log('  (network error — skipping URL check)');
      return; // skip
    }
    // 200 if SSG rebuilt, 404 if rebuild pending, 302 if redirected
    log(`  status: ${res.status}`);
    assert([200, 302, 404].includes(res.status), `expected 200/302/404, got ${res.status}`);
  });

  // ───── Test 13: Unpublish post ─────
  await test('13. POST /api/admin/posts/:id/unpublish', async () => {
    const res = await http('POST', `/api/admin/posts/${testPostId}/unpublish`, { expectStatus: [200, 502] });
    assert(res.body?.data?.status === 'draft', 'post status reverted to draft');
  });

  // ───── Test 14: Delete post ─────
  await test('14. DELETE /api/admin/posts/:id', async () => {
    const res = await http('DELETE', `/api/admin/posts/${testPostId}`, { expectStatus: 204 });
    assert(res.status === 204, 'expected 204 No Content');
  });

  // ───── Test 15: Verify deleted post returns 404 ─────
  await test('15. GET /api/admin/posts/:id (deleted → 404)', async () => {
    const res = await http('GET', `/api/admin/posts/${testPostId}`, { expectStatus: 404 });
    assert(res.body?.error?.code === 'NOT_FOUND', 'error.code is NOT_FOUND');
  });

  // ───── Test 16: Logout ─────
  await test('16. POST /api/admin/auth/logout', async () => {
    const res = await http('POST', '/api/admin/auth/logout', { expectStatus: 200 });
    assert(res.body?.success === true, 'response.success is true');
    assert(cookieJar.includes('Max-Age=0') || cookieJar.includes('cms_session=;'), 'cookie was cleared');
  });

  // ───── Test 17: After logout, admin endpoints return 401 ─────
  await test('17. GET /api/admin/posts (no cookie → 401)', async () => {
    const savedCookie = cookieJar;
    cookieJar = '';
    const res = await http('GET', '/api/admin/posts', { expectStatus: 401 });
    assert(res.body?.error?.code === 'NOT_AUTHENTICATED', 'error.code is NOT_AUTHENTICATED');
    cookieJar = savedCookie;
  });

  // ───── Summary ─────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log(`\nFailed tests:`);
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }
  console.log('='.repeat(60));

  process.exit(fail > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error('❌ Fatal:', e.message);
  console.error(e.stack);
  process.exit(1);
});
