import { addDays, set } from 'date-fns'

export function nextLocalNineAM(from: Date, days: number) {
  return set(addDays(from, days), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 })
}

export function formatDateTime(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value))
}
