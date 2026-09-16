import { db } from '../db/database'
import type { Source } from '../domain/models'
import { createId } from '../lib/ids'
import { scheduleSync } from '../services/syncService'
import { makeOutboxEntry } from '../services/outboxService'

export async function createBook(title: string, author?: string): Promise<Source> {
  const now = new Date().toISOString()
  const source: Source = {
    id: createId(),
    kind: 'book',
    title: title.trim(),
    author: author?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    serverVersion: 0,
    syncStatus: 'pending'
  }
  if (!source.title) throw new Error('书名不能为空')
  await db.transaction('rw', db.sources, db.syncOutbox, async () => {
    await db.sources.add(source)
    await db.syncOutbox.put(makeOutboxEntry('source', source, now))
  })
  scheduleSync()
  return source
}

export async function updateBook(id: string, title: string, author?: string) {
  const source = await db.sources.get(id)
  if (!source || source.deletedAt) throw new Error('书籍不存在')
  const nextTitle = title.trim()
  if (!nextTitle) throw new Error('书名不能为空')
  const now = new Date().toISOString()
  const updatedSource: Source = { ...source, title: nextTitle, author: author?.trim() || undefined, updatedAt: now, syncStatus: 'pending' }
  await db.transaction('rw', db.sources, db.notes, db.syncOutbox, async () => {
    await db.sources.put(updatedSource)
    await db.syncOutbox.put(makeOutboxEntry('source', updatedSource, now))
    const notes = await db.notes.where('sourceId').equals(id).toArray()
    for (const note of notes) {
      const updated = { ...note, sourceTitleSnapshot: nextTitle, updatedAt: now, syncStatus: 'pending' as const }
      await db.notes.put(updated)
      await db.syncOutbox.put(makeOutboxEntry('note', updated, now))
    }
  })
  scheduleSync()
}

export async function removeBookKeepingNotes(id: string) {
  const now = new Date().toISOString()
  const source = await db.sources.get(id)
  if (!source) return
  const updatedSource: Source = { ...source, deletedAt: now, updatedAt: now, syncStatus: 'pending' }
  await db.transaction('rw', db.sources, db.notes, db.syncOutbox, async () => {
    await db.sources.put(updatedSource)
    await db.syncOutbox.put(makeOutboxEntry('source', updatedSource, now))
    const notes = await db.notes.where('sourceId').equals(id).toArray()
    for (const note of notes) {
      const updated = { ...note, sourceId: undefined, updatedAt: now, syncStatus: 'pending' as const }
      await db.notes.put(updated)
      await db.syncOutbox.put(makeOutboxEntry('note', updated, now))
    }
  })
  scheduleSync()
}
