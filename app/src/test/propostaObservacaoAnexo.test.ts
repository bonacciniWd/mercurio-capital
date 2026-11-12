import { describe, expect, it, vi } from 'vitest'
import {
  createObservacaoAnexoSignedUrl,
  mapearErroObservacao,
  openObservacaoAnexo,
  uploadObservacaoAnexo,
  validarArquivoObservacao,
  PROPOSTA_OBS_ANEXO_MAX_BYTES,
} from '@/lib/propostaObservacaoAnexo'

const arquivo = (name: string, size = 1000, type?: string) => ({
  name, size, type: type ?? '',
}) as File

describe('validarArquivoObservacao', () => {
  it('aceita jpg/png/webp/heic até 2 MB', () => {
    expect(validarArquivoObservacao(arquivo('print.png', 500_000, 'image/png'))).toBeNull()
    expect(validarArquivoObservacao(arquivo('foto.jpg', 2 * 1024 * 1024, 'image/jpeg'))).toBeNull()
    expect(validarArquivoObservacao(arquivo('IMG.HEIC', 900_000, 'image/heic'))).toBeNull()
    expect(validarArquivoObservacao(arquivo('tela.webp', 10_000, 'image/webp'))).toBeNull()
  })

  it('rejeita formato, incoerência MIME/extensão e tamanho', () => {
    expect(validarArquivoObservacao(arquivo('doc.pdf', 1000, 'application/pdf'))).toMatch(/não suportado/i)
    expect(validarArquivoObservacao(arquivo('foto.png', 1000, 'image/jpeg'))).toMatch(/não corresponde/i)
    expect(validarArquivoObservacao(arquivo('grande.png', PROPOSTA_OBS_ANEXO_MAX_BYTES + 1, 'image/png'))).toMatch(/2 MB/)
    expect(validarArquivoObservacao(arquivo('semextensao', 1000, 'image/png'))).toMatch(/não suportado/i)
    expect(validarArquivoObservacao(arquivo('png', 1000, 'image/png'))).toMatch(/não suportado/i) // sem ponto
  })
})

describe('uploadObservacaoAnexo (2 fases)', () => {
  const prepararOk = vi.fn(async () => ({
    data: [{ anexo_id: 'a1', bucket: 'proposta-obs', storage_path: 'p1/a1-print.png' }],
    error: null,
  }))

  it('prepara e envia com o MIME da extensão; retorna anexo_id', async () => {
    const upload = vi.fn(async () => ({ error: null }))
    const id = await uploadObservacaoAnexo('p1', arquivo('print.png', 100, 'image/png'), { preparar: prepararOk, upload })
    expect(id).toBe('a1')
    expect(prepararOk).toHaveBeenCalledWith({
      p_proposta_id: 'p1', p_nome: 'print.png', p_mime_type: 'image/png', p_tamanho_bytes: 100,
    })
    expect(upload).toHaveBeenCalledWith('proposta-obs', 'p1/a1-print.png', expect.anything(), 'image/png')
  })

  it('não chama preparar quando a validação local falha', async () => {
    const preparar = vi.fn()
    await expect(uploadObservacaoAnexo('p1', arquivo('doc.pdf', 100, 'application/pdf'), { preparar }))
      .rejects.toThrow(/não suportado/i)
    expect(preparar).not.toHaveBeenCalled()
  })

  it('mapeia erro do servidor e falha de upload', async () => {
    const prepararErro = vi.fn(async () => ({ data: null, error: { message: 'maximo_3_anexos' } }))
    await expect(uploadObservacaoAnexo('p1', arquivo('a.png', 100, 'image/png'), { preparar: prepararErro }))
      .rejects.toThrow(/3 prints/)

    const uploadFalha = vi.fn(async () => ({ error: { message: 'storage fora' } }))
    await expect(uploadObservacaoAnexo('p1', arquivo('a.png', 100, 'image/png'), { preparar: prepararOk, upload: uploadFalha }))
      .rejects.toThrow(/Falha ao enviar/)
  })
})

describe('createObservacaoAnexoSignedUrl', () => {
  const signerOk = async () => ({ data: { signedUrl: 'https://signed.example/x' }, error: null })

  it('gera URL com TTL de 300s no bucket proposta-obs', async () => {
    const calls: unknown[][] = []
    const url = await createObservacaoAnexoSignedUrl('prop/obs-print.png', async (...args) => {
      calls.push(args)
      return signerOk()
    })
    expect(url).toBe('https://signed.example/x')
    expect(calls[0]).toEqual(['proposta-obs', 'prop/obs-print.png', 300])
  })

  it('rejeita path inválido sem chamar o signer', async () => {
    const signer = vi.fn()
    await expect(createObservacaoAnexoSignedUrl('/absoluto.png', signer)).rejects.toThrow(/inválido/i)
    await expect(createObservacaoAnexoSignedUrl('prop/../segredo.png', signer)).rejects.toThrow(/inválido/i)
    await expect(createObservacaoAnexoSignedUrl('   ', signer)).rejects.toThrow(/inválido/i)
    expect(signer).not.toHaveBeenCalled()
  })

  it('abre com noopener', () => {
    const openWindow = vi.fn(() => ({ opener: 'x' }) as unknown as Window)
    openObservacaoAnexo('https://signed.example/x', openWindow as unknown as typeof window.open)
    expect(openWindow).toHaveBeenCalledWith('https://signed.example/x', '_blank', 'noopener,noreferrer')
  })
})

describe('mapearErroObservacao', () => {
  it('traduz os códigos do modelo', () => {
    expect(mapearErroObservacao('janela_edicao_expirada')).toMatch(/15 minutos/)
    expect(mapearErroObservacao('fora_do_escopo')).toMatch(/não tem acesso/i)
    expect(mapearErroObservacao('motivo_obrigatorio')).toMatch(/motivo/i)
    expect(mapearErroObservacao('observacao_indisponivel')).toMatch(/Atualize a timeline/)
    expect(mapearErroObservacao('extensao_incoerente_com_mime')).toMatch(/não corresponde à extensão/)
    expect(mapearErroObservacao(undefined)).toMatch(/Tente novamente/)
  })
})
