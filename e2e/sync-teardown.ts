import { request } from '@playwright/test'

export default async function teardown() {
  const client = await request.newContext({ ignoreHTTPSErrors: true })
  try {
    await client.post('https://127.0.0.1:8789/__test/shutdown', { timeout: 5000 })
  } finally { await client.dispose() }
}
