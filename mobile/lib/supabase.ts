import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { secureSessionStorage } from './secureSessionStorage'

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321'
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key'

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL e/ou EXPO_PUBLIC_SUPABASE_ANON_KEY não configurados.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'mercurio.mobile.auth',
  },
  global: {
    headers: {
      apikey: supabaseAnonKey,
    },
  },
})

