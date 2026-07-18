import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, Bell, CheckCircle2, Edit2, Eye, Loader2, Mail, MessageSquare,
  Plus, Save, Send, Smartphone, Trash2, X,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import {
  CRITICAL_EMAIL_TEMPLATES,
  extractTemplatePlaceholders,
  presetForTemplate,
  renderTemplatePreview,
  type TemplatePreset,
} from '@/lib/templateEmail'

type Canal = 'in_app' | 'email' | 'whatsapp' | 'push'

type Template = {
  id: string
  codigo: string
  canal: Canal
  nome: string
  assunto: string | null
  corpo: string
  variaveis: string[]
  ativo: boolean
  wa_template_nome: string | null
  wa_idioma: string | null
  created_at: string
  updated_at: string
  created_by_nome: string | null
}

const CANAIS: Canal[] = ['email', 'whatsapp', 'push', 'in_app']
const CANAL_ICON: Record<Canal, React.ElementType> = {
  in_app: Bell, email: Mail, whatsapp: MessageSquare, push: Smartphone,
}
const CANAL_LABEL: Record<Canal, string> = {
  in_app: 'In-app', email: 'E-mail', whatsapp: 'WhatsApp', push: 'Push',
}

function emptyDraft(canal: Canal): Partial<Template> {
  return { codigo: '', canal, nome: '', assunto: '', corpo: '', variaveis: [], ativo: true, wa_idioma: 'pt_BR' }
}

function previewDocument(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'"><style>body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.55;padding:20px;margin:0}a{color:#a77c08}img{max-width:100%;height:auto}</style></head><body>${body}</body></html>`
}

export function AdminTemplates() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCanal = searchParams.get('canal') as Canal | null
  const [filter, setFilter] = useState<Canal | 'todos'>(
    requestedCanal && CANAIS.includes(requestedCanal) ? requestedCanal : 'todos',
  )
  const [editing, setEditing] = useState<Partial<Template> | null>(null)
  const [previewVars, setPreviewVars] = useState<TemplatePreset>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [testTemplateId, setTestTemplateId] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [testVars, setTestVars] = useState('{}')
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  const templatesQuery = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_admin_templates').select('*').order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Template[]
    },
  })
  const templates = templatesQuery.data ?? []
  const visibleTemplates = filter === 'todos' ? templates : templates.filter(template => template.canal === filter)
  const emailTemplates = templates.filter(template => template.canal === 'email' && template.ativo)

  useEffect(() => {
    if (testTemplateId || emailTemplates.length === 0) return
    const first = emailTemplates[0]
    setTestTemplateId(first.id)
    setTestVars(JSON.stringify(presetForTemplate(first.codigo, first.variaveis), null, 2))
  }, [emailTemplates, testTemplateId])

  const upsertMutation = useMutation({
    mutationFn: async (template: Partial<Template>) => {
      const { data, error } = await supabase.rpc('admin_template_upsert', {
        p_codigo: template.codigo,
        p_canal: template.canal,
        p_nome: template.nome,
        p_corpo: template.corpo,
        p_id: template.id ?? null,
        p_assunto: template.assunto ?? null,
        p_variaveis: template.variaveis ?? [],
        p_ativo: template.ativo ?? true,
        p_wa_template_nome: template.canal === 'whatsapp' ? (template.wa_template_nome ?? null) : null,
        p_wa_idioma: template.wa_idioma ?? 'pt_BR',
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] })
      setEditing(null)
      setErrorMessage(null)
    },
    onError: (error: Error) => setErrorMessage(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_template_delete', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-templates'] }),
    onError: (error: Error) => setErrorMessage(error.message),
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      let variables: unknown
      try {
        variables = JSON.parse(testVars)
      } catch {
        throw new Error('JSON de variáveis inválido.')
      }
      if (!variables || Array.isArray(variables) || typeof variables !== 'object') {
        throw new Error('As variáveis devem ser um objeto JSON.')
      }
      const { data, error } = await supabase.rpc('admin_email_template_test_enqueue', {
        p_template_id: testTemplateId,
        p_destinatario: testEmail.trim().toLowerCase(),
        p_variaveis: variables,
      })
      if (error) throw error
      return data as { outbox_id: string; status: string; template: string }
    },
    onSuccess: data => setTestResult({ ok: true, text: `${data.template} enfileirado (${data.outbox_id}). O dispatcher fará o envio.` }),
    onError: (error: Error) => setTestResult({ ok: false, text: error.message }),
  })

  const declaredVariables = editing?.variaveis ?? []
  const usedPlaceholders = useMemo(
    () => extractTemplatePlaceholders(editing?.assunto, editing?.corpo),
    [editing?.assunto, editing?.corpo],
  )
  const missingVariables = usedPlaceholders.filter(variable => !declaredVariables.includes(variable))
  const unusedVariables = declaredVariables.filter(variable => !usedPlaceholders.includes(variable))
  const isCritical = CRITICAL_EMAIL_TEMPLATES.has(editing?.codigo ?? '')
  const renderedSubject = renderTemplatePreview(editing?.assunto ?? '', previewVars)
  const renderedBody = renderTemplatePreview(editing?.corpo ?? '', previewVars)

  function changeFilter(next: Canal | 'todos') {
    setFilter(next)
    setSearchParams(next === 'todos' ? {} : { canal: next }, { replace: true })
  }

  function startEdit(template: Template) {
    setEditing({ ...template })
    setPreviewVars(presetForTemplate(template.codigo, template.variaveis))
  }

  function startNew() {
    const canal = filter === 'todos' ? 'email' : filter
    setEditing(emptyDraft(canal))
    setPreviewVars({})
  }

  function selectTestTemplate(id: string) {
    setTestTemplateId(id)
    setTestResult(null)
    const template = emailTemplates.find(item => item.id === id)
    if (template) setTestVars(JSON.stringify(presetForTemplate(template.codigo, template.variaveis), null, 2))
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Templates de mensagem</h1>
          <p className="text-sm text-silver-500">Catálogo único usado por fluxos, campanhas e e-mails transacionais.</p>
        </div>
        <button className="btn-gold" onClick={startNew}><Plus className="h-4 w-4" /> Novo template</button>
      </header>

      {errorMessage && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {errorMessage}<button className="float-right" onClick={() => setErrorMessage(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar templates por canal">
        <button className={filter === 'todos' ? 'btn-gold' : 'btn-outline'} onClick={() => changeFilter('todos')}>Todos</button>
        {CANAIS.map(canal => {
          const Icon = CANAL_ICON[canal]
          return <button key={canal} className={filter === canal ? 'btn-gold' : 'btn-outline'} onClick={() => changeFilter(canal)}><Icon className="h-4 w-4" /> {CANAL_LABEL[canal]}</button>
        })}
      </div>

      <div className="card overflow-x-auto">
        {templatesQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-silver-500" /></div>
        ) : visibleTemplates.length === 0 ? (
          <div className="p-10 text-center text-silver-500">Nenhum template neste canal.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
              <tr><th className="px-5 py-3">Código</th><th className="px-5 py-3">Canal</th><th className="px-5 py-3">Nome</th><th className="px-5 py-3">Variáveis</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {visibleTemplates.map(template => {
                const Icon = CANAL_ICON[template.canal]
                const critical = CRITICAL_EMAIL_TEMPLATES.has(template.codigo)
                return (
                  <tr key={template.id} className="border-t border-silver-100 hover:bg-silver-50">
                    <td className="px-5 py-3"><code className="text-xs">{template.codigo}</code>{critical && <span className="ml-2 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold-700">Sistema</span>}</td>
                    <td className="px-5 py-3"><span className="inline-flex items-center gap-1 rounded bg-silver-100 px-2 py-1 text-xs"><Icon className="h-3 w-3" />{CANAL_LABEL[template.canal]}</span></td>
                    <td className="px-5 py-3 font-medium">{template.nome}</td>
                    <td className="max-w-sm px-5 py-3 text-xs text-silver-600">{template.variaveis.length ? template.variaveis.map(variable => `{{${variable}}}`).join(' ') : '—'}</td>
                    <td className="px-5 py-3"><Badge variant={template.ativo ? 'green' : 'gray'}>{template.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <button className="btn-ghost h-7 px-2" onClick={() => startEdit(template)} title="Editar"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button className="btn-ghost h-7 px-2 text-danger disabled:cursor-not-allowed disabled:text-silver-300" disabled={critical} title={critical ? 'Template transacional protegido' : 'Remover'} onClick={() => { if (confirm(`Remover definitivamente ${template.codigo}?`)) deleteMutation.mutate(template.id) }}><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <section className="mt-6 border-t border-silver-200 pt-6">
        <h2 className="font-semibold text-navy">Teste de envio de template</h2>
        <p className="mt-1 text-sm text-silver-500">Renderiza no backend e enfileira em <code>email_outbox</code>. O dispatcher/Resend realiza o envio.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div><label className="label">Template de e-mail</label><select className="input" value={testTemplateId} onChange={event => selectTestTemplate(event.target.value)}>{emailTemplates.map(template => <option key={template.id} value={template.id}>{template.nome} · {template.codigo}</option>)}</select></div>
            <div><label className="label">E-mail interno de destino</label><input className="input" type="email" value={testEmail} onChange={event => { setTestEmail(event.target.value); setTestResult(null) }} placeholder="email.interno@mercuriocapitalsa.com.br" /></div>
          </div>
          <div><label className="label">Variáveis do teste (JSON)</label><textarea className="input min-h-[150px] font-mono text-xs" value={testVars} onChange={event => { setTestVars(event.target.value); setTestResult(null) }} /></div>
        </div>
        {testResult && <div className={`mt-4 flex items-start gap-2 rounded-md border p-3 text-sm ${testResult.ok ? 'border-success/30 bg-success/5 text-success' : 'border-danger/30 bg-danger/5 text-danger'}`}>{testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}{testResult.text}</div>}
        <div className="mt-4 flex justify-end"><button className="btn-gold" disabled={testMutation.isPending || !testTemplateId || !testEmail.trim()} onClick={() => testMutation.mutate()}>{testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enfileirar teste</button></div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div><h2 className="font-semibold text-navy">{editing.id ? 'Editar template' : 'Novo template'}</h2>{isCritical && <p className="text-xs font-medium text-gold-700">Template usado por fluxo transacional. Código, canal, ativação e exclusão são protegidos.</p>}</div>
              <button onClick={() => setEditing(null)}><X className="h-5 w-5 text-silver-500" /></button>
            </div>
            <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="label">Código</label><input className="input" value={editing.codigo ?? ''} disabled={isCritical} onChange={event => setEditing(current => ({ ...current!, codigo: event.target.value }))} /></div>
                  <div><label className="label">Canal</label><select className="input" value={editing.canal} disabled={isCritical} onChange={event => setEditing(current => ({ ...current!, canal: event.target.value as Canal }))}>{CANAIS.map(canal => <option key={canal} value={canal}>{CANAL_LABEL[canal]}</option>)}</select></div>
                </div>
                <div><label className="label">Nome</label><input className="input" value={editing.nome ?? ''} onChange={event => setEditing(current => ({ ...current!, nome: event.target.value }))} /></div>
                {(editing.canal === 'email' || editing.canal === 'in_app') && <div><label className="label">Assunto / Título</label><input className="input" value={editing.assunto ?? ''} onChange={event => setEditing(current => ({ ...current!, assunto: event.target.value }))} /></div>}
                <div><label className="label">Corpo {editing.canal === 'email' ? '(HTML)' : ''}</label><textarea className={`input font-mono text-xs ${editing.canal === 'email' ? 'min-h-[300px]' : 'min-h-[180px]'}`} value={editing.corpo ?? ''} onChange={event => setEditing(current => ({ ...current!, corpo: event.target.value }))} /></div>
                <div><label className="label">Variáveis declaradas</label><input className="input" value={editing.variaveis?.join(', ') ?? ''} onChange={event => setEditing(current => current ? { ...current, variaveis: event.target.value.split(',').map(item => item.trim()).filter(Boolean) } : current)} /><div className="mt-2 flex flex-wrap gap-1">{declaredVariables.map(variable => <code key={variable} className="rounded bg-silver-100 px-2 py-1 text-xs">{`{{${variable}}}`}</code>)}</div></div>
                {(missingVariables.length > 0 || unusedVariables.length > 0) && <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">{missingVariables.length > 0 && <p>Placeholders não declarados: {missingVariables.map(item => `{{${item}}}`).join(', ')}</p>}{unusedVariables.length > 0 && <p className="mt-1">Variáveis declaradas sem uso: {unusedVariables.join(', ')}</p>}</div>}
                {editing.canal === 'whatsapp' && <div className="grid gap-3 rounded-md border border-green-200 bg-green-50 p-3 sm:grid-cols-2"><div><label className="label">Template aprovado Meta</label><input className="input" value={editing.wa_template_nome ?? ''} onChange={event => setEditing(current => ({ ...current!, wa_template_nome: event.target.value }))} /></div><div><label className="label">Idioma</label><input className="input" value={editing.wa_idioma ?? 'pt_BR'} onChange={event => setEditing(current => ({ ...current!, wa_idioma: event.target.value }))} /></div></div>}
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.ativo ?? true} disabled={isCritical} onChange={event => setEditing(current => ({ ...current!, ativo: event.target.checked }))} /> Ativo</label>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4" /> Preview seguro</span><button className="btn-outline h-8 text-xs" onClick={() => setPreviewVars(presetForTemplate(editing.codigo ?? '', editing.variaveis ?? []))}>Carregar dados fake</button></div>
                <div className="rounded-md border bg-silver-50 p-3"><p className="text-xs text-silver-500">Assunto</p><p className="mt-1 text-sm font-semibold">{renderedSubject || 'Sem assunto'}</p></div>
                {editing.canal === 'email' ? <iframe title="Preview seguro do template" sandbox="" srcDoc={previewDocument(renderedBody)} className="h-[480px] w-full rounded-md border bg-white" /> : <pre className="min-h-[220px] whitespace-pre-wrap rounded-md border p-4 text-sm">{renderedBody}</pre>}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3"><button className="btn-outline" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-gold" disabled={upsertMutation.isPending} onClick={() => upsertMutation.mutate(editing)}>{upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button></div>
          </div>
        </div>
      )}
    </>
  )
}
