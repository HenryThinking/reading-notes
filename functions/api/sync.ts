import { z } from 'zod'
import { noteAdditionSchema, noteSchema, settingsSchema, sourceSchema } from '../../src/domain/validation'
import type { SyncEntityPayload, SyncEntityType, SyncResponse, SyncServerChange } from '../../src/domain/models'
import { hasValidSession, isSameOrigin, json } from '../_lib/auth'

const MAX_BODY_BYTES = 512 * 1024
const MAX_PULL_EVENTS = 500
const entityTypeSchema = z.enum(['source', 'note', 'noteAddition', 'settings'])
const payloadByType = { source: sourceSchema, note: noteSchema, noteAddition: noteAdditionSchema, settings: settingsSchema }

const changeSchema = z.object({
  id: z.string().min(1).max(64), entityType: entityTypeSchema,
  baseVersion: z.number().int().nonnegative(), payload: z.unknown()
}).superRefine((change, context) => {
  const parsed = payloadByType[change.entityType].safeParse(change.payload)
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => context.addIssue({ code: 'custom', message: issue.message, path: ['payload', ...issue.path] }))
  } else if (parsed.data.id !== change.id) context.addIssue({ code: 'custom', message: '实体 ID 不一致', path: ['payload', 'id'] })
})

const requestSchema = z.object({
  cursor: z.number().int().nonnegative(), changes: z.array(changeSchema).max(50)
})

interface StoredRow { entity_type: SyncEntityType; entity_id: string; payload: string; revision: number }
interface EventRow extends StoredRow { seq: number }

function normalizePayload(entityType: SyncEntityType, payload: unknown, revision: number) {
  const parsed = payloadByType[entityType].parse(payload)
  return { ...parsed, serverVersion: revision, syncStatus: 'synced' } as SyncEntityPayload
}

function rowToChange(row: StoredRow): SyncServerChange {
  return { entityType: row.entity_type, id: row.entity_id, serverVersion: row.revision, payload: normalizePayload(row.entity_type, JSON.parse(row.payload), row.revision) }
}

async function currentRemote(database: D1Database, entityType: SyncEntityType, id: string) {
  const row = await database.prepare('SELECT entity_type, entity_id, payload, revision FROM sync_records WHERE entity_type = ?1 AND entity_id = ?2')
    .bind(entityType, id).first<StoredRow>()
  return row ? rowToChange(row) : undefined
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) return json({ error: '拒绝跨站请求' }, 403)
  if (!await hasValidSession(request, env.SESSION_SECRET)) return json({ error: '未登录或会话已过期' }, 401)
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return json({ error: '同步请求过大' }, 413)

  try {
    const bodyText = await request.text()
    if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) return json({ error: '同步请求过大' }, 413)
    const body = requestSchema.parse(JSON.parse(bodyText))
    const accepted: SyncResponse['accepted'] = []
    const conflicts: SyncResponse['conflicts'] = []

    for (const change of body.changes) {
      const entityType = change.entityType
      const nextVersion = change.baseVersion + 1
      const payload = normalizePayload(entityType, change.payload, nextVersion)
      const serialized = JSON.stringify(payload)
      const now = new Date().toISOString()
      const deletedAt = 'deletedAt' in payload ? payload.deletedAt ?? null : null
      let saved: { revision: number } | null
      if (change.baseVersion === 0) {
        saved = await env.DB.prepare(`INSERT INTO sync_records
          (entity_type, entity_id, payload, updated_at, deleted_at, revision, server_updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)
          ON CONFLICT(entity_type, entity_id) DO NOTHING RETURNING revision`)
          .bind(entityType, change.id, serialized, payload.updatedAt, deletedAt, now).first<{ revision: number }>()
      } else {
        saved = await env.DB.prepare(`UPDATE sync_records SET payload = ?1, updated_at = ?2, deleted_at = ?3,
          revision = revision + 1, server_updated_at = ?4
          WHERE entity_type = ?5 AND entity_id = ?6 AND revision = ?7 RETURNING revision`)
          .bind(serialized, payload.updatedAt, deletedAt, now, entityType, change.id, change.baseVersion).first<{ revision: number }>()
      }
      if (saved) accepted.push({ entityType, id: change.id, serverVersion: saved.revision })
      else {
        const remote = await currentRemote(env.DB, entityType, change.id)
        if (remote) conflicts.push(remote)
        else return json({ error: '同步版本异常，请重新拉取后再试' }, 409)
      }
    }

    const pull = await env.DB.prepare(`WITH page AS (
        SELECT seq, entity_type, entity_id FROM sync_events WHERE seq > ?1 ORDER BY seq LIMIT ?2
      ), latest AS (
        SELECT entity_type, entity_id, MAX(seq) AS seq FROM page GROUP BY entity_type, entity_id
      )
      SELECT latest.seq, records.entity_type, records.entity_id, records.payload, records.revision
      FROM latest JOIN sync_records AS records
        ON records.entity_type = latest.entity_type AND records.entity_id = latest.entity_id
      ORDER BY latest.seq`).bind(body.cursor, MAX_PULL_EVENTS).all<EventRow>()
    const rows = pull.results ?? []
    const nextCursor = rows.reduce((maximum, row) => Math.max(maximum, row.seq), body.cursor)
    const remaining = await env.DB.prepare('SELECT EXISTS(SELECT 1 FROM sync_events WHERE seq > ?1) AS value').bind(nextCursor).first<{ value: number }>()
    return json({ accepted, conflicts, changes: rows.map(rowToChange), cursor: nextCursor, hasMore: Boolean(remaining?.value) } satisfies SyncResponse)
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: '同步数据格式无效' }, 400)
    console.error(JSON.stringify({ message: 'sync_failed', error: error instanceof Error ? error.message : 'unknown' }))
    return json({ error: '同步服务暂时不可用' }, 500)
  }
}
