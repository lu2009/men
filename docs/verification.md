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
| 5 | 建库 → 起后端 → 等 health → `run-all.mjs`（37 个差分台）→ 收尾 | 详见下面第 3 节 |

**⚠️ 第 2 步必须早于第 3 步。** `app/src-tauri/tauri.conf.json` 的 `frontendDist` 指向 `../dist`，
而 `app/dist/` 是 gitignore 的 —— CI 上刚 checkout 出来没有这个目录，先跑 clippy 的话
`tauri-build` 直接报错。

> 用户原话把顺序列成「1 前端构建 / 2 cargo test / 3 台子 / 4 fmt / 5 clippy / 6 PG 集成」。
> 这里把 fmt 提到最前、前端构建提到 clippy 前，其余等价。第 6 项「PostgreSQL 集成测试」
> 就是第 5 步 —— 用户已确认「3 和 6 是同一件事」（那 37 个台子打的全是真后端 + 真 PG）。

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

> ⚠️ 下面这段是**一次真实运行的转录，逐字保留** —— 它是 **2026-09-20 把
> `hui-extract-movecheck.mjs` 接进收集范围之前**那次跑的。接入后是 34 个台子，
> 2026-09-20 再加 Home 版的 `home-extract-movecheck.mjs` 后是 **35** 个，
> 见本节正文（和 `run-all.mjs` 现跑的汇总）。

```
共 33 个台子：✅ 通过 33 · ⏭ 跳过(环境/作废) 0 · 🔴 已知红(待裁决) 0 · ❌ 失败 0
```

### 本地（有开发库、有仓库外旧版源码）

`npm run verify`：36 个全跑 —— **36 绿**（`KNOWN_RED` 已于 2026-09-20 排空，见第 5 节）。

> 单独手工跑 `node docs/home-audit/run-all.mjs`（不带 `RUN_ALL_STRICT`）会看到另一组数：
> **29 绿 + 6 个 ⏭ + 0 已知红**（2026-09-20 实测，不是算出来的；接入 movecheck 前是 27）。
> 那 6 个 ⏭ 都是「默认打 `http://127.0.0.1:3999` 的**独立实例**，手工跑时没起」：
>
> | 台子 | 手工跑为什么 ⏭ |
> |---|---|
> | `docs/qrscanner-authz-check.mjs` | 它的独立实例用 `BASE`（默认 `http://localhost:3999`）。`verify` 把 `BASE` 指向自己起的后端，所以它在 verify 里是 ✅ |
> | `docs/home-audit/finance-reversal-e2e.mjs` | 用 `E2E_PORT`（默认 3999），且它还要写库（靠 `DB_NAME` 指向的那个） |
> | `docs/legacy-finance/0{5,6,7,9}-*.mjs`（四台） | 同上，`E2E_PORT` 默认 3999 |
>
> `verify` 把 `BASE` / `E2E_PORT` / `DB_*` 一起指到自己起的后端与一次性库，所以这 6 个在 verify 里都是 ✅。
>
> ⚠️ 那 29 绿**另有一个前提**：**开发后端在 `127.0.0.1:3000` 上起着**。多数台子默认打
> `:3000`（可用 `E2E_PORT` 覆盖），而它们**不在** `EXPECTED` 里 —— 忘了起后端会被如实记成
> ❌，不是 ⏭。这是有意的：`:3000` 是「你本该在用的那套」（未运行 ≠ 通过的反面 ——
> **跑不动也不该假装是环境问题**），`:3999` 才是「要单独起的那个」。
>
> ⚠️ 这几条曾经遮住了一条真红（`finance-reversal-e2e` 拿到实例后也不绿）。现在已经真绿，
> 但**做法本身仍要警惕**：`EXPECTED` 是「环境不满足」的免红牌，手工跑时它会一视同仁地盖上，
> 分不清底下是真红还是真环境问题。要判断它到底绿不绿，看 verify 那一组数。
> ⚠️ 后四台**还额外**要仓库外旧版源码 —— 没有那份源码时它们**在 import 阶段就 ENOENT**，
> 也一样被这张免红牌盖住。所以「手工跑是 ⏭」既不是绿也不是红，只是没信息。

### CI（`.github/workflows/ci.yml`）

| 状态 | 数量 | 是哪些 |
|---|---|---|
| ✅ 跑并且过 | 29 | —— |
| 🔴 跑了但红（已登记） | 0 | `KNOWN_RED` 已排空（第 5 节） |
| ⏭ **未运行** | 7 | 见下 |

29 + 0 + 7 = 36。

> 2026-09-20 接入 `docs/home-audit/hui-extract-movecheck.mjs`（收集正则加了 `-movecheck`）后，
> ✅ 那一格从 26 变 **27**，总数从 33 变 **34**；同日再立 Home 版的
> `docs/home-audit/home-extract-movecheck.mjs`（同一正则命中）后，✅ 变 **28**、总数变 **35**；
> 同日再立 `docs/home-audit/progresssegments-logiccheck.mjs` 后，✅ 变 **29**、总数变 **36**。
> ⏭ 一直是 7。
> 两个 movecheck 都只读 git + 文件、不依赖后端，所以**在 CI 上也跑** —— 前提是 checkout 取了全历史
> （它们要 `git show <旧提交>:<路径>`），见 `.github/workflows/ci.yml` 里那步 `fetch-depth: 0`。

### 2026-09-20：CI run #1 第一次真跑 —— 8 个台子 `ENOENT: /tmp/home-map.json`

**不是这次拆分引入的**，是第一次真跑 CI 才露出来的老账：有几个台子的**夹具在 `/tmp` 里**
（`home-map.json` / `progress*.json` / `progress.decoded.js`），是**本机的逆向产物** ——
不在仓库里，`verify.mjs` 与 `run-all.mjs` 也都没有生成它们的环节，CI 上自然不存在。

- `docs/home-audit/legacy-slice.mjs` **模块加载时**就 `readFileSync('/tmp/home-map.json')`
  ⇒ import 它的 7 个台子，加上自读那份表的 `total-balance-logiccheck.mjs`，共 **8 个**当场崩。
- `docs/progress-{cell,dashboard,more,select,toolbar}-logiccheck.mjs` 会**自愈**（缺了就现调
  `legacy/decode-progress-*.mjs` 生成），但其中 `legacy/decode-progress-scoped.mjs` 写死了
  `createRequire('/Users/aaa/Desktop/door-main/app/package.json')` ⇒ CI 的 checkout 在别处，
  `require('@babel/parser')` 直接 `MODULE_NOT_FOUND`，这 5 个跟着一起红。

**改法**（三处，全是「文件从哪来 / 路径怎么算」，**没动任何断言、没动任何夹具期望值**）：

| 文件 | 改了什么 |
|---|---|
| `docs/home-audit/legacy-slice.mjs` | `/tmp/home-map.json` **不在就现生成**（调 `legacy/decode-home-map.mjs`）—— 与 `docs/progress-*.mjs` 早就有的口径一致 |
| `docs/home-audit/total-balance-logiccheck.mjs` | 同上（它自己读那份表） |
| `legacy/decode-progress-scoped.mjs` | `createRequire` 的锚点从**写死的绝对路径**改成从 `import.meta.url` 推根 |

生成是**确定性**的：2026-09-20 实测「在一台从没有过夹具的机器上现生成」与原文件
**字节完全相同**（4 个文件逐字相同）。所以这不是把台子放松，只是把「前置」从
**人肉准备**变成了**自己准备** —— `verify` / CI / 别人的机器都直接跑得起来。

那 7 个**未运行**的：

| 台子 | 为什么 |
|---|---|
| `docs/home-audit/lineno-logiccheck.mjs` | 缺**仓库外**旧版服务端源码 |
| `docs/qrscanner-scan-logiccheck.mjs` | 同上 |
| `docs/legacy-finance/05-diff-alloc.mjs` | 同上（2026-09-20 收进收集范围后才显出来） |
| `docs/legacy-finance/06-diff-balance.mjs` | 同上 |
| `docs/legacy-finance/07-diff-execute.mjs` | 同上 |
| `docs/legacy-finance/09-diff-orderpay.mjs` | 同上 |
| `docs/home-audit/print-lineno-check.mjs` | 空库 —— 它要有业务配置（公式 / 打印模板）才成立 |

**「未运行」不是「通过」。** verify 与 run-all 都会把这几行单独打出来，
最后一行也不会写「全绿」，而是写「没有失败项，但不等于全绿：7 个台子本次未运行」。
（`KNOWN_RED` 排空之前，那句话后面还会跟一句「M 个已知红未修」。）

### 那 6 个缺仓库外源码的台子

它们靠 `docs/legacy-finance/lib/run-legacy-fn.mjs` 切**旧版服务端**的 TS 函数来跑差分，
那份源码在 `~/Downloads/server`（**仓库外**，3.9M / 50 个 `.ts`），CI 上不存在。
该模块**顶层就读** `modules/finance/finance.service.ts` ⇒ 文件不在时 import 直接 ENOENT。

已在 `run-legacy-fn.mjs` 里留好接口：路径可用 **`LEGACY_SERVER_SRC`** 覆盖。
要收口只有两条路，**都还没有拍板**：

1. 把那几个被切到的 `.ts` 收进仓库（例如 `legacy/server-src/`），CI 里指 `LEGACY_SERVER_SRC` 过去。
   ⚠️ 动之前**必须先扫一遍凭据** —— 「旧版生产环境凭据绝不写进任何文件、提交或日志」是硬规矩。
2. 认下这 6 个台子只在本地跑。

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
| 写死的库 / 容器 / 用户 | 7 + 4 + 1 | 新增 `DB_CONTAINER` / `DB_USER` / `DB_NAME` 环境变量，**缺省值不变** | **这条是安全问题，不只是便利**：这些台子用它做**清理**（`DELETE FROM order_lines WHERE order_id IN (…)`）。verify 的 id 来自 `smartdoor_verify`，语句却打到 `smartdoor` —— 两个库的序列都从 1 开始、**id 必然撞上**，等于删你开发库里的真数据 |

被改的 7 个：`lineno-logiccheck`、`hui-save-clobber-check`、`finance-reversal-e2e`、
`hui-row-save-check`、`print-lineno-check`、`qrscanner-scan-logiccheck`、`qrscanner-authz-check`。

**2026-09-20 追加的 4 + 1 个**：`docs/legacy-finance/0{5,6,7,9}-*.mjs`（收进收集范围，必须能改指向）
与 `08-verify-live.mjs`（**没**收进收集范围，但它读的**本来就是你想指的那个库** ⇒ 跟着改成同一套
环境变量，省得「只想看看正式库」时还得去改源码）。见下一节。

两个共用库（`docs/home-audit/lib/hui-decode.mjs`、`docs/legacy-finance/lib/run-legacy-fn.mjs`）
也一并修了 —— 它们是 37 个台子的**传递依赖闭包**，不改的话 CI 上大半台子进不去。

### 2026-09-20：`docs/legacy-finance/0{5,6,7,9}` 收进统一入口

这四台**一直在仓库里，却从来没进过任何统一入口** —— 收集正则
（当时是 `/(-logiccheck|-check|-e2e)\.mjs$/`，2026-09-20 晚些时候加了 `-movecheck`）匹配不到
`05-diff-alloc.mjs` 这种命名。
它们比的是**财务口径**（分配/优惠、余额与实收、落库效果、本单收款+预付优惠），
正是「改了 `paid_amount` 的 SQL」这种改动最该被它们抓住的地方 —— 结果它们全程没参与。
这次一并收进来：`run-all.mjs` 的 `collect()` 增加了第二个目录与第二个正则。

| 项 | 变化 |
|---|---|
| 收集范围 | `docs/`、`docs/home-audit/`，**新增** `docs/legacy-finance/`（正则 `^0\d-.*\.mjs$`，只扫第一层，`lib/` 不算） |
| 库绑定 | 四台的 `const DB = 'docker exec … -d smartdoor -tAc'` 改成与既有一致的环境变量写法。**默认值逐字不变** |
| CI | 这四台要**仓库外**旧版源码 ⇒ 进 `verify.mjs` 的 `NEEDS_LEGACY_SRC` ⇒ CI 上「未运行」由 3 个变 **7 个**（26 通过那部分不变） |
| 手工跑 | 补进 `run-all.mjs` 的 `EXPECTED`（默认 3999 没起 ⇒ ⏭，不是红），与 `finance-reversal-e2e` 同一条理由 |

#### 为什么 `08-verify-live.mjs` **不**收（这一条是判断，不是遗漏）

它长得像同一批，其实不是一类东西：

| | 05/06/07/09 | 08 |
|---|---|---|
| 性质 | 差分台（夹具喂两边比） | **真实数据体检**（拿库里的真账，左边在 SQL 里独立算一遍，右边打接口） |
| 写库 | 写 `__TMP%` 再清 | **只读**，一个字节都不写 |
| 入参 | 无需 | **要人工传客户编号**（`argv[2]`） |
| verify 的库里有真账吗 | 不需要 | **没有** —— 那是一次性空库 |

最后一行是决定性的：在空库上，左边（旧版公式，`client_code='1'` 查不到单）与右边（接口）
**都算 0**，它会「✓ 真实数据全部核对通过」—— 一句**假绿**。而「假绿」比红更坏：
它会让「全套 33 绿」这句话变成假的。所以它进 `run-all.mjs` 的 `MANUAL` 名单，
只能手工跑：`node docs/legacy-finance/08-verify-live.mjs <客户编号>`。

（`merge-audit.mjs` 是同类 —— 靠命名天然排在收集范围外。区别是它是块「指路牌」，
而 08 是真能干活的工具，所以这次给它显式的 `MANUAL` 名单 + 文件头写明理由，
而不是继续指望「别人碰巧不会加进正则」。）

### `run-all.mjs` 新增的三个环境变量

| 变量 | 作用 |
|---|---|
| `RUN_ALL_SKIP=a.mjs,b.mjs` | 跳过指定台子。跳过会在汇总里**单列一行**，不是静默略过 |
| `RUN_ALL_STRICT=1` | 清空 `EXPECTED`：本该「⏭ 不算真红」的失败一律算红。verify 跑的是自己刚拉起的干净后端，「环境性」借口不成立 |
| `RUN_ALL_SUMMARY=<path>` | 落一份机器可读汇总，verify 靠它如实报出「已知红」，而不是只看退出码 |

### 顺带清掉的三处

1. **`EXPECTED` 里原有两条死键**（键必须与 `collect()` 产出的路径逐字一致，这两条永不命中）：
   `docs/home-audit/merge-audit.mjs`（收集正则 `(-logiccheck|-movecheck|-check|-e2e)\.mjs$` 匹配不到它，
   它压根不在收集范围内）与 `docs/finance-reversal-e2e.mjs`（真文件在 `docs/home-audit/` 下）。
   它们从没生效过，却让读代码的人以为「这两个不跑是安排好的」。**已删** ——
   `merge-audit.mjs` 是块「指路牌」（见它文件头），只能手工跑，跑必退 1。
2. `r.tai ?? r.tail` 是 `r.tail` 的笔误（靠 `??` 兜住才没出事）。已改回 `r.tail`。
3. `scripts/verify.mjs` 里 `--quiet` 解析了却从没往下传 —— 现在真的透传给 `run-all.mjs` 了。
   （写文档时才发现：不实测一遍，`npm run verify -- --quiet` 会是个**假开关**。）

---

## 5. `finance-reversal-e2e.mjs`：那条已知红是怎么排空的（2026-09-20 已修）

这一节留着有用 —— 它是 `KNOWN_RED` 这套机制唯一一次实战的完整记录：
一个台子怎么被 `EXPECTED` 遮住、怎么查清、改完之后**为什么必须动夹具**、
以及「修好一条就删一条」是怎么执行的。

**结论：`run-all.mjs` 的 `KNOWN_RED` 现在是空的**；机制本身留着，下次用。

### 当时的症状

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

### 改完之后的现场（10 条断言全绿）

```
旧写法：删除后 未分配=-500 实收=0 客户余额=0
  ✓ 旧写法 删除前 实收: 0
  ✓ 旧写法 未分配: -500      ← 仍是 expectFail：旧写法本来就该不满足不变量，留着当反例
  ✓ 旧写法 实收: 0
  ✓ 旧写法 客户余额: 0
新写法：删除后 未分配=300 实收=0 客户余额=0
  ✓ 新写法 删除前 实收: 0
  ✓ 新写法 未分配: 300
  ✓ 新写法 实收: 0
  ✓ 新写法 客户余额: 0
部分分配：往池子打 500，只分 300 给订单 C（该单总额 1000）
  ✓ 部分分配 未分配: 200
  ✓ 部分分配 实收: 200
```

最后那两条是本次**新加**的一块 —— 原因值得记下来：上面两笔收款的 `prepaidDelta`
**都是 0**，所以上面几条只证明了「**不该加的钱没加**」，而「**该加多少**」
（`amount − allocatedTotal` 减得对不对、夹没夹零）一条都没验。
`实收金额` 恒为 0 的台子，在「忘了相减、只把客户级收款全额相加」那种错法下**也会绿** ——
本夹具就正是这样绿了几个月。补上「打 500、只分 300 ⇒ 实收 200」这块之后，
旧公式（全加起来 = 500）会**直接红**。

`实收 = 0` 一眼看着像错 —— 客户明明打了 300 进池子。**它不是错**，是旧版口径：
`实收金额` 是**累计充值**，只累加 `prepaidDelta > 0` 的部分，而这个夹具里两笔收款的
`prepaidDelta` 都是 0（池子那笔 300 全分给了 A；B 那笔是本单直收，旧版走
`allocatedTotal = amount` 那条分支）。这条理由已写进脚本注释，别当成笔误再「修」回去。

### ① 已查清：那两条断言的期望值与旧版口径矛盾

两条都拿**旧版源码**核过（`~/Downloads/server/src/modules/finance/finance.service.ts`）：

| 断言 | 它期望 | 旧版实际 |
|---|---|---|
| `旧写法 实收 ≠ 300`（`expectFail`：期望**不相等**） | 旧写法红冲之后，实收**应当偏离**正确值 —— 它想抓的是「整笔写成客户级负收款」多扣一次的那个 bug | ✗ 旧版里**红冲根本不改实收**：`实收金额: toNum(b.totalTopup)`（`:762`），而 `totalTopup += (prepaidDelta > 0 ? prepaidDelta : 0)`（`:398`/`:409`）—— **只加正数**，负数一分不减。所以「应当偏离」没有依据；而在我们的实现里两条腿又都算出 300，它必然红 |
| `新写法 客户余额 = −未分配` | 客户余额可以是负的、恰等于 −未分配 | ✗ `客户余额: Math.max(0, unpaidTotal − customerAdjustTotal)`（`:763`）—— **夹零，永不为负** |

⇒ 这两条是**改动 4 / 改动 5 之前**写下的。而这个台子一直躺在 `EXPECTED`（⏭）里，
**从来没人要求它绿过**，所以没人发现它过时了 —— 这正是「统一入口 + 跑全量」要抓的东西。

按项目规矩，夹具**只有在能说清「夹具本身与旧版口径不符」时**才能动，理由还要写进脚本注释 ——
这两条**满足**那个条件（上面那张表就是理由，且逐条对着旧版源码核过）。

**已改**（2026-09-20，与下面 ② 的 SQL 对齐同一笔）：

| 原来 | 现在 | 依据写在哪 |
|---|---|---|
| `check('实收', …, 300, expectFail)` 两条 | `check('…删除前 实收', …, 0)` + `check('…实收', …, 0)`，去掉 `expectFail` | 脚本里 `实收金额 = 0` 那段注释（引 `svc:398/:409`、`:341-358`、`:384`） |
| `check('新写法 客户余额 = −未分配', …, -after.unallocated_balance)` | `check('…客户余额', …, 0)`，两个写法都查 | 同处注释：改动 4 把 `客户余额` 改成「客户还欠多少」并夹零（旧版 `:763`） |

顺带修掉了脚本**文件头**的一处过期说法：它把 `未分配余额` 公式里的净收款叫成「实收金额」
（改动 5 之前的叫法），现在改称「净收款」并注明**与对外的 `实收金额` 分母不同、别合并**。
另外新增了「删除前 实收」两条断言 —— 旧公式下这里是 500，是真红本红；
不加这两条，夹具只能验「红冲前后自洽」，验不到口径本身。

### ② 我们自己的 `实收金额` 与旧版不是一个算法 —— **已对齐（迁移 0025）**

这条比上面那两条要紧，而且**不是**「夹具过时」，是我们这边的问题。**方向已拍板：对齐旧版。**

**旧版怎么算**（三段分支全读过，`:335`–`:430`）：

| 收款形态 | 旧版落的行 | 对 `totalTopup` 的贡献 |
|---|---|---|
| 带回执号、无分配行（本单直接收款，`:341`–`:358`） | 一条带 `orderId` 的收款行，`allocatedTotal = amount`，直接 `return { prepaidDelta: 0 }` | **0** |
| 带分配行（`:359`–`:383`） | 每个订单一条带 `orderId` 的收款行；`allocatedTotal = Σ 本次分配` | `prepaidDelta = amount − allocatedTotal`（`:384`），为正才加（`:398`） |
| 都没有（纯充值） | `allocatedTotal = 0` ⇒ 一条**客户级**收款行 | `amount` |

**我们的怎么算**（`backend/src/modules/finance/service.rs:252`，改后）：

```sql
SELECT COALESCE(SUM(GREATEST(0.0::float8, p.amount - COALESCE(a.alloc, 0.0))), 0.0)
  FROM finance_payments p
  LEFT JOIN (SELECT payment_id, SUM(amount) AS alloc FROM finance_allocations
              WHERE tenant_id = $1 AND payment_id IS NOT NULL
              GROUP BY payment_id) a ON a.payment_id = p.id
 WHERE p.tenant_id = $1 AND p.customer_code = $2 AND p.order_id IS NULL
```

改之前它只按「客户级 + 正数」取**全额 `amount`**，**没有减掉 `finance_allocations`** ——
而上一条「带分配行」那种形态，正是把 `amount` 全额记成客户级收款行、
分配另记在 `finance_allocations` 里，于是我们少了旧版那步相减。**同一个夹具，四个数字**：

| 口径 | 删除前 `实收金额` |
|---|---|
| 旧版（照源码核算） | **0** —— 300 全分给了 A、200 全分给了 B，两次 `prepaidDelta` 都是 0 |
| 我们（改之前） | **300** —— 那句 SQL 只看客户级那行 |
| 夹具**文件头**当时写的 | 500 |
| 夹具**断言**当时要的（新写法应 =） | 300 |

夹具断言的 300 恰好等于我们算的 300，**不等于旧版** —— 所以它当时测的是
「我们自己前后一致」，不是「和旧版一致」。**改完这三处都统一到 0**。

三条不能省的细节（都写在 `service.rs` 那段注释与迁移 0025 的文件头里）：

1. **逐笔相减、逐笔夹零** —— 旧版对每一笔收款各夹各的。聚合相减会算错：
   收 300 却分配 400、另收 200 未分配 ⇒ 旧版 `max(0,300-400) + max(0,200-0) = 200`，
   聚合相减是 `max(0,500-400) = 100`。
2. **只减「收款时那种分配」**（`finance_allocations.payment_id` 指向本笔的）。
   旧版「预付款分配」（`executePrepaymentAllocation` `:805`）**不动 `totalTopup`** ——
   它只改 `prepaidBalance` / `totalSpent`（`:838-857`）；那种分配的 `payment_id` 是 NULL，天然不参与。
3. **红冲写的负分配也必须留 NULL**：若给它挂上 `payment_id`，
   `max(0, 300 − (300−300)) = 300` 会把实收**加回去**，而旧版 `totalTopup` **永不因红冲增长**。

写入侧只有一处改：`add_customer_payment` 现在会把新收款行的 id 写进它那批分配的
`payment_id`（迁移 `0025_allocation_payment_link.sql` 加了这一列 + 一个索引，**不设外键**，
与 0019 的既定做法一致）。

⚠️ **不回溯历史数据**（用户 2026-09-20 拍板，接受新旧不一致）：迁移**不 UPDATE 任何行** ——
库里已有的分配行归不到来源，无法判断哪几行是「收款时分配」（该挂 `payment_id`）、
哪几行是「预付款分配」（该保持 NULL），硬猜就是编数据。后果如实记：
这批历史行 `payment_id` 为 NULL ⇒ 算 `实收金额` 时**不减** ⇒ 它们维持改动前的值。
（写迁移时库里的实际状况：`finance_allocations` 6 行、全部 `order_id = 424`；
其中 id 78 的 `discount = 1.6` —— 只有 `execute_prepayment_allocation` 会写非零 discount，
`add_customer_payment` 硬编码 0 ⇒ 至少有一行确定属于后者，正好证明「归不到来源」不是推测。）

⚠️ 顺带：`service.rs` 那句「本单收款（`order_id` 非空）**从来不计入** totalTopup」
**是对的**（对着上面 `:341`–`:358` 核过）—— 别因为这条 SQL 出过问题就把整段注释一起否了。

#### 这次改动**哪台子能证明、哪台子不能**

| 台子 | 能不能当本次的证据 | 为什么 |
|---|---|---|
| `docs/home-audit/finance-reversal-e2e.mjs` | ✅ **正证据** | 它真的 POST 了一笔「带分配列表的收款」，断言的正是 `paid_amount` |
| `docs/legacy-finance/06-diff-balance.mjs` | ❌ **不能** | 它把旧版 `totalTopup` / `prepaidBalance` 的**存量列当输入直接喂**，从不走「收款带分配」那条路。它绿只说明**没改坏**，说明不了改对了 |
| `docs/legacy-finance/{05,07,09}-*.mjs` | ❌ 同上 | 分别测优惠、`executePrepaymentAllocation` 落库、本单收款，都不算 `paid_amount` |

⇒ **这台台子的绿是必须的，别的台子的绿不是替代品。**

顺带一句，免得被误读：`06-diff-balance` 那行「池子红冲后为负 | `实收金额` | 旧版 1000 /
新版 −200 ⛔」（记在 `docs/legacy-finance/04-diff-ours.md` 的 §9.5）现在也绿了 ——
但那是**改动 5**（去掉净额里的负数）修好的，**与本次的相减无关**：
它给我们的输入是一笔**没有分配**的客户级收款，`amount` 直接等于旧版 `totalTopup`，
相减那一步在它这里恒等于不减。别把两件事记成一件。

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
