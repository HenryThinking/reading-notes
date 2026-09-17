import { BookOpen, Heart, Lightbulb, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Note } from '../../domain/models'
import { formatDateTime } from '../../lib/date'
import { toggleFavorite } from '../../repositories/noteRepository'

export function NoteCard({ note, additionCount = 0 }: { note: Note; additionCount?: number }) {
  const hasExcerpt = Boolean(note.excerpt.trim())
  return (
    <article className="note-card" data-note-id={note.id} data-content-kind={hasExcerpt ? 'excerpt' : 'reflection'}>
      <Link to={`/notes/${note.id}`} className="note-card-main">
        <p className={`note-card-body preserve-lines ${hasExcerpt ? 'note-card-excerpt' : 'note-card-thought'}`}>{hasExcerpt ? note.excerpt : note.reflection}</p>
        {hasExcerpt && note.reflection.trim() && <div className="note-card-reflection"><span>我的思考</span><p className="preserve-lines">{note.reflection}</p></div>}
        <div className="note-card-source">
          {note.context === 'reading' ? <BookOpen /> : <Lightbulb />}
          <span>{note.sourceTitleSnapshot || (note.context === 'reading' ? '读书笔记' : '生活记录')}</span>
        </div>
        {note.tags.length > 0 && <div className="tag-row note-card-tags">{note.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}{note.tags.length > 3 && <span>+{note.tags.length - 3}</span>}</div>}
        <footer className="note-card-footer"><time dateTime={note.updatedAt}>{formatDateTime(note.updatedAt)}</time>{additionCount > 0 && <span><MessageCircle aria-hidden="true" />{additionCount} 条追加</span>}</footer>
      </Link>
      <button type="button" className="icon-button" aria-label={note.isFavorite ? '取消收藏' : '收藏'} onClick={() => void toggleFavorite(note.id)}>
        <Heart fill={note.isFavorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}
