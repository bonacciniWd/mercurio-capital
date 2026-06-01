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
  ArrowLeft, Plus, X, Trash2, Edit2, AlertTriangle, Flag,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

interface FeatureFlag {
  id: string; chave: string; descricao: string | null
  regras: { roles?: string[]; partner_ids?: string[]; percent?: number }
  ativo: boolean
}

const ROLES = ['admin', 'partner', 'team_member', 'client'] as const

function emptyDraft(): Partial<FeatureFlag> {
  return { chave: '', descricao: '', regras: { roles: [], percent: 100 }, ativo: false }
}

export default function FeatureFlags() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<FeatureFlag> | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const flagsQuery = useQuery({
    queryKey: ['admin-feature-flags-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_admin_feature_flags').select('*')
      if (error) throw error
      return (data ?? []) as FeatureFlag[]
    },
  })
  const flags = flagsQuery.data ?? []

  const upsertMut = useMutation({
    mutationFn: async (f: Partial<FeatureFlag>) => {
      const { error } = await supabase.rpc('admin_feature_flag_upsert', {
        p_chave: f.chave, p_descricao: f.descricao ?? null,
        p_regras: f.regras ?? {}, p_ativo: f.ativo ?? false,
        p_id: f.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-feature-flags-mobile'] })
      setEditing(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: async (f: FeatureFlag) => {
      const { error } = await supabase.rpc('admin_feature_flag_upsert', {
        p_chave: f.chave, p_descricao: f.descricao,
        p_regras: f.regras, p_ativo: !f.ativo, p_id: f.id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-feature-flags-mobile'] }),
    onError: (e: Error) => setErro(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_feature_flag_delete', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-feature-flags-mobile'] }),
    onError: (e: Error) => setErro(e.message),
  })

  function toggleRole(r: string) {
    setEditing(prev => {
      if (!prev) return prev
      const roles = prev.regras?.roles ?? []
      const next = roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r]
      return { ...prev, regras: { ...(prev.regras ?? {}), roles: next } }
    })
  }

  function confirmDelete(f: FeatureFlag) {
    Alert.alert('Remover flag', `Remover "${f.chave}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => deleteMut.mutate(f.id) },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Feature Flags</Text>
        </View>
        <Pressable style={s.newBtn} onPress={() => setEditing(emptyDraft())}>
          <Plus size={15} color="#fff" />
          <Text style={s.newBtnText}>Nova</Text>
        </Pressable>
      </View>

      {flagsQuery.isLoading ? (
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

          {flags.length === 0 ? (
            <View style={s.empty}>
              <Flag size={28} color="#525252" />
              <Text style={s.emptyText}>Nenhuma feature flag.</Text>
            </View>
          ) : flags.map(f => {
            const accent = f.ativo ? '#16A34A' : '#525252'
            const isGlobal = !f.regras?.roles?.length &&
              (f.regras?.percent === undefined || f.regras.percent === 100)
            return (
              <View key={f.id} style={[s.card, { borderTopColor: accent }]}>
                <View style={s.cardTop}>
                  <View style={[s.iconBadge, { backgroundColor: '#DC262622' }]}>
                    <Flag size={16} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.chave} numberOfLines={1}>{f.chave}</Text>
                    {f.descricao && <Text style={s.desc} numberOfLines={2}>{f.descricao}</Text>}
                  </View>
                  <Switch value={f.ativo}
                    onValueChange={() => toggleMut.mutate(f)}
                    trackColor={{ true: '#DC2626', false: '#2a2a2a' }} thumbColor="#fff"
                    style={{ transform: [{ scale: 0.85 }] }} />
                </View>
                <View style={s.regras}>
                  {f.regras?.roles?.length ? (
                    <View style={s.regraPill}>
                      <Text style={s.regraText}>roles: {f.regras.roles.join(', ')}</Text>
                    </View>
                  ) : null}
                  {typeof f.regras?.percent === 'number' && f.regras.percent < 100 ? (
                    <View style={[s.regraPill, { backgroundColor: '#F59E0B22' }]}>
                      <Text style={[s.regraText, { color: '#F59E0B' }]}>rollout {f.regras.percent}%</Text>
                    </View>
                  ) : null}
                  {isGlobal && (
                    <View style={[s.regraPill, { backgroundColor: '#16A34A22' }]}>
                      <Text style={[s.regraText, { color: '#16A34A' }]}>global</Text>
                    </View>
                  )}
                </View>
                <View style={s.actions}>
                  <Pressable style={s.actionBtn} onPress={() => setEditing({ ...f })}>
                    <Edit2 size={13} color="#a3a3a3" />
                    <Text style={s.actionText}>Editar</Text>
                  </Pressable>
                  <Pressable style={s.actionDel} onPress={() => confirmDelete(f)}>
                    <Trash2 size={13} color="#DC2626" />
                  </Pressable>
                </View>
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
                <Text style={s.modalTitle}>{editing?.id ? 'Editar flag' : 'Nova flag'}</Text>
                <Pressable onPress={() => setEditing(null)}><X size={20} color="#737373" /></Pressable>
              </View>

              <Field label="Chave">
                <TextInput value={editing?.chave ?? ''}
                  onChangeText={v => setEditing(s => s ? { ...s, chave: v } : s)}
                  placeholder="ex: universidade_paga" placeholderTextColor="#525252"
                  style={[s.input, { fontFamily: 'monospace' }]} autoCapitalize="none" />
              </Field>

              <Field label="Descrição">
                <TextInput value={editing?.descricao ?? ''}
                  onChangeText={v => setEditing(s => s ? { ...s, descricao: v } : s)}
                  placeholderTextColor="#525252" style={s.input} />
              </Field>

              <Field label="Roles permitidas (vazio = todas)">
                <View style={s.rolesRow}>
                  {ROLES.map(r => {
                    const on = (editing?.regras?.roles ?? []).includes(r)
                    return (
                      <Pressable key={r} onPress={() => toggleRole(r)}
                        style={[s.rolePill, on && s.rolePillActive]}>
                        <Text style={[s.roleText, on && { color: '#fff' }]}>{r}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </Field>

              <Field label="Rollout (%)">
                <TextInput
                  value={String(editing?.regras?.percent ?? 100)}
                  onChangeText={v => setEditing(s => s ? {
                    ...s, regras: { ...(s.regras ?? {}), percent: Number(v.replace(/\D/g, '')) || 0 }
                  } : s)}
                  keyboardType="numeric" placeholderTextColor="#525252"
                  style={[s.input, { width: 100 }]} />
              </Field>

              <View style={s.switchRow}>
                <Text style={s.switchLabel}>Ativo</Text>
                <Switch value={editing?.ativo ?? false}
                  onValueChange={v => setEditing(s => s ? { ...s, ativo: v } : s)}
                  trackColor={{ true: '#DC2626', false: '#2a2a2a' }} thumbColor="#fff"
                  style={{ transform: [{ scale: 0.85 }] }} />
              </View>

              <View style={s.modalActions}>
                <Pressable style={s.modalCancel} onPress={() => setEditing(null)}>
                  <Text style={s.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[s.modalConfirm, (!editing?.chave || upsertMut.isPending) && { opacity: 0.5 }]}
                  disabled={!editing?.chave || upsertMut.isPending}
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

  empty: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 32, alignItems: 'center', gap: 10 },
  emptyText: { color: '#525252', fontSize: 13 },

  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chave: { fontSize: 14, fontWeight: '700', color: '#e5e5e5', fontFamily: 'monospace' },
  desc: { fontSize: 11, color: '#737373', marginTop: 3 },

  regras: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  regraPill: { backgroundColor: '#1c1c1c', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  regraText: { fontSize: 10, fontWeight: '600', color: '#a3a3a3' },

  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  actionText: { fontSize: 12, fontWeight: '600', color: '#a3a3a3' },
  actionDel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DC262640', alignItems: 'center', justifyContent: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0f0f0f', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },

  fieldLabel: { fontSize: 11, color: '#737373', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', padding: 11, color: '#fff', fontSize: 13 },

  rolesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rolePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1c1c1c', borderWidth: 1, borderColor: '#2a2a2a' },
  rolePillActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  roleText: { fontSize: 11, fontWeight: '600', color: '#737373' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchLabel: { fontSize: 13, color: '#a3a3a3' },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalCancel: { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  modalCancelText: { color: '#a3a3a3', fontWeight: '600' },
  modalConfirm: { flex: 1, padding: 13, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
})

