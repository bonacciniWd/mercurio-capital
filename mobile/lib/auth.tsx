import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState, Modal, View, ActivityIndicator, type AppStateStatus } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { getDeviceRelockSeconds, getIdleConfig } from './securityConfig'
import { DeviceLock } from '@/components/DeviceLock'
import { setQueryIdentity } from './queryClient'

type Role = 'admin' | 'partner' | 'team_member' | 'client' | null
type AdminNivel = 'full' | 'limitado' | 'juridico'

interface SessionExt {
  userId: string
  email: string | null
  nome: string | null
  role: Role
  adminNivel: AdminNivel
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

  const rawAdminNivel = (s.user.app_metadata as { admin_nivel?: unknown } | undefined)?.admin_nivel
  const adminNivel: AdminNivel =
    rawAdminNivel === 'limitado' || rawAdminNivel === 'juridico' || rawAdminNivel === 'full'
      ? rawAdminNivel
      : 'full'

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
    adminNivel,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionExt | null>(null)
  const [loading, setLoading] = useState(true)
  const [deviceLocked, setDeviceLocked] = useState(false)
  const [lockReason, setLockReason] = useState<'startup' | 'resume'>('startup')
  const backgroundedAt = useRef<number | null>(null)
  const localPromptActive = useRef(false)
  const profileRevision = useRef(0)

  const signOut = useCallback(async () => {
    profileRevision.current += 1
    setQueryIdentity(null)
    setSession(null)
    setDeviceLocked(false)
    await supabase.auth.signOut()
  }, [])

  const refresh = useCallback(async () => {
    const revision = ++profileRevision.current
    const { data } = await supabase.auth.getSession()
    const ext = await loadProfile(data.session)
    if (revision !== profileRevision.current) return
    setQueryIdentity(data.session?.user.id ?? null)
    setSession(ext)
    setLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true
    function syncSession(authSession: Session | null, startup: boolean) {
      if (!mounted) return
      const revision = ++profileRevision.current
      if (setQueryIdentity(authSession?.user.id ?? null)) {
        setSession(null)
        setDeviceLocked(false)
        setLoading(Boolean(authSession))
      }
      setTimeout(async () => {
        try {
          const ext = await loadProfile(authSession)
          if (!mounted || revision !== profileRevision.current) return
          if (startup && ext) {
            setDeviceLocked(true)
            setLockReason('startup')
          }
          setSession(ext)
        } catch {
          if (!mounted || revision !== profileRevision.current) return
          setSession(null)
        } finally {
          if (mounted && revision === profileRevision.current) setLoading(false)
        }
      }, 0)
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (profileRevision.current === 0) syncSession(data.session, true)
    }).catch(() => {
      if (mounted && profileRevision.current === 0) syncSession(null, true)
    })
    // IMPORTANTE: não fazer await de queries supabase DENTRO do callback de
    // onAuthStateChange — o cliente mantém um lock interno e qualquer query
    // dispara um deadlock (login fica em "carregando infinito"). Deferimos
    // com setTimeout(0) para sair do escopo do listener.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => syncSession(s, event === 'INITIAL_SESSION'))
    return () => {
      mounted = false
      profileRevision.current += 1
      sub.subscription.unsubscribe()
    }
  }, [])

  // Auto-logout por inatividade: ao voltar do background após exceder o limite
  // (admin → sessao_idle_admin_min · demais → sessao_idle_geral_min), encerra a sessão.
  useEffect(() => {
    const onChange = async (state: AppStateStatus) => {
      if (localPromptActive.current) return
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now()
        if (session) {
          setLockReason('resume')
          setDeviceLocked(true)
        }
        return
      }
      if (state === 'active' && backgroundedAt.current && session) {
        const elapsed = Date.now() - backgroundedAt.current
        backgroundedAt.current = null
        const { adminMin, geralMin } = await getIdleConfig()
        const limite = (session.role === 'admin' ? adminMin : geralMin) * 60_000
        if (elapsed > limite) {
          await signOut()
          return
        }
        const graceSeconds = await getDeviceRelockSeconds()
        if (elapsed < graceSeconds * 1000) setDeviceLocked(false)
      }
    }
    const subscription = AppState.addEventListener('change', onChange)
    return () => subscription.remove()
  }, [session, signOut])

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090B' }}><ActivityIndicator color="#DC2626" /></View>

  return (
    <Ctx.Provider
      value={{
        session,
        loading,
        signOut,
        refresh,
      }}
    >
      {children}
      {session ? <Modal
        visible={deviceLocked}
        animationType="none"
        presentationStyle="fullScreen"
        onRequestClose={() => {}}
      >
        <DeviceLock
          autoPrompt={lockReason === 'startup'}
          onPromptChange={(active) => { localPromptActive.current = active }}
          onUnlock={() => { localPromptActive.current = false; setDeviceLocked(false) }}
          onSignOut={async () => {
            localPromptActive.current = false
            await signOut()
          }}
        />
      </Modal> : null}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)

