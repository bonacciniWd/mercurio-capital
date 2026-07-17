import { describe, expect, it } from 'vitest'
import { PUBLIC_APP_URL, publicAppUrl } from '@/lib/publicUrl'

describe('publicAppUrl', () => {
  it('usa o domínio canônico e normaliza caminhos públicos', () => {
    expect(PUBLIC_APP_URL).toBe('https://mercuriocapitalsa.com.br')
    expect(publicAppUrl('/c/proposta/token-123')).toBe(
      'https://mercuriocapitalsa.com.br/c/proposta/token-123',
    )
    expect(publicAppUrl('convite/token-456')).toBe(
      'https://mercuriocapitalsa.com.br/convite/token-456',
    )
  })
})