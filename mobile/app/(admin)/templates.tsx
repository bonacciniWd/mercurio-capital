import { useState } from 'react'
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Modal, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Edit2, Trash2, X, AlertTriangle, Mail, Bell, MessageSquare, Smartphone,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

type Canal = 'in_app' | 'email' | 'whatsapp' | 'push'

interface Template {
  id: string; codigo: string; canal: Canal; nome: string
  assunto: string | null; corpo: string; variaveis: string[]; ativo: boolean
  wa_template_nome: string | null; wa_idioma: string | null
}

const CANAL_ICON: Record<Canal, any> = {
  in_app: Bell, email: Mail, whatsapp: MessageSquare, push: Smartphone,
}
const CANAL_LBL: Record<Canal, string> = {
  in_app: 'In-app', email: 'E-mail', whatsapp: 'WhatsApp', push: 'Push',
}

function emptyDraft(): Partial<Template> {
  return { codigo: '', canal: 'in_app', nome: '', assunto: '', corpo: '', variaveis: [], ativo: true, wa_template_nome: null, wa_idioma: 'pt_BR' }
}

export default function Templates() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<Template> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [varsText, setVarsText] = useState('')

  const tplQuery = useQuery({
    queryKey: ['admin-templates-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_templates').select('*').order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Template[]
    },
  })
  const templates = tplQuery.data ?? []

  const upsertMut = useMutation({
    mutationFn: async (t: Partial<Template>) => {
      const { error } = await supabase.rpc('admin_template_upsert', {
        p_codigo: t.codigo, p_canal: t.canal, p_nome: t.nome, p_corpo: t.corpo,
        p_id: t.id ?? null, p_assunto: t.assunto ?? null,
        p_variaveis: t.variaveis ?? [], p_ativo: t.ativo ?? true,
        p_wa_template_nome: t.canal === 'whatsapp' ? (t.wa_template_nome?.trim() || null) : null,
        p_wa_idioma: t.canal === 'whatsapp' ? (t.wa_idioma?.trim() || 'pt_BR') : 'pt_BR',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-templates-mobile'] })
      setEditing(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_template_delete', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates-mobile'] }),
    onError: (e: Error) => setErro(e.message),
  })

  function openEdit(t?: Template) {
    const draft = t ? { ...t } : emptyDraft()
    setEditing(draft)
    setVarsText((draft.variaveis ?? []).join(', '))
    setErro(null)
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
          <Text style={s.headerTitle}>Templates</Text>
        </View>
        <Pressable style={s.newBtn} onPress={() => openEdit()}>
          <Plus size={15} color="#fff" />
          <Text style={s.newBtnText}>Novo</Text>
        </Pressable>
      </View>

      {tplQuery.isLoading ? (
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

          {templates.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>Nenhum template cadastrado.</Text>
            </View>
          ) : templates.map(t => {
            const Icon = CANAL_ICON[t.canal]
            const accent = t.ativo ? '#16A34A' : '#525252'
            return (
              <View key={t.id} style={[s.card, { borderTopColor: accent }]}>
                <View style={s.cardTop}>
                  <View style={[s.iconBadge, { backgroundColor: '#DC262622' }]}>
                    <Icon size={16} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nome} numberOfLines={1}>{t.nome}</Text>
                    <Text style={s.codigo} numberOfLines={1}>{t.codigo}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: accent + '22' }]}>
                    <Text style={[s.statusText, { color: accent }]}>{t.ativo ? 'ativo' : 'off'}</Text>
                  </View>
                </View>
                <View style={s.meta}>
                  <View style={s.metaTag}>
                    <Text style={s.metaText}>{CANAL_LBL[t.canal]}</Text>
                  </View>
                  {t.variaveis.length > 0 && (
                    <Text style={s.vars} numberOfLines={1}>
                      {t.variaveis.map(v => `{{${v}}}`).join(' ')}
                    </Text>
                  )}
                </View>
                <View style={s.actions}>
                  <Pressable style={s.actionBtn} onPress={() => openEdit(t)}>
                    <Edit2 size={13} color="#a3a3a3" />
                    <Text style={s.actionText}>Editar</Text>
                  </Pressable>
                  <Pressable style={s.actionDel} onPress={() => deleteMut.mutate(t.id)} disabled={deleteMut.isPending}>
                    <Trash2 size={13} color="#DC2626" />
                  </Pressable>
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* Edit modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setEditing(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 10 }} keyboardShouldPersistTaps="handled">
              <View style={s.modalHead}>
                <Text style={s.modalTitle}>{editing?.id ? 'Editar template' : 'Novo template'}</Text>
                <Pressable onPress={() => setEditing(null)}><X size={20} color="#737373" /></Pressable>
              </View>

              <Field label="Código (único)">
                <TextInput value={editing?.codigo ?? ''} onChangeText={v => setEditing(s => s ? { ...s, codigo: v } : s)}
                  placeholder="boas_vindas_partner_v1" placeholderTextColor="#525252"
                  style={[s.input, { fontFamily: 'monospace' }]} autoCapitalize="none" />
              </Field>

              <Field label="Canal">
                <View style={s.segRow}>
                  {(['in_app', 'email', 'whatsapp', 'push'] as Canal[]).map(c => {
                    const on = editing?.canal === c
                    return (
                      <Pressable key={c} onPress={() => setEditing(s => s ? { ...s, canal: c } : s)}
                        style={[s.segPill, on && s.segPillActive]}>
                        <Text style={[s.segText, on && { color: '#fff' }]}>{CANAL_LBL[c]}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </Field>

              <Field label="Nome">
                <TextInput value={editing?.nome ?? ''} onChangeText={v => setEditing(s => s ? { ...s, nome: v } : s)}
                  placeholderTextColor="#525252" style={s.input} />
              </Field>

              {(editing?.canal === 'email' || editing?.canal === 'in_app') && (
                <Field label="Assunto / título">
                  <TextInput value={editing.assunto ?? ''} onChangeText={v => setEditing(s => s ? { ...s, assunto: v } : s)}
                    placeholder="Use {{variaveis}} aqui" placeholderTextColor="#525252" style={s.input} />
                </Field>
              )}

              {editing?.canal === 'whatsapp' && (
                <>
                  <Field label="Nome do template WhatsApp (Cloud API)">
                    <TextInput value={editing.wa_template_nome ?? ''}
                      onChangeText={v => setEditing(s => s ? { ...s, wa_template_nome: v } : s)}
                      placeholder="ex.: convite_parceiro_v1" placeholderTextColor="#525252"
                      style={[s.input, { fontFamily: 'monospace' }]} autoCapitalize="none" />
                  </Field>
                  <Field label="Idioma do template">
                    <TextInput value={editing.wa_idioma ?? 'pt_BR'}
                      onChangeText={v => setEditing(s => s ? { ...s, wa_idioma: v } : s)}
                      placeholder="pt_BR" placeholderTextColor="#525252"
                      style={s.input} autoCapitalize="none" />
                  </Field>
                </>
              )}

              <Field label="Corpo">
                <TextInput value={editing?.corpo ?? ''} onChangeText={v => setEditing(s => s ? { ...s, corpo: v } : s)}
                  placeholder="Olá {{nome}}, ..." placeholderTextColor="#525252"
                  style={[s.input, { minHeight: 110, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12 }]}
                  multiline />
              </Field>

              <Field label="Variáveis (separadas por vírgula)">
                <TextInput value={varsText} onChangeText={(v) => {
                    setVarsText(v)
                    const arr = v.split(',').map(x => x.trim()).filter(Boolean)
                    setEditing(s => s ? { ...s, variaveis: arr } : s)
                  }}
                  placeholder="nome, protocolo, valor" placeholderTextColor="#525252"
                  style={s.input} autoCapitalize="none" />
              </Field>

              <View style={s.switchRow}>
                <Text style={s.switchLabel}>Ativo</Text>
                <Switch value={editing?.ativo ?? true}
                  onValueChange={v => setEditing(s => s ? { ...s, ativo: v } : s)}
                  trackColor={{ true: '#DC2626', false: '#2a2a2a' }} thumbColor="#fff"
                  style={{ transform: [{ scale: 0.85 }] }} />
              </View>

              <View style={s.modalActions}>
                <Pressable style={s.modalCancel} onPress={() => setEditing(null)}>
                  <Text style={s.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[s.modalConfirm, (!editing?.codigo || !editing?.nome || !editing?.corpo || upsertMut.isPending) && { opacity: 0.5 }]}
                  disabled={!editing?.codigo || !editing?.nome || !editing?.corpo || upsertMut.isPending}
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

  empty: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 32, alignItems: 'center' },
  emptyText: { color: '#525252', fontSize: 13 },

  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  nome: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  codigo: { fontSize: 11, color: '#737373', fontFamily: 'monospace', marginTop: 2 },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  metaTag: { backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  metaText: { fontSize: 10, fontWeight: '600', color: '#a3a3a3' },
  vars: { fontSize: 10, color: '#525252', flex: 1, fontFamily: 'monospace' },

  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  actionText: { fontSize: 12, fontWeight: '600', color: '#a3a3a3' },
  actionDel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DC262640', alignItems: 'center', justifyContent: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0f0f0f', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },

  fieldLabel: { fontSize: 11, color: '#737373', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', padding: 11, color: '#fff', fontSize: 13 },

  segRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1c1c1c', borderWidth: 1, borderColor: '#2a2a2a' },
  segPillActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  segText: { fontSize: 11, fontWeight: '600', color: '#737373' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchLabel: { fontSize: 13, color: '#a3a3a3' },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalCancel: { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  modalCancelText: { color: '#a3a3a3', fontWeight: '600' },
  modalConfirm: { flex: 1, padding: 13, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
})

