import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Wallet, TrendingUp, RefreshCw, AlertTriangle, Lock, Unlock, Plus, Minus } from 'lucide-react-native'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

type WalletRow = {
  id: string; partner_id: string; partner_nome: string; partner_email: string
  saldo_centavos: number; bloqueada: boolean; motivo_bloqueio: string | null
  limite_diario_centavos: number | null; updated_at: string
  ultima_movimentacao: string | null
}

export default function Carteiras() {
  const qc = useQueryClient()
  const [adjust, setAdjust] = useState<{ wallet: WalletRow; tipo: 'ajuste_credito' | 'ajuste_debito' } | null>(null)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin-carteiras-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_wallets')
        .select('id, partner_id, partner_nome, partner_email, saldo_centavos, bloqueada, motivo_bloqueio, limite_diario_centavos, updated_at, ultima_movimentacao')
        .order('saldo_centavos', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as WalletRow[]
    },
  })

  const toggleBlock = useMutation({
    mutationFn: async ({ partner_id, bloqueada, motivo }: { partner_id: string; bloqueada: boolean; motivo?: string }) => {
      const { error } = await supabase.rpc('admin_wallet_set_bloqueio', {
        p_partner: partner_id, p_bloqueada: bloqueada, p_motivo: motivo ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-carteiras-mobile'] }) },
    onError: (e: any) => Alert.alert('Erro', e?.message ?? 'Falha'),
  })

  const ajuste = useMutation({
    mutationFn: async ({ partner_id, tipo, valor, descricao }: { partner_id: string; tipo: string; valor: number; descricao?: string }) => {
      const { error } = await supabase.rpc('admin_wallet_ajuste', {
        p_partner: partner_id, p_tipo: tipo, p_valor: valor, p_descricao: descricao || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-carteiras-mobile'] })
      setAdjust(null); setValor(''); setDescricao('')
      Alert.alert('Ajuste registrado')
    },
    onError: (e: any) => Alert.alert('Erro', e?.message ?? 'Falha no ajuste'),
  })

  const carteiras = list ?? []
  const totalSaldo = carteiras.reduce((s, c) => s + Number(c.saldo_centavos || 0), 0)
  const bloqueadas = carteiras.filter(c => c.bloqueada).length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Carteiras</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#DC2626" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          <View style={s.grid}>
            <View style={[s.kpiCard, { borderTopColor: '#DC2626' }]}>

              <View style={[s.iconBadge, { backgroundColor: '#DC262622' }]}>
                <Wallet size={14} color="#DC2626" />
              </View>
              <Text style={s.kpiValue} numberOfLines={1}>{brl(totalSaldo)}</Text>
              <Text style={s.kpiLabel}>Saldo agregado</Text>
            </View>
            <View style={[s.kpiCard, { borderTopColor: '#F59E0B' }]}>

              <View style={[s.iconBadge, { backgroundColor: '#F59E0B22' }]}>
                <TrendingUp size={14} color="#F59E0B" />
              </View>
              <Text style={s.kpiValue}>{carteiras.length}</Text>
              <Text style={s.kpiLabel}>Carteiras</Text>
            </View>
            <View style={[s.kpiCard, { borderTopColor: '#16A34A' }]}>

              <View style={[s.iconBadge, { backgroundColor: '#16A34A22' }]}>
                <RefreshCw size={14} color="#16A34A" />
              </View>
              <Text style={s.kpiValue}>{bloqueadas}</Text>
              <Text style={s.kpiLabel}>Bloqueadas</Text>
            </View>
          </View>

          {carteiras.length === 0 ? (
            <Text style={{ color: '#737373', textAlign: 'center', padding: 24 }}>Nenhuma carteira encontrada.</Text>
          ) : carteiras.map(c => {
            const lowBalance = c.saldo_centavos < 10_000_00
            const accent = c.bloqueada ? '#DC2626' : '#16A34A'
            return (
              <View key={c.id} style={[s.card, { borderTopColor: accent }]}>

                <View style={s.cardTop}>
                  <View style={[s.avatarBadge, { backgroundColor: accent + '22' }]}>

                    <Wallet size={18} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.partnerName} numberOfLines={1}>{c.partner_nome}</Text>
                    <Text style={s.recargas} numberOfLines={1}>
                      {c.ultima_movimentacao
                        ? `Últ. mov.: ${new Date(c.ultima_movimentacao).toLocaleDateString('pt-BR')}`
                        : 'Sem movimentação'}
                    </Text>
                  </View>
                  {c.bloqueada ? (
                    <View style={s.alertBadge}>
                      <AlertTriangle size={11} color="#DC2626" />
                      <Text style={s.alertText}>Bloqueada</Text>
                    </View>
                  ) : lowBalance ? (
                    <View style={s.alertBadge}>
                      <AlertTriangle size={11} color="#F59E0B" />
                      <Text style={[s.alertText, { color: '#F59E0B' }]}>Baixo</Text>
                    </View>
                  ) : null}
                </View>

                <View style={s.statsRow}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={s.cellLabel}>Saldo</Text>
                    <Text style={[s.cellValue, lowBalance && { color: '#DC2626' }]}>{brl(c.saldo_centavos)}</Text>
                  </View>
                  {c.limite_diario_centavos ? (
                    <>
                      <View style={s.divider} />
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={s.cellLabel}>Lim/dia</Text>
                        <Text style={s.cellValue}>{brl(c.limite_diario_centavos)}</Text>
                      </View>
                    </>
                  ) : null}
                </View>

                <View style={s.actionsRow}>
                  <Pressable style={[s.btnOutline, { borderColor: '#16A34A60' }]} onPress={() => { setAdjust({ wallet: c, tipo: 'ajuste_credito' }); setValor(''); setDescricao('') }}>
                    <Plus size={14} color="#16A34A" />
                    <Text style={[s.btnOutlineText, { color: '#16A34A' }]}>Crédito</Text>
                  </Pressable>
                  <Pressable style={[s.btnOutline, { borderColor: '#F59E0B60' }]} onPress={() => { setAdjust({ wallet: c, tipo: 'ajuste_debito' }); setValor(''); setDescricao('') }}>
                    <Minus size={14} color="#F59E0B" />
                    <Text style={[s.btnOutlineText, { color: '#F59E0B' }]}>Débito</Text>
                  </Pressable>
                  <Pressable
                    style={[s.btnOutline, { borderColor: (c.bloqueada ? '#16A34A60' : '#DC262660') }]}>
                    {c.bloqueada ? <Unlock size={14} color="#16A34A" /> : <Lock size={14} color="#DC2626" />}
                    <Text style={[s.btnOutlineText, { color: c.bloqueada ? '#16A34A' : '#DC2626' }]}>{c.bloqueada ? 'Desbl.' : 'Bloq.'}</Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}

      <Modal visible={!!adjust} transparent animationType="fade" onRequestClose={() => setAdjust(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{adjust?.tipo === 'ajuste_credito' ? 'Creditar' : 'Debitar'} carteira</Text>
            <Text style={s.modalSub}>{adjust?.wallet.partner_nome}</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Valor em centavos (ex.: 50000 = R$ 500,00)"
              placeholderTextColor="#525252"
              value={valor}
              onChangeText={setValor}
              keyboardType="number-pad"
            />
            <TextInput
              style={[s.modalInput, { marginTop: 8 }]}>
              <Text style={s.modalSub}>Descrição (opcional)</Text>
              <TextInput
                style={s.modalInput}
                placeholder="Descrição (opcional)"
                placeholderTextColor="#525252"
                value={descricao}
                onChangeText={setDescricao}
              />
            </TextInput>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable style={[s.btnOutline, { flex: 1 }]} onPress={() => setAdjust(null)}>
                <Text style={s.btnOutlineText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.btnOutline, { flex: 1, backgroundColor: '#DC2626', borderColor: '#DC2626' }]}>
                {ajuste.isPending ? <ActivityIndicator size="small" color="white" /> : <Text style={[s.btnOutlineText, { color: '#fff' }]}>Confirmar</Text>}
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
  grid: { flexDirection: 'row', gap: 10 },
  kpiCard: { flex: 1, backgroundColor: '#141414', borderRadius: 14, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  iconBadge: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  kpiLabel: { fontSize: 9, color: '#737373', marginTop: 2 },
  card: { backgroundColor: '#141414', borderRadius: 16, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatarBadge: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  recargas: { fontSize: 11, color: '#525252', marginTop: 1 },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DC262618', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  alertText: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  divider: { width: 1, height: 28, backgroundColor: '#2a2a2a' },
  cellLabel: { fontSize: 9, color: '#525252', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  cellValue: { fontSize: 13, fontWeight: '700', color: '#e5e5e5', marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  btnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingVertical: 9 },
  btnOutlineText: { fontSize: 11, fontWeight: '600', color: '#e5e5e5' },
  modalBg: { flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#141414', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2a2a2a' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalSub: { fontSize: 12, color: '#737373', marginTop: 2 },
  modalInput: { marginTop: 14, backgroundColor: '#1c1c1c', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', padding: 12, color: '#e5e5e5', fontSize: 14 },
})
