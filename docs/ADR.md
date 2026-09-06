# CMS 重构 — Architecture Decision Records

> **状态**：已锁定（2026-09-01，Frank 拍板）
> **范围**：博客 CMS 重构项目所有 ADR
> **原则**：以下决策不再讨论，直接进入实施。任何新决策必须新增 ADR 条目，**不得覆盖**已有条目。

---

## ADR-001：CMS API 部署形态 — Single Worker

**决策**：同一个 Worker 同时处理 `/api/*`、`/admin/*` 以及必要的前台请求。

**约束**：
- 不创建独立的 `blog-api.frank2025.com`
- 除非后续出现明确的性能 / 权限 / 架构需求，保持 Single Worker
- 代码必须模块化 — **不允许**把所有路由逻辑塞进单一 `worker.ts`

**影响**：
- 当前项目用 Pages Functions（`functions/api/*`），新 CMS 沿用同一 Workers 部署单元
- 路由层按模块拆：`functions/api/auth.ts`、`functions/api/admin/posts.ts`、…
- `/admin/*` SPA 静态资源走 Pages build，路由 fallback 由 Worker handler 接管

---

## ADR-002：前台渲染 — SSG 保持，Publish Hook 触发 Rebuild

**决策**：博客前台保持 SSG，不改造为 ISR / SSR。

**数据流**：
```
D1 (Publish)
   ↓
Publish Hook
   ↓
Cloudflare Pages Build
   ↓
SSG 输出新内容
   ↓
Production
```

**触发规则**：
- **触发生产 Build**：`Publish`、`Unpublish`
- **不触发 Build**：`Save Draft`、`Update Draft`

**实现**：
- 使用 Cloudflare Pages Deploy Hook（CMS → SSG 自动构建）
- Deploy Hook URL **必须**作为 Secret 保存（`CLOUDFLARE_DEPLOY_HOOK_URL`）
- **禁止**把 Deploy Hook URL 提交到 GitHub

---

## ADR-003：旧 Admin 路径兼容

**新 CMS**：`/admin/*`
**旧 CMS**（兼容 / 回滚）：`/_admin/*`

**阶段**：
1. 开发期间：旧 CMS 在 `/_admin` 保留运行
2. 新 CMS 完成并测试通过后：`/admin/login` 正式切换到新 CMS
3. `/_admin` 保留作为**临时回滚入口**
4. 新 CMS 稳定运行一段时间后，再删除 `/_admin`

**安全注意**：
- `/_admin` **只是兼容 / 回滚路径，不是安全措施**
- 旧 CMS **必须**继续保留认证保护（不能让 `/_admin` 变成裸奔入口）

---

## ADR-004：RBAC — admin / editor 双角色（UI 仅 admin）

**数据库**：`users.role` 预留 `admin` 和 `editor` 两个值。

**MVP 阶段**：
- UI **只实现** admin 角色
- **不实现**完整 Editor UI
- 数据库结构**必须**保证未来可以增加 editor 权限（不能 MVP 后再改 schema）

**未来扩展**（v1.1+）：
- editor 可以创建 / 编辑自己的 Draft
- editor 不能 Publish（需 admin 审批）
- admin 全权

---

## ADR-005：MDX — 保存原始 MDX 字符串

**决策**：`posts.content` 必须保存**原始 MDX 字符串**。

**禁止**：
- 把 MDX 转换成 HTML 后存进 D1 作为主要内容
- 出现两套 Renderer（CMS Preview Renderer + Frontend Renderer）

**目标**：
```
MDX Source
   ↓
Same Renderer
   ↓
Preview / Production
```

**实现**：
- CMS Preview：服务端调 Worker，Worker 用前端相同的 react-markdown + remark-gfm + rehype-* 渲染
- 前台 SSG：build 时调用同一渲染器
- **单一渲染路径**

---

## ADR-006：MVP 范围

**MVP（必做）**：
1. Admin Login
2. Authentication / Session
3. Dashboard
4. Posts CRUD
5. Draft / Published
6. Preview
7. Multi-language
8. Article Migration
9. Publish Hook
10. SSG Rebuild

**v1.1（暂不做）**：
- Categories
- Tags
- Media
- Advanced Revision
- Activity Log
- Editor UI（完整 RBAC）

**原则**：**不要**因为原始需求文档中存在这些功能就提前扩大 MVP 范围。

---

## ADR-007：数据库 Migration 流程

**强制**：
- D1 Schema 通过 `migrations/*.sql` 版本管理
- **禁止**直接修改生产数据库结构
- 执行流程：`Local` → `Preview` → `Production`
- 每次 migration 必须可追踪版本
- 使用 Cloudflare D1 官方 migration 机制（`wrangler d1 migrations apply`）

**migrations 目录**：
```
migrations/
  0001_initial.sql
  0002_*.sql
  ...
```

---

## ADR-008：数据迁移流程

旧博客 → D1 迁移必须遵循 7 步：

1. **Backup** — 旧文章 / metadata 完整备份
2. **Dry Run** — 模拟迁移，输出预期结果，不写 D1
3. **Count Check** — 旧文章数 vs Dry Run 输出数对比
4. **Data Validation** — 字段级验证（标题 / slug / content / language / category / tags / published_at）
5. **Import** — 仅在上述步骤全通过后写入 D1
6. **Random Verification** — 随机抽取 ≥20 篇文章逐字段对比
7. **Production Switch** — 切换 `/admin/*` 到新 CMS

**硬约束**：
- **不得**直接把旧数据写入 Production D1
- 迁移脚本必须可重复执行（idempotent）
- 同 slug 重复执行不应产生重复 INSERT

---

## ADR-009：URL 兼容

**约束**：
- 现有博客文章 URL 必须**保持不变**
- CMS 重构**不得**导致旧文章 URL 返回 404
- 必须执行 URL 回归测试

**URL 格式保持**：`/{locale}/blog/{slug}`、`/{locale}/notes/{slug}`

---

## ADR-010：最终原则

**这次项目不是重写博客前台。**

> "在不改变现有博客阅读体验的情况下，将旧 Admin 替换成基于 Cloudflare D1 的现代 CMS。"

**优先级**：
1. **数据安全**
2. **URL / SEO 兼容**
3. **前台性能**
4. **CMS 稳定性**
5. **功能数量**

**决策规则**：
- 任何新功能如果会破坏现有前台性能或 SEO → **优先保持现有系统稳定，而不是强行实现新功能**

---

## 变更日志

| 日期 | ADR | 变更 | 拍板 |
|---|---|---|---|
| 2026-09-01 | 001-010 | 初始 10 条 ADR 锁定 | Frank |

---

## Final Decisions（2026-09-01 09:28 GMT+9）

> 以下 6 项是对 ADR-001 到 ADR-010 的**最终细化**。覆盖前文任何不一致的地方。
> 锁定者：Frank
> 状态：**不要再讨论，按此执行**

### D-1：CF 项目 / Worker 命名 — `frank-blog-cms`

- 项目名称：**`frank-blog-cms`**
- 不创建独立的 `frank-blog-api`
- 采用 Single Worker 架构（CMS API 和 Admin 都属于同一个 Worker）
- `wrangler.toml` / `wrangler.jsonc` 只是 Wrangler 配置文件，**不代表独立 API Worker**
- **优先基于现有架构集成**：如果当前博客已经使用 CF Pages + Pages Functions，就在这套架构里集成 CMS，不要强行新建独立 Worker
- 实际路由：
  ```
  blog.frank2025.com
  ├── 前台博客（SSG）
  ├── /api/*
  ├── /admin/*
  └── /_admin/*（旧后台，临时保留 30 天）
  ```

**对 Phase 0 报告的修正**：
- wrangler.toml 当前 `name = "frank-blog-api"` 不代表架构，**仅是 Pages project 的 Worker name 标签**
- 修改时同步改名为 `frank-blog-cms`

---

### D-2：GitHub PAT Revoke（dingfeng901228-oss/frank-blog）

**批准 revoke** dingfeng901228-oss/frank-blog 的 GitHub PAT。

**Revoke 前必须检查**：
1. 当前博客部署是否仍依赖该 PAT
2. Cloudflare Build / Deploy 是否依赖该 PAT
3. GitHub Actions 是否依赖该 PAT
4. 其他自动化脚本是否依赖该 PAT

**Revoke 前置条件**：确认新系统不再依赖后，再执行 revoke。

**硬约束**：
- ❌ 不要在代码中保存 PAT
- ❌ 不要提交到 GitHub
- ❌ 不要存进 D1
- ❌ 不要出现在聊天记录

---

### D-3：D1 数据库绑定

```toml
database_name = "frank-blog-db"
binding       = "DB"
```

- 所有 D1 Schema 通过 `migrations/*.sql` 版本管理
- 禁止手工修改 Production D1 Schema

---

### D-4：Admin 账户

- **登录用户名**：`admin@frank2025.com`
- **第一阶段只实现 admin 角色**
- 数据库 users.role 预留 `admin` / `editor` 两个值
- **MVP UI 不开放 editor**
- **密码**：禁止明文存储，使用安全密码哈希
- **Session**：使用安全的 HttpOnly Cookie

---

### D-5：旧 Admin 保留 30 天

| 阶段 | 状态 |
|---|---|
| 新 CMS 上线后 | `/_admin` **保留 30 天** 作为紧急回滚入口 |
| 30 天内验证 | Admin 登录 / 文章 CRUD / Draft / Publish / Delete / Multi-language / MDX / D1 数据 / Preview / Publish Hook / SSG Build / SEO & URL / 数据迁移 |
| 30 天后 | 确认稳定再删除 `/_admin` |

⚠️ **`/_admin` 只是回滚入口，不是安全机制。仍然必须保留认证保护。**

---

### D-6：MDX / YAML Frontmatter 保留原始格式（强制要求）

**D1 → MDX 同步时必须保留**：
- ✅ `description: >` YAML block scalar 格式
- ✅ 原始 frontmatter 缩进 / 换行 / 引号风格
- ✅ 所有空格 / CRLF / LF / BOM 等不可见字符

**禁止的行为**：
- ❌ 不要自动重新格式化 YAML
- ❌ 不要自动压缩 YAML
- ❌ 不要自动改变换行
- ❌ 不要自动改变 block scalar 类型
- ❌ 不要自动重新 serialize frontmatter

**正例**（保留）：
```yaml
description: >
 第一行内容
 第二行内容
```

**反例**（禁止转换）：
```yaml
description: "第一行内容 第二行内容"
```

**完整验证链路**：
```
原始 MDX
  ↓
D1
  ↓
MDX
  ↓
Parser
```

**每一次 round-trip 必须 byte-level diff 通过**，否则视为迁移失败。

**历史教训**：项目之前出现过 YAML parsing error（#6806 / #6818 commit 历史），根因之一就是 yaml 序列化破坏原始 block scalar 结构。

---

## 改动前必须检查的现状清单

实际修改代码之前，先验证：

- [ ] Cloudflare 配置（Dashboard 项目名 = `frank-blog-cms`？）
- [ ] GitHub Actions（仓库里目前没有 `.github/workflows/`，确认）
- [ ] Pages 配置（CF Pages project 设置、build command、环境变量）
- [ ] Wrangler 配置（`wrangler.toml` 当前内容 + 缺失的 D1 binding）
- [ ] 当前 Admin（`src/admin/*.html` + `src/components/admin/*` + `functions/api/*.js`）
- [ ] 当前 MDX 数据结构（`PostFrontmatter` schema）
- [ ] 当前文章目录（`src/content/{zh,ja,en}/{posts,notes}/`）
- [ ] 当前部署流程（CF Pages auto-deploy + Pages Functions）

**确认现状后再实施。**

---

## 变更日志（追加）

| 日期 | 追加项 | 拍板 |
|---|---|---|
| 2026-09-01 09:28 | D-1 至 D-6 6 项最终决策细化 | Frank |
