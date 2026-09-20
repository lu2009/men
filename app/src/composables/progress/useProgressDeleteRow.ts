/**
 * Progress 订单进度页的**行内「删除」**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）：`Progress.vue:513-601` —— **连续一段**，
 * 段内**唯一的**声明是 `confirmDeleteRow`（REF **564**；拆分方案里的 **P4**）。段首那行分区横幅
 * （`// ===== 行内「删除」（§4.3）=====`）与段内全部注释**原样搬来**。
 *
 * 边界怎么复量（两端各看一眼：`513` 的上一行是空行、`601` 的下一行已是**别的段**的横幅）：
 *   `git show f097a9b1:app/src/views/Progress.vue | sed -n '511,515p'`（末行 = 本段横幅）
 *   `git show f097a9b1:app/src/views/Progress.vue | sed -n '599,603p'`（次行已是 `// ═══`）
 *
 * 搬迁保真由 `docs/progress-extract-movecheck.mjs` 机核（P4 一条，参照 `f097a9b1`）。
 * ⚠️ **注释的保真不在那个守卫里**：`sliceFn` 从**声明**（`function confirmDeleteRow`）起切，
 *   上方那一整段块注释**一行都不进切片** ⇒ 它的唯一证据是「整段文本与 REF 同区间逐字节比」，
 *   别拿「守卫绿」当它的证据。
 * ⚠️ 本段另有一处**只此一份**的来源：段内第 3 行（REF 515）的旧版文件名，在搬迁**前一笔**提交
 *   （`acf5d577`）里刚被改对（`fb4def35` → `f4bdef35`）⇒ 与 `f097a9b1` 比会**恰好多出这一行**
 *   差异，那不是抄错。复量：`git show acf5d577 -- app/src/views/Progress.vue`。
 *
 * ⚠️ **注入 3 项**（都是页面拥有的东西；**传 ref / API 对象本身，不是 `.value` 副本**）：
 *   · `rows` —— 页面 `ref<ProgressRow[]>([])`。本块**要写它**：删成功后把那一行 `splice` 掉。
 *   · `dialog` —— 页面 `useDialog()`（二次确认弹窗；旧版是 `ElMessageBox.confirm`）。
 *   · `message` —— 页面 `useMessage()`（成功 / 失败 / 已取消 三种提示）。
 *   模块级依赖（`api` 与类型 `ProgressRowDto`）本文件**直接 import 不注入** —— 与
 *   `composables/progress/useProgressColors.ts` 及 `composables/home/` 那批同一口径。
 *
 * ⚠️ **搬迁时的文本改写 = 3 类（`dialog` / `message` / `rows`）、4 条规则、命中 6 处**
 *   （逐条登记在守卫的 `rewrites` 里）：
 *   `dialog.warning`(×1) · `message.`(×3) · `rows.value.findIndex`(×1) · `rows.value.splice`(×1)。
 *   ⚠️ `rows.value` 在本段里出现 **4** 次，其中 **2 次在注释里**（REF 598 那句「用 `splice` 而不是
 *     `rows.value = rows.value.filter(...)`」）⇒ 规则**故意写成带后界的** `rows.value.findIndex` /
 *     `rows.value.splice`，**不写裸 `rows.value`** —— 否则会把那句注释改成
 *     `deps.rows.value = deps.rows.value.filter(...)`，**注释内容就漂了**（Global Constraints
 *     明令「不许改注释内容」）。
 *   复量法：`applyRewrites` 的 `from` 在文本里找不到就**抛** ⇒ 上面那 4 个计数一旦漂了，守卫直接红
 *   （不是静默放过）。切片本身也能自己数：`sliceFn(REF 全文, 'confirmDeleteRow')` 归一再数。
 *
 * ⚠️ **回传 1 项**：`confirmDeleteRow`。段外**唯一**的读者是 `columns` 里「删除」那格链接的
 *   `onClick: () => confirmDeleteRow(r)`（REF 1332）⇒ 签名 `(r: ProgressRowDto) => void` 原样不变。
 *
 * ⚠️ **本块拥有并借出的状态：无。** 段内一个 `ref`/`computed` 都没有，只有这一个函数。
 *
 * ⚠️ **`rows` 的类型**：注入面写 `Ref<ProgressRowDto[]>`，而页面那个 `rows` 是
 *   `Ref<ProgressRow[]>`（`ProgressRow = ProgressRowDto & { isSelected: boolean }`；那个 `type`
 *   在 REF:362、**不归本块**、也没搬走）⇒ 页面那个**结构化地**就能赋给它
 *   （`ProgressRow[]` 可赋给 `ProgressRowDto[]`），`vue-tsc` 干净。本块只用 `findIndex`/`splice`，
 *   用不到 `isSelected`。
 *   ⇒ **别把页面里的 `ProgressRow` 挪走或改名**，本文件也**不另立一份同名 `type`**（＝第二份定义，
 *     两边各自漂移）。
 */
import { type Ref } from 'vue'
import type { DialogApi, MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { ProgressRowDto } from '../../api/types'

/** `useProgressDeleteRow()` 的注入面。**只放页面拥有的东西**（见文件头「注入 3 项」）。 */
export interface ProgressDeleteRowDeps {
  /** 页面行列表（页面 `ref<ProgressRow[]>([])`）—— 本块**写**它：删成功后 `splice` 掉那一行。 */
  rows: Ref<ProgressRowDto[]>
  /** 二次确认弹窗（页面 `useDialog()`）。 */
  dialog: DialogApi
  /** 成功 / 失败 / 已取消 三种提示（页面 `useMessage()`）。 */
  message: MessageApi
}

/**
 * 行内「删除」：弹确认框 → 删掉那条订单明细行 → 局部 `splice` 掉页面上那一行。
 *
 * ⚠️ **构造顺序**：`rows` / `dialog` / `message` 都是 setup 顶层即时求值 ⇒ 三者在调用
 *    `useProgressDeleteRow(...)` **之前**必须都已声明好。传早了拿到的是 `undefined`。
 */
export function useProgressDeleteRow(deps: ProgressDeleteRowDeps) {
  // ===== 行内「删除」（§4.3）=====
  /*
   * 旧版原文（`Progress-f4bdef35.js` 反混淆后，日期列的第二个 `<span class="update-progress-link">`）：
   *
   *   onClick: async row => {
   *     await E("删除") && ElMessageBox.confirm("确定要删除这一行吗？", "提示", {
   *       confirmButtonText: "确定", cancelButtonText: "取消", type: "warning",
   *     }).then(async () => {
   *       const u = await o(); if (!u) return void ElMessage.error("无法获取用户数据")
   *       const ds = u.userinfo.ds
   *       if (row.id) {
   *         const r = await fetch("…?param1=deleteRow&param2=" + ds, {
   *           method: "POST", headers: { "Content-Type": "application/json" },
   *           body: JSON.stringify({ id: row.id, 数量: row.数量, 金额: row.金额, 安装地址: row.安装地址 }),
   *         }), j = await r.json()
   *         if (200 !== j.code) return void ElMessage.error(j.message || "删除失败")
   *       }
   *       row.图片ID && await s(row.图片ID, String(row.id))     // 顺带删门图
   *       const i = K2.value.findIndex(x => x.id === row.id)
   *       -1 !== i && K2.value.splice(i, 1)                     // ← 局部删，不重拉整表
   *       ElMessage.success("删除成功"), await ae()
   *     }).catch(() => ElMessage.info("已取消删除"))
   *   }
   *
   * ⚠️⚠️ **这一格删的不是「进度」，是整条门行**。分析文档 §4.3 把这个链接收在「删除进度」标题下、
   *    且把 `.then(...)` 省略成 `...`，只看那一节会以为它调的是 `deleteProgress` —— **不是**。
   *    它调的是 `deleteRow`（服务端 `legacy-dispatch.ts:132` 的 `deleterow` 分支：
   *    POST + 有 body ⇒ `orderServ.deleteDetailRow(ds, body.id)`，把该 `id` 的明细行从
   *    `doorSpecs` 里摘掉，并重算整单 `totalAmount` / `unpaidAmount` / `doorCount` +
   *    `financeOrder` 的 `statusText`）。**已回源码逐字核对**，别再按标题理解。
   *
   * 调什么：**新版已有等价端点**，且不是新造的 —— `DELETE /api/v1/orders/{orderId}/lines/{lineId}`
   *   （`backend/src/modules/orders/mod.rs`，`service::delete_line`：删 `order_lines` 行 +
   *   `recompute_header` 重算总价/门数/单号集）。语义与旧版 `deleteDetailRow` 对齐。
   *   ⚠️ 它挂在 **orders 模块**下，`modules/progress/` 里没有删除 handler ——
   *   「行」本来就属于订单，不是进度模块的东西。
   *   前端封装 `api.deleteOrderLine(orderId, lineId)`（`Home.vue` / `Hui.vue` 的行删除同一条）。
   *
   * 为什么用 `row.order.id` 而不是别的：进度行的 `id` 是**行** id（= `order_lines.id`），
   *   订单 id 后端挂在 `row.order.id` 上（见 `progress/service.rs` 的 `build_row`，以及
   *   `ProgressRowDto.order` 的类型注释）。
   *
   * ⚠️ **旧版那一步密码校验（`await E("删除")`）新版【刻意不做】**，理由与 `Home.vue:1605-1659`
   *    那段结论**完全相同**（那里逐条查证过 `usePasswordVerify` 的实现），别在这里另起炉灶：
   *    ① 它不是本地口令，是**拿 `<registrant>` + 明文口令去旧版生产域名换授权**
   *       （`GET https://www.samrtdoor.com.cn/1?param1=login&param2=…&param3=…`）；
   *    ② 只对**写死的 3 个租户**生效，其余租户旧版直接放行；
   *    ③ 新版后端没有对应端点，从新版发这条请求是**跨系统的对外写**。
   *    ⇒ 按本仓库既有口径**不发**，也**不补一个「看起来在验、其实验不了」的假闸门**。
   *    `Home.vue` 那处的三条候选路径（加了就一起改）记在那段 TODO 里，未拍板前保持一致。
   */
  function confirmDeleteRow(r: ProgressRowDto) {
    deps.dialog.warning({
      title: '提示',
      // 逐字照抄旧版 `ElMessageBox.confirm` 的正文与按钮文案（`type:"warning"` ⇒ 这里的 warning 弹窗）。
      content: '确定要删除这一行吗？',
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          await api.deleteOrderLine(r.order.id, r.id)
        } catch (e) {
          // 旧版：服务端回非 200 时显示它自己的 message（兜底「删除失败」），
          //       抛异常/断网才走「删除失败，请重试」。新版 `request()` 两种都抛
          //       （HTTP 错带服务端 message、断网带 fetch 的 reason）⇒ 合并成一句。
          deps.message.error(e instanceof Error ? e.message : '删除失败，请重试')
          // ⚠️ 失败时**必须 `return false`** 拦住弹窗关闭：naive 的 `onPositiveClick` 返回
          //    `false` 才不关；返回 undefined 会照关不误 —— 那样用户会以为删成功了。
          return false
        }
        // ⚠️ **局部删，不调 `refresh()`**：旧版删成功后只是把行从 `K2` 里 `splice` 掉
        //    （那份代码里**没有**重拉整表）。照抄这个表现，顺带也不会把当前页码/滚动位置抖掉。
        // 用 `splice` 而不是 `rows.value = rows.value.filter(...)`：后者会把 ref 换成**新数组**，
        // 与其它持有 `rows` 的地方脱钩（同 `Home.vue` `batchDeleteInExpand` 的注释）。
        const i = deps.rows.value.findIndex((x) => x.id === r.id)
        if (i !== -1) deps.rows.value.splice(i, 1)
        deps.message.success('删除成功')
        // 旧版这里还调了一句 `ae()`，它只重算「已选 id 列表」`le`（`ae` 的定义里就只写 `le.value`），
        // **不重拉数据**；而本页还没有行勾选 UI（`selectedRows` 恒空，见它的注释）⇒ 无对应物，
        // 不为了对齐而伪造一次调用。
      },
      // 旧版 `.catch` 的那句「已取消删除」：Element Plus 在点「取消」/点遮罩/按 Esc 时都走 catch。
      // naive 的 `onNegativeClick` 只覆盖「取消」按钮 —— 遮罩/Esc 关掉时旧版会提示、这里不会。
      // （同 `Hui.vue` 的「已取消删除」，保持全站一致；不为此加 `onClose`：那会在**确认后**
      //   也触发一次，等于删成功还弹一句「已取消删除」。）
      onNegativeClick: () => deps.message.info('已取消删除'),
    })
  }

  /*
   * 回传：本块只有这一个产出面。段外**唯一**的读者是 `columns` 里「删除」那格链接的
   * `onClick: () => confirmDeleteRow(r)`（REF 1332）⇒ 签名原样不变。
   */
  return { confirmDeleteRow }
}
