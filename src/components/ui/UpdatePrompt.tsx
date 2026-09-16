import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="toast" role="status">
      <span>发现新版本</span>
      <button type="button" onClick={() => void updateServiceWorker(true)}>刷新</button>
    </div>
  )
}
