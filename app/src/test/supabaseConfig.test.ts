import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PROD_SUPABASE_ANON_KEY,
  DEFAULT_PROD_SUPABASE_URL,
  resolveSupabaseConfig,
} from '@/lib/supabaseConfig'

describe('resolveSupabaseConfig', () => {
  it('prioriza variaveis de ambiente quando presentes', () => {
    const resolved = resolveSupabaseConfig({
      supabaseUrl: 'https://custom.supabase.co',
      supabaseAnonKey: 'custom-publishable-key',
      isDev: false,
    })

    expect(resolved).toEqual({
      url: 'https://custom.supabase.co',
      anonKey: 'custom-publishable-key',
      usedFallback: false,
    })
  })

  it('usa fallback local em dev quando variaveis nao estao configuradas', () => {
    const resolved = resolveSupabaseConfig({
      supabaseUrl: undefined,
      supabaseAnonKey: undefined,
      isDev: true,
    })

    expect(resolved).toEqual({
      url: 'http://localhost:54321',
      anonKey: 'public-anon-key',
      usedFallback: true,
    })
  })

  it('usa fallback de producao fora de dev quando variaveis nao estao configuradas', () => {
    const resolved = resolveSupabaseConfig({
      supabaseUrl: undefined,
      supabaseAnonKey: undefined,
      isDev: false,
    })

    expect(resolved).toEqual({
      url: DEFAULT_PROD_SUPABASE_URL,
      anonKey: DEFAULT_PROD_SUPABASE_ANON_KEY,
      usedFallback: true,
    })
  })

  it('usa o par de fallback de producao quando a URL configurada e invalida', () => {
    const resolved = resolveSupabaseConfig({
      supabaseUrl: 'bhagksfvszeogtjvjtpx.supabase.co',
      supabaseAnonKey: 'key-for-the-invalid-url',
      isDev: false,
    })

    expect(resolved).toEqual({
      url: DEFAULT_PROD_SUPABASE_URL,
      anonKey: DEFAULT_PROD_SUPABASE_ANON_KEY,
      usedFallback: true,
    })
  })

  it('usa o par de fallback local quando a URL configurada e invalida em dev', () => {
    const resolved = resolveSupabaseConfig({
      supabaseUrl: 'ftp://localhost:54321',
      supabaseAnonKey: 'key-for-the-invalid-url',
      isDev: true,
    })

    expect(resolved).toEqual({
      url: 'http://localhost:54321',
      anonKey: 'public-anon-key',
      usedFallback: true,
    })
  })

  it('usa o fallback se a URL nao tiver um host valido', () => {
    const resolved = resolveSupabaseConfig({
      supabaseUrl: 'https://',
      supabaseAnonKey: 'key-for-the-invalid-url',
      isDev: false,
    })

    expect(resolved).toEqual({
      url: DEFAULT_PROD_SUPABASE_URL,
      anonKey: DEFAULT_PROD_SUPABASE_ANON_KEY,
      usedFallback: true,
    })
  })
})
