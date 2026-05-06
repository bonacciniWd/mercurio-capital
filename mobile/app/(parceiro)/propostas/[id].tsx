import { useState } from 'react'
import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import {
  ArrowLeft, FileText, Users, Home, Clock, MessageSquare, ChevronRight,
  TrendingUp, Shield, Calendar, CheckCircle2, AlertCircle, XCircle,
  MapPin, Ruler, Building2, User, Phone, Mail, Briefcase,
} from 'lucide-react-native'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'

const TABS = [
  { id: 'resumo', label: 'Resumo', icon: FileText },
  { id: 'proponentes', label: 'Proponentes', icon: Users },
  { id: 'imoveis', label: 'Imóveis', icon: Home },
  { id: 'docs', label: 'Documentos', icon: FileText },
  { id: 'historico', label: 'Histórico', icon: Clock },
] as const

export default function PropostaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [tab, setTab] = useState<typeof TABS[number]['id']>('resumo')

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      {/* Header */}
      <View className="bg-navy-700 px-5 pb-4 pt-2">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="font-mono text-xs text-white/50">{id}</Text>
            <Text className="text-lg font-bold text-white">João Silva</Text>
          </View>
          <StatusBadge status="Análise de Crédito" />
        </View>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-xl bg-white/10 px-4 py-3">
            <Text className="text-[11px] uppercase tracking-wider text-white/50">Valor solicitado</Text>
            <Text className="mt-0.5 text-xl font-bold text-white">{brl(35000000)}</Text>
          </View>
          <View className="flex-1 rounded-xl bg-white/10 px-4 py-3">
            <Text className="text-[11px] uppercase tracking-wider text-white/50">LTV</Text>
            <Text className="mt-0.5 text-xl font-bold text-gold">48%</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-12 border-b border-white/10 bg-navy">
        <View className="flex-row px-3">
          {TABS.map(t => (
            <Pressable key={t.id} onPress={() => setTab(t.id)}
              className={`flex-row items-center gap-1.5 border-b-2 px-4 py-3 ${tab === t.id ? 'border-gold' : 'border-transparent'}`}>
              <t.icon size={15} color={tab === t.id ? '#DC2626' : 'rgba(255,255,255,0.4)'} />
              <Text className={tab === t.id ? 'text-sm font-semibold text-gold' : 'text-sm text-white/40'}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
        {tab === 'resumo'      && <Resumo />}
        {tab === 'proponentes' && <Proponentes />}
        {tab === 'imoveis'     && <Imoveis />}
        {tab === 'docs'        && <Documentos />}
        {tab === 'historico'   && <Historico />}
      </ScrollView>

      {/* Bottom action */}
      <View className="flex-row gap-3 border-t border-silver-200 bg-white px-4 py-3">
        <Pressable className="flex-row items-center justify-center gap-2 rounded-xl border border-silver-200 bg-silver-50 px-5 py-3">
          <MessageSquare size={17} color="#0F0F0F" />
          <Text className="font-semibold text-navy">Mensagem</Text>
        </Pressable>
        <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-gold py-3">
          <Text className="font-bold text-white">Avançar etapa</Text>
          <ChevronRight size={17} color="white" />
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

// ─── Tab: Resumo ────────────────────────────────────────────────────────────
function Resumo() {
  return (
    <>
      <Card title="Crédito" icon={<TrendingUp size={15} color="#DC2626" />}>
        <Row label="Valor solicitado" value={brl(35000000)} highlight />
        <Row label="Prazo" value="180 meses" />
        <Row label="Taxa" value="1,15% a.m." />
        <Row label="LTV" value="48%" />
      </Card>
      <Card title="Imóvel garantia" icon={<Home size={15} color="#DC2626" />}>
        <Row label="Endereço" value="Av. Paulista, 1234 — SP" />
        <Row label="Valor de avaliação" value={brl(72500000)} highlight />
      </Card>
      <Card title="Proponente principal" icon={<Shield size={15} color="#DC2626" />}>
        <Row label="Nome" value="João Silva" />
        <Row label="CPF" value="123.456.789-00" />
        <Row label="Renda mensal" value={brl(2500000)} highlight />
      </Card>
      <Card title="Prazos" icon={<Calendar size={15} color="#DC2626" />}>
        <Row label="Enviado em" value="12/03/2024" />
        <Row label="Última atualização" value="28/04/2026" />
        <Row label="Previsão de conclusão" value="15/05/2026" />
      </Card>
    </>
  )
}

// ─── Tab: Proponentes ───────────────────────────────────────────────────────
const PROPONENTES = [
  { nome: 'João Silva', cpf: '123.456.789-00', tipo: 'Titular', email: 'joao@email.com', telefone: '(11) 99999-0001', profissao: 'Empresário', renda: 2500000, participacao: '70%' },
  { nome: 'Maria Silva', cpf: '987.654.321-00', tipo: 'Cônjuge', email: 'maria@email.com', telefone: '(11) 99999-0002', profissao: 'Médica', renda: 1800000, participacao: '30%' },
]

function Proponentes() {
  return (
    <>
      {PROPONENTES.map((p) => (
        <Card key={p.cpf} title={p.tipo} icon={<User size={15} color="#DC2626" />}>
          <Row label="Nome" value={p.nome} highlight />
          <Row label="CPF" value={p.cpf} />
          <Row label="Profissão" value={p.profissao} />
          <Row label="Renda mensal" value={brl(p.renda)} highlight />
          <Row label="Participação" value={p.participacao} />
          <View className="mt-3 flex-row gap-2 pb-2">
            <View className="flex-1 flex-row items-center gap-1.5 rounded-lg bg-silver-50 px-3 py-2">
              <Phone size={13} color="#6B7280" />
              <Text className="text-xs text-silver-600">{p.telefone}</Text>
            </View>
            <View className="flex-1 flex-row items-center gap-1.5 rounded-lg bg-silver-50 px-3 py-2">
              <Mail size={13} color="#6B7280" />
              <Text className="text-xs text-silver-600" numberOfLines={1}>{p.email}</Text>
            </View>
          </View>
        </Card>
      ))}
    </>
  )
}

// ─── Tab: Imóveis ───────────────────────────────────────────────────────────
function Imoveis() {
  return (
    <>
      <Card title="Imóvel garantia" icon={<Building2 size={15} color="#DC2626" />}>
        <Row label="Tipo" value="Apartamento" />
        <Row label="Matrícula" value="12.345-SP" />
        <Row label="Área total" value="142 m²" />
        <Row label="Área útil" value="128 m²" />
        <Row label="Valor de avaliação" value={brl(72500000)} highlight />
        <Row label="Valor de mercado" value={brl(75000000)} />
      </Card>
      <Card title="Localização" icon={<MapPin size={15} color="#DC2626" />}>
        <Row label="Endereço" value="Av. Paulista, 1234" />
        <Row label="Complemento" value="Apto 82" />
        <Row label="Bairro" value="Bela Vista" />
        <Row label="Cidade / UF" value="São Paulo — SP" />
        <Row label="CEP" value="01310-100" />
      </Card>
      <Card title="Características" icon={<Ruler size={15} color="#DC2626" />}>
        <Row label="Quartos" value="3" />
        <Row label="Suítes" value="1" />
        <Row label="Vagas" value="2" />
        <Row label="Ano de construção" value="2008" />
        <Row label="Padrão" value="Alto" />
      </Card>
    </>
  )
}

// ─── Tab: Documentos ────────────────────────────────────────────────────────
const DOCS = [
  { nome: 'RG / CNH — Titular', status: 'ok' },
  { nome: 'Comprovante de renda — Titular', status: 'ok' },
  { nome: 'Comprovante de residência', status: 'ok' },
  { nome: 'Certidão de nascimento / casamento', status: 'ok' },
  { nome: 'RG / CNH — Cônjuge', status: 'ok' },
  { nome: 'Comprovante de renda — Cônjuge', status: 'pendente' },
  { nome: 'Matrícula do imóvel (atualizada)', status: 'pendente' },
  { nome: 'IPTU vigente', status: 'pendente' },
  { nome: 'Laudo de avaliação', status: 'aguardando' },
] as const

const docIcon = (s: string) =>
  s === 'ok'
    ? <CheckCircle2 size={16} color="#16A34A" />
    : s === 'pendente'
    ? <AlertCircle size={16} color="#F59E0B" />
    : <XCircle size={16} color="#9CA3AF" />

const docLabel = (s: string) =>
  s === 'ok' ? 'Recebido' : s === 'pendente' ? 'Pendente' : 'Aguardando'

const docColor = (s: string) =>
  s === 'ok' ? 'text-success' : s === 'pendente' ? 'text-warning' : 'text-silver-400'

function Documentos() {
  const ok = DOCS.filter(d => d.status === 'ok').length
  return (
    <>
      <View className="flex-row gap-3">
        <View className="flex-1 rounded-xl bg-success/10 p-3">
          <Text className="text-2xl font-bold text-success">{ok}</Text>
          <Text className="text-xs text-success/80">Recebidos</Text>
        </View>
        <View className="flex-1 rounded-xl bg-warning/10 p-3">
          <Text className="text-2xl font-bold text-warning">{DOCS.filter(d => d.status === 'pendente').length}</Text>
          <Text className="text-xs text-warning/80">Pendentes</Text>
        </View>
        <View className="flex-1 rounded-xl bg-silver-100 p-3">
          <Text className="text-2xl font-bold text-silver-500">{DOCS.filter(d => d.status === 'aguardando').length}</Text>
          <Text className="text-xs text-silver-500">Aguardando</Text>
        </View>
      </View>

      <Card title="Lista de documentos" icon={<FileText size={15} color="#DC2626" />}>
        {DOCS.map((d, i) => (
          <View key={i} className="flex-row items-center justify-between border-b border-silver-100 py-3 last:border-b-0">
            <View className="mr-3 flex-1 flex-row items-center gap-2">
              {docIcon(d.status)}
              <Text className="flex-1 text-sm text-silver-700">{d.nome}</Text>
            </View>
            <Text className={`text-xs font-semibold ${docColor(d.status)}`}>{docLabel(d.status)}</Text>
          </View>
        ))}
      </Card>
    </>
  )
}

// ─── Tab: Histórico ─────────────────────────────────────────────────────────
const EVENTOS = [
  { data: '28/04/2026', hora: '14:32', titulo: 'Encaminhada para Análise de Crédito', desc: 'Pré-análise aprovada. Aguardando parecer da equipe de crédito.', tipo: 'avanço' },
  { data: '15/04/2026', hora: '09:10', titulo: 'Documentação validada', desc: 'Todos os documentos obrigatórios da etapa foram conferidos.', tipo: 'ok' },
  { data: '10/04/2026', hora: '16:45', titulo: 'Pendência resolvida', desc: 'Comprovante de residência atualizado enviado pelo cliente.', tipo: 'ok' },
  { data: '05/04/2026', hora: '11:00', titulo: 'Pendência aberta', desc: 'Solicitado comprovante de residência dos últimos 90 dias.', tipo: 'alerta' },
  { data: '12/03/2024', hora: '08:22', titulo: 'Proposta criada', desc: 'Proposta cadastrada pelo parceiro João Roberto (MC-0042).', tipo: 'neutro' },
] as const

const evColor = (t: string) =>
  t === 'avanço' ? '#DC2626' : t === 'ok' ? '#16A34A' : t === 'alerta' ? '#F59E0B' : '#9CA3AF'

function Historico() {
  return (
    <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
      <View className="flex-row items-center gap-2 border-b border-silver-100 bg-silver-50 px-4 py-3">
        <Clock size={15} color="#DC2626" />
        <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">Linha do tempo</Text>
      </View>
      {EVENTOS.map((e, i) => (
        <View key={i} className="flex-row gap-3 px-4 py-4">
          {/* linha + dot */}
          <View className="items-center" style={{ width: 20 }}>
            <View className="h-3 w-3 rounded-full" style={{ backgroundColor: evColor(e.tipo) }} />
            {i < EVENTOS.length - 1 && <View className="mt-1 w-px flex-1 bg-silver-200" />}
          </View>
          {/* conteúdo */}
          <View className="flex-1 pb-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-navy">{e.titulo}</Text>
            </View>
            <Text className="mt-0.5 text-xs text-silver-400">{e.data} às {e.hora}</Text>
            <Text className="mt-1.5 text-xs leading-relaxed text-silver-600">{e.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── Shared components ───────────────────────────────────────────────────────
function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
      <View className="flex-row items-center gap-2 border-b border-silver-100 bg-silver-50 px-4 py-3">
        {icon}
        <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">{title}</Text>
      </View>
      <View className="px-4 pb-2 pt-1">{children}</View>
    </View>
  )
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-row items-center justify-between border-b border-silver-100 py-3 last:border-b-0">
      <Text className="text-sm text-silver-500">{label}</Text>
      <Text className={`text-sm font-semibold ${highlight ? 'text-navy' : 'text-silver-700'}`}>{value}</Text>
    </View>
  )
}

