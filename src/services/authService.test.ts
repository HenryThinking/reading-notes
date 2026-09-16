import { beforeEach, expect, it, vi } from 'vitest'
import { getAuthSnapshot, login, logout, refreshAuthSession, setAuthStatus } from './authService'

beforeEach(() => {
  vi.restoreAllMocks()
  setAuthStatus('checking')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

it('Session true updates the single store immediately with include/no-store', async () => {
  const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ authenticated: true }))
  expect(await refreshAuthSession()).toBe(true)
  expect(getAuthSnapshot().status).toBe('authenticated')
  expect(request).toHaveBeenCalledWith('/api/auth/session', { credentials: 'include', cache: 'no-store' })
})

it('Session false is authoritative, unlike an HTTP or network error', async () => {
  setAuthStatus('authenticated')
  const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('failure', { status: 500 }))
  await refreshAuthSession()
  expect(getAuthSnapshot().status).toBe('authenticated')
  request.mockRejectedValueOnce(new Error('offline'))
  await refreshAuthSession()
  expect(getAuthSnapshot().status).toBe('authenticated')
  request.mockResolvedValueOnce(Response.json({ authenticated: false }, { status: 401 }))
  await refreshAuthSession()
  expect(getAuthSnapshot().status).toBe('unauthenticated')
})

it('Login rechecks the Cookie session before merging can start', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ authenticated: true }))
  await login(crypto.randomUUID())
  expect(getAuthSnapshot().status).toBe('authenticated')
})

it('Failed logout does not pretend the user is logged out', async () => {
  setAuthStatus('authenticated')
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('failure', { status: 403 }))
  await expect(logout()).rejects.toThrow('403')
  expect(getAuthSnapshot().status).toBe('authenticated')
})

it('A delayed old session response cannot undo successful logout', async () => {
  setAuthStatus('authenticated')
  let finish!: (response: Response) => void
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (input === '/api/auth/session') return new Promise<Response>((resolve) => { finish = resolve })
    return Response.json({ authenticated: false })
  })
  const pending = refreshAuthSession()
  await logout()
  finish(Response.json({ authenticated: true }))
  await pending
  expect(getAuthSnapshot().status).toBe('unauthenticated')
})
