import { Lock, GraduationCap, Play } from 'lucide-react'

export function ClientUniversidade() {
  const subscribed = false
  return (
    <>
      <div className="mb-6 overflow-hidden rounded-lg bg-gradient-to-r from-navy to-navy-600 p-8 text-white">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-gold" />
          <div>
            <h1 className="text-2xl font-bold">Universidade Mercurio</h1>
            <p className="text-sm text-white/80">Conteúdo exclusivo de finanças, mercado e planejamento patrimonial.</p>
          </div>
        </div>
      </div>

      {!subscribed ? (
        <div className="card relative p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/15">
            <Lock className="h-7 w-7 text-gold-600" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-navy">Acesso por assinatura</h2>
          <p className="mt-1 text-sm text-silver-600">Desbloqueie todos os cursos e certificados.</p>
          <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-silver-700">
            <li>✓ Mais de 80 horas de conteúdo</li>
            <li>✓ Certificado digital validado</li>
            <li>✓ Atualizações semanais</li>
          </ul>
          <button className="btn-gold mx-auto mt-6">Assinar por R$ 49,90/mês</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card overflow-hidden">
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-navy to-navy-700 text-white">
                <Play className="h-10 w-10" />
              </div>
              <div className="p-4">
                <span className="badge bg-navy-100 text-navy-600">Crédito</span>
                <h3 className="mt-2 font-semibold text-silver-900">Fundamentos do Home Equity</h3>
                <div className="mt-3 h-1 rounded-full bg-silver-200"><div className="h-full w-2/5 rounded-full bg-gold" /></div>
                <p className="mt-1 text-xs text-silver-500">40% concluído</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
