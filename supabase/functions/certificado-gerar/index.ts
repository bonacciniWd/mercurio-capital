// supabase/functions/certificado-gerar/index.ts
// Gera (ou re-gera) o HTML do certificado e armazena em lms-recursos.
// POST { certificado_id?: uuid, inscricao_id?: uuid }
// → { certificado_id, storage_path, signed_url }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { renderCertificadoHtml } from './template.ts'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: ures, error: uerr } = await userClient.auth.getUser()
  if (uerr || !ures.user) return jsonResponse({ error: 'unauthorized' }, 401)

  let body: { certificado_id?: string; inscricao_id?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }

  // Resolve certificado
  let certificadoId = body.certificado_id ?? null
  if (!certificadoId && body.inscricao_id) {
    // tenta gerar (RPC valida 100%)
    const { data: cert, error: gerErr } = await userClient.rpc('lms_gerar_certificado', {
      p_inscricao_id: body.inscricao_id,
    })
    if (gerErr) return jsonResponse({ error: 'falha_gerar', detail: gerErr.message }, 400)
    certificadoId = (cert as { id?: string } | null)?.id ?? null
  }
  if (!certificadoId) return jsonResponse({ error: 'parametros_invalidos' }, 400)

  // Busca certificado + dados do curso/aluno (com RLS do usuário)
  const { data: cert, error: cErr } = await userClient
    .from('certificados')
    .select(`
      id, codigo, emitido_em, pdf_storage_path, usuario_id, curso_id,
      curso:cursos(titulo, ordem),
      usuario:usuarios(nome_completo)
    `)
    .eq('id', certificadoId)
    .maybeSingle()
  if (cErr || !cert) return jsonResponse({ error: 'certificado_nao_encontrado' }, 404)

  // Calcula horas de conteúdo (via JOIN com modulos)
  let duracaoHoras = 0
  const { data: aulasSum } = await service
    .from('aulas')
    .select('duracao_segundos, modulos!inner(curso_id)')
    .eq('modulos.curso_id', cert.curso_id)
  if (Array.isArray(aulasSum) && aulasSum.length) {
    const totalSeg = aulasSum.reduce((s: number, a: { duracao_segundos?: number | null }) =>
      s + (a.duracao_segundos ?? 0), 0)
    duracaoHoras = Math.round(totalSeg / 3600)
  }

  const aluno = (cert.usuario as { nome_completo?: string } | null)?.nome_completo ?? 'Aluno(a)'
  const cursoTitulo = (cert.curso as { titulo?: string } | null)?.titulo ?? 'Curso'

  const html = renderCertificadoHtml({
    codigo: cert.codigo,
    aluno_nome: aluno,
    curso_titulo: cursoTitulo,
    emitido_em: cert.emitido_em,
    duracao_horas: duracaoHoras || undefined,
  })

  const path = `certificados/${cert.usuario_id}/${cert.codigo}.html`
  const blob = new Blob([html], { type: 'text/html' })

  const { error: upErr } = await service.storage.from('lms-recursos').upload(path, blob, {
    upsert: true, contentType: 'text/html',
  })
  if (upErr) return jsonResponse({ error: 'falha_upload', detail: upErr.message }, 500)

  if (!cert.pdf_storage_path) {
    await service.from('certificados').update({ pdf_storage_path: path }).eq('id', cert.id)
  }

  const { data: signed } = await service.storage.from('lms-recursos')
    .createSignedUrl(path, 60 * 60)

  return jsonResponse({
    certificado_id: cert.id,
    codigo: cert.codigo,
    storage_path: path,
    signed_url: signed?.signedUrl ?? null,
  })
})


