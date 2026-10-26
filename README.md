# OrderHub

面向 5–20 人批发 / 贸易公司的订单、客户、商品一体化管理后台，用来替代 Excel。
Vue 3 + TypeScript 前端，Express + Prisma + PostgreSQL 后端，Docker 一键起全栈。

> 虚构产品，用于作品集演示。种子数据可一键重置。

---

## 1. 技术栈与选型

| 层 | 选择 | 为什么是它 | 备选与否决理由 |
|---|---|---|---|
| 前端框架 | **Vue 3.5 + Vite 5** | 后台类系统的表格/表单密度高，Element Plus 生态最省时间 | React 也可以，但 Element Plus 的表格/抽屉开箱即用，能少写约 800 行组件 |
| UI 库 | **Element Plus（JS 按需引入）** | 与 Vue 3 原生契合，主题变量可覆盖 | 全量引入约 340 KB gzip；按需后 JS 约 127 KB（11 个页面重度使用表格/表单/日期选择器）。样式保留整份 CSS（46 KB gzip），因为 `ElMessage` 是命令式调用，按需解析器看不见这些调用点，样式会丢。注意 manualChunks 里**不能**写 `'element-plus': ['element-plus']`，否则强制拉入完整桶文件（832 KB） |
| 状态 | **Pinia** | 只有会话需要全局状态 | 页面数据放 Pinia 会让缓存失效问题变复杂，一律组件内 `ref` |
| 图表 | **ECharts（按需注册）** | 折线/环形/柱状一套库搞定 | 只注册 3 种图表，比全量少约 225 KB |
| 后端 | **Node.js 20 + Express 4 + TS** | 与前端同语言，团队交接成本最低 | NestJS 更工程化，但这个体量会引入大量样板代码 |
| ORM | **Prisma 5** | 类型安全、迁移可追溯、DDL 可读 | TypeORM 装饰器噪音大；裸 SQL 维护成本高 |
| 数据库 | **PostgreSQL 15** | 事务 + 行锁是防超卖的关键 | SQLite 没有真正的行级锁，无法演示并发正确性 |
| 校验 | **Zod** | 一份 schema 同时产出运行时校验和 TS 类型 | Joi 不带类型推导 |
| 认证 | **JWT 存 httpOnly Cookie** | 防 XSS 读取；刷新页面保持登录 | localStorage 实现简单，但 token 可被任意脚本读取 |

### Upwork 技能标签 → 本仓库落点

| 标签 | 落在哪 | 具体位置 |
|---|---|---|
| TypeScript | 全栈 | 前后端 100% TS，`strict: true`，无 `any` |
| Vue.js | 前端 | 11 个页面 + 6 个通用组件 |
| Node.js | 后端 | Express 应用、中间件链、Prisma 访问层 |
| SQL | 后端 | 原生聚合查询（统计、报表）、`FOR UPDATE` 行锁、`pg_advisory_xact_lock` |
| API Development | 后端 | REST 契约、统一错误码、分页、幂等建单 |
| Linux | 部署 | Alpine 镜像、非 root 用户、`HEALTHCHECK`、优雅退出 |

React / Next.js / Golang 不在本项目中，这是刻意的：一个登录后的 CRUD 后台用 Next.js 得不到 SSR 收益，用 Go 反而增加交接成本。这两个标签分别由「公开门户（Next.js）」和「高并发 API（Go）」两件作品承担，见仓库根目录的方案文档。

---

## 2. 30 秒启动

```bash
# 方式 A：Docker 起后端 + 数据库（推荐，无需本地装 PG）
cd orderhub
docker compose up -d --build      # 容器启动时自动跑 prisma migrate deploy

# 灌种子数据：用本机依赖连 compose 暴露的 5432 端口
# （镜像里 pruned 掉了 tsx，所以不要在容器内跑 seed）
cd backend && npm install
cp .env.example .env              # DATABASE_URL 指向 localhost:5432
npm run db:seed

# 方式 B：本地跑后端（数据库自备或复用上面的 compose db）
cd orderhub/backend
cp .env.example .env              # 填 DATABASE_URL 和 JWT_SECRET（≥32 字符）
npm install
npx prisma migrate deploy         # 初始迁移已提交在 prisma/migrations/
npm run db:seed
npm run dev                       # http://localhost:3000

# 前端（两种方式都需要）
cd orderhub/frontend
npm install
npm run dev                       # http://localhost:5173，/api 已代理到 3000
```

**演示账号**

| 角色 | 邮箱 | 密码 | 能看到什么 |
|---|---|---|---|
| 管理员 | `admin@orderhub.demo` | `Demo1234` | 全部功能：报表、审计、删除、取消 |
| 业务员 | `staff@orderhub.demo` | `Demo1234` | 无报表/审计菜单，取消与删除按钮置灰，直访 `/reports` 被拦回仪表盘 |

---

## 3. 功能对照 PRD

| 模块 | 已实现 | 关键细节 |
|---|---|---|
| 认证 | 登录 / 登出 / 会话恢复 / 限流 | 账号不存在时也做一次哈希比对，响应时间不泄露账号是否存在；15 分钟 10 次 |
| 仪表盘 | 4 卡 + 3 图 + 最近订单 | 统计口径集中在 `dashboard.service.ts`，一条 SQL 出四个指标 |
| 订单 | 列表 / 新建 / 详情 / 状态流转 / 删除 | 事务扣库存、行锁防超卖、单号并发安全、状态机拒绝非法流转 |
| 客户 | 列表 / 详情 / 新建 / 编辑 | 累计交易与订单数由 SQL 聚合，不依赖前端累加 |
| 商品 | 分类筛选 / 搜索 / 低库存 / 编辑 | 库存 ≤ 5 标红，库存变更写审计 |
| 报表 | 3 类报表 / 预览 5 条 / 导出 CSV | UTF-8 BOM，Excel 不乱码；防公式注入 |
| 审计 | 筛选 / 分页 / 展开原始 JSON | 字段级 `from → to`，带 requestId |

---

## 4. 目录结构

```
orderhub/
├── docker-compose.yml
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # 7 张表、索引、枚举约束
│   │   ├── migrations/            # 初始迁移，migrate deploy 直接可用
│   │   └── seed.ts                # 64 单 / 20 客户 / 30 商品，金额自洽
│   └── src/
│       ├── lib/                   # env, logger, prisma, errors, jwt, password, order-state
│       ├── middlewares/           # auth, rbac, validate, error
│       ├── schemas/               # 全部 Zod schema
│       ├── services/              # 业务逻辑（订单事务、统计、报表、审计）
│       ├── routes/                # 8 个资源路由
│       ├── app.ts                 # 中间件装配
│       └── server.ts              # 启动 + 优雅退出
└── frontend/
    ├── vite.config.ts             # 按需引入 + manualChunks 分包
    └── src/
        ├── api/                   # axios 封装 + 资源方法
        ├── components/            # StatCard, StatusTag, MoneyText, EmptyState, BaseChart
        ├── layouts/               # 侧栏 + 顶栏 + 响应式
        ├── stores/                # 会话
        ├── router/                # 路由 + 三级守卫
        └── views/                 # 11 个页面
```

---

## 5. 五个值得看的实现

### 5.1 订单号并发安全

`count(*) + 1` 在并发下必然撞号：两个请求同时读到 7，都写 008。

```ts
await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'order_no:' + prefix}))`;
const last = await tx.$queryRaw`SELECT order_no FROM orders WHERE order_no LIKE ${prefix + '%'} ...`;
```

事务级 advisory lock 把「读最大号 → 加一 → 写入」串行化，提交/回滚自动释放，不需要额外表。

### 5.2 防超卖

```ts
const products = await tx.$queryRaw`
  SELECT id, stock, unit_price, name FROM products
  WHERE id = ANY(${productIds}::uuid[])
  ORDER BY id            -- 固定加锁顺序，避免两个订单交叉加锁死锁
  FOR UPDATE`;
```

三件事缺一不可：**行锁**（不是先查后减）、**按 id 排序**（防死锁）、**合并重复商品行**（否则两行各查一次都通过）。

### 5.3 状态机单一真源

`lib/order-state.ts` 是纯函数，不依赖 Prisma：

```ts
export const TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid:    ['shipped'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
}
```

非法流转抛 422 并附上 `allowedNext`，前端直接拿来渲染按钮。后端 `/orders/meta/transitions` 把同一份表下发给前端，**不存在两处定义**。

### 5.4 CSV 的两个坑

```ts
return '\uFEFF' + [...].join('\r\n');   // BOM：Excel 才认 UTF-8
const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;  // 防 CSV 公式注入
```

第二条经常被忽略：客户名填 `=HYPERLINK("http://evil","click")`，财务一打开就在 Excel 里执行了。

### 5.5 前端分包

```ts
manualChunks: { echarts: [...], 'element-plus': [...], vendor: [...] }
```

ECharts 单独成 chunk，只有仪表盘和报表路由会下载；登录页首屏只加载 vendor + element-plus。

---

## 6. 对原设计稿的审查结论

原 `OrderHub-design.html` 的三个**会直接出错**的问题：

| 问题 | 后果 | 修法 |
|---|---|---|
| 11 个 tab 只实现 3 个 section | 点 ④~⑪ 时 `getElementById` 返回 null，`.classList` 抛 TypeError，页面无任何反应 | 每个路由独立组件 + 懒加载，不存在的路由走 404 |
| 侧栏 HTML 在每页整段复制 | 加一个菜单要改 11 处 | `DefaultLayout.vue` 单一布局 |
| 颜色硬编码 `#2563EB` 30+ 次 | 换主题要全局搜替换，必漏 | 全部走 `tokens.css` CSS 变量 |

性能与安全：

| 问题 | 风险 | 修法 |
|---|---|---|
| `cdn.tailwindcss.com` | 运行时 JS 生成样式，首屏阻塞 + 不支持 CSP + 供应链风险 | 去掉 CDN，设计令牌手写，构建期产出 CSS |
| 11 页 DOM 全部存在，靠 `hidden` 切换 | DOM 节点数随页数线性增长 | 路由级代码分割 |
| 无 SRI / 无 CSP | 第三方脚本被篡改无法察觉 | `helmet` + 严格 CORS + 无外部脚本 |
| 演示密码明文写在 HTML | 会被搜索引擎和截图带走 | 密码在后端 seed，页面只显示邮箱 |
| 内联 `onclick` | 无法启用 CSP | Vue 事件绑定，无内联脚本 |
| 表单无 `label` 关联、emoji 当图标 | 屏幕阅读器无法识别 | 语义化 `label` + Element Plus 图标组件 |

可维护性：

| 问题 | 修法 |
|---|---|
| 数据全部硬编码在模板里 | 全部来自 API，前端只管渲染 |
| 分页写死 `1 2 3 … 8` 与「共 60 条」矛盾 | 服务端分页，`meta.total` 驱动 |
| 金额左对齐、非等宽数字 | `text-align: right` + `tabular-nums` |
| 没有加载 / 空 / 错误三态 | `EmptyState` + 骨架屏 + `el-alert` |

---

## 7. 测试与校验

```bash
# 后端：单元测试（状态机 9 例 + CSV 6 例）
cd orderhub/backend
npm install && npx tsc --noEmit && npm test

# 前端：类型检查 + 构建 + 产物体积门禁（超 320 KB gzip 直接 exit 1）
cd orderhub/frontend
npm install && npm run typecheck && npm run build && npm run size
```

覆盖的是**纯逻辑**：非法流转、终态、CSV 转义与公式注入。数据库相关逻辑（事务、行锁、单号）依赖真实 PG，属于集成测试范围，未包含在本次提交中——这是已知缺口，见下一节。

> **交付状态说明**：本仓库在生成环境中无法执行命令（沙箱故障），因此
> `npm test` / `vue-tsc --noEmit` / `vite build` **尚未由作者实际运行过**。
> 依赖安装、类型检查、构建请以上面的命令为准，若报错按提示修正后再提交。
> 已做的静态核对与修复明细见 `docs/VERIFICATION.md`。

---

## 8. 已知限制

| 限制 | 影响 | 下一步 |
|---|---|---|
| 登录限流存在进程内 Map | 多实例部署时限流不共享，重启即清零 | 换 Redis |
| 无集成测试 | 事务与并发路径靠人工验证 | 用 Testcontainers 起真实 PG 跑 `createOrder` 并发用例 |
| 无 E2E | 前端交互未被自动化覆盖 | Playwright 跑「建单 → 改状态 → 导出」主链路 |
| 单号按自然日重置 | 跨时区部署时「今天」的口径需明确 | 统一按业务时区（Asia/Shanghai）计算前缀 |
| 无软删除 | 删除后审计里的 `entityId` 指向已消失的记录 | 加 `deleted_at` 或归档表 |

---

## 9. 部署

```
浏览器 → Vercel（前端静态） → Render（后端 Docker） → Neon（PostgreSQL）
```

- 后端：`backend/Dockerfile` 多阶段构建，Alpine + 非 root + `HEALTHCHECK`
- 数据库迁移：容器启动时 `prisma migrate deploy`（幂等）
- 必须设置的环境变量：`DATABASE_URL`、`JWT_SECRET`（≥32 字符，否则启动即失败）、`CORS_ORIGIN`、`COOKIE_SECURE=true`
- Render 免费层 15 分钟无请求休眠，首次访问约 30 秒唤醒
