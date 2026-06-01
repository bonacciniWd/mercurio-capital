import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Search, Eye, Lock, Unlock, Building2, FileStack,
  Banknote, Users,
} from 'lucide-react-native'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

type PartnerRow = {
  partner_id: string
  usuario_id: string
  status: string
  nome: string
  email: string
  cpf: string | null
  endereco_cidade: string | null
  endereco_estado: string | null
  saldo_centavos: number
  wallet_bloqueada: boolean
  propostas_total: number
  propostas_ativas: number
  volume_solicitado: number
  volume_aprovado: number
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  approved:  { label: 'Ativo',      color: '#16A34A' },
  suspended: { label: 'Suspenso',   color: '#DC2626' },
  pending:   { label: 'Pendente',   color: '#F59E0B' },
  rejected:  { label: 'Recusado',   color: '#737373' },
}

export default function Parceiros() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [suspendFor, setSuspendFor] = useState<PartnerRow | null>(null)
  const [motivo, setMotivo] = useState('')

  const { data: parceiros, isLoading } = useQuery({
    queryKey: ['admin-parceiros-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_partners')
        .select('partner_id, usuario_id, status, nome, email, cpf, endereco_cidade, endereco_estado, saldo_centavos, wallet_bloqueada, propostas_total, propostas_ativas, volume_solicitado, volume_aprovado')
        .order('volume_solicitado', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as PartnerRow[]
    },
  })

  const suspend = useMutation({
    mutationFn: async ({ partner_id, motivo }: { partner_id: string; motivo: string }) => {
      const { error } = await supabase.rpc('admin_suspend_partner', { p_partner_id: partner_id, p_motivo: motivo })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-parceiros-mobile'] }); setSuspendFor(null); setMotivo(''); Alert.alert('Parceiro suspenso') },
    onError: (e: any) => Alert.alert('Erro', e?.message ?? 'Falha ao suspender'),
  })

  const reactivate = useMutation({
    mutationFn: async (partner_id: string) => {
      const { error } = await supabase.rpc('admin_reactivate_partner', { p_partner_id: partner_id })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-parceiros-mobile'] }); Alert.alert('Parceiro reativado') },
    onError: (e: any) => Alert.alert('Erro', e?.message ?? 'Falha ao reativar'),
  })

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return parceiros ?? []
    return (parceiros ?? []).filter(p =>
      [p.nome, p.email, p.cpf, p.endereco_cidade].filter(Boolean).join(' ').toLowerCase().includes(term)
    )
  }, [parceiros, q])

  const kpis = useMemo(() => {
    const all = parceiros ?? []
    const ativos = all.filter(p => p.status === 'approved').length
    const bloqueados = all.filter(p => p.status === 'suspended').length
    const volume = all.reduce((s, p) => s + Number(p.volume_solicitado ?? 0), 0) * 100
    const propostasAtivas = all.reduce((s, p) => s + Number(p.propostas_ativas ?? 0), 0)
    return { ativos, bloqueados, volume, propostasAtivas }
  }, [parceiros])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Parceiros</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          <View style={s.grid}>
            <StatCard icon={Users}     accent="#16A34A" label="Ativos"        value={String(kpis.ativos)}        sub="parceiros" />
            <StatCard icon={Lock}      accent="#DC2626" label="Suspensos"     value={String(kpis.bloqueados)}    sub="em revisão" />
            <StatCard icon={Banknote}  accent="#F87171" label="Volume total"  value={brl(kpis.volume)}            sub="solicitado" />
            <StatCard icon={FileStack} accent="#F59E0B" label="Propostas"     value={String(kpis.propostasAtivas)} sub="ativas" />
          </View>

          <View style={s.searchRow}>
            <Search size={16} color="#525252" />
            <TextInput
              placeholder="Buscar por nome, email ou cidade"
              placeholderTextColor="#525252"
              style={s.searchInput}
              value={q}
              onChangeText={setQ}
            />
          </View>

          {filtrados.length === 0 ? (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: '#737373' }}>Nenhum parceiro encontrado.</Text>
            </View>
          ) : filtrados.map(p => {
            const meta = STATUS_LABEL[p.status] ?? { label: p.status, color: '#737373' }
            const suspended = p.status === 'suspended'
            return (
              <View key={p.partner_id} style={[s.card, suspended && { borderColor: '#DC262630' }]}>

                <View style={s.cardTop}>
                  <View style={[s.avatarBadge, { backgroundColor: meta.color + '22' }]}>
                    <Building2 size={18} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.partnerName} numberOfLines={1}>{p.nome}</Text>
                    <Text style={s.partnerType} numberOfLines={1}>{p.email}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: meta.color + '20' }]}>
                    <View style={[s.statusDot, { backgroundColor: meta.color }]} />
                    <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                <View style={s.statsRow}>
                  <Stat label="Volume"    value={brl(Number(p.volume_solicitado) * 100)} />
                  <View style={s.divider} />
                  <Stat label="Propostas" value={`${p.propostas_ativas}/${p.propostas_total}`} />
                  <View style={s.divider} />
                  <Stat label="Saldo"     value={brl(p.saldo_centavos)} alert={p.saldo_centavos < 20000} />
                </View>

                <View style={s.actionsRow}>
                  <Pressable style={s.btnOutline} onPress={() => Alert.alert(p.nome, `CPF: ${p.cpf ?? '—'}\nCidade: ${p.endereco_cidade ?? '—'} / ${p.endereco_estado ?? '—'}\nVolume aprovado: ${brl(Number(p.volume_aprovado) * 100)}`)}>
                    <Eye size={14} color="#e5e5e5" />
                    <Text style={s.btnOutlineText}>Detalhes</Text>
                  </Pressable>
                  <Pressable style={s.btnOutline} onPress={() => router.push({ pathname: '/(admin)/partner-equipes' as any, params: { partnerId: p.partner_id } })}>
                    <Users size={14} color="#38BDF8" />
                    <Text style={[s.btnOutlineText, { color: '#38BDF8' }]}>Equipes</Text>
                  </Pressable>
                  {suspended ? (
                    <Pressable style={[s.btnOutline, { borderColor: '#16A34A60' }]} onPress={() => reactivate.mutate(p.partner_id)} disabled={reactivate.isPending}>
                      {reactivate.isPending && reactivate.variables === p.partner_id ? <ActivityIndicator size="small" color="#16A34A" /> : <Unlock size={14} color="#16A34A" />}
                      <Text style={[s.btnOutlineText, { color: '#16A34A' }]}>Reativar</Text>
                    </Pressable>
                  ) : p.status === 'approved' ? (
                    <Pressable style={[s.btnOutline, { borderColor: '#DC262660' }]} onPress={() => { setSuspendFor(p); setMotivo('') }}>
                      <Lock size={14} color="#DC2626" />
                      <Text style={[s.btnOutlineText, { color: '#DC2626' }]}>Suspender</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}

      <Modal visible={!!suspendFor} transparent animationType="fade" onRequestClose={() => setSuspendFor(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Suspender parceiro</Text>
            <Text style={s.modalSub}>{suspendFor?.nome}</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Motivo da suspensão (obrigatório)"
              placeholderTextColor="#525252"
              value={motivo}
              onChangeText={setMotivo}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable style={[s.btnOutline, { flex: 1 }]} onPress={() => setSuspendFor(null)}>
                <Text style={s.btnOutlineText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.btnOutline, { flex: 1, backgroundColor: '#DC2626', borderColor: '#DC2626' }]}
                onPress={() => {
                  if (motivo.trim().length < 3) return Alert.alert('Motivo obrigatório')
                  if (suspendFor) suspend.mutate({ partner_id: suspendFor.partner_id, motivo: motivo.trim() })
                }}
                disabled={suspend.isPending}
              >
                {suspend.isPending ? <ActivityIndicator size="small" color="white" /> : <Text style={[s.btnOutlineText, { color: '#fff' }]}>Confirmar</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function StatCard({ icon: Icon, accent, label, value, sub }: { icon: any; accent: string; label: string; value: string; sub?: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: accent }]}>
      <View style={[s.iconBadge, { backgroundColor: accent + '22' }]}>
        <Icon size={15} color={accent} />
      </View>
      <Text style={s.statValue} numberOfLines={1}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  )
}
function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.inlineStatLabel}>{label}</Text>
      <Text style={[s.inlineStatValue, alert && { color: '#DC2626' }]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexBasis: '47%', flexGrow: 1, minWidth: 0, minHeight: 116, backgroundColor: '#141414', borderRadius: 14, padding: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  iconBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: '#737373', fontWeight: '500', marginTop: 2 },
  statSub: { fontSize: 10, color: '#525252', marginTop: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#141414', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  searchInput: { flex: 1, fontSize: 14, color: '#e5e5e5' },
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatarBadge: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  partnerType: { fontSize: 11, color: '#525252', marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1f1f1f', paddingVertical: 12 },
  divider: { width: 1, height: 28, backgroundColor: '#2a2a2a' },
  inlineStatLabel: { fontSize: 10, color: '#525252', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  inlineStatValue: { fontSize: 13, fontWeight: '700', color: '#e5e5e5', marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  btnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingVertical: 9 },
  btnOutlineText: { fontSize: 12, fontWeight: '600', color: '#e5e5e5' },
  modalBg: { flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#141414', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2a2a2a' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalSub: { fontSize: 12, color: '#737373', marginTop: 2 },
  modalInput: { marginTop: 14, backgroundColor: '#1c1c1c', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', padding: 12, color: '#e5e5e5', fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
})
