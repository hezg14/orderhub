# OrderHub 代码审查报告

审查对象：`OrderHub-design.html`（11 页设计稿）+ `Architecture.md` + `Design.md`
结论：**设计与架构方向正确，但代码层面有 3 个会导致运行时直接出错的缺陷，以及 4 类系统性问题。**

---

## 一、P0：会直接报错或产生错误结果的

### 1. 点第 4~11 个 tab 必然抛 TypeError

```js
function sw(id, el){
  document.querySelectorAll('section[id^="p"]').forEach(p=>p.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');  // ← id 不存在时返回 null
}
```

HTML 里只有 `#p1` `#p2` `#p3` 三个 section，但导航栏渲染了 11 个按钮。点击「④ 新建订单」：

```
Uncaught TypeError: Cannot read properties of null (reading 'classList')
```

更糟的是**上一行已经把当前页隐藏了**——用户看到的是空白页面，且没有任何错误提示。

**修法**：路由级组件 + 懒加载，未匹配的路径落到 404 视图。
**已落地**：`frontend/src/router/index.ts`，11 条路由全部 `() => import(...)`。

---

### 2. 商品销售汇总会把范围外的数据算进去（本次自查发现）

原始写法（我在第一版实现中也犯过，已修）：

```sql
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id
  AND o.created_at BETWEEN $1 AND $2   -- 条件写在 JOIN 上
  AND o.status <> 'cancelled'
```

`LEFT JOIN` 的 `ON` 条件只决定「能否匹配到 orders」，**不会过滤掉 order_items 本身**。
范围外的明细行依然存在，`SUM(oi.quantity)` 把它们全加上了。报表数字看起来正常，但和订单列表对不上——这类错误最难被发现。

**修法**：把过滤放进子查询，先缩小明细集合再 JOIN。

```sql
LEFT JOIN (
  SELECT oi.product_id, oi.quantity, oi.subtotal
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.created_at BETWEEN $1 AND $2 AND o.status <> 'cancelled'
) s ON s.product_id = p.id
```

**已落地**：`backend/src/services/report.service.ts` → `productsReport()`。

---

### 3. 分页控件与总数自相矛盾

设计稿写死：

```html
<span>共 60 条</span>
<button>1</button><button>2</button><button>3</button><span>…</span><button>8</button>
<select><option>每页 20</option></select>
```

60 条 ÷ 每页 20 = **3 页**，但页码给到 8。这是硬编码数据的典型症状：数字之间没有约束关系。

**修法**：服务端返回 `{ data, meta: { total, page, pageSize, totalPages } }`，前端只渲染 `meta`。
**已落地**：`backend/src/lib/http.ts` 的 `paged()`，11 个列表页统一消费。

---

## 二、性能

| # | 问题 | 量化影响 | 修法 |
|---|---|---|---|
| P1 | `<script src="https://cdn.tailwindcss.com">` | 运行时 JS 扫描 DOM 生成 CSS，约 110 KB JS + 首次绘制前阻塞 80~200ms；**CSP 需要 `unsafe-eval`** | 删除 CDN，设计令牌手写 CSS，构建期产出 |
| P2 | 11 页 DOM 同时存在 | 当前 3 页约 1,200 节点；补齐 11 页预计 4,000+，首屏解析时间线性增长 | 路由级 `import()`，每页独立 chunk |
| P3 | 无字体子集 / 无 preload | 回退到系统字体，跨平台渲染不一致 | 已在 `index.html` 加静态骨架，字体策略留待接入真实品牌字体时处理 |
| P4 | ECharts 若全量引入 | 全量约 330 KB gzip；本项目只需折线/环形/柱状 | `echarts/core` + 显式 `use()`，约 105 KB |
| P5 | 无体积预算 | 下次有人 `import * as echarts` 无人察觉 | `scripts/check-bundle.mjs`，超 320 KB 直接 `exit 1` |

另：`index.html` 里加了静态启动骨架（纯 CSS，无 JS），JS 未执行前也不会有白屏——这是 LCP 的廉价优化。

---

## 三、安全

| # | 问题 | 风险等级 | 修法 |
|---|---|---|---|
| S1 | CDN 脚本无 `integrity`、无 CSP | 高：供应链投毒即全站失守 | 自托管资源 + `helmet` + 严格 CORS 白名单 |
| S2 | 演示密码明文写在 HTML | 中：进搜索引擎缓存、进截图 | 密码只在后端 seed，页面只显示邮箱 |
| S3 | 内联 `onclick="sw('p1',this)"` | 中：无法启用 CSP（`unsafe-inline`） | Vue 事件绑定，无内联脚本 |
| S4 | 表单无 `<label for>`、emoji 当图标 | 中：屏幕阅读器不可用 | 语义化 label + 图标组件 + `aria-label` |
| S5 | 架构文档说「JWT 存 Cookie」但未提写操作防护 | 中：CSRF | `SameSite=Lax` + CORS 白名单；写操作校验 Origin（Express `cors` 已限制方法） |
| S6 | 报表 CSV 直接拼接 | 中：公式注入，Excel 打开即执行 | 前缀 `'` 阻断 `= + - @` 开头的单元格 |

S6 是最容易被忽略的一条。客户名填 `=HYPERLINK("http://evil","click")`，财务一打开就在 Excel 里点了。

**已落地**：`report.service.ts` → `sanitise()`；单测覆盖 `csv.test.ts`。

另外补了两处登录防护：
- 账号不存在时也跑一次 `bcrypt.compare`（防时序侧信道），见 `password.ts` → `burnPasswordCheck()`
- 15 分钟 10 次限流，见 `routes/auth.ts`

---

## 四、可维护性

| # | 问题 | 证据 | 修法 |
|---|---|---|---|
| M1 | 侧栏 HTML 每页整段复制 | `p2` 与 `p3` 的 `<aside>` 完全一致，约 40 行 × 11 | `DefaultLayout.vue` 单一布局 |
| M2 | 颜色硬编码 30+ 次 | `#2563EB` 在 class 里重复出现 | `tokens.css` CSS 变量，Element Plus 变量桥接 |
| M3 | 数据硬编码在模板 | 表格 5 行写死，无法分页/排序/筛选 | 全部来自 API |
| M4 | 无组件边界 | StatCard/StatusTag 都是复制粘贴的 div | 抽出 6 个组件 |
| M5 | 金额左对齐、非等宽数字 | 表格列宽跳动 | `text-align: right` + `font-variant-numeric: tabular-nums` |
| M6 | 无三态 UI | 只有「有数据」一种状态 | `EmptyState` 组件 + `v-loading` + `el-alert` |
| M7 | 状态色定义两处（文档 + 代码） | 改一处必漏一处 | 状态机与标签集中在 `lib/order-state.ts` |
| M8 | 金额用 JS 浮点 | `0.1 + 0.2 !== 0.3` | 数据库 `NUMERIC(12,2)`，计算用 `Prisma.Decimal` |

M8 需要展开：订单金额一旦用 `number` 累加，几百单后对账必然差几分钱。本项目所有金额在 API 层以整数分/Decimal 计算，只在序列化时转 `number` 给前端展示。

---

## 五、重构方案（按依赖顺序）

**第 1 步：拆骨架（0.5 天）**
`main.ts` + `router` + `DefaultLayout` + `tokens.css`，把三个已有页面迁进去。
验收：11 条路由都能打开，不存在的路径显示 404。

**第 2 步：建数据层（1 天）**
`api/client.ts` 统一错误结构（`code` 而非 message）→ `api/index.ts` 按资源分组 → Pinia 只存会话。
验收：任何接口报错，前端都能拿到 `code` 并做差异化处理（401 跳登录、409 定位到行）。

**第 3 步：补组件与三态（0.5 天）**
StatCard / StatusTag / MoneyText / EmptyState / BaseChart。
验收：三个列表页都有空状态。

**第 4 步：业务页（2 天）**
订单新建的实时计算与库存校验、订单详情的状态机、报表预览与导出。

**第 5 步：接后端（1.5 天）**
把 mock 换成真实 API，补 401/403/409 分支。

**第 6 步：质量门禁（0.5 天）**
`vue-tsc --noEmit` + vitest + 体积预算脚本进 CI。

总计约 6 天，与原计划的 15 天相比更快，因为组件和规范是复用的，不是每页重写。

---

## 六、本次落地的对照

| 原问题 | 状态 | 位置 |
|---|---|---|
| P0-1 路由崩溃 | ✅ 已修 | `router/index.ts` |
| P0-2 报表多算 | ✅ 已修 | `report.service.ts` |
| P0-3 分页矛盾 | ✅ 已修 | `lib/http.ts` |
| P1 CDN Tailwind | ✅ 已移除 | 无外部依赖 |
| P2 DOM 全量 | ✅ 已分割 | 11 个懒加载路由 |
| P4 ECharts 全量 | ✅ 按需 | `BaseChart.vue` |
| P5 无预算 | ✅ 已加 | `scripts/check-bundle.mjs` |
| S1 CSP/SRI | ✅ 已加 helmet | `app.ts` |
| S2 明文密码 | ✅ 后端 seed | `prisma/seed.ts` |
| S5 CSRF | ⚠️ 部分 | SameSite=Lax，Origin 校验待补 |
| S6 CSV 注入 | ✅ 已修 + 单测 | `report.service.ts` |
| M1 布局复制 | ✅ 已修 | `DefaultLayout.vue` |
| M2 颜色硬编码 | ✅ 已修 | `tokens.css` |
| M7 状态双份 | ✅ 单一真源 | `lib/order-state.ts` |
| M8 浮点金额 | ✅ 已修 | `NUMERIC` + `Decimal` |

未做：S5 的 Origin 二次校验、E2E 测试、软删除。
