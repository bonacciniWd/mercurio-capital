import { useState } from 'react'
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Workflow as WfIcon, ChevronRight, Zap, Play,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

type Canal = 'in_app' | 'email' | 'whatsapp' | 'push'

interface FluxoAcao { tipo: 'notificar'; template: string; canais: Canal[] }
interface Fluxo {
  id: string; nome: string; descricao: string | null
  trigger_evento: string; acoes: FluxoAcao[]
  ativo: boolean; execucoes_total: number; ultima_execucao: string | null
}
interface Execucao {
  id: string; fluxo_id: string; gatilho: string
  status: 'sucesso' | 'erro' | 'parcial'
  duracao_ms: number | null; iniciado_em: string
}

const STATUS_COLOR: Record<string, string> = {
  sucesso: '#16A34A', erro: '#DC2626', parcial: '#F59E0B',
}

export default function Fluxos() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fluxosQuery = useQuery({
    queryKey: ['admin-fluxos-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_fluxos').select('*').order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Fluxo[]
    },
  })
  const fluxos = fluxosQuery.data ?? []
  const selected = selectedId ? fluxos.find(f => f.id === selectedId) ?? null : null

  const execQuery = useQuery({
    enabled: !!selected,
    queryKey: ['admin-fluxo-execs-mobile', selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_fluxo_execucoes')
        .select('id, fluxo_id, gatilho, status, duracao_ms, iniciado_em')
        .eq('fluxo_id', selected!.id).order('iniciado_em', { ascending: false }).limit(10)
      if (error) throw error
      return (data ?? []) as Execucao[]
    },
  })
  const execs = execQuery.data ?? []

  const executarMut = useMutation({
    mutationFn: async () => {
      if (!selected) return
      const { error } = await supabase.rpc('admin_fluxo_executar', {
        p_fluxo_id: selected.id, p_usuario_id: null, p_payload: {},
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-fluxo-execs-mobile', selected?.id] })
      qc.invalidateQueries({ queryKey: ['admin-fluxos-mobile'] })
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  })

  const toggleMut = useMutation({
    mutationFn: async (f: Fluxo) => {
      const { error } = await supabase.rpc('admin_fluxo_upsert', {
        p_nome: f.nome, p_trigger_evento: f.trigger_evento, p_id: f.id,
        p_descricao: f.descricao, p_condicoes: {}, p_acoes: f.acoes, p_ativo: !f.ativo,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-fluxos-mobile'] }),
    onError: (e: Error) => Alert.alert('Erro', e.message),
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => {
          if (selected) { setSelectedId(null); return }
          router.canGoBack() ? router.back() : router.replace('/(admin)' as any)
        }} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle} numberOfLines={1}>{selected ? selected.nome : 'Fluxos automatizados'}</Text>
        </View>
      </View>

      {fluxosQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : selected ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          <View style={[s.card, { borderTopWidth: 2, borderTopColor: selected.ativo ? '#16A34A' : '#525252' }]}>
            <View style={s.row}>
              <View style={[s.iconBadge, { backgroundColor: '#DC262622' }]}>
                <Zap size={16} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.detailLabel}>Gatilho</Text>
                <Text style={s.detailValue}>{selected.trigger_evento}</Text>
              </View>
              <View style={[s.statusPill, { backgroundColor: (selected.ativo ? '#16A34A' : '#525252') + '22' }]}>
                <Text style={[s.statusText, { color: selected.ativo ? '#16A34A' : '#525252' }]}>
                  {selected.ativo ? 'on' : 'off'}
                </Text>
              </View>
            </View>
            {selected.descricao && <Text style={s.descricao}>{selected.descricao}</Text>}

            <Text style={s.sectionLabel}>Ações ({selected.acoes.length})</Text>
            {selected.acoes.length === 0
              ? <Text style={s.hint}>Sem ações configuradas.</Text>
              : selected.acoes.map((a, i) => (
                <View key={i} style={s.acaoRow}>
                  <Text style={s.acaoIdx}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.acaoTpl}>{a.template}</Text>
                    <Text style={s.acaoCanais}>via {a.canais.join(', ')}</Text>
                  </View>
                </View>
              ))}

            <View style={s.actions}>
              <Pressable style={s.actionBtn} onPress={() => executarMut.mutate()} disabled={executarMut.isPending}>
                {executarMut.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Play size={13} color="#fff" /><Text style={s.actionText}>Executar teste</Text></>}
              </Pressable>
              <Pressable style={s.actionBtnOutline} onPress={() => toggleMut.mutate(selected)} disabled={toggleMut.isPending}>
                <Text style={s.actionTextOutline}>{selected.ativo ? 'Desativar' : 'Ativar'}</Text>
              </Pressable>
            </View>
            <Text style={s.hint}>Edição visual de nós/condições disponível na versão web.</Text>
          </View>

          <View style={s.card}>
            <Text style={s.sectionLabel}>Últimas execuções</Text>
            {execQuery.isLoading
              ? <ActivityIndicator color="#DC2626" />
              : execs.length === 0
                ? <Text style={s.hint}>Sem execuções registradas.</Text>
                : execs.map(e => (
                  <View key={e.id} style={s.execRow}>
                    <View style={[s.dot, { backgroundColor: STATUS_COLOR[e.status] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.execGatilho}>{e.gatilho}</Text>
                      <Text style={s.execMeta}>
                        {new Date(e.iniciado_em).toLocaleString('pt-BR')}{e.duracao_ms ? ` · ${e.duracao_ms}ms` : ''}
                      </Text>
                    </View>
                    <Text style={[s.execStatus, { color: STATUS_COLOR[e.status] }]}>{e.status}</Text>
                  </View>
                ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
          {fluxos.length === 0 ? (
            <View style={s.empty}>
              <WfIcon size={28} color="#525252" />
              <Text style={s.emptyText}>Nenhum fluxo cadastrado.</Text>
            </View>
          ) : fluxos.map(f => {
            const color = f.ativo ? '#16A34A' : '#525252'
            return (
              <Pressable key={f.id} onPress={() => setSelectedId(f.id)} style={[s.fluxCard, { borderTopColor: color }]}>
                <View style={s.row}>
                  <View style={[s.iconBadge, { backgroundColor: '#DC262622' }]}>
                    <WfIcon size={16} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fluxName} numberOfLines={1}>{f.nome}</Text>
                    <Text style={s.fluxGat}>⚡ {f.trigger_evento}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: color + '22' }]}>
                    <Text style={[s.statusText, { color }]}>{f.ativo ? 'on' : 'off'}</Text>
                  </View>
                  <ChevronRight size={16} color="#404040" />
                </View>
                <View style={s.fluxFooter}>
                  <Text style={s.fluxStat}>{f.acoes.length} ações</Text>
                  <Text style={s.fluxStat}>{f.execucoes_total} execuções</Text>
                  {f.ultima_execucao && (
                    <Text style={s.fluxStat}>· última {new Date(f.ultima_execucao).toLocaleDateString('pt-BR')}</Text>
                  )}
                </View>
              </Pressable>
            )
          })}
          <Text style={s.exportHint}>Criação/edição visual de novos fluxos disponível na versão web.</Text>
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

  empty: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 32, alignItems: 'center', gap: 10 },
  emptyText: { color: '#525252', fontSize: 13 },

  fluxCard: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fluxName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  fluxGat: { fontSize: 11, color: '#737373', marginTop: 3 },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  fluxFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  fluxStat: { fontSize: 11, color: '#737373' },

  card: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 14 },
  detailLabel: { fontSize: 10, color: '#737373', textTransform: 'uppercase', fontWeight: '700' },
  detailValue: { fontSize: 14, color: '#e5e5e5', fontWeight: '700', marginTop: 2, fontFamily: 'monospace' },
  descricao: { fontSize: 12, color: '#a3a3a3', marginTop: 10 },

  sectionLabel: { fontSize: 11, color: '#737373', textTransform: 'uppercase', fontWeight: '700', marginTop: 14, marginBottom: 8 },
  hint: { fontSize: 11, color: '#525252', textAlign: 'center', marginTop: 8 },

  acaoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  acaoIdx: { fontSize: 10, color: '#525252', fontFamily: 'monospace', width: 24 },
  acaoTpl: { fontSize: 12, color: '#e5e5e5', fontWeight: '600' },
  acaoCanais: { fontSize: 10, color: '#737373', marginTop: 1 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#DC2626', paddingVertical: 10, borderRadius: 10 },
  actionText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  actionBtnOutline: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  actionTextOutline: { fontSize: 12, fontWeight: '600', color: '#a3a3a3' },

  execRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  execGatilho: { fontSize: 12, color: '#e5e5e5', fontFamily: 'monospace' },
  execMeta: { fontSize: 10, color: '#525252', marginTop: 1 },
  execStatus: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  exportHint: { fontSize: 11, color: '#525252', textAlign: 'center', marginTop: 6 },
})
