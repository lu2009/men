// 合并三份审计报告的判定行，出统计。
//
// 注意：报告里可能有多张表（正文示例表 / 子表 / 真正的判定表），
// 所以只认「一行里有正好一个判定标记」的行，并在统计里报出被排除的行数——
// 免得把示例行算进覆盖率。
import { readFileSync } from 'node:fs'

const FILES = [
  ['01-table.md', '主表 / 筛选 / 排序 / 分页 / 展开行'],
  ['02-actions.md', '行操作'],
  ['03-shell.md', '工具条 / 财务 / 看板 / 通知 / 两态'],
]

const MARKS = ['✅ 已做', '⚠️ 偏离', '❌ 未做', '❓ 未确认']

let total = { '✅ 已做': 0, '⚠️ 偏离': 0, '❌ 未做': 0, '❓ 未确认': 0 }
const byFile = []

for (const [f, label] of FILES) {
  const s = readFileSync(`/Users/aaa/Desktop/door-main/docs/home-audit/${f}`, 'utf8')
  const rows = s.split('\n').filter((l) => l.startsWith('| '))
  const counted = { '✅ 已做': 0, '⚠️ 偏离': 0, '❌ 未做': 0, '❓ 未确认': 0 }
  let skipped = 0
  for (const r of rows) {
    const hit = MARKS.filter((m) => r.includes(m))
    if (hit.length !== 1) {
      skipped++
      continue
    }
    counted[hit[0]]++
    total[hit[0]]++
  }
  byFile.push({ f, label, counted, skipped, rows: rows.length })
}

const sum = (o) => MARKS.reduce((a, m) => a + o[m], 0)

console.log('| 维度 | 已做 | 偏离 | 未做 | 未确认 | 合计 | （未计入的表行） |')
console.log('|---|---|---|---|---|---|---|')
for (const x of byFile) {
  console.log(
    `| ${x.label} | ${x.counted['✅ 已做']} | ${x.counted['⚠️ 偏离']} | ${x.counted['❌ 未做']} | ${x.counted['❓ 未确认']} | ${sum(x.counted)} | ${x.skipped} |`,
  )
}
console.log(
  `| **合计** | **${total['✅ 已做']}** | **${total['⚠️ 偏离']}** | **${total['❌ 未做']}** | **${total['❓ 未确认']}** | **${sum(total)}** | |`,
)

const n = sum(total)
console.log()
console.log(`完全一致：${((total['✅ 已做'] / n) * 100).toFixed(1)}%`)
console.log(`做了但有差异：${((total['⚠️ 偏离'] / n) * 100).toFixed(1)}%`)
console.log(`未做：${((total['❌ 未做'] / n) * 100).toFixed(1)}%`)
console.log(`未确认：${((total['❓ 未确认'] / n) * 100).toFixed(1)}%`)
console.log()
console.log(`「已做 + 偏离」= ${(((total['✅ 已做'] + total['⚠️ 偏离']) / n) * 100).toFixed(1)}%（即「有实现」的比例）`)
