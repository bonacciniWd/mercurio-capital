import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, FileSignature, Send, AlertTriangle, CheckCircle2, Clock,
  FileText, Download, Eye, BadgeCheck, Coins,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

type Role = 'partner' | 'admin' | 'client'

interface Props {
  propostaId: string
  role: Role
}

interface PropostaInfo {
  id: string
  status: string
  partner_id: string
  protocolo: string | null
}

interface Contrato {
  id: string
  proposta_id: string
  pdf_storage_path: string | null
  provedor_assinatura: string | null
  provider_envelope_id: string | null
  gerado_em: string | null
  assinado_em: string | null
  registrado_em: string | null
  versao: number
}

interface Assinatura {
  id: string
  signatario_nome: string
  signatario_email: string
  papel: string
  status: 'pendente' | 'assinado' | 'rejeitado'
  assinado_em: string | null
  ordem: number
}

interface Liberacao {
  id: string
  valor_liberado: number
  data_liberacao: string
  comprovante_storage_path: string | null
  observacao: string | null
  created_at: string
}

interface Comissao {
  id: string
  percentual: number
  valor: number
  status: 'prevista' | 'aprovada' | 'paga'
  paga_em: string | null
}

const STATUS_LABEL_ASSIN: Record<string, string> = {
  pendente: 'Pendente',
  assinado: 'Assinado',
  rejeitado: 'Rejeitado',
}

export function PropostaContrato({ propostaId, role }: Props) {
  const qc = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [modalLiberacao, setModalLiberacao] = useState(false)
  const [libValor, setLibValor] = useState('')
  const [libData, setLibData] = useState(() => new Date().toISOString().slice(0, 10))
  const [libObs, setLibObs] = useState('')
  const [libFile, setLibFile] = useState<File | null>(null)

  // Proposta (resumo, para saber status atual)
  const propostaQuery = useQuery({
    queryKey: ['prop-contrato', propostaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, status, partner_id, protocolo')
        .eq('id', propostaId).single()
      if (error) throw error
      return data as PropostaInfo
    },
  })

  const contratoQuery = useQuery({
    queryKey: ['contrato', propostaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('id, proposta_id, pdf_storage_path, provedor_assinatura, provider_envelope_id, gerado_em, assinado_em, registrado_em, versao')
        .eq('proposta_id', propostaId).maybeSingle()
      if (error) throw error
      return data as Contrato | null
    },
  })

  const assinaturasQuery = useQuery({
    queryKey: ['contrato-assin', contratoQuery.data?.id],
    enabled: !!contratoQuery.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assinaturas_contrato')
        .select('id, signatario_nome, signatario_email, papel, status, assinado_em, ordem')
        .eq('contrato_id', contratoQuery.data!.id).order('ordem')
      if (error) throw error
      return (data ?? []) as Assinatura[]
    },
  })

  const liberacaoQuery = useQuery({
    queryKey: ['liberacao', propostaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liberacoes_recurso')
        .select('id, valor_liberado, data_liberacao, comprovante_storage_path, observacao, created_at')
        .eq('proposta_id', propostaId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      return data as Liberacao | null
    },
  })

  const comissaoQuery = useQuery({
    queryKey: ['comissao', propostaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes')
        .select('id, percentual, valor, status, paga_em')
        .eq('proposta_id', propostaId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      return data as Comissao | null
    },
  })

  // ----- Mutations -----
  const gerarMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('contrato-gerar', {
        body: { proposta_id: propostaId },
      })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contrato', propostaId] })
      void qc.invalidateQueries({ queryKey: ['prop-contrato', propostaId] })
      void qc.invalidateQueries({ queryKey: ['proposta', propostaId] })
      void qc.invalidateQueries({ queryKey: ['admin-proposta', propostaId] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'falha'),
  })

  const enviarMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('contrato-enviar-assinatura', {
        body: { contrato_id: contratoQuery.data!.id },
      })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contrato', propostaId] })
      void qc.invalidateQueries({ queryKey: ['contrato-assin'] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'falha'),
  })

  const registrarMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('contrato_registrar', {
        p_contrato_id: contratoQuery.data!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contrato', propostaId] })
      void qc.invalidateQueries({ queryKey: ['prop-contrato', propostaId] })
      void qc.invalidateQueries({ queryKey: ['admin-proposta', propostaId] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'falha'),
  })

  const liberacaoMut = useMutation({
    mutationFn: async () => {
      const valor = Number(libValor.replace(/[^\d,]/g, '').replace(',', '.'))
      if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor inválido')
      let path: string | null = null
      if (libFile) {
        const ext = libFile.name.split('.').pop() ?? 'pdf'
        path = `${propostaId}/comprovante-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, libFile, { upsert: true })
        if (upErr) throw upErr
      }
      const { error } = await supabase.rpc('liberacao_registrar', {
        p_proposta_id: propostaId,
        p_valor: valor,
        p_data: libData,
        p_comprovante: path,
        p_observacao: libObs || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setModalLiberacao(false); setLibValor(''); setLibObs(''); setLibFile(null)
      void qc.invalidateQueries({ queryKey: ['liberacao', propostaId] })
      void qc.invalidateQueries({ queryKey: ['comissao', propostaId] })
      void qc.invalidateQueries({ queryKey: ['prop-contrato', propostaId] })
      void qc.invalidateQueries({ queryKey: ['admin-proposta', propostaId] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'falha'),
  })

  async function abrirPreview() {
    if (!contratoQuery.data?.pdf_storage_path) return
    const { data, error } = await supabase.storage.from('contratos')
      .createSignedUrl(contratoQuery.data.pdf_storage_path, 60 * 10)
    if (error || !data?.signedUrl) { setErro(error?.message ?? 'falha url'); return }
    setPreviewUrl(data.signedUrl)
  }

  async function baixarComprovante(path: string) {
    const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(path, 60 * 10)
    if (error || !data?.signedUrl) { setErro(error?.message ?? 'falha'); return }
    window.open(data.signedUrl, '_blank')
  }

  if (propostaQuery.isLoading) {
    return <div className="card p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gold" /></div>
  }
  if (!propostaQuery.data) return null

  const status = propostaQuery.data.status
  const contrato = contratoQuery.data
  const assinaturas = assinaturasQuery.data ?? []
  const liberacao = liberacaoQuery.data
  const comissao = comissaoQuery.data

  // Estágios anteriores à emissão de contrato → mostra placeholder
  const PRE_CONTRATO = ['simulacao','pre_analise','analise_credito','analise_imovel','analise_juridica','comite','proposta_cliente','resolucao_pendencias']
  if (PRE_CONTRATO.includes(status)) {
    return (
      <div className="card p-8 text-center">
        <FileSignature className="mx-auto mb-3 h-10 w-10 text-silver-300" />
        <p className="text-sm font-medium text-silver-700">Aguardando aprovação para emissão de contrato.</p>
        <p className="mt-1 text-xs text-silver-500">Status atual: {status}</p>
      </div>
    )
  }
  if (status === 'cancelado') {
    return <div className="card p-8 text-center text-sm text-silver-500">Proposta cancelada.</div>
  }

  return (
    <div className="space-y-6">
      {erro && (
        <div className="flex items-start gap-2 rounded border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {erro}
          <button className="ml-auto text-xs underline" onClick={() => setErro(null)}>fechar</button>
        </div>
      )}

      {/* Bloco principal — contrato */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-gold" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-silver-500">Contrato</h3>
            {contrato && (
              <span className="badge bg-silver-100 text-silver-700">v{contrato.versao}</span>
            )}
          </div>
          <div className="flex gap-2">
            {contrato?.pdf_storage_path && (
              <button className="btn-outline text-xs" onClick={abrirPreview}>
                <Eye className="mr-1 inline h-3 w-3" /> Visualizar
              </button>
            )}
          </div>
        </div>

        {/* Sem contrato — partner/admin pode gerar */}
        {!contrato && status === 'emissao_contrato' && (role === 'partner' || role === 'admin') && (
          <div className="rounded-lg border border-dashed border-silver-300 p-5 text-center">
            <p className="mb-3 text-sm text-silver-600">Proposta aprovada — gere o contrato para enviar à assinatura.</p>
            <button className="btn-gold" disabled={gerarMut.isPending} onClick={() => gerarMut.mutate()}>
              {gerarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
              Gerar contrato
            </button>
          </div>
        )}

        {!contrato && status !== 'emissao_contrato' && (
          <p className="text-sm text-silver-500">Nenhum contrato gerado.</p>
        )}

        {contrato && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Info label="Gerado em" value={contrato.gerado_em ? new Date(contrato.gerado_em).toLocaleString('pt-BR') : '—'} />
            <Info label="Provedor" value={contrato.provedor_assinatura ?? '—'} />
            <Info label="Envelope ID" value={contrato.provider_envelope_id ?? '—'} />
            <Info label="Assinado em" value={contrato.assinado_em ? new Date(contrato.assinado_em).toLocaleString('pt-BR') : '—'} />
            <Info label="Registrado em" value={contrato.registrado_em ? new Date(contrato.registrado_em).toLocaleString('pt-BR') : '—'} />
          </div>
        )}

        {/* Ações de envio */}
        {contrato && !contrato.provider_envelope_id && status === 'aguardando_assinatura' && (role === 'partner' || role === 'admin') && (
          <div className="mt-4 flex justify-end">
            <button className="btn-gold" disabled={enviarMut.isPending} onClick={() => enviarMut.mutate()}>
              {enviarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar para assinatura
            </button>
          </div>
        )}

        {contrato && (role === 'partner' || role === 'admin') && status === 'aguardando_assinatura' && contrato.provider_envelope_id && (
          <div className="mt-4 flex justify-end">
            <button className="btn-outline" disabled={enviarMut.isPending} onClick={() => enviarMut.mutate()}>
              {enviarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Reenviar
            </button>
          </div>
        )}
      </div>

      {/* Signatários */}
      {contrato && assinaturas.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-silver-100 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-silver-500">Signatários</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-silver-500" style={{ backgroundColor: '#f9f9f9' }}>
              <tr>
                <th className="px-4 py-3">Ordem</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Papel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assinado em</th>
              </tr>
            </thead>
            <tbody>
              {assinaturas.map(s => (
                <tr key={s.id} className="border-t border-silver-100">
                  <td className="px-4 py-3 text-silver-600">#{s.ordem}</td>
                  <td className="px-4 py-3 font-medium text-navy">{s.signatario_nome}</td>
                  <td className="px-4 py-3 text-silver-600">{s.signatario_email}</td>
                  <td className="px-4 py-3 text-silver-600">{s.papel}</td>
                  <td className="px-4 py-3"><AssinPill status={s.status} /></td>
                  <td className="px-4 py-3 text-xs text-silver-500">
                    {s.assinado_em ? new Date(s.assinado_em).toLocaleString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registro (admin) */}
      {contrato && contrato.assinado_em && status === 'em_registro' && role === 'admin' && (
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Registro em cartório</h3>
          <p className="mb-4 text-sm text-silver-600">Confirme o registro do contrato para liberar o próximo passo (liberação de recurso).</p>
          <button className="btn-gold" disabled={registrarMut.isPending} onClick={() => registrarMut.mutate()}>
            {registrarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
            Marcar como registrado
          </button>
        </div>
      )}

      {/* Liberação (admin) */}
      {status === 'contrato_registrado' && role === 'admin' && (
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Liberação de recurso</h3>
          <p className="mb-4 text-sm text-silver-600">Registre o valor liberado para o tomador. Isto dispara o cálculo automático de comissão do parceiro.</p>
          <button className="btn-gold" onClick={() => setModalLiberacao(true)}>
            <Coins className="h-4 w-4" /> Registrar liberação
          </button>
        </div>
      )}

      {/* Já liberado */}
      {liberacao && (
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Liberação registrada</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Info label="Valor liberado" value={brl(Number(liberacao.valor_liberado) * 100)} />
            <Info label="Data" value={new Date(liberacao.data_liberacao).toLocaleDateString('pt-BR')} />
            <Info label="Registrado em" value={new Date(liberacao.created_at).toLocaleString('pt-BR')} />
            <Info label="Observação" value={liberacao.observacao ?? '—'} />
          </div>
          {liberacao.comprovante_storage_path && (
            <div className="mt-3">
              <button className="btn-outline text-xs" onClick={() => baixarComprovante(liberacao.comprovante_storage_path!)}>
                <Download className="mr-1 inline h-3 w-3" /> Baixar comprovante
              </button>
            </div>
          )}
        </div>
      )}

      {/* Comissão */}
      {comissao && (role === 'partner' || role === 'admin') && (
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Comissão do parceiro</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Info label="Percentual" value={`${Number(comissao.percentual).toFixed(2)}%`} />
            <Info label="Valor" value={brl(Number(comissao.valor) * 100)} />
            <Info label="Status" value={<ComissaoBadge status={comissao.status} />} />
          </div>
          {comissao.paga_em && (
            <p className="mt-3 text-xs text-success">Paga em {new Date(comissao.paga_em).toLocaleDateString('pt-BR')}</p>
          )}
        </div>
      )}

      {/* Modal preview HTML */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewUrl(null)}>
          <div className="card flex h-full max-h-[90vh] w-full max-w-4xl flex-col p-3" onClick={e => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy"><FileText className="mr-1 inline h-4 w-4" /> Contrato</h3>
              <button className="btn-outline text-xs" onClick={() => setPreviewUrl(null)}>Fechar</button>
            </div>
            <iframe src={previewUrl} className="h-full w-full rounded border border-silver-200" title="Contrato" />
          </div>
        </div>
      )}

      {/* Modal liberação */}
      {modalLiberacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalLiberacao(false)}>
          <div className="card w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold text-navy">Registrar liberação</h3>
            <label className="block text-xs font-medium text-silver-600">Valor (R$)</label>
            <input className="input mt-1" value={libValor} onChange={e => setLibValor(e.target.value)} placeholder="500.000,00" />
            <label className="mt-3 block text-xs font-medium text-silver-600">Data da liberação</label>
            <input type="date" className="input mt-1" value={libData} onChange={e => setLibData(e.target.value)} />
            <label className="mt-3 block text-xs font-medium text-silver-600">Observação</label>
            <input className="input mt-1" value={libObs} onChange={e => setLibObs(e.target.value)} />
            <label className="mt-3 block text-xs font-medium text-silver-600">Comprovante (opcional)</label>
            <input type="file" className="input mt-1" accept="application/pdf,image/*"
              onChange={e => setLibFile(e.target.files?.[0] ?? null)} />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setModalLiberacao(false)}>Cancelar</button>
              <button className="btn-gold" disabled={liberacaoMut.isPending} onClick={() => liberacaoMut.mutate()}>
                {liberacaoMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar liberação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-silver-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-silver-900">{value}</p>
    </div>
  )
}

function AssinPill({ status }: { status: Assinatura['status'] }) {
  const cfg: Record<Assinatura['status'], { cls: string; Icon: typeof CheckCircle2 }> = {
    pendente:  { cls: 'bg-yellow-100 text-yellow-700', Icon: Clock },
    assinado:  { cls: 'bg-success/15 text-success',    Icon: CheckCircle2 },
    rejeitado: { cls: 'bg-danger/15 text-danger',      Icon: AlertTriangle },
  }
  const { cls, Icon } = cfg[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon className="h-3 w-3" /> {STATUS_LABEL_ASSIN[status]}
    </span>
  )
}

function ComissaoBadge({ status }: { status: Comissao['status'] }) {
  const cfg: Record<Comissao['status'], string> = {
    prevista: 'bg-yellow-100 text-yellow-700',
    aprovada: 'bg-blue-100 text-blue-700',
    paga:     'bg-success/15 text-success',
  }
  return <span className={`badge ${cfg[status]}`}>{status}</span>
}

