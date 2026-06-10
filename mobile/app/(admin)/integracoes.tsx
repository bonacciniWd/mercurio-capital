import { useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Switch, Platform, Linking, Image, ImageSourcePropType } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Wifi, WifiOff, Clock, Zap, Apple, ExternalLink, RefreshCw } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

type Status = 'conectado' | 'erro' | 'pendente' | 'desconectado'

interface Integracao {
  id: string
  chave: string
  nome: string
  categoria: string
  descricao: string | null
  provider: string | null
  secrets_requeridas: string[]
  docs_url: string | null
  restricao_plataforma: string | null
  ativo: boolean
  ultimo_status: Status
  ultima_checagem: string | null
  ultimo_erro: string | null
  latencia_ms: number | null
  eventos_24h: number
  fila_pendente: number
}

const STATUS: Record<Status, { color: string; label: string }> = {
  conectado:    { color: '#16A34A', label: 'Conectado' },
  erro:         { color: '#DC2626', label: 'Erro' },
  pendente:     { color: '#F59E0B', label: 'Pendente' },
  desconectado: { color: '#737373', label: 'Inativo' },
}

const CAT_ACCENT: Record<string, string> = {
  Pagamentos: '#16A34A', Comunicação: '#A78BFA', Assinatura: '#F59E0B',
  'E-mail': '#38BDF8', Bureau: '#38BDF8', Cartórios: '#F87171', Mídia: '#737373',
}

const BRAND_LOGO: Record<string, ImageSourcePropType> = {
  stripe: require('@/assets/brands/stripe.jpeg'),
  whatsapp: require('@/assets/brands/evolution-logo.png'),
  clicksign: require('@/assets/brands/clicksign.jpeg'),
  serasa: require('@/assets/brands/sersa-experian.jpeg'),
  bacen: require('@/assets/brands/bacen.png'),
  jusbrasil: require('@/assets/brands/jusbrasil.png'),
  escavador: require('@/assets/brands/escavador.png'),
  ri_digital: require('@/assets/brands/ri-digital.png'),
  vimeo: require('@/assets/brands/vimeo.jpeg'),
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return 'nunca testada'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)}d`
}

export default function Integracoes() {
  const qc = useQueryClient()
  const [testando, setTestando] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin-integracoes-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_integracoes')
        .select('*')
      if (error) throw error
      return (data ?? []) as Integracao[]
    },
  })

  const toggleMut = useMutation({
    mutationFn: async ({ chave, ativo }: { chave: string; ativo: boolean }) => {
      const { error } = await supabase.rpc('admin_integracao_toggle', { p_chave: chave, p_ativo: ativo })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-integracoes-mobile'] }),
  })

  async function testar(chave: string) {
    setTestando(chave)
    try {
      await supabase.functions.invoke('integracao-testar', { body: { chave } })
      await qc.invalidateQueries({ queryKey: ['admin-integracoes-mobile'] })
    } finally {
      setTestando(null)
    }
  }

  const integracoes = listQuery.data ?? []
  const conectados = integracoes.filter(i => i.ultimo_status === 'conectado').length
  const erros = integracoes.filter(i => i.ultimo_status === 'erro').length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Integrações</Text>
        </View>
        <View style={s.summaryRow}>
          <View style={[s.pill, { backgroundColor: '#16A34A22' }]}>
            <Wifi size={11} color="#16A34A" />
            <Text style={[s.pillText, { color: '#16A34A' }]}>{conectados} ok</Text>
          </View>
          {erros > 0 && (
            <View style={[s.pill, { backgroundColor: '#DC262622' }]}>
              <WifiOff size={11} color="#DC2626" />
              <Text style={[s.pillText, { color: '#DC2626' }]}>{erros} erro</Text>
            </View>
          )}
        </View>
      </View>

      {listQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
          {integracoes.map(i => {
            const st = STATUS[i.ultimo_status]
            const accent = CAT_ACCENT[i.categoria] ?? '#737373'
            const iosRestrito = i.restricao_plataforma === 'ios_iap'
            const logo = BRAND_LOGO[i.chave]
            return (
              <View key={i.chave} style={[s.card, { borderTopColor: accent, opacity: i.ativo ? 1 : 0.6 }]}>
                <View style={s.cardTop}>
                  {logo ? (
                    <View style={s.logoBadge}>
                      <Image source={logo} style={s.logoImg} resizeMode="contain" />
                    </View>
                  ) : (
                    <View style={[s.iconBadge, { backgroundColor: accent + '22' }]}>
                      <Text style={[s.iconLabel, { color: accent }]}>{i.nome.slice(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.intName}>{i.nome}</Text>
                    <View style={s.metaRow}>
                      <View style={s.catTag}><Text style={s.catText}>{i.categoria}</Text></View>
                      <Clock size={10} color="#525252" />
                      <Text style={s.ultima}>{tempoRelativo(i.ultima_checagem)}</Text>
                    </View>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: st.color + '20' }]}>
                    <View style={[s.statusDot, { backgroundColor: st.color }]} />
                    <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {i.descricao ? <Text style={s.desc}>{i.descricao}</Text> : null}

                {(i.eventos_24h > 0 || i.fila_pendente > 0) && (
                  <View style={s.statsRow}>
                    {i.eventos_24h > 0 && <Text style={s.statChip}>{i.eventos_24h} eventos · 24h</Text>}
                    {i.fila_pendente > 0 && <Text style={[s.statChip, { color: '#F59E0B' }]}>{i.fila_pendente} na fila</Text>}
                    {typeof i.latencia_ms === 'number' && i.ultimo_status === 'conectado' && (
                      <Text style={s.statChip}>{i.latencia_ms} ms</Text>
                    )}
                  </View>
                )}

                {i.ultimo_status === 'erro' && i.ultimo_erro ? (
                  <View style={s.errBox}><Text style={s.errText} numberOfLines={2}>{i.ultimo_erro}</Text></View>
                ) : null}
                {i.ultimo_status === 'pendente' && i.ultimo_erro ? (
                  <View style={s.warnBox}><Text style={s.warnText} numberOfLines={2}>{i.ultimo_erro}</Text></View>
                ) : null}

                {iosRestrito && Platform.OS === 'ios' && (
                  <View style={s.iapBox}>
                    <Apple size={13} color="#A3A3A3" />
                    <Text style={s.iapText}>Cobrança restrita no iOS — pagamentos de bens digitais usam a versão web (regras Apple IAP).</Text>
                  </View>
                )}

                <View style={s.actionsRow}>
                  <View style={s.toggleWrap}>
                    <Switch
                      value={i.ativo}
                      onValueChange={(v) => toggleMut.mutate({ chave: i.chave, ativo: v })}
                      trackColor={{ false: '#2a2a2a', true: '#16A34A66' }}
                      thumbColor={i.ativo ? '#16A34A' : '#737373'}
                    />
                    <Text style={s.toggleLabel}>{i.ativo ? 'Ativa' : 'Inativa'}</Text>
                  </View>
                  {i.docs_url ? (
                    <Pressable style={s.btnOutline} onPress={() => Linking.openURL(i.docs_url!)}>
                      <ExternalLink size={13} color="#737373" />
                      <Text style={s.btnOutlineText}>Docs</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={s.btnSolid} onPress={() => testar(i.chave)} disabled={testando === i.chave}>
                    {testando === i.chave
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Zap size={13} color="white" /><Text style={s.btnSolidText}>Testar</Text></>}
                  </Pressable>
                </View>
              </View>
            )
          })}

          <Pressable style={s.refreshBtn} onPress={() => listQuery.refetch()}>
            <RefreshCw size={13} color="#737373" />
            <Text style={s.refreshText}>Atualizar lista</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  summaryRow: { flexDirection: 'row', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },

  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden', padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  logoBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', overflow: 'hidden' },
  logoImg: { width: 28, height: 28 },
  intName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  catTag: { backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  catText: { fontSize: 9, fontWeight: '600', color: '#737373' },
  ultima: { fontSize: 10, color: '#525252' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  desc: { fontSize: 12, color: '#a3a3a3', lineHeight: 17 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statChip: { fontSize: 11, color: '#737373', fontWeight: '600' },

  errBox: { backgroundColor: '#DC26260D', borderWidth: 1, borderColor: '#DC262630', borderRadius: 8, padding: 8 },
  errText: { fontSize: 11, color: '#F87171' },
  warnBox: { backgroundColor: '#F59E0B0D', borderWidth: 1, borderColor: '#F59E0B30', borderRadius: 8, padding: 8 },
  warnText: { fontSize: 11, color: '#F59E0B' },
  iapBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#ffffff08', borderRadius: 8, padding: 8 },
  iapText: { flex: 1, fontSize: 11, color: '#a3a3a3', lineHeight: 16 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  toggleLabel: { fontSize: 11, color: '#737373', fontWeight: '600' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  btnOutlineText: { fontSize: 12, fontWeight: '600', color: '#737373' },
  btnSolid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16, minWidth: 86 },
  btnSolidText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 4 },
  refreshText: { fontSize: 12, fontWeight: '600', color: '#737373' },
})
