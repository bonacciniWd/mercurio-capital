// supabase/functions/push-dispatcher/index.ts
//
// Worker invocado por cron (ou manualmente) que processa o `push_outbox`:
//  1. Autentica via PUSH_WORKER_SECRET (comparação por digest) e exige a flag
//     remota `push_web` ativa — desligar a flag interrompe envio sem deploy.
//  2. `push_outbox_pull(p_limit)` loca linhas pendentes (higiene/backoff/sweeper no modelo).
//  3. Envia via FCM HTTP v1 (service account em FCM_SERVICE_ACCOUNT_JSON) para cada
//     token ativo do usuário; token morto (UNREGISTERED) é desativado via RPC.
//  4. Marca cada linha via `push_outbox_marcar` (enviado/pendente/falha/incerto).
//
// Sem FCM_SERVICE_ACCOUNT_JSON: responde paused ANTES do pull (não queima tentativas).
// Nunca loga token FCM nem payload — erro mínimo, sem PII.
//
// Deploy (após GO do dono):
//   supabase functions deploy push-dispatcher --project-ref bhagksfvszeogtjvjtpx --no-verify-jwt
// Secrets (entrada silenciosa, read -s):
//   supabase secrets set FCM_SERVICE_ACCOUNT_JSON='{...}' PUSH_WORKER_SECRET='<32+ chars aleatórios>'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import {
  dispatchToTokens,
  fcmAccessToken,
  parseLimit,
  serviceAccountFromJson,
  workerIdentity,
  type ServiceAccount,
} from '../_shared/push-fcm.ts'

const service = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

function requireResult<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error('persistencia_indisponivel')
  return r.data
}

interface OutboxRow {
  id: string
  usuario_id: string
  titulo: string
  mensagem: string
  link: string | null
}

async function flagAtiva(): Promise<boolean> {
  const { data, error } = await service
    .from('feature_flags').select('ativo').eq('chave', 'push_web').maybeSingle()
  if (error) throw new Error('persistencia_indisponivel')
  return data?.ativo === true
}

async function processBatch(sa: ServiceAccount, limit: number) {
  // OAuth2 ANTES do pull (padrão whatsapp-dispatcher): falha de credencial/rede
  // responde 503 sem reservar fila nem queimar tentativas. Cache ≈ 1 chamada/hora.
  const accessToken = await fcmAccessToken(sa)

  const rows = requireResult(
    await service.rpc('push_outbox_pull', { p_limit: limit }),
  ) as OutboxRow[]
  const result = { picked: rows.length, sent: 0, retried: 0, failed: 0, unsure: 0, cancelled: 0, tokensDisabled: 0 }
  if (rows.length === 0) return result

  for (const row of rows) {
    try {
      const devices = requireResult(
        await service.from('push_devices')
          .select('token').eq('usuario_id', row.usuario_id).eq('plataforma', 'web').eq('ativo', true),
      ) as { token: string }[]
      const tokens = devices.map(d => d.token)

      const outcome = tokens.length === 0
        ? { status: 'cancelado' as const, erro: 'sem_dispositivo', tokensMortos: [] as string[] }
        : await dispatchToTokens(sa, accessToken, row, tokens)

      for (const morto of outcome.tokensMortos) {
        await service.rpc('push_device_desativar', { p_token: morto })
        result.tokensDisabled++
      }

      if (outcome.status === 'cancelado') {
        await service.rpc('push_outbox_marcar', { p_id: row.id, p_status: 'cancelado', p_erro: outcome.erro })
        result.cancelled++
        continue
      }
      await service.rpc('push_outbox_marcar', { p_id: row.id, p_status: outcome.status, p_erro: outcome.erro })
      if (outcome.status === 'enviado') result.sent++
      else if (outcome.status === 'pendente') result.retried++
      else if (outcome.status === 'incerto') result.unsure++
      else result.failed++
    } catch {
      // falha inesperada na linha: volta à fila com backoff (nunca inclui exceção crua)
      await service.rpc('push_outbox_marcar', { p_id: row.id, p_status: 'pendente', p_erro: 'processamento_indisponivel' })
      result.retried++
    }
  }
  return result
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })
  if (!await workerIdentity(Deno.env.get('PUSH_WORKER_SECRET') ?? '', req.headers.get('authorization'))) {
    return new Response('unauthorized', { status: 401 })
  }
  try {
    if (!await flagAtiva()) return Response.json({ paused: true, motivo: 'flag_push_web_inativa' })
    const sa = serviceAccountFromJson(Deno.env.get('FCM_SERVICE_ACCOUNT_JSON'))
    if (!sa) return Response.json({ paused: true, motivo: 'fcm_nao_configurado' })

    const limit = parseLimit(new URL(req.url).searchParams.get('limit'))
    return Response.json(await processBatch(sa, limit))
  } catch {
    return Response.json({ error: 'dispatcher_indisponivel' }, { status: 503 })
  }
})
