import { useMemo } from 'react'
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Users, Lock, Unlock, UserMinus, MailX, Clock, ShieldOff, CheckCircle2, Mail,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

type PartnerHeader = {
  partner_id: string; status: string; nome: string; email: string
  equipes_count: number; membros_count: number
}
type EquipeRow = {
  equipe_id: string; partner_id: string; nome: string; isolamento_estrito: boolean
  created_at: string; membros_total: number; membros_suspensos: number; convites_abertos: number
}
type MembroRow = {
  id: string; equipe_id: string; partner_id: string; usuario_id: string
  nome_completo: string | null; email: string | null
  papel_equipe: 'admin_equipe' | 'membro'
  permissoes: Record<string, unknown> | null
  aceito_em: string | null
}
type ConviteRow = {
  id: string; equipe_id: string; partner_id: string
  email: string | null; nome: string | null
  papel_equipe: 'admin_equipe' | 'membro' | null
  expires_at: string
}

function fmt(s: string | null | undefined) {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('pt-BR') } catch { return '—' }
}
function isSuspenso(p: Record<string, unknown> | null) {
  if (!p) return false
  const v = (p as { suspenso?: unknown }).suspenso
  return v === true || v === 'true'
}

export default function PartnerEquipes() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>()
  const qc = useQueryClient()

  const partnerQuery = useQuery({
    queryKey: ['admin-partner-header-mobile', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_partners')
        .select('partner_id, status, nome, email, equipes_count, membros_count')
        .eq('partner_id', partnerId!).maybeSingle()
      if (error) throw error
      return (data ?? null) as PartnerHeader | null
    },
  })

  const equipesQuery = useQuery({
    queryKey: ['admin-partner-equipes-mobile', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_partner_equipes').select('*')
        .eq('partner_id', partnerId!).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as EquipeRow[]
    },
  })

  const membrosQuery = useQuery({
    queryKey: ['admin-partner-membros-mobile', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_membros_detalhe')
        .select('id, equipe_id, partner_id, usuario_id, nome_completo, email, papel_equipe, permissoes, aceito_em')
        .eq('partner_id', partnerId!)
      if (error) throw error
      return (data ?? []) as MembroRow[]
    },
  })

  const convitesQuery = useQuery({
    queryKey: ['admin-partner-convites-mobile', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_convites_pendentes')
        .select('id, equipe_id, partner_id, email, nome, papel_equipe, expires_at')
        .eq('partner_id', partnerId!)
      if (error) throw error
      return (data ?? []) as ConviteRow[]
    },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-partner-equipes-mobile', partnerId] })
    qc.invalidateQueries({ queryKey: ['admin-partner-membros-mobile', partnerId] })
    qc.invalidateQueries({ queryKey: ['admin-partner-convites-mobile', partnerId] })
  }

  const suspendMut = useMutation({
    mutationFn: async (v: { equipe_id: string; usuario_id: string; suspenso: boolean }) => {
      const { error } = await supabase.rpc('admin_set_equipe_membro_suspenso', {
        p_equipe_id: v.equipe_id, p_usuario_id: v.usuario_id, p_suspenso: v.suspenso,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const removeMut = useMutation({
    mutationFn: async (v: { equipe_id: string; usuario_id: string }) => {
      const { error } = await supabase.rpc('partner_remove_membro', {
        p_equipe_id: v.equipe_id, p_usuario_id: v.usuario_id,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const revokeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_revoke_equipe_membro_convite', { p_magic_link_id: id })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const partner = partnerQuery.data
  const equipes = equipesQuery.data ?? []
  const membros = membrosQuery.data ?? []
  const convites = convitesQuery.data ?? []

  const membrosByEquipe = useMemo(() => {
    const m = new Map<string, MembroRow[]>()
    for (const row of membros) {
      if (!m.has(row.equipe_id)) m.set(row.equipe_id, [])
      m.get(row.equipe_id)!.push(row)
    }
    return m
  }, [membros])
  const convitesByEquipe = useMemo(() => {
    const m = new Map<string, ConviteRow[]>()
    for (const row of convites) {
      if (!m.has(row.equipe_id)) m.set(row.equipe_id, [])
      m.get(row.equipe_id)!.push(row)
    }
    return m
  }, [convites])

  const loading = partnerQuery.isLoading || equipesQuery.isLoading || membrosQuery.isLoading

  function confirmRemove(equipe_id: string, usuario_id: string, nome: string) {
    Alert.alert('Remover membro', `Remover ${nome} da equipe? Esta ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removeMut.mutate({ equipe_id, usuario_id }) },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)/parceiros' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN · EQUIPES</Text>
          <Text style={s.headerTitle} numberOfLines={1}>{partner?.nome ?? '…'}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : !partner ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: '#737373', fontSize: 13 }}>Parceiro não encontrado.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          <View style={s.summary}>
            <Text style={s.summaryEmail}>{partner.email}</Text>
            <View style={s.summaryStats}>
              <View style={s.summaryStat}>
                <Text style={s.summaryValue}>{partner.equipes_count}</Text>
                <Text style={s.summaryLabel}>equipes</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryStat}>
                <Text style={s.summaryValue}>{partner.membros_count}</Text>
                <Text style={s.summaryLabel}>membros</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={[s.statusBadge, {
                backgroundColor:
                  partner.status === 'approved' ? '#16A34A22' :
                  partner.status === 'suspended' ? '#DC262622' : '#F59E0B22',
              }]}>
                <Text style={[s.statusText, {
                  color:
                    partner.status === 'approved' ? '#16A34A' :
                    partner.status === 'suspended' ? '#DC2626' : '#F59E0B',
                }]}>{partner.status}</Text>
              </View>
            </View>
          </View>

          {equipes.length === 0 ? (
            <View style={s.empty}>
              <Users size={28} color="#525252" />
              <Text style={s.emptyText}>Este parceiro ainda não criou nenhuma equipe.</Text>
            </View>
          ) : equipes.map(eq => {
            const ms = membrosByEquipe.get(eq.equipe_id) ?? []
            const cs = convitesByEquipe.get(eq.equipe_id) ?? []
            return (
              <View key={eq.equipe_id} style={s.card}>
                <View style={s.cardHead}>
                  <View style={[s.iconBadge, { backgroundColor: '#DC262622' }]}>
                    <Users size={16} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.equipeNome} numberOfLines={1}>{eq.nome}</Text>
                    <Text style={s.equipeMeta}>
                      {eq.membros_total} membros{eq.membros_suspensos > 0 ? ` · ${eq.membros_suspensos} susp` : ''}{eq.convites_abertos > 0 ? ` · ${eq.convites_abertos} convites` : ''}
                    </Text>
                  </View>
                  {eq.isolamento_estrito && (
                    <View style={[s.miniPill, { backgroundColor: '#F59E0B22' }]}>
                      <Lock size={9} color="#F59E0B" />
                      <Text style={[s.miniText, { color: '#F59E0B' }]}>isolado</Text>
                    </View>
                  )}
                </View>

                {ms.map((m, i) => {
                  const susp = isSuspenso(m.permissoes)
                  return (
                    <View key={m.id} style={[s.memberRow, i === 0 && { borderTopWidth: 1, borderTopColor: '#1f1f1f' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.memberNome}>{m.nome_completo ?? '—'}</Text>
                        <Text style={s.memberEmail} numberOfLines={1}>{m.email ?? '—'}</Text>
                        <View style={s.memberMeta}>
                          <View style={[s.miniPill, { backgroundColor: m.papel_equipe === 'admin_equipe' ? '#16A34A22' : '#26262670' }]}>
                            <Text style={[s.miniText, { color: m.papel_equipe === 'admin_equipe' ? '#16A34A' : '#a3a3a3' }]}>
                              {m.papel_equipe}
                            </Text>
                          </View>
                          {susp ? (
                            <View style={[s.miniPill, { backgroundColor: '#DC262622' }]}>
                              <ShieldOff size={9} color="#DC2626" />
                              <Text style={[s.miniText, { color: '#DC2626' }]}>suspenso</Text>
                            </View>
                          ) : (
                            <View style={[s.miniPill, { backgroundColor: '#16A34A22' }]}>
                              <CheckCircle2 size={9} color="#16A34A" />
                              <Text style={[s.miniText, { color: '#16A34A' }]}>ativo</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={{ gap: 6 }}>
                        <Pressable style={s.smallBtn} disabled={suspendMut.isPending}
                          onPress={() => suspendMut.mutate({ equipe_id: m.equipe_id, usuario_id: m.usuario_id, suspenso: !susp })}>
                          {susp ? <Unlock size={12} color="#a3a3a3" /> : <Lock size={12} color="#a3a3a3" />}
                          <Text style={s.smallBtnText}>{susp ? 'Reativar' : 'Suspender'}</Text>
                        </Pressable>
                        <Pressable style={s.smallBtnDanger}
                          onPress={() => confirmRemove(m.equipe_id, m.usuario_id, m.nome_completo ?? m.email ?? 'este membro')}>
                          <UserMinus size={12} color="#DC2626" />
                          <Text style={s.smallBtnDangerText}>Remover</Text>
                        </Pressable>
                      </View>
                    </View>
                  )
                })}

                {cs.length > 0 && (
                  <View style={s.invitesWrap}>
                    <View style={s.invitesHeader}>
                      <Mail size={11} color="#F59E0B" />
                      <Text style={s.invitesTitle}>Convites pendentes ({cs.length})</Text>
                    </View>
                    {cs.map(c => (
                      <View key={c.id} style={s.inviteRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.inviteNome} numberOfLines={1}>{c.nome ?? c.email ?? '—'}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Clock size={9} color="#525252" />
                            <Text style={s.inviteMeta}>expira em {fmt(c.expires_at)} · {c.papel_equipe ?? '—'}</Text>
                          </View>
                        </View>
                        <Pressable style={s.smallBtnDanger} disabled={revokeMut.isPending} onPress={() => revokeMut.mutate(c.id)}>
                          <MailX size={12} color="#DC2626" />
                          <Text style={s.smallBtnDangerText}>Revogar</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {ms.length === 0 && cs.length === 0 && (
                  <Text style={s.emptyInner}>Equipe sem membros e sem convites.</Text>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginTop: 1 },

  summary: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 14 },
  summaryEmail: { fontSize: 12, color: '#737373', fontFamily: 'monospace' },
  summaryStats: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  summaryLabel: { fontSize: 10, color: '#525252', textTransform: 'uppercase', marginTop: 2 },
  summaryDivider: { width: 1, height: 30, backgroundColor: '#2a2a2a' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  empty: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center' },
  emptyInner: { padding: 16, color: '#525252', fontSize: 11, textAlign: 'center' },

  card: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBadge: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  equipeNome: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  equipeMeta: { fontSize: 11, color: '#737373', marginTop: 2 },

  miniPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  miniText: { fontSize: 9, fontWeight: '700', textTransform: 'lowercase' },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  memberNome: { fontSize: 13, color: '#e5e5e5', fontWeight: '600' },
  memberEmail: { fontSize: 10, color: '#737373', fontFamily: 'monospace', marginTop: 1 },
  memberMeta: { flexDirection: 'row', gap: 5, marginTop: 5 },

  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  smallBtnText: { fontSize: 10, fontWeight: '600', color: '#a3a3a3' },
  smallBtnDanger: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#DC262640', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  smallBtnDangerText: { fontSize: 10, fontWeight: '600', color: '#DC2626' },

  invitesWrap: { backgroundColor: '#F59E0B0A', borderTopWidth: 1, borderTopColor: '#F59E0B30', paddingVertical: 8, paddingHorizontal: 14 },
  invitesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  invitesTitle: { fontSize: 10, fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 0.5 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  inviteNome: { fontSize: 12, fontWeight: '600', color: '#e5e5e5' },
  inviteMeta: { fontSize: 10, color: '#737373' },
})

