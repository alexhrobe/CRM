import { NavLink } from 'react-router-dom'
import {
  Kanban, Inbox, Bell, Package, Building2, Users, ClipboardList,
  Globe, Target, BarChart3, Sun, Moon, Ship, type LucideIcon,
} from 'lucide-react'
import { PRODUCT_NAME } from '@crm-plp/shared'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useTasks } from '@/hooks/useTasks'
import { useQuoteRequests } from '@/hooks/useQuoteRequests'
import { cn } from '@/lib/utils'

const NAV: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/', label: 'Pipeline', icon: Kanban },
  { to: '/solicitacoes', label: 'Solicitações', icon: Inbox },
  { to: '/hoje', label: 'Hoje', icon: Bell },
  { to: '/pedidos', label: 'Pedidos', icon: Package },
  { to: '/contas', label: 'Contas', icon: Building2 },
  { to: '/contatos', label: 'Contatos', icon: Users },
  { to: '/atividades', label: 'Atividades', icon: ClipboardList },
  { to: '/dashboard', label: 'Dashboard', icon: Globe },
  { to: '/diretoria', label: 'Comando', icon: Target },
  { to: '/relatorio', label: 'Relatório', icon: BarChart3 },
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
        <div
          title={PRODUCT_NAME}
          className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white"
        >
          <Ship size={17} strokeWidth={2} aria-label={PRODUCT_NAME} />
        </div>
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
              'relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
              isActive
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
            )}
          >
            <item.icon size={18} strokeWidth={1.75} aria-label={item.label} />
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
          {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
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
