import { useState } from 'react'
import { Plus, Edit2, Trash2, Video, FileText, ChevronRight, ChevronDown, GripVertical, Eye, Upload, Search } from 'lucide-react'
import { Badge } from '@/components/Badge'

type Aula = { id: string; titulo: string; duracao: string; tipo: 'video' | 'pdf' | 'quiz'; vimeoId?: string }
type Modulo = { id: string; titulo: string; aulas: Aula[] }
type Curso = {
  id: string; titulo: string; categoria: string; nivel: 'Iniciante' | 'Intermediário' | 'Avançado';
  publico: 'Cliente' | 'Parceiro' | 'Ambos'; status: 'Publicado' | 'Rascunho' | 'Arquivado';
  alunos: number; modulos: Modulo[]
}

const CURSOS: Curso[] = [
  {
    id: 'c1', titulo: 'Fundamentos do Crédito Imobiliário', categoria: 'Crédito', nivel: 'Iniciante',
    publico: 'Ambos', status: 'Publicado', alunos: 142, modulos: [
      { id: 'm1', titulo: 'Introdução ao mercado', aulas: [
        { id: 'a1', titulo: 'O que é Home Equity', duracao: '08:24', tipo: 'video', vimeoId: '824612345' },
        { id: 'a2', titulo: 'Tipos de garantia', duracao: '12:10', tipo: 'video', vimeoId: '824612346' },
        { id: 'a3', titulo: 'Glossário (PDF)', duracao: '—', tipo: 'pdf' },
      ]},
      { id: 'm2', titulo: 'Análise de risco', aulas: [
        { id: 'a4', titulo: 'LTV na prática', duracao: '15:32', tipo: 'video', vimeoId: '824612347' },
        { id: 'a5', titulo: 'Quiz LTV', duracao: '5 min', tipo: 'quiz' },
      ]},
    ]
  },
  {
    id: 'c2', titulo: 'Vendas Consultivas para Parceiros', categoria: 'Vendas', nivel: 'Intermediário',
    publico: 'Parceiro', status: 'Publicado', alunos: 87, modulos: [
      { id: 'm3', titulo: 'Abordagem inicial', aulas: [
        { id: 'a6', titulo: 'Script de prospecção', duracao: '10:00', tipo: 'video', vimeoId: '824612348' },
      ]},
    ]
  },
  {
    id: 'c3', titulo: 'Documentação para Construção', categoria: 'Operacional', nivel: 'Avançado',
    publico: 'Cliente', status: 'Rascunho', alunos: 0, modulos: []
  },
]

const STATUS_VAR = { Publicado: 'green', Rascunho: 'amber', Arquivado: 'gray' } as const

export function AdminUniversidade() {
  const [selected, setSelected] = useState<Curso | null>(CURSOS[0])
  const [openModulos, setOpenModulos] = useState<Set<string>>(new Set(['m1']))

  const toggleModulo = (id: string) => {
    const next = new Set(openModulos)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setOpenModulos(next)
  }

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Universidade Mercurio</h1>
          <p className="text-sm text-silver-600">Gerencie cursos, módulos e episódios.</p>
        </div>
        <button className="btn-gold"><Plus className="h-4 w-4" /> Novo curso</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Lista de cursos */}
        <aside className="space-y-3">
          <div className="card flex items-center gap-2 p-3">
            <Search className="h-4 w-4 text-silver-400" />
            <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Buscar curso..." />
          </div>
          {CURSOS.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              className={`btn-no-liquid !block w-full min-h-[156px] border border-silver-200 bg-white p-4 text-left rounded-none transition-all sm:min-h-[136px] sm:p-5 ${selected?.id === c.id ? 'border-l-4 border-gold bg-gradient-to-r from-gold/10 to-white shadow-sm' : 'hover:bg-silver-50'}`}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <h3 className="min-w-0 break-words text-base font-semibold leading-tight text-silver-900">{c.titulo}</h3>
                <Badge variant={STATUS_VAR[c.status]}>{c.status}</Badge>
              </div>
              <div className="mt-2 space-y-0.5 text-sm leading-snug text-silver-700 sm:text-xs">
                <p>{c.categoria} · {c.nivel}</p>
                <p>{c.publico}</p>
              </div>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm text-silver-700 sm:text-xs">
                <span className="min-w-0 break-words">{c.modulos.length} módulos · {c.modulos.reduce((s, m) => s + m.aulas.length, 0)} aulas</span>
                <span className="whitespace-nowrap font-semibold text-navy-700">{c.alunos} alunos</span>
              </div>
            </button>
          ))}
        </aside>

        {/* Editor */}
        <section className="card p-6">
          {selected ? (
            <>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <input className="w-full text-xl font-bold text-navy bg-transparent outline-none border-b border-transparent hover:border-silver-200 focus:border-gold py-1"
                    defaultValue={selected.titulo} />
                  <textarea className="mt-2 w-full text-sm text-silver-600 bg-transparent outline-none resize-none"
                    rows={2} defaultValue="Aprenda os fundamentos do crédito imobiliário com garantia, regras de LTV e análise de risco." />
                </div>
                <div className="flex gap-2">
                  <button className="btn-outline"><Eye className="h-4 w-4" /> Preview</button>
                  <button className="btn-gold"><Edit2 className="h-4 w-4" /> Salvar</button>
                </div>
              </div>

              {/* Meta */}
              <div className="mb-6 grid gap-4 rounded-lg bg-silver-50 p-4 md:grid-cols-4">
                <div>
                  <label className="label">Categoria</label>
                  <select className="input" defaultValue={selected.categoria}>
                    <option>Crédito</option><option>Vendas</option><option>Operacional</option><option>Jurídico</option>
                  </select>
                </div>
                <div>
                  <label className="label">Nível</label>
                  <select className="input" defaultValue={selected.nivel}>
                    <option>Iniciante</option><option>Intermediário</option><option>Avançado</option>
                  </select>
                </div>
                <div>
                  <label className="label">Público</label>
                  <select className="input" defaultValue={selected.publico}>
                    <option>Cliente</option><option>Parceiro</option><option>Ambos</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" defaultValue={selected.status}>
                    <option>Rascunho</option><option>Publicado</option><option>Arquivado</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Capa do curso</label>
                  <div className="rounded-lg border-2 border-dashed border-silver-300 p-4 text-center text-xs text-silver-500 hover:border-gold cursor-pointer">
                    <Upload className="mx-auto mb-1 h-6 w-6" /> Enviar imagem (1280×720)
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Preço</label>
                  <div className="flex gap-2">
                    <select className="input w-32"><option>Gratuito</option><option>Pago</option><option>Assinatura</option></select>
                    <input className="input flex-1" placeholder="R$ 0,00" />
                  </div>
                </div>
              </div>

              {/* Módulos */}
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-navy">Módulos & episódios</h2>
                <button className="btn-outline text-sm"><Plus className="h-4 w-4" /> Novo módulo</button>
              </div>

              <div className="space-y-2">
                {selected.modulos.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-silver-300 p-8 text-center text-sm text-silver-500">
                    Nenhum módulo ainda. Adicione o primeiro para começar.
                  </div>
                )}
                {selected.modulos.map((m, idx) => {
                  const open = openModulos.has(m.id)
                  return (
                    <div key={m.id} className="rounded-lg border border-silver-200 bg-white">
                      <button onClick={() => toggleModulo(m.id)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-silver-50">
                        <GripVertical className="h-4 w-4 text-silver-400" />
                        {open ? <ChevronDown className="h-4 w-4 text-silver-500" /> : <ChevronRight className="h-4 w-4 text-silver-500" />}
                        <span className="text-xs font-mono text-silver-400">M{idx + 1}</span>
                        <span className="flex-1 font-semibold text-silver-900">{m.titulo}</span>
                        <span className="text-xs text-silver-500">{m.aulas.length} aulas</span>
                        <button className="rounded-md p-1.5 hover:bg-silver-100"><Edit2 className="h-3.5 w-3.5 text-silver-500" /></button>
                        <button className="rounded-md p-1.5 hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5 text-danger" /></button>
                      </button>
                      {open && (
                        <div className="border-t border-silver-100 bg-silver-50/50 p-3">
                          <div className="space-y-1.5">
                            {m.aulas.map((a, i) => (
                              <div key={a.id} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-sm border border-silver-100">
                                <GripVertical className="h-3.5 w-3.5 text-silver-400" />
                                <span className="font-mono text-xs text-silver-400 w-10">{idx + 1}.{i + 1}</span>
                                {a.tipo === 'video' && <Video className="h-4 w-4 text-chart-blue" />}
                                {a.tipo === 'pdf' && <FileText className="h-4 w-4 text-danger" />}
                                {a.tipo === 'quiz' && <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-gold text-[10px] font-bold text-white">Q</span>}
                                <span className="flex-1 text-silver-800">{a.titulo}</span>
                                {a.vimeoId && <code className="text-xs text-silver-500">vimeo:{a.vimeoId}</code>}
                                <span className="text-xs text-silver-500 w-14 text-right">{a.duracao}</span>
                                <button className="rounded-md p-1 hover:bg-silver-100"><Edit2 className="h-3.5 w-3.5 text-silver-500" /></button>
                                <button className="rounded-md p-1 hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5 text-danger" /></button>
                              </div>
                            ))}
                            <button className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-silver-300 py-2 text-xs font-medium text-silver-600 hover:border-gold hover:text-gold-700">
                              <Plus className="h-3.5 w-3.5" /> Adicionar episódio
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-center text-silver-500">Selecione um curso à esquerda</p>
          )}
        </section>
      </div>
    </>
  )
}
