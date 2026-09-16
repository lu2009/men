#!/usr/bin/env node
// 把**旧版**的公式挖孔图导入新系统。
//
// 背景：旧版按字符串 key 把图存在旧服务器上，key = `{formulaID}{方向}`（吊趟是 `{formulaID}左`/`右`），
// 只能按 key 精确取、**没有列表接口**（见 docs/2026-09-10-template-field-audit.md §23.3 B0）。
// 新系统存在自己库里的 `formula_images` 表，两套**没有任何同步** —— 本脚本就是那座桥。
//
// 方向对不上时就是没有（实测：公式「复古平开门」有 左锁内开、没有 左锁外开 → 404），
// 所以这里对每个候选方向逐个探测，取到 200 才导。
//
// 用法（**默认 dry-run，只看不写**；确认无误再加 --apply）：
//   LEGACY_PASSWORD='...' API_PASSWORD='...' node legacy/import-formula-images.mjs
//   ... --apply                    # 真正写入新库
//   ... --list                     # 只列出「旧版公式 ↔ 新库公式」的对照，供做映射表
//   ... --map legacy-formula-map.json
//   ... --out /tmp/hole-images     # 顺带把拉到的图落盘一份（便于核对/重跑）
//   ... --overwrite                # 同方向已存在时，先删后写（默认跳过已有）
//
// 凭据只从**环境变量**读，不接受命令行参数（避免进 shell history / 进程列表）：
//   LEGACY_PASSWORD  旧版账号密码
//   API_PASSWORD     新系统登录密码
// 其它可用环境变量：LEGACY_USER（默认 昊艺门窗）、API_USER（默认 admin）、API_BASE（默认 http://localhost:3000/api/v1）
//
// 只读旧版（全是 GET），写入只走新系统自己的 HTTP API（不直连数据库）。
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ---------- 参数 ----------
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}

const LEGACY = 'https://www.19901110.xyz:16666/1'
const LEGACY_USER = process.env.LEGACY_USER || '昊艺门窗'
const LEGACY_PASSWORD = process.env.LEGACY_PASSWORD || ''
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1'
const API_USER = process.env.API_USER || 'admin'
const API_PASSWORD = process.env.API_PASSWORD || ''

const APPLY = has('--apply')
const LIST_ONLY = has('--list')
const OVERWRITE = has('--overwrite')
const MAP_FILE = val('--map', '')
const OUT_DIR = val('--out', '')
const DELAY_MS = Number(val('--delay', '120')) // 对旧服务器客气点

// 旧版画图端（Glass_draw 锁向下拉）提供的全部方向键 —— 也就是可能存在的图键全集。
// 平开：见 legacy/js/Diao.deobfuscated.js 的 lock 下拉选项（12 个）。
// 吊趟另有一套（key 只取 左/右）。
const PING_DIRECTIONS = [
  '左锁内开', '右锁内开', '左锁外开', '右锁外开',
  '内左', '内右', '外左', '外右',
  '左固玻', '右固玻', '双开左', '双开右',
]
const DIAO_DIRECTIONS = ['左', '右']
const ALL_DIRECTIONS = [...new Set([...PING_DIRECTIONS, ...DIAO_DIRECTIONS])]

const log = (...a) => console.log(...a)
const warn = (...a) => console.error(...a)

// ---------- 旧版只读接口 ----------
async function legacyGet(params) {
  const url = `${LEGACY}?${new URLSearchParams(params)}`
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`旧版接口失败 HTTP ${r.status}：${params.param1}`)
  return r
}
async function legacyJson(params) {
  return (await legacyGet(params)).json()
}

/** 按 key 取图。取到返回 {buf, mime, name}；没有（404 / 非图片）返回 null。 */
async function legacyImage(key, registrant) {
  const url = `${LEGACY}?${new URLSearchParams({ param1: 'getimage', param2: key, param3: registrant })}`
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!r.ok) return null
  const mime = (r.headers.get('content-type') || '').split(';')[0].trim()
  if (!mime.startsWith('image/')) return null // 服务端有时用 200 回一个 JSON 错误体
  const buf = Buffer.from(await r.arrayBuffer())
  if (!buf.length) return null
  const name = r.headers.get('x-image-name') || ''
  return { buf, mime, name }
}

// ---------- 新系统 HTTP API ----------
let apiToken = ''
async function apiLogin() {
  const r = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: API_USER, password: API_PASSWORD }),
  })
  if (!r.ok) throw new Error(`新系统登录失败 HTTP ${r.status}`)
  const j = await r.json()
  apiToken = j.token || j.data?.token || ''
  if (!apiToken) throw new Error('新系统登录未返回 token')
}
async function api(path, init = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}`, ...(init.headers || {}) },
  })
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path} → HTTP ${r.status} ${(await r.text()).slice(0, 120)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

// ---------- 主流程 ----------
async function main() {
  if (!LEGACY_PASSWORD) throw new Error('缺 LEGACY_PASSWORD 环境变量（旧版账号密码）')
  if (!APPLY && !LIST_ONLY) log('ℹ️  dry-run（只看不写）。确认无误后加 --apply 真正导入。\n')

  // 1) 登录旧版
  const login = await legacyJson({ param1: 'login', param2: LEGACY_USER, param3: LEGACY_PASSWORD })
  const lu = (Array.isArray(login) ? login[0] : login)?.userinfo || {}
  const registrant = lu.registrant
  if (!registrant) throw new Error('旧版登录失败：拿不到 registrant')
  log(`旧版登录成功：${registrant}`)

  // 2) 列公式 + 判类型
  const names = (await legacyJson({ param1: 'getFormulaName', param2: registrant })).data || {}
  const ping = (await legacyJson({ param1: 'initializPing', param2: registrant })).data || {}
  const diao = (await legacyJson({ param1: 'initializDiao', param2: registrant })).data || {}

  const pingIds = new Set(Object.keys(ping.formulaType || {}))
  // 吊趟接口只按**名字**给，用 getFormulaName 反查 id
  const diaoNameList = Object.keys(diao.trackType || {})
  const diaoIds = new Set()
  for (const [id, v] of Object.entries(names)) if (diaoNameList.includes(v?.formulaName)) diaoIds.add(id)

  const legacyFormulas = Object.keys(names).map((id) => ({
    id,
    name: names[id]?.formulaName || '(无名)',
    type: pingIds.has(id) ? 'ping' : diaoIds.has(id) ? 'diao' : '',
  }))
  if (!legacyFormulas.length) throw new Error('旧版没有列出任何公式')

  // 3) 新系统：登录 + 列公式（--list 且没给新系统密码时，只列旧版那半边）
  let ourFormulas = []
  if (API_PASSWORD) {
    await apiLogin()
    ourFormulas = (await api('/formulas?limit=500')).data || []
  } else if (!LIST_ONLY) {
    throw new Error('缺 API_PASSWORD 环境变量（新系统登录密码）')
  }
  const byName = new Map(ourFormulas.map((f) => [f.name, f]))

  // 显式映射表优先（{ "旧版公式ID 或 名字": 新库公式id }）
  const explicit = new Map()
  if (MAP_FILE) {
    const raw = JSON.parse(readFileSync(MAP_FILE, 'utf8'))
    for (const [k, v] of Object.entries(raw)) explicit.set(k, Number(v))
  }
  const ourById = new Map(ourFormulas.map((f) => [f.id, f]))

  const resolve = (lf) => {
    if (explicit.has(lf.id)) return ourById.get(explicit.get(lf.id)) || { id: explicit.get(lf.id), name: '(映射表指定)' }
    if (explicit.has(lf.name)) return ourById.get(explicit.get(lf.name)) || { id: explicit.get(lf.name), name: '(映射表指定)' }
    return byName.get(lf.name) || null
  }

  // 4) --list：只打印对照
  if (LIST_ONLY) {
    log('\n旧版公式 → 新库公式 对照：')
    log('  ' + '旧版ID'.padEnd(26) + '类型'.padEnd(7) + '旧版名'.padEnd(20) + '→ 新库')
    for (const lf of legacyFormulas) {
      const hit = resolve(lf)
      log(`  ${lf.id.padEnd(26)}${(lf.type || '?').padEnd(7)}${lf.name.padEnd(20)}→ ${hit ? `#${hit.id} ${hit.name}` : '（未匹配）'}`)
    }
    log('\n未匹配的可以写一份映射表给 --map，形如 {"formula_1783091900109": 80, "35*16平开": 80}')
    return
  }

  // 5) 逐公式探测每个候选方向
  const plan = [] // {lf, ours, dir, img}
  const unmapped = []
  for (const lf of legacyFormulas) {
    const ours = resolve(lf)
    if (!ours) { unmapped.push(lf); continue }
    const dirs = lf.type === 'diao' ? DIAO_DIRECTIONS : lf.type === 'ping' ? PING_DIRECTIONS : ALL_DIRECTIONS
    for (const dir of dirs) {
      const img = await legacyImage(`${lf.id}${dir}`, registrant)
      if (img) plan.push({ lf, ours, dir, img })
      await sleep(DELAY_MS)
    }
  }

  if (!plan.length) {
    log('\n旧版没有取到任何挖孔图。')
    if (unmapped.length) log(`（另有 ${unmapped.length} 个公式在新库未匹配到，先跑 --list 看对照）`)
    return
  }

  // 6) 汇总（按新库公式分组）
  log('\n取到的图：')
  const byFormula = new Map()
  for (const p of plan) {
    if (!byFormula.has(p.ours.id)) byFormula.set(p.ours.id, [])
    byFormula.get(p.ours.id).push(p)
  }
  for (const [fid, items] of byFormula) {
    log(`  #${fid} ${items[0].ours.name}  ←  旧版「${items[0].lf.name}」`)
    for (const it of items) log(`      ${it.dir.padEnd(8)} ${String(it.img.buf.length).padStart(7)}B  ${it.img.mime}  ${it.img.name || ''}`)
  }
  if (unmapped.length) log(`\n⚠️ ${unmapped.length} 个旧版公式在新库没匹配到，已跳过：${unmapped.map((f) => f.name).join('、')}`)

  if (OUT_DIR) {
    mkdirSync(OUT_DIR, { recursive: true })
    for (const p of plan) {
      const ext = p.img.mime === 'image/png' ? 'png' : 'jpg'
      writeFileSync(join(OUT_DIR, `${p.lf.id}__${p.dir}.${ext}`), p.img.buf)
    }
    log(`\n已落盘到 ${OUT_DIR}/`)
  }

  if (!APPLY) {
    log('\nℹ️  dry-run 结束，未写入任何东西。加 --apply 执行导入。')
    return
  }

  // 7) 写入（同方向已存在则默认跳过）
  log('\n开始写入新库…')
  const existing = new Map()
  for (const fid of byFormula.keys()) {
    const rows = (await api(`/formulas/${fid}/images`)).data || []
    existing.set(fid, rows)
  }

  const report = { imported: [], skipped: [], failed: [] }
  for (const [fid, items] of byFormula) {
    const have = new Map((existing.get(fid) || []).map((r) => [r.direction, r]))
    for (const it of items) {
      try {
        const dup = have.get(it.dir)
        if (dup && !OVERWRITE) {
          report.skipped.push({ fid, dir: it.dir, reason: `已存在（image #${dup.id}）` })
          log(`  – #${fid} ${it.dir} 跳过：已存在`)
          continue
        }
        if (dup && OVERWRITE) {
          await api(`/formulas/${fid}/images/${dup.id}`, { method: 'DELETE' })
        }
        await api(`/formulas/${fid}/images`, {
          method: 'POST',
          // mirrored 一律 false：旧版服务端一个方向只存一个文件，**无法反推**它到底是原图还是镜像
          // （画一次会同时写「方向」和「左右互换方向」两个 key，后写的覆盖先写的）。
          // 新系统出单时不看这个字段，公式页的「（镜像）」标注就按 false 显示。
          body: JSON.stringify({
            direction: it.dir,
            mirrored: false,
            data_url: `data:${it.img.mime};base64,${it.img.buf.toString('base64')}`,
          }),
        })
        report.imported.push({ fid, dir: it.dir, bytes: it.img.buf.length })
        log(`  + #${fid} ${it.dir} 已导入（${it.img.buf.length}B）`)
      } catch (e) {
        report.failed.push({ fid, dir: it.dir, error: String(e.message || e) })
        warn(`  ! #${fid} ${it.dir} 失败：${e.message || e}`)
      }
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = `import-formula-images-${stamp}.json`
  writeFileSync(reportPath, JSON.stringify({ registrant, report }, null, 2))
  log(`\n完成：导入 ${report.imported.length}、跳过 ${report.skipped.length}、失败 ${report.failed.length}`)
  log(`报告：${reportPath}`)
}

main().catch((e) => {
  warn('\n✗ ' + (e.message || e))
  process.exit(1)
})
