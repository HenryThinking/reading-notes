import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

const origin = 'https://127.0.0.1:8789'

async function signIn(page: Page, password: string) {
  await page.goto('/settings')
  await expect(page.getByTestId('auth-status')).toHaveText('未登录')
  await page.getByLabel('同步密码').fill(password)
  page.once('dialog', (dialog) => dialog.accept())
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '备份并开启同步' }).click()
  await download
  await expect(page.getByTestId('auth-status')).toHaveText('已登录')
  await expect(page.getByTestId('sync-status')).toHaveText('已同步')
}

async function createReadingNote(page: Page, title: string, reflection: string) {
  await page.goto('/notes/new')
  await page.getByRole('button', { name: '新建', exact: true }).click()
  await page.getByPlaceholder('书名（必填）').fill(title)
  await page.getByRole('button', { name: '创建并选中' }).click()
  await page.getByLabel('我的感悟').fill(reflection)
  await page.getByRole('button', { name: '保存笔记' }).click()
  await expect(page.getByRole('status')).toContainText('笔记已保存')
  return page.url().split('/').pop()!
}

test('two isolated Cookie/IndexedDB contexts round-trip via real Pages Functions and local D1', async ({ browser, request }) => {
  const { password } = await (await request.get('/__test/credentials')).json()
  // No storageState, persistent profile, Cookie or IndexedDB copying.
  const a = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true })
  const b = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true })
  a.setDefaultTimeout(15_000)
  b.setDefaultTimeout(15_000)
  try {
    const pageA = await a.newPage()
    const pageB = await b.newPage()
    await signIn(pageA, password)
    console.info('A authenticated independently')
    const marker = randomUUID()
    const initial = `Context-A-${marker}`
    const id = await createReadingNote(pageA, `Book-${marker}`, initial)
    await expect.poll(async () => (await (await request.get(`/__test/record?id=${id}`)).json()).record?.revision).toBe(1)
    const saved = await (await request.get(`/__test/record?id=${id}`)).json()
    expect(JSON.parse(saved.record.payload).reflection).toBe(initial)
    expect(saved.events.length).toBe(1)
    console.info('A note verified in local D1 with its event')

    // B is genuinely anonymous and empty even while A is signed in.
    expect((await b.request.get('/api/auth/session')).status()).toBe(401)
    await pageB.goto('/notes')
    await expect(pageB.getByText(initial, { exact: true })).toHaveCount(0)
    const localB = `Local-B-${marker}`
    const localBId = await createReadingNote(pageB, `Local-book-${marker}`, localB)
    const syncBodies: Array<{ changes: unknown[] }> = []
    pageB.on('request', (req) => { if (new URL(req.url()).pathname === '/api/sync') syncBodies.push(req.postDataJSON()) })
    await signIn(pageB, password)
    console.info('B independently authenticated and merged')
    // First sync sends a pure pull before uploading B's local records.
    expect(syncBodies[0].changes).toEqual([])
    await pageB.getByRole('link', { name: '笔记库', exact: true }).first().click()
    await pageB.getByText(initial, { exact: true }).click()
    await expect(pageB.getByText(initial, { exact: true })).toBeVisible()
    console.info('B displayed the note pulled from D1')
    await expect.poll(async () => (await (await request.get(`/__test/record?id=${localBId}`)).json()).record?.revision).toBe(1)

    const cookieA = (await a.cookies()).find((cookie) => cookie.name === '__Host-shiye_session')!
    const cookieB = (await b.cookies()).find((cookie) => cookie.name === '__Host-shiye_session')!
    expect(Boolean(cookieA && cookieB && cookieA.value !== cookieB.value)).toBe(true)
    expect({ httpOnly: cookieB.httpOnly, secure: cookieB.secure, sameSite: cookieB.sameSite }).toEqual({ httpOnly: true, secure: true, sameSite: 'Strict' })

    // Load editor assets online before testing offline database edits. A local
    // self-signed origin does not reliably allow Service Worker installation.
    await pageB.getByRole('link', { name: '编辑', exact: true }).click()
    await expect(pageB.getByLabel('我的感悟')).toHaveValue(initial)
    await pageB.getByRole('link', { name: '返回', exact: true }).click()
    await b.setOffline(true)
    console.info('B offline editing started')
    await pageB.getByRole('link', { name: '编辑', exact: true }).click()
    const edited = `Offline-B-${marker}`
    await pageB.getByLabel('我的感悟').fill(edited)
    await pageB.getByRole('button', { name: '保存笔记' }).click()
    await expect(pageB.getByText(edited, { exact: true })).toBeVisible()
    await pageB.getByRole('link', { name: '设置', exact: true }).first().click()
    await expect(pageB.getByTestId('auth-status')).toHaveText('已登录')
    await expect(pageB.getByTestId('sync-status')).toHaveText('离线待同步')
    console.info('B offline edit persisted in its IndexedDB')
    await b.setOffline(false)
    await expect(pageB.getByTestId('sync-status')).toHaveText('已同步')
    await expect.poll(async () => (await (await request.get(`/__test/record?id=${id}`)).json()).record?.revision).toBe(2)
    const updated = await (await request.get(`/__test/record?id=${id}`)).json()
    expect(JSON.parse(updated.record.payload).reflection).toBe(edited)
    expect(updated.events.map((event: { revision: number }) => event.revision)).toEqual([1, 2])
    console.info('B edit verified at D1 revision 2')

    // Focus recovery, not a shared browser cache, makes A pull B's revision.
    await pageA.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(pageA.getByText(edited, { exact: true })).toBeVisible()
    console.info('A pulled and displayed B edit')
    await pageA.goto('/settings')
    await pageA.reload()
    await expect(pageA.getByTestId('auth-status')).toHaveText('已登录')
    await expect(pageA.getByTestId('sync-status')).toHaveText('已同步')
    await pageA.getByRole('button', { name: '退出登录' }).click()
    await expect(pageA.getByTestId('auth-status')).toHaveText('未登录')
    expect((await a.request.get('/api/auth/session')).status()).toBe(401)
    expect((await b.request.get('/api/auth/session')).status()).toBe(200)
  } finally {
    await Promise.all([...a.pages(), ...b.pages()].map((page) => page.close({ runBeforeUnload: false })))
    await Promise.all([a.close(), b.close()])
  }
})

test('sync failure stays authenticated; only a sync 401 invalidates that session', async ({ page, request }) => {
  const { password } = await (await request.get('/__test/credentials')).json()
  await signIn(page, password)
  await page.route('**/api/sync', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'test outage' }) }))
  await page.getByRole('button', { name: '立即同步' }).click()
  await expect(page.getByTestId('sync-status')).toHaveText('同步失败')
  await expect(page.getByTestId('auth-status')).toHaveText('已登录')
  expect((await page.request.get('/api/auth/session')).status()).toBe(200)
  await page.unroute('**/api/sync')
  await page.route('**/api/sync', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'expired' }) }))
  await page.getByRole('button', { name: '立即同步' }).click()
  await expect(page.getByTestId('auth-status')).toHaveText('未登录')
})

test('startup Cookie session authenticates immediately and starts first pull after backup', async ({ page, request }) => {
  const { password } = await (await request.get('/__test/credentials')).json()
  const loggedIn = await page.request.post('/api/auth/login', { data: { password }, headers: { Origin: origin } })
  expect(loggedIn.status()).toBe(200)
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  let first = true
  await page.route('**/api/sync', async (route) => {
    if (first) { first = false; await held }
    await route.continue()
  })
  page.once('dialog', (dialog) => dialog.accept())
  const backup = page.waitForEvent('download')
  await page.goto('/settings')
  await backup
  await expect(page.getByTestId('auth-status')).toHaveText('已登录')
  await expect(page.getByTestId('sync-status')).toHaveText('合并中')
  release()
  await expect(page.getByTestId('sync-status')).toHaveText('已同步')
})
