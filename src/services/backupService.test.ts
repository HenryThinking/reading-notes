import { beforeEach, describe, expect, it } from 'vitest'
import { db, defaultSettings } from '../db/database'
import { addNoteAddition, createNote, restoreAddition, softDeleteAddition } from '../repositories/noteRepository'
import { createBook } from '../repositories/sourceRepository'
import { analyzeBackup, createBackup, importBackup, markBackupExported } from './backupService'

describe('backupService', () => {
  beforeEach(async () => {
    await db.open()
    await Promise.all(db.tables.map((table) => table.clear()))
    await db.settings.put(defaultSettings)
  })

  it('备份包含来源快照，但排除设备本地元数据', async () => {
    const book = await createBook('局外人', '加缪')
    const note = await createNote({ context: 'reading', sourceId: book.id, excerpt: '今天，妈妈死了。', reflection: '', tags: [], reviewEnabled: true })
    const addition = await addNoteAddition(note.id, 'thought', '后来想到的理解')
    await softDeleteAddition(addition.id)
    await restoreAddition(addition.id)
    await db.syncMetadata.put({ id: 'singleton', cursor: 7, status: 'synced', enabledAt: '2026-09-14T00:00:00.000Z' })
    await markBackupExported('2026-09-15T00:00:00.000Z')
    const backup = await createBackup()
    expect(backup.notes[0].sourceTitleSnapshot).toBe('局外人')
    expect(backup.noteAdditions[0]).toMatchObject({ noteId: note.id, content: '后来想到的理解' })
    expect(backup.noteAdditions[0].deletedAt).toBeUndefined()
    expect('deviceMetadata' in backup).toBe(false)
    expect(JSON.stringify(backup)).not.toContain('lastExportedAt')
    expect('syncMetadata' in backup).toBe(false)
    expect((await db.syncMetadata.get('singleton'))?.cursor).toBe(7)
  })

  it('可往返恢复笔记和追加内容，且不覆盖设备元数据', async () => {
    const book = await createBook('城堡')
    const note = await createNote({ context: 'reading', sourceId: book.id, excerpt: '道路漫长。', reflection: '', tags: ['小说'], reviewEnabled: true })
    await addNoteAddition(note.id, 'example', '一个具体例子')
    const backup = await createBackup()
    await Promise.all([db.sources.clear(), db.notes.clear(), db.noteAdditions.clear(), db.settings.clear()])
    await db.deviceMetadata.put({ id: 'singleton', lastExportedAt: '2026-09-16T00:00:00.000Z' })
    const plan = await analyzeBackup(backup)
    await importBackup(plan)
    expect(await db.notes.count()).toBe(1)
    expect(await db.noteAdditions.count()).toBe(1)
    expect((await db.noteAdditions.toArray())[0].content).toBe('一个具体例子')
    expect((await db.deviceMetadata.get('singleton'))?.lastExportedAt).toBe('2026-09-16T00:00:00.000Z')
  })
})
