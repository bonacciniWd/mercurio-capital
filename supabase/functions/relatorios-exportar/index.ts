// supabase/functions/relatorios-exportar/index.ts
// Exporta propostas em CSV (UTF-8 com BOM) respeitando RLS via JWT do caller.
// POST { tipo: 'propostas', filtros?: { status?: string[]; produto?: string[]; de?: string; ate?: string } }
// Resposta: text/csv

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

interface Filtros {
  status?: string[]
  produto?: string[]
  de?: string
  ate?: string
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  let body: { tipo?: string; filtros?: Filtros } = {}
  try { body = await req.json() } catch { /* ignore */ }
  const filtros: Filtros = body.filtros ?? {}

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })

  let q = userClient
    .from('propostas')
    .select('protocolo, produto, status, valor_solicitado, prazo_meses, taxa_juros_mensal, partner_id, equipe_id, created_at, updated_at, cliente:clientes(nome_completo, email, cpf)')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (filtros.status?.length) q = q.in('status', filtros.status)
  if (filtros.produto?.length) q = q.in('produto', filtros.produto)
  if (filtros.de) q = q.gte('created_at', filtros.de)
  if (filtros.ate) q = q.lte('created_at', filtros.ate)

  const { data, error } = await q
  if (error) {
    return new Response(JSON.stringify({ error: 'query_failed', detail: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const headers = [
    'protocolo', 'produto', 'status', 'valor_solicitado', 'prazo_meses', 'taxa_juros_mensal',
    'cliente_nome', 'cliente_email', 'cliente_cpf', 'created_at', 'updated_at',
  ]
  const lines: string[] = [headers.join(',')]
  for (const row of (data ?? [])) {
    const r = row as Record<string, unknown> & { cliente?: { nome_completo?: string; email?: string; cpf?: string } | null }
    lines.push([
      r.protocolo, r.produto, r.status, r.valor_solicitado, r.prazo_meses, r.taxa_juros_mensal,
      r.cliente?.nome_completo, r.cliente?.email, r.cliente?.cpf,
      r.created_at, r.updated_at,
    ].map(csvEscape).join(','))
  }

  const csv = '\uFEFF' + lines.join('\n')
  const filename = `propostas_${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
})
