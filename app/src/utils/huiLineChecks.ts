/**
 * 明细行的两件**纯校验**（保存整单 / 剔除全空行）—— 2026-09-20 从 `Hui.vue` 搬出
 * （逻辑逐字未改，C11）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）是**一段**：
 * `Hui.vue:1537-1584`，段内 **2 个声明** —— `missingFieldsOf`(1537) / `rowHasContent`(1569)。
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C11 一条）。
 *
 * ## 为什么在 `utils/` 而不是 `composables/hui/`（spec §3.3）
 *
 * 两个函数都**以 `l: Line` 为参**、只返回值 —— 不读页面状态、不注入任何依赖、不开弹窗
 * ⇒ 按 §3.5 的分层约定进 `utils/`。**别顺手给它们套一个 `useXxx()`**：那会把一件纯函数
 * 变成「谁调谁得先有页面上下文」，凭空收窄可用面。
 *
 * ## 注入面 = **0 项**
 *
 * 搬出后体里没有一处引用页面变量（原先也没有）。**唯一的外部依赖是类型 `Line`**
 * （`./partsEngine`）—— 那是**类型**，编译后不留运行时依赖。
 *
 * ## 回传面 = **2 项，都是页面里剩下的调用点**（2026-09-20 逐条实测）
 *
 * | 名字 | 页面（`Hui.vue`）里剩下的读者 |
 * |---|---|
 * | `missingFieldsOf` | `saveOrder()` 里那张「第 N 行缺：…」的表 |
 * | `rowHasContent` | `saveOrder()` 里 `lines.value.filter(rowHasContent)` |
 *
 * ⇒ 页面侧**用普通 `import` 接**（不是 composable 解构）—— 这两件没有 `ref`、
 *    没有「回传同一个对象」那类引用同一性问题（与 C2/C12 那两块的区别就在这儿）。
 *
 * ⚠️ `rowHasContent` 在页面里是**当谓词函数直接传**的（`filter(rowHasContent)`）——
 *    搬走后仍是同一个函数引用，别顺手改成 `(l) => rowHasContent(l)`（无谓差异，且多一层包装）。
 *
 * ⚠️ 那段「必填清单逐字照抄旧版」的说明**跟着函数体一起搬来了**（在 `missingFieldsOf` 体内）——
 *    它是这两个文件里唯一记着「旧版清单长什么样、我们有意放宽了哪两项」的地方，别删。
 *    段落级的「—— 保存整单校验 ——」那段说明仍在 `Hui.vue` 的调用点上方（那是**流程**的说明，
 *    讲的是「必填只在保存整单拦截、保存前先剔空行」，不属于这两个纯函数）。
 */
import type { Line } from './partsEngine'

export function missingFieldsOf(l: Line): string[] {
  const m: string[] = []
  const add = (ok: boolean, name: string) => {
    if (!ok) m.push(name)
  }
  // 必填清单**逐字照抄旧版**（平开 @349085 / 吊趟 @353602）：
  //   平开 `["型材","数量","颜色","底玻","面玻", 玻璃厚,"开向", 计价方式]`
  //   吊趟 `["型材","颜色","底玻","面玻", 玻璃厚,"开向","扇数", 轨道种类]`
  // ⚠️ **底玻/面玻是必填**（原版两格都没有 `clearable`，配合新建行默认值 ⇒ 空串在旧版产生不出来）。
  // ⚠️ **原版清单里没有 门洞宽/门洞高**（用户确认「按照原版改」）。
  //    @349301 校验循环里那两条 `"门洞高"===e && _[e]<=0` / `"门洞宽"===e && _[e]<=0`
  //    是**死代码** —— `e` 只遍历清单 `x`，而这两项不在 `x` 中，永不命中
  //    （形态像当初漏加了清单项）。故原版**实际不校验尺寸**：`errorFields["门洞高"]` 也没有
  //    任何地方会写 `true`（单元格上挂着 `error-cell` 绑定但永远是 false）。
  //    ⇒ 我们同步去掉这两项必填（**这是一处放宽**；要恢复只需把两行 `add` 加回来）。
  add(!!l.profile.trim(), '型材')
  add(!!l.color.trim(), '颜色')
  add(!!l.bottom_glass.trim(), '底玻')
  add(!!l.face_glass.trim(), '面玻')
  add(!!l.glass_thickness.trim(), '玻璃厚')
  add(!!l.direction.trim(), '开向')
  if (l.line_type === 'ping') {
    add(l.quantity >= 1, '数量')
    add(!!l.price_type.trim(), '计价方式')
  } else {
    add(!!l.fans.trim(), '扇数')
    add(!!l.track.trim(), '轨道种类')
  }
  return m
}

// 整行无任何内容 → 保存前自动剔除（旧版 splice 语义）
export function rowHasContent(l: Line): boolean {
  return !!(
    l.profile.trim() ||
    l.door_width > 0 ||
    l.door_height > 0 ||
    l.color.trim() ||
    l.bottom_glass.trim() ||
    l.face_glass.trim() ||
    l.glass_thickness.trim() ||
    l.direction.trim() ||
    l.fans.trim() ||
    l.track.trim() ||
    l.price_type.trim()
  )
}
