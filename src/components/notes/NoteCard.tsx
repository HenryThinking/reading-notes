import { BookOpen, Heart, Lightbulb } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Note } from '../../domain/models'
import { formatDateTime } from '../../lib/date'
import { excerptText } from '../../lib/text'
import { toggleFavorite } from '../../repositories/noteRepository'

export function NoteCard({ note }: { note: Note }) {
  const preview = note.reflection || note.excerpt
  return (
    <article className="note-card">
      <Link to={`/notes/${note.id}`} className="note-card-main">
        <div className="eyebrow">
          {note.context === 'reading' ? <BookOpen /> : <Lightbulb />}
          <span>{note.sourceTitleSnapshot || (note.context === 'reading' ? '读书笔记' : '生活记录')}</span>
          <time>{formatDateTime(note.updatedAt)}</time>
        </div>
        <p>{excerptText(preview)}</p>
        {note.tags.length > 0 && <div className="tag-row">{note.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
      </Link>
      <button type="button" className="icon-button" aria-label={note.isFavorite ? '取消收藏' : '收藏'} onClick={() => void toggleFavorite(note.id)}>
        <Heart fill={note.isFavorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}
