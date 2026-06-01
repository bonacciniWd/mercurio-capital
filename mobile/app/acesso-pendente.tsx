import { useEffect, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import {
  LogOut, CheckCircle2, AlertCircle, Upload, FileText, X,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Me = {
  id?: string
  email?: string
  nome?: string
  role?: string
  partner_id?: string | null
  partner_status?: 'pending' | 'approved' | 'rejected' | 'suspended' | null
  approved?: boolean
}

type DocSlot = { tipo: string; label: string; required: boolean; hint: string }
type UploadedDoc = { id: string; tipo: string; storagePath: string; fileName: string }

const DOC_SLOTS: DocSlot[] = [
  { tipo: 'contrato_social',        label: 'Contrato social', required: true,  hint: 'PDF do contrato social atualizado.' },
  { tipo: 'cpf',                    label: 'Cartão CNPJ',     required: true,  hint: 'Comprovante de inscrição/situação cadastral CNPJ.' },
  { tipo: 'comprovante_residencia', label: 'Comprovante de endereço', required: false, hint: 'Conta de luz, água ou telefone — últimos 90 dias.' },
]

export default function AcessoPendente() {
  const { signOut } = useAuth()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Record<string, UploadedDoc | undefined>>({})
  const [submitted, setSubmitted] = useState(false)
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('me')
      if (cancelled) return
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      let m = (data ?? {}) as Me
      // Auto-cadastro: se for partner sem partner_id, cria via RPC.
      if (m.role === 'partner' && !m.partner_id) {
        const { error: regErr } = await supabase.rpc('partner_self_register', {
          p_cpf: null, p_dados_bancarios: null,
        })
        if (cancelled) return
        if (regErr) {
          setError(regErr.message)
        } else {
          const { data: data2 } = await supabase.rpc('me')
          if (cancelled) return
          m = (data2 ?? {}) as Me
        }
      }
      setMe(m)
      if (m.approved && m.role === 'partner') router.replace('/(parceiro)/dashboard')
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  async function pickAndUpload(slot: DocSlot) {
    if (!me?.partner_id) return
    setUploadingTipo(slot.tipo)
    setError(null)
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      })
      if (res.canceled || !res.assets?.[0]) {
        setUploadingTipo(null)
        return
      }
      const asset = res.assets[0]
      const fileName = asset.name || `${slot.tipo}.pdf`
      const ext = (fileName.split('.').pop() || 'pdf').toLowerCase()
      const path = `${me.partner_id}/${slot.tipo}/${Date.now()}.${ext}`

      // Lê arquivo como base64 e converte para ArrayBuffer (Supabase storage RN)
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
      const bin = atob(base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

      const contentType = asset.mimeType || (ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`)

      const { error: upErr } = await supabase.storage
        .from('partner_docs')
        .upload(path, bytes, { contentType, upsert: false })
      if (upErr) throw new Error(upErr.message)

      const { data: row, error: insErr } = await supabase
        .from('partner_documentos')
        .insert({ partner_id: me.partner_id, tipo: slot.tipo, storage_path: path })
        .select('id')
        .single()
      if (insErr) {
        await supabase.storage.from('partner_docs').remove([path])
        throw new Error(insErr.message)
      }

      setUploads(prev => ({
        ...prev,
        [slot.tipo]: { id: row.id, tipo: slot.tipo, storagePath: path, fileName },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload.')
    } finally {
      setUploadingTipo(null)
    }
  }

  async function removeUpload(slot: DocSlot) {
    const current = uploads[slot.tipo]
    if (!current) return
    try {
      await supabase.from('partner_documentos').delete().eq('id', current.id)
      await supabase.storage.from('partner_docs').remove([current.storagePath])
      setUploads(prev => ({ ...prev, [slot.tipo]: undefined }))
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao remover.')
    }
  }

  const docsOk = DOC_SLOTS.filter(s => s.required).every(s => uploads[s.tipo])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#737373" />
        </View>
      </SafeAreaView>
    )
  }

  const isPartner = me?.role === 'partner'
  const partnerId = me?.partner_id ?? null
  const status = me?.partner_status ?? null

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <View className="rounded-2xl border border-silver-200 bg-white p-6">
          {/* Cabeçalho */}
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase tracking-wider text-gold-600">Cadastro em análise</Text>
              <Text className="mt-1 text-2xl font-bold text-navy">
                {status === 'rejected' ? 'Cadastro recusado' : 'Acesso operacional pendente'}
              </Text>
              {me?.email && <Text className="mt-1 text-xs text-silver-500">Logado como {me.email}</Text>}
            </View>
            <Pressable
              onPress={handleLogout}
              className="flex-row items-center gap-1 rounded-md border border-silver-300 px-3 py-1.5 active:bg-silver-50"
            >
              <LogOut size={14} color="#525252" />
              <Text className="text-xs text-silver-700">Sair</Text>
            </Pressable>
          </View>

          {error && (
            <View className="mt-4 flex-row items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
              <AlertCircle size={14} color="#DC2626" />
              <Text className="flex-1 text-xs text-danger">{error}</Text>
            </View>
          )}

          {!isPartner ? (
            <Text className="mt-4 text-sm text-silver-600">
              Sua conta ainda não foi associada a um parceiro. Aguarde o contato da equipe Mercurio.
            </Text>
          ) : submitted ? (
            <View className="mt-6 items-center">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 size={26} color="#16A34A" />
              </View>
              <Text className="text-lg font-bold text-navy">Documentos enviados!</Text>
              <Text className="mt-2 text-center text-sm text-silver-600">
                Sua documentação foi enviada para análise. Você receberá um e-mail assim que a aprovação for concluída.
              </Text>
              <Pressable
                onPress={() => router.replace('/login')}
                className="mt-6 rounded-lg border border-silver-300 px-5 py-2.5 active:bg-silver-50"
              >
                <Text className="text-sm font-semibold text-navy">Voltar ao início</Text>
              </Pressable>
            </View>
          ) : !partnerId ? (
            <Text className="mt-4 text-sm text-silver-600">
              Sua conta de parceiro foi criada, mas ainda não temos o registro vinculado. Aguarde alguns instantes
              e tente novamente.
            </Text>
          ) : (
            <View className="mt-5 gap-4">
              {status !== 'rejected' && (
                <Text className="text-sm text-silver-600">
                  Bem-vindo{me?.nome ? `, ${me.nome.split(' ')[0]}` : ''}! Para concluir seu cadastro, anexe os
                  documentos abaixo. Após o envio, nossa equipe revisará em até 24h úteis.
                </Text>
              )}
              {status === 'rejected' && (
                <Text className="text-sm text-silver-700">
                  Seu cadastro foi recusado. Entre em contato pelo suporte ou reenvie seus documentos atualizados —
                  vamos reavaliar.
                </Text>
              )}

              {DOC_SLOTS.map(slot => {
                const up = uploads[slot.tipo]
                const isUp = uploadingTipo === slot.tipo
                return (
                  <View
                    key={slot.tipo}
                    className={`rounded-xl border p-4 ${up ? 'border-success/40 bg-success/5' : 'border-silver-300 bg-silver-50'}`}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-semibold text-navy">{slot.label}</Text>
                          {slot.required && (
                            <View className="rounded bg-danger/10 px-1.5 py-0.5">
                              <Text className="text-[10px] font-bold text-danger">Obrigatório</Text>
                            </View>
                          )}
                        </View>
                        <Text className="mt-1 text-xs text-silver-600">{slot.hint}</Text>

                        {up && (
                          <View className="mt-2 flex-row items-center gap-2">
                            <FileText size={12} color="#16A34A" />
                            <Text className="flex-1 text-xs text-success" numberOfLines={1}>{up.fileName}</Text>
                          </View>
                        )}
                      </View>
                      <Pressable
                        onPress={() => up ? removeUpload(slot) : pickAndUpload(slot)}
                        disabled={isUp}
                        className={`flex-row items-center gap-1 rounded-md px-3 py-2 ${up ? 'border border-silver-300 bg-white' : 'bg-navy'} ${isUp ? 'opacity-50' : ''}`}
                      >
                        {isUp ? (
                          <ActivityIndicator size="small" color={up ? '#0F0F0F' : 'white'} />
                        ) : up ? (
                          <>
                            <X size={12} color="#525252" />
                            <Text className="text-xs font-semibold text-silver-700">Remover</Text>
                          </>
                        ) : (
                          <>
                            <Upload size={12} color="white" />
                            <Text className="text-xs font-semibold text-white">Anexar</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )
              })}

              <Pressable
                onPress={() => setSubmitted(true)}
                disabled={!docsOk}
                className={`items-center rounded-lg py-3.5 ${docsOk ? 'bg-gold active:opacity-80' : 'bg-silver-200'}`}
              >
                <Text className={`text-base font-bold ${docsOk ? 'text-white' : 'text-silver-500'}`}>
                  {docsOk ? 'Enviar para análise' : 'Anexe os documentos obrigatórios'}
                </Text>
              </Pressable>

              <Text className="text-center text-xs text-silver-500">
                Você pode fechar o app e voltar mais tarde — seus uploads ficam salvos.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

