import { describe, expect, it } from 'vitest'
import type { Note } from '../domain/models'
import { calculateReviewUpdate } from './reviewService'

function noteAt(stage: number): Note {
  return {
    id: '00000000-0000-4000-8000-000000000001', context: 'life', sourceTitleSnapshot: '', excerpt: '原文', reflection: '', tags: [],
    isFavorite: false, reviewEnabled: true, reviewStage: stage, reviewCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', serverVersion: 0, syncStatus: 'pending'
  }
}

describe('calculateReviewUpdate', () => {
  const now = new Date('2026-09-15T04:00:00.000Z')

  it('在 stage 0 再看看时保持下限并安排一天后', () => {
    const result = calculateReviewUpdate(noteAt(0), 'again', now)
    expect(result.reviewStage).toBe(0)
    expect(result.reviewCount).toBe(1)
    expect(new Date(result.nextReviewAt!).getTime()).toBeGreaterThan(now.getTime())
  })

  it('在 stage 6 很熟悉时保持上限', () => {
    expect(calculateReviewUpdate(noteAt(6), 'familiar', now).reviewStage).toBe(6)
  })

  it('有印象增加一个阶段', () => {
    expect(calculateReviewUpdate(noteAt(2), 'remembered', now).reviewStage).toBe(3)
  })
})
