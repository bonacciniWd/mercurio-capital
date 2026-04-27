import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Play, CheckCircle2, ArrowRight } from 'lucide-react'

const modules = [
  { name: 'Módulo 1 · Introdução', lessons: ['O que é Home Equity', 'Quando usar', 'Comparativo de produtos'] },
  { name: 'Módulo 2 · Análise de risco', lessons: ['Garantia fiduciária', 'LTV e capacidade de pagamento', 'Score e bureaus'] },
  { name: 'Módulo 3 · Esteira', lessons: ['Documentação', 'Comitê de crédito', 'Registro em cartório'] },
]

export function UniversidadePlayer() {
  const [tab, setTab] = useState<'Conteúdo' | 'Recursos' | 'Notas'>('Conteúdo')
  const [active] = useState({ mod: 1, lesson: 1 })

  return (
    <>
      <Link to="/p/universidade" className="mb-4 inline-flex items-center gap-1 text-sm text-silver-600 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-navy to-black text-white">
              <Play className="h-16 w-16 opacity-70" />
            </div>
          </div>

          <h1 className="mt-5 text-xl font-bold text-navy">LTV e capacidade de pagamento</h1>
          <p className="text-sm text-silver-500">Módulo 2 · Aula 2 · 18min</p>

          <div className="mt-5 flex gap-1 border-b border-silver-200">
            {(['Conteúdo', 'Recursos', 'Notas'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t ? 'border-gold text-navy' : 'border-transparent text-silver-500'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {tab === 'Conteúdo' && (
              <div className="prose-sm max-w-none text-sm text-silver-700">
                <p>Nesta aula você vai entender como calcular o <b>LTV</b> (Loan to Value) e a <b>capacidade de pagamento</b> do proponente, dois fatores decisivos na aprovação de crédito imobiliário.</p>
                <p className="mt-3">Tópicos abordados: ratios mínimos por produto, casos de exceção e fundamentos da Resolução 4.676.</p>
              </div>
            )}
            {tab === 'Recursos' && (
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between rounded-md bg-silver-50 p-3"><span>📄 Planilha de cálculo de LTV.xlsx</span><button className="text-gold-600 hover:underline">Baixar</button></li>
                <li className="flex items-center justify-between rounded-md bg-silver-50 p-3"><span>📕 Resolução 4.676 — BACEN.pdf</span><button className="text-gold-600 hover:underline">Baixar</button></li>
              </ul>
            )}
            {tab === 'Notas' && <textarea className="input min-h-[160px]" placeholder="Suas anotações... (auto-salva)" />}
          </div>
        </div>

        <aside className="card h-fit overflow-hidden">
          <div className="border-b border-silver-200 p-4">
            <p className="text-xs uppercase tracking-wide text-silver-500">Curso</p>
            <h3 className="font-semibold text-navy">Fundamentos do Home Equity</h3>
            <div className="mt-2 h-1 rounded-full bg-silver-200">
              <div className="h-full w-2/5 rounded-full bg-gold" />
            </div>
            <p className="mt-1 text-xs text-silver-500">8 / 18 aulas</p>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {modules.map((m, i) => (
              <details key={m.name} open={i === active.mod} className="border-b border-silver-100">
                <summary className="cursor-pointer bg-silver-50 px-4 py-2.5 text-sm font-semibold text-silver-800">{m.name}</summary>
                <ul>
                  {m.lessons.map((l, j) => {
                    const isActive = i === active.mod && j === active.lesson
                    const done = i < active.mod || (i === active.mod && j < active.lesson)
                    return (
                      <li key={l} className={`flex items-center gap-2 px-4 py-2 text-sm ${isActive ? 'bg-gold/10 text-navy font-medium border-l-2 border-gold' : 'text-silver-700'}`}>
                        {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : isActive ? <Play className="h-4 w-4 text-gold" /> : <Play className="h-4 w-4 text-silver-300" />}
                        <span className="flex-1">{l}</span>
                        <span className="text-xs text-silver-400">12min</span>
                      </li>
                    )
                  })}
                </ul>
              </details>
            ))}
          </div>
        </aside>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
        <span className="font-medium text-success">✓ Aula concluída! Próxima: Score e bureaus</span>
        <button className="btn-gold">Continuar <ArrowRight className="h-4 w-4" /></button>
      </div>
    </>
  )
}
