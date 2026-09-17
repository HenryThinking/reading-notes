import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, defaultSettings } from '../db/database'

export function useTheme() {
  const settings = useLiveQuery(() => db.settings.get('singleton')) ?? defaultSettings
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#151918' : '#f5f6f3')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings.theme])
  return settings
}
