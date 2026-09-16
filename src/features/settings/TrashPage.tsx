import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { db } from '../../db/database'
import { formatDateTime } from '../../lib/date'
import { permanentlyDeleteAddition, permanentlyDeleteNote, restoreAddition, restoreNote } from '../../repositories/noteRepository'

export function TrashPage() {
  const notes = useLiveQuery(() => db.notes.filter((note) => Boolean(note.deletedAt)).toArray(), [])
  const deletedAdditions = useLiveQuery(async () => {
    const additions = await db.noteAdditions.filter((item) => Boolean(item.deletedAt)).toArray()
    const parents = new Map((await db.notes.toArray()).map((note) => [note.id, note]))
    return additions.map((addition) => ({ addition, parent: parents.get(addition.noteId) })).filter((item) => item.parent && !item.parent.deletedAt)
  }, [])
  async function clearTrash() {
    const noteCount = notes?.length ?? 0
    const additionCount = deletedAdditions?.length ?? 0
    if ((!noteCount && !additionCount) || !window.confirm(`彻底删除 ${noteCount} 条笔记和 ${additionCount} 条追加内容？此操作无法撤销。`)) return
    for (const note of notes ?? []) await permanentlyDeleteNote(note.id)
    for (const { addition } of deletedAdditions ?? []) await permanentlyDeleteAddition(addition.id)
  }
  return <div className="page narrow-page"><header className="detail-header"><Link to="/settings" className="icon-button" aria-label="返回设置"><ArrowLeft /></Link><h1>回收站</h1>{Boolean((notes?.length ?? 0) + (deletedAdditions?.length ?? 0)) && <button type="button" className="danger-text" onClick={() => void clearTrash()}>清空</button>}</header>
    {notes === undefined || deletedAdditions === undefined ? <p className="muted">正在检查回收站…</p> : notes.length === 0 && deletedAdditions.length === 0 ? <div className="empty-state"><p>回收站是空的。</p></div> : <>
      {notes.length > 0 && <section><h2>笔记</h2><div className="trash-list">{notes.map((note) => <article key={note.id}><div><strong>{note.sourceTitleSnapshot || '生活记录'}</strong><p>{note.reflection || note.excerpt}</p><small>删除于 {formatDateTime(note.deletedAt)}</small></div><div className="inline-actions"><button type="button" onClick={() => void restoreNote(note.id)}><RotateCcw />恢复</button><button type="button" className="danger-text" onClick={() => { if (window.confirm('彻底删除这条笔记及其追加内容？此操作无法撤销。')) void permanentlyDeleteNote(note.id) }}><Trash2 />彻底删除</button></div></article>)}</div></section>}
      {deletedAdditions.length > 0 && <section className="settings-section"><h2>追加内容</h2><div className="trash-list">{deletedAdditions.map(({ addition, parent }) => <article key={addition.id}><div><strong>{addition.kind === 'thought' ? '新的思考' : '具体例子'} · {parent?.sourceTitleSnapshot || '生活记录'}</strong><p>{addition.content}</p><small>删除于 {formatDateTime(addition.deletedAt)}</small></div><div className="inline-actions"><button type="button" onClick={() => void restoreAddition(addition.id)}><RotateCcw />恢复</button><button type="button" className="danger-text" onClick={() => { if (window.confirm('彻底删除这条追加内容？')) void permanentlyDeleteAddition(addition.id) }}><Trash2 />彻底删除</button></div></article>)}</div></section>}
    </>}
  </div>
}
