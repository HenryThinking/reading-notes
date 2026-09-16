import { db } from '../db/database'
import type { AdditionKind, Note, NoteAddition, NoteInput, ReviewAction } from '../domain/models'
import { noteInputSchema } from '../domain/validation'
import { nextLocalNineAM } from '../lib/date'
import { createId } from '../lib/ids'
import { normalizeTags } from '../lib/text'
import { calculateReviewUpdate } from '../services/reviewService'
import { scheduleSync } from '../services/syncService'
import { makeOutboxEntry } from '../services/outboxService'

async function resolveSourceSnapshot(input: NoteInput) {
  if (input.context === 'life') return input.sourceLabel?.trim() ?? ''
  const source = input.sourceId ? await db.sources.get(input.sourceId) : undefined
  if (!source || source.deletedAt) throw new Error('所选书籍不存在')
  return source.title
}

export async function createNote(rawInput: NoteInput): Promise<Note> {
  const input = noteInputSchema.parse(rawInput)
  const now = new Date()
  const note: Note = {
    id: createId(),
    ...input,
    sourceLabel: input.sourceLabel?.trim() || undefined,
    sourceTitleSnapshot: await resolveSourceSnapshot(input),
    excerpt: input.excerpt.trim(),
    reflection: input.reflection.trim(),
    location: input.location?.trim() || undefined,
    tags: normalizeTags(input.tags),
    isFavorite: false,
    reviewStage: 0,
    reviewCount: 0,
    nextReviewAt: input.reviewEnabled ? nextLocalNineAM(now, 1).toISOString() : undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    serverVersion: 0,
    syncStatus: 'pending'
  }
  await db.transaction('rw', db.notes, db.syncOutbox, async () => {
    await db.notes.add(note)
    await db.syncOutbox.put(makeOutboxEntry('note', note))
  })
  scheduleSync()
  return note
}

export async function updateNote(id: string, rawInput: NoteInput) {
  const input = noteInputSchema.parse(rawInput)
  const existing = await db.notes.get(id)
  if (!existing || existing.deletedAt) throw new Error('笔记不存在')
  const nextReviewAt = input.reviewEnabled
    ? existing.nextReviewAt ?? nextLocalNineAM(new Date(), 1).toISOString()
    : undefined
  const sourceChanged = input.context !== existing.context
    || input.sourceId !== existing.sourceId
    || (input.sourceLabel?.trim() || undefined) !== existing.sourceLabel
  const now = new Date().toISOString()
  const updated: Note = { ...existing,
    ...input,
    sourceLabel: input.sourceLabel?.trim() || undefined,
    sourceTitleSnapshot: sourceChanged ? await resolveSourceSnapshot(input) : existing.sourceTitleSnapshot,
    excerpt: input.excerpt.trim(),
    reflection: input.reflection.trim(),
    location: input.location?.trim() || undefined,
    tags: normalizeTags(input.tags),
    nextReviewAt,
    updatedAt: now,
    syncStatus: 'pending'
  }
  await db.transaction('rw', db.notes, db.syncOutbox, async () => {
    await db.notes.put(updated)
    await db.syncOutbox.put(makeOutboxEntry('note', updated, now))
  })
  scheduleSync()
}

export async function toggleFavorite(id: string) {
  const note = await db.notes.get(id)
  if (!note) return
  const now = new Date().toISOString()
  const updated = { ...note, isFavorite: !note.isFavorite, updatedAt: now, syncStatus: 'pending' as const }
  await db.transaction('rw', db.notes, db.syncOutbox, async () => {
    await db.notes.put(updated)
    await db.syncOutbox.put(makeOutboxEntry('note', updated, now))
  })
  scheduleSync()
}

export async function setReviewEnabled(id: string, enabled: boolean) {
  const note = await db.notes.get(id)
  if (!note || note.deletedAt) throw new Error('笔记不存在')
  const now = new Date().toISOString()
  const updated: Note = { ...note,
    reviewEnabled: enabled,
    nextReviewAt: enabled ? note.nextReviewAt ?? nextLocalNineAM(new Date(), 1).toISOString() : undefined,
    updatedAt: now,
    syncStatus: 'pending'
  }
  await db.transaction('rw', db.notes, db.syncOutbox, async () => {
    await db.notes.put(updated)
    await db.syncOutbox.put(makeOutboxEntry('note', updated, now))
  })
  scheduleSync()
}

export async function softDeleteNote(id: string) {
  const now = new Date().toISOString()
  const note = await db.notes.get(id)
  if (!note) return
  const updated: Note = { ...note, deletedAt: now, updatedAt: now, syncStatus: 'pending' }
  await db.transaction('rw', db.notes, db.syncOutbox, async () => {
    await db.notes.put(updated)
    await db.syncOutbox.put(makeOutboxEntry('note', updated, now))
  })
  scheduleSync()
}

export async function restoreNote(id: string) {
  const note = await db.notes.get(id)
  if (!note) return
  const now = new Date().toISOString()
  const updated: Note = { ...note, deletedAt: undefined, updatedAt: now, syncStatus: 'pending' }
  await db.transaction('rw', db.notes, db.syncOutbox, async () => {
    await db.notes.put(updated)
    await db.syncOutbox.put(makeOutboxEntry('note', updated, now))
  })
  scheduleSync()
}

export async function addNoteAddition(noteId: string, kind: AdditionKind, content: string): Promise<NoteAddition> {
  const clean = content.trim()
  if (!clean) throw new Error('追加内容不能为空')
  const note = await db.notes.get(noteId)
  if (!note || note.deletedAt) throw new Error('笔记不存在')
  const now = new Date().toISOString()
  const addition: NoteAddition = { id: createId(), noteId, kind, content: clean, createdAt: now, updatedAt: now, serverVersion: 0, syncStatus: 'pending' }
  const updatedNote: Note = { ...note, updatedAt: now, syncStatus: 'pending' }
  await db.transaction('rw', db.notes, db.noteAdditions, db.syncOutbox, async () => {
    await db.noteAdditions.add(addition)
    await db.notes.put(updatedNote)
    await db.syncOutbox.bulkPut([makeOutboxEntry('noteAddition', addition, now), makeOutboxEntry('note', updatedNote, now)])
  })
  scheduleSync()
  return addition
}

export async function updateNoteAddition(id: string, content: string) {
  const addition = await db.noteAdditions.get(id)
  const clean = content.trim()
  if (!addition || addition.deletedAt) throw new Error('追加内容不存在')
  if (!clean) throw new Error('追加内容不能为空')
  const now = new Date().toISOString()
  const note = await db.notes.get(addition.noteId)
  if (!note) throw new Error('父笔记不存在')
  const updatedAddition: NoteAddition = { ...addition, content: clean, updatedAt: now, syncStatus: 'pending' }
  const updatedNote: Note = { ...note, updatedAt: now, syncStatus: 'pending' }
  await db.transaction('rw', db.notes, db.noteAdditions, db.syncOutbox, async () => {
    await db.noteAdditions.put(updatedAddition)
    await db.notes.put(updatedNote)
    await db.syncOutbox.bulkPut([makeOutboxEntry('noteAddition', updatedAddition, now), makeOutboxEntry('note', updatedNote, now)])
  })
  scheduleSync()
}

export async function softDeleteAddition(id: string) {
  const addition = await db.noteAdditions.get(id)
  if (!addition) return
  const now = new Date().toISOString()
  const note = await db.notes.get(addition.noteId)
  if (!note) return
  const updatedAddition: NoteAddition = { ...addition, deletedAt: now, updatedAt: now, syncStatus: 'pending' }
  const updatedNote: Note = { ...note, updatedAt: now, syncStatus: 'pending' }
  await db.transaction('rw', db.notes, db.noteAdditions, db.syncOutbox, async () => {
    await db.noteAdditions.put(updatedAddition)
    await db.notes.put(updatedNote)
    await db.syncOutbox.bulkPut([makeOutboxEntry('noteAddition', updatedAddition, now), makeOutboxEntry('note', updatedNote, now)])
  })
  scheduleSync()
}

export async function restoreAddition(id: string) {
  const addition = await db.noteAdditions.get(id)
  if (!addition) return
  const now = new Date().toISOString()
  const note = await db.notes.get(addition.noteId)
  if (!note) return
  const updatedAddition: NoteAddition = { ...addition, deletedAt: undefined, updatedAt: now, syncStatus: 'pending' }
  const updatedNote: Note = { ...note, updatedAt: now, syncStatus: 'pending' }
  await db.transaction('rw', db.notes, db.noteAdditions, db.syncOutbox, async () => {
    await db.noteAdditions.put(updatedAddition)
    await db.notes.put(updatedNote)
    await db.syncOutbox.bulkPut([makeOutboxEntry('noteAddition', updatedAddition, now), makeOutboxEntry('note', updatedNote, now)])
  })
  scheduleSync()
}

export async function reviewNote(id: string, action: ReviewAction) {
  const note = await db.notes.get(id)
  if (!note || note.deletedAt || !note.reviewEnabled) throw new Error('笔记不在复习队列中')
  const updated: Note = { ...note, ...calculateReviewUpdate(note, action), syncStatus: 'pending' }
  await db.transaction('rw', db.notes, db.syncOutbox, async () => {
    await db.notes.put(updated)
    await db.syncOutbox.put(makeOutboxEntry('note', updated, updated.updatedAt))
  })
  scheduleSync()
}
