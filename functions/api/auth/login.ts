import { z } from 'zod'
import { createSessionCookie, isSameOrigin, json, timingSafeSecretEqual } from '../../_lib/auth'

const loginSchema = z.object({ password: z.string().min(1).max(512) })

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) return json({ error: '拒绝跨站请求' }, 403)
  if (!env.SYNC_PASSWORD || !env.SESSION_SECRET) return json({ error: '同步服务尚未配置' }, 503)
  try {
    if (Number(request.headers.get('Content-Length') ?? 0) > 2048) return json({ error: '请求过大' }, 413)
    const body = loginSchema.parse(await request.json())
    if (!await timingSafeSecretEqual(body.password, env.SYNC_PASSWORD)) return json({ error: '登录失败' }, 401)
    return json({ authenticated: true }, 200, { 'Set-Cookie': await createSessionCookie(env.SESSION_SECRET) })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: '请求格式无效' }, 400)
    console.error(JSON.stringify({ message: 'login_failed', error: error instanceof Error ? error.message : 'unknown' }))
    return json({ error: '登录服务暂时不可用' }, 500)
  }
}
