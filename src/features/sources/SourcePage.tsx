import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Edit3, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NoteCard } from '../../components/notes/NoteCard'
import { db } from '../../db/database'
import { removeBookKeepingNotes, updateBook } from '../../repositories/sourceRepository'

export function SourcePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const data = useLiveQuery(async () => ({
    source: await db.sources.get(id),
    notes: (await db.notes.where('sourceId').equals(id).toArray()).filter((note) => !note.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }), [id])
  if (data === undefined) return <div className="page"><p className="muted">正在打开书籍…</p></div>
  if (!data.source || data.source.deletedAt) return <div className="page empty-state"><p>这本书不存在。</p><Link to="/notes">返回笔记库</Link></div>
  const source = data.source
  async function save() { await updateBook(id, title || source.title, author); setEditing(false) }
  async function remove() {
    if (!window.confirm(`移除《${source.title}》？关联笔记会保留书名快照，不会被删除。`)) return
    await removeBookKeepingNotes(id); navigate('/notes', { replace: true })
  }
  return <div className="page">
    <header className="detail-header"><Link to="/notes" className="icon-button" aria-label="返回"><ArrowLeft /></Link></header>
    <section className="source-hero">
      {editing ? <div className="inline-form"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={source.title} /><input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder={source.author || '作者'} /><button type="button" onClick={() => void save()}>保存</button></div> : <><p className="overline">书籍</p><h1>{source.title}</h1>{source.author && <p>{source.author}</p>}</>}
      <div className="inline-actions"><button type="button" onClick={() => { setTitle(source.title); setAuthor(source.author ?? ''); setEditing(true) }}><Edit3 />编辑</button><button type="button" className="danger-text" onClick={() => void remove()}><Trash2 />移除书籍</button></div>
    </section>
    <div className="section-heading"><h2>{data.notes.length} 条笔记</h2></div>
    {data.notes.length ? <div className="note-list">{data.notes.map((note) => <NoteCard key={note.id} note={note} />)}</div> : <div className="empty-state"><p>这本书还没有笔记。</p></div>}
  </div>
}
