// 「编辑标签」弹窗里「位置」列的显隐开关。
//
// ⚠️ **这是有意偏离旧版**（用户 2026-09-18 拍板）。
//
// 旧版把这一列的显隐**硬编码在门店名上**：
//   `getUserData()` → `userinfo.registrant === '杉杉铝木极简门'` ⇒ 才多渲染一列「位置」
//   （`Hui.formatted.js:5954` 的 `LabelEdit`）。
// 那意味着**除这一家门店外，谁都用不到这一列**，而且换门店名就得改代码。
// 新版改成**用户可控的开关**：默认关，需要的人自己打开。
//
// 触发这次改动的直接原因：`storeAddress` 在新版数据层**根本不存在**
// （`labelRows('lable')` 不产它），所以即使门店名对上，那一列也是**恒为空**的。
// 已于本次在 `printPayloads.ts` 的 `lableRow` 里补上（取自**客户资料地址**，不是订单安装地址）。
//
// 存储照 `fixedQuantity.ts` 的同款模式：**单个裸串键**，`"1"` / `"0"`，不存 JSON。

import { QL_STORAGE_KEYS } from './profile'
import { loadRawString, saveRawString } from '../docsheet/storage'

/**
 * 读「位置」列的显隐开关。
 *
 * 缺省 / 抛错 / 非 `"1"` ⇒ **`false`（默认关）**。
 * 旧版是「门店名对上才显示」，新版反过来：**默认不显示，要的人自己开**。
 */
export function loadLocationColumnSetting(): boolean {
  return loadRawString(QL_STORAGE_KEYS.locationColumn, '') === '1'
}

/** 写开关（裸串 `"1"` / `"0"`）。返回归一化后的值，调用方应把它当新的生效值。 */
export function saveLocationColumnSetting(enabled: boolean): boolean {
  saveRawString(QL_STORAGE_KEYS.locationColumn, enabled ? '1' : '0')
  return enabled
}
