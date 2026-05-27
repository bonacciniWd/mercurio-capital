import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Check, X, FileText } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

type Aprovacao = {
  partner_id: string; usuario_id: string; nome: string; email: string
  cpf: string | null; telefone: string | null; telefone_ddi: string | null
  status: string; created_at: string; docs_count: number
}

function formatCpf(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export default function Aprovacoes() {
  const qc = useQueryClient()
  const [rejectFor, setRejectFor] = useState<Aprovacao | null>(null)
  const [motivo, setMotivo] = useState('')

  const { data: lista, isLoading } = useQuery({
    queryKey: ['admin-aprovacoes-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_partner_aprovacoes')
        .select('partner_id, usuario_id, nome, email, cpf, telefone, telefone_ddi, status, created_at, docs_count')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Aprovacao[]
    },
  })

  const approve = useMutation({
    mutationFn: async (partner_id: string) => {
      const { error } = await supabase.rpc('admin_approve_partner', { p_partner_id: partner_id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-aprovacoes-mobile'] })
      qc.invalidateQueries({ queryKey: ['admin-mobile-aprov-count'] })
      Alert.alert('Parceiro aprovado')
    },
    onError: (e: any) => Alert.alert('Erro ao aprovar', e?.message ?? 'Tente novamente'),
  })

  const reject = useMutation({
    mutationFn: async ({ partner_id, motivo }: { partner_id: string; motivo: string }) => {
      const { error } = await supabase.rpc('admin_reject_partner', { p_partner_id: partner_id, p_motivo: motivo })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-aprovacoes-mobile'] })
      qc.invalidateQueries({ queryKey: ['admin-mobile-aprov-count'] })
      setRejectFor(null)
      setMotivo('')
      Alert.alert('Parceiro recusado')
    },
    onError: (e: any) => Alert.alert('Erro ao recusar', e?.message ?? 'Tente novamente'),
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
          <Text style={s.headerTitle}>Aprovações de Parceiros</Text>
        </View>
        <View style={s.countPill}>
          <Text style={s.countText}>{lista?.length ?? 0} pendentes</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          {(!lista || lista.length === 0) ? (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: '#737373', fontSize: 14 }}>Nenhuma aprovação pendente.</Text>
            </View>
          ) : lista.map(p => (
            <View key={p.partner_id} style={s.card}>
              <View style={s.cardTop}>
                <View style={s.avatarBadge}>
                  <Building2 size={20} color="#e5e5e5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerName}>{p.nome}</Text>
                  <Text style={s.cnpj}>{formatCpf(p.cpf)}</Text>
                  <Text style={s.email} numberOfLines={1}>{p.email}</Text>
                  <View style={s.tagsRow}>
                    <View style={s.typeTag}>
                      <FileText size={10} color="#a3a3a3" />
                      <Text style={s.typeTagText}>{p.docs_count} doc(s)</Text>
                    </View>
                    {p.telefone ? (
                      <View style={s.typeTag}>
                        <Text style={s.typeTagText}>+{p.telefone_ddi ?? '55'} {p.telefone}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={s.actionsRow}>
                <Pressable
                  style={s.btnReject}
                  onPress={() => { setRejectFor(p); setMotivo('') }}
                  disabled={approve.isPending || reject.isPending}
                >
                  <X size={15} color="#DC2626" />
                  <Text style={s.btnRejectText}>Recusar</Text>
                </Pressable>
                <Pressable
                  style={s.btnApprove}
                  onPress={() => approve.mutate(p.partner_id)}
                  disabled={approve.isPending || reject.isPending}
                >
                  {approve.isPending && approve.variables === p.partner_id ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : <Check size={15} color="white" />}
                  <Text style={s.btnApproveText}>Aprovar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!rejectFor} transparent animationType="fade" onRequestClose={() => setRejectFor(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Recusar parceiro</Text>
            <Text style={s.modalSub}>{rejectFor?.nome}</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Motivo da recusa (obrigatório)"
              placeholderTextColor="#525252"
              value={motivo}
              onChangeText={setMotivo}
              multiline
              numberOfLines={3}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable style={[s.btnReject, { flex: 1 }]} onPress={() => setRejectFor(null)}>
                <Text style={s.btnRejectText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.btnApprove, { flex: 1, backgroundColor: '#DC2626' }]}
                onPress={() => {
                  if (motivo.trim().length < 3) {
                    Alert.alert('Motivo obrigatório', 'Informe ao menos 3 caracteres.')
                    return
                  }
                  if (rejectFor) reject.mutate({ partner_id: rejectFor.partner_id, motivo: motivo.trim() })
                }}
                disabled={reject.isPending}
              >
                {reject.isPending ? <ActivityIndicator size="small" color="white" /> : <Text style={s.btnApproveText}>Confirmar</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  countPill: { backgroundColor: '#F59E0B22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 11, fontWeight: '700', color: '#F59E0B' },
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 14 },
  avatarBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  cnpj: { fontSize: 11, color: '#525252', marginTop: 2, fontFamily: 'monospace' },
  email: { fontSize: 11, color: '#737373', marginTop: 2 },
  tagsRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  typeTagText: { fontSize: 10, fontWeight: '600', color: '#a3a3a3' },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  btnReject: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#DC262640', borderRadius: 10, paddingVertical: 10 },
  btnRejectText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  btnApprove: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 10 },
  btnApproveText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  modalBg: { flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#141414', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2a2a2a' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalSub: { fontSize: 12, color: '#737373', marginTop: 2 },
  modalInput: { marginTop: 14, backgroundColor: '#1c1c1c', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', padding: 12, color: '#e5e5e5', fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
})
