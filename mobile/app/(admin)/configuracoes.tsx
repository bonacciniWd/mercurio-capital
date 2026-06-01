import { useState } from 'react'
import { View, Text, Pressable, Switch, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Building2, Users, Shield, Bell, Globe, Database } from 'lucide-react-native'

const TABS = [
  { id: 'empresa',   label: 'Empresa',       icon: Building2 },
  { id: 'usuarios',  label: 'Usuários',       icon: Users },
  { id: 'seguranca', label: 'Segurança',      icon: Shield },
  { id: 'notif',     label: 'Notificações',   icon: Bell },
  { id: 'dominio',   label: 'Domínio',        icon: Globe },
  { id: 'backup',    label: 'Backup',         icon: Database },
] as const

type TabId = typeof TABS[number]['id']

export default function Configuracoes() {
  const [tab, setTab] = useState<TabId>('empresa')
  const [toggles, setToggles] = useState({ mfa: true, ipLock: false, audit: true, push: true, email: true })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Configurações</Text>
        </View>
      </View>

      {/* Tab pills */}
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

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>

        {tab === 'empresa' && (
          <Card title="Dados da empresa">
            <Field label="Razão social" value="Mercurio Capital Ltda" />
            <Field label="CNPJ" value="12.345.678/0001-90" />
            <Field label="Endereço" value="Av. Paulista, 1000 — SP" />
          </Card>
        )}

        {tab === 'usuarios' && (
          <Card title="Usuários internos">
            {[
              { email: 'admin@mercurio',     role: 'Admin' },
              { email: 'comite@mercurio',    role: 'Comitê' },
              { email: 'juridico@mercurio',  role: 'Jurídico' },
              { email: 'analista@mercurio',  role: 'Crédito' },
            ].map((u, i) => (
              <View key={u.email} style={[s.userRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#1f1f1f' }]}>
                <Text style={s.userEmail}>{u.email}</Text>
                <View style={s.rolePill}><Text style={s.roleText}>{u.role}</Text></View>
              </View>
            ))}
          </Card>
        )}

        {tab === 'seguranca' && (
          <Card title="Políticas de segurança">
            <Toggle label="MFA obrigatório"          v={toggles.mfa}     onChange={v => setToggles(s => ({ ...s, mfa: v }))} />
            <Toggle label="Bloqueio por IP suspeito" v={toggles.ipLock}  onChange={v => setToggles(s => ({ ...s, ipLock: v }))} />
            <Toggle label="Auditoria detalhada"      v={toggles.audit}   onChange={v => setToggles(s => ({ ...s, audit: v }))} />
          </Card>
        )}

        {tab === 'notif' && (
          <Card title="Notificações">
            <Toggle label="Push notifications"        v={toggles.push}   onChange={v => setToggles(s => ({ ...s, push: v }))} />
            <Toggle label="E-mail diário de resumo"   v={toggles.email}  onChange={v => setToggles(s => ({ ...s, email: v }))} />
          </Card>
        )}

        {tab === 'dominio' && (
          <Card title="Domínio & marca">
            <Field label="Domínio"        value="app.mercuriocapital.com.br" />
            <Field label="Cor primária"   value="#0F0F0F" />
            <Field label="Cor de destaque" value="#DC2626" />
          </Card>
        )}

        {tab === 'backup' && (
          <Card title="Backup & exportação">
            <Field label="Última cópia" value="Hoje, 03:00" />
            <Field label="Retenção"     value="30 dias" />
            <Pressable style={s.actionBtn}>
              <Text style={s.actionBtnText}>Iniciar backup manual</Text>
            </Pressable>
          </Card>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={cs.card}>
      <Text style={cs.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={cs.fieldRow}>
      <Text style={cs.fieldLabel}>{label}</Text>
      <Text style={cs.fieldValue}>{value}</Text>
    </View>
  )
}

function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={cs.toggleRow}>
      <Text style={cs.toggleLabel}>{label}</Text>
      <Switch
        value={v}
        onValueChange={onChange}
        trackColor={{ true: '#DC2626', false: '#2a2a2a' }}
        thumbColor="white"
        style={{ transform: [{ scale: 0.85 }] }}
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

  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  userEmail: { fontSize: 13, color: '#a3a3a3', fontFamily: 'monospace' },
  rolePill: { backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  roleText: { fontSize: 10, fontWeight: '600', color: '#737373' },

  actionBtn: { marginTop: 14, backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})

const cs = StyleSheet.create({
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', padding: 16 },
  cardTitle: { fontSize: 10, letterSpacing: 1.2, color: '#525252', fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 },
  fieldRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  fieldLabel: { fontSize: 10, color: '#525252', fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#e5e5e5', marginTop: 3 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  toggleLabel: { fontSize: 14, color: '#a3a3a3' },
})
