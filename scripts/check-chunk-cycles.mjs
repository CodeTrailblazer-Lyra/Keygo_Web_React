// 检测 dist/assets 中 JS chunk 的跨文件循环依赖。
// 用法：node scripts/check-chunk-cycles.mjs
// 原理：解析每个 chunk 的 import ... from "./xxx.js" 语句构建依赖图，做 DFS 找环。
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const assetsDir = fileURLToPath(new URL('../dist/assets', import.meta.url))

const files = (await readdir(assetsDir)).filter((f) => f.endsWith('.js'))

const graph = new Map()
for (const file of files) {
  const code = await readFile(path.join(assetsDir, file), 'utf8')
  const deps = []
  const re = /from\s*"(\.\/[^"]+\.js)"/g
  let m
  while ((m = re.exec(code))) deps.push(m[1].slice(2))
  graph.set(file, deps)
}

// DFS 检测环
const WHITE = 0, GRAY = 1, BLACK = 2
const color = new Map([...graph.keys()].map((k) => [k, WHITE]))
const cycles = []
function dfs(node, stack) {
  color.set(node, GRAY)
  stack.push(node)
  for (const dep of graph.get(node) ?? []) {
    if (!graph.has(dep)) continue
    const c = color.get(dep)
    if (c === GRAY) {
      cycles.push([...stack.slice(stack.indexOf(dep)), dep])
    } else if (c === WHITE) {
      dfs(dep, stack)
    }
  }
  stack.pop()
  color.set(node, BLACK)
}
for (const node of graph.keys()) {
  if (color.get(node) === WHITE) dfs(node, [])
}

if (cycles.length === 0) {
  console.log('[check] OK：chunk 依赖图无循环依赖')
  console.log(
    `[check] ${graph.size} 个 chunk：`,
    [...graph.entries()]
      .map(([f, d]) => `${f} -> [${d.join(', ') || '无'}]`)
      .join('\n        ')
  )
} else {
  console.error(`[check] 发现 ${cycles.length} 处循环依赖：`)
  for (const c of cycles) console.error('  ' + c.join(' -> '))
  process.exit(1)
}
