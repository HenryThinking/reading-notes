import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, defaultSettings } from '../db/database'

export function useTheme() {
  const settings = useLiveQuery(() => db.settings.get('singleton')) ?? defaultSettings
  useEffect(() => {
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [settings.theme])
  return settings
}
