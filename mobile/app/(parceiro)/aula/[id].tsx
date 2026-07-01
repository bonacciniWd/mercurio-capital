import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Play, CheckCircle2, ArrowRight, FileText, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react-native'
import { WebView } from 'react-native-webview'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '@/lib/supabase'

type AulaTipo = 'video' | 'pdf' | 'quiz' | 'texto'

interface EstruturaRow {
  curso_id: string
  curso_titulo: string
  gratuito: boolean
  modulo_id: string
  modulo_titulo: string
  modulo_ordem: number
  aula_id: string
  aula_titulo: string
  aula_descricao: string | null
  aula_tipo: AulaTipo
  vimeo_id: string | null
  pdf_storage_path: string | null
  conteudo_md: string | null
  duracao_segundos: number | null
  gratuita: boolean
  aula_ordem: number
  posicao_segundos: number | null
  concluida: boolean | null
  concluida_em: string | null
}

interface AulaFlat extends EstruturaRow {
  globalIndex: number
}

export default function AulaPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const cursoId = id ?? ''
  const qc = useQueryClient()
  const [tab, setTab] = useState<'conteudo' | 'recursos' | 'notas'>('conteudo')
  const [activeAulaId, setActiveAulaId] = useState<string | null>(null)
  const [openModulos, setOpenModulos] = useState<Set<string>>(new Set())
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const playerRef = useRef<WebView | null>(null)
  const lastSavedRef = useRef<number>(0)

  const estruturaQ = useQuery({
    queryKey: ['p-lms-estrutura', cursoId],
    enabled: !!cursoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lms_curso_estrutura')
        .select('*')
        .eq('curso_id', cursoId)
        .order('modulo_ordem')
        .order('aula_ordem')
      if (error) throw error
      return (data ?? []) as EstruturaRow[]
    },
  })

  const rows = estruturaQ.data ?? []
  const aulas: AulaFlat[] = useMemo(
    () => rows.map((r, i) => ({ ...r, globalIndex: i })),
    [rows],
  )

  const activeAula: AulaFlat | null = useMemo(() => {
    if (aulas.length === 0) return null
    if (activeAulaId) return aulas.find(a => a.aula_id === activeAulaId) ?? aulas[0]
    return aulas[0]
  }, [aulas, activeAulaId])

  const activeVimeoId = useMemo(() => normalizeVimeoId(activeAula?.vimeo_id), [activeAula?.vimeo_id])

  const proxima: AulaFlat | null = useMemo(() => {
    if (!activeAula) return null
    return aulas[activeAula.globalIndex + 1] ?? null
  }, [aulas, activeAula])

  // Expande módulo da aula ativa
  useEffect(() => {
    if (activeAula) setOpenModulos(prev => new Set(prev).add(activeAula.modulo_id))
    lastSavedRef.current = 0
  }, [activeAula?.modulo_id, activeAula?.aula_id])

  // Carrega URL assinada do PDF
  useEffect(() => {
    setPdfUrl(null)
    if (activeAula?.pdf_storage_path) {
      supabase.storage.from('lms-recursos')
        .createSignedUrl(activeAula.pdf_storage_path, 60 * 60)
        .then(({ data }) => setPdfUrl(data?.signedUrl ?? null))
    }
  }, [activeAula?.pdf_storage_path])

  const marcarAula = useMutation({
    mutationFn: async (args: { aula_id: string; posicao?: number; concluida?: boolean }) => {
      const { error } = await supabase.rpc('lms_marcar_aula', {
        p_aula_id: args.aula_id,
        p_posicao_segundos: args.posicao ?? null,
        p_concluida: args.concluida ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['p-lms-estrutura', cursoId] })
      void qc.invalidateQueries({ queryKey: ['p-lms-catalogo'] })
      void qc.invalidateQueries({ queryKey: ['p-lms-certificados'] })
    },
    onError: (e: unknown) => Alert.alert('Erro', e instanceof Error ? e.message : String(e)),
  })

  const modulos = useMemo(() => {
    const map = new Map<string, { id: string; titulo: string; aulas: AulaFlat[] }>()
    for (const a of aulas) {
      if (!map.has(a.modulo_id)) map.set(a.modulo_id, { id: a.modulo_id, titulo: a.modulo_titulo, aulas: [] })
      map.get(a.modulo_id)!.aulas.push(a)
    }
    return [...map.values()]
  }, [aulas])

  const curso = rows[0]
  const totalAulas = aulas.length
  const concluidas = aulas.filter(a => a.concluida).length
  const pct = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0

  // HTML do Vimeo player com tracking via postMessage
  const vimeoHtml = useMemo(() => {
    if (!activeVimeoId || !activeAula) return ''
    const startAt = (activeAula.posicao_segundos ?? 0) > 5 ? activeAula.posicao_segundos : 0
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body,#p,iframe{margin:0;padding:0;width:100%;height:100%;background:#000;border:0}</style></head>
<body><div id="p"></div>
<script src="https://player.vimeo.com/api/player.js"></script>
<script>
  var p = new Vimeo.Player('p', { id: ${JSON.stringify(activeVimeoId)}, responsive: true, autoplay: false });
  ${startAt ? `p.ready().then(function(){ p.setCurrentTime(${startAt}).catch(function(){}); });` : ''}
  var last = 0;
  p.on('timeupdate', function(d){
    var s = Math.floor(d.seconds);
    if (s - last >= 5) { last = s; window.ReactNativeWebView.postMessage(JSON.stringify({type:'time', s:s})); }
  });
  p.on('ended', function(){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'ended'})); });
</script></body></html>`
  }, [activeVimeoId, activeAula?.aula_id, activeAula?.posicao_segundos])

  function handlePlayerMessage(ev: { nativeEvent: { data: string } }) {
    if (!activeAula) return
    try {
      const msg = JSON.parse(ev.nativeEvent.data) as { type: string; s?: number }
      if (msg.type === 'time' && typeof msg.s === 'number') {
        if (msg.s - lastSavedRef.current >= 5) {
          lastSavedRef.current = msg.s
          marcarAula.mutate({ aula_id: activeAula.aula_id, posicao: msg.s })
        }
      } else if (msg.type === 'ended') {
        marcarAula.mutate({ aula_id: activeAula.aula_id, concluida: true })
      }
    } catch { /* ignore */ }
  }

  function toggleModulo(id: string) {
    setOpenModulos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  if (estruturaQ.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-silver-50" edges={['top', 'bottom']}>
        <ActivityIndicator color="#DC2626" />
      </SafeAreaView>
    )
  }

  if (!activeAula) {
    return (
      <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm text-silver-500">Curso sem aulas disponíveis.</Text>
          <Pressable onPress={() => router.back()} className="mt-4 rounded-lg border border-silver-300 px-4 py-2">
            <Text className="text-sm text-navy">Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <View className="bg-navy px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-gold">Universidade</Text>
            <Text className="text-base font-bold text-white" numberOfLines={1}>{activeAula.aula_titulo}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Player */}
        <View className="aspect-video items-center justify-center bg-black">
          {activeAula.aula_tipo === 'video' && activeVimeoId ? (
            <WebView
              ref={playerRef}
              key={activeAula.aula_id}
              originWhitelist={['*']}
              source={{ html: vimeoHtml, baseUrl: 'https://player.vimeo.com' }}
              onMessage={handlePlayerMessage}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={false}
              renderError={() => (
                <View className="flex-1 items-center justify-center bg-black p-6">
                  <Text className="text-center text-sm text-white/70">
                    Falha ao carregar o vídeo. Verifique sua conexão e tente novamente.
                  </Text>
                </View>
              )}
              renderLoading={() => (
                <View className="flex-1 items-center justify-center bg-black">
                  <ActivityIndicator color="#DC2626" />
                </View>
              )}
              startInLoadingState
              style={{ flex: 1, backgroundColor: '#000' }}
            />
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <Play size={32} color="white" fill="white" />
            </View>
          )}
        </View>

        <View className="px-4 pt-4">
          <Text className="text-xl font-bold text-navy">{activeAula.aula_titulo}</Text>
          <Text className="text-xs text-silver-500">
            {activeAula.modulo_titulo} · Aula {activeAula.aula_ordem + 1}
            {activeAula.duracao_segundos ? ` · ${Math.round(activeAula.duracao_segundos / 60)} min` : ''}
          </Text>
        </View>

        {/* Tabs */}
        <View className="mt-4 flex-row border-b border-silver-200 px-2">
          {(['conteudo', 'recursos', 'notas'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} className="px-3 py-2.5">
              <Text className={`text-sm font-semibold ${tab === t ? 'text-navy' : 'text-silver-500'}`}>
                {t === 'conteudo' ? 'Conteúdo' : t === 'recursos' ? 'Recursos' : 'Notas'}
              </Text>
              {tab === t && <View className="mt-1.5 h-0.5 rounded-full bg-gold" />}
            </Pressable>
          ))}
        </View>

        <View className="px-4 pt-4">
          {tab === 'conteudo' && (
            <View>
              {activeAula.aula_descricao && (
                <Text className="text-sm leading-relaxed text-silver-700">{activeAula.aula_descricao}</Text>
              )}
              {activeAula.conteudo_md && (
                <Text className="mt-2 text-sm leading-relaxed text-silver-700">{activeAula.conteudo_md}</Text>
              )}
              {!activeAula.aula_descricao && !activeAula.conteudo_md && (
                <Text className="text-sm text-silver-500">Sem descrição para esta aula.</Text>
              )}
            </View>
          )}
          {tab === 'recursos' && (
            <View className="gap-2">
              {pdfUrl ? (
                <Pressable
                  onPress={() => WebBrowser.openBrowserAsync(pdfUrl)}
                  className="flex-row items-center justify-between rounded-lg border border-silver-200 bg-white p-3 active:opacity-70"
                >
                  <View className="flex-row items-center gap-2">
                    <FileText size={16} color="#0F0F0F" />
                    <Text className="text-sm text-silver-800">Material da aula (PDF)</Text>
                  </View>
                  <Text className="text-xs font-semibold text-gold">Abrir</Text>
                </Pressable>
              ) : (
                <Text className="text-sm text-silver-500">Nenhum recurso anexado a esta aula.</Text>
              )}
            </View>
          )}
          {tab === 'notas' && (
            <View className="rounded-lg border border-silver-200 bg-white p-3">
              <Text className="text-sm text-silver-400">Suas anotações... (não persistidas)</Text>
            </View>
          )}
        </View>

        {/* Curso / playlist */}
        <View className="mx-4 mt-5 overflow-hidden rounded-xl border border-silver-200 bg-white">
          <View className="border-b border-silver-200 p-4">
            <Text className="text-[11px] uppercase tracking-wider text-silver-500">Curso</Text>
            <Text className="font-semibold text-navy">{curso?.curso_titulo}</Text>
            <View className="mt-2 h-1 overflow-hidden rounded-full bg-silver-200">
              <View className="h-full bg-gold" style={{ width: `${pct}%` }} />
            </View>
            <Text className="mt-1 text-[11px] text-silver-500">{concluidas} / {totalAulas} aulas · {pct}%</Text>
          </View>

          {modulos.map((m) => {
            const open = openModulos.has(m.id)
            return (
              <View key={m.id}>
                <Pressable
                  onPress={() => toggleModulo(m.id)}
                  className="flex-row items-center gap-2 border-y border-silver-100 bg-silver-50 px-4 py-2.5"
                >
                  {open ? <ChevronDown size={16} color="#475569" /> : <ChevronRightIcon size={16} color="#475569" />}
                  <Text className="flex-1 text-sm font-semibold text-silver-800">{m.titulo}</Text>
                </Pressable>
                {open && m.aulas.map((a) => {
                  const isActive = a.aula_id === activeAula.aula_id
                  const done = !!a.concluida
                  return (
                    <Pressable
                      key={a.aula_id}
                      onPress={() => setActiveAulaId(a.aula_id)}
                      className={`flex-row items-center gap-2 px-4 py-2.5 active:bg-silver-50 ${isActive ? 'bg-gold/10' : ''}`}
                      style={isActive ? { borderLeftWidth: 2, borderLeftColor: '#DC2626' } : undefined}
                    >
                      {done
                        ? <CheckCircle2 size={16} color="#16A34A" />
                        : <Play size={16} color={isActive ? '#DC2626' : '#CBD5E1'} fill={isActive ? '#DC2626' : 'none'} />}
                      <Text className={`flex-1 text-sm ${isActive ? 'font-semibold text-navy' : 'text-silver-700'}`} numberOfLines={1}>
                        {a.aula_titulo}
                      </Text>
                      <Text className="text-[11px] text-silver-400">
                        {a.duracao_segundos ? `${Math.round(a.duracao_segundos / 60)} min` : ''}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )
          })}
        </View>

        {/* Footer ação */}
        {activeAula.concluida ? (
          <View className="m-4 flex-row items-center justify-between rounded-lg border border-success/30 bg-success/5 p-4">
            <Text className="flex-1 text-sm font-medium text-success" numberOfLines={2}>
              ✓ Aula concluída{proxima ? ` · Próxima: ${proxima.aula_titulo}` : ''}
            </Text>
            {proxima && (
              <Pressable
                onPress={() => setActiveAulaId(proxima.aula_id)}
                className="flex-row items-center gap-1 rounded-lg bg-gold px-3 py-2 active:opacity-80"
              >
                <Text className="text-xs font-bold text-white">Continuar</Text>
                <ArrowRight size={14} color="white" />
              </Pressable>
            )}
          </View>
        ) : (
          <View className="m-4 flex-row items-center justify-end gap-2">
            <Pressable
              disabled={marcarAula.isPending}
              onPress={() => marcarAula.mutate({ aula_id: activeAula.aula_id, concluida: true })}
              className="flex-row items-center gap-1 rounded-lg border border-silver-300 bg-white px-3 py-2 active:opacity-70"
            >
              {marcarAula.isPending
                ? <ActivityIndicator color="#16A34A" size="small" />
                : <CheckCircle2 size={14} color="#16A34A" />}
              <Text className="text-xs font-bold text-navy">Marcar concluída</Text>
            </Pressable>
            {proxima && (
              <Pressable
                onPress={() => setActiveAulaId(proxima.aula_id)}
                className="flex-row items-center gap-1 rounded-lg bg-gold px-3 py-2 active:opacity-80"
              >
                <Text className="text-xs font-bold text-white">Próxima</Text>
                <ArrowRight size={14} color="white" />
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function normalizeVimeoId(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = String(raw).trim()
  if (!v) return null
  if (/^\d+$/.test(v)) return v
  const uriMatch = v.match(/\/videos\/(\d+)/)
  if (uriMatch) return uriMatch[1]
  const urlMatch = v.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (urlMatch) return urlMatch[1]
  return null
}
