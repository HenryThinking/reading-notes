import { db, defaultSettings } from '../db/database'
import type { BackupEnvelopeV1, SyncEntityPayload, SyncEntityType } from '../domain/models'
import { backupEnvelopeSchema } from '../domain/validation'
import { scheduleSync } from './syncService'
import { makeOutboxEntry } from './outboxService'

export interface ImportPlan {
  parsed: BackupEnvelopeV1
  added: number
  updated: number
  skipped: number
}

export async function createBackup(): Promise<BackupEnvelopeV1> {
  const [sources, notes, noteAdditions, settings] = await Promise.all([
    db.sources.toArray(),
    db.notes.toArray(),
    db.noteAdditions.toArray(),
    db.settings.get('singleton')
  ])
  return {
    format: 'shiyenotes-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '0.1.0',
    sources: sources.map((item) => ({ ...item, serverVersion: 0, syncStatus: 'pending' as const })),
    notes: notes.map((note) => ({ ...note, serverVersion: 0, syncStatus: 'pending' as const })),
    noteAdditions: noteAdditions.map((item) => ({ ...item, serverVersion: 0, syncStatus: 'pending' as const })),
    settings: { ...(settings ?? defaultSettings), serverVersion: 0, syncStatus: 'pending' }
  }
}

export async function markBackupExported(exportedAt: string) {
  // 设备本地元数据独立保存，不由 createBackup 读取，也不由导入流程写入。
  await db.deviceMetadata.put({ ...(await db.deviceMetadata.get('singleton')), id: 'singleton', lastExportedAt: exportedAt })
}

export function parseBackup(input: unknown): BackupEnvelopeV1 {
  const backup = backupEnvelopeSchema.parse(input)
  const ensureUnique = (label: string, ids: string[]) => {
    if (new Set(ids).size !== ids.length) throw new Error(`${label}包含重复 ID`)
  }
  ensureUnique('书籍', backup.sources.map((item) => item.id))
  ensureUnique('笔记', backup.notes.map((item) => item.id))
  ensureUnique('追加内容', backup.noteAdditions.map((item) => item.id))
  const sourceIds = new Set(backup.sources.map((item) => item.id))
  const noteIds = new Set(backup.notes.map((item) => item.id))
  if (backup.notes.some((note) => note.sourceId && !sourceIds.has(note.sourceId))) throw new Error('备份中存在找不到来源的笔记')
  if (backup.noteAdditions.some((item) => !noteIds.has(item.noteId))) throw new Error('备份中存在找不到父笔记的追加内容')
  return backup
}

type VersionedRecord = { id: string; updatedAt: string }

async function countPlan<T extends VersionedRecord>(incoming: T[], existing: T[]) {
  const current = new Map(existing.map((item) => [item.id, item]))
  return incoming.reduce((counts, item) => {
    const old = current.get(item.id)
    if (!old) counts.added += 1
    else if (new Date(item.updatedAt).getTime() > new Date(old.updatedAt).getTime()) counts.updated += 1
    else counts.skipped += 1
    return counts
  }, { added: 0, updated: 0, skipped: 0 })
}

export async function analyzeBackup(input: unknown): Promise<ImportPlan> {
  const parsed = parseBackup(input)
  const [sources, notes, additions] = await Promise.all([
    db.sources.toArray(), db.notes.toArray(), db.noteAdditions.toArray()
  ])
  const groups = await Promise.all([
    countPlan(parsed.sources, sources),
    countPlan(parsed.notes, notes),
    countPlan(parsed.noteAdditions, additions)
  ])
  return groups.reduce((total, group) => ({
    added: total.added + group.added,
    updated: total.updated + group.updated,
    skipped: total.skipped + group.skipped,
    parsed
  }), { added: 0, updated: 0, skipped: 0, parsed })
}

async function mergeRecords<T extends VersionedRecord & SyncEntityPayload>(entityType: SyncEntityType, incoming: T[], get: (id: string) => Promise<T | undefined>, put: (item: T) => Promise<unknown>) {
  for (const item of incoming) {
    const existing = await get(item.id)
    if (!existing || new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      const normalized = { ...item, serverVersion: 0, syncStatus: 'pending' as const } as T
      await put(normalized)
      await db.syncOutbox.put(makeOutboxEntry(entityType, normalized))
    }
  }
}

export async function importBackup(plan: ImportPlan) {
  const backup = plan.parsed
  await db.transaction('rw', db.sources, db.notes, db.noteAdditions, db.settings, db.syncOutbox, async () => {
    await mergeRecords('source', backup.sources, (id) => db.sources.get(id), (item) => db.sources.put(item))
    await mergeRecords('note', backup.notes,
      (id) => db.notes.get(id),
      (item) => db.notes.put(item)
    )
    await mergeRecords('noteAddition', backup.noteAdditions, (id) => db.noteAdditions.get(id), (item) => db.noteAdditions.put(item))
    const settings = { ...backup.settings, serverVersion: 0, syncStatus: 'pending' as const }
    await db.settings.put(settings)
    await db.syncOutbox.put(makeOutboxEntry('settings', settings))
  })
  scheduleSync()
}

export function downloadBackup(backup: BackupEnvelopeV1) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `shiyenotes-backup-${backup.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}
