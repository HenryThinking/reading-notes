// Local-only test harness. Never deployed by Pages (outside functions/).
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

const compiledDirectory = resolve('.wrangler/sync-e2e/bundle')
const compiled = resolve(compiledDirectory, 'index.js')
const build = spawnSync(process.execPath, [
  resolve('node_modules/wrangler/bin/wrangler.js'), 'pages', 'functions', 'build',
  '--outdir', compiledDirectory
], { stdio: 'inherit', env: { ...process.env, WRANGLER_LOG_PATH: resolve('.wrangler/sync-e2e/logs') } })
if (build.status !== 0) process.exit(build.status ?? 1)

const password = randomBytes(32).toString('hex')
const sessionSecret = randomBytes(48).toString('hex')
const assetsRoot = resolve('dist')
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' }
let database
const mf = new Miniflare(convertV4MiniflareOptions({
  host: '127.0.0.1', port: 8789, https: true,
  compatibilityDate: '2026-09-16', compatibilityFlags: ['nodejs_compat'],
  modules: true, scriptPath: compiled,
  bindings: { SYNC_PASSWORD: password, SESSION_SECRET: sessionSecret },
  d1Databases: { DB: 'isolated-sync-e2e' },
  serviceBindings: {
    ASSETS: async (request) => {
      const url = new URL(request.url)
      // Test-only inspection endpoints on loopback; no production resources.
      if (url.pathname === '/__test/credentials') return Response.json({ password }, { headers: { 'Cache-Control': 'no-store' } })
      if (url.pathname === '/__test/shutdown' && request.method === 'POST') {
        // Playwright's Windows process-tree termination can hang with workerd.
        // Stop only this ephemeral loopback harness, never a deployed service.
        setTimeout(() => {
          const deadline = setTimeout(() => process.exit(0), 2000)
          void mf.dispose().finally(() => { clearTimeout(deadline); process.exit(0) })
        }, 100)
        return new Response(null, { status: 202 })
      }
      if (url.pathname === '/__test/record') {
        const id = url.searchParams.get('id') ?? ''
        const record = await database.prepare('SELECT entity_type, entity_id, revision, payload FROM sync_records WHERE entity_type = ?1 AND entity_id = ?2').bind('note', id).first()
        const events = await database.prepare('SELECT seq, revision FROM sync_events WHERE entity_type = ?1 AND entity_id = ?2 ORDER BY seq').bind('note', id).all()
        return Response.json({ record, events: events.results })
      }
      const path = resolve(assetsRoot, '.' + decodeURIComponent(url.pathname))
      if (!path.startsWith(assetsRoot + sep) && path !== assetsRoot) return new Response('Forbidden', { status: 403 })
      try {
        const content = await readFile(path)
        return new Response(content, { headers: { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' } })
      } catch {
        if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 })
        return new Response(await readFile(resolve(assetsRoot, 'index.html')), { headers: { 'Content-Type': 'text/html' } })
      }
    }
  }
}))
await mf.ready
database = await mf.getD1Database('DB')
// Apply the existing versioned schema to a fresh ephemeral local D1 only.
const migration = await readFile(resolve('migrations/0001_initial_sync.sql'), 'utf8')
await database.exec(migration.replace(/\s+/g, ' '))
console.log('Isolated Pages Functions + local D1 ready at https://127.0.0.1:8789 (credentials not logged)')
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await mf.dispose(); process.exit(0) })
