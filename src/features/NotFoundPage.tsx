import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <div className="empty-state page"><h1>这一页还不存在</h1><p>也许它还没被写下来。</p><Link to="/" className="primary-button">回到首页</Link></div>
}
