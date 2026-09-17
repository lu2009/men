// 提取每个「自定义单据」组件暴露的方法名（expose 块里的键）。
import { readFileSync } from 'node:fs'

const src = readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home.formatted.js', 'utf8')

const RANGES = [
  [2372, 3468, '12 自定义收据单', 'Receipt2PrintManager'],
  [3468, 4522, '13 自定义合格标签', 'QualifiedLabelPrintManager'],
  [4522, 5787, '14 自定义生产单', 'ProductionSheetPrintManager'],
  [5787, 6485, '15 自定义生产单2', 'ProductionSheet2PrintManager'],
  [6485, 7100, '16 自定义玻璃合片单', 'GlassSheet2PrintManager'],
]

const lines = src.split('\n')

for (const [a, b, label, comp] of RANGES) {
  const found = new Map()
  for (let i = a; i < b && i < lines.length; i++) {
    // expose 里的键形如 `  xxx: async (...) =>` 或 `  xxx: (…) =>` 或 `  xxx: fn`
    const m = lines[i].match(/^\s{4,10}([a-zA-Z_$][\w$]*)\s*:\s*(async\s*)?(\(|[a-zA-Z_$][\w$]*\s*[,}])/)
    if (!m) continue
    const n = m[1]
    if (!/^(build|open|print|copy|export|init|reset|destroy|refresh|is|toggle|enter|exit|set|apply|render|update|save|load|calc|get|make|show|hide|close|start|stop|clear|on|do|to)[A-Z_$]/.test(n)) continue
    if (!found.has(n)) found.set(n, i + 1)
  }
  console.log(`\n### ic=${label}  \`${comp}\`  —— expose ${found.size} 项`)
  for (const [n, ln] of found) console.log(`   ${n.padEnd(30)} :${ln}`)
}
