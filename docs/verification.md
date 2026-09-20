# 统一验证入口：`npm run verify`

> 一条命令跑完全套检查。之前验证散在五六个地方（`cargo test`、`npm run build`、
> `node docs/home-audit/run-all.mjs`、fmt、clippy…），**各跑各的，谁也不知道「全套」是什么**。
> 2026-09-19 就栽在这上面：提交「总余额显示」时只跑了 build + Hui 那几个台子，
> 同一笔改动打崩了 `print-lineno-check.mjs` 的手写桩，**一天之后才发现**。
> 这个入口就是不让那件事重演。CI（`.github/workflows/ci.yml`）跑的是同一条命令。

```bash
npm run verify          # 全套
npm run verify -- --quiet   # 差分台只打汇总表
```

---

## 1. 它跑什么，为什么是这个顺序

| # | 步骤 | 说明 |
|---|---|---|
| 1 | `cargo fmt --all --check` | 最便宜的检查放最前，秒级失败 |
| 2 | 前端：缺 `app/node_modules` 才 `npm ci`，然后 `npm run build` | = `vue-tsc --noEmit && vite build` |
| 3 | `cargo clippy --workspace --all-targets --all-features -- -D warnings` | **两个包一起看**（`backend` + `app/src-tauri`） |
| 4 | `cargo test --workspace` | 当前 24 通过 / 1 忽略 |
| 5 | 建库 → 起后端 → 等 health → `run-all.mjs`（29 个差分台）→ 收尾 | 详见下面第 3 节 |

**⚠️ 第 2 步必须早于第 3 步。** `app/src-tauri/tauri.conf.json` 的 `frontendDist` 指向 `../dist`，
而 `app/dist/` 是 gitignore 的 —— CI 上刚 checkout 出来没有这个目录，先跑 clippy 的话
`tauri-build` 直接报错。

> 用户原话把顺序列成「1 前端构建 / 2 cargo test / 3 台子 / 4 fmt / 5 clippy / 6 PG 集成」。
> 这里把 fmt 提到最前、前端构建提到 clippy 前，其余等价。第 6 项「PostgreSQL 集成测试」
> 就是第 5 步 —— 用户已确认「3 和 6 是同一件事」（那 29 个台子打的全是真后端 + 真 PG）。

---

## 2. 隔离：它**绝不**碰你正在跑的那套

| 资源 | verify 用的 | **不碰**的 |
|---|---|---|
| 数据库 | `smartdoor_verify`（跑前重建、跑完删掉） | `smartdoor`（你的开发库） |
| 端口 | 3100 | 3000 |
| 容器 | 复用 `smartdoor-db`，但只在它没跑时 `docker compose up -d db` | **从不下 `compose down`**（那会连 `pgdata` 卷一起删） |
| 进程 | 只 `kill` **自己起的那个 PID** | 不用 `pgrep`/`pkill -f` |

- **3100 已被占用就直接报错退出，不做任何清理** —— 占着它的可能是你正在用的东西。
- 收尾用 `DROP DATABASE … WITH (FORCE)`（PG13+），残留连接一起断掉。
- 后端由 verify 自己起：`sqlx::migrate!` + `seed_admin` 在启动时自动跑，
  **空库也能自举**（24 个迁移 + 一个管理员），不需要 sqlx-cli、不需要预先灌数据。

### 种子：为什么还要从开发库读一次

有几个台子的夹具是照着**真业务配置**写的 —— 最典型的是 `print-lineno-check.mjs`，
它第一句就断言「库里至少有一条平开公式（没有的话这个夹具没意义）」。用户手上那份配置
只有开发库里存着，没有第二份来源。

所以本地 verify 会把开发库的业务配置（公式 / 打印模板）**只读**克隆进一次性库。
写操作仍然**只**落在一次性库上，源库一个字节都不改。关掉它用 `VERIFY_SEED=0`。

⚠️ 代价要认：**本地 verify 的结果因此依赖开发库里的配置**。这不是一个完全可复现的门槛，
是在「可复现」和「真的能跑起来」之间做的取舍。要彻底解决，得把那份配置固化成
**提交进仓库的夹具**（做法与代价见第 3 节末）。

---

## 3. 覆盖情况（含**已知未覆盖**）

```
共 29 个台子：✅ 通过 28 · ⏭ 跳过(环境/作废) 0 · 🔴 已知红(待裁决) 1 · ❌ 失败 0
```

### 本地（有开发库、有仓库外旧版源码）

`npm run verify`：29 个全跑 —— **28 绿 + 1 已知红**（下面第 5 节）。

> 单独手工跑 `node docs/home-audit/run-all.mjs`（不带 `RUN_ALL_STRICT`）会看到另一组数：
> **27 绿 + 2 个 ⏭ + 0 已知红**。那两个 ⏭ 是：
>
> | 台子 | 手工跑为什么 ⏭ |
> |---|---|
> | `docs/qrscanner-authz-check.mjs` | 默认打 `http://localhost:3999` 的**独立实例**，手工跑时没起。`verify` 把 `BASE` 指向自己起的后端，所以它在 verify 里是 ✅ |
> | `docs/home-audit/finance-reversal-e2e.mjs` | 同上（`E2E_PORT` 默认 3999）。⚠️ **它在 verify 里是真红**（下面第 5 节）—— 手工跑给它挂上「环境」标签，正好把那条真红遮住了 |
>
> 所以「手工跑 0 已知红」**不是**「没有已知红」。两组数都对，前提不同 ——
> 引用数字时先说清是哪一组。

### CI（`.github/workflows/ci.yml`）

| 状态 | 数量 | 是哪些 |
|---|---|---|
| ✅ 跑并且过 | 25 | —— |
| 🔴 跑了但红（已登记） | 1 | `docs/home-audit/finance-reversal-e2e.mjs`（下面第 5 节） |
| ⏭ **未运行** | 3 | 见下 |

25 + 1 + 3 = 29。

那 3 个**未运行**的：

| 台子 | 为什么 |
|---|---|
| `docs/home-audit/lineno-logiccheck.mjs` | 缺**仓库外**旧版服务端源码 |
| `docs/qrscanner-scan-logiccheck.mjs` | 同上 |
| `docs/home-audit/print-lineno-check.mjs` | 空库 —— 它要有业务配置（公式 / 打印模板）才成立 |

**「未运行」不是「通过」。** verify 与 run-all 都会把这几行单独打出来，
最后一行也不会写「全绿」，而是写「没有失败项，但不等于全绿：N 个未运行；M 个已知红未修」。

### 那 2 个缺仓库外源码的台子

它们靠 `docs/legacy-finance/lib/run-legacy-fn.mjs` 切**旧版服务端**的 TS 函数来跑差分，
那份源码在 `~/Downloads/server`（**仓库外**，3.9M / 50 个 `.ts`），CI 上不存在。
该模块**顶层就读** `modules/finance/finance.service.ts` ⇒ 文件不在时 import 直接 ENOENT。

已在 `run-legacy-fn.mjs` 里留好接口：路径可用 **`LEGACY_SERVER_SRC`** 覆盖。
要收口只有两条路，**都还没有拍板**：

1. 把那几个被切到的 `.ts` 收进仓库（例如 `legacy/server-src/`），CI 里指 `LEGACY_SERVER_SRC` 过去。
   ⚠️ 动之前**必须先扫一遍凭据** —— 「旧版生产环境凭据绝不写进任何文件、提交或日志」是硬规矩。
2. 认下这 2 个台子只在本地跑。

### 那 1 个要有业务配置的台子（也是「种子」那条的收口办法）

`print-lineno-check.mjs` 的夹具照着**真业务配置**写（公式 / 打印模板）。本地 verify 靠
**只读克隆开发库**把它喂饱（见第 2 节），CI 上是空库 ⇒ 它进「未运行」。

要收口就得把那份配置固化成**提交进仓库的夹具**（例如一份 `insert into formulas …` 的种子 SQL），
让 `verify` 在 CI 上也能灌。代价：那份配置从此要跟着业务一起维护，
**公式改了夹具也得改**，否则台子会以一种很难查的方式变红。**还没拍板。**

---

## 4. 为了能跑起来，本次改了台子的哪些**环境绑定**

改的全是「连到哪」，**没有一个断言、没有一个夹具的期望值被改过**。
所有缺省值与改动前**逐字相同** —— 单独 `node docs/xxx.mjs` 的行为一点没变。

| 类别 | 文件数 | 改了什么 | 为什么必须改 |
|---|---|---|---|
| 写死的仓库根路径 | 12 + 2 | `const ROOT = '/Users/aaa/Desktop/door-main'` → `resolve(HERE, '..')` / `('..','..')` | CI 的 checkout 路径不是这个，写死就崩。`docs/*.mjs` 那 11 个台子**早就是这个写法**，改的是对齐既有惯例。`docs/home-audit/` 在仓库根下**两级**，所以是 `resolve(HERE, '..', '..')` |
| 写死的库 / 容器 / 用户 | 7 | 新增 `DB_CONTAINER` / `DB_USER` / `DB_NAME` 环境变量，**缺省值不变** | **这条是安全问题，不只是便利**：这些台子用它做**清理**（`DELETE FROM order_lines WHERE order_id IN (…)`）。verify 的 id 来自 `smartdoor_verify`，语句却打到 `smartdoor` —— 两个库的序列都从 1 开始、**id 必然撞上**，等于删你开发库里的真数据 |

被改的 7 个：`lineno-logiccheck`、`hui-save-clobber-check`、`finance-reversal-e2e`、
`hui-row-save-check`、`print-lineno-check`、`qrscanner-scan-logiccheck`、`qrscanner-authz-check`。

两个共用库（`docs/home-audit/lib/hui-decode.mjs`、`docs/legacy-finance/lib/run-legacy-fn.mjs`）
也一并修了 —— 它们是 29 个台子的**传递依赖闭包**，不改的话 CI 上大半台子进不去。

### `run-all.mjs` 新增的三个环境变量

| 变量 | 作用 |
|---|---|
| `RUN_ALL_SKIP=a.mjs,b.mjs` | 跳过指定台子。跳过会在汇总里**单列一行**，不是静默略过 |
| `RUN_ALL_STRICT=1` | 清空 `EXPECTED`：本该「⏭ 不算真红」的失败一律算红。verify 跑的是自己刚拉起的干净后端，「环境性」借口不成立 |
| `RUN_ALL_SUMMARY=<path>` | 落一份机器可读汇总，verify 靠它如实报出「已知红」，而不是只看退出码 |

### 顺带清掉的三处

1. **`EXPECTED` 里原有两条死键**（键必须与 `collect()` 产出的路径逐字一致，这两条永不命中）：
   `docs/home-audit/merge-audit.mjs`（收集正则 `(-logiccheck|-check|-e2e)\.mjs$` 匹配不到它，
   它压根不在收集范围内）与 `docs/finance-reversal-e2e.mjs`（真文件在 `docs/home-audit/` 下）。
   它们从没生效过，却让读代码的人以为「这两个不跑是安排好的」。**已删** ——
   `merge-audit.mjs` 是块「指路牌」（见它文件头），只能手工跑，跑必退 1。
2. `r.tai ?? r.tail` 是 `r.tail` 的笔误（靠 `??` 兜住才没出事）。已改回 `r.tail`。
3. `scripts/verify.mjs` 里 `--quiet` 解析了却从没往下传 —— 现在真的透传给 `run-all.mjs` 了。
   （写文档时才发现：不实测一遍，`npm run verify -- --quiet` 会是个**假开关**。）

---

## 5. 🔴 已知红：`finance-reversal-e2e.mjs`（**待裁决**）

它已经登记在 `docs/home-audit/run-all.mjs` 的 `KNOWN_RED` 里 ——
**「已登记」不等于「是绿灯」**，它每次跑都是真失败，只是原因查清了、记在案，
不让它天天把 CI 卡死。**修好一条就删一条。**

### 症状

```
✓ 旧写法 未分配: -500
✗ 旧写法 实收: 300（应 300）          ← 期望「≠300」，实得恰好 =300
✓ 新写法 未分配: 300
✓ 新写法 实收: 300
✗ 新写法 客户余额 = −未分配: 0（应 -300）
```

### 夹具是什么

```
客户往池子打 300，并把它分给订单 A
另外直接给订单 B 收 200
A、B 两张单总额各 1000
```

然后分别用**旧写法**（整笔已分配额写成一条客户级负收款）和**新写法**（按来源拆成
带 `order_id` 的负收款 + 负的 `finance_allocations`）做红冲，再把两张单都删掉，比 `客户余额`。

### ① 已查清：那两条断言的期望值与旧版口径矛盾

两条都拿**旧版源码**核过（`~/Downloads/server/src/modules/finance/finance.service.ts`）：

| 断言 | 它期望 | 旧版实际 |
|---|---|---|
| `旧写法 实收 ≠ 300`（`expectFail`：期望**不相等**） | 旧写法红冲之后，实收**应当偏离**正确值 —— 它想抓的是「整笔写成客户级负收款」多扣一次的那个 bug | ✗ 旧版里**红冲根本不改实收**：`实收金额: toNum(b.totalTopup)`（`:762`），而 `totalTopup += (prepaidDelta > 0 ? prepaidDelta : 0)`（`:398`/`:409`）—— **只加正数**，负数一分不减。所以「应当偏离」没有依据；而在我们的实现里两条腿又都算出 300，它必然红 |
| `新写法 客户余额 = −未分配` | 客户余额可以是负的、恰等于 −未分配 | ✗ `客户余额: Math.max(0, unpaidTotal − customerAdjustTotal)`（`:763`）—— **夹零，永不为负** |

⇒ 这两条是**改动 4 / 改动 5 之前**写下的。而这个台子一直躺在 `EXPECTED`（⏭）里，
**从来没人要求它绿过**，所以没人发现它过时了 —— 这正是「统一入口 + 跑全量」要抓的东西。

按项目规矩，夹具**只有在能说清「夹具本身与旧版口径不符」时**才能动，理由还要写进脚本注释 ——
这两条**满足**那个条件。但下面那件事没裁决之前，本轮**没动它**。

### ② 待裁决：我们自己的 `实收金额` 确实与旧版不是一个算法

这条比上面那两条要紧，而且**不是**「夹具过时」，是我们这边的问题。

**旧版怎么算**（三段分支全读过，`:335`–`:430`）：

| 收款形态 | 旧版落的行 | 对 `totalTopup` 的贡献 |
|---|---|---|
| 带回执号、无分配行（本单直接收款，`:341`–`:358`） | 一条带 `orderId` 的收款行，`allocatedTotal = amount`，直接 `return { prepaidDelta: 0 }` | **0** |
| 带分配行（`:359`–`:383`） | 每个订单一条带 `orderId` 的收款行；`allocatedTotal = Σ 本次分配` | `prepaidDelta = amount − allocatedTotal`（`:384`），为正才加（`:398`） |
| 都没有（纯充值） | `allocatedTotal = 0` ⇒ 一条**客户级**收款行 | `amount` |

**我们的怎么算**（`backend/src/modules/finance/service.rs:235`）：

```sql
SELECT COALESCE(SUM(amount), 0.0) FROM finance_payments
 WHERE tenant_id = $1 AND customer_code = $2 AND order_id IS NULL AND amount > 0
```

只按「客户级 + 正数」取**全额 `amount`**，**没有减掉 `finance_allocations`**。
而上一条「带分配行」那种形态，正是把 `amount` 全额记成客户级收款行、
分配另记在 `finance_allocations` 里 —— 于是我们少了旧版那步相减。

⇒ **同一个夹具，四个数字**：

| 口径 | 删除前 `实收金额` |
|---|---|
| 旧版（照源码核算） | **0** —— 300 全分给了 A、200 全分给了 B，两次 `prepaidDelta` 都是 0 |
| **我们的实现** | **300** —— 那句 SQL 只看客户级那行 |
| 夹具**文件头**写的 | 500 |
| 夹具**断言**的（新写法应 =） | 300 |

夹具断言的 300 恰好等于我们算的 300，**不等于旧版** —— 所以它现在**测的是「我们自己前后一致」，
不是「和旧版一致」**。文件头那句「判定标准是**不变量**，不是手填的期望值」也没做到：
300 / −未分配 / 500 都是手填的。

**为什么没有当场改**：`finance_allocations` 表**没有 `payment_id`**（`migrations/0019_finance.sql:54`），
只有 `order_id` + `customer_code`。旧版的相减是**按每一笔收款各减各的分配**、
**逐笔夹零取正**；我们的表结构表达不了「这笔分配是从哪笔客户级收款里出的」，
只按客户聚合相减的话，多笔收款混在一起会得出与旧版不同的数。所以这不是把 SQL 改一行的事，
得先定方向：

1. **认下我们的算法**（「累计充值」= 客户级收款全额）—— 那 `service.rs:229-234` 的注释是错的，
   它引的 `svc:384-386` 说的正是相减后的余额；注释要改成如实描述，夹具的 300 也要说明来由。
2. **对齐旧版**（累计充值 = 未分配掉的余额）—— 要给 `finance_allocations` 加 `payment_id`
   才能逐笔相减夹零，是**迁移 + 所有写入路径 + 所有既有数据**的改动，
   而且会改掉**每一个客户**的「实收金额」显示。

⚠️ 顺带：`service.rs:229-234` 那句「本单收款（`order_id` 非空）**从来不计入** totalTopup」
**是对的**（对着上面 `:341`–`:358` 核过）—— 别因为这条 SQL 有问题就把整段注释一起否了。

`docs/legacy-finance/` 里已有财务口径的差分台，动这句之前先跑它们。

---

## 6. 环境变量速查

| 变量 | 缺省 | 作用 |
|---|---|---|
| `VERIFY_PORT` | `3100` | verify 起后端的端口 |
| `VERIFY_DB` | `smartdoor_verify` | verify 用的一次性库 |
| `VERIFY_SEED` | 开启 | `0` = 不克隆开发库配置，按空库跑 |
| `DB_CONTAINER` / `DB_USER` / `DB_NAME` | `smartdoor-db` / `smartdoor` / `smartdoor` | 台子直接 exec SQL 时的目标 |
| `BASE` / `E2E_PORT` | 各台子自己定（多为 `http://localhost:3000`；`qrscanner-authz-check` 是 `3999`）/ `3999` | 台子打的后端地址。`verify` 把 `BASE` 与 `E2E_PORT` 都指到自己起的那个后端 |
| `LEGACY_SERVER_SRC` | `~/Downloads/server/src` | 旧版服务端源码位置（见第 3 节） |
| `RUN_ALL_SKIP` / `RUN_ALL_STRICT` / `RUN_ALL_SUMMARY` | 空 | 见第 4 节 |

---

## 7. 加一个新的检查，加在哪

- **Rust 侧**（fmt / clippy / test）：什么都不用做，workspace 成员自动被覆盖。
- **一个新的差分台**：放进 `docs/` 或 `docs/home-audit/`，文件名以 `-logiccheck` /
  `-check` / `-e2e` 结尾，`run-all.mjs` 会自动收进来 —— **verify 和 CI 也跟着自动收**。
  别把台子藏进子目录：`run-all.mjs` 只扫这两层（`docs/custom-docs-recon/` 那 13 个
  「自定义单据」验收脚本就因此**不在** verify 范围内，它们是另一套门槛）。
- **台子要读库**：用 `DB_CONTAINER` / `DB_USER` / `DB_NAME` 三个变量拼 `docker exec`，
  别写死库名（理由见第 4 节）。
