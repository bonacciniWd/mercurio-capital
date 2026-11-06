import { describe, expect, it } from 'vitest'
import { isValidEmailFormat, normalizeEmail } from '@/lib/emailValidation'

describe('email validation', () => {
  it('normalizes valid addresses before checking their format', () => {
    expect(normalizeEmail('  Pessoa@Dominio.com  ')).toBe('pessoa@dominio.com')
    expect(isValidEmailFormat('  Pessoa@Dominio.com  ')).toBe(true)
  })

  it.each(['', 'sem-arroba.com', 'pessoa@', 'pessoa@dominio', 'duplo@@dominio.com', 'pessoa@dominio.com ' + 'x'.repeat(250)])('rejects invalid or oversized address: %s', email => {
    expect(isValidEmailFormat(email)).toBe(false)
  })
})
