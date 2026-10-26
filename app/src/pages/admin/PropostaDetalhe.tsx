import './proposta-detalhe.css'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Copy,
  CircleDollarSign,
  ShieldCheck,
  MapPin,
  FileSignature,
  FileText,
  History,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { calcularFinanciamento, calcularLTV, somarValoresImoveis } from '@/lib/credito'
import { formatReais, parseReaisInput } from '@/components/MoneyInput'
import { maskCpf, maskCnpj } from '@/lib/documentoBr'
import { PropostaDocsUploader } from '@/components/PropostaDocsUploader'
import { PropostaPendencias } from '@/components/PropostaPendencias'
import { PropostaConsultas } from '@/components/PropostaConsultas'
import { PropostaContrato } from '@/components/PropostaContrato'
import { PropostaFundos } from '@/components/PropostaFundos'
import { PropostaCondicaoComercial } from '@/components/PropostaCondicaoComercial'
import { useAuth } from '@/auth/AuthContext'
import { createPropostaDocumentoSignedUrl, openPropostaDocumento } from '@/lib/propostaDocumento'
import { dateInputToTimestamp, formatDateBr, toDateInputValue } from '@/lib/dateBr'
import {
  buildChecklist,
  CATEGORIA_LABEL,
  DOC_STATUS_LABEL,
  type DocCategoria,
  type DocRowLite,
  type RequisitoRow,
} from '@/lib/documentos'

const LEAD_CLASS_LABEL: Record<string, string> = {
  triple_a: 'Triplo A',
  double_aa: 'Double AA',
  estressado: 'Estressado',
  desqualificado: 'Desqualificado',
}

function maskCpfCnpj(cpf: string | null | undefined, cnpj: string | null | undefined): string {
  if (cnpj) return maskCnpj(cnpj)
  if (cpf) return maskCpf(cpf)
  return '—'
}

const TABS = ['Resumo', 'Proponentes', 'Imóveis', 'Documentos', 'Pendências', 'Consultas', 'Contrato', 'Financeiro', 'Histórico'] as const

const TAB_DOM_ID: Record<typeof TABS[number], string> = {
  Resumo: 'resumo',
  Proponentes: 'proponentes',
  Imóveis: 'imoveis',
  Documentos: 'documentos',
  Pendências: 'pendencias',
  Consultas: 'consultas',
  Contrato: 'contrato',
  Financeiro: 'financeiro',
  Histórico: 'historico',
}

const TAB_ICON: Record<typeof TABS[number], React.ComponentType<{ className?: string }>> = {
  Resumo: Sparkles,
  Proponentes: Users,
  Imóveis: Building2,
  Documentos: FileText,
  Pendências: AlertTriangle,
  Consultas: Search,
  Contrato: FileSignature,
  Financeiro: CircleDollarSign,
  Histórico: History,
}

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise de Crédito',
  pre_aprovado: 'Pré-aprovado',
  analise_imovel: 'Análise de Imóvel',
  analise_juridica: 'Análise Jurídica',
  comite: 'Comitê',
  proposta_cliente: 'Proposta ao Cliente',
  resolucao_pendencias: 'Resolução pendências',
  emissao_contrato: 'Emissão de Contrato',
  aguardando_assinatura: 'Aguardando Assinatura',
  em_registro: 'Em Registro',
  contrato_registrado: 'Contrato Registrado',
  recurso_liberado: 'Recurso Liberado',
  standby: 'Standby',
  cancelado: 'Cancelada',
}

const STATUS_ORDER = [
  'simulacao',
  'pre_analise',
  'analise_credito',
  'pre_aprovado',
  'analise_imovel',
  'analise_juridica',
  'comite',
  'proposta_cliente',
  'resolucao_pendencias',
  'emissao_contrato',
  'aguardando_assinatura',
  'em_registro',
  'contrato_registrado',
  'recurso_liberado',
  'standby',
  'cancelado',
] as const

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

const TIPO_LABEL: Record<string, string> = {
  rg: 'RG',
  cpf: 'CPF',
  cnh: 'CNH',
  contrato_social: 'Contrato Social',
  comprovante_residencia: 'Comprovante de Residência',
  comprovante_renda: 'Comprovante de Renda',
  matricula_imovel: 'Matrícula do Imóvel',
  iptu: 'IPTU',
  certidao_casamento: 'Certidão de Casamento',
  certidao_nascimento: 'Certidão de Nascimento',
  irpf_declaracao: 'IRPF — Declaração',
  irpf_recibo: 'IRPF — Recibo',
  extrato_bancario: 'Extrato Bancário',
  demonstrativo_contabil: 'Demonstrativo Contábil',
  ficha_cadastral_imovel: 'Ficha Cadastral do Imóvel',
  fotos_imovel: 'Fotos do Imóvel',
  contrato_compra_venda: 'Contrato de Compra e Venda',
  outros: 'Outros',
}

interface Proposta {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  valor_imoveis_total: number
  prazo_meses: number
  carencia_meses: number
  taxa_juros_mensal: number
  amortizacao: 'price' | 'sac'
  correcao: string
  indexador: string
  limite_50_aplicado: boolean
  created_at: string
  updated_at: string
  responsavel_id: string | null
  classificacao_lead: 'triple_a' | 'double_aa' | 'estressado' | 'desqualificado' | null
  classificacao_peso: number | null
  classificacao_confianca: number | null
  classificacao_motivo: string | null
  distribuido_em: string | null
  distribuicao_motivo: string | null
  partner: { usuario: { nome_completo: string | null } | null } | null
  responsavel: { nome_completo: string | null } | null
  cliente: {
    id?: string
    data_nascimento?: string | null
    nome_completo: string
    cpf: string | null
    cnpj: string | null
    email: string | null
    telefone: string | null
    modelo_renda: string | null
    renda_mensal: number | null
    endereco_cep: string | null
    endereco_logradouro: string | null
    endereco_numero: string | null
    endereco_bairro: string | null
    endereco_cidade: string | null
    endereco_estado: string | null
    razao_social: string | null
    email_responsavel: string | null
    celular_comercial: string | null
    tipo_empresa: string | null
    ramo_atuacao: string | null
    data_abertura: string | null
    faturamento_mensal: number | null
  } | null
}

interface AdminOption { id: string; nome_completo: string }

type ProdutoForm = {
  produto: string
  valor_solicitado: string
  prazo_meses: string
  carencia_meses: string
  taxa_juros_mensal: string
  amortizacao: string
  indexador: string
  correcao: string
  limite_50_aplicado: boolean
  created_at: string
}

type ClienteForm = {
  nome_completo: string
  razao_social: string
  cpf: string
  cnpj: string
  email: string
  email_responsavel: string
  telefone: string
  celular_comercial: string
  modelo_renda: string
  renda_mensal: string
  endereco_cep: string
  endereco_logradouro: string
  endereco_numero: string
  endereco_bairro: string
  endereco_cidade: string
  endereco_estado: string
  tipo_empresa: string
  ramo_atuacao: string
  data_abertura: string
  faturamento_mensal: string
}

function toProdutoForm(p: Proposta): ProdutoForm {
  return {
    produto: p.produto,
    valor_solicitado: String(p.valor_solicitado ?? ''),
    prazo_meses: String(p.prazo_meses ?? ''),
    carencia_meses: String(p.carencia_meses ?? ''),
    taxa_juros_mensal: String(p.taxa_juros_mensal ?? ''),
    amortizacao: p.amortizacao,
    indexador: p.indexador ?? '',
    correcao: p.correcao ?? '',
    limite_50_aplicado: Boolean(p.limite_50_aplicado),
    created_at: toDateInputValue(p.created_at),
  }
}

function toClienteForm(c: Proposta['cliente']): ClienteForm {
  return {
    nome_completo: c?.nome_completo ?? '',
    razao_social: c?.razao_social ?? '',
    cpf: c?.cpf ?? '',
    cnpj: c?.cnpj ?? '',
    email: c?.email ?? '',
    email_responsavel: c?.email_responsavel ?? '',
    telefone: c?.telefone ?? '',
    celular_comercial: c?.celular_comercial ?? '',
    modelo_renda: c?.modelo_renda ?? '',
    renda_mensal: c?.renda_mensal != null ? String(c.renda_mensal) : '',
    endereco_cep: c?.endereco_cep ?? '',
    endereco_logradouro: c?.endereco_logradouro ?? '',
    endereco_numero: c?.endereco_numero ?? '',
    endereco_bairro: c?.endereco_bairro ?? '',
    endereco_cidade: c?.endereco_cidade ?? '',
    endereco_estado: c?.endereco_estado ?? '',
    tipo_empresa: c?.tipo_empresa ?? '',
    ramo_atuacao: c?.ramo_atuacao ?? '',
    data_abertura: c?.data_abertura ? c.data_abertura.slice(0, 10) : '',
    faturamento_mensal: c?.faturamento_mensal != null ? String(c.faturamento_mensal) : '',
  }
}

const MODELO_RENDA_LABEL: Record<string, string> = {
  assalariado_clt: 'Assalariado (CLT)',
  empresario: 'Empresário',
  autonomo: 'Autônomo',
  aposentado_pensionista: 'Aposentado/Pensionista',
  funcionario_publico: 'Funcionário Público',
}

interface Proponente {
  id: string
  cliente_id?: string | null
  endereco_cep?: string | null
  endereco_logradouro?: string | null
  endereco_numero?: string | null
  endereco_complemento?: string | null
  endereco_bairro?: string | null
  nome: string
  cpf_cnpj: string | null
  principal: boolean
  relacao: string | null
  estado_civil: string | null
  pessoa_tipo: string
  compoe_renda: boolean | null
  modelo_renda: string | null
  renda_mensal: number | null
  endereco_cidade: string | null
  endereco_estado: string | null
}

interface Imovel {
  id: string
  tipo: string
  principal: boolean
  cidade: string | null
  estado: string | null
  bairro: string | null
  logradouro: string | null
  numero: string | null
  valor: number
}

interface HistoricoRow {
  id: string
  status_anterior: string | null
  status_novo: string
  motivo: string | null
  created_at: string
  metadata?: Record<string, unknown>
}

interface DocRow {
  id: string
  tipo: string
  categoria: string
  storage_path: string | null
  status: string | null
  validado: boolean
  origem: string | null
  created_at: string
}

export function AdminPropostaDetalhe() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { session } = useAuth()
  const isAdminJuridico = session?.role === 'admin' && session.adminNivel === 'juridico'
  const [tab, setTab] = useState<typeof TABS[number]>('Resumo')
  const statusDetailsRef = useRef<HTMLDetailsElement>(null)
  const [novoStatus, setNovoStatus] = useState<string>('')
  const [motivo, setMotivo] = useState('')
  const [dataComissao, setDataComissao] = useState('')
  const [motivoComissao, setMotivoComissao] = useState('')
  const [buscaHistorico, setBuscaHistorico] = useState('')
  const canEdit = !isAdminJuridico
  const [editResumo, setEditResumo] = useState(false)
  const [produtoForm, setProdutoForm] = useState<ProdutoForm | null>(null)
  const [clienteForm, setClienteForm] = useState<ClienteForm | null>(null)
  const [editProponentes, setEditProponentes] = useState(false)
  const [proponentesForm, setProponentesForm] = useState<Proponente[]>([])
  const [editImoveis, setEditImoveis] = useState(false)
  const [imoveisForm, setImoveisForm] = useState<Array<Imovel & { _novo?: boolean }>>([])
  const [imoveisError, setImoveisError] = useState<string | null>(null)
  const [documentoAbrindoId, setDocumentoAbrindoId] = useState<string | null>(null)
  const [documentoVisualizacaoError, setDocumentoVisualizacaoError] = useState<string | null>(null)

  async function handleVisualizarDocumento(documento: DocRow) {
    if (!documento.storage_path) return

    setDocumentoVisualizacaoError(null)
    setDocumentoAbrindoId(documento.id)
    try {
      const signedUrl = await createPropostaDocumentoSignedUrl(documento.storage_path)
      openPropostaDocumento(signedUrl)
    } catch (err) {
      setDocumentoVisualizacaoError(
        err instanceof Error ? err.message : 'Não foi possível visualizar o documento.',
      )
    } finally {
      setDocumentoAbrindoId(null)
    }
  }

  const { data: proposta, isLoading, error } = useQuery({
    queryKey: ['admin-proposta', id],
    queryFn: async (): Promise<Proposta> => {
      const { data, error } = await supabase
        .from('propostas')
        // partners tem 2 FKs para usuarios (usuario_id e aprovado_por),
        // por isso o embed precisa desambiguar com !usuario_id.
        .select('id, protocolo, produto, status, valor_solicitado, valor_imoveis_total, prazo_meses, carencia_meses, taxa_juros_mensal, amortizacao, correcao, indexador, limite_50_aplicado, created_at, updated_at, responsavel_id, classificacao_lead, classificacao_peso, classificacao_confianca, classificacao_motivo, distribuido_em, distribuicao_motivo, partner:partners(usuario:usuarios!usuario_id(nome_completo)), responsavel:usuarios!responsavel_id(nome_completo), cliente:clientes(id, data_nascimento, nome_completo, cpf, cnpj, email, telefone, modelo_renda, renda_mensal, endereco_cep, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, razao_social, email_responsavel, celular_comercial, tipo_empresa, ramo_atuacao, data_abertura, faturamento_mensal)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as unknown as Proposta
    },
    enabled: !!id,
  })

  const { data: fundosCabecalho = [] } = useQuery({
    queryKey: ['admin-proposta-fundos', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('proposta_fundos')
        .select('fundo_id, status_fundo, observacao, fundos(id, nome, cor_hex, ativo)')
        .eq('proposta_id', id!).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Array<{ fundo_id: string; fundos: { nome: string; cor_hex: string } | null }>
    },
    enabled: !!id,
  })

  const { data: proponentes, error: proponentesError } = useQuery({
    queryKey: ['admin-proposta-proponentes', id],
    queryFn: async (): Promise<Proponente[]> => {
      const { data, error } = await supabase
        .from('proponentes')
        .select('id, cliente_id, endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, nome, cpf_cnpj, principal, relacao, estado_civil, pessoa_tipo, compoe_renda, modelo_renda, renda_mensal, endereco_cidade, endereco_estado')
        .eq('proposta_id', id!)
        .order('principal', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!id && tab === 'Proponentes',
  })

  const { data: imoveis, error: imoveisQueryError } = useQuery({
    queryKey: ['admin-proposta-imoveis', id],
    queryFn: async (): Promise<Imovel[]> => {
      const { data, error } = await supabase
        .from('imoveis')
        .select('id, tipo, principal, cidade, estado, bairro, logradouro, numero, valor')
        .eq('proposta_id', id!)
      if (error) throw error
      return data || []
    },
    enabled: !!id && tab === 'Imóveis',
  })

  const { data: admins } = useQuery({
    queryKey: ['admin-usuarios-role-admin'],
    queryFn: async (): Promise<AdminOption[]> => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome_completo')
        .in('role', ['admin', 'team_member'])
        .order('nome_completo')
      if (error) throw error
      return data || []
    },
    enabled: tab === 'Resumo' && canEdit,
  })

  const { data: historico, error: historicoError } = useQuery({
    queryKey: ['admin-proposta-historico', id],
    queryFn: async (): Promise<HistoricoRow[]> => {
      const { data, error } = await supabase
        .from('proposta_status_historico')
        .select('id, status_anterior, status_novo, motivo, metadata, created_at')
        .eq('proposta_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!id && tab === 'Histórico',
  })

  // Documentos para painel de validação rápida na tab Documentos
  const { data: docs } = useQuery({
    queryKey: ['admin-proposta-docs', id],
    queryFn: async (): Promise<DocRow[]> => {
      await supabase.rpc('proposta_documentos_seed', { p_proposta_id: id! })
      const { data, error } = await supabase
        .from('proposta_documentos')
        .select('id, tipo, categoria, storage_path, status, validado, origem, created_at')
        .eq('proposta_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!id && tab === 'Documentos',
  })

  const { data: requisitos = [] } = useQuery({
    queryKey: ['doc-requisitos'],
    queryFn: async (): Promise<RequisitoRow[]> => {
      const { data, error } = await supabase
        .from('documento_requisitos')
        .select('categoria, tipo, obrigatorio, ordem')
      if (error) throw error
      return (data ?? []) as RequisitoRow[]
    },
    enabled: tab === 'Documentos',
  })

  const statusMut = useMutation({
    mutationFn: async (vars: { status: string; motivo: string }) => {
      const { error } = await supabase.rpc('admin_set_proposta_status', {
        p_id: id!,
        p_status: vars.status,
        p_motivo: vars.motivo || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-proposta', id] })
      qc.invalidateQueries({ queryKey: ['admin-proposta-historico', id] })
      qc.invalidateQueries({ queryKey: ['admin-propostas'] })
      setMotivo('')
      setNovoStatus('')
      if (statusDetailsRef.current) statusDetailsRef.current.open = false
    },
  })

  const comissaoHistoricaMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_corrigir_entrada_pagamento_comissao', {
        p_proposta_id: id!, p_data: dataComissao, p_motivo: motivoComissao,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-proposta-historico', id] })
      setDataComissao('')
      setMotivoComissao('')
    },
  })

  const updateCamposMut = useMutation({
    mutationFn: async (vars: {
      proposta?: Record<string, unknown>
      cliente?: Record<string, unknown>
      proponentes?: Record<string, unknown>[]
      imoveis?: Record<string, unknown>[]
    }) => {
      const { error } = await supabase.rpc('admin_proposta_update_campos', {
        p_proposta_id: id!,
        p_proposta: vars.proposta ?? {},
        p_cliente: vars.cliente ?? {},
        p_proponentes: vars.proponentes ?? [],
        p_imoveis: vars.imoveis ?? [],
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-proposta', id] }),
        qc.invalidateQueries({ queryKey: ['admin-proposta-proponentes', id] }),
        qc.invalidateQueries({ queryKey: ['admin-proposta-imoveis', id] }),
        qc.invalidateQueries({ queryKey: ['admin-propostas'] }),
      ])
    },
  })

  const responsavelMut = useMutation({
    mutationFn: async (usuarioId: string | null) => {
      const { error } = await supabase.rpc('admin_set_responsavel', {
        p_proposta_id: id!,
        p_usuario_id: usuarioId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-proposta', id] })
      qc.invalidateQueries({ queryKey: ['admin-propostas'] })
    },
  })

  const classificacaoMut = useMutation({
    mutationFn: async (classificacao: string) => {
      const { error } = await supabase.rpc('admin_classificar_distribuir_proposta', {
        p_proposta_id: id!,
        p_classificacao: classificacao,
        p_confianca: 1,
        p_motivo: 'Classificação manual pelo administrador',
        p_automatico: false,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-proposta', id] })
      qc.invalidateQueries({ queryKey: ['admin-propostas'] })
    },
  })

  const classificacaoAutomaticaMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_classificar_proposta_automatico', { p_proposta_id: id! })
      if (error) throw error
      return data as { distribuido?: boolean; revisao_obrigatoria?: boolean; motivo?: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-proposta', id] })
      qc.invalidateQueries({ queryKey: ['admin-propostas'] })
    },
  })

  function saveResumo() {
    if (!produtoForm || !clienteForm) return
    updateCamposMut.mutate(
      {
        proposta: {
          ...produtoForm,
          created_at: dateInputToTimestamp(produtoForm.created_at),
          limite_50_aplicado: String(produtoForm.limite_50_aplicado),
        },
        cliente: { ...clienteForm },
      },
      { onSuccess: () => setEditResumo(false) },
    )
  }

  function saveProponentes() {
    updateCamposMut.mutate(
      {
        proponentes: proponentesForm.map((p) => ({
          id: p.id,
          nome: p.nome,
          cpf_cnpj: p.cpf_cnpj ?? '',
          relacao: p.relacao ?? '',
          estado_civil: p.estado_civil ?? '',
          pessoa_tipo: p.pessoa_tipo,
          compoe_renda: p.compoe_renda == null ? '' : String(p.compoe_renda),
          modelo_renda: p.modelo_renda ?? '',
          renda_mensal: p.renda_mensal != null ? String(p.renda_mensal) : '',
          endereco_cidade: p.endereco_cidade ?? '',
          endereco_estado: p.endereco_estado ?? '',
        })),
      },
      { onSuccess: () => setEditProponentes(false) },
    )
  }

  function addImovelNovo() {
    setImoveisForm((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        tipo: 'apartamento',
        principal: false,
        cidade: '',
        estado: '',
        bairro: '',
        logradouro: '',
        numero: '',
        valor: 0,
        _novo: true,
      },
    ])
  }

  function removeImovelNovo(idx: number) {
    setImoveisForm((prev) => prev.filter((_, i) => i !== idx))
  }

  function saveImoveis() {
    setImoveisError(null)
    const invalido = imoveisForm.find((i) =>
      i._novo && (!i.tipo || !i.cidade?.trim() || !i.estado?.trim() || !(Number(i.valor) > 0)),
    )
    if (invalido) {
      setImoveisError('Preencha tipo, cidade, estado e valor (maior que zero) para o novo imóvel.')
      return
    }
    updateCamposMut.mutate(
      {
        imoveis: imoveisForm.map((i) => ({
          ...(i._novo ? {} : { id: i.id }),
          tipo: i.tipo,
          cidade: i.cidade ?? '',
          estado: i.estado ?? '',
          bairro: i.bairro ?? '',
          logradouro: i.logradouro ?? '',
          numero: i.numero ?? '',
          valor: String(i.valor),
        })),
      },
      { onSuccess: () => setEditImoveis(false) },
    )
  }

  const validarMut = useMutation({
    mutationFn: async (vars: { docId: string; validado: boolean }) => {
      const { error } = await supabase.rpc('admin_set_documento_validado', {
        p_id: vars.docId,
        p_validado: vars.validado,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-proposta-docs', id] })
      qc.invalidateQueries({ queryKey: ['proposta-docs', id] })
    },
  })

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-red-600" /></div>
  if (error) return <div className="p-10 text-center text-danger">Erro: {(error as Error).message}</div>
  if (!proposta) return <div className="p-10 text-center text-silver-500">Proposta não encontrada.</div>

  const historicoFiltrado = (historico ?? []).filter(h => [
    STATUS_LABEL[h.status_anterior ?? ''] ?? h.status_anterior,
    STATUS_LABEL[h.status_novo] ?? h.status_novo, h.motivo, formatDateBr(h.created_at),
  ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(buscaHistorico.toLocaleLowerCase('pt-BR')))

  const valor = Number(proposta.valor_solicitado)
  const valorImoveis = Number(proposta.valor_imoveis_total)
  const ltv = calcularLTV(valor, valorImoveis)
  const valorImoveisAba = editImoveis
    ? somarValoresImoveis(imoveisForm)
    : imoveis
      ? somarValoresImoveis(imoveis)
      : valorImoveis
  const ltvImoveisAba = calcularLTV(valor, valorImoveisAba)
  const calc = calcularFinanciamento({
    valor,
    prazoMeses: proposta.prazo_meses,
    taxaMensal: Number(proposta.taxa_juros_mensal) / 100,
    amortizacao: proposta.amortizacao,
    carenciaMeses: proposta.carencia_meses,
  })

  return (
    <div className="admin-proposal">
      <Link to="/admin/propostas" className="mb-4 inline-flex items-center gap-1 text-sm text-silver-600 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Voltar para propostas
      </Link>

      <header className="proposal-heading">
        <div>
          <p className="proposal-eyebrow">Proposta {proposta.protocolo || '—'}</p>
          <h1 className="text-2xl font-bold text-navy">
            {proposta.cliente?.razao_social || proposta.cliente?.nome_completo || 'Cliente'}
          </h1>
          <div className="proposal-heading__meta">
            <span>{PRODUTO_LABEL[proposta.produto] || proposta.produto}</span>
            <span>·</span>
            <span>Parceiro: {proposta.partner?.usuario?.nome_completo || '—'}</span>
            <span>·</span>
            <span>Criada {formatDateBr(proposta.created_at)}</span>
          </div>
        </div>

        {canEdit && <div className="proposal-header-actions">
          <details className="proposal-more-actions"><summary>··· Mais ações</summary><div className="proposal-more-actions__panel"><PropostaFundos propostaId={id!} /></div></details>
          <button type="button" className="btn-gold" onClick={() => { setTab('Resumo'); setProdutoForm(toProdutoForm(proposta)); setClienteForm(toClienteForm(proposta.cliente)); setEditResumo(true) }}><Pencil className="h-3.5 w-3.5" /> Editar proposta</button>
        </div>}
      </header>

      <div className="proposal-status-strip">
        <div className="proposal-status-field"><span>Status da proposta</span>{isAdminJuridico ? <strong>{STATUS_LABEL[proposta.status] || proposta.status}</strong> : <details ref={statusDetailsRef} className="proposal-status-control" onKeyDown={event => { if (event.key === 'Escape' && !statusMut.isPending) { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}><summary aria-label="Alterar status">{STATUS_LABEL[proposta.status] || proposta.status}<span aria-hidden="true">⌄</span></summary>
          <div className="proposal-status-popover">
            <label>Novo status<select className="input" value={novoStatus} onChange={e => setNovoStatus(e.target.value)} disabled={statusMut.isPending}><option value="">Selecione…</option>{STATUS_ORDER.filter(s => s !== proposta.status).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
            <label>Motivo / observação<textarea className="input" rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} disabled={statusMut.isPending} /></label>
            <button type="button" className="btn-gold" disabled={!novoStatus || statusMut.isPending} onClick={() => statusMut.mutate({ status: novoStatus, motivo })}>{statusMut.isPending ? 'Aplicando…' : 'Confirmar alteração'}</button>
            {statusMut.error && <p role="alert" className="text-xs text-danger">{(statusMut.error as Error).message}</p>}
          </div>
        </details>}</div>
        <div><span>Responsável</span><strong>{proposta.responsavel?.nome_completo || 'Não atribuído'}</strong></div>
        <div><span>Fundos atribuídos</span><div className="proposal-header-funds">{fundosCabecalho.filter(f => f.fundos).length ? fundosCabecalho.filter(f => f.fundos).map(f => <strong key={f.fundo_id}><i aria-hidden="true" style={{ backgroundColor: f.fundos!.cor_hex }} />{f.fundos!.nome}</strong>) : <strong>Não atribuído</strong>}</div></div>
        <div><span>Classificação</span><strong className="proposal-classification">{proposta.classificacao_lead ? LEAD_CLASS_LABEL[proposta.classificacao_lead] || proposta.classificacao_lead : 'Pendente'}</strong></div>
        <div><span>Última atualização</span><strong>{formatDateBr(proposta.updated_at)}</strong></div>
      </div>

      <div className="proposal-tabs-shell">
        <div role="tablist" aria-label="Seções da proposta" className="proposal-tabs">
          {TABS.map((t) => {
            const isActive = tab === t
            const Icon = TAB_ICON[t]

            return (
              <button
                key={t}
                id={`tab-${TAB_DOM_ID[t]}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`panel-${TAB_DOM_ID[t]}`}
                onClick={() => setTab(t)}
                className={`btn-no-liquid proposal-tab ${isActive ? 'is-active' : ''}`}
                onKeyDown={(event) => {
                  const current = TABS.indexOf(t)
                  const next = event.key === 'ArrowRight' ? (current + 1) % TABS.length
                    : event.key === 'ArrowLeft' ? (current + TABS.length - 1) % TABS.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null
                  if (next === null) return
                  event.preventDefault()
                  setTab(TABS[next])
                  document.getElementById(`tab-${TAB_DOM_ID[TABS[next]]}`)?.focus()
                }}
                tabIndex={isActive ? 0 : -1}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-red-600' : 'text-silver-400 group-hover:text-silver-600'}`} />
                <span>{t}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="proposal-panel" tabIndex={0} id={`panel-${TAB_DOM_ID[tab]}`} role="tabpanel" aria-labelledby={`tab-${TAB_DOM_ID[tab]}`}>

      <div className="proposal-page-heading"><h2>{tab}</h2><p>Informações e acompanhamento da operação.</p></div>

      {tab === 'Resumo' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canEdit && (
              <div className="flex items-center gap-2 text-sm">
                <label className="text-xs font-semibold uppercase tracking-wide text-silver-500">Responsável</label>
                <select
                  className="input w-auto"
                  value={proposta.responsavel_id ?? ''}
                  disabled={responsavelMut.isPending}
                  onChange={(e) => responsavelMut.mutate(e.target.value || null)}
                >
                  <option value="">Não atribuído</option>
                  {(admins ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.nome_completo}</option>
                  ))}
                </select>
                {responsavelMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-silver-400" />}
              </div>
            )}

            {canEdit && (
              <div className="flex items-center gap-2 text-sm">
                <label className="text-xs font-semibold uppercase tracking-wide text-silver-500">Classificação</label>
                <select
                  className="input w-auto"
                  value={proposta.classificacao_lead ?? ''}
                  disabled={classificacaoMut.isPending}
                  onChange={(e) => e.target.value && classificacaoMut.mutate(e.target.value)}
                >
                  <option value="">Não classificado</option>
                  {Object.entries(LEAD_CLASS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                {classificacaoMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-silver-400" />}
                {proposta.distribuicao_motivo && (
                  <span className="text-xs text-amber-600">{proposta.distribuicao_motivo}</span>
                )}
              </div>
            )}

            {canEdit && (
              <button
                type="button"
                className="btn-outline inline-flex items-center gap-1.5 text-xs"
                disabled={classificacaoAutomaticaMut.isPending}
                onClick={() => classificacaoAutomaticaMut.mutate()}
                title="Executa o classificador server-side conforme a configuração vigente"
              >
                {classificacaoAutomaticaMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Classificar automaticamente
              </button>
            )}

            {canEdit && (
              editResumo ? (
                <div className="flex items-center gap-2">
                  <button className="btn-outline text-xs" onClick={() => setEditResumo(false)} disabled={updateCamposMut.isPending}>
                    <X className="mr-1 inline h-3.5 w-3.5" /> Cancelar
                  </button>
                  <button className="btn-gold text-xs" onClick={saveResumo} disabled={updateCamposMut.isPending}>
                    {updateCamposMut.isPending ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 inline h-3.5 w-3.5" />}
                    Salvar
                  </button>
                </div>
              ) : (
                <button
                  className="btn-outline text-xs"
                  onClick={() => {
                    setProdutoForm(toProdutoForm(proposta))
                    setClienteForm(toClienteForm(proposta.cliente))
                    setEditResumo(true)
                  }}
                >
                  <Pencil className="mr-1 inline h-3.5 w-3.5" /> Editar dados
                </button>
              )
            )}
          </div>

          {responsavelMut.error && (
            <p className="inline-flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3 w-3" /> {(responsavelMut.error as Error).message}
            </p>
          )}
          {classificacaoMut.error && (
            <p className="inline-flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3 w-3" /> {(classificacaoMut.error as Error).message}
            </p>
          )}
          {updateCamposMut.error && (
            <p className="inline-flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3 w-3" /> {(updateCamposMut.error as Error).message}
            </p>
          )}

          <div className="proposal-summary-grid">
          <Section title="Condições da proposta" className={editResumo ? 'proposal-conditions-editing' : ''}>
            {editResumo && produtoForm ? (
              <div className="proposal-conditions-form">
                <Field label="Produto">
                  <select className="input" value={produtoForm.produto} onChange={(e) => setProdutoForm({ ...produtoForm, produto: e.target.value })}>
                    {Object.entries(PRODUTO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Valor solicitado">
                  <input className="input" type="number" step="0.01" value={produtoForm.valor_solicitado} onChange={(e) => setProdutoForm({ ...produtoForm, valor_solicitado: e.target.value })} />
                </Field>
                <Field label="Prazo (meses)">
                  <input className="input" type="number" value={produtoForm.prazo_meses} onChange={(e) => setProdutoForm({ ...produtoForm, prazo_meses: e.target.value })} />
                </Field>
                <Field label="Carência (meses)">
                  <input className="input" type="number" value={produtoForm.carencia_meses} onChange={(e) => setProdutoForm({ ...produtoForm, carencia_meses: e.target.value })} />
                </Field>
                <Field label="Amortização">
                  <select className="input" value={produtoForm.amortizacao} onChange={(e) => setProdutoForm({ ...produtoForm, amortizacao: e.target.value })}>
                    <option value="price">PRICE</option>
                    <option value="sac">SAC</option>
                  </select>
                </Field>
                <Field label="Indexador">
                  <input className="input" value={produtoForm.indexador} onChange={(e) => setProdutoForm({ ...produtoForm, indexador: e.target.value })} />
                </Field>
                <Field label="Correção">
                  <select className="input" value={produtoForm.correcao} onChange={(e) => setProdutoForm({ ...produtoForm, correcao: e.target.value })}>
                    <option value="pos_fixado">Pós-fixado</option>
                    <option value="pre_fixado">Pré-fixado</option>
                  </select>
                </Field>
                <Field label="Taxa de juros mensal (%)">
                  <input className="input" type="number" step="0.01" value={produtoForm.taxa_juros_mensal} onChange={(e) => setProdutoForm({ ...produtoForm, taxa_juros_mensal: e.target.value })} />
                </Field>
                <Field label="Data da proposta">
                  <input className="input" type="date" value={produtoForm.created_at} onChange={(e) => setProdutoForm({ ...produtoForm, created_at: e.target.value })} />
                </Field>
                <label className="flex items-center gap-2 text-sm text-silver-700">
                  <input type="checkbox" checked={produtoForm.limite_50_aplicado} onChange={(e) => setProdutoForm({ ...produtoForm, limite_50_aplicado: e.target.checked })} />
                  Limite 50% aplicado
                </label>
              </div>
            ) : (
              <>
                <Row k="Valor solicitado" v={brl(valor * 100)} />
                <Row k="Prazo" v={`${proposta.prazo_meses} meses`} />
                <Row k="Carência" v={`${proposta.carencia_meses} meses`} />
                <Row k="Sistema" v={`${proposta.amortizacao.toUpperCase()} · ${proposta.indexador} + ${Number(proposta.taxa_juros_mensal).toFixed(2)}% a.m.`} />
                {proposta.limite_50_aplicado && (
                  <Row k="Limite 50%" v={<span className="badge bg-gold/15 text-red-600">Aplicado (máx. 50% do valor dos imóveis)</span>} />
                )}
              </>
            )}
          </Section>
          <Section title={proposta.cliente?.cnpj ? 'Cliente (PJ)' : 'Cliente (PF)'}>
            {editResumo && clienteForm ? (
              <div className="space-y-3">
                <Field label="Nome completo (PF)">
                  <input className="input" value={clienteForm.nome_completo} onChange={(e) => setClienteForm({ ...clienteForm, nome_completo: e.target.value })} />
                </Field>
                <Field label="Razão social (PJ)">
                  <input className="input" value={clienteForm.razao_social} onChange={(e) => setClienteForm({ ...clienteForm, razao_social: e.target.value })} />
                </Field>
                <Field label="CPF">
                  <input className="input" value={clienteForm.cpf} onChange={(e) => setClienteForm({ ...clienteForm, cpf: maskCpf(e.target.value) })} />
                </Field>
                <Field label="CNPJ">
                  <input className="input" value={clienteForm.cnpj} onChange={(e) => setClienteForm({ ...clienteForm, cnpj: maskCnpj(e.target.value) })} />
                </Field>
                <Field label="E-mail">
                  <input className="input" type="email" value={clienteForm.email} onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })} />
                </Field>
                <Field label="E-mail do responsável (PJ)">
                  <input className="input" type="email" value={clienteForm.email_responsavel} onChange={(e) => setClienteForm({ ...clienteForm, email_responsavel: e.target.value })} />
                </Field>
                <Field label="Telefone">
                  <input className="input" value={clienteForm.telefone} onChange={(e) => setClienteForm({ ...clienteForm, telefone: e.target.value })} />
                </Field>
                <Field label="Celular comercial (PJ)">
                  <input className="input" value={clienteForm.celular_comercial} onChange={(e) => setClienteForm({ ...clienteForm, celular_comercial: e.target.value })} />
                </Field>
                <Field label="Composição de renda (PF)">
                  <select className="input" value={clienteForm.modelo_renda} onChange={(e) => setClienteForm({ ...clienteForm, modelo_renda: e.target.value })}>
                    <option value="">—</option>
                    {Object.entries(MODELO_RENDA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Renda mensal (PF)">
                  <input className="input" type="number" step="0.01" value={clienteForm.renda_mensal} onChange={(e) => setClienteForm({ ...clienteForm, renda_mensal: e.target.value })} />
                </Field>
                <Field label="Tipo de empresa (PJ)">
                  <input className="input" value={clienteForm.tipo_empresa} onChange={(e) => setClienteForm({ ...clienteForm, tipo_empresa: e.target.value })} />
                </Field>
                <Field label="Ramo de atuação (PJ)">
                  <input className="input" value={clienteForm.ramo_atuacao} onChange={(e) => setClienteForm({ ...clienteForm, ramo_atuacao: e.target.value })} />
                </Field>
                <Field label="Data de abertura (PJ)">
                  <input className="input" type="date" value={clienteForm.data_abertura} onChange={(e) => setClienteForm({ ...clienteForm, data_abertura: e.target.value })} />
                </Field>
                <Field label="Faturamento mensal (PJ)">
                  <input className="input" type="number" step="0.01" value={clienteForm.faturamento_mensal} onChange={(e) => setClienteForm({ ...clienteForm, faturamento_mensal: e.target.value })} />
                </Field>
                <Field label="CEP">
                  <input className="input" value={clienteForm.endereco_cep} onChange={(e) => setClienteForm({ ...clienteForm, endereco_cep: e.target.value })} />
                </Field>
                <Field label="Logradouro">
                  <input className="input" value={clienteForm.endereco_logradouro} onChange={(e) => setClienteForm({ ...clienteForm, endereco_logradouro: e.target.value })} />
                </Field>
                <Field label="Número">
                  <input className="input" value={clienteForm.endereco_numero} onChange={(e) => setClienteForm({ ...clienteForm, endereco_numero: e.target.value })} />
                </Field>
                <Field label="Bairro">
                  <input className="input" value={clienteForm.endereco_bairro} onChange={(e) => setClienteForm({ ...clienteForm, endereco_bairro: e.target.value })} />
                </Field>
                <Field label="Cidade">
                  <input className="input" value={clienteForm.endereco_cidade} onChange={(e) => setClienteForm({ ...clienteForm, endereco_cidade: e.target.value })} />
                </Field>
                <Field label="Estado (UF)">
                  <input className="input" maxLength={2} value={clienteForm.endereco_estado} onChange={(e) => setClienteForm({ ...clienteForm, endereco_estado: e.target.value.toUpperCase() })} />
                </Field>
              </div>
            ) : (
              <>
                <Row k="Nome / Razão social" v={proposta.cliente?.razao_social || proposta.cliente?.nome_completo || '—'} />
                <Row k="CPF/CNPJ" v={maskCpfCnpj(proposta.cliente?.cpf, proposta.cliente?.cnpj)} />
                <Row k="E-mail" v={proposta.cliente?.email || proposta.cliente?.email_responsavel || '—'} />
                <Row k="Telefone" v={proposta.cliente?.telefone || proposta.cliente?.celular_comercial || '—'} />
                {proposta.cliente?.cnpj ? (
                  <>
                    {proposta.cliente?.tipo_empresa && <Row k="Tipo de empresa" v={proposta.cliente.tipo_empresa} />}
                    {proposta.cliente?.ramo_atuacao && <Row k="Ramo de atuação" v={proposta.cliente.ramo_atuacao} />}
                    {proposta.cliente?.data_abertura && <Row k="Data de abertura" v={new Date(proposta.cliente.data_abertura).toLocaleDateString('pt-BR')} />}
                    {proposta.cliente?.faturamento_mensal != null && <Row k="Faturamento mensal" v={brl(Number(proposta.cliente.faturamento_mensal) * 100)} />}
                  </>
                ) : (
                  <>
                    {proposta.cliente?.modelo_renda && <Row k="Composição de renda" v={MODELO_RENDA_LABEL[proposta.cliente.modelo_renda] ?? proposta.cliente.modelo_renda} />}
                    {proposta.cliente?.renda_mensal != null && <Row k="Renda mensal" v={brl(Number(proposta.cliente.renda_mensal) * 100)} />}
                  </>
                )}
                {(proposta.cliente?.endereco_cidade || proposta.cliente?.endereco_logradouro) && (
                  <Row k="Endereço" v={[
                    [proposta.cliente?.endereco_logradouro, proposta.cliente?.endereco_numero].filter(Boolean).join(', '),
                    proposta.cliente?.endereco_bairro,
                    [proposta.cliente?.endereco_cidade, proposta.cliente?.endereco_estado].filter(Boolean).join('/'),
                  ].filter(Boolean).join(' — ') || '—'} />
                )}
              </>
            )}
          </Section>
          <Section title="Garantia">
            <Row k="Valor total dos imóveis" v={brl(valorImoveis * 100)} />
            <Row k="LTV" v={
              <span className={`badge ${ltv > 0.6 ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'}`}>
                {(ltv * 100).toFixed(1)}%
              </span>
            } />
          </Section>
          <Section title="Simulação estimada">
            <Row k="1ª parcela" v={brl(calc.primeiraParcela * 100)} />
            <Row k="Última parcela" v={brl(calc.ultimaParcela * 100)} />
            <Row k="Total a pagar" v={brl(calc.totalPago * 100)} />
            <Row k="Renda mínima" v={`${brl(calc.rendaMinima * 100)}/mês`} />
          </Section>
          </div>
        </div>
      )}

      {tab === 'Proponentes' && (
        <div className="space-y-3">
          {canEdit && editProponentes && proponentes && proponentes.length > 0 && (
            <div className="flex justify-end gap-2">
              {editProponentes ? (
                <>
                  <button className="btn-outline text-xs" onClick={() => setEditProponentes(false)} disabled={updateCamposMut.isPending}>
                    <X className="mr-1 inline h-3.5 w-3.5" /> Cancelar
                  </button>
                  <button className="btn-gold text-xs" onClick={saveProponentes} disabled={updateCamposMut.isPending}>
                    {updateCamposMut.isPending ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 inline h-3.5 w-3.5" />}
                    Salvar
                  </button>
                </>
              ) : (
                <button
                  className="btn-outline text-xs"
                  onClick={() => { setProponentesForm(proponentes.map((p) => ({ ...p }))); setEditProponentes(true) }}
                >
                  <Pencil className="mr-1 inline h-3.5 w-3.5" /> Editar
                </button>
              )}
            </div>
          )}
          {updateCamposMut.error && (
            <p className="inline-flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3 w-3" /> {(updateCamposMut.error as Error).message}
            </p>
          )}
          <div className={editProponentes ? "card overflow-x-auto" : "proposal-applicants-layout"}>
          {proponentesError ? (<p role="alert" className="p-5 text-sm text-danger">Não foi possível carregar os proponentes. Tente novamente.</p>) : !proponentes ? (
            <div className="p-10 text-center text-sm text-silver-500">Carregando…</div>
          ) : proponentes.length === 0 ? (
            <div className="p-10 text-center text-sm text-silver-500">Sem proponentes.</div>
          ) : editProponentes ? (
            <table className="w-full text-sm">
              <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
                <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">CPF/CNPJ</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Relação</th><th className="px-4 py-3">Estado civil</th><th className="px-4 py-3">Renda</th></tr>
              </thead>
              <tbody>
                {proponentesForm.map((p, idx) => (
                  <tr key={p.id} className="border-t border-silver-100">
                    <td className="px-4 py-3">
                      <input className="input" value={p.nome} onChange={(e) => setProponentesForm(proponentesForm.map((x, i) => i === idx ? { ...x, nome: e.target.value } : x))} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="input" value={p.cpf_cnpj ?? ''} onChange={(e) => setProponentesForm(proponentesForm.map((x, i) => i === idx ? { ...x, cpf_cnpj: e.target.value } : x))} />
                    </td>
                    <td className="px-4 py-3">
                      <select className="input" value={p.pessoa_tipo} onChange={(e) => setProponentesForm(proponentesForm.map((x, i) => i === idx ? { ...x, pessoa_tipo: e.target.value } : x))}>
                        <option value="PF">PF</option>
                        <option value="PJ">PJ</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select className="input" value={p.relacao ?? ''} onChange={(e) => setProponentesForm(proponentesForm.map((x, i) => i === idx ? { ...x, relacao: e.target.value } : x))}>
                        <option value="">—</option>
                        <option value="conjuge">Cônjuge</option>
                        <option value="socio">Sócio</option>
                        <option value="outro">Outro</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select className="input" value={p.estado_civil ?? ''} onChange={(e) => setProponentesForm(proponentesForm.map((x, i) => i === idx ? { ...x, estado_civil: e.target.value } : x))}>
                        <option value="">—</option>
                        <option value="solteiro">Solteiro</option>
                        <option value="casado">Casado</option>
                        <option value="divorciado">Divorciado</option>
                        <option value="viuvo">Viúvo</option>
                        <option value="uniao_estavel">União estável</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input className="input" type="number" step="0.01" value={p.renda_mensal ?? ''} onChange={(e) => setProponentesForm(proponentesForm.map((x, i) => i === idx ? { ...x, renda_mensal: e.target.value === '' ? null : Number(e.target.value) } : x))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <>
              <section className="card proposal-applicants-section" aria-labelledby="applicants-title">
                <div className="proposal-section-heading">
                  <div><h2 id="applicants-title">Proponentes da operação</h2><p>{proponentes.length} {proponentes.length === 1 ? 'pessoa vinculada' : 'pessoas vinculadas'} a esta proposta.</p></div>
                  {canEdit && <button type="button" className="btn-outline" onClick={() => { setProponentesForm(proponentes.map(p => ({ ...p }))); setEditProponentes(true) }}><Pencil className="h-3.5 w-3.5" /> Editar dados</button>}
                </div>
                <div className="proposal-applicants-list">
                  {proponentes.map((p) => {
                    const linkedClient = !!((p.cliente_id && p.cliente_id === proposta.cliente?.id) || (p.cpf_cnpj && p.cpf_cnpj.replace(/\D/g, '') === (proposta.cliente?.cnpj || proposta.cliente?.cpf || '').replace(/\D/g, '')))
                    const client = linkedClient ? proposta.cliente : null
                    return (
                      <article className="proposal-applicant" key={p.id}>
                        <div className="proposal-person-heading">
                          <span className="proposal-avatar" aria-hidden="true">{p.nome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}</span>
                          <div className="proposal-person-identity"><div><h3>{p.nome}</h3>{p.principal && <span className="proposal-principal">Principal</span>}</div><p>{p.pessoa_tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}{p.relacao ? ` · ${{ conjuge: 'Cônjuge', socio: 'Sócio', outro: 'Outro' }[p.relacao] || p.relacao}` : ''}</p></div>
                        </div>
                        <dl className="proposal-details proposal-applicant-details">
                          <Row copy k="CPF/CNPJ" v={maskCpfCnpj(p.pessoa_tipo === 'PF' ? p.cpf_cnpj : null, p.pessoa_tipo === 'PJ' ? p.cpf_cnpj : null)} />
                          <Row k="Data de nascimento" v={client?.data_nascimento ? formatDateBr(client.data_nascimento) : '—'} />
                          <Row k="Estado civil" v={p.estado_civil ? ({ solteiro: 'Solteiro(a)', casado: 'Casado(a)', divorciado: 'Divorciado(a)', viuvo: 'Viúvo(a)', uniao_estavel: 'União estável' }[p.estado_civil] || p.estado_civil) : '—'} />
                          <Row k="Composição de renda" v={p.compoe_renda === true ? 'Compõe renda' : p.compoe_renda === false ? 'Não compõe renda' : '—'} />
                          <Row copy k="E-mail" v={client?.email || client?.email_responsavel || '—'} />
                          <Row copy k="Telefone" v={client?.telefone || client?.celular_comercial || '—'} />
                          <Row k="Modelo de renda" v={p.modelo_renda ? MODELO_RENDA_LABEL[p.modelo_renda] ?? p.modelo_renda : '—'} />
                          <Row k="Renda declarada" v={p.renda_mensal != null ? brl(Number(p.renda_mensal) * 100) : '—'} />
                        </dl>
                        <div className="proposal-registration-note"><FileText className="h-4 w-4" /><span>Dados declarados no cadastro da proposta.</span></div>
                      </article>
                    )
                  })}
                </div>
              </section>
              <aside className="proposal-applicant-aside" aria-label="Informações complementares do proponente principal">
                <section className="card proposal-analysis-section">
                  <div className="proposal-section-heading"><h2>Análise cadastral</h2><ShieldCheck className="h-4 w-4" /></div>
                  <div className="proposal-score-empty" aria-label="Score não disponível"><div><ShieldCheck className="h-7 w-7" /><span>Sem score</span></div></div>
                  <div className="proposal-analysis-copy"><span className="proposal-neutral-badge">Consulta não exibida</span><p>Consulte os resultados disponíveis na aba Consultas.</p></div>
                  <dl className="proposal-analysis-facts"><Row k="Classificação da operação" v={proposta.classificacao_lead ? LEAD_CLASS_LABEL[proposta.classificacao_lead] || proposta.classificacao_lead : 'Não classificada'} /><Row k="Responsável pela análise" v={proposta.responsavel?.nome_completo || 'Não atribuído'} /></dl>
                  <button type="button" className="btn-outline proposal-aside-action" onClick={() => setTab('Consultas')}><Search className="h-3.5 w-3.5" /> Ver consultas</button>
                </section>
                <section className="card proposal-address-section">
                  <div className="proposal-section-heading"><h2>Endereço do principal</h2><MapPin className="h-4 w-4" /></div>
                  {(() => {
                    const principal = proponentes.find(p => p.principal)
                    return principal && [principal.endereco_logradouro, principal.endereco_cidade, principal.endereco_cep].some(Boolean) ? <address className="proposal-address"><strong>{[principal.endereco_logradouro, principal.endereco_numero].filter(Boolean).join(', ')}</strong>{principal.endereco_complemento && <span>{principal.endereco_complemento}</span>}<span>{[principal.endereco_bairro, [principal.endereco_cidade, principal.endereco_estado].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span>{principal.endereco_cep && <span>CEP {principal.endereco_cep}</span>}</address> : <p className="proposal-address-empty">Endereço ainda não informado no cadastro do proponente principal.</p>
                  })()}
                </section>
              </aside>
            </>
          )}
          </div>
        </div>
      )}

      {tab === 'Imóveis' && (
        <div className="space-y-3">
          {canEdit && imoveis && imoveis.length > 0 && (
            <div className="flex justify-end gap-2">
              {editImoveis ? (
                <>
                  <button className="btn-outline text-xs" onClick={addImovelNovo} disabled={updateCamposMut.isPending}>
                    <Plus className="mr-1 inline h-3.5 w-3.5" /> Adicionar imóvel
                  </button>
                  <button className="btn-outline text-xs" onClick={() => { setEditImoveis(false); setImoveisError(null) }} disabled={updateCamposMut.isPending}>
                    <X className="mr-1 inline h-3.5 w-3.5" /> Cancelar
                  </button>
                  <button className="btn-gold text-xs" onClick={saveImoveis} disabled={updateCamposMut.isPending}>
                    {updateCamposMut.isPending ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 inline h-3.5 w-3.5" />}
                    Salvar
                  </button>
                </>
              ) : (
                <button
                  className="btn-outline text-xs"
                  onClick={() => { setImoveisForm(imoveis.map((i) => ({ ...i }))); setEditImoveis(true) }}
                >
                  <Pencil className="mr-1 inline h-3.5 w-3.5" /> Editar
                </button>
              )}
            </div>
          )}
          {imoveisError && (
            <p className="inline-flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3 w-3" /> {imoveisError}
            </p>
          )}
          {updateCamposMut.error && (
            <p className="inline-flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3 w-3" /> {(updateCamposMut.error as Error).message}
            </p>
          )}
          {imoveis && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">Valor total das garantias</p>
                <p className="mt-1 text-lg font-semibold text-navy">{formatReais(valorImoveisAba)}</p>
                {editImoveis && <p className="mt-1 text-xs text-silver-500">Soma atualizada conforme os valores editados.</p>}
              </div>
              <div className="card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">{editImoveis ? 'LTV estimado' : 'LTV'}</p>
                <p className={`mt-1 text-lg font-semibold ${ltvImoveisAba > 0.6 ? 'text-danger' : 'text-success'}`}>
                  {(ltvImoveisAba * 100).toFixed(1)}%
                </p>
                {editImoveis && <p className="mt-1 text-xs text-silver-500">Calculado sobre o valor solicitado e a soma de todos os imóveis.</p>}
              </div>
            </div>
          )}
          <div className="card overflow-x-auto">
          {imoveisQueryError ? (<p role="alert" className="p-5 text-sm text-danger">Não foi possível carregar os imóveis. Tente novamente.</p>) : !imoveis ? (
            <div className="p-10 text-center text-sm text-silver-500">Carregando…</div>
          ) : imoveis.length === 0 ? (
            <div className="p-10 text-center text-sm text-silver-500">Sem imóveis.</div>
          ) : editImoveis ? (
            <table className="w-full text-sm">
              <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
                <tr><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Logradouro</th><th className="px-4 py-3">Número</th><th className="px-4 py-3">Bairro</th><th className="px-4 py-3">Cidade</th><th className="px-4 py-3">UF</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody>
                {imoveisForm.map((i, idx) => (
                  <tr key={i.id} className="border-t border-silver-100">
                    <td className="px-4 py-3">
                      <select className="input" value={i.tipo} onChange={(e) => setImoveisForm(imoveisForm.map((x, j) => j === idx ? { ...x, tipo: e.target.value } : x))}>
                        <option value="apartamento">Apartamento</option>
                        <option value="casa">Casa</option>
                        <option value="comercial">Comercial</option>
                        <option value="terreno">Terreno</option>
                        <option value="vaga">Vaga</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input className="input" value={i.logradouro ?? ''} onChange={(e) => setImoveisForm(imoveisForm.map((x, j) => j === idx ? { ...x, logradouro: e.target.value } : x))} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="input" value={i.numero ?? ''} onChange={(e) => setImoveisForm(imoveisForm.map((x, j) => j === idx ? { ...x, numero: e.target.value } : x))} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="input" value={i.bairro ?? ''} onChange={(e) => setImoveisForm(imoveisForm.map((x, j) => j === idx ? { ...x, bairro: e.target.value } : x))} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="input" value={i.cidade ?? ''} onChange={(e) => setImoveisForm(imoveisForm.map((x, j) => j === idx ? { ...x, cidade: e.target.value } : x))} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="input" maxLength={2} value={i.estado ?? ''} onChange={(e) => setImoveisForm(imoveisForm.map((x, j) => j === idx ? { ...x, estado: e.target.value.toUpperCase() } : x))} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        className="input text-right"
                        type="text"
                        inputMode="numeric"
                        aria-label={`Valor do imóvel ${idx + 1}`}
                        value={formatReais(Number(i.valor))}
                        onChange={(e) => setImoveisForm(imoveisForm.map((x, j) => j === idx ? { ...x, valor: parseReaisInput(e.target.value) } : x))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {i._novo && (
                        <button type="button" className="text-xs text-danger hover:underline" onClick={() => removeImovelNovo(idx)}>
                          Remover
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="proposal-properties">
              {imoveis.map((i) => (
                <article className="proposal-property" key={i.id}>
                  <div className="proposal-property__visual"><Building2 aria-hidden="true" className="h-9 w-9" /><span>{i.tipo.replace(/_/g, ' ')}</span></div>
                  <div className="proposal-property__body"><div className="proposal-person-heading"><h3>{[i.logradouro, i.numero].filter(Boolean).join(', ') || 'Endereço não informado'}</h3>{i.principal && <span className="proposal-principal">Principal</span>}</div>
                    <p>{[i.bairro, i.cidade, i.estado].filter(Boolean).join(' · ') || 'Localização não informada'}</p>
                    <dl className="proposal-details"><Row k="Tipo" v={i.tipo.replace(/_/g, ' ')} /><Row k="Valor informado" v={i.valor != null ? brl(Number(i.valor) * 100) : '—'} /></dl>
                  </div>
                </article>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {tab === 'Documentos' && id && (
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Checklist de documentos</h3>
            {(() => {
              const checklist = buildChecklist((docs ?? []) as DocRowLite[], requisitos)
              if (checklist.length === 0) {
                return <div className="p-4 text-center text-sm text-silver-500">Checklist ainda não gerado.</div>
              }
              const grupos = (['pessoa_fisica', 'pessoa_juridica', 'imovel'] as DocCategoria[])
                .map((cat) => [cat, checklist.filter((i) => i.categoria === cat)] as const)
                .filter(([, items]) => items.length > 0)
              return (
                <div className="space-y-4">
                  {grupos.map(([cat, items]) => (
                    <div key={cat}>
                      <p className="mb-1 text-xs font-semibold text-silver-500">{CATEGORIA_LABEL[cat]}</p>
                      <div className="flex flex-wrap gap-2">
                        {items.map((i) => (
                          <span
                            key={`${i.categoria}-${i.tipo}`}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                              i.status === 'aprovado' ? 'bg-success/10 text-success'
                              : i.status === 'enviado' ? 'bg-navy/10 text-navy'
                              : i.status === 'rejeitado' ? 'bg-danger/10 text-danger'
                              : 'bg-warning/10 text-warning'
                            }`}
                          >
                            {TIPO_LABEL[i.tipo] || i.tipo}{i.obrigatorio ? ' *' : ''} · {DOC_STATUS_LABEL[i.status]}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Validação de documentos</h3>
            {documentoVisualizacaoError && (
              <div role="alert" className="mb-3 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                {documentoVisualizacaoError}
              </div>
            )}
            {(() => {
              const reais = (docs ?? []).filter((d) => d.storage_path)
              if (!docs) return <div className="p-6 text-center text-sm text-silver-500">Carregando…</div>
              if (reais.length === 0) return <div className="p-6 text-center text-sm text-silver-500">Sem documentos enviados.</div>
              return (
              <ul className="space-y-2">
                {reais.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-silver-100 p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-silver-900">
                        {TIPO_LABEL[d.tipo] || d.tipo}
                        {d.validado && <span className="ml-2 badge bg-success/15 text-success">Aprovado</span>}
                        {!d.validado && <span className="ml-2 badge bg-warning/15 text-warning">Em análise</span>}
                      </p>
                      <p className="text-xs text-silver-500">
                        {d.categoria} · {d.origem || '—'} · {new Date(d.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-outline inline-flex items-center gap-1"
                        disabled={documentoAbrindoId === d.id}
                        onClick={() => void handleVisualizarDocumento(d)}
                      >
                        {documentoAbrindoId === d.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Eye className="h-4 w-4" />}
                        {documentoAbrindoId === d.id ? 'Abrindo…' : 'Visualizar'}
                      </button>
                      {!isAdminJuridico && (
                        !d.validado ? (
                          <button
                            className="btn-gold inline-flex items-center gap-1"
                            disabled={validarMut.isPending}
                            onClick={() => validarMut.mutate({ docId: d.id, validado: true })}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Aprovar
                          </button>
                        ) : (
                          <button
                            className="btn-outline inline-flex items-center gap-1"
                            disabled={validarMut.isPending}
                            onClick={() => validarMut.mutate({ docId: d.id, validado: false })}
                          >
                            <XCircle className="h-4 w-4" /> Reabrir
                          </button>
                        )
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              )
            })()}
          </div>

          <PropostaDocsUploader propostaId={id} origem="parceiro" onChange={() => qc.invalidateQueries({ queryKey: ['admin-proposta-docs', id] })} />
        </div>
      )}

      {tab === 'Pendências' && id && (
        <PropostaPendencias propostaId={id} role="admin" />
      )}

      {tab === 'Consultas' && id && (
        <PropostaConsultas propostaId={id} />
      )}

      {tab === 'Contrato' && id && (
        <PropostaContrato propostaId={id} role="admin" adminNivel={session?.adminNivel} />
      )}

      {tab === 'Financeiro' && id && (
        <PropostaCondicaoComercial propostaId={id} valorSugerido={valor} canEdit={canEdit} />
      )}

      {tab === 'Histórico' && (
        <div className="space-y-4">
          {canEdit && proposta && ['pagamento_comissao', 'completo'].includes(proposta.status) && <div className="card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-silver-500">Corrigir entrada em Pagamento de Comissão</h3>
            <p className="mt-1 text-xs text-silver-600">Use somente quando a data real não estiver no histórico. A correção não muda o status atual.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
              <label className="text-xs font-medium text-silver-600">Data real<input className="input mt-1" type="date" value={dataComissao} onChange={e => setDataComissao(e.target.value)} /></label>
              <label className="text-xs font-medium text-silver-600">Motivo<input className="input mt-1" minLength={5} value={motivoComissao} onChange={e => setMotivoComissao(e.target.value)} placeholder="Ex.: conferido no comprovante" /></label>
              <button className="btn-gold" disabled={!dataComissao || motivoComissao.trim().length < 5 || comissaoHistoricaMut.isPending} onClick={() => comissaoHistoricaMut.mutate()}>Registrar correção</button>
            </div>
            {comissaoHistoricaMut.error && <p className="mt-2 text-xs text-danger">{comissaoHistoricaMut.error.message}</p>}
          </div>}
          <label className="block text-xs text-silver-600">Buscar no histórico<input className="input mt-2" type="search" value={buscaHistorico} onChange={e => setBuscaHistorico(e.target.value)} placeholder="Status, motivo ou data" /></label>
          <div className="card overflow-x-auto">
          {historicoError ? (<p role="alert" className="p-5 text-sm text-danger">Não foi possível carregar o histórico. Tente novamente.</p>) : !historico ? (
            <div className="p-10 text-center text-sm text-silver-500">Carregando…</div>
          ) : historico.length === 0 ? (
            <div className="p-10 text-center text-sm text-silver-500">Sem alterações de status.</div>
          ) : historicoFiltrado.length === 0 ? (
            <p className="p-10 text-center text-sm text-silver-500">Nenhum evento corresponde à busca.</p>
          ) : (
            <ol className="space-y-3 p-4">
              {historicoFiltrado.map((h) => (
                <li key={h.id} className="flex items-start gap-3 border-l-2 border-gold/40 pl-4">
                  <div className="flex-1">
                    <p className="text-sm">
                      {h.status_anterior ? (
                        <><span className="text-silver-500">{STATUS_LABEL[h.status_anterior] || h.status_anterior}</span> → </>
                      ) : null}
                      <b className="text-navy">{STATUS_LABEL[h.status_novo] || h.status_novo}</b>
                    </p>
                    {h.metadata?.correcao_historica === true && <p className="text-xs font-medium text-red-700">Correção histórica da data de entrada em comissão</p>}
                    {h.motivo && <p className="text-xs text-silver-600">{h.motivo}</p>}
                    <p className="mt-1 text-xs text-silver-500">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 proposal-section ${className}`}>
      <h3>{title}</h3>
      <dl className="space-y-3 text-sm">{children}</dl>
    </section>
  )
}

function Row({ k, v, copy = false }: { k: string; v: React.ReactNode; copy?: boolean }) {
  const [copyStatus, setCopyStatus] = useState('')
  async function copyValue() {
    try {
      await navigator.clipboard.writeText(String(v))
      setCopyStatus('Copiado')
    } catch {
      setCopyStatus('Não foi possível copiar')
    }
  }
  return (
    <div className="flex items-center justify-between border-b border-silver-100 pb-2 last:border-0">
      <dt className="text-silver-600">{k}</dt>
      <dd className={`font-medium text-silver-900${copy ? ' proposal-copy-value' : ''}`}>{v}{copy && typeof v === 'string' && v !== '—' && <button type="button" className="btn-no-liquid proposal-copy-button" onClick={() => void copyValue()} aria-label={`Copiar ${k}`}><Copy className="h-3 w-3" /></button>}{copyStatus && <span className="proposal-copy-status" role="status">{copyStatus}</span>}</dd>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}
