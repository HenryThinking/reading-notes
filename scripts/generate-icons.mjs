import { readFileSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

// SVG is the single editable source; PNGs are reproducible, committed PWA assets.
const svg = readFileSync('public/icons/icon.svg', 'utf8')
const maskable = svg.replace('<g id="page-mark">', '<g id="page-mark" transform="translate(256 256) scale(.82) translate(-256 -256)">')
mkdirSync('public/icons', { recursive: true })
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
}
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile('public/icons/icon-maskable-512.png')
await sharp(Buffer.from(svg)).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')
console.info('Generated 192 / 512 / maskable 512 / Apple touch 180 from icon.svg')
