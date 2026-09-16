import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Database, Download, HardDrive, Moon, Smartphone, Trash2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { db, defaultSettings } from '../../db/database'
import type { Theme } from '../../domain/models'
import { formatDateTime } from '../../lib/date'
import { analyzeBackup, createBackup, downloadBackup, importBackup, markBackupExported, type ImportPlan } from '../../services/backupService'

export function SettingsPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const settings = useLiveQuery(() => db.settings.get('singleton'), []) ?? defaultSettings
  const metadata = useLiveQuery(() => db.deviceMetadata.get('singleton'), [])
  const trashCount = useLiveQuery(async () => {
    const [notes, additions] = await Promise.all([
      db.notes.filter((note) => Boolean(note.deletedAt)).count(),
      db.noteAdditions.filter((item) => Boolean(item.deletedAt)).count()
    ])
    return notes + additions
  }, []) ?? 0
  const [plan, setPlan] = useState<ImportPlan>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => Promise<void> }>()

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as Event & { prompt: () => Promise<void> })
    }
    window.addEventListener('beforeinstallprompt', capture)
    return () => window.removeEventListener('beforeinstallprompt', capture)
  }, [])

  async function exportData() {
    const backup = await createBackup()
    downloadBackup(backup)
    await markBackupExported(backup.exportedAt)
    setMessage('备份已导出，请妥善保管文件。')
  }
  async function selectFile(file?: File) {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      setPlan(await analyzeBackup(parsed)); setError(''); setMessage('')
    } catch (caught) { setPlan(undefined); setError(caught instanceof Error ? `无法读取备份：${caught.message}` : '无法读取备份') }
  }
  async function confirmImport() {
    if (!plan) return
    await importBackup(plan)
    setMessage(`导入完成：新增 ${plan.added}、更新 ${plan.updated}、跳过 ${plan.skipped}。`)
    setPlan(undefined)
  }
  async function requestPersistence() {
    if (!navigator.storage?.persist) { setMessage('当前浏览器不支持主动请求持久存储。'); return }
    const granted = await navigator.storage.persist()
    setMessage(granted ? '浏览器已允许持久存储。仍建议定期导出备份。' : '浏览器未授予持久存储，请继续定期导出备份。')
  }

  return <div className="page narrow-page">
    <header className="page-header"><div><p className="overline">偏好与数据</p><h1>设置</h1></div></header>
    <section className="settings-card"><div className="settings-title"><Moon /><div><h2>外观</h2><p>选择适合阅读的颜色</p></div></div><select aria-label="外观" value={settings.theme} onChange={(event) => void db.settings.update('singleton', { theme: event.target.value as Theme })}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></section>
    <section className="settings-card"><div className="settings-title"><Database /><div><h2>每日复习上限</h2><p>控制每天重新遇见的笔记数量</p></div></div><select aria-label="每日复习上限" value={settings.dailyReviewLimit} onChange={(event) => void db.settings.update('singleton', { dailyReviewLimit: Number(event.target.value) as 5 | 10 | 20 })}><option value="5">5 条</option><option value="10">10 条</option><option value="20">20 条</option></select></section>
    <section className="settings-section"><h2>数据安全</h2><div className="settings-stack">
      <button type="button" className="settings-action" onClick={() => void exportData()}><Download /><span><strong>导出 JSON 备份</strong><small>{metadata?.lastExportedAt ? `本设备上次导出：${formatDateTime(metadata.lastExportedAt)}` : '本设备尚未导出过'}</small></span></button>
      <button type="button" className="settings-action" onClick={() => inputRef.current?.click()}><Upload /><span><strong>合并导入</strong><small>先校验并预览，不会直接写入</small></span></button>
      <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void selectFile(event.target.files?.[0])} />
      <button type="button" className="settings-action" onClick={() => void requestPersistence()}><HardDrive /><span><strong>请求持久存储</strong><small>能否成功由浏览器决定</small></span></button>
      <Link className="settings-action" to="/settings/trash"><Trash2 /><span><strong>回收站</strong><small>{trashCount} 条已删除笔记</small></span></Link>
    </div></section>
    {plan && <div className="import-preview" role="dialog" aria-label="导入预览"><h2>导入预览</h2><p>将新增 <strong>{plan.added}</strong> 条记录，更新 <strong>{plan.updated}</strong> 条，跳过 <strong>{plan.skipped}</strong> 条。</p><p className="muted">追加的思考与例子也包含在统计中。设备本地元数据不会被导入。</p><div className="form-actions"><button type="button" onClick={() => setPlan(undefined)}>取消</button><button type="button" className="primary-button" onClick={() => void confirmImport()}>确认导入</button></div></div>}
    {message && <p className="success-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <section className="settings-section"><h2>安装与数据说明</h2><div className="prose-card"><p>iPhone：在 Safari 中打开，点击“分享”，再选择“添加到主屏幕”。</p><p>笔记默认只保存在当前浏览器和当前域名中。换设备、清理站点数据或更换部署域名都可能看不到原数据，请定期导出备份。</p><p><code>lastExportedAt</code> 仅用于这台设备上的提醒，不进入备份，也不会参与未来云同步。</p></div></section>
    {installPrompt && <button type="button" className="primary-button install-button" onClick={() => { void installPrompt.prompt(); setInstallPrompt(undefined) }}><Smartphone />安装应用</button>}
  </div>
}
