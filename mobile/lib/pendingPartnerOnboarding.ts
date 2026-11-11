import * as SecureStore from 'expo-secure-store'
import { supabase } from './supabase'

const KEY = 'mercurio.partner.onboarding.pending'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type PendingPartnerOnboarding = {
  email: string
  cpf: string
  organizacao: string
  cidade: string
  uf: string
  areas: string[]
  declarado: boolean
  createdAt: number
}

export async function savePendingPartnerOnboarding(draft: Omit<PendingPartnerOnboarding, 'createdAt'>): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify({ ...draft, createdAt: Date.now() }))
}

export async function finishPendingPartnerOnboarding(email: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(KEY)
  if (!raw) return false
  let draft: PendingPartnerOnboarding
  try { draft = JSON.parse(raw) as PendingPartnerOnboarding }
  catch { await SecureStore.deleteItemAsync(KEY); return false }
  if (!draft.createdAt || Date.now() - draft.createdAt > MAX_AGE_MS
    || draft.email !== email.trim().toLowerCase()) {
    await SecureStore.deleteItemAsync(KEY)
    return false
  }
  const { data: userResult, error: userError } = await supabase.auth.getUser()
  if (userError || userResult.user?.email?.toLowerCase() !== draft.email) return false

  const { error: registerError } = await supabase.rpc('partner_self_register', {
    p_cpf: draft.cpf, p_dados_bancarios: null,
  })
  if (registerError) throw registerError
  const { error: responseError } = await supabase.rpc('mobile_partner_onboarding_salvar', {
    p_resposta: {
      organizacao: draft.organizacao, cidade: draft.cidade, uf: draft.uf,
      areas: draft.areas, declarou: draft.declarado,
    },
  })
  if (responseError) throw responseError
  await SecureStore.deleteItemAsync(KEY)
  return true
}
