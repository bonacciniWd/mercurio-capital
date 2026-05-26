import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

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
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'mercurio.mobile.auth',
  },
})

