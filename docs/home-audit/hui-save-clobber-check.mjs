/*
 * 「在 Hui 里保存一次，会不会把 Home 写过的头字段抹掉」—— 实测。
 *
 * 起因：`Hui.vue:2987-2999` 的保存载荷**不含** order_no_set / install_address /
 * production_status / lock_direction；而 `orders/service.rs:456-465` 的 PUT 是
 * **整头覆盖**（无条件 `SET ... order_no_set=$11, install_address=$12,
 * production_status=$13, lock_direction=$14`），`model.rs:120-129` 那四个字段又都是
 * `#[serde(default)]` ⇒ JSON 里缺键 = 反序列化成 `""` ⇒ **被抹空**。
 *
 * 这台机器**真的发一次 PUT**（载荷逐字照抄 Hui 的），前后对比这四个字段。
 *
 * ⚠️ 只碰 `__TMP_HUIWIPE__` 的一次性订单，finally 里删干净。
 * 用法：起后端（默认 3000）后 `node docs/home-audit/hui-save-clobber-check.mjs`
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const ROOT = '/Users/aaa/Desktop/door-main'
/** Hui 界面上没有、但 Home 在写，因而**必须原样回传**的四个头字段。 */
const KEYS = ['install_address', 'order_no_set', 'production_status', 'lock_direction']

const API = `http://127.0.0.1:${process.env.E2E_PORT || '3000'}/api`
const DB = 'docker exec -i smartdoor-db psql -U smartdoor -d smartdoor -tAc'
const SQL = (q) => execSync(`${DB} ${JSON.stringify(q.replace(/\s+/g, ' '))}`).toString().trim().split('\n')[0].trim()

const CODE = '__TMP_HUIWIPE__'
const clean = () => SQL(`DELETE FROM order_lines WHERE order_id IN (SELECT id FROM orders WHERE receipt_no LIKE '\\_\\_TMP%');
                         DELETE FROM orders WHERE receipt_no LIKE '\\_\\_TMP%';`)

const login = await (
  await fetch(`${API}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }),
  })
).json()
const H = { authorization: `Bearer ${login?.data?.token || login?.token}`, 'content-type': 'application/json' }
async function call(p, opt = {}) {
  const r = await fetch(`${API}${p}`, { headers: H, ...opt })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(j)}`)
  return j?.data ?? j
}

/** Home 写过的四个头字段（用一个哨兵值，好认）。 */
const SENTINEL = {
  order_no_set: '__TMP_199-25_200-25__',
  install_address: '__TMP_安装地址__',
  production_status: '__TMP_确认生产__',
  lock_direction: '__TMP_左开__',
}

let fail = 0
const ok = (label, v) => {
  if (!v) {
    fail++
    console.log(`✗ ${label}`)
  }
}
try {
  clean()
  // ① 造一条「Home 写过」的订单（走 PATCH /orders/{id}，就是 Home 改头的那条路）
  const created = await call('/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      receipt_no: '__TMP_HUIWIPE__',
      client_code: CODE, client_name: '临时', phone: '', brand: '',
      order_date: '2026-01-01', production_days: 7, deposit: 0, remark: '', salesperson: '',
      lines: [],
    }),
  })
  const id = created.id
  await call(`/v1/orders/${id}`, { method: 'PATCH', body: JSON.stringify(SENTINEL) })

  const before = await call(`/v1/orders/${id}`)
  console.log('① Home 写完之后：')
  for (const k of Object.keys(SENTINEL)) console.log(`   ${k.padEnd(18)} = ${JSON.stringify(before[k])}`)

  // ── ② 静态断言：先把「Hui 的载荷到底带没带这四个键」钉住 ──
  // ⚠️ 别把载荷在这里手抄一份 —— 那就成了「测我自己抄的」。
  //    直接从 `Hui.vue` 源码里把 payload 字面量抠出来，断它含这四个键。
  const HUI = readFileSync(`${ROOT}/app/src/views/Hui.vue`, 'utf8')
  const payloadLit = /const payload: OrderInput = \{([\s\S]*?)\n\s*\}/.exec(HUI)?.[1] ?? ''
  ok('Hui 的 payload 字面量抠到了', payloadLit.length > 0)
  for (const k of KEYS) ok(`payload 带 ${k}`, new RegExp(`\\b${k}:`).test(payloadLit))
  // `loadOrder` 与 `resetOrder` 也要各自覆盖到，否则读回来是空、或新建单残留上次的值
  const loadFn = /async function loadOrder[\s\S]*?\n\}/.exec(HUI)?.[0] ?? ''
  const resetFn = /function resetOrder\(\)[\s\S]*?\n\}/.exec(HUI)?.[0] ?? ''
  ok('loadOrder 抠到了', loadFn.length > 0)
  ok('resetOrder 抠到了', resetFn.length > 0)
  for (const k of KEYS) {
    ok(`loadOrder 读回 ${k}`, new RegExp(`order\\.${k}\\s*=`).test(loadFn))
    ok(`resetOrder 清空 ${k}`, new RegExp(`order\\.${k}\\s*=`).test(resetFn))
  }

  // ── ③ 运行时：按 **Hui 现在真的会发** 的形状发一次 PUT ──
  const huiPayload = {
    receipt_no: before.receipt_no,
    client_code: before.client_code,
    client_name: before.client_name,
    phone: before.phone,
    brand: before.brand,
    order_date: before.order_date,
    production_days: before.production_days,
    deposit: before.deposit,
    remark: before.remark,
    salesperson: before.salesperson,
    lines: [],
  }
  for (const k of KEYS) huiPayload[k] = before[k]
  await call(`/v1/orders/${id}`, { method: 'PUT', body: JSON.stringify(huiPayload) })

  const after = await call(`/v1/orders/${id}`)
  console.log('\n② 在 Hui 里保存一次之后：')
  for (const [k, want] of Object.entries(SENTINEL)) {
    const got = after[k]
    const wiped = got === ''
    if (wiped) fail++
    console.log(`   ${wiped ? '✗ 被抹空' : '✓ 保住  '} ${k.padEnd(18)} 原 ${JSON.stringify(want)} → 现 ${JSON.stringify(got)}`)
  }

  console.log(
    fail
      ? `\n⛔ ${fail} 个字段被静默抹空 —— PUT 是整头覆盖，Hui 的载荷却缺这几个键。`
      : '\n✓ 四个字段都保住了（说明已修）',
  )
} finally {
  clean()
  console.log('\n（一次性数据已清理）')
}
process.exit(fail ? 1 : 0)
