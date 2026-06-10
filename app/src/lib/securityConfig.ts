// Configurações de segurança aplicadas de fato (lidas de configuracoes_sistema).
import { supabase } from '@/lib/supabase'

export const SENHA_MIN_FALLBACK = 8

/** Mínimo de senha vigente. Usa RPC pública (funciona sem sessão). */
export async function getSenhaMinLength(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('senha_min_length')
    if (error || typeof data !== 'number' || data < 1) return SENHA_MIN_FALLBACK
    return data
  } catch {
    return SENHA_MIN_FALLBACK
  }
}

/** Valida o tamanho da senha; retorna mensagem de erro ou null. */
export function validarSenha(senha: string, min: number): string | null {
  if (senha.length < min) return `A senha deve ter ao menos ${min} caracteres.`
  return null
}

export interface IdleConfig {
  adminMin: number
  geralMin: number
}

const IDLE_FALLBACK: IdleConfig = { adminMin: 30, geralMin: 480 }

/** Lê os timeouts de inatividade (minutos) de configuracoes_sistema. */
export async function getIdleConfig(): Promise<IdleConfig> {
  try {
    const { data, error } = await supabase
      .from('configuracoes_sistema')
      .select('chave, valor')
      .in('chave', ['sessao_idle_admin_min', 'sessao_idle_geral_min'])
    if (error || !data) return IDLE_FALLBACK
    const map: Record<string, number> = {}
    for (const r of data as { chave: string; valor: unknown }[]) {
      const n = Number(String(r.valor).replace(/\D/g, ''))
      if (!isNaN(n) && n > 0) map[r.chave] = n
    }
    return {
      adminMin: map['sessao_idle_admin_min'] ?? IDLE_FALLBACK.adminMin,
      geralMin: map['sessao_idle_geral_min'] ?? IDLE_FALLBACK.geralMin,
    }
  } catch {
    return IDLE_FALLBACK
  }
}
