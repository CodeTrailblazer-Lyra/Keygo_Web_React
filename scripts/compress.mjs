/**
 * 构建产物预压缩脚本（零依赖，Node 内置 zlib）
 *
 * 对 dist/ 内的 .js / .css / .html / .svg 生成同名 .gz 与 .br 文件。
 * 配合 Nginx 开启静态压缩后，服务端无需实时压缩 CPU 开销，
 * 且保证即使未配置动态 gzip，传输量也已是压缩后的体量。
 *
 * 用法：node scripts/compress.mjs（已并入 npm run build）
 * Nginx 需开启：
 *   gzip_static on;
 *   brotli_static on;   # 需 ngx_brotli 模块；没有则仅用 gzip_static
 */
import { promises as fs } from 'node:fs'
import { gzip, brotliCompress, constants } from 'node:zlib'
import { promisify } from 'node:util'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const gzipAsync = promisify(gzip)
const brotliAsync = promisify(brotliCompress)

const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url))
const COMPRESSIBLE_EXT = new Set(['.js', '.css', '.html', '.svg'])

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(full)))
    } else if (COMPRESSIBLE_EXT.has(extname(entry.name))) {
      files.push(full)
    }
  }
  return files
}

async function main() {
  const files = await walk(DIST_DIR)
  let rawTotal = 0
  let gzipTotal = 0
  let brotliTotal = 0

  for (const file of files) {
    const buf = await fs.readFile(file)
    // level 9 gzip / quality 11 brotli：构建期一次性成本，换取最小传输体积
    const [gz, br] = await Promise.all([
      gzipAsync(buf, { level: 9 }),
      brotliAsync(buf, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
      }),
    ])
    await Promise.all([fs.writeFile(`${file}.gz`, gz), fs.writeFile(`${file}.br`, br)])
    rawTotal += buf.length
    gzipTotal += gz.length
    brotliTotal += br.length
  }

  const kb = (n) => (n / 1024).toFixed(1)
  console.log(`[compress] ${files.length} 个文件已生成 .gz / .br 预压缩`)
  console.log(`[compress] 原始: ${kb(rawTotal)}KB | gzip: ${kb(gzipTotal)}KB | brotli: ${kb(brotliTotal)}KB`)
}

main().catch((err) => {
  console.error('[compress] 预压缩失败:', err)
  process.exit(1)
})
