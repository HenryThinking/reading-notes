import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, Shuffle } from 'lucide-react'
import { AdditionList } from '../../components/notes/AdditionList'
import { db, defaultSettings } from '../../db/database'
import type { Note, NoteAddition } from '../../domain/models'
import { reviewNote } from '../../repositories/noteRepository'

type Mode = 'due' | 'random'

export function ReviewPage() {
  const [mode, setMode] = useState<Mode>('due')
  const [randomId, setRandomId] = useState<string>()
  const [sessionReviewed, setSessionReviewed] = useState(0)
  const data = useLiveQuery(async () => {
    const settings = await db.settings.get('singleton') ?? defaultSettings
    const notes = (await db.notes.toArray()).filter((note) => !note.deletedAt)
    const additions = (await db.noteAdditions.toArray()).filter((item) => !item.deletedAt)
    const due = notes.filter((note) => note.reviewEnabled && note.nextReviewAt && note.nextReviewAt <= new Date().toISOString()).sort((a, b) => (a.nextReviewAt ?? '').localeCompare(b.nextReviewAt ?? '')).slice(0, settings.dailyReviewLimit)
    return { notes, due, additions }
  }, [])
  const current = useMemo(() => mode === 'due' ? data?.due[0] : data?.notes.find((note) => note.id === randomId) ?? data?.notes[0], [data, mode, randomId])

  function nextRandom() {
    const options = (data?.notes ?? []).filter((note) => note.id !== current?.id)
    setRandomId(options[Math.floor(Math.random() * options.length)]?.id ?? current?.id)
  }
  async function act(action: 'again' | 'remembered' | 'familiar') {
    if (!current) return
    await reviewNote(current.id, action)
    setSessionReviewed((value) => value + 1)
  }

  return <div className="page narrow-page">
    <header className="page-header"><div><p className="overline">让内容重新出现</p><h1>复习</h1></div>{sessionReviewed > 0 && <span className="session-count">本次已复习 {sessionReviewed} 条</span>}</header>
    <div className="library-tabs review-tabs"><button type="button" className={mode === 'due' ? 'active' : ''} onClick={() => setMode('due')}>今日到期</button><button type="button" className={mode === 'random' ? 'active' : ''} onClick={() => setMode('random')}>随便翻翻</button></div>
    {data === undefined ? <p className="muted">正在准备卡片…</p> : !current ? <div className="empty-state"><p>{mode === 'due' ? '今天已清空，可以随便翻一条。' : '先写下一条笔记，再回来翻阅。'}</p>{mode === 'due' && data.notes.length > 0 && <button type="button" onClick={() => setMode('random')}>随便翻一条</button>}</div> : <ReviewCard note={current} additions={data.additions.filter((item) => item.noteId === current.id)} />}
    {current && (mode === 'due' ? <div className="review-actions"><button type="button" onClick={() => void act('again')}>再看看<small>1 天后</small></button><button type="button" onClick={() => void act('remembered')}>有印象<small>正常巩固</small></button><button type="button" onClick={() => void act('familiar')}>很熟悉<small>降低频率</small></button></div> : <button type="button" className="primary-button next-random" onClick={nextRandom}><Shuffle />换一条</button>)}
  </div>
}

function ReviewCard({ note, additions }: { note: Note; additions: NoteAddition[] }) {
  return <article className="review-card">
    <div className="eyebrow"><span>{note.context === 'reading' ? '读书笔记' : '生活记录'}</span><span>{note.sourceTitleSnapshot}</span></div>
    {note.excerpt && <section className="content-block excerpt-block"><h2>原文</h2><p className="preserve-lines">{note.excerpt}</p></section>}
    {note.reflection && <section className="content-block reflection-block"><h2>我的感悟</h2><p className="preserve-lines">{note.reflection}</p></section>}
    <AdditionList additions={additions} />
    <div className="card-footer"><span>已复习 {note.reviewCount} 次</span><ArrowRight /></div>
  </article>
}
