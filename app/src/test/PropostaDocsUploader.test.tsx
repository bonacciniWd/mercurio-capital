import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PropostaDocsUploader } from '@/components/PropostaDocsUploader'

const mocks = vi.hoisted(() => ({
  storageUpload: vi.fn(),
  storageRemove: vi.fn(),
  insert: vi.fn(),
  insertSingle: vi.fn(),
}))

vi.mock('@/lib/supabase', () => {
  const createQuery = () => {
    const query: Record<string, unknown> = {}
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.not = vi.fn(() => query)
    query.insert = vi.fn((values: unknown) => { mocks.insert(values); return query })
    query.delete = vi.fn(() => query)
    query.order = vi.fn().mockResolvedValue({ data: [], error: null })
    query.single = mocks.insertSingle
    return query
  }

  return {
    supabase: {
      from: vi.fn(() => createQuery()),
      storage: {
        from: vi.fn(() => ({ upload: mocks.storageUpload, remove: mocks.storageRemove })),
      },
      rpc: vi.fn(),
    },
  }
})

function renderUploader(enableBatchUpload = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PropostaDocsUploader propostaId="proposal-1" origem="parceiro" enableBatchUpload={enableBatchUpload} />
    </QueryClientProvider>,
  )
}

function makeFile(name: string, type = 'application/pdf') {
  return new File(['document content'], name, { type })
}

describe('PropostaDocsUploader', () => {
  beforeEach(() => {
    mocks.storageUpload.mockReset().mockResolvedValue({ error: null })
    mocks.storageRemove.mockReset().mockResolvedValue({ error: null })
    mocks.insert.mockReset()
    mocks.insertSingle.mockReset().mockResolvedValue({ data: { id: 'document-1' }, error: null })
  })

  it('envia em sequência todos os arquivos selecionados e registra um documento por arquivo', async () => {
    renderUploader(true)
    expect(screen.getByTestId('upload-illustration')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText(/Até 20 MB por arquivo/)).toBeInTheDocument()
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    const files = [makeFile('contrato.pdf'), makeFile('matricula.pdf')]

    expect(input.multiple).toBe(true)
    fireEvent.change(input, { target: { files } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar 2 arquivos' }))

    await waitFor(() => expect(mocks.storageUpload).toHaveBeenCalledTimes(2))
    expect(mocks.insert).toHaveBeenCalledTimes(2)
    expect(await screen.findAllByText(/Enviado$/)).toHaveLength(2)
  })

  it('permite classificar cada arquivo com um tipo diferente no mesmo lote', async () => {
    renderUploader(true)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [makeFile('matricula.pdf'), makeFile('contrato.pdf')] } })
    fireEvent.change(screen.getByLabelText('Tipo de documento para matricula.pdf'), { target: { value: 'matricula_imovel' } })
    fireEvent.change(screen.getByLabelText('Tipo de documento para contrato.pdf'), { target: { value: 'contrato_compra_venda' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar 2 arquivos' }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(2))
    expect(mocks.insert).toHaveBeenNthCalledWith(1, expect.objectContaining({ tipo: 'matricula_imovel', categoria: 'imovel' }))
    expect(mocks.insert).toHaveBeenNthCalledWith(2, expect.objectContaining({ tipo: 'contrato_compra_venda', categoria: 'imovel' }))
  })

  it('adiciona múltiplos arquivos arrastados à fila', async () => {
    renderUploader(true)
    const dropzone = screen.getByTestId('proposta-docs-dropzone')

    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile('documento-a.pdf'), makeFile('documento-b.pdf')] } })

    expect(await screen.findByText('documento-a.pdf')).toBeInTheDocument()
    expect(screen.getByText('documento-b.pdf')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar 2 arquivos' })).toBeInTheDocument()
  })

  it('valida cada arquivo separadamente e permite enviar os válidos do lote', async () => {
    renderUploader(true)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [makeFile('contrato.pdf'), makeFile('virus.exe', 'application/octet-stream')] } })

    expect(screen.getByText(/Formato de arquivo não aceito\.$/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar 1 arquivo' }))

    await waitFor(() => expect(mocks.storageUpload).toHaveBeenCalledTimes(1))
    expect(mocks.insert).toHaveBeenCalledTimes(1)
  })

  it('preserva sucesso parcial e permite reenviar apenas o arquivo que falhou', async () => {
    mocks.storageUpload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'Storage indisponível' } })
      .mockResolvedValueOnce({ error: null })
    renderUploader(true)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [makeFile('sucesso.pdf'), makeFile('falha.pdf')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar 2 arquivos' }))

    expect(await screen.findByText(/Storage indisponível$/)).toBeInTheDocument()
    expect(mocks.insert).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(mocks.storageUpload).toHaveBeenCalledTimes(3))
    expect(mocks.insert).toHaveBeenCalledTimes(2)
    expect(await screen.findAllByText(/Enviado$/)).toHaveLength(2)
  })

  it('mantém o seletor unitário por padrão para o portal cliente', async () => {
    renderUploader()
    expect(screen.queryByTestId('upload-illustration')).not.toBeInTheDocument()
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    expect(input.multiple).toBe(false)
    fireEvent.change(input, { target: { files: [makeFile('primeiro.pdf'), makeFile('segundo.pdf')] } })

    await waitFor(() => expect(mocks.storageUpload).toHaveBeenCalledTimes(1))
    expect(mocks.insert).toHaveBeenCalledTimes(1)
  })
})
