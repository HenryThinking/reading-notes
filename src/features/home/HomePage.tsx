import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, Plus, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NoteCard } from '../../components/notes/NoteCard'
import { db } from '../../db/database'

export function HomePage() {
  const data = useLiveQuery(async () => {
    const notes = (await db.notes.orderBy('updatedAt').reverse().toArray()).filter((note) => !note.deletedAt)
    const now = new Date().toISOString()
    const due = notes.filter((note) => note.reviewEnabled && note.nextReviewAt && note.nextReviewAt <= now).length
    const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000
    return {
      recent: notes.slice(0, 5),
      due,
      weeklyNotes: notes.filter((note) => new Date(note.createdAt).getTime() >= weekStart).length,
      weeklyReviews: notes.reduce((sum, note) => sum + (note.lastReviewedAt && new Date(note.lastReviewedAt).getTime() >= weekStart ? 1 : 0), 0)
    }
  }, [])
  const today = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())

  return (
    <div className="page home-page">
      <header className="page-header hero-header"><div><p className="overline">{today}</p><h1>把遇见的句子留下来</h1></div></header>
      <Link to="/notes/new" className="primary-button hero-action"><Plus />记一条</Link>
      <Link to="/review" className="review-summary">
        <div><span className="summary-icon"><RotateCcw /></span><div><strong>今日复习</strong><p>{data?.due ? `${data.due} 条笔记等你重逢` : '今天已清空，可以随便翻一条'}</p></div></div>
        <ArrowRight />
      </Link>
      <section className="section-block">
        <div className="section-heading"><h2>最近笔记</h2><Link to="/notes">查看全部</Link></div>
        {data === undefined ? <p className="muted">正在打开笔记库…</p> : data.recent.length ? (
          <div className="note-list">{data.recent.map((note) => <NoteCard key={note.id} note={note} />)}</div>
        ) : <div className="empty-state"><p>先记下第一句话。以后它会在合适的时候回来。</p><Link to="/notes/new">开始记录</Link></div>}
      </section>
      <section className="weekly-stats" aria-label="本周统计">
        <div><strong>{data?.weeklyNotes ?? 0}</strong><span>本周记录</span></div>
        <div><strong>{data?.weeklyReviews ?? 0}</strong><span>本周复习</span></div>
      </section>
    </div>
  )
}
