# 「回执单号 / 单号 / 单号集」的区别（逆向定案）

> 起因：用户问「搞清楚 回执单号 单号 单号集 等的区别 新版还没做」。
> 本文是逆向结论，**先落纸**；拍板后再动代码（项目既定做法）。
>
> 证据来源两处，互相独立且结论一致：
> - **前端**：`legacy/js/Home.formatted.js`（由 `docs/home-audit/legacy-slice.mjs` 反解码）
> - **旧服务端**：`/Users/aaa/Downloads/server`（⚠️ 见 §7 的前提说明）

---

## 0. 一句话

三个词分属**两个层级**、**两种编号**：

| 词 | 是什么 |
|---|---|
| `回执单号` | **订单头**的身份 = 数据库 `orders.order_no` |
| `单号` | **明细行**的编号（每一扇门一个）—— **订单头上根本没有这个字段** |
| `单号集` | 该订单**所有明细行「单号」的去重集合**，用 `_` 连接 |

⚠️ **我们 `backend/migrations/0018` 的注释是错的**，原文：

> `单号（order_no）不单设列：新版 receipt_no 已承担「回执单号/单号」双重角色`

前半句**对**（`回执单号` 确实 = `order_no` = 我们的 `receipt_no`）；
后半句**错** —— 不是「一个字段担两个角色」，而是**两个层级上的两个不同东西**：`单号` 压根不是订单头概念，把它塞进 `receipt_no` 是层级搞混了。

---

## 1. 对照表

| | `回执单号` | `单号` | `单号集` |
|---|---|---|---|
| **层级** | 订单头 | **明细行**（每扇门） | 订单头 |
| **存储** | `orders.order_no` `VARCHAR(100)`，`@@unique([database_name, order_no])` | `door_specs` JSON 里 `ping_hui[]`/`diao_hui[]` 每行的 `单号` | `doorSpecs.customerInfo['单号集']` |
| **格式** | 服务端**无格式约束**（不生成、不校验） | `N-YY/MM/DD`，如 `5-25/07/17` | 上面那些串去重后 `_` 连接 |
| **谁生成** | 开单时**前端**给（服务端原样收） | `ensureLineNumbers()` 惰性补号 | `buildReceiptNoSet()` 派生 |
| **唯一性** | 每租户唯一 | 同年全库递增；**无唯一约束** | 派生物 |
| **主表列** | 不直接显示（排序/身份用） | 不显示（印在生产单/玻璃单上） | 「单号集」列 |
| **「查单号」** | — | 匹配的**内容** | 被搜索的**集合** |

---

## 2. 证据

### 2.1 前端（Home bundle）

**① 头对象里只有 `回执单号`，没有 `单号`**

所有订单头对象字面量 —— `:8125`、`:9146`、`:9172`、`:9200`、`:11003`、`:11358` —— **一个 `单号` 都没有**。
全文件 `["单号"]` 的出现处（`:683`、`:9486`、`:9528`、`:9678`、`:9720`）**全在明细行上**：
`bl()`（`:683`）读的是 `亮窗总高 / 门洞高 / 门洞宽 / 墙厚 / 扇数 / 开向 / 金额` —— 都是行级字段。

**② `单号集` 用下划线拆**（`Uo`，`:7694`）

```js
Uo = e => { const l = String(e ?? "").trim(); return l ? l.split("_").map(x => x.trim()).filter(Boolean) : [] }
So = e => Uo(e?.["单号集"])
```

**③ 前端从**不写** `单号集`** —— 全文件只出现 4 次（取值 `So`、判未审核 `bs`、列定义、列头），**零处赋值**。它由服务端在开单/合并时派生。

**④ 「查单号」的补年份**（`Yo`，`:7701`）

```js
t = (e => { const l = String(e||"").trim()
            return l ? (/-\d{2}\b/.test(l) ? l : l + "-" + String(new Date().getFullYear()).slice(-2)) : "" })(fo.value)
```

输入 `199` → 补成 `199-25`。这就解释了 `dr(1387)`「可只输入单号『-』前数字即可，如199.」。
匹配是对每行 `单号集` 拆出的段做 **`startsWith`**（`To`/`Yo` 两处一致，**不是 `includes`**）；查不到报 `查不到「199-25」单号！`。

**⑤ 初载按 `回执单号` 数值降序排**（`:7898`）

```js
_l.value = n["main-content"].tableData.map(...).sort((t, l) => parseInt(l["回执单号"]) - parseInt(t["回执单号"]))
```

> ⚠️ 这条对我们的 `receipt_no` 格式有直接影响，见 §5。

### 2.2 旧服务端

**① `orders` 表没有「单号」列** —— `prisma/migrations/20260626062201_init/migration.sql:47-71` 全列：
`id / database_name / client_id / order_no / customer_name / brand / order_date / delivery_date / status / total_amount / paid_amount / unpaid_amount / door_type / door_count / door_specs / operator_name / salesperson / formula_data / notes`。
`grep -rn 单号 prisma/` = **0 命中** —— 中文 key 从不落进任何数据库列，只活在 `door_specs` 的 JSON 里。

**② `回执单号` = `order_no`**，两处独立证实：

- `src/utils/serializer.ts:25` `result.回执单号 = result.orderNo;`
- `src/modules/legacy-dispatch.ts:472` `'回执单号': row.orderNo ?? customerInfo['回执单号'] ?? ''`

**③ `单号集` = 明细行「单号」去重后 `_` 连接**（`src/modules/order/order.service.ts:117-127`）

```ts
function buildReceiptNoSet(specs) {
  const lineNos = doorRowsFromSpecs(specs).map(row => row['单号'])   // ← 明细行的 单号
    .filter(v => v != null && String(v).trim() !== '').map(v => String(v).trim());
  const unique = [...new Set(lineNos)];
  if (unique.length > 0) return unique.join('_');                    // ← 去重 + 下划线连接
  const existing = customerInfo['单号集'];                            // ← 没有行单号时**保住旧值**
  return existing != null ? String(existing).trim() : '';
}
```

> ⚠️ **函数名 `buildReceiptNoSet` 有误导性** —— 它装的**不是回执单号**，是行单号。读代码时别被名字骗了。

分隔符 `_` 在 7 份重复实现里完全一致（`order.service.ts:124`、`:134`、`line-number.service.ts:73`、`progress.service.ts:90`、`formula.service.ts:52`、`client.service.ts:382`、`legacy-dispatch.ts:455`）。

**④ 真正有生成规则的是「单号」**（`src/modules/order/line-number.service.ts:120-235` `ensureLineNumbers()`）

- 格式 `` `${nextNumber}-${dateSuffix}` ``（`:214`），`dateSuffix` = `YY/MM/DD`（`:41-50`）⇒ 如 `5-25/07/17`
- `N` = **同年、全库所有订单**明细行单号的最大值 +1（`:185-197` 扫全库）；`:181` 注释明说**按年重置、不是按日**
- **永不覆盖已有单号**（`:208-212`）
- 触发点：`progress.service.ts:667`、`formula.service.ts:201`

**⑤ `回执单号` 服务端不生成、不校验、不排序** —— `order_no` 是 `VARCHAR(100)`，无序列、无格式规则。前端那套「补 `-YY`」是纯前端行为。

---

## 3. 合并订单：三者怎么变

**前端**（`Ii`，`:9191`）：选 ≥2 条且同客户 → 按 `parseInt(回执单号)` **升序**排 → 取最小那条作 `merged`，其余作 `record`（数组，存各自回执单号）→ 累加总价/定金/门数，地址/备注/打单人/业务员 用 `"; "` 拼 → `打单操作` 置 **`"合并单"`** → `POST { merged, record }`。

**服务端**（`order.service.ts:400-598` `combine()`）：

- `record` 里的回执单号**不写进任何独立字段** —— 那些订单的**明细行被搬进目标订单**的 `doorSpecs`，每行经 `retargetRows()` 把 `回执单号` 与 `OrderID/orderID/orderId/orderNo/order_no` 5 个别名一起改写成**目标**回执单号
- **行自己的 `单号` 原样保留**（不重新生成）
- `单号集` 用合并后的**全部**行重算
- **源订单被物理删除**（`:591-593`，连带 progress / financeOrder；payment 改挂到目标）

> ⚠️ **「以最早的回执单号为准」是纯前端逻辑，服务端零兜底**：`order.service.ts:403` 直接采信客户端传来的 `merged['回执单号']`，不比较、不校验。
> 前端传错目标号 → 服务端照做 → **源订单已删，无法回滚**。

---

## 4. 新版现状（逐条对）

| 概念 | 新版落点 | 状态 |
|---|---|---|
| `回执单号` | `orders.receipt_no` | ✅ **对** —— 语义正确，就是订单头身份 |
| `单号`（明细行） | **不存在** | ❌ **完全没做** —— `order_lines` 无任何编号列（`grep line_no` = 0） |
| `单号集` | `orders.order_no_set` | ⚠️ 列建了（`0018`），但**从没有任何写入点**；且注释把分隔符写成了「空格串」 |
| 合并订单 | 无 | ❌ **完全没做** —— 全库 `grep 合并` 无一处是订单合并 |
| 「查单号」补 `-YY` / `startsWith` 匹配 | `Home.vue` 已做 | ✅ 见 `docs/home-audit/01-table.md` B10/B11 |
| 初载按回执单号**数值降序** | 后端 `ORDER BY id DESC` | ⚠️ 见 §5 |

---

## 5. 由此暴露的既有问题

### 5.1 `0018` 的注释写错了两处

1. 「单号集 -> order_no_set 合并订单后多个单号的**空格串**」—— **分隔符是 `_`，不是空格**。
2. 「receipt_no 已承担『回执单号/单号』双重角色」—— **层级搞混**，见 §0。

> ⛔ **`0018` 这个文件不能改**：`backend/src/main.rs:23` 用的是 `sqlx::migrate!("./migrations")`，
> sqlx 会对**已应用的**迁移文件做校验和比对 —— 改一个字符都会让后端启动直接报 checksum mismatch。
> 更正只能落在**本文档** + 将来新加的迁移里（用 `COMMENT ON COLUMN`）。

### 5.2 我们的 `receipt_no` 格式与旧版排序规则不兼容

旧版初载按 `parseInt(回执单号)` **数值降序**排（`:7898`）。我们的 `receipt_no` 实际是 `HT00000067` 这种串 —— `parseInt("HT00000067")` = **NaN**，比较器返回 NaN，排序结果无定义。

后端现在是 `ORDER BY id DESC`（`orders/service.rs:210`），**恰好**与「越新的单越靠前」观感一致，所以暂时看不出问题；但**一旦真去做合并**（§3 要按回执单号数值排序取最小），这套格式会直接失效。

➡️ **待拍板**：`receipt_no` 到底要不要约束成「可数值化」的格式（旧版的 `回执单号` 长什么样，见 §7.1）。

---

## 6. 待拍板（拍完才动代码）

| # | 问题 | 选项 |
|---|---|---|
| A | `单号`（明细行级）要不要建列？ | ① 加 `order_lines.line_no TEXT`，照旧版 `N-YY/MM/DD` 规则惰性补号；② 不做（则生产单/玻璃单上永远没有门编号） |
| B | `单号集` 要不要变成派生值？ | ① 保留 `orders.order_no_set` 列，在开单/存行时用 `buildReceiptNoSet` 等价逻辑重算（照旧版，含「无单号时保住旧值」）；② 不落列，读时现算 |
| C | 合并订单做不做？ | 旧版**物理删除源订单**且服务端零兜底，风险高。若做，建议服务端自己按回执单号取最小（比旧版更稳），并写进文档作为**有意偏离** |
| D | `receipt_no` 格式要不要约束？ | 见 §5.2 |

---

## 7. 前提与不确定

### 7.1 旧服务端是**重写版**，不是原始 Flask 源码

`/Users/aaa/Downloads/server/package.json:3` 写着 `"TypeScript rewrite"`，`serializer.ts:3` 注释 `Mirrors the original Flask serializer behavior.`，本机无任何 `.py`。

⇒ **存储结构/键名可信**（作者有 `scripts/compare-production-contract.ts` 对生产做契约比对），**生成格式存疑**。

### 7.2 仍然读不出来的

1. **生产里 `回执单号` 的真实格式** —— 服务端不生成也不校验，源码给不出答案，只能看生产库实际值。
   → 这直接卡住 §5.2 和 §6.D。
2. **开单那一刻「单号」谁先算** —— `ensureLineNumbers` 明确「不覆盖已有值」，`makeReceipt` 直接采信客户端行里的 `单号`，所以**首写方是前端**；前端怎么算的，在 bundle 里没读到（疑似走 `formula.service.ts:201` 的 `orderNumbers`，**未证实**）。
3. **`单号集` 的 7 份实现有分叉**：`order.service.ts:129 buildCurrentReceiptNoSet` 在「没有行单号」时**不回落、直接写空串**（= 清空），其余 6 份回落保住旧值。是有意还是 bug，源码无注释；删明细行路径走的是「清空」那支。
4. **并发撞号**：`ensureLineNumbers` 的「扫全库取最大」与写回之间**无事务无锁**。

---

## 附：一句话记忆法

- **回执单号** = 这张**单子**的号（订单头，客户手里那张回执上的号）
- **单号** = 这**扇门**的号（明细行，印在生产单/玻璃单上）
- **单号集** = 这张单子**包含的所有门的号**（派生的，给「查单号」反查用）
