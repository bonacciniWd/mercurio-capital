import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  buildSession,
  consumeMagicToken,
  enrollTwoFactor as enrollTwoFactorClient,
  fetchProfile,
  getCurrentSession,
  loginWithPassword,
  resolveRedirect,
  signOut,
  startTwoFactorChallenge,
  unenrollTwoFactor as unenrollTwoFactorClient,
  verifyTwoFactorCode,
  verifyTwoFactorEnrollment,
  type TwoFactorEnrollment,
} from '@/auth/authClient'
import type { AppRole, AuthRedirect, AuthSession } from '@/auth/types'
import { supabase } from '@/lib/supabase'
import { getIdleConfig } from '@/lib/securityConfig'

type LoginPayload = {
  email: string
  password: string
  allowedRoles?: AppRole[]
}

type AuthContextValue = {
  session: AuthSession | null
  loading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<AuthRedirect>
  consumeMagicLink: (token: string) => Promise<AuthRedirect>
  submitTwoFactor: (code: string) => Promise<AuthRedirect>
  beginTwoFactorEnrollment: (friendlyName?: string) => Promise<TwoFactorEnrollment>
  confirmTwoFactorEnrollment: (factorId: string, code: string) => Promise<AuthRedirect>
  removeTwoFactorFactor: (factorId: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [mfaChallengeRef, setMfaChallengeRef] = useState<{ factorId: string; challengeId: string } | null>(null)

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      // Garantir liberação do loading após 5s
      const fallbackTimer = setTimeout(() => {
        if (mounted) setLoading(false)
      }, 5000)

      try {
        const current = await getCurrentSession()
        if (mounted) setSession(current)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] bootstrap falhou — limpando sessão local', err)
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
          /* noop */
        }
        if (mounted) setSession(null)
      } finally {
        clearTimeout(fallbackTimer)
        if (mounted) setLoading(false)
      }
    }

    void bootstrap()

    const { data } = supabase.auth.onAuthStateChange((event, supaSession) => {
      // Disparamos o processamento fora da thread principal do evento para evitar 
      // deadlocks da SDK do Supabase (que aguarda listeners e trava chamadas como .rpc()).
      setTimeout(async () => {
        if (event === 'SIGNED_OUT' || !supaSession) {
          if (!mounted) return
          setSession(null)
          setLoading(false)
          return
        }

        try {
          const profile = await fetchProfile()
          if (!profile) {
            await supabase.auth.signOut({ scope: 'local' })
            if (mounted) setSession(null)
            return
          }
          const current = await buildSession(profile, supaSession.user.id)
          if (!mounted) return
          setSession(current)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[auth] onAuthStateChange falhou', err)
          if (mounted) setSession(null)
        } finally {
          if (mounted) setLoading(false)
        }
      }, 0)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Auto-logout por inatividade (lê timeouts de configuracoes_sistema).
  // admin → sessao_idle_admin_min · demais → sessao_idle_geral_min.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function arm() {
      const { adminMin, geralMin } = await getIdleConfig()
      if (cancelled) return
      const minutos = session!.role === 'admin' ? adminMin : geralMin
      const ms = Math.max(1, minutos) * 60_000

      const reset = () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(async () => {
          await signOut()
          setSession(null)
          setMfaChallengeRef(null)
        }, ms)
      }

      const eventos: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
      eventos.forEach((e) => window.addEventListener(e, reset, { passive: true }))
      reset()

      cleanup = () => {
        if (timer) clearTimeout(timer)
        eventos.forEach((e) => window.removeEventListener(e, reset))
      }
    }

    let cleanup: (() => void) | undefined
    void arm()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      cleanup?.()
    }
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      isAuthenticated: Boolean(session),
      login: async (payload) => {
        const nextSession = await loginWithPassword(payload)
        setSession(nextSession)
        return resolveRedirect(nextSession)
      },
      consumeMagicLink: async (token) => {
        const nextSession = await consumeMagicToken(token)
        setSession(nextSession)
        return resolveRedirect(nextSession)
      },
      submitTwoFactor: async (code) => {
        let challenge = mfaChallengeRef
        if (!challenge) {
          challenge = await startTwoFactorChallenge()
          setMfaChallengeRef(challenge)
        }
        const nextSession = await verifyTwoFactorCode(challenge, code)
        setMfaChallengeRef(null)
        setSession(nextSession)
        return resolveRedirect(nextSession)
      },
      beginTwoFactorEnrollment: async (friendlyName) => {
        return enrollTwoFactorClient(friendlyName)
      },
      confirmTwoFactorEnrollment: async (factorId, code) => {
        const nextSession = await verifyTwoFactorEnrollment(factorId, code)
        setSession(nextSession)
        return resolveRedirect(nextSession)
      },
      removeTwoFactorFactor: async (factorId) => {
        await unenrollTwoFactorClient(factorId)
        const current = await getCurrentSession()
        setSession(current)
      },
      logout: async () => {
        await signOut()
        setSession(null)
        setMfaChallengeRef(null)
      },
      refresh: async () => {
        const current = await getCurrentSession()
        setSession(current)
      },
    }),
    [session, loading, mfaChallengeRef],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  }
  return context
}
