// 明细表的**页面级弹窗**状态与逻辑 —— 新增加价项目 / 修改平方数 / 门图预览 / 门图名字。
//
// ## 为什么单独一个文件
//
// 明细表组件化（`components/DetailLinesTable.vue`）之后，它的 `hooks` 里这几个回调
// **Hui 页和 Home 展开行都要有**。原先它们内联在 Hui.vue 的 `<script setup>` 里，
// Home 拿不到；照抄一份又迟早漂。⇒ 抽成工厂，两边各调一次。
//
// 弹窗的**模板**在 `components/DetailLineDialogs.vue`（与本文件配套：状态在这，壳在那）。
//
// ⚠️ 逻辑**逐字搬迁**自 Hui.vue（2026-09-19），只把闭包依赖改成参数注入。
//    搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核。

import { reactive, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import {
  markupCatalog,
  sessionAddCatalogItem,
  syncAddCatalogItem,
} from './useMarkupCatalog'
import { round2, type Line } from '../utils/partsEngine'
import { fileToDataUrl, genImageId, idbPutImage, idbRemoveImage, textToImageDataUrl } from '../utils/imageStore'

/** 自定义方数：空/NaN → -1（自动），其余保留小数，不因 clamp 丢失 -1 哨兵。 */
export function sanitizeCustomSquare(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v as number)) return -1
  if (v === -1) return -1
  return Math.max(-1, round2(v as number))
}

export interface DetailLineDialogsDeps {
  /** 行变了要重算（引擎的 `lineRefresh`）。 */
  lineRefresh: (l: Line) => void
}

export function useDetailLineDialogs(deps: DetailLineDialogsDeps) {
  const lineRefresh = deps.lineRefresh
  const message = useMessage()
  const dialog = useDialog()

  // ===== 新增加价项目（仿旧版：加价项目名/单价/计价方式 + 取消/单次添加/同步保存）=====
  const addMarkupOpen = ref(false)
  const addMarkupTarget = ref<Line | null>(null)
  const addMarkupForm = reactive({ name: '', price: 0, unit: '元/套' })

  function openAddMarkup(l: Line) {
    addMarkupTarget.value = l
    addMarkupForm.name = ''
    addMarkupForm.price = 0
    addMarkupForm.unit = '元/套'
    addMarkupOpen.value = true
  }

  /**
   * 提交「新增加价项目」弹窗（旧版 `ea`，Hui.formatted.js:1657-1690）。
   *
   * 关键：**先去重目录，通过了才挂到当前行**。目录里已有的项走多选下拉选，不走这里 ——
   * 所以重复时原版是 `加价项目已存在！` 且**弹窗不关**、行上也不加。
   * `同步保存`(sync=true) 额外 POST `addAddPrice` 并提示成败；`单次添加`(false) 只进内存、不提示。
   */
  async function submitAddMarkup(sync: boolean) {
    const name = addMarkupForm.name.trim()
    if (!name) {
      message.warning('请输入加价项目名称')
      return
    }
    const price = Number(addMarkupForm.price)
    if (addMarkupForm.price == null || Number.isNaN(price)) {
      message.warning('请输入有效单价')
      return
    }
    const unit = addMarkupForm.unit || '元/套'
    // 原版校验：`unit !== '元/套' && Number(t) < 0` → 报错（元/套 允许负数）
    if (unit !== '元/套' && price < 0) {
      message.warning('除元/套外，单价必须大于等于0')
      return
    }
    const l = addMarkupTarget.value
    if (!l) return

    const item = { name, price, unit }
    if (markupCatalog.value.some((c) => c.name === name && c.price === price && c.unit === unit)) {
      message.warning('加价项目已存在！') // 不关窗、不加到行上（原版如此）
      return
    }
    const ok = sync ? await syncAddCatalogItem(item) : sessionAddCatalogItem(item)
    if (sync && !ok) message.error('加价项目添加失败')
    else if (sync) message.success('加价项目添加成功')

    l.markup = l.markup ?? []
    l.markup.push({ ...item, amount: 0 })
    lineRefresh(l)
    addMarkupOpen.value = false
  }

  /** 单次添加：只进内存目录（本次会话可选，不持久化）。 */
  function addMarkupOnce() {
    void submitAddMarkup(false)
  }

  /** 同步保存：写后端持久化目录（永久，其它行/之后可选）。 */
  async function addMarkupSync() {
    await submitAddMarkup(true)
  }

  // ===== 修改平方数（平方单元格右键，仿旧版）=====
  const squareDialog = ref(false)
  const squareTarget = ref<Line | null>(null)
  // 空 = 未填（旧版输入框初值就是空串 `Mt=Vue.ref("")`，`Hui.formatted.js:4386`）。
  // 确认时为空 → 回到「自动」（custom_square = -1）。
  const squareInput = ref<number | null>(null)

  function openSquareDialog(l: Line) {
    squareTarget.value = l
    squareInput.value = l.custom_square >= 0 ? l.custom_square : null
    squareDialog.value = true
  }

  function confirmSquare() {
    if (squareTarget.value) {
      squareTarget.value.custom_square = sanitizeCustomSquare(squareInput.value)
      lineRefresh(squareTarget.value)
    }
    squareDialog.value = false
  }

  // ===== 门花图（行图片）：传图/文字传图/预览/删除 =====
  const previewImg = ref<string | null>(null)
  const previewOpen = ref(false)
  const textImgOpen = ref(false)
  const textImgName = ref('')
  const textImgTarget = ref<Line | null>(null)

  function previewImage(url: string) {
    previewImg.value = url
    previewOpen.value = true
  }

  async function applyDoorImg(l: Line, dataUrl: string) {
    const id = genImageId()
    l.image_id = id
    l.image_url = dataUrl
    await idbPutImage(id, dataUrl)
  }

  function pickDoorImg(l: Line) {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.onchange = async () => {
      const f = inp.files?.[0]
      if (!f) return
      try {
        const url = await fileToDataUrl(f)
        await applyDoorImg(l, url)
        message.success('已上传门图')
      } catch (e) {
        message.error(e instanceof Error ? e.message : '上传图片失败')
      }
    }
    inp.click()
  }

  function removeDoorImg(l: Line) {
    dialog.warning({
      title: '删除门图',
      content: '确定删除该行的门图吗？',
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        if (l.image_id) await idbRemoveImage(l.image_id)
        l.image_id = null
        l.image_url = null
      },
    })
  }

  function openTextImg(l: Line) {
    textImgTarget.value = l
    textImgName.value = ''
    textImgOpen.value = true
  }

  function confirmTextImg() {
    const l = textImgTarget.value
    const name = textImgName.value.trim()
    textImgOpen.value = false
    if (!l || !name) return
    if (name.length > 24) {
      message.warning('门图名字最多 24 个字')
      return
    }
    void applyDoorImg(l, textToImageDataUrl(name)).then(() => message.success('已生成文字门图'))
  }

  return {
    // 加价
    addMarkupOpen, addMarkupTarget, addMarkupForm, openAddMarkup, addMarkupOnce, addMarkupSync,
    // 平方数
    squareDialog, squareTarget, squareInput, openSquareDialog, confirmSquare,
    // 门图
    previewImg, previewOpen, textImgOpen, textImgName, textImgTarget,
    previewImage, pickDoorImg, removeDoorImg, openTextImg, confirmTextImg,
  }
}

export type DetailLineDialogs = ReturnType<typeof useDetailLineDialogs>
