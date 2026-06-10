// supabase/functions/auth-login/index.ts
// Fase 16 — Login com rate limit REAL (server-side, não burlável).
// Body: { email: string, password: string }
// Fluxo:
//   1. Lê rate_limit_login de configuracoes_sistema ({max, janela_min}).
//   2. "Peek" por e-mail e por IP — se qualquer um excedeu, retorna 429.
//   3. Tenta signInWithPassword (cliente anon, server-side).
//   4. Falhou  → registra a tentativa (e-mail + IP) e retorna 401.
//      Sucesso → limpa o contador do e-mail e devolve os tokens da sessão.
//
// O cliente (web/mobile) chama supabase.auth.setSession({ access_token, refresh_token })
// com os tokens retornados — o restante do fluxo (perfil, 2FA/AAL) segue igual.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const DEFAULT_MAX = 5
const DEFAULT_JANELA_MIN = 15

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const first = xff.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  if (!email || !password) {
    return jsonResponse({ error: 'credenciais_obrigatorias' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // 1) Configuração do rate limit
  let max = DEFAULT_MAX
  let janelaMin = DEFAULT_JANELA_MIN
  try {
    const { data: cfg } = await admin
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'rate_limit_login')
      .maybeSingle()
    const v = cfg?.valor as { max?: number; janela_min?: number } | null
    if (v?.max && v.max > 0) max = v.max
    if (v?.janela_min && v.janela_min > 0) janelaMin = v.janela_min
  } catch {
    // usa defaults
  }
  const janela = `${janelaMin} minutes`

  const ip = clientIp(req)
  const keyEmail = `login::email::${email}`
  const keyIp = `login::ip::${ip}`

  // 2) Peek (sem incrementar)
  const [peekEmail, peekIp] = await Promise.all([
    admin.rpc('rate_limit_peek', { p_chave: keyEmail, p_limite: max, p_janela: janela }),
    admin.rpc('rate_limit_peek', { p_chave: keyIp, p_limite: max * 3, p_janela: janela }),
  ])
  if (peekEmail.error || peekIp.error) {
    return jsonResponse({ error: 'rate_check_failed' }, 500)
  }
  if (peekEmail.data === false || peekIp.data === false) {
    return jsonResponse({ error: 'rate_limited', retry_after_min: janelaMin }, 429)
  }

  // 3) Tenta autenticar (server-side, cliente anon)
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    // 4a) Falha → registra tentativa em e-mail + IP
    await Promise.all([
      admin.rpc('rate_limit_register', { p_chave: keyEmail }),
      admin.rpc('rate_limit_register', { p_chave: keyIp }),
    ])
    return jsonResponse({ error: 'credenciais_invalidas' }, 401)
  }

  // 4b) Sucesso → limpa o contador do e-mail e devolve tokens
  await admin.rpc('rate_limit_clear', { p_chave: keyEmail })

  return jsonResponse({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    user_id: data.session.user.id,
  })
})
