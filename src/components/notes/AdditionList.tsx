import type { NoteAddition } from '../../domain/models'
import { formatDateTime } from '../../lib/date'

export function AdditionList({ additions, editable = false, onEdit, onDelete }: {
  additions: NoteAddition[]
  editable?: boolean
  onEdit?: (addition: NoteAddition) => void
  onDelete?: (addition: NoteAddition) => void
}) {
  if (!additions.length) return null
  return (
    <section className="additions-section">
      <h2>后来想到的</h2>
      <div className="timeline">
        {additions.map((addition) => (
          <article className={`addition ${addition.kind}`} key={addition.id}>
            <div className="addition-meta"><strong>{addition.kind === 'thought' ? '新的思考' : '具体例子'}</strong><time>{formatDateTime(addition.createdAt)}</time></div>
            <p className="preserve-lines">{addition.content}</p>
            {editable && <div className="inline-actions">
              <button type="button" onClick={() => onEdit?.(addition)}>编辑</button>
              <button type="button" className="danger-text" onClick={() => onDelete?.(addition)}>删除</button>
            </div>}
          </article>
        ))}
      </div>
    </section>
  )
}
