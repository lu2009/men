// 门图（行图片）IndexedDB 存取：以图片ID 为键存 dataURL 字符串。
// 行同时把 dataURL 落库到 order_lines.image_url（供打印/预览持久化），IDB 作为回退源。
const DB_NAME = 'smartdoor_images'
const STORE = 'images'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    } catch (e) {
      reject(e)
    }
  })
  return dbPromise
}

function tx(mode: IDBTransactionMode) {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE))
}

export async function idbPutImage(id: string, dataUrl: string): Promise<void> {
  try {
    const s = await tx('readwrite')
    s.put(dataUrl, id)
  } catch {
    // 忽略（隐私模式/IndexedDB 不可用）：仍以落库的 image_url 兜底
  }
}

export async function idbGetImage(id: string): Promise<string | null> {
  try {
    const s = await tx('readonly')
    return await new Promise((resolve) => {
      const r = s.get(id)
      r.onsuccess = () => resolve(typeof r.result === 'string' ? r.result : null)
      r.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function idbRemoveImage(id: string): Promise<void> {
  try {
    const s = await tx('readwrite')
    s.delete(id)
  } catch {
    // 忽略
  }
}

/** 生成不依赖 Date.now 的长 ID（前端运行期可用）。 */
export function genImageId(): string {
  return 'img_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** File → dataURL（前端 FileReader）。 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error ?? new Error('读取图片失败'))
    fr.readAsDataURL(file)
  })
}

/**
 * 文字传图：门图名字 → canvas PNG dataURL。
 *
 * **逐字照抄旧版**（`Hui.formatted.js:1193-1215` 的 `ct()`，常量 `fontSize$1=118` /
 * `lineHeight$1=145` 定义在同文件 `:576`）：
 *
 * ```js
 * canvas.width = 700; canvas.height = 800
 * ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 700, 800)
 * ctx.fillStyle = '#000000'
 * ctx.font = 'bold 118px Arial, sans-serif'
 * ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
 * for (let r = 0; r < 名字.length; r += 6) 每 6 个字切一行
 * 起始 y = (800 - 行数 * 145) / 2 + 145 / 2        // 整体垂直居中
 * 第 i 行 y = 起始y + i * 145；x = 350（= 700/2）
 * ```
 *
 * ⚠️ 旧版是 **700×800、字高 118、每 6 字换行、无边框**。
 * 我们原来写的是 560×320、44px、**不换行**、还多描了一圈 `#c0c4cc` 边框 —— 全都对不上。
 * 700×800 是**竖版**（接近门板比例），560×320 是横版，这是最明显的观感差异。
 */
export function textToImageDataUrl(text: string): string {
  const W = 700
  const H = 800
  const FONT_SIZE = 118
  const LINE_HEIGHT = 145
  const PER_LINE = 6

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#000000'
  ctx.font = `bold ${FONT_SIZE}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const lines: string[] = []
  for (let r = 0; r < text.length; r += PER_LINE) lines.push(text.slice(r, r + PER_LINE))

  const startY = (H - lines.length * LINE_HEIGHT) / 2 + LINE_HEIGHT / 2
  lines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * LINE_HEIGHT))
  return canvas.toDataURL('image/png')
}
