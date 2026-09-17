import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, Database, Download, HardDrive, Moon, Smartphone, Trash2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { db, defaultSettings } from '../../db/database'
import type { Theme } from '../../domain/models'
import { formatDateTime } from '../../lib/date'
import { analyzeBackup, createBackup, downloadBackup, importBackup, markBackupExported, type ImportPlan } from '../../services/backupService'
import { backupBeforeFirstSync, enableSync, syncNow } from '../../services/syncService'
import { getAuthSnapshot, login, logout, refreshAuthSession, useAuth } from '../../services/authService'
import { updateDailyReviewLimit, updateTheme } from '../../repositories/settingsRepository'

export function SettingsPage() {
  const auth = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const settings = useLiveQuery(() => db.settings.get('singleton'), []) ?? defaultSettings
  const metadata = useLiveQuery(() => db.deviceMetadata.get('singleton'), [])
  const syncMetadata = useLiveQuery(() => db.syncMetadata.get('singleton'), [])
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
  const [syncError, setSyncError] = useState<{ message: string; successfulSyncAt?: string }>()
  const [password, setPassword] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => Promise<void> }>()
  const syncCounts = useLiveQuery(async () => ({
    pending: await db.syncOutbox.count(),
    conflicts: await db.syncConflicts.filter((item) => !item.resolvedAt).count()
  }), []) ?? { pending: 0, conflicts: 0 }

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
  async function authenticateAndSync() {
    if (!password) { setSyncError({ message: '请输入同步密码', successfulSyncAt: syncMetadata?.lastSyncedAt }); return }
    setSyncBusy(true); setMessage(''); setSyncError(undefined)
    try {
      const firstEnable = !syncMetadata?.enabledAt
      if (firstEnable) {
        if (!await backupBeforeFirstSync()) return
      }
      await login(password)
      setPassword('')
      if (firstEnable) await enableSync()
      else await syncNow()
      setMessage(firstEnable ? '本地备份已生成，首次合并同步完成。' : '登录并同步完成。')
    }
    catch (caught) { setSyncError({ message: caught instanceof Error ? caught.message : '同步失败', successfulSyncAt: (await db.syncMetadata.get('singleton'))?.lastSyncedAt }) }
    finally { setSyncBusy(false) }
  }
  async function runSync() {
    setSyncBusy(true); setMessage(''); setSyncError(undefined)
    try {
      if (!syncMetadata?.enabledAt) {
        if (!await backupBeforeFirstSync()) return
        await enableSync()
      } else await syncNow()
      setMessage('云同步完成。')
    }
    catch (caught) { setSyncError({ message: caught instanceof Error ? caught.message : '同步失败', successfulSyncAt: (await db.syncMetadata.get('singleton'))?.lastSyncedAt }) }
    finally { setSyncBusy(false) }
  }
  async function signOut() {
    setSyncError(undefined)
    try { await logout(); setMessage('已退出云同步登录，本地数据仍可正常使用。') }
    catch (caught) { setSyncError({ message: caught instanceof Error ? caught.message : '退出失败', successfulSyncAt: syncMetadata?.lastSyncedAt }) }
  }
  async function retrySession() {
    setSyncBusy(true); setSyncError(undefined); setMessage('')
    try {
      const authenticated = await refreshAuthSession()
      if (getAuthSnapshot().lastError) return
      if (authenticated) {
        if (!syncMetadata?.enabledAt) {
          if (!await backupBeforeFirstSync()) return
          await enableSync()
        } else await syncNow()
      }
      setMessage(authenticated ? '会话已确认，同步完成。' : '会话已检查，请重新登录。')
    } catch (caught) { setSyncError({ message: caught instanceof Error ? caught.message : '重试失败', successfulSyncAt: (await db.syncMetadata.get('singleton'))?.lastSyncedAt }) }
    finally { setSyncBusy(false) }
  }

  const statusText = ({
    idle: '未启动', syncing: '合并中', synced: '已同步', offline: '离线待同步', error: '同步失败', conflict: '冲突'
  } as const)[syncMetadata?.status ?? 'idle']
  const authText = ({ checking: '检查中', unauthenticated: '未登录', authenticated: '已登录' } as const)[auth.status]

  return <div className="page narrow-page">
    <header className="page-header"><div><p className="overline">偏好与数据</p><h1>设置</h1></div></header>
    <section className="settings-card"><div className="settings-title"><Moon /><div><h2>外观</h2><p>选择适合阅读的颜色</p></div></div><select aria-label="外观" value={settings.theme} onChange={(event) => void updateTheme(event.target.value as Theme)}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></section>
    <section className="settings-card"><div className="settings-title"><Database /><div><h2>每日复习上限</h2><p>控制每天重新遇见的笔记数量</p></div></div><select aria-label="每日复习上限" value={settings.dailyReviewLimit} onChange={(event) => void updateDailyReviewLimit(Number(event.target.value) as 5 | 10 | 20)}><option value="5">5 条</option><option value="10">10 条</option><option value="20">20 条</option></select></section>
    <section className="settings-section"><h2>云同步</h2><div className="prose-card">
      <div className="settings-title"><Cloud /><div><h3>Cloudflare D1</h3><p>离线修改仍会立即保存在本机，联网后再同步。</p></div></div>
      <p><strong>状态：<span data-testid="auth-status">{authText}</span> · <span data-testid="sync-status">{statusText}</span></strong></p>
      <p className="muted">版本：{import.meta.env.APP_COMMIT ?? 'local'} · {window.location.origin}</p>
      {auth.lastError && <div className="form-error" role="status"><p>上次会话请求未完成，{auth.status === 'authenticated' ? '已确认的登录状态保留' : '暂时无法确认登录'}。本地笔记不受影响。</p><small>请求详情：{auth.lastError}</small><button type="button" className="secondary-button" disabled={syncBusy} onClick={() => void retrySession()}>重试会话检查</button></div>}
      {auth.status !== 'authenticated' && <label className="field-group"><span>同步密码</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入 Cloudflare 中配置的同步密码" /></label>}
      <p className="muted">密码只用于本次登录请求，不会保存到 IndexedDB、源码或构建产物。登录成功后使用安全的 HttpOnly Cookie。</p>
      <div className="form-actions">
        {auth.status !== 'authenticated' ? <button type="button" className="primary-button" disabled={syncBusy} onClick={() => void authenticateAndSync()}>{syncBusy ? '登录中…' : syncMetadata?.enabledAt ? '登录并同步' : '备份并开启同步'}</button> : <><button type="button" onClick={() => void signOut()}>退出登录</button><button type="button" className="primary-button" disabled={syncBusy} onClick={() => void runSync()}>{syncBusy ? '合并中…' : '立即同步'}</button></>}
      </div>
      <p className="muted">待同步 {syncCounts.pending} 条 · 冲突 {syncCounts.conflicts} 条{syncMetadata?.lastSyncedAt ? ` · 上次成功 ${formatDateTime(syncMetadata.lastSyncedAt)}` : ''}</p>
      <Link className="settings-action conflict-entry" to="/settings/conflicts"><span><strong>{syncCounts.conflicts ? `查看与处理 ${syncCounts.conflicts} 项冲突` : '查看冲突历史'}</strong><small>区分内容差异与版本差异，双方内容均保留</small></span></Link>
      {syncMetadata?.lastError && <p className="form-error">上次同步：{syncMetadata.lastError}</p>}
      {syncError && syncError.successfulSyncAt === syncMetadata?.lastSyncedAt && <p className="form-error" role="alert">{syncError.message}</p>}
    </div></section>
    <section className="settings-section"><h2>数据安全</h2><div className="settings-stack">
      <button type="button" className="settings-action" onClick={() => void exportData()}><Download /><span><strong>导出 JSON 备份</strong><small>{metadata?.lastExportedAt ? `本设备上次导出：${formatDateTime(metadata.lastExportedAt)}` : '本设备尚未导出过'}</small></span></button>
      <button type="button" className="settings-action" onClick={() => inputRef.current?.click()}><Upload /><span><strong>合并导入</strong><small>先校验并预览，不会直接写入</small></span></button>
      <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void selectFile(event.target.files?.[0])} />
      <button type="button" className="settings-action" onClick={() => void requestPersistence()}><HardDrive /><span><strong>请求持久存储</strong><small>能否成功由浏览器决定</small></span></button>
      <Link className="settings-action" to="/settings/trash"><Trash2 /><span><strong>回收站</strong><small>{trashCount} 条已删除笔记</small></span></Link>
    </div></section>
    {plan && <div className="import-preview" role="dialog" aria-label="导入预览"><h2>导入预览</h2><p>将新增 <strong>{plan.added}</strong> 条记录，更新 <strong>{plan.updated}</strong> 条，跳过 <strong>{plan.skipped}</strong> 条。</p><p className="muted">追加的思考与例子也包含在统计中。设备本地元数据不会被导入。</p><div className="form-actions"><button type="button" onClick={() => setPlan(undefined)}>取消</button><button type="button" className="primary-button" onClick={() => void confirmImport()}>确认导入</button></div></div>}
    {message && <p className="success-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <section className="settings-section"><h2>安装与数据说明</h2><div className="prose-card"><p>iPhone：在 Safari 中打开，点击“分享”，再选择“添加到主屏幕”。</p><p>笔记始终优先保存在当前浏览器；云同步用于跨设备复制和恢复，不会阻止离线使用。</p><p><code>lastExportedAt</code>、草稿、同步游标、outbox 和同步状态仅属于这台设备，不进入云端业务数据。</p></div></section>
    {installPrompt && <button type="button" className="primary-button install-button" onClick={() => { void installPrompt.prompt(); setInstallPrompt(undefined) }}><Smartphone />安装应用</button>}
  </div>
}
