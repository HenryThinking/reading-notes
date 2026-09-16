const COOKIE_NAME = '__Host-shiye_session'
const SESSION_SECONDS = 30 * 24 * 60 * 60
const encoder = new TextEncoder()

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function decodeBase64Url(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

export async function timingSafeSecretEqual(provided: string, expected: string | undefined) {
  if (!expected) return false
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)), crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ])
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash)
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  return origin === new URL(request.url).origin && request.headers.get('Sec-Fetch-Site') !== 'cross-site'
}

export async function createSessionCookie(secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  const nonce = new Uint8Array(16)
  crypto.getRandomValues(nonce)
  const payload = `${expiresAt}.${base64Url(nonce)}`
  return `${COOKIE_NAME}=${payload}.${base64Url(await hmac(payload, secret))}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

export async function hasValidSession(request: Request, secret: string | undefined) {
  if (!secret) return false
  const cookies = request.headers.get('Cookie') ?? ''
  const raw = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1)
  if (!raw) return false
  const parts = raw.split('.')
  if (parts.length !== 3) return false
  const [expiresText, nonce, suppliedSignature] = parts
  const expiresAt = Number(expiresText)
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false
  try {
    const expected = await hmac(`${expiresText}.${nonce}`, secret)
    const supplied = decodeBase64Url(suppliedSignature)
    const [suppliedHash, expectedHash] = await Promise.all([
      crypto.subtle.digest('SHA-256', supplied), crypto.subtle.digest('SHA-256', expected)
    ])
    return crypto.subtle.timingSafeEqual(suppliedHash, expectedHash)
  } catch { return false }
}

export const noStoreHeaders = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie, Origin' }

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers: { ...noStoreHeaders, ...headers } })
}
