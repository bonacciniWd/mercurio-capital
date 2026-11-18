import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), remove: vi.fn(), signed: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {
  rpc: mocks.rpc,
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.signed }) },
} }))

import { cancelarAnexoCliente, enviarAnexoCliente, prepararAnexoCliente, urlAnexoCliente } from '@/lib/prospeccaoClienteAnexo'

const reservation = { anexo_id: 'print-1', bucket: 'prospeccao-clientes-anexos', storage_path: 'prospect/print-1.png' }
const file = () => new File(['print'], 'print.png', { type: 'image/png' })
const missingObject = { error: { code: '22023', message: 'anexo_sem_objeto_valido' } }

beforeEach(() => { vi.resetAllMocks() })

describe('prints privados B2C', () => {
  it('recusa formato ou tamanho inválido antes de reservar no servidor', async () => {
    await expect(prepararAnexoCliente('prospect', new File(['pdf'], 'print.pdf', { type: 'application/pdf' }))).rejects.toThrow()
    await expect(prepararAnexoCliente('prospect', new File([new Uint8Array(2097153)], 'print.png', { type: 'image/png' }))).rejects.toThrow()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('reserva usando tamanho e MIME reais; não aceita outro bucket', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [reservation], error: null })
    expect(await prepararAnexoCliente('prospect', file())).toEqual(reservation)
    expect(mocks.rpc).toHaveBeenCalledWith('prospeccao_cliente_anexo_preparar', { p_prospeccao_id: 'prospect', p_nome: 'print.png', p_mime_type: 'image/png', p_tamanho_bytes: 5 })
    mocks.rpc.mockResolvedValueOnce({ data: [{ ...reservation, bucket: 'publico' }], error: null })
    await expect(prepararAnexoCliente('prospect', file())).rejects.toThrow('reservar')
  })

  it('recupera confirmação perdida sem subir ou reservar outro arquivo', async () => {
    mocks.rpc.mockResolvedValue({ error: null })
    await enviarAnexoCliente(reservation, file())
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('só termina após upload sem overwrite e confirmação do objeto', async () => {
    mocks.rpc.mockResolvedValueOnce(missingObject).mockResolvedValueOnce({ error: null })
    mocks.upload.mockResolvedValue({ error: null })
    await enviarAnexoCliente(reservation, file())
    expect(mocks.upload).toHaveBeenCalledWith(reservation.storage_path, expect.any(File), { upsert: false, contentType: 'image/png' })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'prospeccao_cliente_anexo_confirmar', { p_anexo_id: reservation.anexo_id })
  })

  it('propaga falha de confirmação sem informar sucesso', async () => {
    mocks.rpc.mockResolvedValueOnce(missingObject).mockResolvedValueOnce({ error: { code: '42501' } })
    mocks.upload.mockResolvedValue({ error: null })
    await expect(enviarAnexoCliente(reservation, file())).rejects.toThrow('acesso')
  })

  it('não envia arquivo para uma reserva expirada', async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: '22023', message: 'reserva_expirada' } })
    await expect(enviarAnexoCliente(reservation, file())).rejects.toThrow('expirou')
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('não cancela o vínculo se a remoção do objeto falhar', async () => {
    mocks.remove.mockResolvedValueOnce({ error: { message: 'offline' } })
    await expect(cancelarAnexoCliente(reservation)).rejects.toThrow('rascunho')
    expect(mocks.rpc).not.toHaveBeenCalled()
    mocks.remove.mockResolvedValueOnce({ error: null })
    mocks.rpc.mockResolvedValueOnce({ error: null })
    await cancelarAnexoCliente(reservation)
    expect(mocks.rpc).toHaveBeenCalledWith('prospeccao_cliente_anexo_cancelar', { p_anexo_id: 'print-1' })
  })

  it('abre por URL assinada de cinco minutos e reporta falha', async () => {
    mocks.signed.mockResolvedValueOnce({ data: { signedUrl: 'https://signed/print' }, error: null })
    expect(await urlAnexoCliente(reservation.storage_path)).toBe('https://signed/print')
    expect(mocks.signed).toHaveBeenCalledWith(reservation.storage_path, 300)
    mocks.signed.mockResolvedValueOnce({ data: null, error: { message: 'forbidden' } })
    await expect(urlAnexoCliente(reservation.storage_path)).rejects.toThrow('abrir')
  })
})
