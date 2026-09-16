import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, defaultSettings } from '../db/database'
import type { Note, Source, SyncResponse } from '../domain/models'
import { addNoteAddition, createNote, restoreNote, softDeleteNote, updateNote } from '../repositories/noteRepository'
import { syncNow } from './syncService'

function response(body: SyncResponse, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function enableLocal(cursor = 0) {
  await db.syncMetadata.put({ id: 'singleton', cursor, status: 'synced', enabledAt: '2026-09-16T00:00:00.000Z' })
}

function acceptedResponse(init?: RequestInit, cursor = 1) {
  const body = JSON.parse(String(init?.body)) as { changes: Array<{ id: string; entityType: 'source' | 'note' | 'noteAddition' | 'settings' }> }
  return response({
    accepted: body.changes.map((item) => ({ ...item, serverVersion: 1 })), conflicts: [], changes: [], cursor, hasMore: false
  })
}

describe('syncService', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    await db.open()
    await Promise.all(db.tables.map((table) => table.clear()))
    await db.settings.put(defaultSettings)
    await db.syncMetadata.put({ id: 'singleton', cursor: 0, status: 'unauthenticated' })
  })

  it('首次上传 outbox 变更并更新服务端 revision', async () => {
    const note = await createNote({ context: 'life', sourceLabel: '散步', excerpt: '', reflection: '第一版', tags: [], reviewEnabled: false })
    await enableLocal()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => acceptedResponse(init))
    await syncNow()
    expect(await db.notes.get(note.id)).toMatchObject({ serverVersion: 1, syncStatus: 'synced' })
    expect(await db.syncOutbox.count()).toBe(0)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).changes[0]).toMatchObject({ entityType: 'note', baseVersion: 0 })
  })

  it('空本地库可下载云端记录而不清空其他表', async () => {
    const now = '2026-09-16T01:00:00.000Z'
    const remote: Note = { id: '11111111-1111-4111-8111-111111111111', context: 'life', sourceTitleSnapshot: '云端', excerpt: '', reflection: '来自云端', tags: [], isFavorite: false, reviewEnabled: false, reviewStage: 0, reviewCount: 0, createdAt: now, updatedAt: now, serverVersion: 1, syncStatus: 'synced' }
    await enableLocal()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ accepted: [], conflicts: [], changes: [{ entityType: 'note', id: remote.id, serverVersion: 1, payload: remote }], cursor: 1, hasMore: false }))
    await syncNow()
    expect(await db.notes.get(remote.id)).toMatchObject({ reflection: '来自云端', serverVersion: 1 })
    expect(await db.settings.get('singleton')).toBeDefined()
  })

  it('双设备合并同时保留本地上传和云端新增', async () => {
    const local = await createNote({ context: 'life', excerpt: '', reflection: '设备 A', tags: [], reviewEnabled: false })
    const now = '2026-09-16T02:00:00.000Z'
    const remote: Source = { id: '22222222-2222-4222-8222-222222222222', kind: 'book', title: '设备 B 的书', createdAt: now, updatedAt: now, serverVersion: 1, syncStatus: 'synced' }
    await enableLocal()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const accepted = JSON.parse(String(init?.body)).changes.map((item: { id: string; entityType: 'note' }) => ({ ...item, serverVersion: 1 }))
      return response({ accepted, conflicts: [], changes: [{ entityType: 'source', id: remote.id, serverVersion: 1, payload: remote }], cursor: 2, hasMore: false })
    })
    await syncNow()
    expect((await db.notes.get(local.id))?.syncStatus).toBe('synced')
    expect((await db.sources.get(remote.id))?.title).toBe('设备 B 的书')
  })

  it('离线新增保留 outbox，网络恢复后可重试', async () => {
    const note = await createNote({ context: 'life', excerpt: '', reflection: '离线记录', tags: [], reviewEnabled: false })
    await enableLocal()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await expect(syncNow()).rejects.toThrow('离线')
    expect(await db.syncOutbox.get(`note:${note.id}`)).toBeDefined()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => acceptedResponse(init))
    await syncNow()
    expect(await db.syncOutbox.count()).toBe(0)
  })

  it('软删除和恢复都进入 outbox 墓碑流程', async () => {
    const note = await createNote({ context: 'life', excerpt: '', reflection: '可恢复', tags: [], reviewEnabled: false })
    await db.syncOutbox.clear()
    await db.notes.update(note.id, { serverVersion: 1, syncStatus: 'synced' })
    await softDeleteNote(note.id)
    expect((await db.notes.get(note.id))?.deletedAt).toBeTruthy()
    expect(await db.syncOutbox.get(`note:${note.id}`)).toMatchObject({ baseVersion: 1 })
    await db.syncOutbox.clear()
    await restoreNote(note.id)
    expect((await db.notes.get(note.id))?.deletedAt).toBeUndefined()
    expect(await db.syncOutbox.get(`note:${note.id}`)).toBeDefined()
  })

  it('追加感悟作为独立实体上传', async () => {
    const note = await createNote({ context: 'life', excerpt: '', reflection: '原笔记', tags: [], reviewEnabled: false })
    const addition = await addNoteAddition(note.id, 'thought', '后来想到的内容')
    await enableLocal()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => acceptedResponse(init))
    await syncNow()
    expect(await db.noteAdditions.get(addition.id)).toMatchObject({ serverVersion: 1, syncStatus: 'synced' })
  })

  it('认证失败不丢失本地 outbox，并进入未登录状态', async () => {
    await createNote({ context: 'life', excerpt: '', reflection: '仍在本地', tags: [], reviewEnabled: false })
    await enableLocal()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ accepted: [], conflicts: [], changes: [], cursor: 0, hasMore: false }, 401))
    await expect(syncNow()).rejects.toThrow('登录已失效')
    expect(await db.syncOutbox.count()).toBe(1)
    expect((await db.syncMetadata.get('singleton'))?.status).toBe('unauthenticated')
  })

  it('版本冲突保留本地副本，并以云端 revision 更新原 ID', async () => {
    const note = await createNote({ context: 'life', excerpt: '', reflection: '本地修改', tags: [], reviewEnabled: false })
    await db.notes.update(note.id, { serverVersion: 1, syncStatus: 'synced' })
    await db.syncOutbox.clear()
    await updateNote(note.id, { context: 'life', excerpt: '', reflection: '本地修改', tags: [], reviewEnabled: false })
    await enableLocal(1)
    const local = (await db.notes.get(note.id))!
    const remote: Note = { ...local, reflection: '云端修改', serverVersion: 2, syncStatus: 'synced' }
    let call = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      call += 1
      if (call === 1) return response({ accepted: [], conflicts: [{ entityType: 'note', id: note.id, serverVersion: 2, payload: remote }], changes: [], cursor: 2, hasMore: false })
      return acceptedResponse(init, 3)
    })
    await syncNow()
    expect(await db.notes.get(note.id)).toMatchObject({ reflection: '云端修改', serverVersion: 2 })
    const copies = await db.notes.filter((item) => item.conflictOf === note.id).toArray()
    expect(copies).toHaveLength(1)
    expect(copies[0].reflection).toBe('本地修改')
    expect((await db.syncMetadata.get('singleton'))?.status).toBe('conflict')
  })
})
