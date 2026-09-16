import { computed, ref } from 'vue'
import { api } from '../api/client'

export interface CatalogItem {
  /** 后端 `add_price_items.id`；种子项与「单次添加」项没有 id。 */
  id?: number
  name: string
  price: number
  unit: string
}

// 加价项目单位。顺序照旧版管理弹窗的单位表 `_0x3ccc56`（`Hui.formatted.js:7995-8007`）：
//   元/套、元/方、元/公分、元/米、元/支、无
// ⚠️ 旧版**汇算页**那张表（`$t`，`:1642-1656`）是 **7 项、且 `元/方` 重复了一次**
//   （第 2 项与第 4 项 value/label 完全一样）。那是笔误 —— 两个选项选中同一个值、无任何行为差异，
//   只是下拉里多一行噪音。这里**不复制这个重复**，其余 6 项与顺序保持一致。
const MARKUP_UNITS = ['元/套', '元/方', '元/公分', '元/米', '元/支', '无']
export const markupUnitOptions = MARKUP_UNITS.map((u) => ({ label: u, value: u }))

/** 目录种子 —— 旧版 `useAddPriceItems` 模块初始化时就带这一条，**每次进页面都有**，
 *  与后端目录**去重合并**（`Hui.formatted.js:969-984`）。它本身不落库。 */
const SEED: CatalogItem = { name: '人工', price: 100, unit: '元/套' }

// 加价项目目录：模块级单例（仿旧版 useAddPriceItems）。
// - 同步保存 的项来自后端（add_price_items 表，持久化）。
// - 单次添加 的项仅进 sessionOnly（内存，不持久化），刷新即失。
//
// ⚠️ 本模块是**模块级单例、拿不到组件上下文**，所以这里一律**不弹提示**，
// 改由调用方（Hui.vue，持有 useMessage）按返回值弹。
export const markupCatalog = ref<CatalogItem[]>([{ ...SEED }])
const sessionOnly = ref<CatalogItem[]>([])

function sameItem(a: CatalogItem, b: CatalogItem): boolean {
  return a.name === b.name && a.price === b.price && a.unit === b.unit
}

function dedupAppend(list: CatalogItem[], item: CatalogItem): boolean {
  if (list.some((c) => sameItem(c, item))) return false
  list.push({ ...item })
  return true
}

/** 加载后端目录并**去重合并**（不动种子）；失败返回 false（旧版此时弹「初始化失败」，`Hui.formatted.js:979`）。 */
export async function loadMarkupCatalog(): Promise<boolean> {
  try {
    const items = await api.listAddPriceItems()
    for (const i of items || []) {
      const row: CatalogItem = { id: i.id, name: i.name, price: i.price, unit: i.unit }
      if (!dedupAppend(markupCatalog.value, row)) {
        // 已存在（多为与种子重合的那条）→ 补上后端 id，后续改/删才能走 id
        const hit = markupCatalog.value.find((c) => sameItem(c, i))
        if (hit && hit.id == null) hit.id = i.id
      }
    }
    return true
  } catch {
    return false
  }
}

/** 同步保存：写后端（永久）并加入目录。后端失败时仍本地加，返回 false。 */
export async function syncAddCatalogItem(item: CatalogItem): Promise<boolean> {
  const ok = dedupAppend(markupCatalog.value, item)
  if (!ok) return false
  try {
    const created = await api.createAddPriceItem({ name: item.name, price: item.price, unit: item.unit })
    const hit = markupCatalog.value.find((c) => sameItem(c, item))
    if (hit && created?.id != null) hit.id = created.id
    return true
  } catch {
    return false
  }
}

/** 单次添加：仅加内存（本次会话可选，不持久化）。返回 false 表示目录里已有。 */
export function sessionAddCatalogItem(item: CatalogItem): boolean {
  const ok = dedupAppend(markupCatalog.value, item)
  if (ok) dedupAppend(sessionOnly.value, item)
  return ok
}

/** 修改目录项。有 id 的走后端 `PUT`；无 id 的（种子 / 单次添加）只改内存。 */
export async function updateCatalogItem(index: number, next: CatalogItem): Promise<boolean> {
  const cur = markupCatalog.value[index]
  if (!cur) return false
  if (cur.id != null) {
    try {
      await api.updateAddPriceItem(cur.id, { name: next.name, price: next.price, unit: next.unit })
    } catch {
      return false
    }
  }
  markupCatalog.value[index] = { id: cur.id, name: next.name, price: next.price, unit: next.unit }
  return true
}

/** 删除目录项（后端 + 本地）。无 id 的只删内存。 */
export async function removeCatalogItem(i: number): Promise<boolean> {
  const target = markupCatalog.value[i]
  if (!target) return false
  markupCatalog.value.splice(i, 1)
  const si = sessionOnly.value.findIndex((c) => sameItem(c, target))
  if (si >= 0) sessionOnly.value.splice(si, 1)
  if (target.id == null) return true
  try {
    await api.deleteAddPriceItem(target.id)
    return true
  } catch {
    return false
  }
}

// 目录候选（合并后端 + 本次单次添加）。
export const markupCatalogOptions = computed(() =>
  [
    ...markupCatalog.value,
    ...sessionOnly.value.filter(
      (s) => !markupCatalog.value.some((c) => sameItem(c, s)),
    ),
    // option label 照旧版：`名称 + " " + price + unit`（如 `人工 100元/套`，Hui.formatted.js:2512）
  ].map((m, i) => ({ label: `${m.name} ${m.price}${m.unit}`, value: `${i}_${m.name}` })),
)
