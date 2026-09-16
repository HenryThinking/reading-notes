import { db } from '../db/database'
import type { AdditionKind, Note, NoteAddition, NoteInput, ReviewAction } from '../domain/models'
import { noteInputSchema } from '../domain/validation'
import { nextLocalNineAM } from '../lib/date'
import { createId } from '../lib/ids'
import { normalizeTags } from '../lib/text'
import { calculateReviewUpdate } from '../services/reviewService'

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
    updatedAt: now.toISOString()
  }
  await db.notes.add(note)
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
  await db.notes.update(id, {
    ...input,
    sourceLabel: input.sourceLabel?.trim() || undefined,
    sourceTitleSnapshot: sourceChanged ? await resolveSourceSnapshot(input) : existing.sourceTitleSnapshot,
    excerpt: input.excerpt.trim(),
    reflection: input.reflection.trim(),
    location: input.location?.trim() || undefined,
    tags: normalizeTags(input.tags),
    nextReviewAt,
    updatedAt: new Date().toISOString()
  })
}

export async function toggleFavorite(id: string) {
  const note = await db.notes.get(id)
  if (!note) return
  await db.notes.update(id, { isFavorite: !note.isFavorite, updatedAt: new Date().toISOString() })
}

export async function setReviewEnabled(id: string, enabled: boolean) {
  const note = await db.notes.get(id)
  if (!note || note.deletedAt) throw new Error('笔记不存在')
  await db.notes.update(id, {
    reviewEnabled: enabled,
    nextReviewAt: enabled ? note.nextReviewAt ?? nextLocalNineAM(new Date(), 1).toISOString() : undefined,
    updatedAt: new Date().toISOString()
  })
}

export async function softDeleteNote(id: string) {
  const now = new Date().toISOString()
  await db.notes.update(id, { deletedAt: now, updatedAt: now })
}

export async function restoreNote(id: string) {
  await db.notes.update(id, { deletedAt: undefined, updatedAt: new Date().toISOString() })
}

export async function permanentlyDeleteNote(id: string) {
  await db.transaction('rw', db.notes, db.noteAdditions, db.drafts, async () => {
    await db.noteAdditions.where('noteId').equals(id).delete()
    await db.drafts.delete(`edit-${id}`)
    await db.notes.delete(id)
  })
}

export async function addNoteAddition(noteId: string, kind: AdditionKind, content: string): Promise<NoteAddition> {
  const clean = content.trim()
  if (!clean) throw new Error('追加内容不能为空')
  const note = await db.notes.get(noteId)
  if (!note || note.deletedAt) throw new Error('笔记不存在')
  const now = new Date().toISOString()
  const addition: NoteAddition = { id: createId(), noteId, kind, content: clean, createdAt: now, updatedAt: now }
  await db.transaction('rw', db.notes, db.noteAdditions, async () => {
    await db.noteAdditions.add(addition)
    await db.notes.update(noteId, { updatedAt: now })
  })
  return addition
}

export async function updateNoteAddition(id: string, content: string) {
  const addition = await db.noteAdditions.get(id)
  const clean = content.trim()
  if (!addition || addition.deletedAt) throw new Error('追加内容不存在')
  if (!clean) throw new Error('追加内容不能为空')
  const now = new Date().toISOString()
  await db.transaction('rw', db.notes, db.noteAdditions, async () => {
    await db.noteAdditions.update(id, { content: clean, updatedAt: now })
    await db.notes.update(addition.noteId, { updatedAt: now })
  })
}

export async function softDeleteAddition(id: string) {
  const addition = await db.noteAdditions.get(id)
  if (!addition) return
  const now = new Date().toISOString()
  await db.transaction('rw', db.notes, db.noteAdditions, async () => {
    await db.noteAdditions.update(id, { deletedAt: now, updatedAt: now })
    await db.notes.update(addition.noteId, { updatedAt: now })
  })
}

export async function restoreAddition(id: string) {
  const addition = await db.noteAdditions.get(id)
  if (!addition) return
  const now = new Date().toISOString()
  await db.transaction('rw', db.notes, db.noteAdditions, async () => {
    await db.noteAdditions.update(id, { deletedAt: undefined, updatedAt: now })
    await db.notes.update(addition.noteId, { updatedAt: now })
  })
}

export async function permanentlyDeleteAddition(id: string) {
  const addition = await db.noteAdditions.get(id)
  if (!addition) return
  const now = new Date().toISOString()
  await db.transaction('rw', db.notes, db.noteAdditions, async () => {
    await db.noteAdditions.delete(id)
    await db.notes.update(addition.noteId, { updatedAt: now })
  })
}

export async function reviewNote(id: string, action: ReviewAction) {
  const note = await db.notes.get(id)
  if (!note || note.deletedAt || !note.reviewEnabled) throw new Error('笔记不在复习队列中')
  await db.notes.update(id, calculateReviewUpdate(note, action))
}
