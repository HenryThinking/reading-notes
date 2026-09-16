import { db } from '../db/database'
import type { Theme } from '../domain/models'
import { makeOutboxEntry } from '../services/outboxService'
import { scheduleSync } from '../services/syncService'

export async function updateTheme(theme: Theme) {
  await updateSettings({ theme })
}

export async function updateDailyReviewLimit(dailyReviewLimit: 5 | 10 | 20) {
  await updateSettings({ dailyReviewLimit })
}

async function updateSettings(changes: { theme?: Theme; dailyReviewLimit?: 5 | 10 | 20 }) {
  const settings = await db.settings.get('singleton')
  if (!settings) throw new Error('设置尚未初始化')
  const now = new Date().toISOString()
  const updated = { ...settings, ...changes, updatedAt: now, syncStatus: 'pending' as const }
  await db.transaction('rw', db.settings, db.syncOutbox, async () => {
    await db.settings.put(updated)
    await db.syncOutbox.put(makeOutboxEntry('settings', updated, now))
  })
  scheduleSync()
}
