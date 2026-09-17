import fs from 'node:fs';
// tokenize-ish: normalize identifiers, bracket notation, and collapse ALL whitespace
const prep = (p, from) => {
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(new RegExp(from, 'g'), 'XX');
  s = s.replace(/\[\s*"([A-Za-z_$][\w$]*)"\s*\]/g, '.$1');
  s = s.replace(/\[\s*'([A-Za-z_$][\w$]*)'\s*\]/g, '.$1');
  s = s.replace(/\[\s*([A-Za-z_$][\w$]*)\s*\]/g, '.$1');
  // collapse whitespace entirely
  s = s.replace(/\s+/g, '');
  // one token per statement-ish: split on ; and , boundaries for diffability
  s = s.replace(/;/g, ';\n').replace(/\{/g, '{\n').replace(/\}/g, '}\n');
  return s.split('\n').filter((x) => x.length);
};
const a = prep(process.argv[2], process.argv[4]);
const b = prep(process.argv[3], process.argv[5]);
fs.writeFileSync('/tmp/ps2-recon/a.tok', a.join('\n'));
fs.writeFileSync('/tmp/ps2-recon/b.tok', b.join('\n'));
