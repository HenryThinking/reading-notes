import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'

export function ErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? error.statusText : error instanceof Error ? error.message : '发生了未知错误'
  return <div className="page empty-state"><h1>这一页没能打开</h1><p>{message}</p><Link to="/">回到首页</Link></div>
}
