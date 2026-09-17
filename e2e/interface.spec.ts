import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']
const excerpt = '我们不必把每一天都过成答案。\n有时候，留下一页，就是给未来的自己留一扇窗。'
const thought = '今天散步时发现，慢下来不是停下，而是开始看见。'
const longExcerpt = Array.from({ length: 18 }, (_, i) => `第 ${i + 1} 行：阅读不是抵达终点，而是不断重新认识眼前的生活。`).join('\n')

async function seed(page: Page, theme: 'light' | 'dark') {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"authenticated":false}' }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '把遇见的句子留下来' })).toBeVisible()
  await page.evaluate(async ({ ids, excerpt, thought, longExcerpt, theme }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('shiyenotes')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    // This page is a new, isolated Playwright context, never a user profile.
    const transaction = database.transaction(['notes', 'noteAdditions', 'settings'], 'readwrite')
    const now = new Date().toISOString()
    const base = { context: 'reading', tags: ['阅读', '慢生活'], isFavorite: false, reviewEnabled: true, reviewStage: 0, reviewCount: 0, createdAt: now, updatedAt: now, serverVersion: 0, syncStatus: 'pending' }
    transaction.objectStore('notes').put({ ...base, id: ids[0], sourceTitleSnapshot: '给未来的自己', excerpt, reflection: '摘下这句话，是提醒自己允许问题暂时没有答案。', nextReviewAt: now })
    transaction.objectStore('notes').put({ ...base, id: ids[1], context: 'life', sourceTitleSnapshot: '散步途中', excerpt: '', reflection: thought, tags: ['日常'], updatedAt: new Date(Date.now() - 1000).toISOString() })
    transaction.objectStore('notes').put({ ...base, id: ids[2], sourceTitleSnapshot: '重读的意义', excerpt: longExcerpt, reflection: '同一段话，在不同时间会有不同回响。', tags: ['重读'], updatedAt: new Date(Date.now() - 2000).toISOString() })
    transaction.objectStore('noteAdditions').put({ id: '44444444-4444-4444-8444-444444444444', noteId: ids[0], kind: 'thought', content: '一个月后再看：未完成，也是一种可能。', createdAt: now, updatedAt: now, serverVersion: 0, syncStatus: 'pending' })
    transaction.objectStore('settings').put({ id: 'singleton', theme, dailyReviewLimit: 10, schemaVersion: 1, updatedAt: now, serverVersion: 0, syncStatus: 'pending' })
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error) })
    database.close()
  }, { ids, excerpt, thought, longExcerpt, theme })
  await page.reload()
  await expect(page.locator('.note-card')).toHaveCount(3)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
}

async function verifyCards(page: Page) {
  const first = page.locator(`[data-note-id="${ids[0]}"]`)
  await expect(first.locator('.note-card-body')).toHaveText(excerpt)
  await expect(first.locator('.note-card-main > :first-child')).toHaveClass(/note-card-excerpt/)
  await expect(first.locator('.note-card-reflection')).toContainText('我的思考')
  await expect(first).toContainText('1 条追加')
  expect(await first.locator('.note-card-body').evaluate((node) => getComputedStyle(node).whiteSpace)).toBe('pre-wrap')
  const reflectionOnly = page.locator(`[data-note-id="${ids[1]}"]`)
  await expect(reflectionOnly.locator('.note-card-body')).toHaveText(thought)
  await expect(reflectionOnly.locator('.note-card-excerpt, .note-card-reflection')).toHaveCount(0)
  const long = page.locator(`[data-note-id="${ids[2]}"] .note-card-body`)
  await expect(long).toHaveText(longExcerpt)
  expect(await long.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  for (const button of await page.locator('.note-card > button, .library-tabs button, .bottom-nav a:visible').all()) {
    const bounds = await button.boundingBox()
    expect(bounds?.height).toBeGreaterThanOrEqual(44)
    expect(bounds?.width).toBeGreaterThanOrEqual(44)
  }
  const ratio = await first.locator('.note-card-reflection').evaluate((node) => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 })
    const luminance = (v: number[]) => v[0] * .2126 + v[1] * .7152 + v[2] * .0722
    const text = luminance(rgb(getComputedStyle(node).color))
    const background = luminance(rgb(getComputedStyle(node.closest('.note-card')!).backgroundColor))
    return (Math.max(text, background) + .05) / (Math.min(text, background) + .05)
  })
  expect(ratio).toBeGreaterThanOrEqual(4.5)
}

for (const theme of ['light', 'dark'] as const) {
  test(`card hierarchy, touch areas, contrast and screenshots — ${theme}`, async ({ page }, testInfo) => {
    const mobile = testInfo.project.name.includes('mobile')
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await seed(page, theme)
    await verifyCards(page)
    await mkdir('test-results/visual', { recursive: true })
    const prefix = `${mobile ? 'mobile' : 'desktop'}-${theme}`
    await page.screenshot({ path: `test-results/visual/${prefix}-home.png`, fullPage: true })
    await page.getByRole('link', { name: '笔记库', exact: true }).first().click()
    await verifyCards(page)
    await page.screenshot({ path: `test-results/visual/${prefix}-library.png`, fullPage: true })
    await page.locator(`[data-note-id="${ids[2]}"] .note-card-main`).click()
    await expect(page.locator('.excerpt-block p')).toHaveText(longExcerpt)
    await page.goto(`/notes/${ids[0]}`)
    await expect(page.locator('.excerpt-block p')).toHaveText(excerpt)
    await expect(page.locator('.reflection-block p')).toContainText('允许问题')
    await expect(page.locator('.timeline')).toContainText('一个月后再看')
    await page.screenshot({ path: `test-results/visual/${prefix}-detail.png`, fullPage: true })
    expect(errors).toEqual([])
    const icon = page.locator('link[rel="apple-touch-icon"]')
    await expect(icon).toHaveAttribute('href', '/icons/apple-touch-icon.png')
    expect((await page.request.get('/icons/apple-touch-icon.png')).status()).toBe(200)
  })
}

test('conflict viewer acknowledges without deleting either snapshot, original or copy', async ({ page }) => {
  await seed(page, 'light')
  await page.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open('shiyenotes'); request.onsuccess = () => resolve(request.result) })
    const transaction = database.transaction(['notes', 'syncConflicts', 'syncMetadata'], 'readwrite')
    const notes = transaction.objectStore('notes')
    const request = notes.get(id)
    request.onsuccess = () => {
      const local = request.result
      const remote = { ...local, reflection: '另一台设备上的理解', serverVersion: 2 }
      notes.put(remote)
      notes.put({ ...local, id: '55555555-5555-4555-8555-555555555555', conflictOf: id, tags: ['冲突副本'] })
      transaction.objectStore('syncConflicts').put({ id: 'conflict-1', entityType: 'note', entityId: id, localPayload: local, remotePayload: remote, remoteVersion: 2, createdAt: new Date().toISOString() })
    }
    transaction.objectStore('syncMetadata').put({ id: 'singleton', cursor: 23, status: 'conflict', enabledAt: new Date().toISOString() })
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error) })
    database.close()
  }, ids[0])
  await page.goto('/settings')
  await expect(page.getByTestId('sync-status')).toHaveText('冲突')
  await page.getByRole('link', { name: /查看与处理 1 项冲突/ }).click()
  await expect(page.getByRole('heading', { name: '笔记 · 内容有差异' })).toBeVisible()
  await expect(page.getByText('另一台设备上的理解', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '已核对，保留双方并标记已处理' }).click()
  await expect(page.getByText('没有待处理的冲突')).toBeVisible()
  await page.getByText('已处理历史 · 1 项').click()
  await page.getByText(/· note · 已保留双方/).click()
  await expect(page.getByText('另一台设备上的理解', { exact: true })).toBeVisible()
  await page.goto('/notes')
  await expect(page.locator('.note-card')).toHaveCount(4)
  await page.goto('/settings')
  await expect(page.getByTestId('sync-status')).toHaveText('已同步')
})
