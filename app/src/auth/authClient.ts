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

export async function fetchProfile(): Promise<AuthProfile | null> {
  try {
    const { data, error } = await supabase.rpc('me')
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[auth] me() falhou', error)
      return null
    }
    if (!data) return null
    const row = data as MeRow
    return {
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth] me() throw', err)
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
      return null
    }
    const supaSession = sessionData.session
    if (!supaSession) return null

    const profile = await fetchProfile()
    if (!profile) {
      await supabase.auth.signOut({ scope: 'local' })
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error || !data.session) {
    throw new Error(error?.message ?? 'Falha ao autenticar.')
  }

  const profile = await fetchProfile()
  if (!profile) {
    await supabase.auth.signOut()
    throw new Error('Conta não encontrada para este usuário.')
  }

  if (input.role !== profile.role) {
    await supabase.auth.signOut()
    throw new Error('Esta conta não pertence ao módulo selecionado.')
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
