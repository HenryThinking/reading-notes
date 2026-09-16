import { clearSessionCookie, isSameOrigin, json } from '../../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  if (!isSameOrigin(request)) return json({ error: '拒绝跨站请求' }, 403)
  return json({ authenticated: false }, 200, { 'Set-Cookie': clearSessionCookie() })
}
