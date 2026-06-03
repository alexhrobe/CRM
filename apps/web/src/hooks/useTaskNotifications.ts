import { useCallback, useEffect, useState } from 'react'
import type { AutomationTask } from '@/lib/automations/rules'

type Perm = 'default' | 'granted' | 'denied' | 'unsupported'

function currentPerm(): Perm {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * Notificações push do navegador para tarefas críticas (enquanto o app está
 * aberto). Deduplica por dia via localStorage para não repetir o mesmo alerta.
 */
export function useTaskNotifications(tasks: AutomationTask[]) {
  const [permission, setPermission] = useState<Perm>(currentPerm)

  const enable = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setPermission(p)
  }, [])

  useEffect(() => {
    if (permission !== 'granted' || typeof Notification === 'undefined') return
    const key = `crm:notified:${new Date().toISOString().slice(0, 10)}`
    const seen = new Set<string>(JSON.parse(localStorage.getItem(key) || '[]'))
    const fresh = tasks.filter((t) => t.severity === 'critical' && !seen.has(t.id)).slice(0, 5)
    if (fresh.length === 0) return
    for (const t of fresh) {
      new Notification(`CRM · ${t.title}`, {
        body: `${t.accountName} — ${t.quoteNumber}: ${t.detail}`,
        tag: t.id,
      })
      seen.add(t.id)
    }
    localStorage.setItem(key, JSON.stringify([...seen]))
  }, [tasks, permission])

  return { permission, enable }
}
