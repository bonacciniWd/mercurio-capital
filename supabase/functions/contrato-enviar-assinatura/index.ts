// supabase/functions/contrato-enviar-assinatura/index.ts
// Envia o contrato (HTML do storage) para a Clicksign sandbox/produção.
// POST { contrato_id: uuid }
// Retorna { envelope_id, signatarios: [{key,email}] }
//
// Em modo dev (sem CLICKSIGN_API_TOKEN) simula um envelope_id falso
// e atualiza apenas as colunas no DB. Útil para wiring local.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLICKSIGN_API_URL = Deno.env.get('CLICKSIGN_API_URL') ?? 'https://sandbox.clicksign.com'
const CLICKSIGN_TOKEN   = Deno.env.get('CLICKSIGN_API_TOKEN') ?? ''
const CLICKSIGN_ALLOW_DEV_MODE = (Deno.env.get('CLICKSIGN_ALLOW_DEV_MODE') ?? 'true').toLowerCase() === 'true'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  })
  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: ures, error: uerr } = await userClient.auth.getUser()
  if (uerr || !ures.user) return jsonResponse({ error: 'unauthorized' }, 401)

  let body: { contrato_id?: string } = {}
  try { body = await req.json() } catch {/* ignore */}
  const contratoId = body.contrato_id
  if (!contratoId) return jsonResponse({ error: 'contrato_id_obrigatorio' }, 400)

  // Confere acesso via RLS
  const { data: contrato, error: cErr } = await userClient
    .from('contratos')
    .select('id, proposta_id, pdf_storage_path, versao, provider_envelope_id')
    .eq('id', contratoId).maybeSingle()
  if (cErr || !contrato) return jsonResponse({ error: 'contrato_nao_encontrado' }, 404)

  const { data: signers } = await userClient
    .from('assinaturas_contrato')
    .select('id, signatario_nome, signatario_email, signatario_cpf_cnpj, ordem')
    .eq('contrato_id', contratoId).order('ordem')
  if (!signers || signers.length === 0) {
    return jsonResponse({ error: 'sem_signatarios' }, 422)
  }

  // Baixa HTML do storage (service)
  const { data: blob, error: dlErr } = await service.storage.from('contratos').download(contrato.pdf_storage_path!)
  if (dlErr || !blob) return jsonResponse({ error: 'falha_download', detail: dlErr?.message }, 500)
  const arrayBuf = await blob.arrayBuffer()
  const base64 = arrayBufferToBase64(arrayBuf)
  const filename = (contrato.pdf_storage_path ?? `contrato-${contratoId}.html`).split('/').pop()!
  const dataUri = `data:text/html;base64,${base64}`

  // ---- Modo dev (sem token) ----
  if (!CLICKSIGN_TOKEN) {
    if (!CLICKSIGN_ALLOW_DEV_MODE) {
      return jsonResponse({ error: 'clicksign_nao_configurado', detail: 'CLICKSIGN_API_TOKEN ausente' }, 503)
    }
    const envelopeId = `dev_envelope_${contratoId.replace(/-/g,'').slice(0,16)}`
    await service.rpc('contrato_marcar_enviado', {
      p_contrato_id: contratoId,
      p_envelope_id: envelopeId,
      p_provedor: 'clicksign',
    })
    // grava request_signature_key fake por signer
    for (const s of signers) {
      await service.from('assinaturas_contrato').update({
        provider_request_signature_key: `dev_${s.id.slice(0, 8)}`,
      }).eq('id', s.id)
    }
    return jsonResponse({
      envelope_id: envelopeId,
      dev_mode: true,
      signatarios: signers.map(s => ({ id: s.id, email: s.signatario_email })),
    })
  }

  // ---- Clicksign real ----
  // 1) cria documento
  const docRes = await fetch(`${CLICKSIGN_API_URL}/api/v1/documents?access_token=${CLICKSIGN_TOKEN}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ document: { path: `/Mercurio/${contratoId}-${filename}`, content_base64: dataUri } }),
  })
  if (!docRes.ok) {
    const t = await docRes.text()
    return jsonResponse({ error: 'clicksign_doc_error', detail: t }, 502)
  }
  const docJson = await docRes.json() as { document: { key: string } }
  const documentKey = docJson.document.key

  // 2) cria signers
  const signerKeys: Array<{ asg_id: string; signer_key: string; req_key: string; email: string }> = []
  for (const s of signers) {
    const signerRes = await fetch(`${CLICKSIGN_API_URL}/api/v1/signers?access_token=${CLICKSIGN_TOKEN}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ signer: {
        email: s.signatario_email, name: s.signatario_nome,
        documentation: s.signatario_cpf_cnpj ?? undefined,
        auths: ['email'], delivery: 'email',
      }}),
    })
    if (!signerRes.ok) {
      const t = await signerRes.text()
      return jsonResponse({ error: 'clicksign_signer_error', detail: t }, 502)
    }
    const sJson = await signerRes.json() as { signer: { key: string } }
    // 3) vincula signer ao documento
    const listRes = await fetch(`${CLICKSIGN_API_URL}/api/v1/lists?access_token=${CLICKSIGN_TOKEN}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ list: { document_key: documentKey, signer_key: sJson.signer.key, sign_as: 'sign' }}),
    })
    if (!listRes.ok) {
      const t = await listRes.text()
      return jsonResponse({ error: 'clicksign_list_error', detail: t }, 502)
    }
    const lJson = await listRes.json() as { list: { request_signature_key: string } }
    signerKeys.push({
      asg_id: s.id, signer_key: sJson.signer.key,
      req_key: lJson.list.request_signature_key, email: s.signatario_email,
    })
    // grava key no DB
    await service.from('assinaturas_contrato')
      .update({ provider_request_signature_key: lJson.list.request_signature_key })
      .eq('id', s.id)
  }

  // 4) marca contrato como enviado
  await service.rpc('contrato_marcar_enviado', {
    p_contrato_id: contratoId,
    p_envelope_id: documentKey,
    p_provedor: 'clicksign',
  })

  return jsonResponse({
    envelope_id: documentKey,
    signatarios: signerKeys.map(s => ({ email: s.email, request_key: s.req_key })),
  })
})

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

