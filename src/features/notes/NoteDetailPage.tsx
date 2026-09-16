import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BookOpen, Edit3, Heart, Lightbulb, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AdditionList } from '../../components/notes/AdditionList'
import { db } from '../../db/database'
import type { AdditionKind, NoteAddition } from '../../domain/models'
import { formatDateTime } from '../../lib/date'
import { addNoteAddition, setReviewEnabled, softDeleteAddition, softDeleteNote, toggleFavorite, updateNoteAddition } from '../../repositories/noteRepository'

export function NoteDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [flash, setFlash] = useState(() => (location.state as { flash?: string } | null)?.flash ?? '')
  const [showAdditionForm, setShowAdditionForm] = useState(false)
  const [kind, setKind] = useState<AdditionKind>('thought')
  const [content, setContent] = useState('')
  const [editing, setEditing] = useState<NoteAddition | null>(null)
  const [error, setError] = useState('')
  const data = useLiveQuery(async () => {
    const note = await db.notes.get(id)
    const additions = (await db.noteAdditions.where('noteId').equals(id).sortBy('createdAt')).filter((item) => !item.deletedAt)
    return { note, additions }
  }, [id])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => {
      setFlash('')
      navigate(location.pathname, { replace: true, state: null })
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [flash, location.pathname, navigate])

  if (data === undefined) return <div className="page"><p className="muted">正在打开笔记…</p></div>
  if (!data.note || data.note.deletedAt) return <div className="page empty-state"><p>这条笔记不存在，或已进入回收站。</p><Link to="/notes">返回笔记库</Link></div>
  const note = data.note

  async function saveAddition() {
    try {
      if (editing) await updateNoteAddition(editing.id, content)
      else await addNoteAddition(id, kind, content)
      setContent(''); setEditing(null); setShowAdditionForm(false); setError('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : '保存失败') }
  }

  function beginEdit(addition: NoteAddition) {
    setEditing(addition); setKind(addition.kind); setContent(addition.content); setShowAdditionForm(true)
  }

  async function toggleReview() {
    await setReviewEnabled(note.id, !note.reviewEnabled)
  }

  async function remove() {
    if (!window.confirm('将这条笔记移入回收站？之后可以恢复。')) return
    await softDeleteNote(note.id)
    navigate('/notes', { replace: true })
  }

  return (
    <div className="page narrow-page">
      <header className="detail-header"><Link to="/notes" className="icon-button" aria-label="返回笔记库"><ArrowLeft /></Link><div className="detail-actions"><button className="icon-button" type="button" onClick={() => void toggleFavorite(note.id)} aria-label={note.isFavorite ? '取消收藏' : '收藏'}><Heart fill={note.isFavorite ? 'currentColor' : 'none'} /></button><Link className="icon-button" to={`/notes/${note.id}/edit`} aria-label="编辑"><Edit3 /></Link></div></header>
      {flash && <p className="success-message save-feedback" role="status">{flash}</p>}
      <article className="note-detail">
        <div className="eyebrow">{note.context === 'reading' ? <BookOpen /> : <Lightbulb />}<span>{note.context === 'reading' ? '读书笔记' : '生活记录'}</span></div>
        <h1>{note.sourceId ? <Link className="source-link" to={`/sources/${note.sourceId}`}>{note.sourceTitleSnapshot}</Link> : note.sourceTitleSnapshot || (note.context === 'reading' ? '未命名书籍' : '一则生活记录')}</h1>
        {note.location && <p className="location">{note.location}</p>}
        {note.excerpt && <section className="content-block excerpt-block"><h2>原文</h2><p className="preserve-lines">{note.excerpt}</p></section>}
        {note.reflection && <section className="content-block reflection-block"><h2>我的感悟</h2><p className="preserve-lines">{note.reflection}</p></section>}
        {note.tags.length > 0 && <div className="tag-row">{note.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        <AdditionList additions={data.additions} editable onEdit={beginEdit} onDelete={(addition) => void softDeleteAddition(addition.id)} />
        <button type="button" className="secondary-button addition-button" onClick={() => { setEditing(null); setContent(''); setKind('thought'); setShowAdditionForm(!showAdditionForm) }}><Plus />追加思考或例子</button>
        {showAdditionForm && <div className="addition-form">
          <div className="library-tabs"><button type="button" className={kind === 'thought' ? 'active' : ''} onClick={() => setKind('thought')}>新的思考</button><button type="button" className={kind === 'example' ? 'active' : ''} onClick={() => setKind('example')}>具体例子</button></div>
          <textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder={kind === 'thought' ? '现在又有了什么新的理解？' : '补充一个能说明这条笔记的例子…'} autoFocus />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="button" onClick={() => { setShowAdditionForm(false); setEditing(null); setError('') }}>取消</button><button className="primary-button" type="button" onClick={() => void saveAddition()}>{editing ? '保存修改' : '添加'}</button></div>
        </div>}
        <footer className="note-meta"><span>创建于 {formatDateTime(note.createdAt)}</span><span>更新于 {formatDateTime(note.updatedAt)}</span></footer>
      </article>
      <section className="detail-management">
        <button type="button" onClick={() => void toggleReview()}><RotateCcw />{note.reviewEnabled ? '停止复习' : '加入复习'}</button>
        <button type="button" className="danger-text" onClick={() => void remove()}><Trash2 />移入回收站</button>
      </section>
    </div>
  )
}
