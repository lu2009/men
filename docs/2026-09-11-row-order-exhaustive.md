# 数据行「顺序 / 分页 / 分组」穷举分析

> 数据源：`legacy/js/Hui-d088417c.js`（汇算页，权威）与 `legacy/js/Home-d6b13b9a.js`（订单页，回执族在这里）。
> 偏移均为**字符偏移**（不是字节偏移，文件含中文，`grep -bo` 的字节偏移会偏）。
> 读法：`orig.py --range` 直接标注原始 minified；`Hui.formatted.js` 的字面量**不可信**。
> Home 分块另有独立串表，本次已解出：`Home` 的访问器是 `dr`（`$n`），**索引 = N − 467**，旋转 439，
> token 表落在 `/tmp/huidrive/tokens_home_dr.json`；`index-7ca9e657.js`（打印模板配置）表为 **N − 252**，旋转 60，
> 落在 `/tmp/huidrive/tokens_index7ca9.json`；Home 自带的 `wl`/`ml`、`vr`/`hr` 两张小表**只用于校验和旋转**，不是业务串表。

---

## 0. 总表：入口 × 行顺序 × 排序 × 过滤 × 分组

### 0.1 Hui（汇算页）

| # | 入口（模板族） | 生成函数 / 偏移 | 行来源与**顺序** | 排序 | 行级过滤（丢弃） | 分组 |
|---|---|---|---|---|---|---|
| 1 | **produces**（生产单，mode 2） | `_0x32bd6f` = `calculateReceipt` @479893–520860 | 先 ping_hui 循环、后 diao_hui 循环；两组各**已被就地排序** | ① 入口：`filter(有formulaid).sort(formulaid↔颜色)`（`_0x5389cf` @480311）② 收尾：`sort_method==='order'` → `parseInt(OrderID.split('-')[0])` 升序；否则按 `produce.timestamp` 升序（@519330） | ping/diao 行 `if(!公式数据) continue`（@483995/@502971）；**吊趟**再 `if(!扇数) continue`（@504122）；入口 filter 已丢 `formulaid` 为空的行 | 无（仅 ping 块 / diao 块两段） |
| 2 | **oldSheet**（生产单定制 product2，mode 8） | `_0x320f0e` = `calculateReceiptOld` @520860–559126 | 同上，ping 块先写 @537702、diao 块后写 @557251 | ① 入口同款 `_0x2ddbe2` @521124 ② 收尾同款三目 @557435 | ping @524666 / diao @541426 `if(!公式数据) continue`；吊趟 `if(!扇数) continue` @542547 | **product3 时**（mode 9）在收尾后 `_0x1ebfe1` 两行合一张 @557973 |
| 3 | **oldSheet**（product3，mode 9） | 同上 | 同上 | 同上 | 同上 | `_0x5cc934.value ? _0x1ebfe1(rows) : rows` |
| 4 | **produces**（生产单1，mode 2；Hui 页无 UI 按钮） | `_0x15ef6c` = `calculateReceiptForCustomed` @559126–589466 | 先 ping @571741、后 diao @587754 | ① 入口 `_0x26e24a` @559357 ② 收尾三目 @587938 | ping @562803 / diao @574710 `if(!公式数据) continue`；吊趟 `if(!扇数) continue` @575847 | 无 |
| 5 | **produces**（玻璃合片单，mode 1） | `_0x4f7790` = `calculateGlass` @455396–479893 | 先 ping @466942、后 diao @478052 | **入口不排序**；收尾三目 @478473（`order` → OrderID 前缀；否则 timestamp） | ping @457753 / diao @469088 `if(!公式数据) continue`；吊趟 `if(!扇数) continue` @470205 | 无 |
| 6 | **glassInfoList**（玻璃订单，mode 3） | `_0x509b06` = `Glasslist` @410165–455396 | 先 ping_hui 原序、后 diao_hui 原序（**入口不排序**） | 仅收尾：`sort_method==='order'` → `parseInt(e.OrderID.split('-')[0])` 升序（@453822），否则**不动** | ping @412551 `if(!公式数据) continue`；**吊趟**先 `if(底玻==='无'&&面玻==='无') continue` @438391，再 `if(!公式数据) continue`、`if(!扇数) continue` @438631/@439748；收尾 `list.filter(e=>0!==Number(e.thickness))` @453705 | 无 |
| 7 | **lable**（标签，mode 4） | `_0x17d664` = `lable` @366393–371010 | 先 ping_hui、后 diao_hui，**各自保持表格原序** | 收尾**无条件**排序：`String(orderID).match(/^(\d+)-/)` → `parseInt` 升序；无 orderID / 无数字前缀 → `Infinity` 排最后（@369992 / @370888） | **无**（不看 formulaid） | 无 |
| 8 | **lable**（料标签，mode 11） | `_0xff5572` = `lableForMaterial` @371010–375005 | 同上 | 同款无条件 orderID 前缀排序 @374743 | **无** | 无 |
| 9 | **product10**（生产标签，mode 10） | `_0x2e25b8` = `lableForProduct` @375005–404480 | 先 ping_hui、后 diao_hui；入口先 `filter(有formulaid).sort(formulaid↔颜色)`（`_0x4426c3` @375585） | 收尾：`sort_method==='order'` → `parseInt((orderID‖OrderID).split('-')[0])` 升序（@403347），否则不动 | ping @378718 / diao @390994 `if(!公式数据) continue`；吊趟 `if(!扇数) continue` @392948 | ① 复制：按 `BoLiKuan` 值 `split('*')[1]`（缺省 1）复制 N 行（@401900/@402235）② **再按 `orderID+'_'+GlassSize` 分组**，每组只保留前 1 行（组内含"单玻"）或前 2 行（@402331–402470） |
| 10 | 打印分发 `_0x32a64c` @589617；PDF `_0x2555e0` @595542；`_0x775778` @597902 | — | mode 1/2 → `{produces: **timestamp 排序**后的 produce.data}`；mode 8/9 → `_0x290795()`；3 → `_0x164736`；4/11 → `_0x46af77`；10 → `_0x8c791d` | 见下 §1.10 | — | — |
| 11 | **排序方式 UI** | 打开 `_0xff1972`（按钮「排序方式」token 524）；保存 `_0x2a0b61` @324531 → `localStorage.setItem('smartdoor_sort_method', v)`，`ElMessage('排序方式已保存')` | 选项：`profile`=型材优先（默认） / `order`=序号优先（`_0x5d666e` @323631，`el-select` 渲染 @622285） | — | — | — |

### 0.2 Home（订单页，回执族）

| # | 入口 | 生成函数 / 偏移 | 行顺序 | 排序 | 过滤 | 分组 |
|---|---|---|---|---|---|---|
| 12 | **receipt**（回执预览/打印） | `qn.value`，生成于 `ki` @381732 / `Fi` @417252：`Object.keys(wn).map(k => ({...wn[k].customerInfo, receipt: wn[k].hui_picture}))` | `Object.keys(wn)` 的**插入序** | 无 | 无 | 一个 `wn` 键（= 回执单号）一行 |
| 13 | **FinalReceipt**（收据单，mode 5） | `Ci` @367536 → `jn`；载荷 `Qn()`（若 `Zn` 开则金额清零） | `Object.keys(gn)` 插入序 → 按 **client 首次出现**分组 | 无 | 无 | **按 `client`（客户名）分组**：同客户多单 → 合并成一行（`total/deposit` 求和，`balance=total-deposit`，`门数` 求和，`receipt` 行依次拼接）；`client` 为空时归 `"未知客户"` |
| 14 | **ReceiptList**（收据清单，mode 6） | 同 `Ci`，载荷直接 `jn`（不清零） | 同上 | 无 | 无 | 同上 |

**回执行在「单个 order 内」的顺序（`Gi` @394500–404000）**：`const f=[],h=[];`
`wn[t].ping_hui.forEach(row => {…f.push(…); …h.push(…)});` 然后 `wn[t].diao_hui.forEach(…)` 再各 push 一次；
即 **先全部平开行、再全部吊趟行，不排序**（与线索 #2 一致）。`wn[t].hui_picture=f`、`gn[t].hui_picture=h`。

---

## 1. 逐条证据

### 1.0 公共：入口就地的「型材排序 + 丢空 formulaid」

`calculateReceipt` / `calculateReceiptOld` / `calculateReceiptForCustomed` 三家有同款 helper，且**把结果写回响应式数组**（会污染后续操作）：

```js
// calculateReceipt @480311（_0x5389cf）
const _0x5389cf = e => e.filter(e => e.formulaid && '' !== e.formulaid.trim())
  .sort((e,a) => e.formulaid !== a.formulaid
      ? e.formulaid.localeCompare(a.formulaid)
      : (e['颜色']||'').localeCompare(a['颜色']||''));
// 写回：@480764  ping_hui = _0x5389cf([...ping_hui])；@481071 diao_hui = _0x5389cf([...diao_hui])
```

- `calculateReceiptOld`：`_0x2ddbe2` @521124，写回 @521533（ping）/ @521875（diao）。
- `calculateReceiptForCustomed`：`_0x26e24a` @559357，写回 @559788 / @560122。
- `lableForProduct`（product10）：`_0x4426c3` @375585，**只写局部变量**（`_0x2b08af` / `_0x2e2a8a`），不改 `_0x5b10d7`。
- **`calculateGlass`、`Glasslist`、`lable`、`lableForMaterial` 没有这个 helper**（全文件 `localeCompare` 只有 6 处：480511/480544、521271/521303、559514/559554、375691/375724）。

### 1.1 逐入口的 `continue`（行级丢弃）

| 函数 | ping | diao |
|---|---|---|
| `calculateReceipt` | `@483995 if(!公式数据) continue` | `@502971 if(!公式数据) continue`；`@504122 if(!扇数) continue` |
| `calculateReceiptOld` | `@524666` | `@541426`；`@542547` |
| `calculateReceiptForCustomed` | `@562803` | `@574710`；`@575847` |
| `calculateGlass` | `@457753` | `@469088`；`@470205` |
| `Glasslist` | `@412551` | `@438391 if(底玻==='无'&&面玻==='无') continue`；`@438631`；`@439748` |
| `lableForProduct` | `@378718` | `@390994`；`@392948` |
| `lable` / `lableForMaterial` | **无 continue** | **无 continue** |

### 1.2 produces 族：写入顺序与「分组」

`_0x4d19f5 = Vue.reactive({})`（@362870）。每个生成函数开头先清空：
`Object.keys(_0x4d19f5).forEach(e => delete _0x4d19f5[e])`（如 @482779）。
键名 = `'ping' + (i+1)` / `'diao' + (i+1)`（token 927='ping'，token 191='diao'），`i` 是循环下标（因此跳过的行会**留号缺号**，但不影响顺序）。

8 个写入点，**每个函数都是 ping 块在前、diao 块在后**：

| 函数 | ping 写入 | diao 写入 |
|---|---|---|
| `calculateGlass` | @466942 | @478052 |
| `calculateReceipt` | @498718 | @519154 |
| `calculateReceiptOld` | @537702 | @557251 |
| `calculateReceiptForCustomed` | @571741 | @587754 |

记录形状：`{ orderInfo, calculationResults, produce:{ timestamp: Date.now(), data } }`。

### 1.3 `smartdoor_sort_method` 的全部取值分支

**只有 3 个读点，全在 Hui**（`grep -o` 全文只有 2 个字面量 + 1 个 token `(477)`）：

| 读点 | 函数 | 代码 |
|---|---|---|
| @519330 | `calculateReceipt` | `const m = localStorage.getItem('smartdoor_sort_method') \|\| 'profile';`<br>`m==='order' ? Object.entries(map).map(([k,v])=>v.produce.data).sort((a,b)=> (parseInt((a.OrderID\|\|a.orderID\|\|'').split('-')[0])\|\|0) - (parseInt((b.OrderID\|\|b.orderID\|\|'').split('-')[0])\|\|0))`<br>`: Object.entries(map).sort((e,t)=>e[1].produce.timestamp-t[1].produce.timestamp).map(([k,v])=>v.produce.data)` |
| @403347 | `lableForProduct` | `const m = localStorage.getItem('smartdoor_sort_method') \|\| 'profile';`<br>`m==='order' && rows.sort((a,b)=> (parseInt((a.orderID\|\|a.OrderID\|\|'').split('-')[0])\|\|0) - (parseInt((b.orderID\|\|b.OrderID\|\|'').split('-')[0])\|\|0))` |
| @453822 | `Glasslist` | `const m = localStorage.getItem('smartdoor_sort_method') \|\| 'profile';`<br>`m==='order' && list.sort((a,b)=> (parseInt(a.OrderID.split('-')[0])\|\|0) - (parseInt(b.OrderID.split('-')[0])\|\|0))` |

以及 3 个同款三目**用 token `(477)`** 写在 `calculateGlass`（@478473）、`calculateReceiptOld`（@557435）、`calculateReceiptForCustomed`（@587938）。
（`(477)` 的完整出现：98802、172267、228460… 多为别处；**本页相关 6 处**：403347/453822/478473/519330/557435/587938。）

- **取值只有两个**：`'profile'` 与 `'order'`；**默认 `'profile'`**。
- **写入点只有一处**：Hui 页工具栏按钮「排序方式」（`_0xff1972` @324476 → 对话框 `_0x24527c`；`_0x5d666e` @323631 是 `el-select` 的 ref，初值 `localStorage.getItem('smartdoor_sort_method') || 'profile'`；保存函数 `_0x2a0b61` @324531）：
  ```js
  localStorage.setItem('smartdoor_sort_method', _0x5d666e.value); … ElMessage.success('排序方式已保存')
  ```
  选项（render @622285–622420）：`profile` = **型材优先**，`order` = **序号优先**。
- **不是每个入口都读它**：`lable` / `lableForMaterial` 完全无视它（无条件按 orderID 前缀排）；`calculateReceiptOld` / `calculateReceiptForCustomed` / `calculateGlass` 只在**返回给预览/调用方**的数组上生效；`Glasslist` 只影响 `glassInfoList`。

### 1.4 分组 / 配对

1. **`_0x1ebfe1`（product3 双联）** @363164：
   ```js
   e => { const a=[]; for(let x=0;x<e.length;x+=2){ const _=e[x], l=e[x+1];
     if(l){ const o={..._}; Object.keys(l).forEach(k=>{o[k+'1']=l[k]}); a.push(o) } else a.push(_) } return a }
   ```
   只在 `mode 9`（`_0x85a3a.value===9`）时用；两条路径都调用：`_0x290795` @363493（分发器取数）与 `calculateReceiptOld` 收尾 @557973（`_0x5cc934.value ? _0x1ebfe1(rows) : rows`）。
   **输入是「已按 sort_method 排好序」的数组**，不是 `lines` 原序。
2. **product10 的 `orderID + '_' + GlassSize` 分组**（@402331–402470，见 §1.6）——这是唯一另一处"按单号分组"。
3. **Home 回执按 `client`（客户名）分组**（`Ci` @367536，见 §1.8）。
4. **没有**按型材分组、按回执单号分组（除上述两处）的实现。

### 1.5 `lable` / `lableForMaterial` 的收尾排序

```js
_0x46af77.sort((e,t)=>{ const k = e => {
    if(!e.orderID || ''===e.orderID) return Infinity;
    const m = String(e.orderID).match(/^(\d+)-/);
    return m ? parseInt(m[1],10) : Infinity; };
  return k(e)-k(t) });
```
`lable` @369992（另有一份同款在 @370888 的 diao 分支尾部）；`lableForMaterial` @374743。
排序键是 `orderID` 的**首个数字段**（`"123-4" → 123`）；无 `orderID` 或首段非数字 → `Infinity`（排最后，且 `Array#sort` 稳定 → 保持原相对次序）。
**不依赖 `smartdoor_sort_method`。**

### 1.6 product10 的复制与分组

1. 复制（@401900 ping 分支 / @402235 diao 分支）：在基行 `_0x336291` 里找 `BoLiKuan`（玻璃宽）字段，
   `N = parseInt(String(v).split('*')[1] || '1', 10)`，push `N` 份（缺省 1）。ping 分支优先用 `GlassSize_*` 的**后缀拼接**键（`x + 'BoLiKuan'`，如 `1BoLiKuan`）。
2. 分组（@402331–402470）：
   ```js
   const out=[], g=new Map;
   rows.forEach(r => { const k = r.orderID + '_' + r.GlassSize; g.has(k)||g.set(k,[]); g.get(k).push(r) });
   g.forEach(list => { const cap = list[0].glass && list[0].glass.includes('单玻') ? 1 : 2;
                       out.push(...list.slice(0, Math.min(list.length, cap))) });
   ```
   然后 `GlassSize` / `GlassSize_*` 只保留前两个 `*` 段；组内前两行若 `glass` 含 `-` 则按 `-` 拆分写入第二行。
3. **注意（原版自带的不一致）**：分组结果 `_0x20abf2` 只用于 `commentPreview`（@403999）；
   分发器 mode 10 打印用的是**未分组**的 `_0x8c791d`（@593625 `pe=_0x8c791d`）。
   即「生产标签」**预览是分组+限量版，打印是原始复制版**。

### 1.7 `_0x164736`（glassHole 载荷）

`_0x164736` 初值 `{date:'', glassInfoList:[]}`（@322171）；`Glasslist` 收尾 @453822 重建：
```js
list = list.filter(e => 0 !== Number(e.thickness));
if(m==='order') list.sort((a,b)=>(parseInt(a.OrderID.split('-')[0])||0)-(parseInt(b.OrderID.split('-')[0])||0));
_0x164736 = { date: _0x44ed1d(new Date), glassInfoList: list };
```
（`Number(undefined)` 是 `NaN`，`0!==NaN` 为真 → **undefined 的 thickness 不会被丢**；空串 `''` → `0` → **会被丢**。）

### 1.8 Home：回执行组装

- 载入选中订单行（`Gi` @390200–391200）：先遍历 **平开表 Map `Ql`**、再遍历 **吊趟表 Map `Rl`**，
  把行按 `回执单号` 收进 `wn[l].ping_hui` / `wn[l].diao_hui`（`gn` 同步镜像）。选中的判据是
  `V.includes(回执单号)`（V = 表格勾选集合）或行自身 `isSelected`。
- 每个 `回执单号` 组装 `f`（含 `pricing`）与 `h`（含 `remark`）两个数组：
  `const f=[],h=[]; wn[t].ping_hui.forEach(...) → f.push/h.push; wn[t].diao_hui.forEach(...) → f.push/h.push;`
  → **先全部平开、再全部吊趟，不排序**（@394675–404100）。
- 回执行分组/合并函数 `Ci` @367536：
  ```js
  rows.forEach(r => { const c = r.client || '未知客户'; (g[c] ||= []).push(r) });
  Object.keys(g).forEach(c => {
    const n = g[c];
    if(n.length === 1){ …a.push(clone); return }
    const u = {client:c,total:0,deposit:0,balance:0,'门数':0,receipt:[]};
    n.forEach(r => { u.total+=r.total||0; u.deposit+=r.deposit||0; u.balance=u.total-u.deposit||0; u['门数']+=r['门数']||0;
                     u.receipt = [...u.receipt, ...(r.receipt||[]).map(x=>({...x, date:x.date||r.date||''}))] });
    a.push(u) });
  ```
- 订单列表本身按 `回执单号` **降序**排（`@342278`：`.sort((t,l)=>parseInt(l['回执单号'])-parseInt(t['回执单号']))`）。
- `FinalReceipt`（mode 5）载荷 = `Qn()`：`Zn.value` 为真时把 `total/deposit/balance` 清零、并把每条 receipt 行的 `price/amount/pricing` 清零；否则原样返回 `jn`。
  `ReceiptList`（mode 6）载荷 = `jn`。
- 模板名映射见 `index-7ca9e657.js`：
  `{receipt, product, product1..product10, glass, glassHole, lable, **FinalReceipt**(模板键 252/275), **ReceiptList**(265/297), sale}`。
  `FinalReceipt` / `ReceiptList` 默认是空对象 `{}`，从服务端 `getPrintTemplate` 的 `FinalReceiptTemplate` / `ReceiptListTemplate` 载入。

### 1.9 produce.timestamp

- 产生方式：`produce:{ timestamp: Date.now(), data: <该行> }`，**在写入 `_0x4d19f5` 的那一刻取当前毫秒**（8 个写入点，见 §1.2）。因此 timestamp ≡ 该行的「算料产出顺序」。
- 因为每个函数都是 ping 块先写、diao 块后写，所以 ping 的 timestamp ≤ diao 的 timestamp。
- 默认分支 `'profile'` 按 timestamp **升序** → 稳定排序 → 结果 = **写入顺序** = `ping(型材序) + diao(型材序)`。
  （同一毫秒的并列由 `Array#sort` 的稳定性保持插入序。）
- `'order'` 分支按 `OrderID`（=`orderInfo['单号']`，写在 produce.data 上：ping @494854、diao @515868 等）首个 `-` 前数字段升序；无单号 → `NaN||0 = 0`，**排最前**。
- 与「用户看到的行为」的关系：`排序方式 = 型材优先(profile, 默认)` 时看到的是**算料顺序（≈型材/formulaid 顺序）**；`序号优先(order)` 时看到的是**单号顺序**。
  但注意 §1.10 的坑。

### 1.10 打印分发实际用的是哪份数据（重要）

Hui 页三个分发函数（`_0x32a64c` 打印 @589617、`_0x2555e0` 导出 PDF @595542、`_0x775778` @597902）在开头都**重新算了一遍**：

```js
const me = Object.entries(_0x4d19f5)
  .sort((e,t)=> e[1].produce.timestamp - t[1].produce.timestamp)
  .map(([k,v]) => v.produce.data);
```

mode → 载荷：

| mode | 载荷 | 是否尊重 `smartdoor_sort_method` |
|---|---|---|
| 1（玻璃合片单） | `{produces: me}` | ❌ 只按 timestamp（**忽略** 排序方式） |
| 2（生产单、生产单1） | `{produces: me}` | ❌ 同上 |
| 8（生产单定制 product2） | `_0x290795()` | ✅ 走 `_0x3054e4.value`（`calculateReceiptOld` 的结果），空则回落 `_0x356a70()`（timestamp） |
| 9（product3） | `_0x290795()` | ✅ 同上，且 mode 9 时 `_0x1ebfe1` 配对 |
| 3（玻璃订单） | `_0x164736` | ✅（`order` 才排） |
| 4 / 11（标签/料标签） | `_0x46af77` | ✅（无条件按 orderID 前缀排） |
| 10（生产标签） | `_0x8c791d`（**未分组版**） | `order` 分支只在 `_0x20abf2` 上做过 |

即：**Hui 页自己打印「生产单 / 玻璃合片单」时排序方式不生效**；只有预览（`commentPreview`）用的是排序后的返回数组。
（Home 页不同：`uc.value = await lc.value.calculateReceipt(…)`，Home 的分发器 `Zc` @441847 用 `{produces: uc.value}`，**用的是排序后的返回数组**。）

### 1.11 分页（hiprint）

- 代码里**没有任何**「按行分页 / 一行一页」的计算：Hui 与 Home 都是把**整个数组**交给 hiprint（`printProduct2` / `transitPrintSingle` / `print`），由 hiprint 按模板分页。
- `panelLayoutOptions` / `paperNumberTop` 在 `Hui`、`Home` 中**出现 0 次**；只在
  `index-7ca9e657.js`（内置 `sale` 模板默认值：`paperNumberTop:573, paperNumberLeft:565.5, paperNumberContinue:true, rotate:true, panelLayoutOptions:{}`）
  与 hiprint 本体 `vue-ade658be.js` 中出现。
- hiprint 里的判定（`vue-ade658be.js` @2409004 附近）：面板换页由 `panel.panelPageRule` 控制——`panelPageRule === 'none'` 时**不自动换页**，否则内容超出 `paperFooter` 就换页（= 能塞几行塞几行，多行一页）。`paperNumberTop/Left/Format/Continue/Disabled` 只决定**页码**画在哪、怎么编号。
- 结论：**「一行一页 / 多行一页」完全由模板（服务端下发、可在设计器里改）决定**，不由数据行数决定。唯一在代码里写死的只有内置 `sale` 模板。
- 另：`maxRows` 在 Hui 出现 9 次，全部是 `el-input` 的 `autosize:{minRows,maxRows}`（@99975/208307/239187/239514/239840/240156/252654/252982/253296），**与打印分页无关**。

---

## 2. 与我们实现的差异清单

对照 `app/src/views/Hui.vue`。

> ⚠️ **本表标记写于早期轮次，已滞后；且 `@####` 行号已过期。**
> **权威状态见文末「附：差异表 triage 结果（2026-09-14）」** —— 13 条中 12 条已修，仅 D11 仍存在。

| # | 我们的实现 | 原版语义 | 判定 |
|---|---|---|---|
| D1 | `productionProduces()` @3920：直接 `for (const l of lines.value)` 原序 push | `calculateReceipt`：ping_hui 块（按 `formulaid→颜色` 排）→ diao_hui 块（同）；且丢 `formulaid` 空行、丢查不到公式的行、吊趟丢无扇数行 | ❌ 顺序 + 过滤都缺 |
| D2 | `glassProduces()` @3377：`lines.value` 原序 | `calculateGlass`：ping 块 → diao 块（**无 formulaid 排序**，但有同款 continue 过滤）；打印时按 timestamp（=写入序） | ❌ 缺 ping/diao 分段与过滤 |
| D3 | `glassInfoProduces()` @3438：`lines.value` 原序；已实现吊趟「双无玻 continue」 | `Glasslist`：ping_hui 原序 → diao_hui 原序；**缺** 收尾 `0!==Number(thickness)` 过滤 与 `sort_method==='order'` 时的 `OrderID` 前缀排序 | ⚠️ 部分（过滤/排序缺） |
| D4 | `oldSheetProduces()` @4021 / `oldSheetProduce()` @3972：`lines.value.map(...)` | `calculateReceiptOld`：ping 块 → diao 块（有 `formulaid→颜色` 排序与 continue 过滤） | ❌ 顺序 + 过滤都缺 |
| D5 | `product1Produces()` @4029：`lines.value` 原序 | `calculateReceiptForCustomed`：ping 块 → diao 块（同款排序与过滤） | ❌ 顺序 + 过滤都缺 |
| D6 | `pairRows()` @4005：隔行配对 + 第二行键加 `1` 后缀 + 奇数行原样 | `_0x1ebfe1` 逐字一致 | ✅ 算法；❌ **输入顺序**（原版先排序/过滤再配对，我们用 `lines.value` 原序，配对结果会不同） |
| D7 | `labelRows('lable')` @3312：`lines.value` 原序复制 N 份 | `lable` / `lableForMaterial`：ping→diao（各自原序），**收尾无条件**按 `orderID` 首个数字段升序（缺 orderID → 排最后） | ❌ 缺收尾排序 |
| D8 | `labelRows('product10')` @3312 + `product10Copies()` @3303：按 `lines.value` 原序复制；张数 = 玻璃宽部件 quantity，且**要求同时有玻璃宽和玻璃高** | product10：复制数 = 行内 `BoLiKuan` 值 `split('*')[1]`（缺省 1，**不要求玻璃高**）；复制后**按 `orderID+'_'+GlassSize` 分组，每组最多 1(单玻)/2 行**；`GlassSize` 只留前两段；组内 `-` 拆分；`order` 时按 orderID 前缀排序 | ❌ 缺分组/限量/GlassSize 截断；复制数判据 ⚠️ 不同 |
| D9 | `templatePayload()` @4134：product10 与 lable 用**同一份** `labelRows` 数据既预览又打印 | 原版预览用分组的 `_0x20abf2`，打印用未分组的 `_0x8c791d`（原版自身不一致） | ⚠️ 需决定跟哪一支（建议跟打印分支否则与原版打印不一致） |
| D10 | `receiptOrderedLines()` @3180：平开在前、吊趟在后、各自保持原序 | 单订单内 `f`/`h` 确实是「先 ping 后 diao、不排序」 | ✅ 单订单内一致 |
| D11 | `receiptPrintData()` @3189：**单订单**一份表头 + receipt 行数组 | Home 回执行是**跨订单按 `client` 分组**：同客户多单合并（total/deposit/balance/门数 求和，receipt 行拼接），client 空归"未知客户"；`FinalReceipt`（mode 5）另走 `Qn()` 金额清零，`ReceiptList`（mode 6）不清零 | ❌ 缺「按客户分组」与 FinalReceipt/ReceiptList 两套载荷 |
| D12 | 全项目 `grep 'smartdoor_sort_method'` = 0 | 原版有 localStorage 键 + 「排序方式」对话框（型材优先/序号优先），默认 `profile` | ❌ 完全没有 |
| D13 | `printGlass()` @4223 / `printCurrentTemplate()` @4152 用 `lines.value` 派生的数组整份交给 hiprint | 同上；分页交由模板 | ✅ 分页思路一致（模板相同则分页相同） |
| D14 | 无 `glassInfoList` 的 `thickness` 过滤（`glassInfoProduces` 不过滤 thickness） | `0 !== Number(e.thickness)` 丢弃厚度数值为 0 的行（`''` 会被丢，`undefined` 不会） | ❌ |

**优先级建议**（按对打印结果可见度）：D8（生产标签分组，肉眼差异最大）> D1/D2/D4/D5（生产单/玻璃单块内顺序）> D6（配对输入序）> D7（标签排序）> D3/D14（玻璃订单过滤+排序）> D11（回执跨订单分组）> D12（排序方式设置项）。

---

## 3. 未确定项

1. `produce.data` 上 `OrderID` 的**全部**赋值点未逐一枚举（已确认 ping @494854、diao @515868 两处主路径，均在 `_0x500ef9.OrderID = row['单号']` / `_0x551a25` 系列）。
2. Home 里 `Ql`/`Rl` 两张 Map 的键插入序未逐点验证；因此 `Object.keys(wn)`（回执行顺序）在**跨订单**场景下的精确顺序**未确定**——机制确定是「先 ping 表、后 diao 表遍历选中行」，但表本身的顺序取决于表格创建顺序。
3. `product10` 里 `GlassSize_*` 键的**产生处**（produce 数据构建时的命名规则）未定位到确切写入点。
4. `Glasslist` 收尾排序用 `e.OrderID` **没有** `||''` 兜底，若某行缺 `OrderID` 会抛异常——这是原版行为还是我等漏了 `try`，**未确定**。

---

## 附：差异表 triage 结果（2026-09-14）

> 本文档的 ❌/⚠️ 标记写于早期轮次，**标记已滞后**。本轮逐条对照当前代码重新判定，
> **权威状态以本表为准**。引用的 `H####` / `@####` 行号均已过期，判定一律按**符号名**定位代码。

| # | 判定 | 依据（当前代码）|
|---|---|---|
| D1 | ✅ 已修 | `productionProduces()` → `orderedLines(true)`（ping 块→diao 块 + formulaid/颜色排序 + `keep()` 过滤）|
| D2 | ✅ 已修 | `glassProduces()` → `orderedLines(false)`（ping→diao，不排序，与原版一致）|
| D3 | ✅ 已修 | `glassInfoProduces`：`filter(r => Number(r.thickness) !== 0)` + `sortMethod==='order'` 按单号前缀排 |
| D4 | ✅ 已修 | `oldSheetProduces()` → `orderedLines(true)` |
| D5 | ✅ 已修 | `product1Produces()` → `orderedLines(true)` |
| D6 | ✅ 已修 | `pairRows()` 的输入已是排序后的 `orderedLines` |
| D7 | ✅ 已修 | `labelRows('lable')` 收尾按 `orderID` 首数字段升序，非数字排最后 |
| D8 | ✅ 已修 | `product10Copies()` 要求**同时有玻璃宽与玻璃高**，否则 1 张 |
| D9 | ✅ 已修 | `forPreview ? groupProduct10(rows) : rows`（复刻原版预览/打印自身不一致）|
| D12 | ✅ 已修 | `sortMethod` + `smartdoor_sort_method` 均已实现 |
| D14 | ✅ 已修 | 同 D3 的 thickness 过滤 |
| 216/217 | 非我方缺陷 | 那两行描述的是**原版自身**忽略 sort_method 的行为，不是我们的偏差 |
| **D11** | ❌ **仍存在（规则已查明）** | **2026-09-14 复核：确实存在，我先前判「证伪」是错的。** 分组逻辑不在回执构造器里，而在 Home chunk 的 **`Ci()`（@367536）**，产出喂给 **mode 6（出货清单/ReceiptList）**：<br>① 按 `客户\|\|"未知客户"` 分组；<br>② **组内 1 条** → 深拷贝原样，行缺 `date` 用订单 `date` 回填；<br>③ **组内多条** → `{client, total:Σ, deposit:Σ, balance: total-deposit, 门数:Σ, receipt: 各行拼接}`，行 `date` 同样用所属订单的 `date` 回填。<br>另：**mode 5（收据单）** 的「金额清零」由开关 `Zn` 门控 —— `Qn()` @354821：`total/deposit/balance → 0`、每行 `price/amount/pricing → 0/0/""`；`Zn` 为假时原样返回 `jn`。<br>⇒ 待实现。需要把 `receiptPrintData()` 抽成「可传入订单数据」的形态，再加「选中多单 → 按客户分组 → 出 ReceiptList」。我们已有订单列表（`api.listOrders()` 摘要 + `api.getOrder(id)`），但摘要不含行，需对选中单逐个取详情 |

### 补充说明（2026-09-14 之后的相关改动）

- **`link_no`（行级单号）已删除**：原版「单号」列可逐行编辑并作为「序号优先」的排序键，
  移植时丢了编辑器导致恒为 NULL。删除后 `orderedLines` 的 `orderPrefix` 退化为**订单级单号**
  → 「序号优先」当前恒等于原序。若将来恢复行级单号，排序会随之恢复。
- **`product1Produces()` 的吊趟行**现在产**标准生产单形状**（原版 `data:_0x1239ce`），
  平开仍为 product1 形状（`_0x4495e3`）。若本文档有基于旧行为的描述，以本条为准。
