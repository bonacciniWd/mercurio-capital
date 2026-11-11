import { useEffect, useState } from 'react'
import { ScrollView, Switch, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PartnerAction, PartnerBody, PartnerCard, PartnerFeedback, PartnerScreen, PartnerTitle } from '@/components/parceiro/PartnerUI'
import { PartnerSecurity } from '@/components/parceiro/PartnerSecurity'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { partnerProfileQueryKey, usePartnerProfile, type PartnerProfile } from '@/lib/partner'
import { canManagePartner, partnerSection, type PartnerSection } from '@/lib/partnerAccess'
import { isValidCpf, isValidCnpj, isValidPhone, onlyDigits } from '@/lib/documentoBr'

const SECTIONS: { key: PartnerSection; label: string }[] = [
  { key: 'empresa', label: 'Empresa' }, { key: 'notificacoes', label: 'Preferências' },
  { key: 'integracoes', label: 'Integrações' }, { key: 'seguranca', label: 'Segurança' },
]

export default function ParceiroConfig() {
  const { session } = useAuth()
  const params = useLocalSearchParams<{ secao?: string }>()
  const [active, setActive] = useState(() => partnerSection(params.secao, session?.role))
  useEffect(() => { setActive(partnerSection(params.secao, session?.role)) }, [params.secao, session?.role])
  const sections = canManagePartner(session?.role) ? SECTIONS : SECTIONS.filter((section) => section.key === 'seguranca')
  return <PartnerScreen title="Configurações" subtitle={active === 'seguranca' ? 'Proteja sua conta' : 'Dados e preferências da parceria'}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {sections.map((section) => <View key={section.key}><PartnerAction label={section.label} secondary={active !== section.key} onPress={() => { setActive(section.key); router.setParams({ secao: section.key }) }} /></View>)}
    </ScrollView>
    {active === 'empresa' && canManagePartner(session?.role) ? <Empresa /> : null}
    {active === 'notificacoes' && canManagePartner(session?.role) ? <Notificacoes /> : null}
    {active === 'integracoes' && canManagePartner(session?.role) ? <PartnerCard><PartnerTitle>Integrações</PartnerTitle><PartnerBody>Não há integrações externas disponíveis para conectar por esta tela.</PartnerBody></PartnerCard> : null}
    {active === 'seguranca' ? <PartnerSecurity /> : null}
  </PartnerScreen>
}

type EmpresaForm = Pick<PartnerProfile, 'razao_social' | 'cpf' | 'website' | 'telefone' | 'endereco_cep' | 'endereco_logradouro' | 'endereco_numero' | 'endereco_complemento' | 'endereco_bairro' | 'endereco_cidade' | 'endereco_estado'>
type Form = { [Key in keyof EmpresaForm]: string }
function formatDocument(value: string): string {
  const digits = onlyDigits(value).slice(0, 14)
  return digits.length <= 11 ? digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    : digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}
function formatPhone(value: string, ddi?: string | null): string {
  if (ddi && ddi !== '55') return onlyDigits(value).slice(0, 15)
  const digits = onlyDigits(value).slice(0, 11)
  return digits.length <= 10 ? digits.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3') : digits.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3')
}
function formatCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}
const profileForm = (profile: PartnerProfile): Form => ({
  razao_social: profile.razao_social ?? '', cpf: formatDocument(profile.cpf ?? ''), website: profile.website ?? '', telefone: formatPhone(profile.telefone ?? '', profile.telefone_ddi),
  endereco_cep: formatCep(profile.endereco_cep ?? ''), endereco_logradouro: profile.endereco_logradouro ?? '', endereco_numero: profile.endereco_numero ?? '',
  endereco_complemento: profile.endereco_complemento ?? '', endereco_bairro: profile.endereco_bairro ?? '', endereco_cidade: profile.endereco_cidade ?? '', endereco_estado: profile.endereco_estado ?? '',
})

function Empresa() {
  const profile = usePartnerProfile()
  if (profile.isLoading) return <PartnerFeedback title="Carregando cadastro…" loading />
  if (profile.isError || !profile.data) return <PartnerFeedback title="Cadastro indisponível" text="Não foi possível carregar os dados da parceria." retry={() => { void profile.refetch() }} />
  return <EmpresaFields profile={profile.data} />
}

function EmpresaFields({ profile }: { profile: PartnerProfile }) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const initial = profileForm(profile)
  const [form, setForm] = useState<Form>(() => initial)
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const update = (key: keyof Form, value: string) => { setSaved(false); setForm((current) => ({ ...current, [key]: value })) }
  const save = useMutation({
    mutationFn: async () => {
      const document = onlyDigits(form.cpf)
      if (profile.cpf && !document) throw new Error('O CPF/CNPJ cadastrado não pode ficar em branco.')
      if (document && !(document.length === 11 ? isValidCpf(document) : isValidCnpj(document))) throw new Error('Informe um CPF ou CNPJ válido.')
      const phone = onlyDigits(form.telefone)
      if (phone && (profile.telefone_ddi === '55' || !profile.telefone_ddi) && !isValidPhone(phone)) throw new Error('Informe um telefone válido com DDD.')
      if (form.endereco_cep && onlyDigits(form.endereco_cep).length !== 8) throw new Error('O CEP deve ter oito dígitos.')
      if (form.endereco_estado && !/^[A-Z]{2}$/.test(form.endereco_estado)) throw new Error('Informe a UF com duas letras.')
      if (form.website.trim()) {
        try {
          const url = new URL(/^https?:\/\//i.test(form.website) ? form.website.trim() : `https://${form.website.trim()}`)
          if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error()
        } catch { throw new Error('Informe um endereço de site válido.') }
      }
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]))
      const { data, error } = await supabase.rpc('partner_update_profile', { p_payload: {
        ...payload, ...(document ? { cpf: document } : { cpf: undefined }), telefone: phone,
        telefone_ddi: profile.telefone_ddi ?? '55', endereco_cep: onlyDigits(form.endereco_cep),
      } })
      if (error) {
        if (error.message.includes('partners_cpf_key') || error.message.includes('duplicate key')) throw new Error('Este CPF/CNPJ já está vinculado a outro parceiro.')
        throw new Error('Não foi possível salvar o cadastro. Confira os dados e tente novamente.')
      }
      return data as PartnerProfile
    },
    onSuccess: (data) => { qc.setQueryData(partnerProfileQueryKey(session?.userId), data); setForm(profileForm(data)); setSaved(true) },
  })
  return <PartnerCard><PartnerTitle>Dados da parceria</PartnerTitle><PartnerBody>Atualize os dados comerciais e de contato da sua empresa.</PartnerBody>
    <Field label="Razão social" value={form.razao_social} onChange={(value) => update('razao_social', value)} />
    <Field label="CPF / CNPJ" value={form.cpf} keyboard="numeric" onChange={(value) => update('cpf', formatDocument(value))} />
    <Field label="Site" value={form.website} keyboard="url" onChange={(value) => update('website', value)} />
    <Field label="WhatsApp comercial" value={form.telefone} keyboard="phone-pad" onChange={(value) => update('telefone', formatPhone(value, profile.telefone_ddi))} />
    <Field label="CEP" value={form.endereco_cep} keyboard="numeric" onChange={(value) => update('endereco_cep', formatCep(value))} />
    <Field label="Logradouro" value={form.endereco_logradouro} onChange={(value) => update('endereco_logradouro', value)} />
    <View className="flex-row gap-3"><View className="flex-1"><Field label="Número" value={form.endereco_numero} onChange={(value) => update('endereco_numero', value)} /></View><View className="flex-1"><Field label="Complemento" value={form.endereco_complemento} onChange={(value) => update('endereco_complemento', value)} /></View></View>
    <Field label="Bairro" value={form.endereco_bairro} onChange={(value) => update('endereco_bairro', value)} />
    <View className="flex-row gap-3"><View className="flex-[3]"><Field label="Cidade" value={form.endereco_cidade} onChange={(value) => update('endereco_cidade', value)} /></View><View className="flex-1"><Field label="UF" value={form.endereco_estado} onChange={(value) => update('endereco_estado', value.toUpperCase().slice(0, 2))} /></View></View>
    {save.isError ? <Text accessibilityRole="alert" className="text-sm text-[#FCA5A5]">{save.error.message}</Text> : null}
    {saved && !dirty ? <Text accessibilityLiveRegion="polite" className="text-sm text-[#86EFAC]">Cadastro atualizado.</Text> : dirty ? <PartnerBody>Você tem alterações não salvas.</PartnerBody> : null}
    <PartnerAction label="Salvar alterações" disabled={!dirty} busy={save.isPending} onPress={() => save.mutate()} />
    {dirty ? <PartnerAction secondary label="Descartar alterações" disabled={save.isPending} onPress={() => { setForm(initial); save.reset(); setSaved(false) }} /> : null}
  </PartnerCard>
}

function Field({ label, value, onChange, keyboard = 'default', secure = false }: { label: string; value: string; onChange: (value: string) => void; keyboard?: KeyboardTypeOptions; secure?: boolean }) {
  return <View className="gap-2"><Text className="text-sm font-medium text-[#D4D4D8]">{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={keyboard} secureTextEntry={secure} autoCapitalize={keyboard === 'url' ? 'none' : 'sentences'} autoCorrect={keyboard !== 'url'} selectionColor="#EF4444" placeholderTextColor="#71717A" className="min-h-14 rounded-xl border border-[#414148] bg-[#202024] px-4 py-3 text-base text-white" /></View>
}

type Preference = { evento: string; whatsapp: boolean; email: boolean; push: boolean }
type PreferenceMap = Record<string, Omit<Preference, 'evento'>>
const EVENTS = [
  { key: 'proposta_atualizada', label: 'Proposta atualizada' }, { key: 'documento_status', label: 'Documento aprovado ou rejeitado' },
  { key: 'saldo_baixo', label: 'Saldo de carteira baixo' }, { key: 'convite_aceito', label: 'Convite de membro aceito' }, { key: 'proposta_avanco', label: 'Avanço de etapa da proposta' },
]
const preferenceMap = (rows: Preference[]): PreferenceMap => Object.fromEntries(EVENTS.map(({ key }) => {
  const row = rows.find((item) => item.evento === key)
  return [key, { whatsapp: row?.whatsapp ?? true, email: row?.email ?? true, push: row?.push ?? false }]
}))

function Notificacoes() {
  const { session } = useAuth()
  const prefs = useQuery({
    queryKey: ['p-notif-prefs', session?.userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('partner_notif_prefs_list')
      if (error) throw error
      return (data ?? []) as Preference[]
    },
  })
  if (prefs.isLoading) return <PartnerFeedback title="Carregando preferências…" loading />
  if (prefs.isError) return <PartnerFeedback title="Preferências indisponíveis" retry={() => { void prefs.refetch() }} />
  return <PreferenceFields rows={prefs.data ?? []} />
}

function PreferenceFields({ rows }: { rows: Preference[] }) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const initial = preferenceMap(rows)
  const [prefs, setPrefs] = useState<PreferenceMap>(() => initial)
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial)
  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('partner_notif_prefs_upsert', { p_payload: EVENTS.map(({ key }) => ({ evento: key, ...prefs[key] })) })
      if (error) throw new Error('Não foi possível salvar suas preferências. Tente novamente.')
      return (data ?? []) as Preference[]
    },
    onSuccess: (data) => { qc.setQueryData(['p-notif-prefs', session?.userId], data); setPrefs(preferenceMap(data)); setSaved(true) },
  })
  return <PartnerCard><PartnerTitle>Preferências de comunicação</PartnerTitle><PartnerBody>Escolha os canais de cada atualização. A entrega depende dos canais ativos da Mercúrio.</PartnerBody>
    {EVENTS.map(({ key, label }) => <View key={key} className="gap-2 border-t border-[#2D2D32] pt-4"><Text className="text-sm font-semibold text-white">{label}</Text>
      {(['whatsapp', 'email'] as const).map((channel) => <View key={channel} className="min-h-11 flex-row items-center justify-between"><Text className="text-sm text-[#B8B8C2]">{channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</Text><Switch accessibilityLabel={`${label} por ${channel === 'whatsapp' ? 'WhatsApp' : 'e-mail'}`} value={prefs[key][channel]} disabled={save.isPending} onValueChange={(value) => { setSaved(false); setPrefs((current) => ({ ...current, [key]: { ...current[key], [channel]: value } })) }} trackColor={{ true: '#DC2626', false: '#414148' }} /></View>)}
    </View>)}
    <PartnerBody>Notificações push do aparelho ainda não estão disponíveis. A caixa de notificações do app continua acessível pelo Perfil.</PartnerBody>
    {save.isError ? <Text accessibilityRole="alert" className="text-sm text-[#FCA5A5]">{save.error.message}</Text> : null}
    {saved && !dirty ? <Text accessibilityLiveRegion="polite" className="text-sm text-[#86EFAC]">Preferências salvas.</Text> : null}
    <PartnerAction label="Salvar preferências" busy={save.isPending} disabled={!dirty} onPress={() => save.mutate()} />
    {dirty ? <PartnerAction secondary label="Descartar alterações" disabled={save.isPending} onPress={() => { setPrefs(initial); save.reset(); setSaved(false) }} /> : null}
  </PartnerCard>
}
