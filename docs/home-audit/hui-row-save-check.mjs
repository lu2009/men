/*
 * 行级保存（旧版 `updateRowData`）的端到端检查 —— 打真后端。
 *
 * 为什么要这台：`app/src/api/client.ts` 的 `updateOrderLine` 注释里写着
 * 「**必须发完整行**，后端 `service::update_line` 是 45 列 SET 全字段替换，少发哪个字段就把哪一列抹空」。
 * 这句话是**从源码读出来的**，不是测出来的 —— 这个脚本把它**测出来**：
 *
 *   ① 正路：取一行 → 改一个字段 → 发**完整行** → 重新拉取 → **除了改的那个字段，其余逐字段不变**。
 *      （这一步同时验「改了能存下去」——Home 展开行能不能落库就靠它。）
 *   ② 反路：发**只带一个字段**的载荷 → 确认其余列**真的被抹空**。
 *      这条是**故意测一个危险行为**，用来钉住那句注释：证明它不是危言耸听，
 *      以后谁把 `lineInputOf(l)` 换成「只发改过的字段」，这台会立刻变红。
 *
 * 用法：起后端（默认 3000）后 `node docs/home-audit/hui-row-save-check.mjs`
 */
import { execSync } from 'node:child_process'

const API = `http://127.0.0.1:${process.env.E2E_PORT || '3000'}/api`
// 库/容器/用户可用环境变量覆盖。缺省值 = 开发库，行为与改动前**逐字相同**。
// 为什么必须能覆盖：`npm run verify` 跑在自己的 `smartdoor_verify` 库上，而这些台子原来
// 把库名写死成开发库 —— 清理用的 DELETE 拿的是**新库里的 id**，两个库的序列都从 1 开始、
// id 必然撞上 ⇒ 会删掉开发库里的真数据。
const DB = `docker exec -i ${process.env.DB_CONTAINER || 'smartdoor-db'} psql -U ${process.env.DB_USER || 'smartdoor'} -d ${process.env.DB_NAME || 'smartdoor'} -tAc`
const RUN = String(Date.now()).slice(-9)

let pass = 0
const fails = []
const eq = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++
  else fails.push(`${label}\n    期望 = ${JSON.stringify(want)}\n    实得 = ${JSON.stringify(got)}`)
}

const login = await (await fetch(`${API}/v1/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }),
})).json()
const TOKEN = login?.data?.token || login?.token
const H = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
const call = async (p, o = {}) => {
  const r = await fetch(`${API}${p}`, { headers: H, ...o })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(j)}`)
  return j?.data ?? j
}

/** 把 DTO 变成 `OrderLineInput`（= DTO 去掉 id / row_index）—— 与前端 `lineInputOf` 同形状。 */
const toInput = (l) => {
  const { id, row_index, ...rest } = l
  void id; void row_index
  return rest
}

const createdIds = []
try {
  const aLine = {
    line_type: 'ping', profile: '8888', color: '白', direction: '左开', fans: '', track: '',
    casing: '', hardware: '', bottom_glass: '5mm', face_glass: '5mm', glass_thickness: '5',
    door_width: 100, door_height: 200, light_window_height: 0, wall_thickness: 0, jiao: 0,
    mother_door_width: 0, quantity: 1, unit_price: 100, price_type: '套', discount: 1, square: 0,
    custom_square: -1, other_fee: 0, casing_price: 0, casing_amount: 0, amount: 100,
    parts: [], markup: [], formula_id: null, remark: '原文', install_address: '原址',
    open_img: '', edge_seal_count: null, seal_board_height: 0, track_length: 0,
    front_casing_add: null, back_casing_add: null, double_ding: null, light_window_count: 0,
    image_id: null, image_url: null, progress: '生产进度X', hole_size: '', line_no: '',
  }
  const order = await call('/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      receipt_no: RUN + '9', client_code: '__TMP_RS__', client_name: '临时', phone: '', brand: 'B',
      order_date: '2026-09-19', production_days: 7, deposit: 0, remark: '', salesperson: '',
      install_address: '原址', lines: [aLine, { ...aLine, remark: '第二行' }],
    }),
  })
  createdIds.push(order.id)
  const full = await call(`/v1/orders/${order.id}`)
  const [l1, l2] = full.lines
  eq('夹具：两行都建出来了', full.lines.length, 2)

  // ── ① 正路：改一个字段，发完整行 ───────────────────────────────────────
  {
    const body = toInput({ ...l1, remark: '改过的备注' })
    await call(`/v1/orders/${order.id}/lines/${l1.id}`, { method: 'PUT', body: JSON.stringify(body) })
    const after = await call(`/v1/orders/${order.id}`)
    const got = after.lines.find((x) => x.id === l1.id)
    eq('① 改的那个字段存下去了', got.remark, '改过的备注')
    // 其余字段**逐字段**比（这是全局最要命的一条：全字段替换下少发一个就抹空）
    const before = { ...l1 }
    const diffs = []
    for (const k of Object.keys(toInput(before))) {
      if (k === 'remark') continue
      if (JSON.stringify(before[k]) !== JSON.stringify(got[k])) {
        diffs.push(`${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(got[k])}`)
      }
    }
    eq('① 其余字段一个都没被改动/抹空', diffs, [])
    // 特别盯几个「旧版剔内部键会误伤」的列
    eq('① progress 没被抹空（旧版会剔「生产进度」）', got.progress, '生产进度X')
    eq('① install_address 没被抹空', got.install_address, '原址')
    // 第二行不受影响
    const other = after.lines.find((x) => x.id === l2.id)
    eq('① 同单的其它行没被牵连', other.remark, '第二行')
  }

  // ── ② 反路：只发部分字段 → 其余列被抹空（钉住 client.ts 那句注释）──────────
  {
    const after = await call(`/v1/orders/${order.id}`)
    const cur = after.lines.find((x) => x.id === l1.id)
    // 只发 profile + 数量，别的字段一律不发
    await call(`/v1/orders/${order.id}/lines/${l1.id}`, {
      method: 'PUT',
      body: JSON.stringify({ line_type: 'ping', profile: '9999', quantity: 3 }),
    })
    const got = (await call(`/v1/orders/${order.id}`)).lines.find((x) => x.id === l1.id)
    eq('② 只发部分字段时，发的那个生效了', got.profile, '9999')
    eq('② …而未发的列**真的被抹空**（remark）', got.remark, '')
    eq('② …未发的列真的被抹空（install_address）', got.install_address, '')
    eq('② …未发的列真的被抹空（progress）', got.progress, '')
    console.log(`  ⚠️ 这条**不是缺陷报告，是护栏**：证明「必须发完整行」这句话成立。`)
    console.log(`     （对照：改前 remark=${JSON.stringify(cur.remark)} / 改后 ${JSON.stringify(got.remark)}）`)
  }
} finally {
  if (createdIds.length) {
    const list = createdIds.join(',')
    execSync(
      `${DB} ${JSON.stringify(
        `DELETE FROM order_lines WHERE order_id IN (${list}); DELETE FROM orders WHERE id IN (${list});`,
      )}`,
    )
    console.log('\n（一次性数据已清理）')
  }
}

console.log(`\n行级保存对照 ${pass + fails.length} 条：通过 ${pass}，不符 ${fails.length}`)
if (fails.length) {
  fails.forEach((f) => console.log('  ✗ ' + f))
  process.exit(1)
}
