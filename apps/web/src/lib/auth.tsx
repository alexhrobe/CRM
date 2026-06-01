import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User as SupaUser } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { User } from '@crm-plp/shared'

interface AuthState {
  session: Session | null
  supaUser: SupaUser | null
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({
  session: null,
  supaUser: null,
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    supaUser: null,
    user: null,
    loading: true,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(s => ({ ...s, session, supaUser: session?.user ?? null }))
      if (session?.user) fetchProfile(session.user.id)
      else setState(s => ({ ...s, loading: false }))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(s => ({ ...s, session, supaUser: session?.user ?? null }))
      if (session?.user) fetchProfile(session.user.id)
      else setState(s => ({ ...s, user: null, loading: false }))
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(id: string) {
    const { data } = await supabase.from('users').select('*').eq('id', id).single()
    setState(s => ({ ...s, user: data, loading: false }))
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
