import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type Role = 'admin' | 'partner' | 'team_member' | 'client' | null

interface SessionExt {
  userId: string
  email: string | null
  nome: string | null
  role: Role
}

interface AuthCtx {
  session: SessionExt | null
  loading: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  session: null,
  loading: true,
  signOut: async () => {},
  refresh: async () => {},
})

async function loadProfile(s: Session | null): Promise<SessionExt | null> {
  if (!s?.user) return null
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome_completo, email, role')
    .eq('id', s.user.id)
    .maybeSingle()
  return {
    userId: s.user.id,
    email: s.user.email ?? data?.email ?? null,
    nome: data?.nome_completo ?? null,
    role: (data?.role as Role) ?? null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionExt | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      const ext = await loadProfile(data.session)
      if (mounted) {
        setSession(ext)
        setLoading(false)
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      const ext = await loadProfile(s)
      if (mounted) setSession(ext)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <Ctx.Provider
      value={{
        session,
        loading,
        signOut: async () => {
          await supabase.auth.signOut()
          setSession(null)
        },
        refresh: async () => {
          const { data } = await supabase.auth.getSession()
          setSession(await loadProfile(data.session))
        },
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)

