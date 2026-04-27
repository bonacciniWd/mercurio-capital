import { Link } from 'react-router-dom'
import { Play, Award, Filter } from 'lucide-react'

const courses = [
  { id: 'home-equity', cat: 'Crédito', title: 'Fundamentos do Home Equity', inst: 'Ricardo Mello', dur: '4h 30min', lessons: 18, progress: 40, level: 'Iniciante' },
  { id: 'compliance', cat: 'Compliance', title: 'PLD/FT na esteira de crédito', inst: 'Patrícia Vargas', dur: '2h 15min', lessons: 9, progress: 0, level: 'Intermediário' },
  { id: 'vendas', cat: 'Vendas', title: 'Closing de Crédito Imobiliário', inst: 'André Costa', dur: '3h 50min', lessons: 14, progress: 100, level: 'Avançado' },
  { id: 'analise', cat: 'Crédito', title: 'Análise de risco e LTV', inst: 'Mariana Reis', dur: '5h 20min', lessons: 22, progress: 65, level: 'Intermediário' },
  { id: 'juridico', cat: 'Jurídico', title: 'Garantia fiduciária — registro', inst: 'Tiago Sá', dur: '3h', lessons: 11, progress: 0, level: 'Avançado' },
  { id: 'fluxo', cat: 'Operações', title: 'Esteira ágil em construções', inst: 'Helena Rocha', dur: '4h', lessons: 16, progress: 20, level: 'Iniciante' },
]

export function UniversidadeLista() {
  return (
    <>
      <div className="mb-6 overflow-hidden rounded-lg bg-gradient-to-br from-navy via-navy-600 to-navy-700 p-8 text-white">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 text-gold" />
          <div>
            <h1 className="text-2xl font-bold">Universidade Mercurio</h1>
            <p className="text-sm text-white/80">Capacitação para parceiros de excelência.</p>
          </div>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-1">
        {['Todos', 'Em andamento', 'Concluídos', 'Certificados'].map((t, i) => (
          <button key={t} className={`rounded-full px-4 py-1.5 text-sm font-medium ${i === 0 ? 'bg-navy text-white' : 'text-silver-600 hover:bg-silver-100'}`}>{t}</button>
        ))}
        <button className="ml-auto btn-outline"><Filter className="h-4 w-4" /> Categoria</button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {courses.map(c => (
          <Link key={c.id} to={`/p/universidade/${c.id}/aula/1`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-navy to-navy-700 text-white">
              <Play className="h-10 w-10 opacity-80 group-hover:scale-110 transition" />
              <span className="absolute left-3 top-3 badge bg-gold text-navy">{c.cat}</span>
              <span className="absolute right-3 top-3 badge bg-white/20 text-white">{c.level}</span>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-silver-900 line-clamp-2">{c.title}</h3>
              <p className="mt-1 text-xs text-silver-500">{c.inst} · {c.lessons} aulas · {c.dur}</p>
              {c.progress > 0 && (
                <>
                  <div className="mt-3 h-1.5 rounded-full bg-silver-200">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${c.progress}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-silver-500">{c.progress}% concluído</p>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Meus certificados</h2>
        <div className="card flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <Award className="h-7 w-7 text-gold" />
            <div>
              <p className="font-semibold text-navy">Closing de Crédito Imobiliário</p>
              <p className="text-xs text-silver-500">Concluído em 03/04/2026 · Código MC-CERT-7821</p>
            </div>
          </div>
          <button className="btn-outline">Baixar PDF</button>
        </div>
      </div>
    </>
  )
}
