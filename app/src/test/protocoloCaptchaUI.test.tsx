import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), load: vi.fn(), execute: vi.fn() }))
vi.mock('react-router-dom', () => ({ useParams: () => ({ codigo: 'MC-2026-TEST' }) }))
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: mocks.invoke } } }))
vi.mock('@/components/Logo', () => ({ Logo: () => <span>Logo</span> }))
vi.mock('@/lib/recaptchaV3', () => ({
  PROTOCOL_RECAPTCHA_ACTION: 'consulta_protocolo',
  loadRecaptchaV3: mocks.load,
  executeRecaptchaV3: mocks.execute,
}))
import { Protocolo } from '@/pages/public/Protocolo'
beforeEach(() => {
  vi.stubEnv('VITE_RECAPTCHA_SITEKEY', 'synthetic')
  mocks.invoke.mockReset()
  mocks.load.mockReset().mockResolvedValue(undefined)
  mocks.execute.mockReset().mockResolvedValue('synthetic-token')
})
it('carrega v3 sem executar até o envio e envia token com a ação esperada', async () => {
  mocks.invoke.mockResolvedValue({ data: { encontrado: false }, error: null })
  render(<Protocolo />)
  expect(mocks.invoke).not.toHaveBeenCalled()
  expect(await screen.findByText('Verificação automática de segurança ativa.')).toBeTruthy()
  expect(mocks.load).toHaveBeenCalledWith('synthetic')
  expect(mocks.execute).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Consultar proposta' }))
  await screen.findByText('Nenhuma proposta encontrada para este protocolo.')
  expect(mocks.execute).toHaveBeenCalledWith('synthetic', 'consulta_protocolo')
  expect(mocks.invoke).toHaveBeenCalledWith('public-consulta-protocolo', { body: { codigo: 'MC-2026-TEST', captcha_token: 'synthetic-token' } })
})
it('falha fechada quando script v3 não carrega', async () => {
  mocks.load.mockRejectedValue(new Error('unavailable'))
  render(<Protocolo />)
  expect(await screen.findByText('Verificação de segurança indisponível. Tente novamente mais tarde.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Consultar proposta' })).toBeDisabled()
  expect(mocks.invoke).not.toHaveBeenCalled()
})

it('mostra dados retornados e limpa resultado ao editar o protocolo', async () => {
  mocks.invoke.mockResolvedValue({ data: { encontrado: true, protocolo: 'MC-2026-TEST', produto: 'home_equity', status: 'cancelado', valor_solicitado: 1234 }, error: null })
  render(<Protocolo />)
  await screen.findByText('Verificação automática de segurança ativa.')
  fireEvent.click(screen.getByRole('button', { name: 'Consultar proposta' }))
  expect(await screen.findByText('Proposta cancelada')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Número do protocolo'), { target: { value: 'NOVO' } })
  expect(screen.queryByLabelText('Resultado da consulta')).toBeNull()
})
it('descarta resposta de uma consulta cujo protocolo foi editado durante o envio', async () => {
  let resolve: (value: unknown) => void = () => {}
  mocks.invoke.mockImplementation(() => new Promise((done) => { resolve = done }))
  render(<Protocolo />)
  await screen.findByText('Verificação automática de segurança ativa.')
  fireEvent.click(screen.getByRole('button', { name: 'Consultar proposta' }))
  await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalled())
  fireEvent.change(screen.getByLabelText('Número do protocolo'), { target: { value: 'NOVO' } })
  resolve({ data: { encontrado: true, protocolo: 'ANTIGO' }, error: null })
  await screen.findByRole('button', { name: 'Consultar proposta' })
  expect(screen.queryByText('ANTIGO')).toBeNull()
})
