import { supabase } from '@/lib/supabase'

export type CpcProjectStage =
  | 'terreno_definido'
  | 'projeto_aprovado'
  | 'orcamento_cronograma'
  | 'obra_iniciada'
  | 'outro'

export interface PublicCpcLeadInput {
  idempotency_key: string
  nome_completo: string
  email: string
  telefone: string
  cidade: string | null
  uf: string | null
  fase_projeto: CpcProjectStage
  resumo_projeto: string | null
  consentimento: true
  website: string
}

export interface PublicCpcLeadResult {
  ok: boolean
  duplicate?: boolean
  error?: string
}

export async function submitPublicCpcLead(input: PublicCpcLeadInput): Promise<PublicCpcLeadResult> {
  const { data, error } = await supabase.functions.invoke('public-cpc-lead', { body: input })
  if (error) {
    let code = 'lead_capture_failed'
    const context = error.context
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: string }
        if (body.error) code = body.error
      } catch {
        // Não expõe detalhes de transporte ou dados enviados no erro ao usuário.
      }
    }
    return { ok: false, error: code }
  }
  return data as PublicCpcLeadResult
}

export function createCpcIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
