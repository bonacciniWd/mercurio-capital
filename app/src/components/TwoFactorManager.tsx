import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { listTwoFactorFactors } from '@/auth/authClient'
import { TwoFactorSetup } from '@/components/TwoFactorSetup'

type Factor = Awaited<ReturnType<typeof listTwoFactorFactors>>[number]

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

  async function reload() {
    setLoading(true)
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

  async function handleRemove(factorId: string) {
    if (!confirm('Remover este fator 2FA? Você precisará cadastrar outro no próximo login.')) return
    try {
      await removeTwoFactorFactor(factorId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover fator.')
    }
  }

  const verified = factors.filter((f) => f.status === 'verified')

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
              : 'bg-warning/10 text-warning'
          }`}
        >
          {verified.length > 0 ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          {verified.length > 0 ? 'Ativo' : 'Não configurado'}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-silver-500">Carregando…</p>
      ) : (
        <ul className="divide-y divide-silver-100 overflow-hidden rounded-lg border border-silver-200">
          {verified.length === 0 && (
            <li className="px-4 py-3 text-sm text-silver-500">Nenhum fator TOTP cadastrado.</li>
          )}
          {verified.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-silver-900">{f.friendly_name ?? 'Authenticator'}</p>
                <p className="text-xs text-silver-500">
                  Criado em {new Date(f.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(f.id)}
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

