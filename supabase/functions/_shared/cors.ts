// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonResponse(body: unknown, init: ResponseInit | number = {}) {
  const resolved: ResponseInit = typeof init === 'number' ? { status: init } : init
  return new Response(JSON.stringify(body), {
    ...resolved,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders,
      ...(resolved.headers ?? {}),
    },
  })
}
