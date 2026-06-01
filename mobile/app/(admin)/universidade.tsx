import { useState } from 'react'
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, BookOpen, Search, Eye, EyeOff,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

type CursoNivel = 'iniciante' | 'intermediario' | 'avancado'
type CursoPublico = 'cliente' | 'parceiro' | 'ambos'
type CursoStatus = 'rascunho' | 'publicado' | 'arquivado'

interface Curso {
  id: string; titulo: string; descricao: string | null
  categoria: string | null; nivel: CursoNivel; publico: CursoPublico; status: CursoStatus
  gratuito: boolean
}
interface Modulo { id: string; curso_id: string; titulo: string; ordem: number }
interface Aula { id: string; modulo_id: string; titulo: string; tipo: string; duracao_segundos: number | null }

const STATUS_COLOR: Record<CursoStatus, string> = {
  publicado: '#16A34A', rascunho: '#F59E0B', arquivado: '#525252',
}
const STATUS_LBL: Record<CursoStatus, string> = {
  publicado: 'Publicado', rascunho: 'Rascunho', arquivado: 'Arquivado',
}

export default function Universidade() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const cursosQuery = useQuery({
    queryKey: ['admin-cursos-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cursos').select('id, titulo, descricao, categoria, nivel, publico, status, gratuito')
        .order('ordem').order('created_at')
      if (error) throw error
      return (data ?? []) as Curso[]
    },
  })
  const cursos = cursosQuery.data ?? []
  const selected = selectedId ? cursos.find(c => c.id === selectedId) ?? null : null

  const modulosQuery = useQuery({
    enabled: !!selected,
    queryKey: ['admin-modulos-mobile', selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modulos').select('id, curso_id, titulo, ordem')
        .eq('curso_id', selected!.id).order('ordem')
      if (error) throw error
      return (data ?? []) as Modulo[]
    },
  })
  const modulos = modulosQuery.data ?? []

  const aulasQuery = useQuery({
    enabled: modulos.length > 0,
    queryKey: ['admin-aulas-mobile', selected?.id, modulos.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas').select('id, modulo_id, titulo, tipo, duracao_segundos')
        .in('modulo_id', modulos.map(m => m.id)).order('ordem')
      if (error) throw error
      return (data ?? []) as Aula[]
    },
  })
  const aulas = aulasQuery.data ?? []

  const criarMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('cursos').insert({
        titulo: 'Novo curso', nivel: 'iniciante', publico: 'ambos', status: 'rascunho',
      }).select().single()
      if (error) throw error
      return data as Curso
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['admin-cursos-mobile'] })
      setSelectedId(c.id)
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  })

  const tituloMut = useMutation({
    mutationFn: async (vars: { id: string; titulo: string }) => {
      const { error } = await supabase.from('cursos').update({ titulo: vars.titulo }).eq('id', vars.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-cursos-mobile'] }),
  })

  const publicarMut = useMutation({
    mutationFn: async (vars: { id: string; status: CursoStatus }) => {
      const { error } = await supabase.rpc('admin_curso_publicar', {
        p_curso_id: vars.id, p_status: vars.status,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-cursos-mobile'] }),
    onError: (e: Error) => Alert.alert('Erro', e.message),
  })

  const filtrados = cursos.filter(c =>
    !busca || c.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    (c.categoria ?? '').toLowerCase().includes(busca.toLowerCase())
  )

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
          <Text style={s.headerEyebrow}>MODO ADMIN · LMS</Text>
          <Text style={s.headerTitle}>{selected ? selected.titulo : 'Universidade'}</Text>
        </View>
        {!selected && (
          <Pressable style={s.newBtn} onPress={() => criarMut.mutate()} disabled={criarMut.isPending}>
            {criarMut.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Plus size={15} color="#fff" /><Text style={s.newBtnText}>Novo</Text></>}
          </Pressable>
        )}
      </View>

      {cursosQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : selected ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          {/* Editor simplificado */}
          <View style={s.card}>
            <Text style={s.fieldLabel}>Título</Text>
            <TextInput defaultValue={selected.titulo}
              onEndEditing={(e) => {
                const v = e.nativeEvent.text
                if (v && v !== selected.titulo) tituloMut.mutate({ id: selected.id, titulo: v })
              }}
              placeholderTextColor="#525252" style={s.input} />

            <Text style={s.fieldLabel}>Status</Text>
            <View style={s.rowGap}>
              {(['rascunho', 'publicado', 'arquivado'] as CursoStatus[]).map(st => {
                const on = selected.status === st
                return (
                  <Pressable key={st} onPress={() => publicarMut.mutate({ id: selected.id, status: st })}
                    style={[s.choicePill, on && { backgroundColor: STATUS_COLOR[st], borderColor: STATUS_COLOR[st] }]}>

                    <Text style={[s.choiceText, on && { color: '#fff' }]}>{STATUS_LBL[st]}</Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={s.metaGrid}>
              <View style={s.metaItem}>
                <Text style={s.fieldLabel}>Nível</Text>
                <Text style={s.metaValue}>{selected.nivel}</Text>
              </View>
              <View style={s.metaItem}>
                <Text style={s.fieldLabel}>Público</Text>
                <Text style={s.metaValue}>{selected.publico}</Text>
              </View>
              <View style={s.metaItem}>
                <Text style={s.fieldLabel}>Acesso</Text>
                <Text style={s.metaValue}>{selected.gratuito ? 'gratuito' : 'assinatura'}</Text>
              </View>
            </View>
            <Text style={s.hint}>Edição completa (módulos, aulas, Vimeo, capa) disponível na versão web.</Text>
          </View>

          {/* Módulos + aulas */}
          {modulos.length === 0 ? (
            <Text style={s.empty}>Sem módulos ainda — use a versão web para criar.</Text>
          ) : modulos.map((m, mi) => {
            const aulasM = aulas.filter(a => a.modulo_id === m.id)
            return (
              <View key={m.id} style={s.card}>
                <Text style={s.moduloTitulo}>M{mi + 1} · {m.titulo}</Text>
                {aulasM.length === 0
                  ? <Text style={s.hint}>Sem aulas.</Text>
                  : aulasM.map((a, ai) => (
                    <View key={a.id} style={s.aulaRow}>
                      <Text style={s.aulaIdx}>{mi + 1}.{ai + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.aulaTitulo} numberOfLines={1}>{a.titulo || '(sem título)'}</Text>
                        <Text style={s.aulaMeta}>{a.tipo}{a.duracao_segundos ? ` · ${Math.round(a.duracao_segundos / 60)}min` : ''}</Text>
                      </View>
                    </View>
                  ))}
              </View>
            )
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
          <View style={s.searchRow}>
            <Search size={15} color="#525252" />
            <TextInput value={busca} onChangeText={setBusca}
              placeholder="Buscar curso..." placeholderTextColor="#525252"
              style={s.searchInput} />
          </View>

          {filtrados.length === 0 ? (
            <View style={s.emptyCard}>
              <BookOpen size={28} color="#525252" />
              <Text style={s.emptyText}>Nenhum curso cadastrado.</Text>
            </View>
          ) : filtrados.map(c => {
            const color = STATUS_COLOR[c.status]
            return (
              <Pressable key={c.id} onPress={() => setSelectedId(c.id)}
                style={[s.cursoCard, { borderTopColor: color }]}>

                <View style={s.cursoTop}>
                  <View style={[s.iconBadge, { backgroundColor: '#DC262622' }]}>

                    <BookOpen size={16} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cursoTitulo} numberOfLines={2}>{c.titulo}</Text>
                    <Text style={s.cursoMeta}>{c.categoria ?? 'sem categoria'} · {c.nivel} · {c.publico}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: color + '22' }]}>

                    {c.status === 'publicado'
                      ? <Eye size={9} color={color} />
                      : <EyeOff size={9} color={color} />}
                    <Text style={[s.statusText, { color }]}>{STATUS_LBL[c.status]}</Text>
                  </View>
                </View>
              </Pressable>
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
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7 },
  newBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#141414', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 13, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 13, color: '#e5e5e5' },

  emptyCard: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 32, alignItems: 'center', gap: 10 },
  emptyText: { color: '#525252', fontSize: 13 },
  empty: { color: '#525252', fontSize: 12, textAlign: 'center', padding: 12 },

  cursoCard: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', padding: 14 },
  cursoTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cursoTitulo: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  cursoMeta: { fontSize: 11, color: '#737373', marginTop: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  card: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 14 },
  fieldLabel: { fontSize: 11, color: '#737373', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 6 },
  input: { backgroundColor: '#0f0f0f', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', padding: 11, color: '#fff', fontSize: 14 },
  hint: { fontSize: 11, color: '#525252', marginTop: 8 },

  rowGap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  choicePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1c1c1c', borderWidth: 1, borderColor: '#2a2a2a' },
  choiceText: { fontSize: 11, fontWeight: '600', color: '#737373', textTransform: 'capitalize' },

  metaGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metaItem: { flex: 1, backgroundColor: '#0f0f0f', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a', padding: 10 },
  metaValue: { fontSize: 13, color: '#e5e5e5', fontWeight: '600', textTransform: 'capitalize' },

  moduloTitulo: { fontSize: 13, fontWeight: '700', color: '#e5e5e5', marginBottom: 8 },
  aulaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  aulaIdx: { fontSize: 10, fontFamily: 'monospace', color: '#525252', width: 28 },
  aulaTitulo: { fontSize: 12, color: '#e5e5e5' },
  aulaMeta: { fontSize: 10, color: '#737373', marginTop: 1 },
})
