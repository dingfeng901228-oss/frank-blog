# worker-api/migrations/

**This directory is auto-synced from `../migrations/` by `scripts/sync-migrations-to-worker-api.mjs`.**

Do not edit files here directly. Edit `../migrations/` at the repo root and re-run:

```bash
node scripts/sync-migrations-to-worker-api.mjs
```

This indirection exists because:
- `wrangler d1 migrations apply` in v4 looks for `migrations/` next to `wrangler.toml`
- ADR-007 keeps a single source of truth at the repo root
- This worker-api/migrations/ is a deploy-time mirror
