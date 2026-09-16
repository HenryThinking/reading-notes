import { db } from '../db/database'
import type { Source } from '../domain/models'
import { createId } from '../lib/ids'

export async function createBook(title: string, author?: string): Promise<Source> {
  const now = new Date().toISOString()
  const source: Source = {
    id: createId(),
    kind: 'book',
    title: title.trim(),
    author: author?.trim() || undefined,
    createdAt: now,
    updatedAt: now
  }
  if (!source.title) throw new Error('书名不能为空')
  await db.sources.add(source)
  return source
}

export async function updateBook(id: string, title: string, author?: string) {
  const source = await db.sources.get(id)
  if (!source || source.deletedAt) throw new Error('书籍不存在')
  const nextTitle = title.trim()
  if (!nextTitle) throw new Error('书名不能为空')
  const now = new Date().toISOString()
  await db.transaction('rw', db.sources, db.notes, async () => {
    await db.sources.update(id, { title: nextTitle, author: author?.trim() || undefined, updatedAt: now })
    const notes = await db.notes.where('sourceId').equals(id).toArray()
    await Promise.all(notes.map((note) => db.notes.update(note.id, { sourceTitleSnapshot: nextTitle, updatedAt: now })))
  })
}

export async function removeBookKeepingNotes(id: string) {
  const now = new Date().toISOString()
  await db.transaction('rw', db.sources, db.notes, async () => {
    await db.sources.update(id, { deletedAt: now, updatedAt: now })
    const notes = await db.notes.where('sourceId').equals(id).toArray()
    await Promise.all(notes.map((note) => db.notes.update(note.id, { sourceId: undefined, updatedAt: now })))
  })
}
