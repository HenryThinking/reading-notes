import { describe, expect, it } from 'vitest'
import type { Note, NoteAddition } from '../domain/models'
import { matchesNote } from './searchService'

const note: Note = {
  id: '00000000-0000-4000-8000-000000000001', context: 'reading', sourceId: '00000000-0000-4000-8000-000000000002',
  sourceTitleSnapshot: '思考，快与慢', excerpt: '系统一', reflection: '直觉判断', location: '第三章', tags: ['心理学'],
  isFavorite: false, reviewEnabled: true, reviewStage: 0, reviewCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', serverVersion: 0, syncStatus: 'pending'
}
const addition: NoteAddition = {
  id: '00000000-0000-4000-8000-000000000003', noteId: note.id, kind: 'example', content: '超市促销时的锚定效应',
  createdAt: note.createdAt, updatedAt: note.updatedAt, serverVersion: 0, syncStatus: 'pending'
}

describe('matchesNote', () => {
  it('匹配来源快照和中文标点标准化', () => expect(matchesNote(note, [], { query: '思考,快与慢' })).toBe(true))
  it('搜索追加的具体例子', () => expect(matchesNote(note, [addition], { query: '锚定效应' })).toBe(true))
  it('忽略已软删除的追加内容', () => expect(matchesNote(note, [{ ...addition, deletedAt: addition.updatedAt }], { query: '锚定效应' })).toBe(false))
})
