import { NavLink } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useTasks } from '@/hooks/useTasks'
import { useQuoteRequests } from '@/hooks/useQuoteRequests'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Pipeline', icon: '⬡' },
  { to: '/solicitacoes', label: 'Solicitações', icon: '📨' },
  { to: '/hoje', label: 'Hoje', icon: '🔔' },
  { to: '/pedidos', label: 'Pedidos', icon: '📦' },
  { to: '/contas', label: 'Contas', icon: '🏢' },
  { to: '/contatos', label: 'Contatos', icon: '👤' },
  { to: '/atividades', label: 'Atividades', icon: '📋' },
  { to: '/dashboard', label: 'Dashboard', icon: '🌍' },
  { to: '/diretoria', label: 'Comando', icon: '🎯' },
  { to: '/relatorio', label: 'Relatório', icon: '📊' },
]

export function Sidebar() {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const { count } = useTasks()
  const { data: newRequests = [] } = useQuoteRequests('new')
  const badges: Record<string, number> = { '/hoje': count, '/solicitacoes': newRequests.length }

  return (
    <nav className="flex flex-col w-14 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center justify-center h-12 border-b border-gray-200 dark:border-gray-800">
        <span className="text-lg font-bold text-brand-600 dark:text-brand-400" title="CRM Export">E</span>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={item.label}
            className={({ isActive }) => cn(
              'relative w-9 h-9 flex items-center justify-center rounded-lg text-base transition-colors',
              isActive
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
            )}
          >
            <span role="img" aria-label={item.label} className="text-[18px] leading-none">{item.icon}</span>
            {badges[item.to] > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                {badges[item.to] > 9 ? '9+' : badges[item.to]}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center gap-2 pb-3">
        <button
          onClick={toggle}
          title="Alternar tema"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {user && (
          <div
            title={`${user.name} (${user.role})`}
            className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-300"
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </nav>
  )
}
