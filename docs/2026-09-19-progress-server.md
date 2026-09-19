# 生产进度（`/Progress`）—— **服务端**口径逆向

> 姊妹文档：`docs/2026-09-19-progress-analysis.md`（前端看到什么）。**本文只写服务端到底怎么算 / 怎么存。**
>
> 旧服务端源码：`/Users/aaa/Downloads/server`（Node + TS + Prisma；文件头注释多处写 `Match Flask` /
> `matching Flask`，即它是**从 Flask 重写来的当前生产服务端**）。
> 前端证据用**解码表下标**给（各包的解码表由 `legacy/decode-progress-map.mjs` dump 出来），
> 服务端证据给 `文件:行号` + 源码原文。
>
> ⚠️ 本文没有读 `/Users/aaa/Downloads/server/.env`，也没有连生产库。

本文要回答的是 `2026-09-19-progress-analysis.md` §9 里标 ⚠️ 的那几条中**服务端可证**的部分，
外加「名字相近的一堆 getProgress* 到底谁是谁」。

### ⚠️ 与姊妹文档的口径差异（以本文为准）

| 姊妹文档 | 它写的 | 本文的结论 |
|---|---|---|
| §9.3 | 「`registrant` 与 `ds` 在旧数据里**恰好相等**，是巧合还是约定未证实」 | **不相等，也不是巧合**：这是**两把不同的租户键**（业务键 `ds` / 配置键 `registrant`），各接口各用各的。详见 §1 |
| §9.5 | 「`updatePrintStatus` 内部未展开」 | 已整段展开 + 差分台实测，见 §2 |
| §9.6 | 「是否给别的页用，未证实」 | 已证实：读点只有 `getProcessCounts`，前端只有 `/Qrscanner`，且 `扫码员工` 从未上屏。见 §3 |
| §3.3 | 「`工序10` 走 `mergePrintStatus`，其它槽直接覆盖」 | **结论对**，本文补上「逐槽核过，没有别的特判」+ 实测，见 §4 |

---

## 0. 一页结论

| # | 问题 | 结论 |
|---|---|---|
| 1 | `GetProcedures` 的 `param2` 语义 | **不是巧合，是「配置类接口按 registrant 分租户」的约定**。服务端确实把 `param2` 当 `ds`（列名 `database_name`），但**这些配置表的 `database_name` 列里存的是 registrant（公司名），不是 `users.database_name`**。传错不会报错，只会**静默返回空**。 |
| 2 | `updatePrintStatus` 写入口径 | 写 **`工序10`（merge）** + **`customerInfo.打单操作`（merge）** + `customerInfo.单号集`（覆盖）+ `customerInfo.打单人`（有才写）+ `orders.operator_name`；**不碰 `工序1..9、11..15`**；会**重算覆盖 `生产进度` 串**；**不写 `progress_records`**；还会**顺带补 `单号`**。 |
| 3 | `扫码员工` / `扫码日期` | 只存在 `orders.door_specs` 这段 JSON 里（**没有独立表/列**），由 `updateProgress` 在 `parseScanMarker` 命中时写。**读它们的只有 `getProcessCounts`**；前端只有一个页面用（`/Qrscanner` 的「扫码统计」），且**只显示 `扫码日期`，`扫码员工` 从未上屏**。 |
| 4 | `updateProgress` 完整写入口径 | **15 个槽里只有 `工序10` 特判**（`mergePrintStatus` 合并），其余 14 槽一律**覆盖**。另外**任何槽**命中 `parseScanMarker` 都会写 `扫码员工/扫码日期`。 |
| 5 | 一堆 `getProgress*` | 六个名字（`getProgress` / `getProgressData` / `getProgressList` / `getProductionProgress` / `getProductionProgressData` / `getProgressForTerminal`）**共用同一个 handler**，差别只在契约；其中 **`getProgressForTerminal` 是写死的 400，handler 根本不执行**。 |
| 6 | `回款` 是不是服务端常量 | **不是**。服务端源码里**一处都没有**「回款」二字（`grep -rn 回款 src` 退出码 1）；`工序10` 才是服务端的硬编码槽位（3 组位置）。前端把「回款」这个名字塞进 `工序10`。 |

---

## 1. `GetProcedures` 的 `param2` —— 巧合还是约定？

### 1.1 结论（先说）

**是约定，不是巧合。** 准确说法：

> 这套系统里 `param2` 一律是「**租户键**」，但**有两套租户键**：
> - **业务表**（`orders` / `clients` / `progress_records` / `finance_*`）→ 键 = `userinfo.ds` = `users.database_name`；
> - **配置表**（`settings` / `procedures` / `templates`）→ 键 = `userinfo.registrant` = `users.company_name`。
>
> 两侧的**列名都叫 `database_name`**（Flask 老 schema 遗留下来的名字），所以读代码容易误判。
> 前端每条 URL 用的都是**该接口该用的那把键**，不是混用。

### 1.2 服务端侧证据

handler 只做一件事 —— 把 `p.ds` 原样交给 service：

```ts
// /Users/aaa/Downloads/server/src/modules/legacy-dispatch.ts:642
HANDLER_MAP['getprocedures'] = async (p) => {
  const procedures = await authServ.getProcedures(p.ds);
  return procedures;
};
```

而 `p.ds` 就是 `param2`，中间**没有任何映射/归一化**：

```ts
// /Users/aaa/Downloads/server/src/modules/legacy-dispatch.ts:1144
const rawDs = (req.query.param2 as string) || bodyRecord.param2 as string || bodyRecord.ds as string || '';
// :1146-1149
const params: HandlerParams = {
  rawAction: param1,
  rawParam2: (req.query.param2 as string) || bodyRecord.param2 as string || '',
  ds: rawDs,
```

service 直接拿它查 `procedures.database_name`：

```ts
// /Users/aaa/Downloads/server/src/modules/auth/auth.service.ts:295
export async function getProcedures(ds: string): Promise<Record<string, unknown>> {
  const user = await prisma.user.findFirst({        // ← ① 死查询：结果从未被使用
    where: { databaseName: ds },
    select: { proceduresData: true },
  });

  const procedures = await prisma.procedure.findMany({
    where: { databaseName: ds },                     // ← ② 真正的查询
    orderBy: { orderIndex: 'asc' },
  });

  const result: Record<string, string> = {};
  for (let i = 1; i <= 15; i++) result[`工序${i}`] = '';
  for (const p of procedures) {
    if (p.orderIndex) result[`工序${p.orderIndex}`] = p.name;
  }
  return result;
}
```

**写侧用的是同一个键**，所以读写对称：

```ts
// /Users/aaa/Downloads/server/src/modules/progress/progress.service.ts:859（setProcedures）
export async function setProcedures(ds: string, proceduresData: unknown) {
  ...
  await prisma.procedure.create({ data: { databaseName: ds, name, orderIndex, description } });
```

### 1.3 前端侧证据（读侧和写侧都传 registrant）

三个读点（`Progress-fb4def35.js`，解码表 `de(360)` / `E(738)` =
`https://www.samrtdoor.com.cn/1?param1=GetProcedures&param2=`）：

```js
// Progress-fb4def35.js 解码后（三处同构：看板 onWatch、批量更新 ta、单行「更新进度」）
const l = t["userinfo"]["registrant"],                       // ← userinfo.registrant
      a = await fetch("https://www.samrtdoor.com.cn/1?param1=GetProcedures&param2=" + l),
      n = await a["json"]();
if (200 === n["code"] && n["data"]) { ... }
```

一个写点（工序设置页 `/Qrscanner`，解码表 `f(448)` = `...param1=SetProcedures&param2=`）：

```js
// Qrscanner-195163c4.js（解码后）
ra = async () => {                                    // 保存工序设置
  const t = await a();
  const l = t[e(492)][e(574)],                        // e(492)="userinfo", e(574)="registrant"
        n = await fetch(e(448) + l, { method: e(159), // e(159)="POST"
          headers: { "Content-Type": e(696) }, body: JSON[e(471)](yl) });   // e(696)="application/json", e(471)="stringify"
  ...
}
```

**读和写用的是同一个 `userinfo.registrant`** —— 所以只要这套流程在旧版跑得通，
`procedures.database_name` 里存的值就是 registrant。反过来说：**如果生产库里存的是
`users.database_name`，那「工序设置保存成功」之后下拉框会永远只有「回款」一项**（见 §1.5）。

### 1.4 旁证：同一把键的兄弟接口是「registrant 键」，且生产已验证

| 接口 | 服务端读的表 | 前端传的 param2 | 证据 |
|---|---|---|---|
| `getTemplates` | `template.database_name`（`file.service.ts:190`） | `registrant` | `docs/2026-08-23-hui-recon.md:67`；落地产物 `legacy/templates/print-templates-source-raw.json`（**生产真数据**）+ `tenant-config-昊艺门窗.json`（文件名就是 registrant） |
| `login` 响应的 `registrant` 配置对象 | `setting.database_name`（`buildRegistrantConfig`，`auth.service.ts:143/326`） | — | `buildRegistrantConfig(user.companyName)` —— 服务端**自己**拿 `companyName` 当这个 `ds` |
| 造默认数据 | `setting.database_name` | — | `seed-default-user.ts:146` `databaseName: DEFAULT_USERNAME`（`DEFAULT_USERNAME = '昊艺门窗'`），而同一个 seed 里 `users.database_name = 'smartdoor'`（`seed-default-user.ts:10-11, 18-20`） |

最后一条最直白：**写 seed 的人明确知道 `settings` 表要用公司名当 `database_name`，而 `users` 表用 `smartdoor`。**

### 1.5 传错了会怎样（分三种，都不是报错）

| 场景 | 命中 | 表现 |
|---|---|---|
| `GetProcedures&param2={registrant}`（**正确**） | `procedures` 里 registrant 那批行 | 15 槽填充 |
| `GetProcedures&param2={ds}`（传成 `smartdoor`） | **空集** | 服务端返回 **15 个空字符串**（`code:200`）；前端 `.filter(x => x.value)` 后 `U=[]`，再补一个「回款」→ **工序下拉只有「回款」一项，无任何报错** |
| `getProgress&param2={registrant}`（反过来传） | `orders` 里 0 行 | `progressData: []`；前端 `200===code && data?.progressData` 为假 → 弹「**没有获取到生产进度数据**」，表空 |

也就是说：**这两把键互相替换不会抛错，只会静默降级。** 这是这套接口最容易踩的坑。

### 1.6 ⚠️ 服务端自己有一处不自洽（已证实，但后果没法在不连库的情况下验）

`login` 响应里也带一份 `userinfo.procedures_data`，而它**是按另一把键查的**：

```ts
// auth.service.ts:329-337（buildLoginResponse）
const procedures = await prisma.procedure.findMany({
  where: { databaseName: user.databaseName },   // ← 用的是 database_name，不是 companyName
  orderBy: { orderIndex: 'asc' },
});
const proceduresData: Record<string, string> = {};
for (let i = 1; i <= 15; i++) proceduresData[`工序${i}`] = '';
for (const p of procedures) if (p.orderIndex) proceduresData[`工序${p.orderIndex}`] = p.name;
```

⇒ 同一张 `procedures` 表，`login` 认为键是 `users.database_name`，`GetProcedures` 认为键是
`param2`（= 前端传的 registrant）。**两者只有在 `company_name === database_name` 时才一致。**
按 seed 的默认值（`昊艺门窗` vs `smartdoor`）它们**不一致**。

- 推测：`userinfo.procedures_data` 在生产里大概率是「15 个空串」，且**前端从来不读它**
  （全仓库扫 45 个 chunk：只有 `Login-1a4b7608.js` 读 `procedures_data` 这个 localStorage key，
  而那个 key 是 Login **自己 fetch `GetProcedures` 后写进去的**，见下）。
- ⚠️ **未证实**：没有连生产库，无法确认 `procedures.database_name` 的实际取值；
  也无法确认 `userinfo.procedures_data` 是否为空。**这一条要靠连库或打一次生产接口才能钉死。**

顺带（属于前端，但和本问强相关）：**Login 页也会拉一次 GetProcedures 缓存进 localStorage**：

```js
// Login-1a4b7608.js 解码后（解码表 x(405) = ...param1=GetProcedures&param2=，x(386)="registrant"）
try {
  const a = await fetch("https://www.samrtdoor.com.cn/1?param1=GetProcedures&param2=" + e),
        r = await a["json"]();
  200 === r?.code && r?.data && localStorage["setItem"]("procedures_data", JSON["stringify"](r.data));
} catch (a) {}
// 调用处：t[c(387)][c(386)] → t.userinfo.registrant
```

所以 `localStorage.procedures_data` 的来源是 `userinfo.registrant`，**不是** `userinfo.procedures_data`。
⚠️ `Hui-d088417c.js` 的解码表里也有 `procedures_data`（有页在用），但 Hui 包的解码器本次没解干净
（Hui 的内联解码器是另一个坑，见 `hui-inline-decoder-recipe`），**本文不展开**。

---

## 2. `updatePrintStatus` 的写入口径

### 2.1 分流：谁走 `updatePrintStatus`、谁走 `updateProgress`

```ts
// /Users/aaa/Downloads/server/src/modules/legacy-dispatch.ts:791
HANDLER_MAP['updataprogress'] = (p) => {
  if (!p.param3 || !Array.isArray(p.body) || (p.body as unknown[]).length === 0) {
    if (isRawAction(p, 'updateProgress')) return Promise.resolve(badRequestPayload());
    return Promise.resolve(html500Payload());
  }
  if (isRawAction(p, 'updataProgress') && !isProcedureSlot(p.param3)) {
    return progServ.updatePrintStatus(p.ds, p.param3, p.body as string[], p.param4 || '');
  }
  if (isRawAction(p, 'updataProgress') && p.param3 === '工序10' && p.param4) {
    return progServ
      .updateProgress(p.ds, p.param3, p.body as string[], p.param4 || '')
      .then(result => progServ.updatePrintStatus(p.ds, p.param4, p.body as string[], '', true).then(() => result));
  }
  return progServ.updateProgress(p.ds, p.param3, p.body as string[], p.param4 || '');
};
```

`isProcedureSlot` = `/^工序\d+$/.test(value.trim())`（`legacy-dispatch.ts:394`、`progress.service.ts:230`）。

| 条件 | 走哪条 |
|---|---|
| `param3` **不匹配** `/^工序\d+$/`（如 `已打生产单`） | `updatePrintStatus(ds, param3=状态文本, body=refs, param4=操作员名)` |
| `param3 === '工序10'` **且** `param4` 非空 | `updateProgress(工序10, …)` **然后** `updatePrintStatus(ds, param4, body, '', skipDetailRows=true)` |
| 其余（`工序1..9 / 11..15`，或 `工序10` 但 `param4` 为空） | `updateProgress(ds, param3, body, param4)` |

⚠️ **三个分支都带 `isRawAction(p, 'updataProgress')` 前置条件**，即 `param1` 必须是**全小写 d 的
`updataProgress`**。若客户端发 `param1=updateProgress`（`ACTION_MAP` 里确实有这条别名，
`legacy-dispatch.ts:147`），则**前两个分支都不成立**，一律落到 `updateProgress` ——
连同 `param3='已打生产单'` 也会被当成**工序槽名**写进门行（新增一个叫 `已打生产单` 的键）。
本次扫过的 45 个旧前端 chunk 里，Progress 与 Home 用的都是 `updataProgress`
（`Progress` 解码表 `de(712)`、Home 解码表 `dr(1369)`），所以这个别名**旧 Web 前端没在用**，
⚠️ **未证实**是谁在用（可能是 APP / Electron 客户端）。

### 2.2 它到底写了哪些字段（逐键，含 merge/覆盖）

```ts
// progress.service.ts:661
export async function updatePrintStatus(ds, statusText, orderIds, operatorName = '', skipDetailRows = false) {
  const { databaseName } = parseDs(ds);
  const refs = new Set(normalizeRefs(orderIds));
  if (!statusText || refs.size === 0) return { code: 400, ... };

  await ensureLineNumbers(databaseName, [...refs]);      // ← ④ 副作用：可能新建「单号」，见 2.4
  ...
```

| 落点（Prisma / JSON 路径） | 动作 | 条件 |
|---|---|---|
| `orders.door_specs` → `ping_hui/平开/diao_hui/吊滑[].工序10` | **merge**（`mergePrintStatus(row['工序10'], statusText)`） | 仅 `skipDetailRows=false`；整单命中 → **该单所有门行**；明细行命中 → **只改命中的行** |
| `orders.door_specs` → `specs.progressData[].工序10` | **merge**（同上） | 仅 `skipDetailRows=false` 且 `orderMatches`（缓存行只在整单分支里动） |
| `orders.door_specs` → `…[].生产进度` | **覆盖**（`withProgressText` 按 `工序1..15` 重算） | 凡是被改到的门行都重算；整单命中时**该单所有门行都会重算**（即使该行没有工序变化） |
| `orders.door_specs` → `customerInfo.打单操作` | **merge**（同一个 `mergePrintStatus`） | **永远执行**，`skipDetailRows` 也拦不住 |
| `orders.door_specs` → `customerInfo.单号集` | **覆盖** = `buildReceiptNoSet(nextSpecs)`（各门行 `单号` 去重后 `_` 连接；为空则保留原值） | 永远执行 |
| `orders.door_specs` → `customerInfo.打单人` | **覆盖** = `operatorName` | 仅当 `operatorName` 非空 |
| `orders.operator_name`（真列） | **覆盖** = `operatorName \|\| order.operatorName \|\| ''`（即传空则保持原值） | 永远执行 |
| `progress_records`（真表） | **完全不碰** | — |

三点值得单独记：

1. **`工序1..9、11..15` 一律不碰。** 全文件里 `updatePrintStatus` 只出现过 `'工序10'` 一个字面量
   （`:701 / :707 / :714`）。
2. **`生产进度` 串会被重算覆盖。** 所以哪怕只改 `打单操作`，这一单的每个门行的 `生产进度`
   都会被 `buildProgressText` 重新拼一遍 —— 如果某个门行的 `生产进度` 原本有值但 `工序1..15`
   全空，那个值会**被抹成空串**（`updateProgress` 走 `enrichDoorRow` 时同样如此）。
   本次跑差分台确认了这一点（见 §7 用例 E/L/M）。
3. **`updatePrintStatus` 不写 `扫码员工/扫码日期`** —— 它压根不调 `parseScanMarker`
   （全文件只有 `updateProgress` 调）。

### 2.3 `mergePrintStatus` 的确切语义（决定了「merge」到底怎么合）

```ts
// progress.service.ts:95-108
function splitPrintStatus(value: unknown): string[] {
  return String(value ?? '').split('_').map(item => item.trim()).filter(Boolean);
}
function mergePrintStatus(existing: unknown, incoming: unknown): string {
  const next = String(incoming ?? '').trim();
  const parts = splitPrintStatus(existing);          // ← 只把【已有值】按 _ 拆开
  if (!next) return parts.join('_');
  if (!parts.includes(next)) parts.push(next);       // ← 【新值整段】作为一个元素压进去
  return parts.join('_');
}
```

注意**新旧不对称**：`existing` 按 `_` 拆成多段，`incoming` **整段**当一项。
这直接导致了 §4.3 那个「回款写两次变成 `回款_回款_张三_2026-09-19`」的复现结果。

### 2.4 顺带写 `单号`：`ensureLineNumbers`

`updatePrintStatus` 一开始就调 `ensureLineNumbers(databaseName, refs)`
（`progress.service.ts:667`），它会给**匹配到但 `单号` 为空**的门行**生成并写回**单号：

```ts
// modules/order/line-number.service.ts:220-235
nextNumber += 1;
const lineNo = `${nextNumber}-${dateSuffix}`;   // 形如 7-26/09/19
...
if (changed) {
  const nextSpecs = withReceiptNoSet(updateDoorRows(specs, row => ({ ...row, '单号': map[id] })));
  await prisma.order.update({ where: { id: order.id }, data: { doorSpecs: JSON.stringify(nextSpecs) } });
}
```

编号按「年」累计最大值 +1（`:181-193`，注释明说 `N increments across the year, not resetting daily`）。
**即：Home 页改一次「打单操作」，可能凭空生成一批 `单号`。** 调用方只有两处：
`progress.service.ts:667`（updatePrintStatus）与 `formula.service.ts:201`（`getDiaoFormulas` 的
`buildOrderMap`）。

### 2.5 与 `deleteProgress` 分支的对称关系（顺手记）

```ts
// legacy-dispatch.ts:819-831
HANDLER_MAP['deleteprogress'] = (p) => {
  if (!p.param3 && ...) { ... }
  if (p.param3 && p.param4) {
    return progServ.deleteProgressCell(p.ds, p.param3, p.param4, p.query.param5 || undefined);
  }
  if (p.param3 && !isProcedureSlot(p.param3) && Array.isArray(p.body) && p.body.length > 0) {
    return progServ.deletePrintStatus(p.ds, p.param3, p.body as string[]);
  }
  return progServ.deleteProgress(p.ds, p.param3 || undefined, (p.body as string[]) || []);
};
```

`deletePrintStatus`（`progress.service.ts:749`）是 `updatePrintStatus` 的镜像：同样只动 `工序10`
（用 `removePrintStatus` 按 `_` 拆段删，`:777`）+ `customerInfo.打单操作`（`:783`），同样不碰
`progress_records`。

⚠️ **`deleteProgressCell`（`progress.service.ts:839`）有三个坑**：
- 第 4 个形参 `procedureName` **从来没被用过**（前端 `param5=工序名` 传了也白传）；
- 它 **delete 掉整个槽键**（`:849` `delete next[slot]`）再 `withProgressText` 重算 `生产进度`
  —— 所以删 `工序10` 会把**整个**「回款/打单操作」池子一起清掉，不是只删一段；
- 它 **不删 `progress_records` 行**（`deleteProgress` 会，`:825-827`；`deleteProgressCell` 不会）。

---

## 3. `扫码员工` / `扫码日期`

### 3.1 存到哪（结论：`orders.door_specs` 里的 JSON，不是独立表/列）

写入点在 `updateProgress` 里，**任何**工序槽命中都会写：

```ts
// progress.service.ts:618-628
const { specs: nextSpecs } = updateSpecsRows(currentSpecs, refs, row => {
  const nextValue = procedureSlot === '工序10'
    ? mergePrintStatus(row[procedureSlot], procedureValue)
    : procedureValue;
  const scanInfo = parseScanMarker(nextValue);                       // ← 命中判定
  return withProgressText({
    ...row,
    [procedureSlot]: nextValue,
    ...(scanInfo ? { '扫码员工': scanInfo.employee, '扫码日期': scanInfo.date } : {}),
  });
});
```

```ts
// progress.service.ts:116-121
function parseScanMarker(value: unknown): { employee: string; date: string } | null {
  const text = String(value ?? '').trim();
  const match = text.match(/_(.+)_(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { employee: match[1], date: match[2] };
}
```

**没有对应的 Prisma 模型/列。** `schema.prisma` 里 `Order.doorSpecs` 是唯一落点
（`prisma/schema.prisma:81` `doorSpecs String? @map("door_specs") @db.Text`）。
`progress_records`（`schema.prisma:111-131`）的列是
`database_name / order_id / order_no / customer_name / procedure_name / procedure_status / completed_at / operator_name / notes`
—— **没有扫码相关列**。

### 3.2 谁在读它们

**服务端**（全仓库 `grep 扫码员工|扫码日期` 的结果）：

| 位置 | 读什么 | 用途 |
|---|---|---|
| `progress.service.ts:585-590`（`getProcessCounts`） | `row['扫码日期']`、`row['扫码员工'] \|\| row['员工']` | 按日期区间 + 员工过滤，**这是唯一的服务端读点** |
| `progress.service.ts:256`（`mergeProgressFields`） | `扫码员工`、`扫码日期` | 从 `specs.progressData` 缓存行**搬回**到新门行（读路径） |
| `progress.service.ts:168`（`enrichDoorRow`） | `'扫码日期': firstNonBlank(row['扫码日期'], null)` | 输出行里显式带 `扫码日期`；`扫码员工` 靠 `...row` 透传 |
| `progress.service.ts:116-121`（`parseScanMarker`） | 写侧解析 | — |

⇒ **会把这些字段带回给前端的接口**：`getProgress` / `getMoreProgress`（经 `enrichDoorRow` +
`mergeProgressFields`）和 `getProcessCounts`。`getLabelData` 的 `labelRow` 白名单里没有它们。

实测（§7 用例 H）`getProgress` 返回行的 key 里确实**同时有** `扫码员工` 和 `扫码日期`：

```
formulaid,id,imageUrl,单号,回执单号,数量,工序3,扫码员工,扫码日期,生产进度,业务员,五金,备注,安装地址,
客户,客户编号,封板高,打单人,打单操作,日期,洞尺,加价项目原始数据,工序1..工序15,procedureName,procedureStatus,orderNo,order
```

**前端**（扫全部 45 个 chunk 的解码表）：

- 只有 **`Qrscanner-195163c4.js`（路由 `/Qrscanner`）** 出现 `扫码日期` / `getProcessCounts` / `getScanQRcode`。
  `Progress-f4bdef35.js` 的解码表里**没有**这两个字符串（它只是被动接收服务端透传的字段，自己不渲染）。
- `/Qrscanner` 的「扫码统计」tab 把 `扫码日期` 放进列清单
  （解码表 `f(642)`，列数组 `Ma` 里 `{ key: m(642), label: m(642) }`）。
- ⚠️ **`扫码员工` 在整个旧前端里没有任何一次出现** —— 表里那列「查询员工」是**前端自己塞的**，
  取的是**筛选框的值**而不是行数据：
  ```js
  // Qrscanner-195163c4.js 解码后（Zl = 查询扫码统计）
  Cl.value = e.map(x => ({ ...x, "查询员工": ul.value }));   // ul = 筛选员工 or userinfo.name
  ```
  所以 `扫码员工` 存进去了、也被 API 带回来了，但**从来没显示过**。

### 3.3 写入它的那条链路（扫码录单，`/Qrscanner`）

```js
// Qrscanner-195163c4.js 解码后（oa = 扫码录单提交）
const l = t[e(492)].ds,                                  // e(492)="userinfo" → ds（注意这里是 ds，不是 registrant）
      n = Vl.value,                                      // 工序槽 key（由工序名经 pa() 反查 gl[工序名]→槽key）
      o = il.value + "_" + sl.value + "_" + (new Date)[e(317)]().split("T")[0],
      //  il = 工序名（上面那个下拉）   sl = 员工名（输入框）   e(317)="toISOString"
      s = await fetch(e(551) + l + "&param3=" + n + e(191) + o, {   // e(551)=...updataProgress&param2= , e(191)="&param4="
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON[e(471)](et[e(529)]),                  // 勾选的门行
      });
```

⇒ 扫码录单发的是 `param4 = 工序名_员工名_YYYY-MM-DD`，与 Progress 页的格式
（`工序名[_操作员]_日期`）**同构**，正好被 `parseScanMarker` 的
`/_(.+)_(\d{4}-\d{2}-\d{2})$/` 吃掉：`match[1]` = 员工名、`match[2]` = 日期。
**但传的是 `userinfo.ds`（业务键）** —— 与 GetProcedures 的 `registrant` 不同，
这正是 §1 说的「一个接口一把键」。

### 3.4 `getProcessCounts` 的口径（顺带，因为它是唯一读点）

```ts
// progress.service.ts:558-596
export async function getProcessCounts(ds: string, operatorName?: string, dateRange?: string) {
  const { databaseName } = parseDs(ds);
  if (!operatorName || !dateRange) return { __statusCode: 500, __html: true, message: 'missing params' };
  const resolved = resolveDateLabel(dateRange);   // '当天'/'本周'/'本月' → 'YYYY-MM-DD,YYYY-MM-DD'
  const [startText, endText] = resolved.split(',').map(p => p.trim());
  ...
  const scanDate = parseDate(row['扫码日期']);
  if (!scanDate) continue;                                       // 没扫码日期的门行直接跳过
  const scanEmployee = String(row['扫码员工'] || row['员工'] || '').trim();
  if (scan < start || scan > end) continue;
  if (operatorName !== '1' && scanEmployee !== operatorName) continue;   // '1' = 全部员工
  progressData.push(enrichDoorRow(row, order as any, specs, { gmtDate: true }));
}
```

前端传的 `param3` 就是 `operatorName`，非管理员会被强制成自己的 `userinfo.name`
（`Zl` 里 `i = u || (s && s !== r ? s : "1")`，`r` = registrant，`s` = userinfo.name）。

---

## 4. `updateProgress` 的完整写入口径（逐槽核过）

### 4.1 结论

- **15 个槽里，只有 `工序10` 一个特判**（合并），其余 14 个**一律覆盖**。
- 「特判」的判定是 **`procedureSlot === '工序10'` 字面量**，全文件**只此一处**
  （`progress.service.ts:619`；`grep 工序10` 在本文件命中 8 处，其余 7 处都在
  `updatePrintStatus` / `deletePrintStatus` 里，见 §2.2）。
- ⚠️ **没有别的槽有特判**（逐槽核过：`工序1..15` 在 `updateProgress` 里除了 `工序10` 那一处三元，
  再无任何按槽名分支；`buildProgressText`/`mergeProgressFields`/`updateSpecsRows` 都是 1..15 一视同仁的循环）。

### 4.2 整段（关键部分）

```ts
// progress.service.ts:598-658（节选）
export async function updateProgress(ds: string, procedureSlot: string, orderIds: string[], procedureValue = '') {
  const { databaseName } = parseDs(ds);
  const refs = new Set(normalizeRefs(orderIds));
  if (!procedureSlot || refs.size === 0) return { code: 400, data: { failed: [...refs] }, message: '缺少必要参数' };

  const orders = await prisma.order.findMany({ where: { databaseName } });
  ...
  for (const order of orders) {
    const currentSpecs = parseSpecs(order.doorSpecs);
    const updated = countMatchingDoorRows(currentSpecs, refs);
    if (updated === 0) continue;
    ...
    const { specs: nextSpecs } = updateSpecsRows(currentSpecs, refs, row => {
      const nextValue = procedureSlot === '工序10'
        ? mergePrintStatus(row[procedureSlot], procedureValue)   // ← 唯一特判
        : procedureValue;                                        // ← 其余 14 槽：直接覆盖
      const scanInfo = parseScanMarker(nextValue);
      return withProgressText({ ...row, [procedureSlot]: nextValue,
        ...(scanInfo ? { '扫码员工': scanInfo.employee, '扫码日期': scanInfo.date } : {}) });
    });

    await prisma.progress.upsert({
      where: { databaseName_orderId_procedureName: { databaseName, orderId: order.id, procedureName: procedureSlot } },
      create: { databaseName, orderId: order.id, orderNo: order.orderNo,
        customerName: order.customerName || '', procedureName: procedureSlot,
        procedureStatus: procedureValue, completedAt: new Date() },
      update: { procedureStatus: procedureValue, completedAt: new Date() },
    });

    await prisma.order.update({ where: { id: order.id }, data: { doorSpecs: JSON.stringify(nextSpecs) } });
    totalUpdated += updated;
  }
```

要点：

| 项 | 口径 |
|---|---|
| 匹配键 | `normalizeRefs(orderIds)` 把每个元素摊成 `id / 单号 / 回执单号 / orderNo / order_no` 五个候选（字符串元素就是它自己）；门行侧用同样的五个候选（`rowRefs`）。**任一相等即命中** |
| 落点 | `ping_hui` / `平开` / `diao_hui` / `吊滑` 四个键 + `specs.progressData`（`updateSpecsRows`，`:205-228`） |
| `生产进度` | **覆盖** = `withProgressText` 按 `工序1..15` 重算 |
| `progress_records` | **upsert**（`procedureName` = 槽名，`procedureStatus` = `procedureValue`，`completedAt` = now）。**这是 `updateProgress` 与 `updatePrintStatus` 最大的差别** |
| `orders.operator_name` | **不写**（只有 `updatePrintStatus` 写） |
| `customerInfo.*` | **不写** |
| 失败语义 | 全都没匹配上 → `code:400` + `以下单号更新失败: [...]`；部分匹配 → `code:200` + `…，N 条未匹配已跳过` |

### 4.3 差分台实测（真跑服务端函数，见 §7）

| 用例 | 输入 | `工序N` 结果 | 备注 |
|---|---|---|---|
| A | `工序3 = 下料_张三_2026-09-19` | `工序3 = "下料_张三_2026-09-19"` | **覆盖**；同时写入 `扫码员工="张三"`、`扫码日期="2026-09-19"` |
| B | `工序10 = 回款_张三_2026-09-19`（槽内原空） | `工序10 = "回款_张三_2026-09-19"` | 首次合并 = 直接放进去 |
| C | 先写 `工序10 = 回款`，再写 `回款_李四_2026-09-20` | `工序10 = "回款_回款_李四_2026-09-20"` | **复现了耦合 bug**；且 `扫码员工` 被写成 `"回款_李四"`（`match[1]` 贪婪） |
| D | `工序3` 连写两次 | 第二次的值 | 覆盖确认 |
| J | 两行门，只给一行单号，写 `工序10` | 只有那一行变 | 明细级匹配 |
| K | 两行门，ref 用**行 id**（与单号不同名） | 只有 id 命中那行变 | id 匹配确认 |

C 的机理就是 §2.3 说的「新值整段压入」：`mergePrintStatus('回款', '回款_李四_2026-09-20')`
→ `parts=['回款']` 不含整段 → push → `'回款_回款_李四_2026-09-20'`。
而前端 `va()` 渲染时按 `➞` 分段、段内按 `_` 找日期，这一段仍能显示红色日期，
所以**界面上看不出异常**，但 `扫码员工` 已经脏了。

⚠️ 顺带：`工序10` 既被 `回款` 用、又被 Home 的「打单操作」用（§2.2），两条流共用一个 `_` 池子。
差分台用例 F 显示：Progress 页写一次「回款」，会**顺带把 `回款_张三_2026-09-19` 塞进
`customerInfo.打单操作`**（因为 dispatch 第二支拿 `param4` 当 `statusText` 又调了一次
`updatePrintStatus`，而那函数**无条件** merge `打单操作`）。
即 Home 页那套「打单操作」串里会多出一项 `回款_张三_2026-09-19`。

---

## 5. 名字相近的一堆 `getProgress*` —— 逐个说明

### 5.1 六个「查进度」的名字，**共用同一个 handler**

```ts
// legacy-dispatch.ts:769-782
HANDLER_MAP['getprogress']                  = async (p) => projectProgressData(await progServ.getProgress(p.ds, p.param3 || undefined));
HANDLER_MAP['getprogressdata']              = async (p) => projectProgressData(await progServ.getProgress(p.ds, p.param3 || undefined));
HANDLER_MAP['getprogresslist']              = async (p) => projectProgressData(await progServ.getProgress(p.ds, p.param3 || undefined));
HANDLER_MAP['getproductionprogress']        = async (p) => projectProgressData(await progServ.getProgress(p.ds, p.param3 || undefined));
HANDLER_MAP['getproductionprogressdata']    = async (p) => projectProgressData(await progServ.getProgress(p.ds, p.param3 || undefined));
HANDLER_MAP['getprogressforterminal']       = async (p) => projectProgressData(await progServ.getProgress(p.ds, p.param3 || undefined));
HANDLER_MAP['getmoreprogress'] = async (p) =>
  projectProgressData(await progServ.getMoreProgress(
    p.ds, p.param3 || '', p.param4 || '', p.param5 || p.query.startDate, p.param6 || p.query.endDate));
```

`getProgress(ds, orderNo?)`：`where = { databaseName }`，`orderNo` 有值就加
`where.orderNo = orderNo`；`orderBy: { orderNo: 'asc' }`；每个 order
`buildProgressRowsForOrder` 摊成多行，最后 `{ code: 200, data: { progressData }, message: '数据获取成功' }`
（`progress.service.ts:303-320`）。

### 5.2 差别**全在契约表**里（`LEGACY_CONTRACTS`）

| 接口名（param1） | 别名（大小写其它写法） | `param3` | 契约 | 实际行为 |
|---|---|---|---|---|
| `getProgress` | 小写 `getprogress` | 可选 = `orderNo` | **无契约条目**（`LEGACY_CONTRACTS['getprogress']` 不存在 → `{}`） | 正常查，**不传 param3 就返回该 ds 全部订单的门行** |
| `getProgressData` | `getprogressdata` | **必填** = `orderNo` | `requiredParams:['param3'], missingStatus:400, missingMessage:'bad request'` | 缺 param3 → HTTP 400 `{code:400,message:'bad request'}`，**不查库** |
| `getProgressList` | `getprogresslist` | **必填** | 同上 | 同上 |
| `getProductionProgress` | `getproductionprogress` | **必填** | 同上 | 同上 |
| `getProductionProgressData` | `getproductionprogressdata` | **必填** | 同上 | 同上 |
| `getProgressForTerminal` | `getprogressforterminal` | — | `staticStatus:400, staticResponse:{ code:400, data:null, message:'获取明细数据异常: list index out of range' }` | **永远返回这个 400，handler 根本不会被执行** |
| `getMoreProgress` | `getmoreprogress` | 客户（可选） | 无契约条目 | 见 §5.3 |

契约在 handler 之前生效：

```ts
// legacy-dispatch.ts:1122-1139
const contract = LEGACY_CONTRACTS[actionKey] || {};
if (contract.methods && !contract.methods.includes(req.method)) { sendLegacyHtml500(res); return; }
if (contract.html500) { sendLegacyHtml500(res); return; }
if (contract.badRequest) { res.status(400).json({ code: 400, message: 'bad request' }); return; }
if (contract.staticResponse !== undefined) {
  if (contract.staticStatus) res.status(contract.staticStatus);
  res.json(contract.staticResponse);
  return;                      // ← 到这儿就返回了
}
```

`requiredParams` 的检查里，**只有 `param2` 会被当成 `ds`**，其它直接取同名 query：

```ts
// legacy-dispatch.ts:362-368
function missingRequiredParam(contract: LegacyContract, params: HandlerParams): string | null {
  for (const name of contract.requiredParams || []) {
    const value = name === 'param2' ? params.ds : (params as unknown as Record<string, string>)[name];
    if (!value) return name;
  }
  return null;
}
```

### 5.3 `getMoreProgress`（唯一一个参数不同的）

```ts
// progress.service.ts:324-361
export async function getMoreProgress(ds, customer?, address?, startDate?, endDate?) {
  const where: Record<string, unknown> = { databaseName };
  if (customer) where.customerName = { contains: customer };
  if (address)  where.client = { address: { contains: address } };
  if (startDate || endDate) {
    const orderDateFilter: Record<string, Date> = {};
    if (startDate) orderDateFilter.gte = new Date(startDate);
    if (endDate)   orderDateFilter.lte = new Date(endDate);
    where.orderDate = orderDateFilter;
  }
  ... // 与 getProgress 相同的摊行逻辑，返回 { code, data: { progressData }, message }
}
```

前端（`Progress-fb4def35.js` 解码后，`Io` = 执行「查询更多」）：

```js
fetch("https://www.samrtdoor.com.cn/1?param1=getMoreProgress&param2=" + a
      + "&param3=" + n + "&param4=" + r + "&param5=" + u + "&param6=" + s, { method: "get" })
// a = userinfo.ds, n = selectedClient, r = selectedAddress, u = startDate, s = endDate
```

注意 `param5/param6` 走的是 `p.param5 || p.query.startDate` 双通道（兼容另一套客户端直接发
`startDate`/`endDate`）。

### 5.4 谁在用（扫 45 个旧前端 chunk）

只有 `Progress-f4bdef35.js` 用这套接口，它用到的只有两个：
`getProgress`（PC）与 `getProgressForTerminal`（终端）＋ `getMoreProgress`（查询更多）。
**另外四个（`getProgressData/List/ProductionProgress/ProductionProgressData`）旧 Web 前端一次都没调过**，
推测是给 APP / Electron / 老移动端留的别名。

### 5.5 终端模式在**当前服务端上是坏的**（结论 + 一个未证实）

`getProgressForTerminal` 被契约写死成 400，所以 `/Progress` 的终端分支（`userinfo.defaulted === 3`）
**必然**拿到 `{code:400,data:null,message:'获取明细数据异常: list index out of range'}`，
前端 `200===n.code && n.data?.progressData` 为假 → 弹「**没有获取到生产进度数据**」，表空。

- 这是**当前部署（Node 服务端）**的事实，读代码即可确认。
- ⚠️ **未证实**：原始 Flask 是不是也**无条件**这样。那条 message 是 Python 的 `IndexError`
  （`list index out of range`），更像是「某些参数下才崩」；Node 重写时把它写成了无条件。
  没有 Flask 源码，**无法判断**。若新版要「照旧版复刻」，需要产品侧拍板是复刻这个 400 还是修掉。

---

## 6. `回款` 是不是服务端常量？

**不是。** 全服务端源码 `grep 回款` → **0 处命中**。

服务端认得的是**槽位名** `工序10`，硬编码在 3 个地方：

| 位置 | 用途 |
|---|---|
| `legacy-dispatch.ts:799` | `p.param3 === '工序10' && p.param4` → 先 `updateProgress` 再 `updatePrintStatus(…, skipDetailRows=true)` |
| `progress.service.ts:619` | `procedureSlot === '工序10'` → 走 `mergePrintStatus`（合并而非覆盖） |
| `progress.service.ts:701 / 707 / 714 / 777` | `updatePrintStatus` / `deletePrintStatus` 只写/只删 `工序10` |

前端把「回款」这个名字绑到 `工序10`：

```js
// Progress-fb4def35.js 解码后（三处同构）
for (const l of t) U["value"]["push"](l["value"]), T["value"][l["value"]] = l["key"];
!T["value"]["回款"] && (U["value"].push("回款"), T["value"]["回款"] = "工序10"),
```

即：**只有 `GetProcedures` 返回的工序名里没有「回款」时**，前端才把它塞进 `工序10`。
如果租户在工序设置里**真的把某个槽命名成「回款」**（比如设成 `工序10`），那么
`T['回款']` 会是那个槽（可能就是 `工序10`，也可能是别的槽），此时前端的「回款」就**不再**绑定 `工序10`，
而服务端**只认 `工序10`** —— **两边会错位**：

- 前端把「回款」写到 `工序5` → 服务端走 `updateProgress` 的普通槽分支 → **覆盖**而不是合并；
- `progress_records` 里会多一条 `procedure_name='工序5'` 的记录；
- dispatch 的「工序10 双写」分支不会触发，`customerInfo.打单操作` 不会同步。

⚠️ **未证实**：生产租户的工序表里到底有没有一个字面叫「回款」的工序。
`legacy/`、`docs/` 里没有 `GetProcedures` 的真响应样本，无法判断这条错位在真实数据里会不会发生。
**这一条要么连库、要么打一次生产接口才能钉死。**

（工序设置页本身**允许**把任意槽命名成「回款」——`SetProcedures` 不校验名字，
`setProcedures` 只按 `orderIndex` 找行再改名，`progress.service.ts:863-886`。）

---

## 7. 复现方法（差分台）

本文所有「实测」都是**把旧服务端函数原样切出来真跑**得出的，不是手抄。

### 7.1 手法

沿用 `docs/legacy-finance/lib/run-legacy-fn.mjs`（esbuild 剥类型 + 外部依赖注入）。

> ✅ **2026-09-19 已就地修好，`/tmp/slice2.mjs` 不再需要。**
> 当时它有个坑：`sliceFnFrom` **在签名里带花括号时会切错**，把**类型注解**的花括号
> 当成函数体起点：
>
> ```ts
> export function parseDs(ds: string): { databaseName: string } & Record<string, unknown> {
> //                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^ 这一对花括号会被当成函数体起点
> ```
>
> 配平到那里就收工，切出来的是一句残缺签名；esbuild 剥完是**空串**，
> 于是运行时报 `parseDs is not defined` —— **看着像名字写错，其实是切歪了**。
> （当时是复制一份到 `/tmp/slice2.mjs` 绕过，**没有改仓库里的公共件**。）
>
> **现在的修法**（`sliceFnFrom` 内，带注释）：① 先配平**参数表的圆括号**；
> ② 再在参数表之后找**函数体**的花括号 —— 判据是「这个 `{` 前面一个非空白字符**不是 `:`**」
> （类型字面量前面必定是 `:`），类型内部的 `{}` 计入深度不误取；
> ③ 万一到 `;` 还没找到（重载签名之类不认识的形态）就退回旧行为。
>
> 对**签名里没有花括号**的函数（绝大多数）结果与改前**完全一样**；
> 只对上面那种签名修好。回归办法：把 `progress.service.ts` 与 `finance.service.ts` 里
> **每一个** `function` 都切一遍，要求「切得出、且 esbuild 剥完非空」——
> 现在分别是 41 / 38 个，**0 切不出、0 空**。
> 用得上它的差分台：`docs/qrscanner-scan-logiccheck.mjs`、`docs/home-audit/lineno-logiccheck.mjs`
> 以及 `docs/legacy-finance/0{5,6,7,9}-*.mjs`（后四台要后端在 `127.0.0.1:3999`，离线跑不了）。

### 7.2 桩

`prisma.order.findMany / update` + `prisma.progress.upsert / deleteMany` 用内存对象实现，
`ensureLineNumbers` 用 `async () => ({})` 打桩（本次不测补单号），
`safeLoads` / `parseDate` 照 `utils/helpers.ts:2` 与 `:36` 复制。
夹具下单，`door_specs = { customerInfo: { 打单操作:'已打生产单', 单号集:'oldset', 打单人:'张三' },
ping_hui: [{ id:'1-26/09/01', 单号:'1-26/09/01', 回执单号:'R1', 数量:1 }], diao_hui: [] }`。

⚠️ 夹具是**本次新造**的（旧版没有现成的进度夹具），只为观察 `merge/覆盖` 的形状，
**不代表生产数据的形态**；它不构成「为了让测试变绿而改夹具」那种情况。

### 7.3 跑出来的原始输出（摘要）

```
A. updateProgress 工序3 = 下料_张三_2026-09-19（普通槽）
   工序3="下料_张三_2026-09-19"  生产进度="下料_张三_2026-09-19"
   扫码员工="张三" 扫码日期="2026-09-19"   progress_records upsert: 1 次 工序3
C. 工序10 已有「回款」后再写「回款_李四_2026-09-20」
   工序10="回款_回款_李四_2026-09-20"   扫码员工="回款_李四" 扫码日期="2026-09-20"
E. updatePrintStatus(已订玻璃, refs=[R1], operatorName=王五)
   工序10="已订玻璃" 生产进度="已订玻璃" 扫码员工=undefined
   customerInfo={"打单操作":"已打生产单_已订玻璃","单号集":"1-26/09/01","打单人":"王五"}
   order.update 字段: doorSpecs,operatorName   progress_records upsert: 0 次
F. updateProgress(工序10=回款_张三_2026-09-19) + updatePrintStatus(同串, '', skipDetailRows=true)
   工序10="回款_张三_2026-09-19"（没被二次改动 ✓）
   customerInfo={"打单操作":"已打生产单_回款_张三_2026-09-19",...}   ← 打单操作被污染
L. updatePrintStatus(已订玻璃, refs=[R1]) 两行门 → 两行都写 工序10
M. updatePrintStatus(已订玻璃, refs=[1-26/09/01]) 两行门 → 只写一行
I. mergePrintStatus('回款','回款_张三_2026-09-19')   = '回款_回款_张三_2026-09-19'
   mergePrintStatus('回款_张三_2026-09-19','已打生产单') = '回款_张三_2026-09-19_已打生产单'
   mergePrintStatus(undefined,'回款_张三_2026-09-19')   = '回款_张三_2026-09-19'
   removePrintStatus('回款_张三_2026-09-19','回款')      = '张三_2026-09-19'   ← 删完剩碎片
   parseScanMarker('回款_张三_2026-09-19') = { employee:'张三', date:'2026-09-19' }
   parseScanMarker('下料')                 = null
   parseScanMarker('A_B_C_2026-09-19')     = { employee:'B_C', date:'2026-09-19' }
```

---

## 8. 本次仍未证实的（诚实清单）

| # | 事项 | 为什么没证 | 怎么证 |
|---|---|---|---|
| 1 | 生产库 `procedures.database_name` 里实际存的是 **registrant** 还是 **ds** | 没连生产库（`.env` 明令不读），也没有 `GetProcedures` 的真响应样本落在仓库里 | 连库 `SELECT DISTINCT database_name FROM procedures`，或打一次 `GetProcedures&param2=<registrant>` 看是否有非空槽 |
| 2 | `userinfo.procedures_data`（login 响应里那份）在生产里是不是 15 个空串 | 同上 | 同上（顺手看一眼 login 响应） |
| 3 | 原始 **Flask** 的 `getProgressForTerminal` 是否也无条件 400 | 没有 Flask 源码；Node 版把它写成了 `staticResponse` | 只有拿到 Flask 源码或旧部署才能判 |
| 4 | 生产租户的工序表里有没有一个字面叫「回款」的工序（决定 §6 的错位会不会发生） | 无样本 | 同 #1 |
| 5 | `param1=updateProgress`（大写 P）这条别名是谁在用 | 45 个旧 Web chunk 里没有；可能是 APP/Electron | 若新版只服务 Web，可当作不存在 |
| 6 | `Hui-d088417c.js` 用 `localStorage.procedures_data` 做什么 | Hui 包的内联解码器本次没解干净（已知坑），不在本次范围 | 用 `hui-inline-decoder-recipe` 那套手法重解 |

**已钉死的**（不需要再验）：§1.2 / §1.3 / §1.4 / §1.6 的**服务端代码事实**、§2 全部、
§3 全部（写入点、落点、读点、前端是否上屏）、§4 全部（含差分台实测）、
§5 全部（handler / 契约 / staticResponse）、§6 的「服务端无 `回款` 常量」。

---

## 9. 对新版实现的直接影响

1. **两把租户键必须在数据模型上分开**：新版已有 `tenants`（`docs/2026-09-17-home-analysis.md:436`
   说它只有 `id/name`）。落旧数据时，**业务数据按 `ds`、配置数据（工序/模板/租户设置）按 `registrant`**。
   迁移脚本如果两处都按同一个键灌，会出现「订单看得到、工序下拉空的」这种半死状态。
2. **`/progress` 的工序下拉不要只依赖 `GetProcedures`**：旧版是「GetProcedures（registrant）
   + 前端补『回款』」。新版若把「回款」做成配置项，要落在 `工序10` 上，否则 §6 的错位会重现。
3. **`工序10` 的双语义要显式化**：它同时是「回款槽」和「Home 打单操作槽」，共用
   `mergePrintStatus` 的 `_` 池子。**要么两套分开存，要么保留这套并写清注释**（旧版是耦合的，
   且 §4.3 用例 C 的 `回款_回款_…` 是可复现的脏数据）。
4. **别照抄的三处旧版毛病**：
   - `getProgressForTerminal` 的无条件 400（§5.5）；
   - `mergePrintStatus` 新旧不对称导致的重复段（§2.3 / §4.3-C）；
   - `deleteProgressCell` 忽略 `param5`、且不删 `progress_records`（§2.5）。
5. **`updatePrintStatus` 会补 `单号`**（§2.4）—— 新版若把「改打单操作」做成只读事务，要意识到
   旧版这里**是写路径**，会产生 `单号`。

---

## 附：本次用到的关键位置速查

| 事项 | 位置 |
|---|---|
| `param2 → ds` 的取参 | `legacy-dispatch.ts:1144-1149` |
| `requiredParams` 里 `param2` 特例 | `legacy-dispatch.ts:362-368` |
| `staticResponse` 短路 | `legacy-dispatch.ts:1135-1139` |
| `GetProcedures` handler / service | `legacy-dispatch.ts:642` / `auth.service.ts:295` |
| `SetProcedures` service | `progress.service.ts:859` |
| login 里的 `procedures_data` | `auth.service.ts:328-337` |
| `login` 响应结构 | `auth.service.ts:339-356` |
| seed 把 settings 按公司名存 | `seed-default-user.ts:143-150` |
| `getProgress*` 六个 handler | `legacy-dispatch.ts:769-774` |
| `getMoreProgress` handler / service | `legacy-dispatch.ts:775-782` / `progress.service.ts:324` |
| `updataProgress` 分流 | `legacy-dispatch.ts:791-805` |
| `deleteProgress` 分流 | `legacy-dispatch.ts:819-833` |
| `mergePrintStatus` / `parseScanMarker` | `progress.service.ts:102` / `:116` |
| `updateProgress` | `progress.service.ts:598` |
| `updatePrintStatus` | `progress.service.ts:661` |
| `deletePrintStatus` / `deleteProgressCell` | `progress.service.ts:749` / `:839` |
| `getProcessCounts`（唯一读扫码字段处） | `progress.service.ts:558` |
| `ensureLineNumbers` | `order/line-number.service.ts:120` |
| 契约表 | `legacy-dispatch.ts:249-301` |
| `order.doorSpecs` 列 | `prisma/schema.prisma:81` |
| `progress_records` 列 | `prisma/schema.prisma:111-131` |
