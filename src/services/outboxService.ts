import { db, defaultSettings } from '../db/database'
import type { AppSettings, Note, NoteAddition, Source, SyncEntityPayload, SyncEntityType, SyncOutboxEntry } from '../domain/models'

export function outboxId(entityType: SyncEntityType, entityId: string) {
  return `${entityType}:${entityId}`
}

export function makeOutboxEntry(entityType: SyncEntityType, entity: SyncEntityPayload, now = new Date().toISOString()): SyncOutboxEntry {
  return {
    id: outboxId(entityType, entity.id),
    entityType,
    entityId: entity.id,
    baseVersion: entity.serverVersion,
    queuedAt: now,
    updatedAt: now,
    attempts: 0
  }
}

export async function seedOutboxFromLocalData() {
  await db.transaction('rw', db.sources, db.notes, db.noteAdditions, db.settings, db.syncOutbox, async () => {
    const [sources, notes, additions, settings] = await Promise.all([
      db.sources.toArray(), db.notes.toArray(), db.noteAdditions.toArray(), db.settings.get('singleton')
    ])
    const entries = [
      ...sources.filter((item) => item.syncStatus !== 'synced').map((item) => makeOutboxEntry('source', item)),
      ...notes.filter((item) => item.syncStatus !== 'synced').map((item) => makeOutboxEntry('note', item)),
      ...additions.filter((item) => item.syncStatus !== 'synced').map((item) => makeOutboxEntry('noteAddition', item)),
      ...(settings && settings.syncStatus !== 'synced' && settings.updatedAt !== defaultSettings.updatedAt ? [makeOutboxEntry('settings', settings)] : [])
    ]
    for (const entry of entries) {
      if (!(await db.syncOutbox.get(entry.id))) await db.syncOutbox.put(entry)
    }
  })
}

export async function readSyncEntity(entityType: SyncEntityType, entityId: string): Promise<SyncEntityPayload | undefined> {
  if (entityType === 'source') return db.sources.get(entityId)
  if (entityType === 'note') return db.notes.get(entityId)
  if (entityType === 'noteAddition') return db.noteAdditions.get(entityId)
  return db.settings.get('singleton')
}

export async function writeSyncEntity(entityType: SyncEntityType, payload: SyncEntityPayload) {
  if (entityType === 'source') return db.sources.put(payload as Source)
  if (entityType === 'note') return db.notes.put(payload as Note)
  if (entityType === 'noteAddition') return db.noteAdditions.put(payload as NoteAddition)
  return db.settings.put(payload as AppSettings)
}
