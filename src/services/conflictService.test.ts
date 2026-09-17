import { beforeEach, expect, it } from 'vitest'
import { db, defaultSettings } from '../db/database'
import type { SyncConflict } from '../domain/models'
import { acknowledgeConflict, conflictHasContentDifference } from './conflictService'

const conflict: SyncConflict = { id: 'test-conflict', entityType: 'settings', entityId: 'singleton', localPayload: defaultSettings, remotePayload: { ...defaultSettings, theme: 'dark', serverVersion: 2 }, remoteVersion: 2, createdAt: '2026-09-17T00:00:00Z' }
beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((table) => table.clear()))
  await db.settings.put(defaultSettings)
  await db.syncMetadata.put({ id: 'singleton', cursor: 12, status: 'conflict', enabledAt: '2026-09-17T00:00:00Z' })
  await db.syncConflicts.put(conflict)
})

it('Distinguishes actual user-content differences from revision/time-only differences', () => {
  expect(conflictHasContentDifference(conflict)).toBe(true)
  expect(conflictHasContentDifference({ ...conflict, remotePayload: { ...defaultSettings, updatedAt: '2026-09-17T01:00:00Z', serverVersion: 3, syncStatus: 'synced' } })).toBe(false)
})

it('Acknowledgment keeps both snapshots, business data, cursor and audit history', async () => {
  await acknowledgeConflict(conflict.id)
  expect(await db.syncConflicts.get(conflict.id)).toMatchObject({ ...conflict, resolvedAt: expect.any(String) })
  expect(await db.settings.get('singleton')).toEqual(defaultSettings)
  expect(await db.syncMetadata.get('singleton')).toMatchObject({ cursor: 12, status: 'synced' })
  expect(await db.syncOutbox.count()).toBe(0)
})

it('Resolving one conflict does not hide others or a current sync failure', async () => {
  await db.syncConflicts.put({ ...conflict, id: 'another' })
  await acknowledgeConflict(conflict.id)
  expect((await db.syncMetadata.get('singleton'))?.status).toBe('conflict')
  await db.syncMetadata.update('singleton', { status: 'error', lastError: 'request failed' })
  await acknowledgeConflict('another')
  expect((await db.syncMetadata.get('singleton'))?.lastError).toBe('request failed')
})
