import { describe, expect, it } from 'vitest'
import { mapearErroProspeccaoCliente, prospeccaoClienteTelefoneDisplay } from '@/lib/prospeccaoCliente'

describe('prospeccaoCliente', () => {
  it('formata telefone brasileiro da carteira sem armazenar máscara', () => {
    expect(prospeccaoClienteTelefoneDisplay('47989279037')).toBe('(47) 98927-9037')
  })

  it('traduz conflitos e bloqueios de negócio do servidor', () => {
    expect(mapearErroProspeccaoCliente('40001', 'prospeccao_cliente_status_conflito'))
      .toContain('Outro usuário atualizou')
    expect(mapearErroProspeccaoCliente('42501', 'equipe_nao_alteravel'))
      .toContain('não podem reatribuir')
    expect(mapearErroProspeccaoCliente('42501', '2fa_required'))
      .toContain('verificação 2FA')
    expect(mapearErroProspeccaoCliente('22023', 'motivo_perda_obrigatorio'))
      .toContain('motivo da perda')
  })
})
