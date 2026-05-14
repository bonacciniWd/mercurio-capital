import { Link } from 'react-router-dom'

export function AcessoPendente() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <div className="card w-full p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">Cadastro em análise</p>
        <h1 className="mt-2 text-2xl font-bold text-navy">Acesso operacional pendente</h1>
        <p className="mt-3 text-sm text-silver-600">
          Sua conta de parceiro foi criada, mas ainda precisa de aprovação da equipe Mercurio para liberar as rotas de operação.
        </p>
        <p className="mt-1 text-sm text-silver-600">Você receberá a liberação por e-mail e WhatsApp.</p>

        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="btn-outline">Voltar ao início</Link>
          <Link to="/p/login" className="btn-gold">Trocar conta</Link>
        </div>
      </div>
    </div>
  )
}
