import { describe, expect, it } from 'vitest'
import { noteInputSchema } from './validation'

describe('noteInputSchema', () => {
  it('拒绝原文和感悟都为空', () => {
    const result = noteInputSchema.safeParse({ context: 'life', excerpt: '  ', reflection: '\n', tags: [], reviewEnabled: true })
    expect(result.success).toBe(false)
  })

  it('读书笔记必须选择书籍', () => {
    const result = noteInputSchema.safeParse({ context: 'reading', excerpt: '有内容', reflection: '', tags: [], reviewEnabled: true })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('读书笔记需要选择书籍')
  })
})
