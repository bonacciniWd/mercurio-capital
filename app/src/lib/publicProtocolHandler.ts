const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function jsonResponse(body: unknown, init: ResponseInit | number = {}) {
  const resolved: ResponseInit = typeof init === 'number' ? { status: init } : init
  return new Response(JSON.stringify(body), { ...resolved, headers: { 'content-type': 'application/json', ...corsHeaders, ...(resolved.headers ?? {}) } })
}

type RpcResult = { data: unknown; error: unknown }
type Dependencies = {
  secret: string
  hostnames: string[]
  minimumScore: number
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>
  fetcher?: typeof fetch
}

export function createHandler({ secret, hostnames, minimumScore, rpc, fetcher = fetch }: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const fail = (error: string, status: number) => jsonResponse({ error }, status)
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
    if (req.method !== 'POST') return fail('method_not_allowed', 405)
    if (!secret || !hostnames.length || !Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 1) return fail('captcha_unavailable', 503)
    try {
      // Stream with a hard bound, including requests without Content-Length.
      const reader = req.body?.getReader()
      if (!reader) return fail('invalid_payload', 400)
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 8192) { await reader.cancel(); return fail('payload_too_large', 413) }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      let body: unknown
      try { body = JSON.parse(new TextDecoder().decode(bytes)) } catch { return fail('invalid_payload', 400) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('invalid_payload', 400)
      const { codigo, captcha_token: token } = body as Record<string, unknown>
      if (typeof codigo !== 'string' || !/^[a-zA-Z0-9-]{3,80}$/.test(codigo.trim())) return fail('invalid_codigo', 400)
      if (typeof token !== 'string' || !token.trim() || token.length > 4096) return fail('captcha_required', 400)
      // Supabase gateway headers only; never accept a client-supplied body IP.
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
      const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      const limit = await rpc('public_protocolo_rate_consume', { p_chave: `protocolo-ip::${key}` })
      if (limit.error) return fail('service_unavailable', 503)
      if (limit.data !== true) return fail('rate_limited', 429)
      let verification: Response
      try {
        verification = await fetcher('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret, response: token }),
          signal: AbortSignal.timeout(8000),
        })
        if (!verification.ok) return fail('captcha_unavailable', 503)
        const result = await verification.json()
        if (
          result?.success !== true ||
          typeof result.hostname !== 'string' ||
          !hostnames.includes(result.hostname.toLowerCase()) ||
          result.action !== 'consulta_protocolo' ||
          typeof result.score !== 'number' ||
          !Number.isFinite(result.score) ||
          result.score < minimumScore
        ) return fail('captcha_invalid', 400)
      } catch { return fail('captcha_unavailable', 503) }
      const result = await rpc('public_consulta_protocolo', { p_codigo: codigo.trim(), p_captcha_token: null })
      if (result.error) return fail('service_unavailable', 503)
      return jsonResponse(result.data, { headers: { 'Cache-Control': 'no-store' } })
    } catch { return fail('service_unavailable', 503) }
  }
}
