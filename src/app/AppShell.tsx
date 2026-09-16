import { BookOpen, Home, Library, Plus, RotateCcw, Settings } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { UpdatePrompt } from '../components/ui/UpdatePrompt'

const navigation = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/notes', label: '笔记库', icon: Library },
  { to: '/review', label: '复习', icon: RotateCcw },
  { to: '/settings', label: '设置', icon: Settings }
]

export function AppShell() {
  useTheme()
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <NavLink to="/" className="brand"><BookOpen aria-hidden="true" /><span>拾页</span></NavLink>
        <nav>
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink to="/notes/new" className="primary-button sidebar-new"><Plus aria-hidden="true" />记一条</NavLink>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
      <NavLink to="/notes/new" className="floating-add" aria-label="记一条"><Plus /></NavLink>
      <nav className="bottom-nav" aria-label="主导航">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <UpdatePrompt />
    </div>
  )
}
