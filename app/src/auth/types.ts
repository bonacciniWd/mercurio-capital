export type AppRole = 'admin' | 'partner' | 'team_member' | 'client'

export type AuthProfile = {
  id: string
  email: string
  nome: string
  role: AppRole
  ativo: boolean
  partnerId: string | null
  partnerStatus: 'pending' | 'approved' | 'rejected' | 'suspended' | null
  equipeId: string | null
  approved: boolean
  requiresTwoFactor: boolean
}

export type AuthSession = AuthProfile & {
  userId: string
  twoFactorVerified: boolean
  twoFactorEnrolled: boolean
}

export type LoginInput = {
  email: string
  password: string
  role: AppRole
}

export type AuthRedirect = '/admin' | '/p' | '/c' | '/2fa' | '/2fa/setup' | '/acesso-pendente'
