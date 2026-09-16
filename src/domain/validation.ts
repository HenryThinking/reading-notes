import { z } from 'zod'

const isoDate = z.string().datetime({ offset: true })

export const sourceSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['book', 'article', 'podcast', 'conversation', 'other']),
  title: z.string().trim().min(1),
  author: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: isoDate.optional()
})

export const noteSchema = z.object({
  id: z.string().uuid(),
  context: z.enum(['reading', 'life']),
  sourceId: z.string().uuid().optional(),
  sourceLabel: z.string().optional(),
  sourceTitleSnapshot: z.string(),
  excerpt: z.string(),
  reflection: z.string(),
  location: z.string().optional(),
  tags: z.array(z.string()),
  isFavorite: z.boolean(),
  reviewEnabled: z.boolean(),
  reviewStage: z.number().int().min(0).max(6),
  reviewCount: z.number().int().nonnegative(),
  lastReviewedAt: isoDate.optional(),
  nextReviewAt: isoDate.optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: isoDate.optional()
})

export const noteAdditionSchema = z.object({
  id: z.string().uuid(),
  noteId: z.string().uuid(),
  kind: z.enum(['thought', 'example']),
  content: z.string().trim().min(1),
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: isoDate.optional()
})

export const settingsSchema = z.object({
  id: z.literal('singleton'),
  theme: z.enum(['system', 'light', 'dark']),
  dailyReviewLimit: z.union([z.literal(5), z.literal(10), z.literal(20)]),
  schemaVersion: z.number().int().positive()
})

export const noteInputSchema = z.object({
  context: z.enum(['reading', 'life']),
  sourceId: z.union([z.literal(''), z.string().uuid()]).optional().transform((value) => value || undefined),
  sourceLabel: z.string().optional(),
  excerpt: z.string(),
  reflection: z.string(),
  location: z.string().optional(),
  tags: z.array(z.string()),
  reviewEnabled: z.boolean()
}).superRefine((value, ctx) => {
  if (!value.excerpt.trim() && !value.reflection.trim()) {
    ctx.addIssue({ code: 'custom', message: '原文和感悟至少填写一项', path: ['excerpt'] })
  }
  if (value.context === 'reading' && !value.sourceId) {
    ctx.addIssue({ code: 'custom', message: '读书笔记需要选择书籍', path: ['sourceId'] })
  }
})

export const backupEnvelopeSchema = z.object({
  format: z.literal('shiyenotes-backup'),
  version: z.literal(1),
  exportedAt: isoDate,
  appVersion: z.string(),
  sources: z.array(sourceSchema),
  notes: z.array(noteSchema),
  noteAdditions: z.array(noteAdditionSchema),
  settings: settingsSchema
})
