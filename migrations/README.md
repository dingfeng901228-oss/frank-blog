# D1 Migrations

> Cloudflare D1 schema management for frank-blog-cms
> Per **ADR-007** + **D-3**: `database_name = "frank-blog-db"`, `binding = "DB"`
> Per **ADR-008** + **D-2/D-6**: Local → Preview → Production, idempotent

---

## 命名规则

`NNNN_descriptive_name.sql` — 4 位序号 + 下划线 + snake_case 描述

```
0001_initial.sql                 -- 11 张表 + 索引 + 默认 settings
0002_seed_admin.sql              -- (Phase 3) 第一个 admin 账号
0003_*.sql                       -- 未来增量迁移
```

---

## 三阶段应用流程

**绝不允许**直接修改 production D1 schema。每条 migration 必须经过三个环境：

```bash
# 1. Local —— 本地开发数据库（每个开发者一个）
wrangler d1 migrations apply frank-blog-db --local

# 2. Preview —— CF Pages preview deploy 数据库
wrangler d1 migrations apply frank-blog-db --remote --env preview

# 3. Production —— 生产数据库
wrangler d1 migrations apply frank-blog-db --remote --env production
```

> `wrangler d1 migrations apply` 自动把已应用的 migration 写入 D1 内置的 `d1_migrations` 表，下次 apply 会跳过。**幂等**。

---

## 创建 / 查看 migration 状态

```bash
# 创建生产 D1（首次部署时）
wrangler d1 create frank-blog-db
# 输出 database_id → 填到 wrangler.toml 的 [[d1_databases]] block

# 查看本地已应用 migration
wrangler d1 migrations list frank-blog-db --local

# 查看生产已应用 migration
wrangler d1 migrations list frank-blog-db --remote
```

---

## 编写 migration 的硬约束

### 必须

- ✅ 单文件单次事务（不要在 .sql 文件里写 `BEGIN`/`COMMIT`，wrangler 自动 wrap）
- ✅ 幂等：用 `IF NOT EXISTS` / `CREATE OR REPLACE` / `ON CONFLICT DO NOTHING`
- ✅ 索引随表一起创建（同一文件，避免后续 migration 漏加）
- ✅ 字段命名 snake_case，时间戳用 `TEXT DEFAULT (datetime('now'))`
- ✅ 外键必须有 `ON DELETE` 子句（CASCADE / SET NULL / RESTRICT）

### 禁止

- ❌ 直接 `wrangler d1 execute` 修改 schema（绕过 migration tracking）
- ❌ 在 production D1 上手工 ALTER TABLE
- ❌ 一个 migration 同时改多张不相关表（拆分）
- ❌ 删除已有列 / 表（除非明确数据已迁走，单独 migration）

---

## Migration vs 数据迁移（D-6 数据迁移 ≠ schema migration）

> **注意**：本目录的 `*.sql` 文件管理的是 **schema**（表结构）。
> 旧 MDX 文件 → D1 的 **数据导入** 由 `scripts/migrate-md-to-d1.ts`（Phase 8）负责，按 ADR-008 7 步走（Backup → Dry Run → Count Check → Validate → Import → Verify → Switch）。

---

## 三个 D1 数据库命名建议

| 环境 | database_name | 创建命令 |
|---|---|---|
| Local | `frank-blog-db-dev`（或直接用 `--local` flag，wrangler 用 miniflare 本地 sqlite 文件） | `wrangler d1 create frank-blog-db-dev` |
| Preview | `frank-blog-db-preview` | `wrangler d1 create frank-blog-db-preview` |
| Production | `frank-blog-db` | `wrangler d1 create frank-blog-db` |

---

## 当前已应用 migrations

- ✅ `0001_initial.sql` — 11 张表 + 18 个索引 + 默认 settings seed

---

## 关联文档

- [`../docs/ADR.md`](../docs/ADR.md) — ADR-007（migration 流程）+ ADR-008（数据迁移 7 步）+ D-3（D1 命名）
- [`../docs/PHASE-0-ANALYSIS.md`](../docs/PHASE-0-ANALYSIS.md) — Phase 0 报告 + Phase 1 输入