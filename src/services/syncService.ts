import { db } from '../db/database'
import type { Note, NoteAddition, Source, SyncChange, SyncConflict, SyncEntityPayload, SyncEntityType, SyncResponse, SyncServerChange } from '../domain/models'
import { createId } from '../lib/ids'
import { makeOutboxEntry, outboxId, readSyncEntity, seedOutboxFromLocalData, writeSyncEntity } from './outboxService'

const MAX_CHANGES_PER_REQUEST = 50
let activeSync: Promise<void> | undefined
let syncTimer: ReturnType<typeof setTimeout> | undefined

function withRemoteState(payload: SyncEntityPayload, serverVersion: number): SyncEntityPayload {
  return { ...payload, serverVersion, syncStatus: 'synced' } as SyncEntityPayload
}

async function getPendingChanges() {
  const entries = await db.syncOutbox.orderBy('queuedAt').limit(MAX_CHANGES_PER_REQUEST).toArray()
  const changes: SyncChange[] = []
  for (const entry of entries) {
    const payload = await readSyncEntity(entry.entityType, entry.entityId)
    if (payload) changes.push({ id: entry.entityId, entityType: entry.entityType, baseVersion: entry.baseVersion, payload })
    else await db.syncOutbox.delete(entry.id)
  }
  return changes
}

async function createConflictCopy(entityType: SyncEntityType, local: SyncEntityPayload, remote: SyncServerChange) {
  const now = new Date().toISOString()
  const conflict: SyncConflict = {
    id: createId(), entityType, entityId: local.id, localPayload: local, remotePayload: remote.payload,
    remoteVersion: remote.serverVersion, createdAt: now
  }
  await db.syncConflicts.add(conflict)

  let copy: SyncEntityPayload | undefined
  if (entityType === 'source') {
    const source = local as Source
    copy = { ...source, id: createId(), title: `${source.title}（冲突副本）`, createdAt: now, updatedAt: now, deletedAt: undefined, serverVersion: 0, syncStatus: 'conflict', conflictOf: source.id }
  } else if (entityType === 'note') {
    const note = local as Note
    copy = { ...note, id: createId(), tags: Array.from(new Set([...note.tags, '冲突副本'])), createdAt: now, updatedAt: now, deletedAt: undefined, serverVersion: 0, syncStatus: 'conflict', conflictOf: note.id }
  } else if (entityType === 'noteAddition') {
    const addition = local as NoteAddition
    copy = { ...addition, id: createId(), content: `【冲突副本】${addition.content}`, createdAt: now, updatedAt: now, deletedAt: undefined, serverVersion: 0, syncStatus: 'conflict', conflictOf: addition.id }
  }
  if (copy) {
    await writeSyncEntity(entityType, copy)
    await db.syncOutbox.put(makeOutboxEntry(entityType, copy, now))
  }
}

async function applyRemote(change: SyncServerChange) {
  await writeSyncEntity(change.entityType, withRemoteState(change.payload, change.serverVersion))
}

async function applyResponse(response: SyncResponse, sent: SyncChange[]) {
  const sentByKey = new Map(sent.map((change) => [outboxId(change.entityType, change.id), change]))
  await db.transaction('rw', [db.sources, db.notes, db.noteAdditions, db.settings, db.syncOutbox, db.syncConflicts], async () => {
    for (const accepted of response.accepted) {
      const key = outboxId(accepted.entityType, accepted.id)
      const currentOutbox = await db.syncOutbox.get(key)
      const snapshot = sentByKey.get(key)
      const current = await readSyncEntity(accepted.entityType, accepted.id)
      if (!current || !snapshot) continue
      const unchanged = current.updatedAt === snapshot.payload.updatedAt
      await writeSyncEntity(accepted.entityType, { ...current, serverVersion: accepted.serverVersion, syncStatus: unchanged ? 'synced' : current.syncStatus } as SyncEntityPayload)
      if (unchanged) await db.syncOutbox.delete(key)
      else if (currentOutbox) await db.syncOutbox.update(key, { baseVersion: accepted.serverVersion })
    }
    for (const remote of response.conflicts) {
      const key = outboxId(remote.entityType, remote.id)
      const local = sentByKey.get(key)?.payload
      if (local) await createConflictCopy(remote.entityType, local, remote)
      await applyRemote(remote)
      await db.syncOutbox.delete(key)
    }
    for (const remote of response.changes) {
      const local = await readSyncEntity(remote.entityType, remote.id)
      if (!local) {
        await applyRemote(remote)
        continue
      }
      if (remote.serverVersion <= local.serverVersion) continue
      const key = outboxId(remote.entityType, remote.id)
      if (await db.syncOutbox.get(key)) {
        await createConflictCopy(remote.entityType, local, remote)
        await db.syncOutbox.delete(key)
      }
      await applyRemote(remote)
    }
  })
}

async function updateSyncFailure(message: string, unauthenticated = false) {
  const current = await db.syncMetadata.get('singleton')
  await db.syncMetadata.put({
    id: 'singleton', cursor: current?.cursor ?? 0, enabledAt: current?.enabledAt,
    lastSyncedAt: current?.lastSyncedAt,
    status: unauthenticated ? 'unauthenticated' : navigator.onLine ? 'error' : 'offline', lastError: message
  })
}

async function performSync() {
  const metadata = await db.syncMetadata.get('singleton')
  if (!metadata?.enabledAt) throw new Error('请先备份并开启云同步')
  if (!navigator.onLine) throw new Error('当前处于离线状态')
  await db.syncMetadata.update('singleton', { status: 'syncing', lastError: undefined })

  let cursor = metadata.cursor
  let hasMore = true
  while (hasMore) {
    const changes = await getPendingChanges()
    const response = await fetch('/api/sync', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ cursor, changes })
    })
    if (response.status === 401) throw new Error('登录已失效，请重新登录')
    if (!response.ok) {
      const detail = await response.json().catch(() => undefined) as { error?: string } | undefined
      throw new Error(detail?.error || `同步请求失败（${response.status}）`)
    }
    const result = await response.json() as SyncResponse
    await applyResponse(result, changes)
    cursor = result.cursor
    hasMore = result.hasMore || await db.syncOutbox.count() > 0
  }
  const conflictCount = await db.syncConflicts.filter((item) => !item.resolvedAt).count()
  await db.syncMetadata.update('singleton', { cursor, status: conflictCount ? 'conflict' : 'synced', lastSyncedAt: new Date().toISOString(), lastError: undefined })
}

export async function login(password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ password })
  })
  if (!response.ok) throw new Error(response.status === 401 ? '登录密码不正确' : '登录失败')
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Cache-Control': 'no-store' } })
  await db.syncMetadata.update('singleton', { status: 'unauthenticated' })
}

export async function refreshAuthSession() {
  if (!navigator.onLine) {
    await db.syncMetadata.update('singleton', { status: 'offline' })
    return false
  }
  const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' }).catch(() => undefined)
  const authenticated = response?.ok === true
  if (!authenticated) await db.syncMetadata.update('singleton', { status: 'unauthenticated' })
  return authenticated
}

export async function enableSync() {
  await seedOutboxFromLocalData()
  const now = new Date().toISOString()
  await db.syncMetadata.update('singleton', { enabledAt: now, status: 'syncing', lastError: undefined })
  await syncNow()
}

export function syncNow(): Promise<void> {
  if (!activeSync) {
    activeSync = performSync().catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : '同步失败'
      await updateSyncFailure(message, message.includes('登录'))
      throw error
    }).finally(() => { activeSync = undefined })
  }
  return activeSync
}

export function scheduleSync(delay = 700) {
  if (typeof window === 'undefined') return
  void db.syncMetadata.get('singleton').then((metadata) => {
    if (!metadata?.enabledAt) return
    if (!navigator.onLine) {
      void db.syncMetadata.update('singleton', { status: 'offline' })
      return
    }
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => { void syncNow().catch(() => undefined) }, delay)
  })
}
