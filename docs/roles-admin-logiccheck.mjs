/*
 * 「`'admin'` 字面量只准出现在 `utils/roles.ts` 一处」的守卫台。
 *
 * ## 它守的是什么
 *
 * 2026-09-19 做了一次收编：`Home.vue` 三处 `auth.user?.role !== 'admin'` 与
 * `Formulas.vue` 两处 `!== 'admin'` 全部改成走 `utils/roles.ts` 的 predicate。
 * 这次收编**不改任何行为**，所以光靠「页面看着还对」证明不了什么 ——
 * 要钉的是两件事：
 *
 *   ① **等价**：新 predicate 与**改动前的内联写法**对每一个 role 值都同义。
 *      最容易写错的是 `undefined` 那一档（`undefined !== 'admin'` 为真 ⇒ 按「只看自己」渲染），
 *      把 `!canSeeAllOrders(role)` 手滑写成 `canSeeAllOrders(role)` 在**只有 admin 账号**的
 *      环境里**完全看不出来**（admin 两种写法都是「看全量」）。
 *   ② **唯一出处**：`app/src/views/**` 与其它 utils 里不再出现这个字面量 ——
 *      否则下次改 role 取值时，漏改的那一处会静默地永远不成立。
 *
 * ⚠️ **这台不覆盖的东西**：
 *   1. **页面渲染**。这里只验判定函数与**源码形状**，不挂载组件。
 *      三处调用点的**上下文**（在 `filtered` 里、在 `submitMore` 里、在看板 computed 里）
 *      是不是接对了，靠人读 —— 源码守卫只能保证「写的是那个名字」。
 *   2. **后端授权**。这全是前端；改一行 JS 就能绕过，见 `utils/roles.ts` 抬头。
 *
 * ⚠️ 源码守卫读的是 `src/`，**不是 `dist/`** —— 压缩会把标识符改名，
 *    在生产产物里 grep 函数名毫无意义（本项目栽过）。
 *
 * 用法：node docs/roles-admin-logiccheck.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const APP = resolve(ROOT, 'app')
const ROLES_TS = resolve(APP, 'src/utils/roles.ts')

let pass = 0
const failures = []
function check(ok, name) {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(name)
    console.log(`  ✗ ${name}`)
  }
}

// ---------------------------------------------------------------- 载入真代码 //
const require = createRequire(resolve(APP, 'package.json'))
const esbuild = require('esbuild')
const OUT = join(tmpdir(), `roles-admin-check-${process.pid}.mjs`)
writeFileSync(
  OUT,
  esbuild.transformSync(readFileSync(ROLES_TS, 'utf8'), {
    loader: 'ts',
    format: 'esm',
    charset: 'utf8',
  }).code,
)
const roles = await import(OUT + `?v=${process.pid}`)

// ------------------------------------------------------------------ ① 等价 //
/*
 * 「改动前的内联写法」逐字抄在这里当**参照实现** —— 不是从源码里 grep 出来的，
 * 是当时那两行本身：`auth.user?.role !== 'admin'` ⇔ `!(role === 'admin')`。
 * `role` 为 `null`/`undefined` 时 `role === 'admin'` 为假 ⇒ 参照结果 `true`（按「只看自己」渲染）。
 */
const 旧写法_只看自己 = (role) => role !== 'admin'
const 旧写法_看到全量 = (role) => role === 'admin'

/** 覆盖到每一档：两档真账号、若干「不该出现但可能出现」的值、以及未加载那一档。 */
const ROLES = [
  ['admin', '租户管理员 —— 唯一「看全量」的角色'],
  ['scanner', '扫码账号'],
  ['staff', '遗留默认值（迁移 0023 已改掉，但库里万一还残留）'],
  ['Admin', '大小写不同 —— **不是** admin'],
  ['', '空串'],
  ['  admin  ', '带空白 —— **不是** admin'],
  [null, '未登录 / 未知'],
  [undefined, 'role 还没读到的瞬间（守卫补 /me 之前）'],
]

console.log('① 新 predicate 与改动前的内联写法逐档同义')
for (const [role, why] of ROLES) {
  const tag = `${JSON.stringify(role)}（${why}）`
  const 想看到全量 = 旧写法_看到全量(role)
  check(roles.isAdmin(role) === 想看到全量, `isAdmin(${tag}) = ${想看到全量}`)
  check(roles.canSeeAllOrders(role) === 想看到全量, `canSeeAllOrders(${tag}) = ${想看到全量}`)
  // 调用点的实际形状：`if (!canSeeAllOrders(role)) 只留自己的` ⇔ 旧版 `if (role !== 'admin') 只留自己的`
  check(
    !roles.canSeeAllOrders(role) === 旧写法_只看自己(role),
    `!canSeeAllOrders(${tag}) = ${旧写法_只看自己(role)}（只看自己那一支）`,
  )
}

console.log('\n② 三个判定今天同源，但**各自独立**可改')
for (const [role] of ROLES) {
  // 同源：现在三者恒等。哪天某一条改了口径，这里会红 —— 那时**别改断言**，
  // 先想清楚是不是真要让另一条跟着动（口径分别来自 defaulted===1 与 qt）。
  check(
    roles.canEditProcedures(role) === roles.isAdmin(role) &&
      roles.canSeeAllOrders(role) === roles.isAdmin(role),
    `三条判定在 ${JSON.stringify(role)} 上一致`,
  )
}
check(roles.ADMIN_ROLE === 'admin', "ADMIN_ROLE 就是 'admin'")

// -------------------------------------------------------------- ③ 源码守卫 //
console.log('\n③ 源码守卫：字面量只剩一处、三处调用点接对了')

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|vue)$/.test(p)) out.push(p)
  }
  return out
}

const SRC = resolve(APP, 'src')
const ADMIN_LITERAL = /(['"])admin\1/
const offenders = []
for (const f of walk(SRC)) {
  if (resolve(f) === resolve(ROLES_TS)) continue
  const src = readFileSync(f, 'utf8')
  // 只看**代码**：注释里提 `'admin'` 是在解释口径，不算出处（`Qrscanner.vue` 就有这种注释）。
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '')
  if (ADMIN_LITERAL.test(code)) offenders.push(f.replace(ROOT + '/', ''))
}
check(
  offenders.length === 0,
  `除 utils/roles.ts 外没有 'admin' 字面量${offenders.length ? ` —— 违规：${offenders.join(', ')}` : ''}`,
)

const HOME = readFileSync(resolve(SRC, 'views/Home.vue'), 'utf8')
const FORMULAS = readFileSync(resolve(SRC, 'views/Formulas.vue'), 'utf8')
/*
 * 2026-09-20 Task 5：Home 的第一块**页面代码**搬出了页面 —— 看板那处 `dashboardOrders`
 * 现在住在 `composables/home/useHomeData.ts`（B1）。
 *
 * ⚠️ 两件事必须**同时**做，**只做前一件台子照样红**（实测，见 `task-5-report.md` §3）：
 *   ① **被数源扩到新家**（下面这份 `DATA`）；
 *   ② **正则放宽到能吃 `deps.` 前缀** —— 搬走时那条注入改写
 *      （`auth.user?.` → `deps.auth.user?.`，登记在 `home-extract-movecheck.mjs` 的 B1 块）
 *      把那行的字面改成了 `canSeeAllOrders(deps.auth.user?.role)`，老正则数不到它。
 *
 * ⚠️ **断言仍是 `=== 3`（跨两份源数）** —— **不许**降成 2：那是把「查三处」降级成
 *    「查剩下的」，越搬越松。
 * ⚠️ `homeNegated`（`!canSeeAllOrders(`，下面那条）**那笔不动**：那两处（主表 `filtered` /
 *    「查询更多」`submitQuery`）都还留在页面，而看板这处是三元、本来就没有 `!`。
 *    等 Task 6 / Task 8 分别搬走它们时，再按同法把被数源跨到各自的新家。
 *
 * 2026-09-20 **Task 8**：「查询更多」那块（B5）搬到了 `composables/home/useHomeQueryMore.ts`，
 * 它带着上面说的**两处之一**走：
 *   · 那处 `!canSeeAllOrders(auth.user?.role)`（`REF:1327`）**从 `Home.vue` 挪到了新家**，
 *     且搬迁的注入改写（`auth.user?.` → `deps.auth.user?.`）把字面也改了；
 *   · ⇒ **两条断言的被数源都要跨到新家**（下面这份 `MORE`）。
 *     `homeCalls` 的 `(?:deps\.)?` 是 Task 5 放宽的，**本笔不再动正则**；
 *     `homeNegated` 的正则（`/!\s*canSeeAllOrders\(/`）**本来就不含 `auth`** ⇒ 只加源。
 *
 * ⚠️ **断言数字 `3` / `2` 一个字都没改** —— 这是**跨三份源**数的结果，不是降级。
 *    只加源、不改数，是这类搬迁唯一允许的做法：`npm run verify` 里这两条一旦变松，
 *    「Home 三处都还在」就再没人看着了。
 *    实测（本笔）：不加源时两条**同时报红**（`实际 2` / `实际 1`），加源后回绿 —— 见 `task-8-report.md` §3。
 */
const DATA = readFileSync(resolve(SRC, 'composables/home/useHomeData.ts'), 'utf8')
/** 2026-09-20 Task 8 起：`submitQuery` 那处 `canSeeAllOrders` 的**新家**（同样要数）。 */
const MORE = readFileSync(resolve(SRC, 'composables/home/useHomeQueryMore.ts'), 'utf8')
/** 2026-09-20 Task 6 起：主表 `filtered` 那处 `canSeeAllOrders` 的**新家**（同样要数）。 */
const FILTER = readFileSync(resolve(SRC, 'composables/home/useHomeFilterView.ts'), 'utf8')

/*
 * ⚠️ **2026-09-20 终审修复轮：下面两条断言的「被数源」从手工名单换成 `walk(SRC)` 全目录。**
 *
 * 原来数的是 `HOME + DATA + MORE + FILTER` 这四份**手工维护的名单**。
 * 它在「**搬走**」方向是**变严**的（再搬出一处就报红，数字没松）——
 * 但它把「整个 `app/src`」这个**结构性全集**换成了名单
 * ⇒ **新增第 5 个调用点会静默绿**：那正是搬迁守卫「看不住新增」的毛病传染到了台子上。
 * 换成全目录之后：**搬家免疫**（搬去哪都还在 `app/src` 里）、**新增也免疫**。
 * 排除 `utils/roles.ts` —— 那是**定义**所在、不是调用点，与上面「`'admin'` 字面量」那条同一个排除法
 * （`resolve(f) === resolve(ROLES_TS)`，见 `:129`）。
 *
 * ⚠️ **断言数字 `3` / `2` 一个字都没改** —— 这是**加固**，不是放宽。
 * 实测今天全目录数的结果与那四份名单**恰好相同**（3 / 2）：含 `canSeeAllOrders(` 的文件
 * 只有 `useHomeData.ts` / `useHomeFilterView.ts` / `useHomeQueryMore.ts` 三个（各 1 次），
 * 带 `!` 的是后两个（各 1 次），`Home.vue` 自 Task 6 起贡献 **0**。
 * ⇒ 换的只是被数文本的**来路**，判据没动。
 */
const APP_SRC = (() => {
  let all = ''
  for (const f of walk(SRC)) {
    if (resolve(f) === resolve(ROLES_TS)) continue
    all += '\n' + readFileSync(f, 'utf8')
  }
  return all
})()

// Home 三处：主表 filtered / 「查询更多」落地 / 看板 computed。
// 三处**已经各自归位**：看板 → useHomeData.ts（Task 5）、查询更多 → useHomeQueryMore.ts（Task 8）、
// 主表 filtered → useHomeFilterView.ts（Task 6）。
// ⚠️ **Task 6 之后 `Home.vue` 自己贡献 0 处命中** —— 但**仍要把它留在被数源里**：
//    它还有别的角色相关代码，而且「三处必须都在」这件事要靠这个和数看着。
// 数**调用次数**而不是锚定某一行 —— 行号会漂，次数不会。
const homeCalls = APP_SRC.match(/canSeeAllOrders\(\s*(?:deps\.)?auth\.user\?\.role\s*\)/g)?.length || 0
check(
  homeCalls === 3,
  `app/src 全目录（排除 utils/roles.ts 的定义）里 canSeeAllOrders(auth.user?.role) 出现 3 次（实际 ${homeCalls}）`,
)
/*
 * ⚠️ **这条在 Task 6 之前是「`Home.vue` 导入了 `canSeeAllOrders`」**（只查页面那一个文件），
 *    Task 6 之后**它在 `Home.vue` 里再也用不到**了 —— 主表 `filtered` 搬走后，页面里
 *    `canSeeAllOrders` 的**代码命中归零**，只剩 `import` 一行。
 *    而 `vue-tsc` 的 **TS6133** 会把「导入了却没用」直接判红 ⇒ `npm run build` 红 ⇒ `npm run verify` 红。
 *    **两条要求（「必须导入」与「不许导入未使用」）在同一个文件上不可同时满足** ⇒
 *    只能把这条断言**从「页面导入」泛化成「凡用到它的那一块都导入」**（语义更强，不是放水）：
 *    任何一份被数源里出现 `canSeeAllOrders(` 的，就必须有对应的 `utils/roles` 导入。
 *    这**不是**「为了让闸变绿而改夹具」—— 原断言已不可满足，且新断言覆盖的事比原来多。
 *    ⚠️ 路径前缀写成 `(?:\.\.\/)+`：`Home.vue` 用 `../utils/roles`，三个子模块用 `../../utils/roles`。
 *    ⚠️ 引号两种都收（`['"]`）：这条问的是「**导没导入**」，不是「引号风格」——
 *       写成只收单引号的话，一个用双引号的合法文件会被报成「缺导入」，那是一句**误导人的**报错。
 *       （2026-09-20 实测踩到过：Task 8 的新文件当时 8 条 import 全是双引号，
 *        这条断言报「缺：useHomeQueryMore.ts」，查下去才发现是引号问题不是导入问题。
 *        同笔把那 8 条改成单引号对齐仓库风格，但**正则仍然两种都收** —— 判据不该依赖风格。）
 */
const IMPORT_RE = /import(?:\s+type)?\s*\{[^}]*\bcanSeeAllOrders\b[^}]*\}\s*from\s*['"](?:\.\.\/)+utils\/roles['"]/
const ROLE_SOURCES = [
  ['Home.vue', HOME],
  ['useHomeData.ts', DATA],
  ['useHomeQueryMore.ts', MORE],
  ['useHomeFilterView.ts', FILTER],
]
const missingImport = ROLE_SOURCES.filter(([, src]) => src.includes('canSeeAllOrders(') && !IMPORT_RE.test(src))
check(
  missingImport.length === 0,
  `凡用到 canSeeAllOrders 的 Home 子模块都从 utils/roles 导入它${
    missingImport.length ? ` —— 缺：${missingImport.map(([n]) => n).join(', ')}` : ''
  }`,
)
// 两支各自的形状：`!canSeeAllOrders(...)` 两次（filtered + submitQuery），
// 看板是三元 `canSeeAllOrders(...) ? 全量 : filter`（**没有** `!`）。写反了这里会红。
// ⚠️ 这条的源也要含 `MORE`（Task 8）与 `FILTER`（Task 6）—— 两处带 `!` 的都搬走了
//    （正则不含 `auth`，所以只是加源，数字不动）。
const homeNegated = (APP_SRC.match(/!\s*canSeeAllOrders\(/g) || []).length
check(
  homeNegated === 2,
  `app/src 全目录（排除 utils/roles.ts 的定义）里 !canSeeAllOrders( 出现 2 次（实际 ${homeNegated}）`,
)

check(
  /const isAdminUser = computed\(\(\) => isAdmin\(auth\.user\?\.role\)\)/.test(FORMULAS),
  'Formulas.vue 的 isAdminUser 走 utils/roles 的 isAdmin',
)
const formulaBtns = (FORMULAS.match(/v-if="isAdminUser"/g) || []).length
check(formulaBtns === 2, `Formulas.vue 两颗按钮都带 v-if="isAdminUser"（实际 ${formulaBtns}）`)
// 计算属性**不能**再叫 `isAdmin` —— 那会遮蔽导入进来的同名函数，
// 让 `if (!isAdmin(...))` 变成「把一个 ComputedRef 取反」⇒ 恒 false，
// 而且 vue-tsc 只会在真调用时报错。这里钉住名字。
check(
  !/const isAdmin = computed/.test(FORMULAS),
  'Formulas.vue 的计算属性没有遮蔽 isAdmin 这个名字',
)

// ------------------------------------------------------------------ 汇总 //
console.log(`\n# 通过 ${pass} 项，失败 ${failures.length} 项`)
if (failures.length) {
  console.log('✗ 有断言不成立：')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('✓ 全部一致')
