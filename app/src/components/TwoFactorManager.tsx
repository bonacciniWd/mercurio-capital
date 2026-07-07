import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { AAL2_REQUIRED_FOR_UNENROLL_CODE, listTwoFactorFactors } from '@/auth/authClient'
import { TwoFactorSetup } from '@/components/TwoFactorSetup'

type Factor = Awaited<ReturnType<typeof listTwoFactorFactors>>[number]
type AuthError = Error & { code?: string }

/**
 * Painel de gerenciamento de 2FA reutilizável (Admin/Parceiro/Cliente).
 *  - Lista fatores verificados.
 *  - Permite cadastrar um novo factor.
 *  - Permite remover um factor existente.
 */
export function TwoFactorManager() {
  const { session, removeTwoFactorFactor, refresh } = useAuth()
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<Factor | null>(null)
  const [pendingRemovalCode, setPendingRemovalCode] = useState('')
  const [pendingRemovalLoading, setPendingRemovalLoading] = useState(false)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const list = await listTwoFactorFactors()
      setFactors(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao listar fatores 2FA.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function handleRemove(factor: Factor) {
    if (!confirm('Remover este fator 2FA? Você precisará cadastrar outro no próximo login.')) return
    setError(null)
    try {
      await removeTwoFactorFactor(factor.id)
      await reload()
    } catch (err) {
      const authError = err as AuthError
      if (authError?.code === AAL2_REQUIRED_FOR_UNENROLL_CODE) {
        setPendingRemoval(factor)
        setPendingRemovalCode('')
        return
      }
      setError(err instanceof Error ? err.message : 'Falha ao remover fator.')
    }
  }

  async function handleConfirmPendingRemoval() {
    if (!pendingRemoval) return
    const normalizedCode = pendingRemovalCode.replace(/\D/g, '')
    if (normalizedCode.length !== 6) {
      setError('Informe um código válido de 6 dígitos para confirmar a remoção do fator.')
      return
    }

    setPendingRemovalLoading(true)
    setError(null)
    try {
      await removeTwoFactorFactor(pendingRemoval.id, normalizedCode)
      setPendingRemoval(null)
      setPendingRemovalCode('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar remoção do fator.')
    } finally {
      setPendingRemovalLoading(false)
    }
  }

  const verified = factors.filter((f) => f.status === 'verified')
  const unverified = factors.filter((f) => f.status !== 'verified')
  const hasAny = factors.length > 0

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-navy">Autenticação em duas etapas (TOTP)</h3>
          <p className="text-sm text-silver-600">
            {session?.requiresTwoFactor
              ? 'Obrigatório para sua função. Mantenha pelo menos um fator ativo.'
              : 'Recomendado para reforçar a segurança da sua conta.'}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
            verified.length > 0
              ? 'bg-success/10 text-success'
                : unverified.length > 0
                  ? 'bg-warning/10 text-warning'
              : 'bg-warning/10 text-warning'
          }`}
        >
          {verified.length > 0 ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
            {verified.length > 0 ? 'Ativo' : unverified.length > 0 ? 'Cadastro pendente' : 'Não configurado'}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {pendingRemoval && (
        <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm text-silver-700">
            Para remover o fator <strong>{pendingRemoval.friendly_name ?? 'Authenticator'}</strong>, confirme com o código atual do app autenticador.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="input w-full sm:max-w-[180px]"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={pendingRemovalCode}
              onChange={(event) => setPendingRemovalCode(event.target.value.replace(/\D/g, ''))}
            />
            <button
              type="button"
              className="btn-gold"
              onClick={handleConfirmPendingRemoval}
              disabled={pendingRemovalLoading || pendingRemovalCode.length !== 6}
            >
              {pendingRemovalLoading ? 'Confirmando…' : 'Confirmar remoção'}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setPendingRemoval(null)
                setPendingRemovalCode('')
              }}
              disabled={pendingRemovalLoading}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-silver-500">Carregando…</p>
      ) : (
        <ul className="divide-y divide-silver-100 overflow-hidden rounded-lg border border-silver-200">
          {!hasAny && (
            <li className="px-4 py-3 text-sm text-silver-500">Nenhum fator TOTP cadastrado.</li>
          )}

          {verified.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-silver-900">{f.friendly_name ?? 'Authenticator'}</p>
                <p className="mt-0.5 inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                  Verificado
                </p>
                <p className="text-xs text-silver-500">
                  Criado em {new Date(f.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(f)}
                className="rounded-md p-1.5 text-danger hover:bg-danger/10"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}

          {unverified.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-silver-900">{f.friendly_name ?? 'Authenticator'}</p>
                <p className="mt-0.5 inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                  Pendente de verificação
                </p>
                <p className="text-xs text-silver-500">
                  Finalize o código do app autenticador ou remova este cadastro e gere um novo QR.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(f)}
                className="rounded-md p-1.5 text-danger hover:bg-danger/10"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showSetup ? (
        <button type="button" className="btn-gold" onClick={() => setShowSetup(true)}>
          {verified.length > 0 ? 'Cadastrar outro fator' : 'Configurar 2FA agora'}
        </button>
      ) : (
        <div className="rounded-lg border border-silver-200 bg-silver-50/50 p-4">
          <TwoFactorSetup
            compact
            onVerified={async () => {
              setShowSetup(false)
              await refresh()
              await reload()
            }}
          />
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-outline" onClick={() => setShowSetup(false)}>
              Cancelar cadastro
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

