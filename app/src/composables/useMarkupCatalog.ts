import { computed, ref } from 'vue'
import { api } from '../api/client'

export interface CatalogItem {
  name: string
  price: number
  unit: string
}

// 加价项目单位（六种）。
export const MARKUP_UNITS = ['元/套', '元/支', '元/方', '元/米', '元/公分', '无']
export const markupUnitOptions = MARKUP_UNITS.map((u) => ({ label: u, value: u }))

// 加价项目目录：模块级单例（仿旧版 useAddPriceItems）。
// - 同步保存 的项来自后端（add_price_items 表，持久化）。
// - 单次添加 的项仅进 sessionOnly（内存，不持久化），刷新即失。
export const markupCatalog = ref<CatalogItem[]>([])
const sessionOnly = ref<CatalogItem[]>([])

function dedupAppend(list: CatalogItem[], item: CatalogItem): boolean {
  const dup = list.some((c) => c.name === item.name && c.price === item.price && c.unit === item.unit)
  if (dup) return false
  list.push({ ...item })
  return true
}

/** 加载后端加价项目目录（同步保存项）。 */
export async function loadMarkupCatalog() {
  try {
    const items = await api.listAddPriceItems()
    markupCatalog.value = (items || []).map((i) => ({ name: i.name, price: i.price, unit: i.unit }))
  } catch {
    // 后端不可用：保留内存中的
  }
}

/** 同步保存：写入后端（永久）并加入目录，返回是否成功。 */
export async function syncAddCatalogItem(item: CatalogItem): Promise<boolean> {
  try {
    await api.createAddPriceItem(item)
  } catch {
    // 后端失败：仍本地加，但不回落持久化
  }
  return dedupAppend(markupCatalog.value, item)
}

/** 单次添加：仅加内存（本次会话可选，不持久化）。 */
export function sessionAddCatalogItem(item: CatalogItem) {
  dedupAppend(markupCatalog.value, item)
  dedupAppend(sessionOnly.value, item)
}

/** 删除目录项（后端 + 本地）。 */
export async function removeCatalogItem(i: number) {
  const target = markupCatalog.value[i]
  if (!target) return
  markupCatalog.value.splice(i, 1)
  const si = sessionOnly.value.findIndex(
    (c) => c.name === target.name && c.price === target.price && c.unit === target.unit,
  )
  if (si >= 0) sessionOnly.value.splice(si, 1)
  try {
    const items = await api.listAddPriceItems()
    const db = items.find((x) => x.name === target.name && x.price === target.price && x.unit === target.unit)
    if (db) await api.deleteAddPriceItem(db.id)
  } catch {
    // 忽略
  }
}

// 目录候选（合并后端 + 本次单次添加）。
export const markupCatalogOptions = computed(() =>
  [...markupCatalog.value, ...sessionOnly.value.filter((s) => !markupCatalog.value.some((c) => c.name === s.name && c.price === s.price && c.unit === s.unit))].map((m, i) => ({
    label: m.name,
    value: `${i}_${m.name}`,
  })),
)
