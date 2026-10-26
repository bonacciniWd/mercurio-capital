import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') ?? Deno.env.get('APP_URL') ?? 'https://mercuriocapitalsa.com.br').replace(/\/+$/, '')

type Body = { email?: string; nome_completo?: string }

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401)

  let body: Body
  try { body = await req.json() } catch { return jsonResponse({ error: 'invalid_json' }, 400) }
  const email = (body.email ?? '').trim().toLowerCase()
  const nome = (body.nome_completo ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'email_invalido' }, 400)
  if (nome.length < 3 || nome.length > 120) return jsonResponse({ error: 'nome_invalido' }, 400)

  const actor = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: authData, error: authError } = await actor.auth.getUser()
  if (authError || !authData.user) return jsonResponse({ error: 'unauthorized' }, 401)
  const metadata = authData.user.app_metadata as { role?: string; admin_nivel?: string } | null
  if (metadata?.role !== 'admin' || (metadata.admin_nivel && metadata.admin_nivel !== 'full')) {
    return jsonResponse({ error: 'forbidden' }, 403)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const invitation = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome_completo: nome, role: 'admin' },
    redirectTo: `${SITE_URL}/auth/admin-bootstrap`,
  })
  if (invitation.error || !invitation.data.user) {
    const reason = invitation.error?.message.toLowerCase() ?? ''
    if (reason.includes('already') || reason.includes('registered') || reason.includes('exists')) {
      return jsonResponse({ error: 'email_ja_cadastrado' }, 409)
    }
    return jsonResponse({ error: 'convite_falhou' }, 502)
  }

  const userId = invitation.data.user.id
  const { error: roleError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'admin', admin_nivel: 'limitado' },
    user_metadata: { nome_completo: nome, role: 'admin' },
  })
  if (roleError) {
    await admin.auth.admin.deleteUser(userId)
    return jsonResponse({ error: 'configuracao_de_acesso_falhou' }, 500)
  }

  const { error: profileError } = await admin.from('usuarios_internos').upsert({ usuario_id: userId }, { onConflict: 'usuario_id' })
  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return jsonResponse({ error: 'cadastro_interno_falhou' }, 500)
  }

  return jsonResponse({ ok: true, usuario_id: userId, email_sent: true }, 201)
})
