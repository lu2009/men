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

/** 文字 → canvas PNG dataURL（文字传图，仿旧版）。 */
export function textToImageDataUrl(text: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 560
  canvas.height = 320
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#c0c4cc'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)
  ctx.fillStyle = '#1f2329'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 44px sans-serif'
  // 逐行居中写（最多两行）
  const mid = canvas.height / 2
  ctx.fillText(text, canvas.width / 2, mid)
  return canvas.toDataURL('image/png')
}
