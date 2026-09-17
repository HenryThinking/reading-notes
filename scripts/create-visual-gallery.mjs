import sharp from 'sharp'

const root = 'test-results/visual'
for (const kind of ['mobile', 'desktop']) {
  const width = kind === 'mobile' ? 390 : 700
  const files = ['light-home', 'light-library', 'dark-home', 'dark-library']
  const images = await Promise.all(files.map(async (file) => {
    const result = await sharp(`${root}/${kind}-${file}.png`).resize({ width }).png().toBuffer({ resolveWithObject: true })
    return { file, ...result }
  }))
  const columns = kind === 'mobile' ? 4 : 2
  const rowHeight = Math.max(...images.map((image) => image.info.height)) + 64
  const gap = 20
  const overlays = images.flatMap((image, index) => {
    const left = gap + (index % columns) * (width + gap)
    const top = gap + Math.floor(index / columns) * rowHeight
    const heading = Buffer.from(`<svg width="${width}" height="40"><text x="4" y="24" font-family="sans-serif" font-size="18" fill="#242b28">${kind} / ${image.file}</text></svg>`)
    return [{ input: heading, left, top }, { input: image.data, left, top: top + 40 }]
  })
  await sharp({ create: { width: columns * (width + gap) + gap, height: Math.ceil(images.length / columns) * rowHeight + gap, channels: 4, background: '#e9ede7' } }).composite(overlays).png().toFile(`${root}/${kind}-gallery.png`)
}

// Simulated homescreen masks, not a claim of iPhone hardware verification.
const icons = []
for (const [index, name] of ['apple-touch-icon.png', 'icon-maskable-512.png'].entries()) {
  const size = 120
  const input = await sharp(`public/icons/${name}`).resize(size, size).png().toBuffer()
  const mask = Buffer.from(`<svg width="${size}" height="${size}">${index ? '<circle cx="60" cy="60" r="60" fill="white"/>' : '<rect width="120" height="120" rx="27" fill="white"/>'}</svg>`)
  const masked = await sharp(input).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  icons.push({ input: masked, left: 40 + index * 180, top: 50 })
}
await sharp({ create: { width: 420, height: 220, channels: 4, background: '#e9ede7' } }).composite(icons).png().toFile(`${root}/icon-mask-preview.png`)
const { data, info } = await sharp('public/icons/icon-maskable-512.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
let outsideSafeArea = 0
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  const offset = (y * info.width + x) * info.channels
  const isMark = Math.abs(data[offset] - 54) + Math.abs(data[offset + 1] - 91) + Math.abs(data[offset + 2] - 73) > 30
  if (isMark && Math.hypot(x - 256, y - 256) > 204.8) outsideSafeArea++
}
if (outsideSafeArea) throw new Error(`Maskable mark exceeds the 80% safe circle: ${outsideSafeArea} pixels`)
console.info('Galleries created; maskable mark fully inside safe circle')
