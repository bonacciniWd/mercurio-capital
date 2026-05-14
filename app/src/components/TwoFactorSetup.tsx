import { FormEvent, useEffect, useState } from 'react'
import { ShieldCheck, Copy, Check, RefreshCw } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import type { TwoFactorEnrollment } from '@/auth/authClient'

type Props = {
  /** Nome amigável persistido no Supabase (ex.: "Mercurio Admin"). */
  friendlyName?: string
  /** Callback opcional após verificar com sucesso. */
  onVerified?: () => void
  /** Esconde o cabeçalho (útil quando embutido em uma página de configurações). */
  compact?: boolean
}

/**
 * Fluxo completo de cadastro de 2FA TOTP:
 *  1. Chama `beginTwoFactorEnrollment` → recebe QR + secret.
 *  2. Usuário escaneia no app autenticador (Google Authenticator, 1Password, Authy...).
 *  3. Usuário digita o código de 6 dígitos → `confirmTwoFactorEnrollment` valida e ativa o factor.
 */
export function TwoFactorSetup({ friendlyName = 'Mercurio TOTP', onVerified, compact }: Props) {
  const { beginTwoFactorEnrollment, confirmTwoFactorEnrollment } = useAuth()
  const [enrollment, setEnrollment] = useState<TwoFactorEnrollment | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  async function start() {
    setLoading(true)
    setError(null)
    setSuccess(false)
    setCode('')
    try {
      const result = await beginTwoFactorEnrollment(friendlyName)
      setEnrollment(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao iniciar o cadastro do 2FA.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enrollment) return
    setVerifying(true)
    setError(null)
    try {
      await confirmTwoFactorEnrollment(enrollment.factorId, code)
      setSuccess(true)
      onVerified?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido. Tente novamente.')
    } finally {
      setVerifying(false)
    }
  }

  async function copySecret() {
    if (!enrollment) return
    try {
      await navigator.clipboard.writeText(enrollment.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-gold/10 p-2 text-gold-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-navy">Cadastrar autenticação em duas etapas</h2>
            <p className="text-sm text-silver-600">
              Use um app autenticador (Google Authenticator, 1Password, Authy, Microsoft Authenticator) para gerar códigos
              únicos de 6 dígitos a cada login.
            </p>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-silver-500">Gerando QR code seguro…</p>}

      {error && !success && (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {success && (
        <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          2FA ativado com sucesso. Da próxima vez que entrar usaremos seu app autenticador.
        </div>
      )}

      {enrollment && !success && (
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center gap-3">
            <div
              className="rounded-lg border border-silver-200 bg-white p-3 [&>svg]:h-44 [&>svg]:w-44"
              // O Supabase devolve o QR já como SVG markup → injetamos com dangerouslySetInnerHTML.
              dangerouslySetInnerHTML={{ __html: enrollment.qrCodeSvg }}
            />
            <button type="button" onClick={start} className="btn-outline btn-no-liquid text-xs" disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" /> Gerar novo QR
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">
                1. Escaneie o QR ou cole a chave manual
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded-md border border-silver-200 bg-silver-50 px-3 py-2 font-mono text-xs text-silver-800">
                  {enrollment.secret}
                </code>
                <button type="button" onClick={copySecret} className="btn-outline btn-no-liquid text-xs">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-3">
              <div>
                <label className="label">2. Digite o código gerado no app</label>
                <input
                  className="input tracking-widest text-center text-lg"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn-gold w-full"
                disabled={verifying || code.length !== 6}
              >
                {verifying ? 'Validando…' : 'Ativar 2FA'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

