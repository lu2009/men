#!/usr/bin/env node
// 扫码账号 + 后端授权层 的端到端验收
//
// 跑法（需要一个**另起的**后端实例，别占用开发用的 3000）：
//   cd backend && PORT=3999 ./target/debug/smartdoor-backend &
//   node docs/qrscanner-authz-check.mjs            # 默认 http://localhost:3999
//   BASE=http://localhost:3999 ADMIN_PW=... node docs/qrscanner-authz-check.mjs
//
// 覆盖：开户 / 销户 / 会话级联 / 重名 / 跨租户 / 参数校验
//      + scanner 能碰什么、不能碰什么（逐条打真接口）
//      + admin 不被误伤（原有端点仍 200）
//
// 数据清理：脚本自己在 `finally` 里销掉建的账号，并删除临时租户（先删用户再删租户，
// 因为 `users.tenant_id` 外键没有 ON DELETE CASCADE）。

import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE || 'http://localhost:3999';
const ADMIN = { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_PW || 'Admin@12345' };
const SUFFIX = process.env.SUFFIX || '验收工';
const PW = 'Scanner@12345';
const NEW_PW = 'Scanner@54321';

let pass = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name} ${detail}`);
    console.log(`  ✗ ${name} ${detail}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 空体/非 JSON */
  }
  return { status: res.status, json };
}

async function login(username, password) {
  const r = await call('POST', '/api/v1/auth/login', { body: { username, password } });
  if (r.status !== 200) throw new Error(`登录 ${username} 失败: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.data;
}

const created = [];
const tenants = [];

async function main() {
  console.log(`# 目标 ${BASE}`);

  console.log('\n## 1. 旧有功能：admin 不受影响');
  const admin = await login(ADMIN.username, ADMIN.password);
  check('admin 登录带 role=admin', admin.user.role === 'admin', JSON.stringify(admin.user));
  check('admin 登录带 tenant.name', typeof admin.tenant?.name === 'string', JSON.stringify(admin.tenant));
  const adminToken = admin.token;
  for (const [m, p] of [
    ['GET', '/api/v1/orders'],
    ['GET', '/api/v1/clients'],
    ['GET', '/api/v1/progress'],
    ['GET', '/api/v1/procedures'],
    ['GET', '/api/v1/formulas'],
    ['GET', '/api/v1/prices'],
    ['GET', '/api/v1/column-configs'],
    ['GET', '/api/v1/auth/me'],
  ]) {
    const r = await call(m, p, { token: adminToken });
    check(`admin ${m} ${p} → 200`, r.status === 200, `实际 ${r.status}`);
  }

  console.log('\n## 2. 开户（仅 admin）');
  const noAuth = await call('POST', '/api/v1/scanner-accounts', { body: { suffix: SUFFIX, password: PW } });
  check('未带令牌 → 401', noAuth.status === 401, `实际 ${noAuth.status}`);

  const badPw = await call('POST', '/api/v1/scanner-accounts', { token: adminToken, body: { suffix: SUFFIX, password: 'weak' } });
  check('弱密码 → 400', badPw.status === 400, `实际 ${badPw.status} ${JSON.stringify(badPw.json)}`);

  const created0 = await call('POST', '/api/v1/scanner-accounts', { token: adminToken, body: { suffix: SUFFIX, password: PW } });
  check('开户 → 200', created0.status === 200, `实际 ${created0.status} ${JSON.stringify(created0.json)}`);
  const account = created0.json?.data;
  const expected = `${admin.tenant.name}${SUFFIX}`;
  check(`账号名 = 租户名+后缀（${expected}）`, account?.username === expected, `实际 ${account?.username}`);
  check('role = scanner', account?.role === 'scanner', `实际 ${account?.role}`);
  check('name = 完整账号名（旧版 displayName: username）', account?.name === expected, `实际 ${account?.name}`);
  check('不回显密码', !JSON.stringify(created0.json).includes(PW));
  created.push(SUFFIX);

  const dup = await call('POST', '/api/v1/scanner-accounts', { token: adminToken, body: { suffix: SUFFIX, password: PW } });
  check('重名 → 409', dup.status === 409, `实际 ${dup.status} ${JSON.stringify(dup.json)}`);

  console.log('\n## 3. 登录响应：够前端判落地页吗');
  const scanner = await login(account.username, PW);
  check('scanner 登录 role=scanner', scanner.user.role === 'scanner', JSON.stringify(scanner.user));
  check('scanner 登录 name = 租户名+后缀（前端可剥出员工名）', scanner.user.name === expected, JSON.stringify(scanner.user));
  check('scanner 登录带 tenant', !!scanner.tenant?.name);
  const sToken = scanner.token;
  const me = await call('GET', '/api/v1/auth/me', { token: sToken });
  check('GET /auth/me → 200 且带 role', me.status === 200 && me.json?.data?.user?.role === 'scanner');

  console.log('\n## 4. scanner 能碰的');
  // ⚠️ 2026-09-19 改过：读的那两条是**窄**接口（只回命中的 / 范围内的行）。
  // 原先是 `GET /v1/progress` + `GET /v1/progress/more`（**全量**）—— 用户纠正：
  // 那等于把整厂门行（客户名/金额/安装地址）发到车间工人的手机上，
  // 旧版每次扫码只回命中的那几行。全量那两条现在落在 **§5 碰不得**里。
  for (const [m, p] of [
    ['GET', '/api/v1/scan/qrcode?code='],
    ['GET', '/api/v1/scan/stats?employee=1&range=' + encodeURIComponent('当天')],
    // 「打印标签」要的那**一个**模板（扫码页四颗主按钮之一）。只放 lable 这一个 mode，
    // 见 §5 里那几条反例。
    ['GET', '/api/v1/print-templates/lable'],
    ['GET', '/api/v1/procedures'],
    ['GET', '/api/v1/auth/me'],
  ]) {
    const r = await call(m, p, { token: sToken });
    check(`scanner ${m} ${p} → 200`, r.status === 200, `实际 ${r.status} ${JSON.stringify(r.json)}`);
  }
  const labels = await call('POST', '/api/v1/scan/labels', { token: sToken, body: { line_nos: [] } });
  check('scanner POST /scan/labels 不被 403', labels.status !== 403, `实际 ${labels.status}`);

  console.log('\n## 5. scanner 碰不得的（全量读 + 敏感模块 + 提权端点）');
  for (const [m, p] of [
    // ★ 本次纠正的落点：全量读**不再**对扫码账号放行（理由见 §4 上面的注释）
    ['GET', '/api/v1/progress'],
    ['GET', '/api/v1/progress/more'],
    ['GET', '/api/v1/orders'],
    ['POST', '/api/v1/orders'],
    ['GET', '/api/v1/clients'],
    ['POST', '/api/v1/clients'],
    ['GET', '/api/v1/finance/orders/summary'],
    ['POST', '/api/v1/finance/orders/1/payments'],
    ['GET', '/api/v1/column-configs'],
    ['PUT', '/api/v1/column-configs'],
    ['GET', '/api/v1/formulas'],
    ['GET', '/api/v1/prices'],
    // ★ 打印模板只放行 `lable` 那**一条**（见 §4）：列表给的是全部模板、别的 mode 也不是
    // 扫码页要的 ⇒ 都还要 admin。`print-templates/{mode}` 是路径参数，白名单按**具体路径**
    // 精确匹配，所以写死 lable 不会顺手放行整个模块。
    ['GET', '/api/v1/print-templates'],
    ['GET', '/api/v1/print-templates/xiaopiao'],
    ['GET', '/api/v1/receipts/R1'],
    ['POST', '/api/v1/procedures'],
    ['POST', '/api/v1/scanner-accounts'],
    ['DELETE', `/api/v1/scanner-accounts?suffix=${encodeURIComponent(SUFFIX)}`],
  ]) {
    const r = await call(m, p, { token: sToken, body: m === 'GET' || m === 'DELETE' ? undefined : {} });
    check(`scanner ${m} ${p} → 403`, r.status === 403, `实际 ${r.status}`);
  }

  console.log('\n## 6. scanner 改自己的密码：能改，且不掉角色');
  const wrongOld = await call('POST', '/api/v1/auth/change-password', { token: sToken, body: { old_password: 'Wrong@12345', new_password: NEW_PW } });
  check('原密码错 → 401', wrongOld.status === 401, `实际 ${wrongOld.status}`);
  const changed = await call('POST', '/api/v1/auth/change-password', { token: sToken, body: { old_password: PW, new_password: NEW_PW } });
  check('改自己的密码 → 200', changed.status === 200, `实际 ${changed.status} ${JSON.stringify(changed.json)}`);
  const again = await login(account.username, NEW_PW);
  check('新密码能登录', !!again.token);
  check('改密后 role 仍是 scanner（旧版会把 isDefaultPw 置 0，新版不抄）', again.user.role === 'scanner', JSON.stringify(again.user));
  const sToken2 = again.token;

  console.log('\n## 7. 销户 + 会话级联');
  const noSuffix = await call('DELETE', '/api/v1/scanner-accounts', { token: adminToken });
  check('缺 suffix → 400', noSuffix.status === 400, `实际 ${noSuffix.status}`);
  const del = await call('DELETE', `/api/v1/scanner-accounts?suffix=${encodeURIComponent(SUFFIX)}`, { token: adminToken });
  check('销户 → 200', del.status === 200, `实际 ${del.status} ${JSON.stringify(del.json)}`);
  created.length = 0;
  const delAgain = await call('DELETE', `/api/v1/scanner-accounts?suffix=${encodeURIComponent(SUFFIX)}`, { token: adminToken });
  check('再销 → 404', delAgain.status === 404, `实际 ${delAgain.status}`);
  const afterDel = await call('GET', '/api/v1/auth/me', { token: sToken2 });
  check('销户后旧令牌失效 → 401（会话级联删）', afterDel.status === 401, `实际 ${afterDel.status}`);

  console.log('\n## 8. 跨租户：别的租户的 admin 删不动本租户的账号');
  const me1 = await call('GET', '/api/v1/auth/me', { token: adminToken });
  const cross = await makeSecondTenant();
  tenants.push(cross.name);
  const created2 = await call('POST', '/api/v1/scanner-accounts', { token: adminToken, body: { suffix: SUFFIX, password: PW } });
  created.push(SUFFIX);
  check('本租户开户 → 200', created2.status === 200, `实际 ${created2.status}`);

  const admin2 = await login(cross.adminUsername, ADMIN.password);
  check('他租户 admin 登录', admin2.user.role === 'admin');
  const crossDel = await call('DELETE', `/api/v1/scanner-accounts?suffix=${encodeURIComponent(SUFFIX)}`, { token: admin2.token });
  check('他租户 admin 销本租户账号 → 404', crossDel.status === 404, `实际 ${crossDel.status} ${JSON.stringify(crossDel.json)}`);
  const stillScanner = await login(`${me1.json.data.tenant.name}${SUFFIX}`, PW);
  check('本租户账号没被误删（仍能登录）', !!stillScanner.token);

  const crossCreate = await call('POST', '/api/v1/scanner-accounts', { token: admin2.token, body: { suffix: SUFFIX, password: PW } });
  check(
    '他租户 admin 开的号带**自己**租户名（不会撞本租户）',
    crossCreate.status === 200 && crossCreate.json?.data?.username === `${cross.name}${SUFFIX}`,
    JSON.stringify(crossCreate.json?.data),
  );
}

// 直接在库里造第二个租户 + 一个 admin。
//
// 为什么走 SQL 而不是接口：新栈**没有**「建管理员」的接口（开户接口建出来的只能是
// scanner）。密码哈希是 argon2，脚本里造不出来，所以把本租户 admin 的哈希复制一份
// —— 于是第二个租户的 admin 密码与 `ADMIN_PW` 相同。
async function makeSecondTenant() {
  const name = `验收租户${Date.now()}`;
  const tenantId = psql(`INSERT INTO tenants (name) VALUES ('${name}') RETURNING id;`);
  const adminUsername = psql(
    `INSERT INTO users (tenant_id, username, password_hash, name, role)
     SELECT ${tenantId}, '${name}admin', password_hash, '验收管理员', 'admin'
     FROM users WHERE username = '${ADMIN.username}'
     RETURNING username;`,
  );
  return { name, adminUsername };
}

function psql(sql) {
  const out = execFileSync(
    'docker',
    ['exec', 'smartdoor-db', 'psql', '-U', 'smartdoor', '-d', 'smartdoor', '-t', '-A', '-c', sql],
    { encoding: 'utf8' },
  );
  // psql 会把命令标签（`INSERT 0 1`）也打到 stdout，滤掉，只留真正的返回值
  const lines = out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^(INSERT|UPDATE|DELETE|SELECT|CREATE|ALTER|BEGIN|COMMIT)\b/.test(l));
  return lines[0] ?? '';
}

async function cleanup() {
  try {
    for (const c of created) {
      const suffix = typeof c === 'string' ? c : c.suffix;
      psql(`DELETE FROM users WHERE username LIKE '%${suffix}' AND role = 'scanner';`);
    }
    // 兜底：脚本中途崩过时，`tenants` 里可能没有那条已建好的临时租户，按名字前缀再扫一遍
    for (const t of tenants) {
      // users.tenant_id 外键**没有** ON DELETE CASCADE ⇒ 先删用户再删租户
      psql(`DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE name = '${t}');`);
      psql(`DELETE FROM tenants WHERE name = '${t}';`);
    }
    psql(`DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE '验收租户%');`);
    psql(`DELETE FROM tenants WHERE name LIKE '验收租户%';`);
    if (created.length || tenants.length) {
      console.log(`\n# 已清理：scanner 账号 ${created.length} 个、临时租户 ${tenants.length} 个`);
    }
  } catch (e) {
    console.error('# 清理失败，需要手工收拾：', e.message);
  }
}

main()
  .catch((e) => {
    failures.push(`脚本异常: ${e.message}`);
    console.error(e);
  })
  .finally(async () => {
    await cleanup();
    console.log(`\n# 通过 ${pass} 项，失败 ${failures.length} 项`);
    if (failures.length) {
      console.log(failures.map((f) => `  - ${f}`).join('\n'));
      process.exit(1);
    }
  });
