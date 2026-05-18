// supabase/functions/contrato-gerar/index.ts
// Gera o contrato (renderiza HTML server-side, sobe no Storage e cria linhas).
// POST { proposta_id: uuid, signatarios?: [{nome,email,cpf,papel}] }
// Retorna { contrato_id, storage_path, versao }
//
// Notas:
//  - Storage: bucket 'contratos', path '{proposta_id}/v{versao}.html'
//  - O HTML é renderizado a partir dos dados ao vivo da proposta (RLS-safe).
//  - Se signatarios não vier, deriva automaticamente: tomador (cliente) + proponentes principais.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { renderContratoHtml, type ContratoDados } from './template.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

  let body: { proposta_id?: string; signatarios?: Array<{ nome: string; email: string; cpf?: string; papel?: string }> } = {}
  try { body = await req.json() } catch { /* ignore */ }
  const propostaId = body.proposta_id
  if (!propostaId) return jsonResponse({ error: 'proposta_id_obrigatorio' }, 400)

  // Carrega dados da proposta com RLS do usuário (parceiro só vê o que é dele).
  const { data: proposta, error: pErr } = await userClient
    .from('propostas')
    .select(`
      id, protocolo, produto, status, valor_solicitado, valor_imoveis_total,
      taxa_juros_mensal, amortizacao, prazo_meses, carencia_meses, indexador,
      partner_id,
      cliente:clientes(nome_completo, cpf, email, telefone),
      partner:partners(usuario:usuarios(nome_completo))
    `)
    .eq('id', propostaId)
    .maybeSingle()
  if (pErr) return jsonResponse({ error: 'erro_proposta', detail: pErr.message }, 500)
  if (!proposta) return jsonResponse({ error: 'proposta_nao_encontrada' }, 404)
  if (proposta.status !== 'emissao_contrato') {
    return jsonResponse({ error: 'status_invalido', detail: `proposta em status ${proposta.status}` }, 422)
  }

  // Proponentes
  const { data: proponentes } = await userClient
    .from('proponentes').select('nome, cpf_cnpj, principal, relacao')
    .eq('proposta_id', propostaId).order('principal', { ascending: false })

  // Imóveis
  const { data: imoveis } = await userClient
    .from('imoveis').select('tipo, cidade, estado, bairro, logradouro, numero, valor')
    .eq('proposta_id', propostaId)

  // Versão atual (para nome do arquivo)
  const { data: contratoExistente } = await service.from('contratos')
    .select('versao').eq('proposta_id', propostaId).maybeSingle()
  const versao = (contratoExistente?.versao ?? 0) + 1

  const dados: ContratoDados = {
    protocolo: proposta.protocolo,
    produto: proposta.produto,
    valor_solicitado: proposta.valor_solicitado as number,
    valor_imoveis_total: proposta.valor_imoveis_total as number,
    taxa_juros_mensal: proposta.taxa_juros_mensal as number,
    amortizacao: proposta.amortizacao,
    prazo_meses: proposta.prazo_meses,
    carencia_meses: proposta.carencia_meses,
    indexador: proposta.indexador,
    partner_nome: (proposta as any).partner?.usuario?.nome_completo ?? null,
    cliente: proposta.cliente as ContratoDados['cliente'],
    proponentes: (proponentes ?? []).map(p => ({
      nome: p.nome, cpf_cnpj: p.cpf_cnpj,
      papel: p.principal ? 'tomador_principal' : (p.relacao ?? 'tomador'),
    })),
    imoveis: (imoveis ?? []).map(i => ({ ...i })),
    versao,
  }

  const html = renderContratoHtml(dados)
  const path = `${propostaId}/v${versao}.html`

  // Upload no storage (service_role bypassa RLS)
  const blob = new Blob([html], { type: 'text/html' })
  const { error: upErr } = await service.storage.from('contratos').upload(path, blob, {
    upsert: true, contentType: 'text/html',
  })
  if (upErr) return jsonResponse({ error: 'falha_upload', detail: upErr.message }, 500)

  // Signatários default: cliente + proponentes principais (sem duplicar email)
  const signatarios = (body.signatarios && body.signatarios.length > 0)
    ? body.signatarios
    : buildDefaultSignatarios(dados)

  // Chama RPC com auth do usuário (mantém RLS)
  const { data: contrato, error: rpcErr } = await userClient.rpc('contrato_gerar', {
    p_proposta_id: propostaId,
    p_pdf_path: path,
    p_corpo_html: html,
    p_signatarios: signatarios,
  })
  if (rpcErr) return jsonResponse({ error: 'falha_rpc', detail: rpcErr.message }, 400)

  return jsonResponse({
    contrato_id: (contrato as { id: string }).id,
    storage_path: path,
    versao,
    signatarios_count: signatarios.length,
  })
})

function buildDefaultSignatarios(d: ContratoDados): Array<{ nome: string; email: string; cpf?: string; papel: string; ordem: number }> {
  const out: Array<{ nome: string; email: string; cpf?: string; papel: string; ordem: number }> = []
  if (d.cliente?.email) {
    out.push({
      nome: d.cliente.nome_completo ?? 'Tomador',
      email: d.cliente.email,
      cpf: d.cliente.cpf ?? undefined,
      papel: 'tomador', ordem: 1,
    })
  }
  return out
}

