import { useSyncExternalStore } from 'react'

export type AuthStatus = 'checking' | 'unauthenticated' | 'authenticated'
interface AuthSnapshot { status: AuthStatus; lastError?: string }
let snapshot: AuthSnapshot = { status: 'checking' }
const listeners = new Set<() => void>()
let sessionCheck: Promise<boolean> | undefined
let epoch = 0

export function getAuthSnapshot() { return snapshot }
export function getAuthEpoch() { return epoch }
// A successful authenticated API response is newer evidence than an old failed
// session probe. Never let an in-flight response resurrect a logged-out session.
export function confirmSyncSession(requestEpoch: number) {
  if (requestEpoch !== epoch || snapshot.status !== 'authenticated') return
  epoch += 1
  setAuthStatus('authenticated')
}
export function setAuthStatus(status: AuthStatus, lastError?: string) {
  snapshot = { status, lastError }
  listeners.forEach((listener) => listener())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function useAuth() {
  return useSyncExternalStore(subscribe, getAuthSnapshot, getAuthSnapshot)
}

// Transport/5xx failures are not evidence that a valid Cookie has expired.
export function refreshAuthSession(): Promise<boolean> {
  if (sessionCheck) return sessionCheck
  const requestEpoch = epoch
  sessionCheck = (async () => {
    if (!navigator.onLine) return snapshot.status === 'authenticated'
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      if (response.status !== 200 && response.status !== 401) throw new Error(`会话检查失败（${response.status}）`)
      const body = await response.json() as { authenticated?: boolean }
      if (typeof body.authenticated !== 'boolean') throw new Error('会话接口没有返回有效 JSON 状态')
      if (requestEpoch === epoch) setAuthStatus(body.authenticated ? 'authenticated' : 'unauthenticated')
    } catch (error) {
      if (requestEpoch === epoch) setAuthStatus(snapshot.status, error instanceof Error ? error.message : '无法检查会话')
    }
    return snapshot.status === 'authenticated'
  })().finally(() => { sessionCheck = undefined })
  return sessionCheck
}

export async function login(password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST', credentials: 'include', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
  })
  if (!response.ok) throw new Error(response.status === 401 ? '登录密码不正确' : '登录失败')
  epoch += 1
  await sessionCheck
  if (!await refreshAuthSession()) throw new Error('登录后未能确认安全会话，请重试')
}

export function rejectSyncSession() {
  epoch += 1
  setAuthStatus('unauthenticated')
}

export async function logout() {
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' })
  if (!response.ok) throw new Error(`退出登录失败（${response.status}）`)
  rejectSyncSession()
}
