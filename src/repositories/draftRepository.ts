import { db } from '../db/database'
import type { NoteInput } from '../domain/models'

export async function saveDraft(id: string, payload: Partial<NoteInput>) {
  await db.drafts.put({ id, payload, updatedAt: new Date().toISOString() })
}

export async function deleteDraft(id: string) {
  await db.drafts.delete(id)
}
