// Uso:
// VIMEO_ACCESS_TOKEN='<token_com_upload>' deno run --allow-net --allow-env supabase/smoke-tests/vimeo-upload-permission.ts
// Cria um video TUS de 1MB no Vimeo e tenta remover em seguida. Nao imprime o token.

const token = Deno.env.get('VIMEO_ACCESS_TOKEN')?.trim()
if (!token) {
  console.error('VIMEO_ACCESS_TOKEN ausente no ambiente.')
  Deno.exit(2)
}

function safeDetail(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .slice(0, 500)
}

function extractVideoId(payload: unknown): string | null {
  const obj = payload as { uri?: string; link?: string; upload?: { upload_link?: string; link?: string } } | null
  const raw = obj?.uri ?? obj?.link ?? ''
  const uriMatch = raw.match(/\/videos\/(\d+)/)
  if (uriMatch) return uriMatch[1]
  const urlMatch = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return urlMatch?.[1] ?? null
}

const createRes = await fetch('https://api.vimeo.com/me/videos', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.vimeo.*+json;version=3.4',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    upload: { approach: 'tus', size: '1048576' },
    name: 'Mercurio manual Vimeo upload permission test',
    description: 'Criado pelo smoke test; deve ser removido automaticamente.',
    privacy: { view: 'nobody' },
  }),
})

const createText = await createRes.text()
console.log(`vimeo_create_status=${createRes.status}`)

if (!createRes.ok) {
  console.log(`vimeo_create_detail=${safeDetail(createText)}`)
  if (createRes.status === 401 || createRes.status === 403) {
    console.log('acao=Recriar o token Vimeo com escopos de upload/criacao/edicao.')
  }
  Deno.exit(1)
}

let payload: unknown = null
try {
  payload = createText ? JSON.parse(createText) : null
} catch {
  console.log('vimeo_payload_parse=failed')
  Deno.exit(1)
}

const videoId = extractVideoId(payload)
const uploadLink = (payload as { upload?: { upload_link?: string; link?: string } } | null)?.upload?.upload_link
  ?? (payload as { upload?: { upload_link?: string; link?: string } } | null)?.upload?.link

console.log(`vimeo_id=${videoId ?? 'missing'}`)
console.log(`upload_link_present=${Boolean(uploadLink)}`)

if (!videoId || !uploadLink) {
  console.log(`vimeo_payload_detail=${safeDetail(createText)}`)
  Deno.exit(1)
}

const deleteRes = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
  method: 'DELETE',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.vimeo.*+json;version=3.4',
  },
})
console.log(`vimeo_delete_status=${deleteRes.status}`)

if (!deleteRes.ok && deleteRes.status !== 204) {
  const deleteText = await deleteRes.text()
  console.log(`vimeo_delete_detail=${safeDetail(deleteText)}`)
  Deno.exit(1)
}

console.log('vimeo_upload_permission=ok')
