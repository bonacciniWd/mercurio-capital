import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, TrendingUp, SlidersHorizontal, Shield, Save, CheckCircle2, AlertTriangle } from 'lucide-react-native'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'empresa',   label: 'Empresa',   icon: Building2 },
  { id: 'metas',     label: 'Metas',     icon: TrendingUp },
  { id: 'seguranca', label: 'Segurança', icon: Shield },
  { id: 'sistema',   label: 'Sistema',   icon: SlidersHorizontal },
] as const

type TabId = typeof TABS[number]['id']

interface Empresa {
  razao_social?: string
  nome_fantasia?: string
  cnpj?: string
  inscricao_estadual?: string
  endereco?: string
  email?: string
  telefone?: string
}

interface ConfigRow { chave: string; valor: unknown; descricao: string | null }

export default function Configuracoes() {
  const [tab, setTab] = useState<TabId>('empresa')

  const configQuery = useQuery({
    queryKey: ['admin-config-sistema'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes_sistema')
        .select('chave, valor, descricao')
      if (error) throw error
      const map: Record<string, ConfigRow> = {}
      for (const r of (data ?? []) as ConfigRow[]) map[r.chave] = r
      return map
    },
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Configurações</Text>
        </View>
      </View>

      <View style={s.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <Pressable key={t.id} onPress={() => setTab(t.id)} style={[s.tabPill, active && s.tabPillActive]}>
                <t.icon size={13} color={active ? '#fff' : '#737373'} />
                <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {configQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            {tab === 'empresa' && <EmpresaTab initial={(configQuery.data?.empresa?.valor ?? {}) as Empresa} />}
            {tab === 'metas' && <MetasTab initialCentavos={Number((configQuery.data?.meta_volume_mensal?.valor as { centavos?: number } | undefined)?.centavos ?? 50_000_000_000)} />}
            {tab === 'seguranca' && <SegurancaTab config={configQuery.data ?? {}} />}
            {tab === 'sistema' && <SistemaTab config={configQuery.data ?? {}} />}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

function Feedback({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return (
    <View style={[s.feedback, { backgroundColor: msg.ok ? '#16A34A18' : '#DC262618' }]}>
      {msg.ok ? <CheckCircle2 size={14} color="#16A34A" /> : <AlertTriangle size={14} color="#DC2626" />}
      <Text style={[s.feedbackText, { color: msg.ok ? '#16A34A' : '#DC2626' }]}>{msg.text}</Text>
    </View>
  )
}

function EmpresaTab({ initial }: { initial: Empresa }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Empresa>(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { setForm(initial) }, [initial])

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('configuracoes_sistema')
        .upsert({ chave: 'empresa', valor: form }, { onConflict: 'chave' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-config-sistema'] })
      setMsg({ ok: true, text: 'Dados da empresa salvos.' })
      setTimeout(() => setMsg(null), 3000)
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  function set<K extends keyof Empresa>(k: K, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setMsg(null)
  }

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Dados da empresa</Text>
      <Input label="Razão social" value={form.razao_social ?? ''} onChange={t => set('razao_social', t)} />
      <Input label="Nome fantasia" value={form.nome_fantasia ?? ''} onChange={t => set('nome_fantasia', t)} />
      <Input label="CNPJ" value={form.cnpj ?? ''} onChange={t => set('cnpj', t)} placeholder="00.000.000/0001-00" keyboardType="numbers-and-punctuation" />
      <Input label="Inscrição estadual" value={form.inscricao_estadual ?? ''} onChange={t => set('inscricao_estadual', t)} />
      <Input label="Endereço" value={form.endereco ?? ''} onChange={t => set('endereco', t)} placeholder="Av. Paulista, 1000 — SP" />
      <Input label="E-mail de contato" value={form.email ?? ''} onChange={t => set('email', t)} placeholder="contato@mercuriocapitalsa.com.br" keyboardType="email-address" autoCapitalize="none" />
      <Input label="Telefone" value={form.telefone ?? ''} onChange={t => set('telefone', t)} placeholder="(11) 3000-0000" keyboardType="phone-pad" />
      <Feedback msg={msg} />
      <Pressable style={[s.saveBtn, saveMut.isPending && { opacity: 0.6 }]} onPress={() => saveMut.mutate()} disabled={saveMut.isPending}>
        {saveMut.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Save size={15} color="#fff" />}
        <Text style={s.saveBtnText}>Salvar</Text>
      </Pressable>
    </View>
  )
}

function MetasTab({ initialCentavos }: { initialCentavos: number }) {
  const qc = useQueryClient()
  const [inputVal, setInputVal] = useState(String(Math.round(initialCentavos / 100)))
  const [centavos, setCentavos] = useState(initialCentavos)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    setCentavos(initialCentavos)
    setInputVal(String(Math.round(initialCentavos / 100)))
  }, [initialCentavos])

  const saveMut = useMutation({
    mutationFn: async () => {
      const reais = Number(inputVal.replace(/\./g, '').replace(',', '.'))
      if (isNaN(reais) || reais <= 0) throw new Error('Valor inválido.')
      const novo = Math.round(reais * 100)
      const { error } = await supabase
        .from('configuracoes_sistema')
        .upsert({ chave: 'meta_volume_mensal', valor: { centavos: novo } }, { onConflict: 'chave' })
      if (error) throw error
      return novo
    },
    onSuccess: (novo) => {
      setCentavos(novo)
      qc.invalidateQueries({ queryKey: ['admin-config-sistema'] })
      setMsg({ ok: true, text: 'Meta atualizada com sucesso.' })
      setTimeout(() => setMsg(null), 3000)
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Metas do dashboard</Text>
      <Text style={s.cardDesc}>Define a barra de progresso de volume ganho no backoffice (mobile e web).</Text>
      <Input
        label="Meta de volume mensal (R$)"
        value={inputVal}
        onChange={t => { setInputVal(t.replace(/[^\d]/g, '')); setMsg(null) }}
        placeholder="500000000"
        keyboardType="number-pad"
        mono
      />
      <Text style={s.hint}>Valor atual: <Text style={s.hintStrong}>{brl(centavos)}</Text></Text>
      <Feedback msg={msg} />
      <Pressable style={[s.saveBtn, saveMut.isPending && { opacity: 0.6 }]} onPress={() => saveMut.mutate()} disabled={saveMut.isPending}>
        {saveMut.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Save size={15} color="#fff" />}
        <Text style={s.saveBtnText}>Salvar meta</Text>
      </Pressable>
    </View>
  )
}

function SegurancaTab({ config }: { config: Record<string, ConfigRow> }) {
  const qc = useQueryClient()
  const get = (chave: string, fallback: string) => {
    const v = config[chave]?.valor
    if (v === undefined || v === null) return fallback
    return String(v).replace(/\D/g, '') || fallback
  }
  const rl = (config['rate_limit_login']?.valor ?? {}) as { max?: number; janela_min?: number }
  const [senhaMin, setSenhaMin] = useState(get('senha_min_length', '8'))
  const [idleAdmin, setIdleAdmin] = useState(get('sessao_idle_admin_min', '30'))
  const [idleGeral, setIdleGeral] = useState(get('sessao_idle_geral_min', '480'))
  const [rlMax, setRlMax] = useState(String(rl.max ?? 5))
  const [rlJanela, setRlJanela] = useState(String(rl.janela_min ?? 15))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    setSenhaMin(get('senha_min_length', '8'))
    setIdleAdmin(get('sessao_idle_admin_min', '30'))
    setIdleGeral(get('sessao_idle_geral_min', '480'))
    const r = (config['rate_limit_login']?.valor ?? {}) as { max?: number; janela_min?: number }
    setRlMax(String(r.max ?? 5))
    setRlJanela(String(r.janela_min ?? 15))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  const saveMut = useMutation({
    mutationFn: async () => {
      const sm = Number(senhaMin), ia = Number(idleAdmin), ig = Number(idleGeral)
      const rm = Number(rlMax), rj = Number(rlJanela)
      if ([sm, ia, ig, rm, rj].some(n => isNaN(n) || n <= 0)) throw new Error('Preencha valores numéricos positivos.')
      if (sm < 6) throw new Error('O mínimo de senha não pode ser menor que 6.')
      const { error } = await supabase
        .from('configuracoes_sistema')
        .upsert([
          { chave: 'senha_min_length', valor: sm },
          { chave: 'sessao_idle_admin_min', valor: ia },
          { chave: 'sessao_idle_geral_min', valor: ig },
          { chave: 'rate_limit_login', valor: { max: rm, janela_min: rj } },
        ], { onConflict: 'chave' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-config-sistema'] })
      setMsg({ ok: true, text: 'Políticas de segurança salvas.' })
      setTimeout(() => setMsg(null), 3000)
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  return (
    <>
      <View style={s.card}>
        <Text style={s.cardTitle}>Senha</Text>
        <Input label="Tamanho mínimo de senha" value={senhaMin} onChange={t => { setSenhaMin(t.replace(/[^\d]/g, '')); setMsg(null) }} keyboardType="number-pad" mono />
        <Text style={s.hint}>Validado em cadastros, redefinição e onboarding (web e app).</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Sessão · logout por inatividade</Text>
        <Input label="Admin (minutos)" value={idleAdmin} onChange={t => { setIdleAdmin(t.replace(/[^\d]/g, '')); setMsg(null) }} keyboardType="number-pad" mono />
        <Input label="Demais perfis (minutos)" value={idleGeral} onChange={t => { setIdleGeral(t.replace(/[^\d]/g, '')); setMsg(null) }} keyboardType="number-pad" mono />
        <Text style={s.hint}>Encerra a sessão ao retornar após o período sem atividade.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Rate limit de login</Text>
        <Input label="Máx. tentativas falhas" value={rlMax} onChange={t => { setRlMax(t.replace(/[^\d]/g, '')); setMsg(null) }} keyboardType="number-pad" mono />
        <Input label="Janela (minutos)" value={rlJanela} onChange={t => { setRlJanela(t.replace(/[^\d]/g, '')); setMsg(null) }} keyboardType="number-pad" mono />
        <Text style={s.hint}>Bloqueia logins após muitas tentativas falhas (por e-mail; por IP usa 3× o limite).</Text>
        <Feedback msg={msg} />
        <Pressable style={[s.saveBtn, saveMut.isPending && { opacity: 0.6 }]} onPress={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Save size={15} color="#fff" />}
          <Text style={s.saveBtnText}>Salvar políticas</Text>
        </Pressable>
      </View>

      <View style={[s.card, { borderColor: '#16A34A40' }]}>
        <View style={s.statusRow}>
          <View style={s.statusBadge}><Text style={s.statusBadgeText}>ATIVO</Text></View>
          <Text style={s.statusTitle}>2FA obrigatório para admins</Text>
        </View>
        <Text style={s.statusDesc}>Exigido pelo servidor: ações sensíveis são bloqueadas por RLS sem 2FA verificado.</Text>
      </View>

      <View style={s.card}>
        <View style={s.statusRow}>
          <View style={[s.statusBadge, { backgroundColor: '#26262688' }]}><Text style={[s.statusBadgeText, { color: '#a3a3a3' }]}>AUTO</Text></View>
          <Text style={s.statusTitle}>Auditoria de ações</Text>
        </View>
        <Text style={s.statusDesc}>Propostas, contratos, comissões, parceiros e configurações são registrados em audit_log por triggers.</Text>
      </View>
    </>
  )
}

function SistemaTab({ config }: { config: Record<string, ConfigRow> }) {
  function val(chave: string): string {
    const v = config[chave]?.valor
    if (v === undefined || v === null) return '—'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }
  const rows: { label: string; chave: string; fmt?: (raw: string) => string }[] = [
    { label: 'Versão da plataforma', chave: 'versao_plataforma' },
    { label: 'Taxa de juros mensal (%)', chave: 'taxa_juros_mensal_default' },
    { label: 'Indexador padrão', chave: 'indexador_default' },
    { label: 'Prazo padrão (meses)', chave: 'prazo_padrao_meses' },
    { label: 'Prazo mínimo (meses)', chave: 'prazo_minimo_meses' },
    { label: 'Magic link TTL (min)', chave: 'magic_link_ttl_min' },
    { label: 'Alerta de saldo', chave: 'saldo_alerta_minimo', fmt: c => brl(Number(c)) },
    { label: 'Recarga mínima', chave: 'wallet_topup_minimo', fmt: c => brl(Number(c)) },
  ]
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Parâmetros do sistema</Text>
      <Text style={s.cardDesc}>Somente leitura. Editáveis via banco / migração.</Text>
      {rows.map((r, i) => {
        const raw = val(r.chave)
        const display = raw === '—' ? '—' : (r.fmt ? r.fmt(raw) : raw.replace(/^"|"$/g, ''))
        return (
          <View key={r.chave} style={[s.fieldRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#1f1f1f' }]}>
            <Text style={s.fieldLabel}>{r.label}</Text>
            <Text style={s.fieldValue}>{display}</Text>
          </View>
        )
      })}
    </View>
  )
}

function Input({
  label, value, onChange, placeholder, keyboardType, autoCapitalize, mono,
}: {
  label: string; value: string; onChange: (t: string) => void; placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad' | 'numbers-and-punctuation'
  autoCapitalize?: 'none' | 'sentences'; mono?: boolean
}) {
  return (
    <View style={s.inputWrap}>
      <Text style={s.inputLabel}>{label}</Text>
      <TextInput
        style={[s.input, mono && { fontFamily: 'monospace' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#525252"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
      />
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },

  tabsWrapper: { borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  tabsScroll: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#1c1c1c', borderWidth: 1, borderColor: '#2a2a2a' },
  tabPillActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#737373' },
  tabLabelActive: { color: '#fff' },

  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', padding: 16 },
  cardTitle: { fontSize: 10, letterSpacing: 1.2, color: '#525252', fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  cardDesc: { fontSize: 12, color: '#737373', marginBottom: 12, lineHeight: 17 },

  inputWrap: { marginTop: 12 },
  inputLabel: { fontSize: 11, color: '#737373', fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#e5e5e5', fontSize: 14 },

  hint: { fontSize: 12, color: '#525252', marginTop: 8 },
  hintStrong: { color: '#a3a3a3', fontWeight: '700' },

  feedback: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 },
  feedbackText: { fontSize: 12, fontWeight: '600', flex: 1 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 13, marginTop: 16 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  fieldRow: { paddingVertical: 11 },
  fieldLabel: { fontSize: 10, color: '#525252', fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#e5e5e5', marginTop: 3 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { backgroundColor: '#16A34A22', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statusBadgeText: { fontSize: 9, fontWeight: '800', color: '#16A34A', letterSpacing: 0.5 },
  statusTitle: { fontSize: 13, fontWeight: '700', color: '#e5e5e5' },
  statusDesc: { fontSize: 12, color: '#737373', marginTop: 8, lineHeight: 17 },
})
