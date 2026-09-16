import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings, DeviceMetadata, Draft, Note, NoteAddition, Source } from '../domain/models'

export class ShiyeDatabase extends Dexie {
  sources!: EntityTable<Source, 'id'>
  notes!: EntityTable<Note, 'id'>
  noteAdditions!: EntityTable<NoteAddition, 'id'>
  drafts!: EntityTable<Draft, 'id'>
  settings!: EntityTable<AppSettings, 'id'>
  deviceMetadata!: EntityTable<DeviceMetadata, 'id'>

  constructor(name = 'shiyenotes') {
    super(name)
    this.version(1).stores({
      sources: 'id, kind, title, updatedAt, deletedAt',
      notes: 'id, context, sourceId, updatedAt, createdAt, nextReviewAt, deletedAt, *tags',
      noteAdditions: 'id, noteId, kind, createdAt, updatedAt, deletedAt',
      drafts: 'id, updatedAt',
      settings: 'id',
      deviceMetadata: 'id'
    })
  }
}

export const db = new ShiyeDatabase()

export const defaultSettings: AppSettings = {
  id: 'singleton',
  theme: 'system',
  dailyReviewLimit: 10,
  schemaVersion: 1
}

export async function initializeDatabase() {
  if (!(await db.settings.get('singleton'))) await db.settings.put(defaultSettings)
}
