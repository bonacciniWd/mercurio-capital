import { ScrollView, View, Text, Pressable, TextInput, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Building2, Bell, Plug, ShieldCheck, ChevronRight } from 'lucide-react-native'
import { useState } from 'react'

const tabs = [
  { id: 'Empresa',       icon: Building2 },
  { id: 'Notificações',  icon: Bell },
  { id: 'Integrações',   icon: Plug },
  { id: 'Segurança',     icon: ShieldCheck },
] as const
type Tab = typeof tabs[number]['id']

export default function ParceiroConfig() {
  const [active, setActive] = useState<Tab>('Empresa')

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      {/* Header */}
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

        {/* Tab pills no header */}
        <View className="mt-4 flex-row gap-2">
          {tabs.map(({ id: t, icon: Icon }) => (
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

// ─── Empresa ────────────────────────────────────────────────────────────────
function Field({ label, value, disabled }: { label: string; value: string; disabled?: boolean }) {
  const [v, setV] = useState(value)
  return (
    <View>
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-silver-500">{label}</Text>
      <TextInput
        value={v}
        onChangeText={setV}
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

function Empresa() {
  return (
    <>
      {/* Avatar card */}
      <View className="overflow-hidden rounded-2xl bg-navy">
        <View className="flex-row items-center gap-4 px-5 py-5">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-gold/20">
            <Text className="text-3xl font-bold text-gold">A</Text>
          </View>
          <View className="flex-1">
            <Text className="font-bold text-white">Construtora Aurora LTDA</Text>
            <Text className="text-xs text-white/50">CNPJ 12.345.678/0001-90</Text>
          </View>
          <Pressable className="rounded-lg border border-white/20 px-3 py-1.5">
            <Text className="text-xs font-semibold text-white">Editar logo</Text>
          </Pressable>
        </View>
      </View>

      {/* Campos */}
      <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
        <View className="border-b border-silver-100 bg-silver-50 px-4 py-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">Dados da empresa</Text>
        </View>
        <View className="gap-4 p-4">
          <Field label="Razão social"       value="Construtora Aurora LTDA" />
          <Field label="CNPJ"               value="12.345.678/0001-90" disabled />
          <Field label="Website"            value="https://aurora.com.br" />
          <Field label="WhatsApp comercial" value="+55 (11) 9XXXX-1234" />
          <Field label="Endereço comercial" value="Av. Paulista, 1000 — Bela Vista, SP" />
        </View>
        <View className="border-t border-silver-100 px-4 py-3">
          <Pressable className="items-center rounded-xl bg-gold py-3 active:opacity-80">
            <Text className="text-sm font-bold text-white">Salvar alterações</Text>
          </Pressable>
        </View>
      </View>
    </>
  )
}

// ─── Notificações ────────────────────────────────────────────────────────────
const NOTIF_EVENTS = [
  'Nova proposta atualizada',
  'Documento aprovado / rejeitado',
  'Saldo de carteira baixo (< R$ 50)',
  'Convite de membro aceito',
  'Status de proposta avançou',
]

function Notif() {
  return (
    <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
      <View className="border-b border-silver-100 bg-silver-50 px-4 py-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">Preferências de notificação</Text>
      </View>
      <View className="px-4 pb-1 pt-2">
        <View className="flex-row items-center border-b border-silver-100 pb-2">
          <Text className="flex-[1.8] text-[10px] font-bold uppercase tracking-wide text-silver-400">Evento</Text>
          <Text className="w-16 text-center text-[10px] font-bold uppercase tracking-wide text-silver-400">WApp</Text>
          <Text className="w-16 text-center text-[10px] font-bold uppercase tracking-wide text-silver-400">Email</Text>
          <Text className="w-16 text-center text-[10px] font-bold uppercase tracking-wide text-silver-400">Push</Text>
        </View>
        {NOTIF_EVENTS.map((e) => <NotifRow key={e} label={e} />)}
      </View>
    </View>
  )
}

function NotifRow({ label }: { label: string }) {
  const [w, setW] = useState(true)
  const [m, setM] = useState(true)
  const [p, setP] = useState(false)
  return (
    <View className="flex-row items-center border-b border-silver-100 py-3 last:border-b-0">
      <Text className="flex-[1.8] text-xs leading-relaxed text-silver-700">{label}</Text>
      <View className="w-16 items-center"><Switch value={w} onValueChange={setW} trackColor={{ true: '#DC2626' }} style={{ transform: [{ scale: 0.75 }] }} /></View>
      <View className="w-16 items-center"><Switch value={m} onValueChange={setM} trackColor={{ true: '#DC2626' }} style={{ transform: [{ scale: 0.75 }] }} /></View>
      <View className="w-16 items-center"><Switch value={p} onValueChange={setP} trackColor={{ true: '#DC2626' }} style={{ transform: [{ scale: 0.75 }] }} /></View>
    </View>
  )
}

// ─── Integrações ─────────────────────────────────────────────────────────────
const INTEGRACOES = [
  { nome: 'CRM HubSpot', desc: 'Sincronize leads e propostas', status: 'Conectado' },
  { nome: 'Zapier', desc: 'Automatize fluxos externos', status: 'Desconectado' },
  { nome: 'Webhook personalizado', desc: 'Envie eventos para sua API', status: 'Desconectado' },
]

function Integracoes() {
  return (
    <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
      <View className="border-b border-silver-100 bg-silver-50 px-4 py-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">APIs e integrações</Text>
      </View>
      {INTEGRACOES.map((i, idx) => (
        <Pressable
          key={i.nome}
          className={`flex-row items-center gap-3 px-4 py-4 active:bg-silver-50 ${idx < INTEGRACOES.length - 1 ? 'border-b border-silver-100' : ''}`}
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-silver-100">
            <Plug size={18} color="#6B7280" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-navy">{i.nome}</Text>
            <Text className="text-xs text-silver-500">{i.desc}</Text>
          </View>
          <View
            className="rounded-full px-2 py-0.5"
            style={{ backgroundColor: i.status === 'Conectado' ? '#16A34A22' : '#F3F4F6' }}
          >
            <Text
              className="text-[10px] font-bold"
              style={{ color: i.status === 'Conectado' ? '#16A34A' : '#9CA3AF' }}
            >
              {i.status}
            </Text>
          </View>
          <ChevronRight size={16} color="#9CA3AF" />
        </Pressable>
      ))}
    </View>
  )
}

// ─── Segurança ───────────────────────────────────────────────────────────────
const SEC_ITEMS = [
  { label: 'Autenticação de dois fatores', desc: 'App autenticador ou SMS', ativo: false },
  { label: 'Sessões ativas', desc: '2 dispositivos conectados', ativo: null },
  { label: 'Alterar senha', desc: 'Última alteração há 30 dias', ativo: null },
]

function Seguranca() {
  const [tfa, setTfa] = useState(false)
  return (
    <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
      <View className="border-b border-silver-100 bg-silver-50 px-4 py-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">Segurança da conta</Text>
      </View>
      {SEC_ITEMS.map((item, idx) => (
        <View
          key={item.label}
          className={`flex-row items-center gap-3 px-4 py-4 ${idx < SEC_ITEMS.length - 1 ? 'border-b border-silver-100' : ''}`}
        >
          <ShieldCheck size={20} color="#DC2626" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-navy">{item.label}</Text>
            <Text className="text-xs text-silver-500">{item.desc}</Text>
          </View>
          {item.ativo !== null ? (
            <Switch value={tfa} onValueChange={setTfa} trackColor={{ true: '#DC2626' }} style={{ transform: [{ scale: 0.75 }] }} />
          ) : (
            <ChevronRight size={16} color="#9CA3AF" />
          )}
        </View>
      ))}
    </View>
  )
}

