import { useState } from 'react'
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Modal, Switch, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Send, X, AlertTriangle, Edit2, Trash2,
  Mail, Bell, CalendarClock, Megaphone,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

type Canal = 'in_app' | 'email' | 'whatsapp' | 'push'
type Status = 'rascunho' | 'agendada' | 'enviada' | 'cancelada'

interface PublicoAlvo { roles?: string[]; partner_ids?: string[] }
interface Campanha {
  id: string; nome: string; publico_alvo: PublicoAlvo; canais: Canal[]
  template: string; agendado_para: string | null; status: Status
  metricas: { in_app?: number; email_enfileirados?: number; disparado_em?: string }
  created_at: string; updated_at: string
}
interface TplMin { id: string; codigo: string; canal: Canal; nome: string }

const STATUS_COLOR: Record<Status, string> = {
  rascunho: '#525252', agendada: '#F59E0B', enviada: '#16A34A', cancelada: '#DC2626',
}
const STATUS_LBL: Record<Status, string> = {
  rascunho: 'Rascunho', agendada: 'Agendada', enviada: 'Enviada', cancelada: 'Cancelada',
}
const CANAL_ICON: Record<Canal, any> = { in_app: Bell, email: Mail, whatsapp: Mail, push: Mail }

function emptyDraft(): Partial<Campanha> {
  return {
    nome: '', publico_alvo: { roles: ['partner'] }, canais: ['in_app'],
    template: '', agendado_para: null, status: 'rascunho',
  }
}

export default function Campanhas() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<Campanha> | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const campQuery = useQuery({
    queryKey: ['admin-campanhas-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_campanhas').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Campanha[]
    },
  })
  const campanhas = campQuery.data ?? []

  const tplQuery = useQuery({
    queryKey: ['admin-templates-min-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_templates').select('id, codigo, canal, nome').eq('ativo', true)
      if (error) throw error
      return (data ?? []) as TplMin[]
    },
  })
  const templates = tplQuery.data ?? []

  const upsertMut = useMutation({
    mutationFn: async (c: Partial<Campanha>) => {
      const { error } = await supabase.rpc('admin_campanha_upsert', {
        p_nome: c.nome, p_template: c.template, p_id: c.id ?? null,
        p_publico_alvo: c.publico_alvo ?? {},
        p_canais: c.canais ?? ['in_app'],
        p_agendado_para: c.agendado_para ?? null,
        p_status: c.status ?? 'rascunho',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-campanhas-mobile'] })
      setEditing(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  const cancelarMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_campanha_cancelar', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-campanhas-mobile'] }),
    onError: (e: Error) => setErro(e.message),
  })

  const dispararMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_campanha_disparar', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-campanhas-mobile'] }),
    onError: (e: Error) => setErro(e.message),
  })

  function toggleCanal(c: Canal) {
    setEditing(st => {
      if (!st) return st
      const canais = st.canais ?? []
      return { ...st, canais: canais.includes(c) ? canais.filter(x => x !== c) : [...canais, c] }
    })
  }
  function toggleRole(r: string) {
    setEditing(st => {
      if (!st) return st
      const roles = st.publico_alvo?.roles ?? []
      const next = roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r]
      return { ...st, publico_alvo: { ...(st.publico_alvo ?? {}), roles: next } }
    })
  }

  function confirmDisparar(c: Campanha) {
    Alert.alert('Disparar campanha?', `"${c.nome}" — notificações in-app são criadas imediatamente; e-mails entram na fila.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Disparar', style: 'destructive', onPress: () => dispararMut.mutate(c.id) },
    ])
  }
  function confirmCancelar(c: Campanha) {
    Alert.alert('Cancelar campanha?', `"${c.nome}" será cancelada.`, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar', style: 'destructive', onPress: () => cancelarMut.mutate(c.id) },
    ])
  }

  const ativas = campanhas.filter(c => c.status === 'agendada' || c.status === 'enviada').length
  const enviadas = campanhas.filter(c => c.status === 'enviada').length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Campanhas</Text>
        </View>
        <Pressable style={s.newBtn} onPress={() => setEditing(emptyDraft())}>
          <Plus size={15} color="#fff" />
          <Text style={s.newBtnText}>Nova</Text>
        </Pressable>
      </View>

      {campQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
          {erro && (
            <View style={s.errBox}>
              <AlertTriangle size={14} color="#DC2626" />
              <Text style={s.errText}>{erro}</Text>
              <Pressable onPress={() => setErro(null)}><X size={14} color="#DC2626" /></Pressable>
            </View>
          )}

          <View style={s.grid}>
            <Stat accent="#16A34A" value={String(ativas)} label="Ativas/agendadas" />
            <Stat accent="#38BDF8" value={String(enviadas)} label="Enviadas" />
            <Stat accent="#DC2626" value={String(campanhas.length)} label="Total" />
          </View>

          {campanhas.length === 0 ? (
            <View style={s.empty}>
              <Megaphone size={28} color="#525252" />
              <Text style={s.emptyText}>Nenhuma campanha cadastrada.</Text>
            </View>
          ) : campanhas.map(c => {
            const color = STATUS_COLOR[c.status]
            return (
              <View key={c.id} style={[s.card, { borderTopColor: color }]}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{c.nome}</Text>
                    <Text style={s.cardCode} numberOfLines={1}>{c.template}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: color + '22' }]}>
                    <Text style={[s.statusText, { color }]}>{STATUS_LBL[c.status]}</Text>
                  </View>
                </View>
                <View style={s.metaRow}>
                  <View style={s.canalsRow}>
                    {c.canais.map(k => {
                      const I = CANAL_ICON[k]
                      return (
                        <View key={k} style={s.canalChip}>
                          <I size={9} color="#a3a3a3" />
                          <Text style={s.canalText}>{k}</Text>
                        </View>
                      )
                    })}
                  </View>
                  {c.agendado_para && (
                    <View style={s.scheduleRow}>
                      <CalendarClock size={10} color="#F59E0B" />
                      <Text style={s.scheduleText}>{new Date(c.agendado_para).toLocaleString('pt-BR')}</Text>
                    </View>
                  )}
                </View>
                {c.status === 'enviada' && (
                  <View style={s.metricsRow}>
                    <View style={s.metric}>
                      <Text style={s.metricLabel}>IN-APP</Text>
                      <Text style={s.metricValue}>{c.metricas?.in_app ?? 0}</Text>
                    </View>
                    <View style={s.metricDivider} />
                    <View style={s.metric}>
                      <Text style={s.metricLabel}>E-MAILS</Text>
                      <Text style={s.metricValue}>{c.metricas?.email_enfileirados ?? 0}</Text>
                    </View>
                  </View>
                )}
                {(c.status === 'rascunho' || c.status === 'agendada') && (
                  <View style={s.actions}>
                    <Pressable style={s.actionBtn} onPress={() => setEditing({ ...c })}>
                      <Edit2 size={13} color="#a3a3a3" />
                      <Text style={s.actionText}>Editar</Text>
                    </Pressable>
                    <Pressable style={[s.actionBtn, { borderColor: '#16A34A40' }]} onPress={() => confirmDisparar(c)}>
                      <Send size={13} color="#16A34A" />
                      <Text style={[s.actionText, { color: '#16A34A' }]}>Disparar</Text>
                    </Pressable>
                    <Pressable style={s.actionDel} onPress={() => confirmCancelar(c)}>
                      <Trash2 size={13} color="#DC2626" />
                    </Pressable>
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setEditing(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 12 }} keyboardShouldPersistTaps="handled">
              <View style={s.modalHead}>
                <Text style={s.modalTitle}>{editing?.id ? 'Editar campanha' : 'Nova campanha'}</Text>
                <Pressable onPress={() => setEditing(null)}><X size={20} color="#737373" /></Pressable>
              </View>

              <Field label="Nome">
                <TextInput value={editing?.nome ?? ''}
                  onChangeText={v => setEditing(st => st ? { ...st, nome: v } : st)}
                  placeholderTextColor="#525252" style={s.input} />
              </Field>

              <Field label="Template">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {templates.map(t => {
                      const on = editing?.template === t.codigo
                      return (
                        <Pressable key={t.codigo} onPress={() => setEditing(st => st ? { ...st, template: t.codigo } : st)}
                          style={[s.choicePill, on && s.choicePillActive]}>
                          <Text style={[s.choiceText, on && { color: '#fff' }]} numberOfLines={1}>
                            {t.nome} · {t.canal}
                          </Text>
                        </Pressable>
                      )
                    })}
                    {templates.length === 0 && (
                      <Text style={s.hint}>Nenhum template ativo. Crie um em Templates.</Text>
                    )}
                  </View>
                </ScrollView>
              </Field>

              <Field label="Canais">
                <View style={s.rolesRow}>
                  {(['in_app', 'email'] as Canal[]).map(k => {
                    const on = (editing?.canais ?? []).includes(k)
                    return (
                      <Pressable key={k} onPress={() => toggleCanal(k)}
                        style={[s.choicePill, on && s.choicePillActive]}>
                        <Text style={[s.choiceText, on && { color: '#fff' }]}>{k}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </Field>

              <Field label="Público (roles) — vazio = todos">
                <View style={s.rolesRow}>
                  {['admin', 'partner', 'team_member', 'client'].map(r => {
                    const on = (editing?.publico_alvo?.roles ?? []).includes(r)
                    return (
                      <Pressable key={r} onPress={() => toggleRole(r)}
                        style={[s.choicePill, on && s.choicePillActive]}>
                        <Text style={[s.choiceText, on && { color: '#fff' }]}>{r}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </Field>

              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.switchLabel}>Agendar (em ~1h)</Text>
                  <Text style={s.hint}>
                    {editing?.agendado_para
                      ? new Date(editing.agendado_para).toLocaleString('pt-BR')
                      : 'Sem agendamento'}
                  </Text>
                </View>
                <Switch value={!!editing?.agendado_para}
                  onValueChange={v => setEditing(st => {
                    if (!st) return st
                    if (v) {
                      const d = new Date(); d.setHours(d.getHours() + 1)
                      return { ...st, agendado_para: d.toISOString(), status: 'agendada' }
                    }
                    return { ...st, agendado_para: null, status: 'rascunho' }
                  })}
                  trackColor={{ true: '#DC2626', false: '#2a2a2a' }} thumbColor="#fff"
                  style={{ transform: [{ scale: 0.85 }] }} />
              </View>

              <View style={s.modalActions}>
                <Pressable style={s.modalCancel} onPress={() => setEditing(null)}>
                  <Text style={s.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[s.modalConfirm, (!editing?.nome || !editing?.template || upsertMut.isPending) && { opacity: 0.5 }]}
                  disabled={!editing?.nome || !editing?.template || upsertMut.isPending}
                  onPress={() => editing && upsertMut.mutate(editing)}>
                  {upsertMut.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.modalConfirmText}>Salvar</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function Stat({ accent, value, label }: { accent: string; value: string; label: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: accent }]}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7 },
  newBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DC262615', borderWidth: 1, borderColor: '#DC262640', borderRadius: 10, padding: 10 },
  errText: { color: '#DC2626', fontSize: 12, flex: 1 },

  grid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#141414', borderRadius: 12, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 9, color: '#737373', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 },

  empty: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { color: '#525252', fontSize: 13 },

  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, paddingBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  cardCode: { fontSize: 10, color: '#525252', fontFamily: 'monospace', marginTop: 2 },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  metaRow: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  canalsRow: { flexDirection: 'row', gap: 5 },
  canalChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  canalText: { fontSize: 9, color: '#a3a3a3', fontWeight: '600' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scheduleText: { fontSize: 10, color: '#F59E0B' },

  metricsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1f1f1f', paddingVertical: 10 },
  metric: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 9, color: '#525252', fontWeight: '600' },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#e5e5e5', marginTop: 2 },
  metricDivider: { width: 1, height: 24, backgroundColor: '#2a2a2a' },

  actions: { flexDirection: 'row', gap: 8, padding: 14, paddingTop: 0 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  actionText: { fontSize: 11, fontWeight: '700', color: '#a3a3a3' },
  actionDel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DC262640' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0f0f0f', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },

  fieldLabel: { fontSize: 11, color: '#737373', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', padding: 11, color: '#fff', fontSize: 13 },

  rolesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  choicePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1c1c1c', borderWidth: 1, borderColor: '#2a2a2a', maxWidth: 220 },
  choicePillActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  choiceText: { fontSize: 11, fontWeight: '600', color: '#737373' },
  hint: { fontSize: 11, color: '#525252' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchLabel: { fontSize: 13, color: '#a3a3a3' },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalCancel: { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  modalCancelText: { color: '#a3a3a3', fontWeight: '600' },
  modalConfirm: { flex: 1, padding: 13, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
})

