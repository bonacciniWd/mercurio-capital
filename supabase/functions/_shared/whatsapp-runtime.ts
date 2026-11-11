import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
export const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
export async function adminIdentity(req: Request, full = true) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || token.length > 8192) throw new Error('unauthorized')
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) throw new Error('unauthorized')
  const permission = await client.rpc(full ? 'app_is_admin_full' : 'app_is_admin')
  if (permission.error || permission.data !== true) throw new Error('forbidden')
  return { user: data.user, client }
}
export async function workerIdentity(req: Request): Promise<boolean> {
  const secret = Deno.env.get('WHATSAPP_WORKER_SECRET') ?? ''
  const received = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (secret.length < 32 || !received || received.length > 512) return false
  const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  const [a, b] = await Promise.all([digest(secret), digest(received)])
  return new Uint8Array(a).every((byte, index) => byte === new Uint8Array(b)[index])
}
export async function settings() {
  const { data, error } = await service.from('integracoes_config').select('ativo,configuracoes').eq('chave', 'whatsapp').single()
  if (error || !data) throw new Error('configuracao_indisponivel')
  return { ...data.configuracoes, ativo: data.ativo } as Record<string, unknown>
}
export async function readBody(req: Request, max = 120000): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader(); if (!reader) throw new Error('json_invalido')
  const chunks: Uint8Array[] = []; let bytes = 0
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.length; if (bytes > max) { await reader.cancel(); throw new Error('payload_grande') }; chunks.push(value) }
  } finally { reader.releaseLock() }
  const body = new Uint8Array(bytes); let at = 0; for (const chunk of chunks) { body.set(chunk, at); at += chunk.length }
  const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('json_invalido')
  return parsed
}
export async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(n => n.toString(16).padStart(2, '0')).join('')
}
export async function graphRequest(path: string, method = 'GET', body?: unknown, query: Record<string, string> = {}) {
  if (!/^[0-9]+(?:\/[a-z_]+)?$/.test(path)) throw new Error('meta_path_invalido')
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN'); const cfg = await settings()
  const version = String(cfg.api_version || Deno.env.get('WHATSAPP_API_VERSION') || 'v26.0')
  if (!/^v\d{2}\.0$/.test(version) || !token) throw new Error('credenciais_envio_ausentes')
  const isForm = body instanceof FormData
  const url = new URL(`https://graph.facebook.com/${version}/${path}`)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) }, body: body ? (isForm ? body : JSON.stringify(body)) : undefined, signal: AbortSignal.timeout(12000) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`meta_http_${response.status}_codigo_${Number(result?.error?.code) || 0}`)
  return result
}
export async function audit(actor: string, action: string, entity: string, id: string) {
  const { error } = await service.from('audit_log').insert({ usuario_id: actor, acao: action, entidade: entity, entidade_id: id })
  if (error) throw new Error('auditoria_indisponivel')
}
export function requireResult<T>(r: { data: T; error: { message: string } | null }): T { if (r.error) throw new Error('persistencia_indisponivel'); return r.data }
