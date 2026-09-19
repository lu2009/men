# 汇算页「字段候选值」的来源与右键删除（2026-09-15）

> 缘起：用户报「公式都删了、新建一条后，**型材下拉里仍有旧记录**」。
> 查明是我们的**保真偏离** —— 给型材额外挂了两个原版没有的候选来源。本文记录核实结果与修正。

---

## 1. 原版：各字段的候选从哪来

### 1.1 型材 —— **只有服务端一个来源**

型材格子逐字（`Hui.formatted.js` 平开表「型材/颜色」列）：

```js
"fetch-suggestions": (e, t) => {
  const x = Object.keys(O.value)
  t((e ? x.filter(t => t.includes(e)) : x).map(e => ({ value: e })))
},
onSelect: t => { je(t.value), Ye(e, t.value) },
onInput: je,  onBlur: () => Ye(e),  onFocus: je,
```

- `O.value` = **服务端「基础信息」接口返回的 `material` 字典**（型材名 → formulaID），
  见 `docs/2026-09-10-template-field-audit.md` 对 `O`/`L` 的解码（`O`=material、`L`=formulaType）。
- **没有本地候选历史**：`onInput` 的 `je` 只用于测量文本宽度算列宽；`onBlur` 的 `Ye`
  只用于 `O.value[型材名] → 行.formulaid`。两者都**不写候选库**。
- 反面对照：同一段里**颜色**的 `onBlur` 是 `await saveOptions("color", _) && …` —— 型材没有这一段。

⇒ **原版型材候选 = 服务端字典的键集合**，删掉服务端公式后即不再出现。

### 1.2 其它字段 —— 有本地「选项库」

原版把候选持久化到选项库，按字段分键；`saveOptions` / `deleteOption` 的字面量调用点：

| 字段 | 键 | 写点 | 删点 |
|---|---|---|---|
| 颜色 | `color` | ✅（token 形式）`saveOptions` | ✅ `deleteOption("color")` @86742 |
| 面玻 / 底玻 | `glass` | ✅ `saveOptions("glass")` @90786 | ✅ `deleteOption("glass")` @91581 |
| 套线种类 | `casing` | ✅ `saveOptions("casing")` @97413 | ✅（右键）|
| 锁具 | `lock` | ✅ @50034 / @99676 | ✅（右键）|
| 五金 | `hardware` | ✅ `saveOptions("hardware")` @176812 | — |
| **型材** | —— | ❌ **无** | ❌ **无** |

> ⚠️ 未穷尽：`saveOptions` 也有 **token 形式**的参数（如 `saveOptions(a(572), …)`，`a(572)='color'`），
> 上表只列了**字面量**调用点。是否存在更多 token 形式的字段键，未逐一解出。

### 1.3 右键删除的真实分布（15 处 `onContextmenu`）

| 字段 | 处数 |
|---|---|
| 颜色 | 2（@86253 平开 / @225283 吊趟）|
| 面玻 | 2（@91088 / @230700）|
| 底玻 | 2（@93938 / @233285）|
| 套线种类 | 1（@97603）|
| 轨道种类 | 1（@99866）|
| 金额 | 2（@115877 / @253954）|
| 未识别 | 5（@98794 / @100860 / @251054 / @252144 / @744300）|

**⇒「型材」不在其中：原版型材不能右键删除**（用户指出，已核实）。

---

## 2. 我们的偏离与修正

`app/src/views/Hui.vue` 的 `profileOptionsFor(type)` 原先挂了**三个**来源：

```js
for (const h of readFieldHistory(`profile_${type}`)) push(h)             // ❌ 自己加的
for (const l of lines.value) if (l.line_type === type) push(l.profile)   // ❌ 自己加的
for (const f of formulas.value) if (belongsToTable(...)) push(f.name)    // ✅ 对应服务端 material 字典
```

后两个来源原版都没有，后果正是用户看到的：**公式删光后，localStorage 历史与草稿行里的
旧型材名仍留在下拉里**。

**修正**（2026-09-15，提交 `9d5a5f72`）：
- `profileOptionsFor` 只保留「公式名」（`formulas` 表 = 我们对服务端 material 字典的等价物；
  仍按 `belongsToTable` 过滤表归属）
- `profileCell` 去掉 `historyKey` 参数（不再 `rememberField('profile_*')`）
- `readFieldHistory` / `rememberField` 本身保留 —— 颜色/五金/锁具/轨道/套线仍在用

**验证**：库中仅 1 条公式（`平开`）时，全新浏览器 profile 下平开型材候选 = `["平开"]`。

### 残留说明

- 用户浏览器 **localStorage 里的旧 `smartdoor_field_history_profile_*` 不会被自动清掉**
  （去掉的是「读取」而非「删除」）。如需清理：
  ```js
  Object.keys(localStorage).filter(k => k.startsWith('smartdoor_field_history_'))
    .forEach(k => localStorage.removeItem(k))
  // ⚠️ 2026-09-19 起不再有 `hui_order_draft_v1` 这个实时草稿键（那套已删，
  //    见 `docs/2026-09-19-hui-shell-audit.md` §10）；若浏览器里还留着旧键，顺手清掉：
  localStorage.removeItem('hui_order_draft_v1')
  location.reload()
  ```
- `profile_*` 历史不再被写入，属**遗留数据**，无 UI 入口可清。

---

## 3. 待办 / 未核实

- [ ] `saveOptions`/`deleteOption` 的 **token 形式**参数还有哪些字段键（未穷尽）
- [ ] 那 5 处「未识别」的 `onContextmenu` 分别绑在哪个字段
- [ ] 我们侧：颜色/玻璃/套线/轨道/五金/锁具的候选来源是否与原版一致（本次只核了型材）
- [ ] 我们的**字段历史**（`smartdoor_field_history_*`）是自建机制 —— 需与原版的**选项库**逐一对照：
      原版是服务端 `saveOptions`，我们是 localStorage，**存储位置不同**（是否需要对齐另议）
