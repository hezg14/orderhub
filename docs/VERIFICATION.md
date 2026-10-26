# 交付校验记录

> 记录本项目经历过的两轮校验：初版交付时的静态核对（第 2~3 节，历史记录），以及 2026-10-26 的全量实测验证（第 1 节）。

## 1. 实测验证状态（2026-10-26 更新）

初版交付时环境受限未能运行的检查，后续会话中已全部补跑通过：

| 项目 | 状态 | 结果 |
|---|---|---|
| 后端依赖安装 | ✅ | 213 packages |
| 前端依赖安装 | ✅ | pnpm 安装完成 |
| `npm test`（后端） | ✅ | vitest 19/19（状态机 9 例 + CSV 6 例 + **集成 4 例：并发不超卖 / 幂等重放 / 信用额度拦截**，真实 PG） |
| `npx tsc --noEmit`（后端） | ✅ | 0 错误 |
| `vitest run`（前端） | ✅ | **36/36**（`src/__tests__/`：匹配排序 / 状态机几何 / 导航权限 / 格式化 / i18n 键一致性 / 权限矩阵） |
| `vue-tsc --noEmit`（前端） | ✅ | 0 错误 |
| `vite build` | ✅ | 5.4s |
| `npm run size` | ✅ | 502.8 / 520 KB（预算余量 17.2 KB，加依赖前先看） |
| `scripts/audit-ui.mjs` | ✅ | 3 视口（375/834/1440）× 9 路由无横向溢出、无控制台错误 |
| 权限接口实测 | ✅ | staff 对 delete/reports/audit/users/cancel/products-write 全 403；改自己角色 409；降权即时生效 |

**结论：当前代码处于全绿可交付状态。**

### 前端测试覆盖的回归点

- 命令面板匹配排序：前缀 > 子串 > 子序列，专家缩写（`orlst` → Order list）可命中
- 订单状态机 UI：管线 0/25/50/75% 填充、cancelled 全灰、未知状态不崩溃
- `zh`/`en` 字典键集合必须一致（防语言切换漏 key）
- 权限矩阵：行键唯一、staff 永不越过 admin、角色差异行必须配说明文案

## 2. 初版静态核对发现并修复的问题（历史记录）

这些问题都会导致「第一次运行就失败」，属于必须先修的级别。

| # | 文件 | 问题 | 后果 | 修法 |
|---|---|---|---|---|
| 1 | `src/lib/env.ts` | `dotenv` 在依赖里但全项目没有任何 `import 'dotenv/config'` | `npm run dev` 启动瞬间以 `DATABASE_URL is required` 退出，`.env` 从未被读取 | 在 `env.ts` 顶部引入，所有读取 `process.env` 的模块自动受益 |
| 2 | `prisma/seed.ts` | 直接 `tsx prisma/seed.ts` 时不加载 `.env` | `npm run db:seed` 报 `Environment variable not found: DATABASE_URL` | 文件顶部引入 `dotenv/config` |
| 3 | `services/order.service.ts` | `TRANSITIONS` / `STATUS_LABEL` 被 `export {}` 了两次（第 9 行、第 47 行） | TS 报 `Export declaration conflicts`，整个后端编译不过 | 删掉前面那一处，保留带 `assertTransition` 的完整导出 |
| 4 | `vite.config.ts` | 从 `vite` 引入 `defineConfig`，却写了 `test` 字段 | `vue-tsc --noEmit` 报「对象字面量只能指定已知属性」，`npm run build` 前置检查失败 | 改从 `vitest/config` 引入 |
| 5 | `tsconfig.json` | `types: ["vite/client"]` 关掉了 `@types/node` 的自动加载，但 `vite.config.ts` 用了 `node:url` | 报 `Cannot find module 'node:url'` | `types` 补上 `"node"` |
| 6 | `prisma/migrations/` | 目录为空，而 Dockerfile 的 CMD 是 `prisma migrate deploy` | 容器正常启动但库里一张表都没有，首个请求全部 500 | 按 `schema.prisma` 手写初始迁移 + `migration_lock.toml` |

## 3. 初版顺带修掉的质量问题（历史记录）

| 文件 | 问题 | 修法 |
|---|---|---|
| `services/report.service.ts` | 报表标题、列名、状态值全是英文（`Order no.` / `Status` / `paid`），和全中文界面割裂 | 标题与列名改中文，状态用 `STATUS_LABEL` 映射，导出的 CSV 与界面用词一致 |
| `vite.config.ts` | 注释声称 Element Plus「按需引入约 90 KB」，但 `main.ts` 引入了整份 `element-plus/dist/index.css`，说法与实现不符 | 注释改为「JS 按需、样式整份」，并写明原因（`ElMessage` 是命令式调用，解析器看不见，按需会丢样式） |
| `README.md` | 启动步骤写 `prisma migrate dev --name init`，与本仓库已提交的迁移冲突 | 改为 `prisma migrate deploy` |

## 4. 复验命令

```bash
# 后端
cd backend
npx prisma generate
npx tsc --noEmit && npm test

# 前端
cd ../frontend
npx vitest run
npx vue-tsc --noEmit && npx vite build && npm run size

# UI 审计（需先起 3000/5173 两个服务）
cd .. && PUPPETEER_MODULE=<puppeteer-core 所在目录> node scripts/audit-ui.mjs
```

## 5. 仍未覆盖的缺口

- 集成测试与开发库共用（自建自清），CI 里应换独立 PG service container
- 没有 E2E：建单 → 改状态 → 导出 CSV 主链路未自动化（audit-ui 只做只读巡检）
- 限流是进程内 Map（`routes/auth.ts` 已注明），多实例部署需换 Redis
- 单号按服务器本地日期生成，跨时区需固定业务时区
- 无软删除，删除后审计里的 `entityId` 指向已不存在的记录
- CSRF 依赖 SameSite=Lax + 全 JSON API，无 CSRF token（单域部署可接受）

## 6. 业务深度增量（2026-10-26 下午）

- **客户信用额度**：`customers.credit_limit`（null = 现结不管控）；下单事务内锁客户行 + 汇总 pending 应收，超限 422 `CREDIT_LIMIT_EXCEEDED` 带缺口明细；客户详情页额度使用条；改额度仅限 admin（写审计）
- **应收账龄**：`GET /reports/receivables`（admin），30/60/90 天分桶 + 按客户明细，报表页可视化
- **幂等建单**：`Idempotency-Key` 头（UUID），key 与订单同事务落库，重放返回原单 + `Idempotent-Replay: true`；24h 惰性清理
- seed 自动把欠款最多客户的额度钳到 `应收 + ¥500`，演示时下一单必触发拦截
- 接口实测：额度拦截 422 明细正确；同 key 两次建单返回同一订单 + replay 头；8 并发抢 1 库存恰好 1 单成功
