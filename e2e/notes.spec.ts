import { expect, test } from '@playwright/test'

test('创建笔记并追加具体例子', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '记一条', exact: true }).first().click()
  await page.getByRole('button', { name: '新建' }).click()
  await page.getByPlaceholder('书名（必填）').fill('测试之书')
  await page.getByRole('button', { name: '创建并选中' }).click()
  await page.getByLabel('我的感悟').fill('这是最初的理解。')
  await page.getByRole('button', { name: '保存笔记' }).click()
  await expect(page.getByRole('status')).toContainText('笔记已保存')
  await expect(page.getByRole('heading', { name: '测试之书' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('这是最初的理解。')).toBeVisible()
  await page.getByRole('button', { name: '追加思考或例子' }).click()
  await page.getByRole('button', { name: '具体例子' }).click()
  await page.getByPlaceholder('补充一个能说明这条笔记的例子…').fill('一个后来遇到的具体场景。')
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await expect(page.getByText('一个后来遇到的具体场景。')).toBeVisible()

  await page.getByRole('link', { name: '笔记库' }).first().click()
  await page.getByPlaceholder('搜索原文、感悟、例子、标签…').fill('具体场景')
  await expect(page.getByText('这是最初的理解。')).toBeVisible()
  await page.getByText('这是最初的理解。').click()

  await page.locator('.addition').getByRole('button', { name: '删除' }).click()
  await expect(page.getByText('一个后来遇到的具体场景。')).not.toBeVisible()
  await page.getByRole('link', { name: '设置' }).first().click()
  await page.getByRole('link', { name: /回收站/ }).click()
  await expect(page.getByText('一个后来遇到的具体场景。')).toBeVisible()
  await page.getByRole('button', { name: '恢复' }).click()

  await page.getByRole('link', { name: '复习' }).first().click()
  await page.getByRole('button', { name: '随便翻翻' }).click()
  await expect(page.getByText('一个后来遇到的具体场景。')).toBeVisible()
})

test('校验失败时明确提示缺少书籍', async ({ page }) => {
  await page.goto('/notes/new')
  await page.getByLabel('我的感悟').fill('一条尚未选择书籍的感悟。')
  await page.getByRole('button', { name: '保存笔记' }).click()
  await expect(page.getByRole('alert')).toContainText('读书笔记需要选择书籍')
  await expect(page).toHaveURL(/\/notes\/new$/)
})

test('首次加载后应用壳可离线重载', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '把遇见的句子留下来' })).toBeVisible()
    await page.getByRole('link', { name: '笔记库' }).first().click()
    await expect(page.getByRole('heading', { name: '笔记库' })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})
