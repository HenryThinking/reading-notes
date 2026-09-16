import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}

function png(size, maskable = false) {
  const rows = []
  const margin = maskable ? Math.floor(size * .2) : Math.floor(size * .14)
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4); row[0] = 0
    for (let x = 0; x < size; x += 1) {
      let color = [49, 91, 74, 255]
      const insideBook = x > margin && x < size - margin && y > margin && y < size - margin * .75
      const centerGap = Math.abs(x - size / 2) < size * .018
      if (insideBook && !centerGap) color = x < size / 2 ? [246, 243, 235, 255] : [225, 234, 223, 255]
      const offset = 1 + x * 4
      row.set(color, offset)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', png(192))
writeFileSync('public/icons/icon-512.png', png(512))
writeFileSync('public/icons/icon-maskable-512.png', png(512, true))
