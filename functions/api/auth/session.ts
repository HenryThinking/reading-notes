import { hasValidSession, json } from '../../_lib/auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authenticated = await hasValidSession(request, env.SESSION_SECRET)
  return json({ authenticated }, authenticated ? 200 : 401)
}
