import { describe, expect, it, vi } from 'vitest'
import {
  createPropostaDocumentoSignedUrl,
  openPropostaDocumento,
  PROPOSTA_DOCUMENTO_TTL_SECONDS,
  type PropostaDocumentoSigner,
} from '@/lib/propostaDocumento'

describe('visualização segura de documentos da proposta', () => {
  it('gera URL assinada no bucket canônico por cinco minutos', async () => {
    const signer = vi.fn<PropostaDocumentoSigner>().mockResolvedValue({
      data: { signedUrl: 'https://storage.example/signed' },
      error: null,
    })

    await expect(createPropostaDocumentoSignedUrl('proposal-id/pf/document.pdf', signer))
      .resolves.toBe('https://storage.example/signed')

    expect(signer).toHaveBeenCalledWith(
      'proposta-docs',
      'proposal-id/pf/document.pdf',
      PROPOSTA_DOCUMENTO_TTL_SECONDS,
    )
  })

  it('recusa caminho vazio, absoluto ou com travessia', async () => {
    const signer = vi.fn<PropostaDocumentoSigner>()

    await expect(createPropostaDocumentoSignedUrl('', signer)).rejects.toThrow('Caminho')
    await expect(createPropostaDocumentoSignedUrl('/proposal/document.pdf', signer)).rejects.toThrow('Caminho')
    await expect(createPropostaDocumentoSignedUrl('proposal/../document.pdf', signer)).rejects.toThrow('Caminho')
    expect(signer).not.toHaveBeenCalled()
  })

  it('propaga uma mensagem segura quando a assinatura falha', async () => {
    const signer = vi.fn<PropostaDocumentoSigner>().mockResolvedValue({
      data: null,
      error: { message: 'storage indisponível' },
    })

    await expect(createPropostaDocumentoSignedUrl('proposal/document.pdf', signer))
      .rejects.toThrow('storage indisponível')
  })

  it('abre nova aba sem acesso ao opener', () => {
    const opened = { opener: {} } as Window
    const openWindow = vi.fn(() => opened) as unknown as typeof window.open

    openPropostaDocumento('https://storage.example/signed', openWindow)

    expect(openWindow).toHaveBeenCalledWith(
      'https://storage.example/signed',
      '_blank',
      'noopener,noreferrer',
    )
    expect(opened.opener).toBeNull()
  })
})
