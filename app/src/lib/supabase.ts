import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseConfig } from '@/lib/supabaseConfig'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const resolvedConfig = resolveSupabaseConfig({
  supabaseUrl,
  supabaseAnonKey,
  isDev: import.meta.env.DEV,
})

if (resolvedConfig.usedFallback) {
  const fallbackType = import.meta.env.DEV ? 'local/dev' : 'produção'
  console.warn(
    `[supabase] VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY ausentes. Usando fallback ${fallbackType}: ${resolvedConfig.url}`,
  )
}

export const supabase = createClient(
  resolvedConfig.url,
  resolvedConfig.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'mercurio.auth',
    },
    global: {
      headers: {
        apikey: resolvedConfig.anonKey,
      },
    },
  },
)

