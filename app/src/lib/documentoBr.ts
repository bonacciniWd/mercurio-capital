// app/src/lib/documentoBr.ts
// Utilidades de documentos BR (CPF/CNPJ): máscara, validação (Invertexto) e consulta CNPJ.
import { supabase } from '@/lib/supabase'

export function onlyDigits(v: string): string {
  return (v ?? '').replace(/\D+/g, '')
}

export function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

export function maskCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
}

export function maskDocumento(v: string, pessoaTipo: 'PF' | 'PJ'): string {
  return pessoaTipo === 'PF' ? maskCpf(v) : maskCnpj(v)
}

export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  const calc = (base: string, factorStart: number): number => {
    let sum = 0
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factorStart - i)
    const mod = (sum * 10) % 11
    return mod === 10 ? 0 : mod
  }
  return calc(cpf.slice(0, 9), 10) === Number(cpf[9]) && calc(cpf.slice(0, 10), 11) === Number(cpf[10])
}

export function isValidCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw)
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (len: number): number => {
    const nums = cnpj.slice(0, len)
    let pos = len - 7
    let sum = 0
    for (let i = len; i >= 1; i--) {
      sum += Number(nums[len - i]) * pos--
      if (pos < 2) pos = 9
    }
    const res = sum % 11
    return res < 2 ? 0 : 11 - res
  }
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13])
}

export interface DocumentoValidacao {
  value: string
  formatted: string | null
  type: 'cpf' | 'cnpj' | string
  valid: boolean
}

// Valida CPF/CNPJ via Edge Function (Invertexto) — token server-side, nunca no frontend.
export async function validarDocumento(value: string): Promise<DocumentoValidacao> {
  const { data, error } = await supabase.functions.invoke('documento-validar', {
    body: { value: onlyDigits(value) },
  })
  if (error) throw new Error(error.message)
  const payload = data as DocumentoValidacao & { error?: string }
  if (payload?.error) throw new Error(payload.error)
  return payload
}

export interface CnpjConsulta {
  cnpj: string
  razao_social: string | null
  nome_fantasia: string | null
  data_abertura: string | null
  tipo_empresa: string | null
  ramo_atuacao: string | null
  situacao: string | null
  email: string | null
  telefone: string | null
  endereco_cep: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_estado: string | null
}

// Consulta dados cadastrais de CNPJ via Edge Function (Invertexto) — token server-side.
export async function consultarCnpj(cnpj: string): Promise<CnpjConsulta> {
  const { data, error } = await supabase.functions.invoke('cnpj-consultar', {
    body: { cnpj: onlyDigits(cnpj) },
  })
  if (error) throw new Error(error.message)
  const payload = data as CnpjConsulta & { error?: string }
  if (payload?.error) throw new Error(payload.error)
  return payload
}
