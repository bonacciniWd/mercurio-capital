import { describe, it, expect, vi } from 'vitest'
import { createHandler } from '@/lib/publicProtocolHandler'
const valid = { codigo: 'MC-2026-TEST', captcha_token: 'synthetic-token' }
const validVerification = { success: true, hostname: 'example.com', action: 'consulta_protocolo', score: 0.9 }
function setup(result: unknown = validVerification, secret = 'synthetic', limited = false, minimumScore = 0.5) {
  const rpc = vi.fn(async (name: string) => ({ data: name === 'public_protocolo_rate_consume' ? !limited : { encontrado: false }, error: null }))
  const fetcher = vi.fn(async () => { if (result instanceof Error) throw result; return new Response(JSON.stringify(result)) })
  const handler = createHandler({ secret, hostnames: ['example.com'], minimumScore, rpc, fetcher: fetcher as typeof fetch })
  return { rpc, fetcher, send: (body: unknown) => handler(new Request('https://example.com', { method: 'POST', body: JSON.stringify(body) })) }
}
describe('protocolo CAPTCHA server-side', () => {
  it('retorna contrato original após validação sem levar token para SQL', async () => {
    const { send, rpc } = setup()
    const response = await send(valid)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ encontrado: false })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(rpc).toHaveBeenLastCalledWith('public_consulta_protocolo', { p_codigo: valid.codigo, p_captcha_token: null })
  })
  it.each([undefined, '', 1])('rejeita token %s', async captcha_token => {
    const { send, rpc } = setup()
    expect((await send({ ...valid, captcha_token })).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it.each([
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { ...validVerification, hostname: 'evil.com' },
    { ...validVerification, action: 'outra_acao' },
    { ...validVerification, score: 0.49 },
    { success: true, hostname: 'example.com', action: 'consulta_protocolo' },
  ])('bloqueia resposta %j', async result => {
    const { send, rpc } = setup(result)
    expect((await send(valid)).status).toBe(400)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('bloqueia indisponibilidade Google', async () => {
    const { send, rpc } = setup(new Error('timeout'))
    expect((await send(valid)).status).toBe(503)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('bloqueia configuração ausente', async () => {
    const { send, rpc } = setup({}, '')
    expect((await send(valid)).status).toBe(503)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('bloqueia limite de score inválido e permite score no limite', async () => {
    const invalid = setup(validVerification, 'synthetic', false, Number.NaN)
    expect((await invalid.send(valid)).status).toBe(503)
    expect(invalid.fetcher).not.toHaveBeenCalled()

    const boundary = setup({ ...validVerification, score: 0.5 }, 'synthetic', false, 0.5)
    expect((await boundary.send(valid)).status).toBe(200)
  })
  it('limita antes de chamar Google', async () => {
    const { send, fetcher } = setup({}, 'synthetic', true)
    expect((await send(valid)).status).toBe(429)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejeita código e excesso de payload', async () => {
    const { send, rpc } = setup()
    expect((await send({ ...valid, codigo: '<script>' })).status).toBe(400)
    expect((await send({ ...valid, captcha_token: 'x'.repeat(9000) })).status).toBe(413)
    expect(rpc).not.toHaveBeenCalled()
  })
})
