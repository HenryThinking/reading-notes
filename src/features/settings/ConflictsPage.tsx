import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, GitCompareArrows } from 'lucide-react'
import { Link } from 'react-router-dom'
import { db } from '../../db/database'
import type { SyncEntityPayload } from '../../domain/models'
import { formatDateTime } from '../../lib/date'
import { acknowledgeConflict, conflictHasContentDifference } from '../../services/conflictService'

const fieldLabels: Record<string, string> = {
  excerpt: '原文', reflection: '我的思考', title: '来源名称', author: '作者',
  content: '追加内容', tags: '标签', deletedAt: '删除时间', context: '类型',
  theme: '外观', dailyReviewLimit: '每日复习上限', sourceTitleSnapshot: '来源快照'
}

function Snapshot({ title, payload }: { title: string; payload: SyncEntityPayload }) {
  const fields = Object.entries(payload).filter(([key]) => key in fieldLabels)
  const deleted = 'deletedAt' in payload && payload.deletedAt
  return <section className="conflict-snapshot"><h3>{title}</h3>
    <p className="muted">版本 {payload.serverVersion} · {formatDateTime(payload.updatedAt)}</p>
    <p className={deleted ? 'danger-text' : 'muted'}>{deleted ? '此版本已软删除（墓碑保留）' : '此版本未删除'}</p>
    <dl>{fields.map(([key, value]) => <div key={key}><dt>{fieldLabels[key]}</dt><dd className="preserve-lines">{Array.isArray(value) ? value.join('、') || '无' : String(value ?? '') || '无'}</dd></div>)}</dl>
    <details><summary>完整记录（含复习与关联信息）</summary><pre>{JSON.stringify(payload, null, 2)}</pre></details>
  </section>
}

export function ConflictsPage() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string>()
  const data = useLiveQuery(async () => ({
    conflicts: await db.syncConflicts.orderBy('createdAt').reverse().toArray(),
    notes: await db.notes.toArray(), additions: await db.noteAdditions.toArray(), sources: await db.sources.toArray()
  }), [])
  const pending = data?.conflicts.filter((item) => !item.resolvedAt) ?? []
  const resolved = data?.conflicts.filter((item) => item.resolvedAt) ?? []

  async function acknowledge(id: string) {
    setBusy(id); setError('')
    try { await acknowledgeConflict(id) }
    catch (caught) { setError(caught instanceof Error ? caught.message : '无法标记处理结果，请重试') }
    finally { setBusy(undefined) }
  }

  return <div className="page conflicts-page">
    <header className="detail-header"><Link className="icon-button" to="/settings" aria-label="返回设置"><ArrowLeft /></Link></header>
    <header className="page-header"><div><p className="overline">双方内容，完整保留</p><h1>同步冲突</h1></div><GitCompareArrows /></header>
    <p className="muted">这里显示冲突发生时的双方快照，不是请求失败。原记录接收云端版本，本地修改已保留为冲突副本；设置差异完整保留在此。确认保留双方仅标记本机处理结果，不覆盖、删除或再次上传任何内容。</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {data === undefined ? <p className="muted">正在读取冲突记录…</p> : !pending.length && <div className="empty-state"><Check /><p>没有待处理的冲突</p><p>已处理记录和双方快照仍在本机保留。</p></div>}
    <div className="conflict-list">{pending.map((conflict) => {
      const noteId = conflict.entityType === 'note' ? conflict.entityId : conflict.entityType === 'noteAddition' ? (conflict.localPayload as { noteId: string }).noteId : undefined
      const copies = conflict.entityType === 'note' ? data?.notes.filter((note) => note.conflictOf === conflict.entityId && !note.deletedAt) : []
      return <article className="conflict-record" key={conflict.id}>
        <div className="section-heading"><h2>{({ source: '来源', note: '笔记', noteAddition: '追加感悟', settings: '用户设置' } as const)[conflict.entityType]} · {conflictHasContentDifference(conflict) ? '内容有差异' : '内容相同，仅版本或更新时间不同'}</h2></div>
        <p className="muted">发现于 {formatDateTime(conflict.createdAt)} · 云端 revision {conflict.remoteVersion}</p>
        <div className="conflict-comparison"><Snapshot title="本机保留的版本" payload={conflict.localPayload} /><Snapshot title="当时的云端版本" payload={conflict.remotePayload} /></div>
        <div className="conflict-links">
          {noteId && <Link className="secondary-button" to={`/notes/${noteId}`}>查看当前笔记</Link>}
          {copies?.map((copy, index) => <Link key={copy.id} className="secondary-button" to={`/notes/${copy.id}`}>查看冲突副本{copies.length > 1 ? ` ${index + 1}` : ''}</Link>)}
          {conflict.entityType === 'source' && data?.sources.filter((source) => source.conflictOf === conflict.entityId && !source.deletedAt).map((source) => <Link key={source.id} className="secondary-button" to={`/sources/${source.id}`}>查看来源副本</Link>)}
          {conflict.entityType === 'settings' && <Link className="secondary-button" to="/settings">在设置中手动调整</Link>}
          <Link className="text-button" to="/settings/trash">查看回收站</Link>
        </div>
        <p className="muted">可进入详情手动整理内容，或原样保留两份。请先核对上方完整记录；确认后历史仍可查看。</p>
        <button className="primary-button" type="button" disabled={busy === conflict.id} onClick={() => void acknowledge(conflict.id)}>已核对，保留双方并标记已处理</button>
      </article>
    })}</div>
    {!!resolved.length && <details className="conflict-history"><summary>已处理历史 · {resolved.length} 项</summary>{resolved.map((conflict) => <details className="conflict-record" key={conflict.id}><summary>{formatDateTime(conflict.createdAt)} · {conflict.entityType} · 已保留双方</summary><div className="conflict-comparison"><Snapshot title="本机快照" payload={conflict.localPayload} /><Snapshot title="云端快照" payload={conflict.remotePayload} /></div></details>)}</details>}
  </div>
}
