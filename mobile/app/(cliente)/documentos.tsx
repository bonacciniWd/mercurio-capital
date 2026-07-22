import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, FileText, CheckCircle2, Upload, Download, X } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { Linking } from 'react-native'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/Badge'
import {
  buildChecklist, categoriaForTipo, CATEGORIA_LABEL, DOC_STATUS_LABEL, TIPO_LABEL,
  type ChecklistItem, type DocCategoria, type DocRowLite, type DocStatus, type DocumentoTipo, type RequisitoRow,
} from '@/lib/documentos'

type Aba = 'Pendentes' | 'Enviados' | 'Aprovados'

interface DocRow extends DocRowLite {
  id: string
  created_at: string
}

const PICKER_TIPOS = Object.keys(TIPO_LABEL) as DocumentoTipo[]

function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Uint8Array(256)
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i
  let bufferLength = b64.length * 0.75
  if (b64[b64.length - 1] === '=') bufferLength--
  if (b64[b64.length - 2] === '=') bufferLength--
  const bytes = new Uint8Array(bufferLength)
  let p = 0
  for (let i = 0; i < b64.length; i += 4) {
    const e1 = lookup[b64.charCodeAt(i)]
    const e2 = lookup[b64.charCodeAt(i + 1)]
    const e3 = lookup[b64.charCodeAt(i + 2)]
    const e4 = lookup[b64.charCodeAt(i + 3)]
    bytes[p++] = (e1 << 2) | (e2 >> 4)
    if (b64[i + 2] !== '=') bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2)
    if (b64[i + 3] !== '=') bytes[p++] = ((e3 & 3) << 6) | e4
  }
  return bytes
}

async function readFileBytes(uri: string): Promise<Uint8Array> {
  // expo-file-system v19 (SDK 54): API baseada em classes
  try {
    const f = new File(uri)
    if (typeof (f as any).bytes === 'function') {
      const b = await (f as any).bytes()
      return b as Uint8Array
    }
    if (typeof (f as any).base64 === 'function') {
      const b64 = await (f as any).base64()
      return base64ToBytes(b64)
    }
  } catch {
    // fallback fetch+arrayBuffer
  }
  const res = await fetch(uri)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

export default function Documentos() {
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('Pendentes')

  // pega proposta mais recente do cliente
  const propostaQ = useQuery({
    queryKey: ['cliente-proposta-atual'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const propostaId = propostaQ.data?.id

  const reqQ = useQuery({
    queryKey: ['doc-requisitos'],
    queryFn: async (): Promise<RequisitoRow[]> => {
      const { data, error } = await supabase
        .from('documento_requisitos')
        .select('categoria, tipo, obrigatorio, ordem')
      if (error) throw error
      return (data ?? []) as RequisitoRow[]
    },
  })

  const docsQ = useQuery({
    enabled: !!propostaId,
    queryKey: ['cliente-docs', propostaId],
    queryFn: async () => {
      // garante placeholders pendentes (idempotente)
      await supabase.rpc('proposta_documentos_seed', { p_proposta_id: propostaId! })
      const { data, error } = await supabase
        .from('proposta_documentos')
        .select('id, proposta_id, tipo, categoria, storage_path, status, validado, created_at')
        .eq('proposta_id', propostaId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as DocRow[]
    },
  })

  const uploadMut = useMutation({
    mutationFn: async ({ uri, mime, name, tipo, categoria }: { uri: string; mime: string; name: string; tipo: DocumentoTipo; categoria: DocCategoria }) => {
      if (!propostaId) throw new Error('Proposta não encontrada')
      const ext = (name.split('.').pop() || 'bin').toLowerCase()
      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const path = `${propostaId}/${categoria}/${fileId}.${ext}`

      const bytes = await readFileBytes(uri)

      const { error: upErr } = await supabase.storage
        .from('proposta-docs')
        .upload(path, bytes, { contentType: mime, upsert: false })
      if (upErr) throw new Error(upErr.message)

      const { error: insErr } = await supabase.from('proposta_documentos').insert({
        proposta_id: propostaId,
        tipo,
        categoria,
        storage_path: path,
        bucket: 'proposta-docs',
        mime_type: mime,
        tamanho_bytes: bytes.byteLength,
        origem: 'cliente',
        status: 'enviado',
      })
      if (insErr) {
        await supabase.storage.from('proposta-docs').remove([path])
        throw new Error(insErr.message)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente-docs', propostaId] })
      Alert.alert('Sucesso', 'Documento enviado para análise.')
    },
    onError: (err: unknown) => Alert.alert('Falha no envio', err instanceof Error ? err.message : String(err)),
    onSettled: () => setUploadingKey(null),
  })

  const removeMut = useMutation({
    mutationFn: async (d: DocRow) => {
      const { error } = await supabase.from('proposta_documentos').delete().eq('id', d.id)
      if (error) throw error
      if (d.storage_path) await supabase.storage.from('proposta-docs').remove([d.storage_path])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cliente-docs', propostaId] }),
    onError: (err: unknown) => Alert.alert('Falha', err instanceof Error ? err.message : String(err)),
  })

  async function baixarDocumento(path: string) {
    try {
      const { data, error } = await supabase.storage.from('proposta-docs').createSignedUrl(path, 60 * 5)
      if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Falha ao gerar URL')
      await Linking.openURL(data.signedUrl)
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : String(e))
    }
  }

  const escolherEEnviar = async (tipo: DocumentoTipo, categoria: DocCategoria, key: string, source: 'camera' | 'galeria' | 'arquivo') => {
    try {
      let asset: { uri: string; mimeType?: string | null; name?: string | null } | null = null
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) return Alert.alert('Permissão negada', 'Habilite o acesso à câmera.')
        const r = await ImagePicker.launchCameraAsync({ quality: 0.85, mediaTypes: ['images'] })
        if (r.canceled) return
        asset = { uri: r.assets[0].uri, mimeType: r.assets[0].mimeType ?? 'image/jpeg', name: r.assets[0].fileName ?? `foto-${Date.now()}.jpg` }
      } else if (source === 'galeria') {
        const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: ['images'] })
        if (r.canceled) return
        asset = { uri: r.assets[0].uri, mimeType: r.assets[0].mimeType ?? 'image/jpeg', name: r.assets[0].fileName ?? `img-${Date.now()}.jpg` }
      } else {
        const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true })
        if (r.canceled) return
        const a = r.assets[0]
        asset = { uri: a.uri, mimeType: a.mimeType ?? 'application/pdf', name: a.name ?? `doc-${Date.now()}` }
      }
      if (!asset) return
      setUploadingKey(key)
      uploadMut.mutate({ uri: asset.uri, mime: asset.mimeType || 'application/octet-stream', name: asset.name || 'arquivo', tipo, categoria })
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : String(e))
      setUploadingKey(null)
    }
  }

  const onPick = (tipo: DocumentoTipo, categoria: DocCategoria, key: string) => {
    Alert.alert('Enviar documento', `Como deseja enviar ${TIPO_LABEL[tipo]}?`, [
      { text: 'Câmera', onPress: () => escolherEEnviar(tipo, categoria, key, 'camera') },
      { text: 'Galeria', onPress: () => escolherEEnviar(tipo, categoria, key, 'galeria') },
      { text: 'Arquivo', onPress: () => escolherEEnviar(tipo, categoria, key, 'arquivo') },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  const checklist = useMemo(() => buildChecklist(docsQ.data ?? [], reqQ.data ?? []), [docsQ.data, reqQ.data])

  const docByKey = useMemo(() => {
    const map = new Map<string, DocRow>()
    for (const d of docsQ.data ?? []) {
      if (!d.storage_path) continue
      const key = `${d.categoria}:${d.tipo}`
      if (!map.has(key)) map.set(key, d)
    }
    return map
  }, [docsQ.data])

  const contagens = useMemo(() => ({
    Pendentes: checklist.filter((i) => i.status === 'pendente' || i.status === 'rejeitado').length,
    Enviados: checklist.filter((i) => i.status === 'enviado').length,
    Aprovados: checklist.filter((i) => i.status === 'aprovado').length,
  }), [checklist])

  const visiveis = useMemo(() => checklist.filter((i) => {
    if (aba === 'Pendentes') return i.status === 'pendente' || i.status === 'rejeitado'
    if (aba === 'Enviados') return i.status === 'enviado'
    return i.status === 'aprovado'
  }), [checklist, aba])

  const porCategoria = useMemo(() => {
    const order: DocCategoria[] = ['pessoa_fisica', 'pessoa_juridica', 'imovel']
    const map = new Map<DocCategoria, ChecklistItem[]>()
    for (const item of visiveis) {
      const list = map.get(item.categoria) ?? (map.set(item.categoria, []), map.get(item.categoria)!)
      list.push(item)
    }
    return order.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const)
  }, [visiveis])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([docsQ.refetch(), reqQ.refetch()])
    setRefreshing(false)
  }, [docsQ, reqQ])

  const abas: Aba[] = ['Pendentes', 'Enviados', 'Aprovados']

  function badgeVariant(status: DocStatus): 'green' | 'amber' | 'gray' | 'red' {
    if (status === 'aprovado') return 'green'
    if (status === 'enviado') return 'amber'
    if (status === 'rejeitado') return 'red'
    return 'gray'
  }

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <View className="bg-white px-5 pb-3 pt-2">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="#0F0F0F" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-navy">Documentos</Text>
            {propostaQ.data?.protocolo && (
              <Text className="font-mono text-[11px] text-silver-500">{propostaQ.data.protocolo}</Text>
            )}
          </View>
        </View>
      </View>

      {propostaQ.isLoading || docsQ.isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>
      ) : !propostaId ? (
        <View className="flex-1 items-center justify-center px-6">
          <FileText size={40} color="#9CA3AF" />
          <Text className="mt-3 text-center text-sm text-silver-600">Você ainda não possui uma proposta vinculada.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
        >
          <View className="flex-row rounded-xl bg-silver-100 p-1">
            {abas.map((t) => (
              <Pressable key={t} onPress={() => setAba(t)} className={`flex-1 rounded-lg py-2 ${aba === t ? 'bg-white' : ''}`}>
                <Text className={`text-center text-xs font-semibold ${aba === t ? 'text-navy' : 'text-silver-500'}`}>{t} ({contagens[t]})</Text>
              </Pressable>
            ))}
          </View>

          {porCategoria.length === 0 && (
            <View className="rounded-xl border border-silver-200 bg-white p-6">
              <Text className="text-center text-sm text-silver-600">Nenhum documento nesta aba.</Text>
            </View>
          )}

          {porCategoria.map(([categoria, items]) => (
            <View key={categoria} className="gap-2">
              <Text className="text-xs font-semibold uppercase tracking-wider text-silver-500">{CATEGORIA_LABEL[categoria]}</Text>
              {items.map((item) => {
                const key = `${item.categoria}:${item.tipo}`
                const doc = docByKey.get(key)
                const enviando = uploadingKey === key && uploadMut.isPending
                return (
                  <View key={key} className="flex-row items-center gap-3 rounded-xl border border-silver-200 bg-white p-4">
                    <View className={`h-10 w-10 items-center justify-center rounded-lg ${
                      item.status === 'aprovado' ? 'bg-success/15' :
                      item.status === 'enviado' ? 'bg-warning/15' : 'bg-silver-100'
                    }`}>
                      {item.status === 'aprovado'
                        ? <CheckCircle2 size={20} color="#16A34A" />
                        : <FileText size={20} color="#9CA3AF" />}
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-silver-900">{TIPO_LABEL[item.tipo] || item.tipo}</Text>
                      <View className="mt-0.5 flex-row items-center gap-2">
                        <Badge variant={badgeVariant(item.status)}>{DOC_STATUS_LABEL[item.status]}</Badge>
                        {item.obrigatorio && <Text className="text-[10px] font-semibold text-danger">Obrigatório</Text>}
                      </View>
                    </View>
                    {(item.status === 'pendente' || item.status === 'rejeitado') && (
                      <Pressable
                        onPress={() => onPick(item.tipo, item.categoria, key)}
                        disabled={enviando}
                        className="rounded-lg bg-gold px-3 py-2"
                      >
                        {enviando ? <ActivityIndicator color="white" /> : <Text className="text-xs font-bold text-white">Enviar</Text>}
                      </Pressable>
                    )}
                    {doc && (
                      <View className="flex-row items-center gap-1">
                        <Pressable onPress={() => baixarDocumento(doc.storage_path!)} className="p-2">
                          <Download size={18} color="#9CA3AF" />
                        </Pressable>
                        {item.status === 'enviado' && (
                          <Pressable
                            onPress={() => Alert.alert('Remover', 'Deseja remover este envio?', [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: 'Remover', style: 'destructive', onPress: () => removeMut.mutate(doc) },
                            ])}
                            className="p-2"
                          >
                            <X size={18} color="#9CA3AF" />
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          ))}

          {/* Botão genérico para enviar tipo livre */}
          <Pressable
            onPress={() => {
              const buttons: { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }[] = PICKER_TIPOS.map((t) => ({
                text: TIPO_LABEL[t],
                onPress: () => onPick(t, categoriaForTipo(t), `${categoriaForTipo(t)}:${t}`),
              }))
              buttons.push({ text: 'Cancelar', style: 'cancel' })
              Alert.alert('Tipo de documento', '', buttons)
            }}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-silver-300 bg-white py-4"
          >
            <Upload size={18} color="#0F0F0F" />
            <Text className="font-semibold text-navy">Enviar outro documento</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
