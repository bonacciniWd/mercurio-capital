import { useState } from 'react'
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, X, AlertTriangle, TrendingUp, History } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

interface Preco {
  id: string; tipo: string; preco_centavos: number; custo_fornecedor_centavos: number
  vigente_de: string; vigente_ate: string | null; descricao: string | null
}

const TIPOS: { id: string; label: string; descricao: string }[] = [
  { id: 'bacen_cpf', label: 'Bacen CPF', descricao: 'Consulta de CPF no Bacen' },
  { id: 'bacen_cnpj', label: 'Bacen CNPJ', descricao: 'Consulta de CNPJ no Bacen' },
  { id: 'serasa_pf', label: 'Serasa PF', descricao: 'Score Serasa PF' },
  { id: 'serasa_pj', label: 'Serasa PJ', descricao: 'Score Serasa PJ' },
  { id: 'jusbrasil_cnpj', label: 'Jusbrasil CNPJ', descricao: 'Processos Jusbrasil' },
  { id: 'escavador_cnpj', label: 'Escavador CNPJ', descricao: 'Processos Escavador' },
  { id: 'ri_digital_matricula', label: 'RI Digital', descricao: 'Matrícula via RI Digital' },
  { id: 'nacional_consultas_bens', label: 'Nacional · bens', descricao: 'Pesquisa de bens' },
  { id: 'nacional_consultas_certidao', label: 'Nacional · certidão', descricao: 'Certidões nacionais' },
]

export default function Precos() {
  const qc = useQueryClient()
  const [editando, setEditando] = useState<string | null>(null)
  const [historico, setHistorico] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [custo, setCusto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const precosQuery = useQuery({
    queryKey: ['admin-precos-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_consulta')
        .select('id, tipo, preco_centavos, custo_fornecedor_centavos, vigente_de, vigente_ate, descricao')
        .order('vigente_de', { ascending: false })
      if (error) throw error
      return (data ?? []) as Preco[]
    },
  })

  const upsertMut = useMutation({
    mutationFn: async (args: { tipo: string; preco: number; custo: number; descricao: string }) => {
      const { error } = await supabase.rpc('admin_precos_upsert', {
        p_tipo: args.tipo,
        p_preco_centavos: args.preco,
        p_custo_fornecedor_centavos: args.custo,
        p_descricao: args.descricao || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setEditando(null); setValor(''); setCusto(''); setDescricao(''); setErro(null)
      qc.invalidateQueries({ queryKey: ['admin-precos-mobile'] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  const todos = precosQuery.data ?? []
  const vigentes = new Map<string, Preco>()
  for (const p of todos) {
    if (!p.vigente_ate && !vigentes.has(p.tipo)) vigentes.set(p.tipo, p)
  }

  function abrir(tipo: string) {
    const atual = vigentes.get(tipo)
    setEditando(tipo)
    setValor(atual ? (atual.preco_centavos / 100).toFixed(2).replace('.', ',') : '')
    setCusto(atual ? (atual.custo_fornecedor_centavos / 100).toFixed(2).replace('.', ',') : '0,00')
    setDescricao(atual?.descricao ?? TIPOS.find(t => t.id === tipo)?.descricao ?? '')
    setErro(null)
  }

  function confirmar() {
    if (!editando) return
    const p = Math.round(Number(valor.replace(/[^\d,]/g, '').replace(',', '.')) * 100)
    const cust = Math.round(Number(custo.replace(/[^\d,]/g, '').replace(',', '.')) * 100)
    if (!Number.isFinite(p) || p <= 0) { setErro('Preço inválido'); return }
    upsertMut.mutate({ tipo: editando, preco: p, custo: Number.isFinite(cust) ? cust : 0, descricao })
  }

  const histList = historico ? todos.filter(p => p.tipo === historico) : []

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Preços de Consultas</Text>
        </View>
      </View>

      {precosQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
          <View style={s.infoBox}>
            <TrendingUp size={14} color="#16A34A" />
            <Text style={s.infoText}>Preços versionados — alterar fecha o vigente anterior.</Text>
          </View>

          {TIPOS.map(t => {
            const p = vigentes.get(t.id)
            const margem = p ? p.preco_centavos - p.custo_fornecedor_centavos : 0
            const margemPct = p && p.preco_centavos > 0 ? Math.round((margem / p.preco_centavos) * 100) : 0
            const cor = margemPct >= 40 ? '#16A34A' : margemPct >= 25 ? '#F59E0B' : '#DC2626'
            return (
              <View key={t.id} style={[s.card, { borderTopColor: '#DC2626' }]}>

                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nome}>{t.label}</Text>
                    <Text style={s.desc} numberOfLines={2}>{p?.descricao ?? t.descricao}</Text>
                  </View>
                  <Pressable style={s.iconBtn} onPress={() => abrir(t.id)}>
                    <Edit2 size={13} color="#a3a3a3" />
                  </Pressable>
                  <Pressable style={s.iconBtn} onPress={() => setHistorico(t.id)}>
                    <History size={13} color="#a3a3a3" />
                  </Pressable>
                </View>
                <View style={s.statsRow}>
                  <Cell label="Custo" value={p ? brl(p.custo_fornecedor_centavos) : '—'} />
                  <View style={s.divider} />
                  <Cell label="Preço" value={p ? brl(p.preco_centavos) : 'não def.'} highlight />
                  <View style={s.divider} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={s.cellLabel}>Margem</Text>
                    {p ? (
                      <View style={[s.marBadge, { backgroundColor: cor + '22' }]}>
                        <Text style={[s.marText, { color: cor }]}>{margemPct}%</Text>
                      </View>
                    ) : <Text style={s.cellValue}>—</Text>}
                  </View>
                </View>
                {p && <Text style={s.vigente}>Vigente desde {new Date(p.vigente_de).toLocaleDateString('pt-BR')}</Text>}
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* Edit modal */}
      <Modal visible={!!editando} transparent animationType="slide" onRequestClose={() => setEditando(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setEditando(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Atualizar preço · {TIPOS.find(t => t.id === editando)?.label}</Text>
              <Pressable onPress={() => setEditando(null)}><X size={20} color="#737373" /></Pressable>
            </View>
            <Text style={s.hint}>A versão anterior será arquivada automaticamente.</Text>

            <Text style={s.fieldLabel}>Preço (R$)</Text>
            <TextInput value={valor} onChangeText={setValor} keyboardType="decimal-pad"
              placeholder="4,90" placeholderTextColor="#525252" style={s.input} />

            <Text style={s.fieldLabel}>Custo fornecedor (R$)</Text>
            <TextInput value={custo} onChangeText={setCusto} keyboardType="decimal-pad"
              placeholder="2,00" placeholderTextColor="#525252" style={s.input} />

            <Text style={s.fieldLabel}>Descrição</Text>
            <TextInput value={descricao} onChangeText={setDescricao}
              placeholderTextColor="#525252" style={s.input} />

            {erro && (
              <View style={s.errBox}>
                <AlertTriangle size={13} color="#DC2626" />
                <Text style={s.errText}>{erro}</Text>
              </View>
            )}

            <View style={s.modalActions}>
              <Pressable style={s.modalCancel} onPress={() => setEditando(null)}>
                <Text style={s.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.modalConfirm, upsertMut.isPending && { opacity: 0.5 }]}
                disabled={upsertMut.isPending}
                onPress={confirmar}>
                {upsertMut.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.modalConfirmText}>Salvar nova versão</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* History modal */}
      <Modal visible={!!historico} transparent animationType="slide" onRequestClose={() => setHistorico(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setHistorico(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Histórico · {TIPOS.find(t => t.id === historico)?.label}</Text>
              <Pressable onPress={() => setHistorico(null)}><X size={20} color="#737373" /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 6 }}>
              {histList.length === 0
                ? <Text style={s.hint}>Sem registros.</Text>
                : histList.map(p => (
                  <View key={p.id} style={s.histItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.histPreco}>{brl(p.preco_centavos)}</Text>
                      <Text style={s.histMeta}>
                        Desde {new Date(p.vigente_de).toLocaleDateString('pt-BR')} · custo {brl(p.custo_fornecedor_centavos)}
                      </Text>
                    </View>
                    {!p.vigente_ate ? (
                      <View style={[s.miniPill, { backgroundColor: '#16A34A22' }]}>
                        <Text style={[s.miniText, { color: '#16A34A' }]}>vigente</Text>
                      </View>
                    ) : (
                      <Text style={s.histMeta}>até {new Date(p.vigente_ate).toLocaleDateString('pt-BR')}</Text>
                    )}
                  </View>
                ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={[s.cellValue, highlight && { color: '#DC2626' }]}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },

  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#16A34A0D', borderWidth: 1, borderColor: '#16A34A30', borderRadius: 10, padding: 10 },
  infoText: { fontSize: 11, color: '#16A34A', flex: 1 },

  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  nome: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  desc: { fontSize: 11, color: '#737373', marginTop: 2 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1f1f1f', paddingVertical: 12 },
  divider: { width: 1, height: 28, backgroundColor: '#2a2a2a' },
  cellLabel: { fontSize: 9, color: '#525252', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  cellValue: { fontSize: 13, fontWeight: '700', color: '#e5e5e5', marginTop: 3 },
  marBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 3 },
  marText: { fontSize: 12, fontWeight: '700' },
  vigente: { fontSize: 10, color: '#525252', textAlign: 'center', paddingBottom: 10 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0f0f0f', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30, gap: 8, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#fff', flex: 1, marginRight: 10 },
  hint: { fontSize: 11, color: '#525252' },

  fieldLabel: { fontSize: 11, color: '#737373', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 5 },
  input: { backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', padding: 11, color: '#fff', fontSize: 14 },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC262615', borderRadius: 8, padding: 10, marginTop: 8 },
  errText: { color: '#DC2626', fontSize: 12, flex: 1 },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  modalCancelText: { color: '#a3a3a3', fontWeight: '600' },
  modalConfirm: { flex: 1, padding: 13, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },

  histItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', padding: 10 },
  histPreco: { fontSize: 14, fontWeight: '800', color: '#fff' },
  histMeta: { fontSize: 10, color: '#737373', marginTop: 2 },
  miniPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  miniText: { fontSize: 10, fontWeight: '700' },
})
