import type { Note, NoteAddition } from '../domain/models'
import { normalizeText } from '../lib/text'

export interface SearchFilters {
  query?: string
  context?: 'all' | 'reading' | 'life'
  sourceId?: string
  tag?: string
  favoritesOnly?: boolean
}

export function matchesNote(note: Note, additions: NoteAddition[], filters: SearchFilters) {
  if (note.deletedAt) return false
  if (filters.context && filters.context !== 'all' && note.context !== filters.context) return false
  if (filters.sourceId && note.sourceId !== filters.sourceId) return false
  if (filters.tag && !note.tags.includes(filters.tag)) return false
  if (filters.favoritesOnly && !note.isFavorite) return false
  const query = normalizeText(filters.query ?? '')
  if (!query) return true
  const additionText = additions.filter((item) => item.noteId === note.id && !item.deletedAt).map((item) => item.content)
  const haystack = normalizeText([
    note.excerpt,
    note.reflection,
    note.sourceTitleSnapshot,
    note.sourceLabel ?? '',
    note.location ?? '',
    ...note.tags,
    ...additionText
  ].join('\n'))
  return haystack.includes(query)
}
