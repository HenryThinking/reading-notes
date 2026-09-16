export type NoteContext = 'reading' | 'life'
export type SourceKind = 'book' | 'article' | 'podcast' | 'conversation' | 'other'
export type AdditionKind = 'thought' | 'example'
export type Theme = 'system' | 'light' | 'dark'

export interface Source {
  id: string
  kind: SourceKind
  title: string
  author?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface Note {
  id: string
  context: NoteContext
  sourceId?: string
  sourceLabel?: string
  sourceTitleSnapshot: string
  excerpt: string
  reflection: string
  location?: string
  tags: string[]
  isFavorite: boolean
  reviewEnabled: boolean
  reviewStage: number
  reviewCount: number
  lastReviewedAt?: string
  nextReviewAt?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface NoteAddition {
  id: string
  noteId: string
  kind: AdditionKind
  content: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface Draft {
  id: string
  payload: Partial<NoteInput>
  updatedAt: string
}

export interface AppSettings {
  id: 'singleton'
  theme: Theme
  dailyReviewLimit: 5 | 10 | 20
  schemaVersion: number
}

/** 仅属于当前浏览器设备；禁止进入备份或云同步。 */
export interface DeviceMetadata {
  id: 'singleton'
  lastExportedAt?: string
}

export interface NoteInput {
  context: NoteContext
  sourceId?: string
  sourceLabel?: string
  excerpt: string
  reflection: string
  location?: string
  tags: string[]
  reviewEnabled: boolean
}

export interface BackupEnvelopeV1 {
  format: 'shiyenotes-backup'
  version: 1
  exportedAt: string
  appVersion: string
  sources: Source[]
  notes: Note[]
  noteAdditions: NoteAddition[]
  settings: AppSettings
}

export type ReviewAction = 'again' | 'remembered' | 'familiar'
