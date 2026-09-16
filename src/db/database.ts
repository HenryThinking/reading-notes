import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings, DeviceMetadata, Draft, Note, NoteAddition, Source, SyncConflict, SyncLocalMetadata, SyncOutboxEntry } from '../domain/models'

export class ShiyeDatabase extends Dexie {
  sources!: EntityTable<Source, 'id'>
  notes!: EntityTable<Note, 'id'>
  noteAdditions!: EntityTable<NoteAddition, 'id'>
  drafts!: EntityTable<Draft, 'id'>
  settings!: EntityTable<AppSettings, 'id'>
  deviceMetadata!: EntityTable<DeviceMetadata, 'id'>
  syncMetadata!: EntityTable<SyncLocalMetadata, 'id'>
  syncOutbox!: EntityTable<SyncOutboxEntry, 'id'>
  syncConflicts!: EntityTable<SyncConflict, 'id'>

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
    this.version(2).stores({
      sources: 'id, kind, title, updatedAt, deletedAt',
      notes: 'id, context, sourceId, updatedAt, createdAt, nextReviewAt, deletedAt, syncStatus, serverVersion, *tags',
      noteAdditions: 'id, noteId, kind, createdAt, updatedAt, deletedAt',
      drafts: 'id, updatedAt',
      settings: 'id',
      deviceMetadata: 'id'
    }).upgrade(async (transaction) => {
      await transaction.table<Note>('notes').toCollection().modify((note) => {
        note.serverVersion = note.serverVersion ?? 0
        note.syncStatus = note.syncStatus ?? 'pending'
      })
    })
    this.version(3).stores({
      sources: 'id, kind, title, updatedAt, deletedAt, syncStatus, serverVersion',
      notes: 'id, context, sourceId, updatedAt, createdAt, nextReviewAt, deletedAt, syncStatus, serverVersion, *tags',
      noteAdditions: 'id, noteId, kind, createdAt, updatedAt, deletedAt, syncStatus, serverVersion',
      drafts: 'id, updatedAt',
      settings: 'id, syncStatus, serverVersion',
      deviceMetadata: 'id',
      syncMetadata: 'id, status',
      syncOutbox: 'id, entityType, entityId, queuedAt',
      syncConflicts: 'id, entityType, entityId, createdAt, resolvedAt'
    }).upgrade(async (transaction) => {
      await transaction.table<Source>('sources').toCollection().modify((item) => {
        item.serverVersion = item.serverVersion ?? 0
        item.syncStatus = item.syncStatus ?? 'pending'
      })
      await transaction.table<NoteAddition>('noteAdditions').toCollection().modify((item) => {
        item.serverVersion = item.serverVersion ?? 0
        item.syncStatus = item.syncStatus ?? 'pending'
      })
      await transaction.table<AppSettings>('settings').toCollection().modify((item) => {
        item.updatedAt = item.updatedAt ?? new Date().toISOString()
        item.serverVersion = item.serverVersion ?? 0
        item.syncStatus = item.syncStatus ?? 'pending'
      })
      await transaction.table<DeviceMetadata>('deviceMetadata').toCollection().modify((item) => {
        const legacy = item as DeviceMetadata & Record<string, unknown>
        delete legacy.syncToken
        delete legacy.syncCursor
        delete legacy.lastSyncedAt
        delete legacy.lastSyncError
      })
    })
  }
}

export const db = new ShiyeDatabase()

export const defaultSettings: AppSettings = {
  id: 'singleton',
  theme: 'system',
  dailyReviewLimit: 10,
  schemaVersion: 1,
  updatedAt: '2026-09-16T00:00:00.000Z',
  serverVersion: 0,
  syncStatus: 'pending'
}

export async function initializeDatabase() {
  if (!(await db.settings.get('singleton'))) await db.settings.put(defaultSettings)
  if (!(await db.syncMetadata.get('singleton'))) {
    await db.syncMetadata.put({ id: 'singleton', cursor: 0, status: 'idle' })
  }
  // Normalize the old combined UI flag only; keep all entities, queues and cursors.
  const metadata = await db.syncMetadata.get('singleton')
  if ((metadata?.status as string) === 'unauthenticated') await db.syncMetadata.update('singleton', { status: 'idle' })
}
