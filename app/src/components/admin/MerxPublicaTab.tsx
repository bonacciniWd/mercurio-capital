import { useEffect, useState } from 'react'
import { MessageCircle, Plus, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_MERX_FAQ, type MerxFaqItem } from '@/lib/merxPublica'

type MerxConfig = {
  habilitado: boolean
  captacao_habilitada: boolean
  saudacao: string
  mensagem_sem_resposta: string
  faq: MerxFaqItem[]
}

const defaults: MerxConfig = {
  habilitado: true,
  captacao_habilitada: true,
  saudacao: 'Como posso ajudar?',
  mensagem_sem_resposta: 'Ainda não encontrei essa informação no FAQ público.',
  faq: DEFAULT_MERX_FAQ,
}

function readConfig(value: unknown): Partial<MerxConfig> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const config = value as Record<string, unknown>
  const incoming: Partial<MerxConfig> = {}

  if (typeof config.habilitado === 'boolean') incoming.habilitado = config.habilitado
  if (typeof config.captacao_habilitada === 'boolean') incoming.captacao_habilitada = config.captacao_habilitada
  if (typeof config.saudacao === 'string') incoming.saudacao = config.saudacao
  if (typeof config.mensagem_sem_resposta === 'string') incoming.mensagem_sem_resposta = config.mensagem_sem_resposta

  if (Array.isArray(config.faq)) {
    const faq = config.faq.filter((item): item is MerxFaqItem => {
      if (!item || typeof item !== 'object') return false
      const faqItem = item as Record<string, unknown>
      return typeof faqItem.id === 'string' && typeof faqItem.question === 'string' && typeof faqItem.answer === 'string' && Array.isArray(faqItem.keywords) && faqItem.keywords.every(keyword => typeof keyword === 'string')
    })
    // An empty or malformed remote FAQ should not erase the editable defaults.
    if (faq.length > 0) incoming.faq = faq
  }

  return incoming
}

export function MerxPublicaTab() {
  const [config, setConfig] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let active = true
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase.rpc('admin_merx_publica_obter')
        if (!active) return
        if (error) setFeedback({ ok: false, text: error.message })
        if (data) {
          const incoming = readConfig(data)
          setConfig(current => ({ ...current, ...incoming }))
        }
      } catch {
        if (active) setFeedback({ ok: false, text: 'Não foi possível carregar a configuração da MERX pública.' })
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadConfig()
    return () => { active = false }
  }, [])

  function updateFaq(index: number, update: Partial<MerxFaqItem>) {
    setConfig(current => ({ ...current, faq: current.faq.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item) }))
  }

  function addFaq() {
    setConfig(current => ({
      ...current,
      faq: [...current.faq, { id: crypto.randomUUID(), question: '', answer: '', keywords: [] }],
    }))
  }

  function removeFaq(index: number) {
    setConfig(current => ({ ...current, faq: current.faq.filter((_, itemIndex) => itemIndex !== index) }))
  }

  async function save() {
    const validFaq = config.faq.filter(item => item.question.trim() && item.answer.trim() && item.keywords.some(keyword => keyword.trim()))
    if (validFaq.length !== config.faq.length) {
      setFeedback({ ok: false, text: 'Preencha pergunta, resposta e ao menos uma palavra-chave em cada item.' })
      return
    }
    setSaving(true)
    setFeedback(null)
    const payload = { ...config, faq: config.faq.map(item => ({ ...item, question: item.question.trim(), answer: item.answer.trim(), keywords: item.keywords.map(keyword => keyword.trim()).filter(Boolean) })) }
    const { error } = await supabase.rpc('admin_merx_publica_salvar', { p_config: payload })
    setSaving(false)
    setFeedback(error ? { ok: false, text: error.message } : { ok: true, text: 'Configuração da MERX pública salva.' })
  }

  if (loading) return <p className="text-sm text-silver-500">Carregando configuração…</p>
  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 font-semibold text-navy"><MessageCircle className="h-5 w-5 text-red-700" /> MERX pública</h2><p className="mt-1 text-sm text-silver-500">Configure respostas rápidas para perguntas comuns. A MERX responde pelo FAQ, sem inventar informações.</p></div><span className="rounded-full bg-silver-100 px-3 py-1.5 text-xs font-semibold text-silver-700">FAQ determinístico</span></div>
    <div className="mt-5 grid gap-4 rounded-lg border border-silver-200 p-4"><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={config.habilitado} onChange={event => setConfig({ ...config, habilitado: event.target.checked })} /> Exibir MERX nas páginas públicas</label><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={config.captacao_habilitada} onChange={event => setConfig({ ...config, captacao_habilitada: event.target.checked })} /> Permitir solicitação de contato</label><label className="grid gap-1 text-sm"><span className="label">Saudação inicial</span><input className="input" maxLength={180} value={config.saudacao} onChange={event => setConfig({ ...config, saudacao: event.target.value })} /></label><label className="grid gap-1 text-sm"><span className="label">Resposta para perguntas fora do FAQ</span><textarea className="input min-h-24 py-2" maxLength={500} value={config.mensagem_sem_resposta} onChange={event => setConfig({ ...config, mensagem_sem_resposta: event.target.value })} /></label></div>
    <section className="mt-6" aria-labelledby="merx-faq-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h3 id="merx-faq-title" className="font-semibold text-navy">Perguntas e respostas</h3><p className="mt-1 text-sm text-silver-500">Cadastre até 20 respostas. Separe palavras e expressões-chave por vírgulas.</p></div><button type="button" className="btn-no-liquid btn-outline" disabled={config.faq.length >= 20} onClick={addFaq}><Plus className="h-4 w-4" /> Adicionar pergunta</button></div>
      <div className="grid gap-4">
        {config.faq.map((item, index) => <fieldset key={item.id} className="grid gap-3 rounded-lg border border-silver-200 p-4">
          <legend className="px-1 text-sm font-semibold text-navy">Pergunta {index + 1}</legend>
          <div className="flex items-start gap-3"><label className="grid min-w-0 flex-1 gap-1 text-sm"><span className="label">Pergunta sugerida</span><input className="input" maxLength={100} value={item.question} onChange={event => updateFaq(index, { question: event.target.value })} /></label><button type="button" className="btn-no-liquid mt-6 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-silver-500 hover:bg-red-50 hover:text-red-700" disabled={config.faq.length <= 1} onClick={() => removeFaq(index)} aria-label={`Remover pergunta ${index + 1}`} title="Remover pergunta"><Trash2 className="h-4 w-4" /></button></div>
          <label className="grid gap-1 text-sm"><span className="label">Resposta da MERX</span><textarea className="input min-h-24 py-2" maxLength={1000} value={item.answer} onChange={event => updateFaq(index, { answer: event.target.value })} /></label>
          <label className="grid gap-1 text-sm"><span className="label">Palavras-chave</span><input className="input" maxLength={500} value={item.keywords.join(', ')} onChange={event => updateFaq(index, { keywords: event.target.value.split(',').map(keyword => keyword.trim()).slice(0, 12) })} placeholder="ex.: oi, olá, bom dia" /></label>
        </fieldset>)}
      </div>
    </section>
    {feedback && <p role="status" className={`mt-4 text-sm ${feedback.ok ? 'text-success' : 'text-danger'}`}>{feedback.text}</p>}
    <div className="mt-5 flex justify-end"><button type="button" className="btn-no-liquid btn-gold" disabled={saving} onClick={() => void save()}><Save className="h-4 w-4" />{saving ? 'Salvando…' : 'Salvar configuração'}</button></div>
  </div>
}
