export type NoteContext = 'reading' | 'life'
export type SourceKind = 'book' | 'article' | 'podcast' | 'conversation' | 'other'
export type AdditionKind = 'thought' | 'example'
export type Theme = 'system' | 'light' | 'dark'
export type SyncStatus = 'pending' | 'synced' | 'conflict'
export type SyncEntityType = 'source' | 'note' | 'noteAddition' | 'settings'
export type SyncUiStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict'

export interface Source {
  id: string
  kind: SourceKind
  title: string
  author?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  serverVersion: number
  syncStatus: SyncStatus
  conflictOf?: string
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
  serverVersion: number
  syncStatus: SyncStatus
  conflictOf?: string
}

export interface NoteAddition {
  id: string
  noteId: string
  kind: AdditionKind
  content: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  serverVersion: number
  syncStatus: SyncStatus
  conflictOf?: string
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
  updatedAt: string
  serverVersion: number
  syncStatus: SyncStatus
}

/** 仅属于当前浏览器设备；禁止进入备份或云同步。 */
export interface DeviceMetadata {
  id: 'singleton'
  lastExportedAt?: string
}

export interface SyncLocalMetadata {
  id: 'singleton'
  cursor: number
  status: SyncUiStatus
  enabledAt?: string
  lastSyncedAt?: string
  lastError?: string
}

export interface SyncOutboxEntry {
  id: string
  entityType: SyncEntityType
  entityId: string
  baseVersion: number
  queuedAt: string
  updatedAt: string
  attempts: number
  lastError?: string
}

export interface SyncConflict {
  id: string
  entityType: SyncEntityType
  entityId: string
  localPayload: SyncEntityPayload
  remotePayload: SyncEntityPayload
  remoteVersion: number
  createdAt: string
  resolvedAt?: string
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

export type SyncEntityPayload = Source | Note | NoteAddition | AppSettings

export interface SyncChange {
  id: string
  entityType: SyncEntityType
  baseVersion: number
  payload: SyncEntityPayload
}

export interface SyncServerChange {
  id: string
  entityType: SyncEntityType
  serverVersion: number
  payload: SyncEntityPayload
}

export interface SyncResponse {
  accepted: Array<{ id: string; entityType: SyncEntityType; serverVersion: number }>
  conflicts: SyncServerChange[]
  changes: SyncServerChange[]
  cursor: number
  hasMore: boolean
}
