import { db } from '../db/database'
import type { SyncConflict, SyncEntityPayload } from '../domain/models'

function canonical(payload: SyncEntityPayload) {
  // A revision/time mismatch need not be a different piece of user content.
  return JSON.stringify(Object.entries(payload)
    .filter(([key]) => !['serverVersion', 'syncStatus', 'updatedAt'].includes(key))
    .sort(([a], [b]) => a.localeCompare(b)))
}

export function conflictHasContentDifference(conflict: SyncConflict) {
  return canonical(conflict.localPayload) !== canonical(conflict.remotePayload)
}

/** Acknowledge only after review. Keep the audit, both snapshots and every copy. */
export async function acknowledgeConflict(id: string) {
  await db.transaction('rw', [db.syncConflicts, db.syncMetadata, db.syncOutbox], async () => {
    const conflict = await db.syncConflicts.get(id)
    if (!conflict || conflict.resolvedAt) return
    await db.syncConflicts.update(id, { resolvedAt: new Date().toISOString() })
    const remaining = await db.syncConflicts.filter((item) => !item.resolvedAt).count()
    const metadata = await db.syncMetadata.get('singleton')
    if (!remaining && metadata?.status === 'conflict') {
      await db.syncMetadata.update('singleton', {
        status: await db.syncOutbox.count() ? (navigator.onLine ? 'idle' : 'offline') : 'synced'
      })
    }
  })
}
