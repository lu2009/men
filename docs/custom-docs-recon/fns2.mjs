import fs from 'node:fs';
const load = (p, from) => {
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(new RegExp(from, 'g'), 'XX');
  s = s.replace(/\[\s*"([A-Za-z_$][\w$]*)"\s*\]/g, '.$1');
  s = s.replace(/\[\s*'([A-Za-z_$][\w$]*)'\s*\]/g, '.$1');
  s = s.replace(/\[\s*([A-Za-z_$][\w$]*)\s*\]/g, '.$1');
  return s;
};
const members = (s) => {
  const i = s.indexOf('const l =');
  const end = s.indexOf('\n    return (\n      Vue.onMounted', i);
  const body = s.slice(i + 'const l ='.length, end);
  const parts = []; let depth = 0, cur = '';
  for (let k = 0; k < body.length; k++) {
    const c = body[k];
    cur += c;
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    if ((c === ',' || c === ';') && depth === 0) {
      const m = /^\s*(?:const\s+)?([A-Za-z_$][\w$]*)\s*=/.exec(cur);
      if (m) parts.push([m[1], cur.replace(/^\s*(?:const\s+)?[\w$]*\s*=/, '').replace(/[;,]\s*$/, '')]);
      else if (/^\s*(?:let|const|var)\s/.test(cur)) parts.push(['<decl>', cur.trim()]);
      else if (cur.trim()) parts.push(['<stmt>', cur.trim()]);
      cur = '';
    }
  }
  const out = [];
  for (const [n, v] of parts) out.push([n, v.trim().replace(/\s+/g, ' ')]);
  return out;
};
const g = members(load(process.argv[2], 'gs2'));
const p = members(load(process.argv[3], 'ps2'));
const gm = new Map(g), pm = new Map(p);
const seen = new Set();
console.log('| 成员 | GS2 | PS2 | 判定 |');
for (const [n, v] of g) {
  seen.add(n);
  if (!pm.has(n)) { console.log(`| ${n} | ${v.length} | — | GS2-ONLY |`); continue; }
  const b = pm.get(n);
  console.log(`| ${n} | ${v.length} | ${b.length} | ${v === b ? 'SAME' : 'DIFF'} |`);
}
for (const [n, v] of p) if (!seen.has(n)) console.log(`| ${n} | — | ${v.length} | PS2-ONLY |`);
fs.writeFileSync('/tmp/ps2-recon/fns.gs2.json', JSON.stringify(Object.fromEntries(g), null, 1));
fs.writeFileSync('/tmp/ps2-recon/fns.ps2.json', JSON.stringify(Object.fromEntries(p), null, 1));
