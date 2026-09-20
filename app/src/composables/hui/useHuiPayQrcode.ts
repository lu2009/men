/**
 * 「收款码」（原版 `getImage('qrcode')`）—— 2026-09-20 从 `Hui.vue` 搬出（逻辑逐字未改，C3）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）是**一段**：`Hui.vue:810-848`（含 6 行原版考据注释），
 * 段内 **6 个声明**：`PAY_QRCODE_KEY` / `payQrcodeUrl` / `loadPayQrcode` / `payQrcodeOpen` /
 * `pickPayQrcode` / `removePayQrcode`。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C3 一条）。
 *
 * ## 注入面 = **1 项**
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `message` | 页面 `useMessage()` | 上传/删除收款码的成败提示 |
 *
 * `idbGetImage` / `idbPutImage` / `idbRemoveImage` / `fileToDataUrl` 是模块级单例
 * （`utils/imageStore`）⇒ 新家直接 `import`，**不注入**。
 *
 * ## 回传面 = **5 项**（2026-09-20 逐条实测）
 *
 * | 名字 | 段外的活读者 |
 * |---|---|
 * | `payQrcodeUrl` | 模板 `:477`/`:478`（`v-if`/`:src`）· `:483`/`:484`（按钮文案与 `:disabled`）· **`:1935` 打印载荷 `payQrcode: payQrcodeUrl.value`** |
 * | `payQrcodeOpen` | 模板 `:470`（`v-model:show`）· `:490`（**写**）· **`onMoreSelect` 的 `case 'payQrcode'`** |
 * | `loadPayQrcode` | `onMounted` 预载（`:1948`） |
 * | `pickPayQrcode` / `removePayQrcode` | 模板 `:483`/`:484` 的 `@click` |
 *
 * ⚠️ **`payQrcodeOpen` 必须回传**（spec §3.3 点名的雷）：写它的有两处 —— 模板 `:490` 与
 *    `onMoreSelect` 的 `case 'payQrcode'`。少回传这一个 ⇒ 菜单里点「收款码」**没反应**，
 *    而类型、构建、守卫**全都不会报**。
 * ⚠️ **`PAY_QRCODE_KEY` 不回传**：段外零命中（只在本块的三个函数里用），解构出来就是 TS6133。
 */
import { ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { fileToDataUrl, idbGetImage, idbPutImage, idbRemoveImage } from '../../utils/imageStore'

/** `useHuiPayQrcode()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HuiPayQrcodeDeps {
  /** 页面 `useMessage()`。 */
  message: MessageApi
}

/** 收款码：IndexedDB 固定键存图 + 设置弹窗 + 上传/删除。 */
export function useHuiPayQrcode(deps: HuiPayQrcodeDeps) {
  // 收款码（原版 `getImage('qrcode')`）：
  //   原文 @5345 从服务端拉图后 `y.images.put({ id:'qrcode', imageBlob:r })` —— **缓存到本地 images 表**；
  //   读取见 `index-c3b16e3f.js` 的 `L` @3999：`if (id === 'qrcode') return { imageUrl: await I(n.imageBlob) }`
  //   （token 494='qrcode'、462='imageBlob'、497='imageUrl'，均已解码确认）。
  // 我们无服务端图片库，但那半边的本地缓存与我们的 `imageStore`（IndexedDB 按 id 存）完全同构，
  // 故用**固定键 'qrcode'** 存/取即可。
  const PAY_QRCODE_KEY = 'qrcode'
  const payQrcodeUrl = ref('')
  async function loadPayQrcode() {
    try {
      payQrcodeUrl.value = (await idbGetImage(PAY_QRCODE_KEY)) || ''
    } catch {
      payQrcodeUrl.value = ''
    }
  }
  const payQrcodeOpen = ref(false)
  function pickPayQrcode() {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.onchange = async () => {
      const f = inp.files?.[0]
      if (!f) return
      try {
        const url = await fileToDataUrl(f)
        await idbPutImage(PAY_QRCODE_KEY, url)
        payQrcodeUrl.value = url
        deps.message.success('已上传收款码')
      } catch (e) {
        deps.message.error(e instanceof Error ? e.message : '上传收款码失败')
      }
    }
    inp.click()
  }
  async function removePayQrcode() {
    await idbRemoveImage(PAY_QRCODE_KEY)
    payQrcodeUrl.value = ''
    deps.message.success('已删除收款码')
  }
  return {
    // 5 项回传 —— 逐条的段外活读者见文件头那张表（`payQrcodeOpen` 那条最容易漏）。
    payQrcodeUrl,
    payQrcodeOpen,
    loadPayQrcode,
    pickPayQrcode,
    removePayQrcode,
    // 不回传 `PAY_QRCODE_KEY`：段外零命中（只有本块三个函数用它）。
  }
}
