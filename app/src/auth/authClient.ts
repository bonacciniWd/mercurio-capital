import { supabase } from '@/lib/supabase'
import type { AppRole, AuthProfile, AuthRedirect, AuthSession, LoginInput } from '@/auth/types'

type MeRow = {
  id: string
  email: string
  nome: string
  role: AppRole
  ativo: boolean
  partner_id: string | null
  partner_status: AuthProfile['partnerStatus']
  equipe_id: string | null
  approved: boolean
  requires_2fa: boolean
}

const ROLE_MODULE_PATH: Record<AppRole, '/admin' | '/p' | '/c'> = {
  admin: '/admin',
  partner: '/p',
  team_member: '/p',
  client: '/c',
}

type SupabaseSessionUser = {
  id: string
  email?: string | null
  app_metadata?: Record<string, unknown> | null
  user_metadata?: Record<string, unknown> | null
}

const cachedProfilesByUserId = new Map<string, AuthProfile>()

const TRANSIENT_ERROR_MARKERS = [
  'load failed',
  'failed to fetch',
  'networkerror',
  'network request failed',
  'fetch failed',
  'gateway timeout',
]

function isTransientNetworkError(err: unknown): boolean {
  const message =
    typeof err === 'string'
      ? err
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : ''
  const normalized = message.toLowerCase()
  return TRANSIENT_ERROR_MARKERS.some((marker) => normalized.includes(marker))
}

function sanitizeRole(value: unknown): AppRole {
  if (value === 'admin' || value === 'partner' || value === 'team_member' || value === 'client') {
    return value
  }
  return 'client'
}

function buildFallbackProfileFromSessionUser(user: SupabaseSessionUser): AuthProfile {
  const appMetadata = user.app_metadata ?? {}
  const role = sanitizeRole(appMetadata.role)
  const approvedClaim = appMetadata.approved === true
  const partnerStatus =
    role === 'partner'
      ? approvedClaim
        ? 'approved'
        : 'pending'
      : null

  return {
    id: user.id,
    email: user.email ?? '',
    nome: user.email ? user.email.split('@')[0] : 'Usuário',
    role,
    ativo: true,
    partnerId: typeof appMetadata.partner_id === 'string' ? appMetadata.partner_id : null,
    partnerStatus,
    equipeId: typeof appMetadata.equipe_id === 'string' ? appMetadata.equipe_id : null,
    approved: role === 'partner' ? approvedClaim : true,
    requiresTwoFactor: false,
  }
}

async function readFallbackProfile(): Promise<AuthProfile | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return null

  const userId = data.session.user.id
  const cached = cachedProfilesByUserId.get(userId)
  if (cached) return cached

  return buildFallbackProfileFromSessionUser(data.session.user as SupabaseSessionUser)
}

export async function fetchProfile(): Promise<AuthProfile | null> {
  try {
    const { data, error } = await supabase.rpc('me')
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[auth] me() falhou', error)

      if (isTransientNetworkError(error)) {
        const fallback = await readFallbackProfile()
        if (fallback) {
          // eslint-disable-next-line no-console
          console.warn('[auth] me() indisponível (transitório), usando perfil de fallback')
          return fallback
        }
      }

      return null
    }
    if (!data) return null
    const row = data as MeRow
    const profile: AuthProfile = {
      id: row.id,
      email: row.email,
      nome: row.nome,
      role: row.role,
      ativo: row.ativo,
      partnerId: row.partner_id,
      partnerStatus: row.partner_status,
      equipeId: row.equipe_id,
      approved: row.approved,
      requiresTwoFactor: false, // temporário para testes: row.requires_2fa,
    }

    cachedProfilesByUserId.set(profile.id, profile)
    return profile
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth] me() throw', err)

    if (isTransientNetworkError(err)) {
      const fallback = await readFallbackProfile()
      if (fallback) {
        // eslint-disable-next-line no-console
        console.warn('[auth] me() throw transitório, usando perfil de fallback')
        return fallback
      }
    }

    return null
  }
}

async function readTwoFactorVerified(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[auth] getAuthenticatorAssuranceLevel falhou', error)
    return false
  }
  if (!data) return false
  if (data.nextLevel === 'aal2') {
    return data.currentLevel === 'aal2'
  }
  return true
}

async function readTwoFactorEnrolled(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[auth] listFactors falhou', error)
    return false
  }
  return Boolean(data?.totp?.some((f) => f.status === 'verified'))
}

export async function buildSession(profile: AuthProfile, userId: string): Promise<AuthSession> {
  const twoFactorEnrolled = profile.requiresTwoFactor ? await readTwoFactorEnrolled() : false
  const twoFactorVerified = profile.requiresTwoFactor
    ? twoFactorEnrolled
      ? await readTwoFactorVerified()
      : false
    : true
  return { ...profile, userId, twoFactorVerified, twoFactorEnrolled }
}

export function resolveRedirect(session: AuthSession): AuthRedirect {
  if (session.role === 'partner' && !session.approved) return '/acesso-pendente'
  if (session.requiresTwoFactor && !session.twoFactorEnrolled) return '/2fa/setup'
  if (session.requiresTwoFactor && !session.twoFactorVerified) return '/2fa'
  return ROLE_MODULE_PATH[session.role]
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      // eslint-disable-next-line no-console
      console.warn('[auth] getSession falhou', sessionError)

      if (isTransientNetworkError(sessionError)) {
        const fallback = await readFallbackProfile()
        if (fallback) return buildSession(fallback, fallback.id)
      }

      return null
    }
    const supaSession = sessionData.session
    if (!supaSession) return null

    const profile = await fetchProfile()
    if (!profile) {
      // Evita logout local agressivo em falhas transitórias do bootstrap.
      // O AuthContext decide quando invalidar a sessão de forma explícita.
      return null
    }

    return buildSession(profile, supaSession.user.id)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth] getCurrentSession throw', err)
    return null
  }
}

export async function loginWithPassword(input: LoginInput): Promise<AuthSession> {
  // Login via edge `auth-login` (rate limit server-side por e-mail + IP).
  const { data: result, error: fnError } = await supabase.functions.invoke('auth-login', {
    body: { email: input.email, password: input.password },
  })

  if (fnError) {
    // A SDK encapsula respostas não-2xx em FunctionsHttpError; extrai o corpo.
    let parsed: { error?: string; retry_after_min?: number } | null = null
    try {
      const ctx = (fnError as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') parsed = await ctx.json()
    } catch {
      /* ignore */
    }
    if (parsed?.error === 'rate_limited') {
      const min = parsed.retry_after_min ?? 15
      throw new Error(`Muitas tentativas de login. Tente novamente em ${min} minutos.`)
    }
    if (parsed?.error === 'credenciais_invalidas') {
      throw new Error('E-mail ou senha inválidos.')
    }
    throw new Error('Falha ao autenticar.')
  }

  const tokens = result as { access_token?: string; refresh_token?: string } | null
  if (!tokens?.access_token || !tokens?.refresh_token) {
    throw new Error('Falha ao autenticar.')
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })
  if (error || !data.session) {
    throw new Error(error?.message ?? 'Falha ao estabelecer a sessão.')
  }

  const profile = await fetchProfile()
  if (!profile) {
    await supabase.auth.signOut()
    throw new Error('Conta não encontrada para este usuário.')
  }

  if (input.allowedRoles && input.allowedRoles.length > 0 && !input.allowedRoles.includes(profile.role)) {
    await supabase.auth.signOut()
    const moduleByRole: Record<AppRole, string> = {
      admin: '/admin/login',
      partner: '/p/login',
      team_member: '/p/login',
      client: '/c/login',
    }
    throw new Error(`Esta conta pertence a outro módulo. Acesse ${moduleByRole[profile.role]}.`)
  }

  return buildSession(profile, data.session.user.id)
}

export async function consumeMagicToken(tokenHash: string): Promise<AuthSession> {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })

  if (error || !data.session) {
    throw new Error(error?.message ?? 'Token inválido ou expirado.')
  }

  const profile = await fetchProfile()
  if (!profile) {
    await supabase.auth.signOut()
    throw new Error('Conta não encontrada para este token.')
  }

  return buildSession(profile, data.session.user.id)
}

export type MfaChallenge = {
  factorId: string
  challengeId: string
}

export async function startTwoFactorChallenge(): Promise<MfaChallenge> {
  const { data: factors, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new Error(error.message)

  const factor = factors.totp?.find((f) => f.status === 'verified')
  if (!factor) {
    throw new Error('Você ainda não possui um fator TOTP verificado. Conclua o cadastro em /2fa/setup.')
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id })
  if (challengeError || !challenge) {
    throw new Error(challengeError?.message ?? 'Não foi possível iniciar o desafio 2FA.')
  }

  return { factorId: factor.id, challengeId: challenge.id }
}

export async function verifyTwoFactorCode(challenge: MfaChallenge, code: string): Promise<AuthSession> {
  const { error } = await supabase.auth.mfa.verify({
    factorId: challenge.factorId,
    challengeId: challenge.challengeId,
    code,
  })
  if (error) throw new Error(error.message)

  const session = await getCurrentSession()
  if (!session) throw new Error('Sessão expirou. Faça login novamente.')
  return session
}

export type TwoFactorEnrollment = {
  factorId: string
  /** SVG markup do QR code retornado pelo Supabase. */
  qrCodeSvg: string
  /** Chave secreta TOTP em base32 (para entrada manual). */
  secret: string
  /** URI otpauth:// (caso o cliente queira gerar QR próprio). */
  uri: string
  friendlyName: string
}

/**
 * Inicia (ou reinicia) o cadastro de um fator TOTP.
 * - Remove fatores anteriores não verificados (evita o erro "factor already exists").
 * - Cria um fator novo e devolve o material para exibir o QR.
 */
export async function enrollTwoFactor(friendlyName = 'Mercurio TOTP'): Promise<TwoFactorEnrollment> {
  const { data: existing, error: listErr } = await supabase.auth.mfa.listFactors()
  if (listErr) throw new Error(listErr.message)

  const unverified = existing?.totp?.filter((f) => f.status !== 'verified') ?? []
  for (const f of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  })
  if (error || !data) {
    throw new Error(error?.message ?? 'Não foi possível iniciar o cadastro do 2FA.')
  }

  return {
    factorId: data.id,
    qrCodeSvg: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
    friendlyName: data.friendly_name ?? friendlyName,
  }
}

/**
 * Conclui o cadastro: cria um desafio para o factor recém-criado e o verifica
 * com o código TOTP digitado pelo usuário. Após verificação a AAL sobe para aal2.
 */
export async function verifyTwoFactorEnrollment(factorId: string, code: string): Promise<AuthSession> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError || !challenge) {
    throw new Error(challengeError?.message ?? 'Não foi possível iniciar o desafio de cadastro.')
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  })
  if (error) throw new Error(error.message)

  const session = await getCurrentSession()
  if (!session) throw new Error('Sessão expirou. Faça login novamente.')
  return session
}

/**
 * Remove um fator TOTP (verificado ou não). Após remoção a sessão volta para aal1.
 */
export async function unenrollTwoFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}

/** Lista os fatores TOTP do usuário atual. */
export async function listTwoFactorFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  return data?.totp ?? []
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
