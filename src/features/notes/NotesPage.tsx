import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { NoteCard } from '../../components/notes/NoteCard'
import { db } from '../../db/database'
import { matchesNote } from '../../services/searchService'

type LibraryTab = 'all' | 'reading' | 'life' | 'favorite'

export function NotesPage() {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<LibraryTab>('all')
  const [sourceId, setSourceId] = useState('')
  const [tag, setTag] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt'>('updatedAt')
  const [visibleCount, setVisibleCount] = useState(100)
  const data = useLiveQuery(async () => ({
    notes: await db.notes.orderBy('updatedAt').reverse().toArray(),
    additions: await db.noteAdditions.toArray(),
    sources: (await db.sources.toArray()).filter((source) => !source.deletedAt)
  }), [])
  const allTags = useMemo(() => [...new Set(data?.notes.flatMap((note) => note.tags) ?? [])].sort(), [data?.notes])
  const notes = useMemo(() => (data?.notes ?? []).filter((note) => matchesNote(note, data?.additions ?? [], {
    query,
    context: tab === 'reading' || tab === 'life' ? tab : 'all',
    sourceId: sourceId || undefined,
    tag: tag || undefined,
    favoritesOnly: tab === 'favorite'
  })).sort((a, b) => b[sortBy].localeCompare(a[sortBy])), [data, query, sortBy, sourceId, tab, tag])
  const filterCount = Number(Boolean(sourceId)) + Number(Boolean(tag))

  return (
    <div className="page">
      <header className="page-header"><div><p className="overline">摘录与思考，都在这里</p><h1>笔记库</h1></div><span className="library-total">{data?.notes.filter((note) => !note.deletedAt).length ?? 0}<small> 页收藏</small></span></header>
      <label className="search-box"><Search aria-hidden="true" /><span className="sr-only">搜索笔记</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索原文、感悟、例子、标签…" />{query && <button type="button" onClick={() => setQuery('')} aria-label="清空搜索"><X /></button>}</label>
      <div className="library-tabs" role="tablist">
        {([['all', '全部'], ['reading', '读书'], ['life', '生活'], ['favorite', '收藏']] as const).map(([value, label]) => <button role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} key={value} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      <button type="button" className="filter-toggle" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal />筛选{filterCount ? ` · ${filterCount}` : ''}</button>
      {showFilters && <div className="filter-panel">
        <label>书籍<select value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">全部书籍</option>{data?.sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label>
        <label>标签<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">全部标签</option>{allTags.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>排序<select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'updatedAt' | 'createdAt')}><option value="updatedAt">最近更新</option><option value="createdAt">最近创建</option></select></label>
        {filterCount > 0 && <button type="button" className="text-button" onClick={() => { setSourceId(''); setTag('') }}>清空筛选</button>}
      </div>}
      <p className="result-count">{data === undefined ? '正在查找…' : `${notes.length} 条笔记`}</p>
      {data !== undefined && notes.length === 0 ? <div className="empty-state"><p>{query || filterCount ? '没有找到符合条件的笔记。' : '笔记库还是空的。'}</p></div> : <><div className="note-list">{notes.slice(0, visibleCount).map((note) => <NoteCard key={note.id} note={note} additionCount={data?.additions.filter((item) => item.noteId === note.id && !item.deletedAt).length} />)}</div>{notes.length > visibleCount && <button type="button" className="secondary-button load-more" onClick={() => setVisibleCount((count) => count + 100)}>再显示 100 条</button>}</>}
    </div>
  )
}
