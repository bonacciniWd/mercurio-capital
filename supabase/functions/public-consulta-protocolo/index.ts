import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { createHandler } from '../../../app/src/lib/publicProtocolHandler.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const rawMinimumScore = Deno.env.get('RECAPTCHA_MIN_SCORE')
const minimumScore = rawMinimumScore === undefined
  ? 0.5
  : rawMinimumScore.trim() === ''
    ? Number.NaN
    : Number(rawMinimumScore)

Deno.serve(createHandler({
  secret: Deno.env.get('RECAPTCHA_SECRET_KEY')?.trim() ?? '',
  hostnames: (Deno.env.get('RECAPTCHA_ALLOWED_HOSTNAMES') ?? '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean),
  minimumScore,
  rpc: (name, args) => admin.rpc(name, args),
}))
