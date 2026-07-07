import { ScrollView, View, Text, Pressable, TextInput, Switch, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Building2, Bell, Plug, ShieldCheck, ChevronRight } from 'lucide-react-native'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { usePartnerProfile, PARTNER_PROFILE_QUERY_KEY, partnerDisplayName, type PartnerProfile } from '@/lib/partner'

const TABS = [
  { id: 'Empresa',       icon: Building2 },
  { id: 'Notificações',  icon: Bell },
  { id: 'Integrações',   icon: Plug },
  { id: 'Segurança',     icon: ShieldCheck },
] as const
type Tab = typeof TABS[number]['id']

export default function ParceiroConfig() {
  const [active, setActive] = useState<Tab>('Empresa')

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <View className="bg-navy px-5 pb-5 pt-2">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-gold">Parceiro</Text>
            <Text className="text-lg font-bold text-white">Configurações</Text>
          </View>
        </View>

        <View className="mt-4 flex-row gap-2">
          {TABS.map(({ id: t, icon: Icon }) => (
            <Pressable
              key={t}
              onPress={() => setActive(t)}
              className="flex-1 items-center gap-1 rounded-xl py-2.5"
              style={{ backgroundColor: active === t ? '#DC2626' : 'rgba(255,255,255,0.1)' }}
            >
              <Icon size={16} color={active === t ? 'white' : 'rgba(255,255,255,0.5)'} />
              <Text
                className="text-[9px] font-semibold uppercase tracking-wide"
                style={{ color: active === t ? 'white' : 'rgba(255,255,255,0.5)' }}
                numberOfLines={1}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {active === 'Empresa'      && <Empresa />}
        {active === 'Notificações' && <Notif />}
        {active === 'Integrações'  && <Integracoes />}
        {active === 'Segurança'    && <Seguranca />}
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const onlyDigits = (s: string) => (s ?? '').replace(/\D+/g, '')

function formatCpfCnpj(s: string): string {
  const d = onlyDigits(s).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatCep(s: string): string {
  const d = onlyDigits(s).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

function formatPhone(s: string): string {
  const d = onlyDigits(s).slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3')
  return d.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3')
}

function getPartnerProfileSaveErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const normalized = raw.toLowerCase()

  if (
    normalized.includes('partners_cpf_key') ||
    normalized.includes('cpf/cnpj já está vinculado') ||
    (normalized.includes('duplicate key value') && normalized.includes('cpf'))
  ) {
    return 'CPF/CNPJ já está vinculado a outro parceiro.'
  }

  return raw
}

// ─── Empresa ────────────────────────────────────────────────────────────────
interface EmpresaForm {
  razao_social: string
  cpf: string
  website: string
  telefone: string
  endereco_cep: string
  endereco_logradouro: string
  endereco_numero: string
  endereco_complemento: string
  endereco_bairro: string
  endereco_cidade: string
  endereco_estado: string
}

function fromProfile(p: PartnerProfile | undefined): EmpresaForm {
  return {
    razao_social: p?.razao_social ?? '',
    cpf: formatCpfCnpj(p?.cpf ?? ''),
    website: p?.website ?? '',
    telefone: formatPhone(p?.telefone ?? ''),
    endereco_cep: formatCep(p?.endereco_cep ?? ''),
    endereco_logradouro: p?.endereco_logradouro ?? '',
    endereco_numero: p?.endereco_numero ?? '',
    endereco_complemento: p?.endereco_complemento ?? '',
    endereco_bairro: p?.endereco_bairro ?? '',
    endereco_cidade: p?.endereco_cidade ?? '',
    endereco_estado: p?.endereco_estado ?? '',
  }
}

function Empresa() {
  const profileQ = usePartnerProfile()
  const qc = useQueryClient()
  const [form, setForm] = useState<EmpresaForm>(fromProfile(undefined))

  useEffect(() => {
    if (profileQ.data) setForm(fromProfile(profileQ.data))
  }, [profileQ.data])

  const saveMut = useMutation({
    mutationFn: async () => {
      const cpfDigits = onlyDigits(form.cpf)
      const payload = {
        razao_social: form.razao_social,
        ...(cpfDigits ? { cpf: cpfDigits } : {}),
        website: form.website,
        telefone_ddi: profileQ.data?.telefone_ddi ?? '55',
        telefone: onlyDigits(form.telefone),
        endereco_cep: onlyDigits(form.endereco_cep),
        endereco_logradouro: form.endereco_logradouro,
        endereco_numero: form.endereco_numero,
        endereco_complemento: form.endereco_complemento,
        endereco_bairro: form.endereco_bairro,
        endereco_cidade: form.endereco_cidade,
        endereco_estado: form.endereco_estado.toUpperCase().slice(0, 2),
      }
      const { data, error } = await supabase.rpc('partner_update_profile', { p_payload: payload })
      if (error) throw error
      return data as PartnerProfile
    },
    onSuccess: (data) => {
      qc.setQueryData(PARTNER_PROFILE_QUERY_KEY, data)
      Alert.alert('Sucesso', 'Perfil atualizado.')
    },
    onError: (e: unknown) => Alert.alert('Erro', getPartnerProfileSaveErrorMessage(e)),
  })

  const profile = profileQ.data
  const initial = partnerDisplayName(profile).charAt(0).toUpperCase()

  if (profileQ.isLoading) return <ActivityIndicator color="#DC2626" />

  return (
    <>
      <View className="overflow-hidden rounded-2xl bg-navy">
        <View className="flex-row items-center gap-4 px-5 py-5">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-gold/20">
            <Text className="text-3xl font-bold text-gold">{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-bold text-white" numberOfLines={1}>
              {form.razao_social || partnerDisplayName(profile)}
            </Text>
            <Text className="text-xs text-white/50">
              {form.cpf ? `CPF/CNPJ ${form.cpf}` : 'Sem CPF/CNPJ cadastrado'}
            </Text>
          </View>
        </View>
      </View>

      <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
        <View className="border-b border-silver-100 bg-silver-50 px-4 py-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">Dados da empresa</Text>
        </View>
        <View className="gap-4 p-4">
          <Field label="Razão social"      value={form.razao_social}        onChange={(v) => setForm(f => ({ ...f, razao_social: v }))} />
          <Field label="CPF / CNPJ"        value={form.cpf}                  onChange={(v) => setForm(f => ({ ...f, cpf: formatCpfCnpj(v) }))} />
          <Field label="Website"           value={form.website}              onChange={(v) => setForm(f => ({ ...f, website: v }))} />
          <Field label="WhatsApp comercial" value={form.telefone}            onChange={(v) => setForm(f => ({ ...f, telefone: formatPhone(v) }))} />
          <Field label="CEP"               value={form.endereco_cep}         onChange={(v) => setForm(f => ({ ...f, endereco_cep: formatCep(v) }))} />
          <Field label="Logradouro"        value={form.endereco_logradouro}  onChange={(v) => setForm(f => ({ ...f, endereco_logradouro: v }))} />
          <View className="flex-row gap-2">
            <View className="flex-1"><Field label="Número"  value={form.endereco_numero}      onChange={(v) => setForm(f => ({ ...f, endereco_numero: v }))} /></View>
            <View className="flex-1"><Field label="Compl."  value={form.endereco_complemento} onChange={(v) => setForm(f => ({ ...f, endereco_complemento: v }))} /></View>
          </View>
          <Field label="Bairro"  value={form.endereco_bairro}  onChange={(v) => setForm(f => ({ ...f, endereco_bairro: v }))} />
          <View className="flex-row gap-2">
            <View className="flex-[3]"><Field label="Cidade" value={form.endereco_cidade} onChange={(v) => setForm(f => ({ ...f, endereco_cidade: v }))} /></View>
            <View className="flex-1"><Field label="UF" value={form.endereco_estado} onChange={(v) => setForm(f => ({ ...f, endereco_estado: v.toUpperCase().slice(0, 2) }))} /></View>
          </View>
        </View>
        <View className="border-t border-silver-100 px-4 py-3">
          <Pressable
            disabled={saveMut.isPending}
            onPress={() => saveMut.mutate()}
            className="items-center rounded-xl bg-gold py-3 active:opacity-80"
          >
            {saveMut.isPending
              ? <ActivityIndicator color="white" />
              : <Text className="text-sm font-bold text-white">Salvar alterações</Text>}
          </Pressable>
        </View>
      </View>
    </>
  )
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <View>
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-silver-500">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        className={`rounded-xl border px-4 py-3 text-sm ${
          disabled
            ? 'border-silver-100 bg-silver-100 text-silver-400'
            : 'border-silver-200 bg-white text-silver-900'
        }`}
      />
    </View>
  )
}

// ─── Notificações ───────────────────────────────────────────────────────────
interface NotifPrefRow {
  partner_id: string
  evento: string
  whatsapp: boolean
  email: boolean
  push: boolean
}

const NOTIF_EVENTS = [
  { key: 'proposta_atualizada', label: 'Nova proposta atualizada' },
  { key: 'documento_status',    label: 'Documento aprovado / rejeitado' },
  { key: 'saldo_baixo',         label: 'Saldo de carteira baixo (< R$ 50)' },
  { key: 'convite_aceito',      label: 'Convite de membro aceito' },
  { key: 'proposta_avanco',     label: 'Status de proposta avançou' },
]

type PrefState = Record<string, { whatsapp: boolean; email: boolean; push: boolean }>

function Notif() {
  const qc = useQueryClient()
  const [prefs, setPrefs] = useState<PrefState>({})

  const listQ = useQuery({
    queryKey: ['p-notif-prefs'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('partner_notif_prefs_list')
      if (error) throw error
      return (data ?? []) as NotifPrefRow[]
    },
    staleTime: 60_000,
  })

  const defaults = useMemo<PrefState>(() => {
    const out: PrefState = {}
    for (const ev of NOTIF_EVENTS) out[ev.key] = { whatsapp: true, email: true, push: false }
    return out
  }, [])

  useEffect(() => {
    if (!listQ.data) return
    const map: PrefState = { ...defaults }
    for (const r of listQ.data) {
      map[r.evento] = { whatsapp: r.whatsapp, email: r.email, push: r.push }
    }
    setPrefs(map)
  }, [listQ.data, defaults])

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = NOTIF_EVENTS.map((ev) => ({
        evento: ev.key,
        whatsapp: prefs[ev.key]?.whatsapp ?? true,
        email:    prefs[ev.key]?.email    ?? true,
        push:     prefs[ev.key]?.push     ?? false,
      }))
      const { data, error } = await supabase.rpc('partner_notif_prefs_upsert', { p_payload: payload })
      if (error) throw error
      return (data ?? []) as NotifPrefRow[]
    },
    onSuccess: (rows) => {
      qc.setQueryData(['p-notif-prefs'], rows)
      Alert.alert('Sucesso', 'Preferências salvas.')
    },
    onError: (e: unknown) => Alert.alert('Erro', e instanceof Error ? e.message : String(e)),
  })

  function toggle(key: string, ch: 'whatsapp' | 'email' | 'push') {
    setPrefs(p => ({
      ...p,
      [key]: { ...(p[key] ?? { whatsapp: true, email: true, push: false }), [ch]: !(p[key]?.[ch] ?? false) },
    }))
  }

  if (listQ.isLoading) return <ActivityIndicator color="#DC2626" />

  return (
    <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
      <View className="border-b border-silver-100 bg-silver-50 px-4 py-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">Preferências de notificação</Text>
      </View>
      <View className="px-4 pb-1 pt-2">
        <View className="flex-row items-center border-b border-silver-100 pb-2">
          <Text className="flex-[1.8] text-[10px] font-bold uppercase tracking-wide text-silver-400">Evento</Text>
          <Text className="w-14 text-center text-[10px] font-bold uppercase tracking-wide text-silver-400">WApp</Text>
          <Text className="w-14 text-center text-[10px] font-bold uppercase tracking-wide text-silver-400">Email</Text>
          <Text className="w-14 text-center text-[10px] font-bold uppercase tracking-wide text-silver-400">Push</Text>
        </View>
        {NOTIF_EVENTS.map((ev) => {
          const r = prefs[ev.key] ?? { whatsapp: true, email: true, push: false }
          return (
            <View key={ev.key} className="flex-row items-center border-b border-silver-100 py-3 last:border-b-0">
              <Text className="flex-[1.8] text-xs leading-relaxed text-silver-700">{ev.label}</Text>
              <View className="w-14 items-center">
                <Switch value={r.whatsapp} onValueChange={() => toggle(ev.key, 'whatsapp')} trackColor={{ true: '#DC2626' }} style={{ transform: [{ scale: 0.75 }] }} />
              </View>
              <View className="w-14 items-center">
                <Switch value={r.email} onValueChange={() => toggle(ev.key, 'email')} trackColor={{ true: '#DC2626' }} style={{ transform: [{ scale: 0.75 }] }} />
              </View>
              <View className="w-14 items-center">
                <Switch value={r.push} onValueChange={() => toggle(ev.key, 'push')} trackColor={{ true: '#DC2626' }} style={{ transform: [{ scale: 0.75 }] }} />
              </View>
            </View>
          )
        })}
      </View>
      <View className="border-t border-silver-100 px-4 py-3">
        <Pressable
          disabled={saveMut.isPending}
          onPress={() => saveMut.mutate()}
          className="items-center rounded-xl bg-gold py-3 active:opacity-80"
        >
          {saveMut.isPending
            ? <ActivityIndicator color="white" />
            : <Text className="text-sm font-bold text-white">Salvar preferências</Text>}
        </Pressable>
      </View>
    </View>
  )
}

// ─── Integrações ────────────────────────────────────────────────────────────
const INTEGRACOES = [
  { nome: 'CRM HubSpot',           desc: 'Sincronize leads e propostas', status: 'Em breve' },
  { nome: 'Zapier',                desc: 'Automatize fluxos externos',   status: 'Em breve' },
  { nome: 'Webhook personalizado', desc: 'Envie eventos para sua API',   status: 'Em breve' },
]

function Integracoes() {
  return (
    <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
      <View className="border-b border-silver-100 bg-silver-50 px-4 py-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">APIs e integrações</Text>
      </View>
      {INTEGRACOES.map((i, idx) => (
        <View
          key={i.nome}
          className={`flex-row items-center gap-3 px-4 py-4 ${idx < INTEGRACOES.length - 1 ? 'border-b border-silver-100' : ''}`}
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-silver-100">
            <Plug size={18} color="#6B7280" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-navy">{i.nome}</Text>
            <Text className="text-xs text-silver-500">{i.desc}</Text>
          </View>
          <View className="rounded-full bg-silver-100 px-2 py-0.5">
            <Text className="text-[10px] font-bold text-silver-500">{i.status}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── Segurança ──────────────────────────────────────────────────────────────
function Seguranca() {
  const { signOut } = useAuth()

  async function resetSenha() {
    const { data: u } = await supabase.auth.getUser()
    if (!u.user?.email) return
    const { error } = await supabase.auth.resetPasswordForEmail(u.user.email)
    if (error) Alert.alert('Erro', error.message)
    else Alert.alert('E-mail enviado', 'Enviamos as instruções para o seu e-mail.')
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
      <View className="border-b border-silver-100 bg-silver-50 px-4 py-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">Segurança da conta</Text>
      </View>
      <Pressable
        onPress={resetSenha}
        className="flex-row items-center gap-3 border-b border-silver-100 px-4 py-4 active:bg-silver-50"
      >
        <ShieldCheck size={20} color="#DC2626" />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-navy">Alterar senha</Text>
          <Text className="text-xs text-silver-500">Receba um link por e-mail</Text>
        </View>
        <ChevronRight size={16} color="#9CA3AF" />
      </Pressable>
      <Pressable
        onPress={() => Alert.alert('Sair', 'Deseja realmente sair?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login') } },
        ])}
        className="flex-row items-center gap-3 px-4 py-4 active:bg-silver-50"
      >
        <ShieldCheck size={20} color="#DC2626" />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-danger">Encerrar sessão</Text>
          <Text className="text-xs text-silver-500">Desconecta este dispositivo</Text>
        </View>
        <ChevronRight size={16} color="#9CA3AF" />
      </Pressable>
    </View>
  )
}
