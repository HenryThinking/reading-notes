import type { Note, ReviewAction } from '../domain/models'
import { nextLocalNineAM } from '../lib/date'

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60, 120] as const

export function calculateReviewUpdate(note: Note, action: ReviewAction, now = new Date()): Pick<Note, 'reviewStage' | 'reviewCount' | 'lastReviewedAt' | 'nextReviewAt' | 'updatedAt'> {
  const delta = action === 'again' ? -1 : action === 'remembered' ? 1 : 2
  const reviewStage = Math.max(0, Math.min(6, note.reviewStage + delta))
  const days = action === 'again' ? 1 : REVIEW_INTERVALS[reviewStage]
  const timestamp = now.toISOString()
  return {
    reviewStage,
    reviewCount: note.reviewCount + 1,
    lastReviewedAt: timestamp,
    nextReviewAt: nextLocalNineAM(now, days).toISOString(),
    updatedAt: timestamp
  }
}
