export const DEFAULT_PROD_SUPABASE_URL = 'https://bhagksfvszeogtjvjtpx.supabase.co'
export const DEFAULT_PROD_SUPABASE_ANON_KEY = 'sb_publishable_yy63HQvHTvZF3PWoMxTmtw_rR4e7swA'
const DEFAULT_LOCAL_SUPABASE_URL = 'http://localhost:54321'
const DEFAULT_LOCAL_SUPABASE_ANON_KEY = 'public-anon-key'

type ResolveSupabaseConfigInput = {
  supabaseUrl: string | undefined
  supabaseAnonKey: string | undefined
  isDev: boolean
}

export type ResolvedSupabaseConfig = {
  url: string
  anonKey: string
  usedFallback: boolean
}

function normalizeHttpUrl(value: string | undefined): string | undefined {
  const candidate = value?.trim()
  if (!candidate) return undefined

  try {
    const parsed = new URL(candidate)
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return undefined
    }

    return candidate
  } catch {
    return undefined
  }
}

export function resolveSupabaseConfig(input: ResolveSupabaseConfigInput): ResolvedSupabaseConfig {
  const configuredUrl = input.supabaseUrl?.trim()
  const envUrl = normalizeHttpUrl(configuredUrl)
  const envAnonKey = input.supabaseAnonKey?.trim()
  const invalidEnvUrl = Boolean(configuredUrl && !envUrl)

  if (envUrl && envAnonKey) {
    return {
      url: envUrl,
      anonKey: envAnonKey,
      usedFallback: false,
    }
  }

  if (input.isDev) {
    return {
      url: envUrl || DEFAULT_LOCAL_SUPABASE_URL,
      anonKey: invalidEnvUrl ? DEFAULT_LOCAL_SUPABASE_ANON_KEY : envAnonKey || DEFAULT_LOCAL_SUPABASE_ANON_KEY,
      usedFallback: true,
    }
  }

  return {
    url: envUrl || DEFAULT_PROD_SUPABASE_URL,
    anonKey: invalidEnvUrl ? DEFAULT_PROD_SUPABASE_ANON_KEY : envAnonKey || DEFAULT_PROD_SUPABASE_ANON_KEY,
    usedFallback: true,
  }
}
