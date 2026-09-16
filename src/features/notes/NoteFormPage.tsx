import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BookPlus, Save } from 'lucide-react'
import { Controller, type FieldErrors, useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../db/database'
import type { NoteInput } from '../../domain/models'
import { noteInputSchema } from '../../domain/validation'
import { deleteDraft, saveDraft } from '../../repositories/draftRepository'
import { createNote, updateNote } from '../../repositories/noteRepository'
import { createBook } from '../../repositories/sourceRepository'

const emptyNote: NoteInput = { context: 'reading', excerpt: '', reflection: '', tags: [], reviewEnabled: true }

export function NoteFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const draftId = id ? `edit-${id}` : 'new-note'
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showBookForm, setShowBookForm] = useState(false)
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')
  const books = useLiveQuery(() => db.sources.filter((source) => source.kind === 'book' && !source.deletedAt).sortBy('title'), []) ?? []
  const { register, control, handleSubmit, reset, setFocus, setValue, formState: { errors, isDirty } } = useForm<NoteInput>({
    resolver: zodResolver(noteInputSchema),
    defaultValues: emptyNote
  })
  const watchedValues = useWatch({ control })
  const context = watchedValues.context ?? 'reading'
  const tagsValue = watchedValues.tags
  const tagText = useMemo(() => tagsValue?.join(', ') ?? '', [tagsValue])

  useEffect(() => {
    let active = true
    void (async () => {
      const [note, draft] = await Promise.all([id ? db.notes.get(id) : undefined, db.drafts.get(draftId)])
      if (!active) return
      if (draft?.payload) reset({ ...emptyNote, ...draft.payload })
      else if (note) reset({ context: note.context, sourceId: note.sourceId, sourceLabel: note.sourceLabel, excerpt: note.excerpt, reflection: note.reflection, location: note.location, tags: note.tags, reviewEnabled: note.reviewEnabled })
      setReady(true)
    })()
    return () => { active = false }
  }, [draftId, id, reset])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => void saveDraft(draftId, watchedValues), 650)
    return () => window.clearTimeout(timer)
  }, [draftId, ready, watchedValues])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (isDirty) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])
  const blocker = useBlocker(isDirty && !saving)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('有尚未保存的修改。确定离开吗？草稿会继续保留。')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  const submit = handleSubmit(async (input) => {
    setSaving(true)
    setFormError('')
    try {
      if (id) {
        await updateNote(id, input)
        await deleteDraft(draftId)
        navigate(`/notes/${id}`, { replace: true, state: { flash: '笔记已更新' } })
      } else {
        const note = await createNote(input)
        await deleteDraft(draftId)
        navigate(`/notes/${note.id}`, { replace: true, state: { flash: '笔记已保存' } })
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '保存失败，请重试')
    } finally { setSaving(false) }
  }, (invalid: FieldErrors<NoteInput>) => {
    const fieldOrder: Array<keyof NoteInput> = ['sourceId', 'excerpt', 'reflection', 'location', 'tags']
    const firstInvalid = fieldOrder.find((field) => invalid[field])
    const message = firstInvalid && typeof invalid[firstInvalid]?.message === 'string'
      ? invalid[firstInvalid]?.message
      : '请检查必填内容后再保存'
    setFormError(message || '请检查必填内容后再保存')
    if (firstInvalid) setFocus(firstInvalid)
  })

  async function addBook() {
    try {
      const book = await createBook(bookTitle, bookAuthor)
      setValue('sourceId', book.id, { shouldDirty: true, shouldValidate: true })
      setBookTitle(''); setBookAuthor(''); setShowBookForm(false)
    } catch (error) { setFormError(error instanceof Error ? error.message : '新建书籍失败') }
  }

  if (!ready) return <div className="page"><p className="muted">正在恢复草稿…</p></div>

  return (
    <div className="page narrow-page">
      <header className="detail-header"><Link to={id ? `/notes/${id}` : '/'} className="icon-button" aria-label="返回"><ArrowLeft /></Link><h1>{id ? '编辑笔记' : '记一条'}</h1></header>
      <form className="note-form" onSubmit={(event) => void submit(event)}>
        <fieldset className="segmented-field"><legend>类型</legend>
          <div>{(['reading', 'life'] as const).map((value) => <label className={context === value ? 'selected' : ''} key={value}><input type="radio" value={value} {...register('context')} />{value === 'reading' ? '读书笔记' : '生活记录'}</label>)}</div>
        </fieldset>
        {context === 'reading' ? <div className="field-group"><label htmlFor="sourceId">书籍</label><div className="field-with-action"><select id="sourceId" {...register('sourceId')}><option value="">选择一本书</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title}{book.author ? ` · ${book.author}` : ''}</option>)}</select><button type="button" className="secondary-button" onClick={() => setShowBookForm(!showBookForm)}><BookPlus />新建</button></div>{errors.sourceId && <span className="field-error">{errors.sourceId.message}</span>}
          {showBookForm && <div className="inline-form"><input value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} placeholder="书名（必填）" /><input value={bookAuthor} onChange={(event) => setBookAuthor(event.target.value)} placeholder="作者（可选）" /><button type="button" onClick={() => void addBook()}>创建并选中</button></div>}
        </div> : <div className="field-group"><label htmlFor="sourceLabel">来源（可选）</label><input id="sourceLabel" {...register('sourceLabel')} placeholder="例如：一次谈话、播客名称" /></div>}
        <div className="field-group"><label htmlFor="excerpt">原文 / 摘抄</label><textarea id="excerpt" rows={6} {...register('excerpt')} placeholder="记下打动你的原文…" />{errors.excerpt && <span className="field-error">{errors.excerpt.message}</span>}</div>
        <div className="field-group"><label htmlFor="reflection">我的感悟</label><textarea id="reflection" rows={6} {...register('reflection')} placeholder="这一刻你怎么想？" /></div>
        <div className="field-group"><label htmlFor="location">{context === 'reading' ? '页码 / 章节（可选）' : '情境（可选）'}</label><input id="location" {...register('location')} placeholder={context === 'reading' ? '例如：P.38、第三章' : '例如：下班路上'} /></div>
        <div className="field-group"><label htmlFor="tags">标签（用逗号分隔）</label><Controller name="tags" control={control} render={({ field }) => <input id="tags" value={tagText} onChange={(event) => field.onChange(event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))} placeholder="成长, 小说, 待实践" />} /></div>
        <label className="switch-row"><span><strong>加入复习</strong><small>明天上午 9:00 首次出现</small></span><input type="checkbox" {...register('reviewEnabled')} /></label>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="primary-button submit-button" type="submit" disabled={saving} aria-busy={saving}><Save />{saving ? '正在保存…' : '保存笔记'}</button>
      </form>
    </div>
  )
}
