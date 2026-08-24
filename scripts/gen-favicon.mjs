import sharp from 'sharp'
import toIco from 'to-ico'
import { writeFile, readFile } from 'node:fs/promises'

const svgPath = 'public/favicon.svg'
const icoPath = 'public/favicon.ico'

const sizes = [16, 24, 32, 48, 64, 128, 256]

const svgBuffer = await readFile(svgPath)

const pngs = await Promise.all(
  sizes.map((size) => sharp(svgBuffer).resize(size, size).png().toBuffer()),
)

const icoBuffer = await toIco(pngs)
await writeFile(icoPath, icoBuffer)

console.log(`Generated ${icoPath} with sizes: ${sizes.join(', ')}`)
