import { useState } from 'react'
import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator, Alert, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Plus, Mail, X, Trash2, Copy } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { canManagePartner } from '@/lib/partnerAccess'
import { PartnerFeedback } from '@/components/parceiro/PartnerUI'

interface Equipe {
  id: string
  nome: string
  isolamento_estrito: boolean
}
interface Membro {
  id: string
  equipe_id: string
  usuario_id: string
  nome_completo: string
  email: string
  papel_equipe: 'admin_equipe' | 'membro'
  aceito_em: string | null
}
interface Convite {
  id: string
  equipe_id: string
  email: string
  nome: string | null
  papel_equipe: 'admin_equipe' | 'membro'
  expires_at: string
  created_at: string
}

interface InviteResponse {
  convite_token: string
  equipe_id: string
  email: string
  expires_in_min: number
  email_status?: string
  email_erro?: string
}

interface InviteResult {
  url: string
  emailStatus: string | null
  emailError: string | null
}

const INVITE_BASE_URL = (process.env.EXPO_PUBLIC_APP_URL ?? 'https://mercuriocapitalsa.com.br').replace(/\/+$/, '')

function getEquipeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Falha ao executar ação na equipe.'
  const normalized = raw.toLowerCase()

  if (normalized.includes('no api key found')) {
    return 'Falha de autenticação com a API. Atualize o app e tente novamente.'
  }

  if (normalized.includes('digest(') && normalized.includes('does not exist')) {
    return 'Ambiente de banco desatualizado para convites. Solicite atualização da migration.'
  }

  return raw
}

export default function Equipe() {
  const qc = useQueryClient()
  const { session } = useAuth()
  const allowed = canManagePartner(session?.role)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selectedEquipe, setSelectedEquipe] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNome, setInviteNome] = useState('')
  const [novaEquipeNome, setNovaEquipeNome] = useState('')
  const [lastInviteResult, setLastInviteResult] = useState<InviteResult | null>(null)

  const equipesQ = useQuery({
    queryKey: ['p-equipes', session?.userId], enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipes')
        .select('id, nome, isolamento_estrito')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Equipe[]
    },
  })

  const membrosQ = useQuery({
    queryKey: ['p-membros', session?.userId], enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_membros_detalhe')
        .select('id, equipe_id, usuario_id, nome_completo, email, papel_equipe, aceito_em')
      if (error) throw error
      return (data ?? []) as Membro[]
    },
  })

  const convitesQ = useQuery({
    queryKey: ['p-convites', session?.userId], enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_convites_pendentes')
        .select('id, equipe_id, email, nome, papel_equipe, expires_at, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Convite[]
    },
  })

  const criarEquipe = useMutation({
    mutationFn: async (nome: string) => {
      if (!allowed) throw new Error('Acesso restrito ao parceiro responsável.')
      const { error } = await supabase.rpc('partner_create_equipe', {
        p_nome: nome,
        p_isolamento_estrito: false,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setNovaEquipeNome('')
      qc.invalidateQueries({ queryKey: ['p-equipes'] })
    },
    onError: (e: unknown) => Alert.alert('Erro', getEquipeErrorMessage(e)),
  })

  const convidar = useMutation({
    mutationFn: async () => {
      if (!allowed) throw new Error('Acesso restrito ao parceiro responsável.')
      if (!selectedEquipe) throw new Error('Selecione uma equipe')
      const { data, error } = await supabase.rpc('partner_invite_membro', {
        p_equipe_id: selectedEquipe,
        p_email: inviteEmail,
        p_nome: inviteNome,
        p_papel_equipe: 'membro',
        p_permissoes: {},
      })
      if (error) throw error
      const payload = (data ?? {}) as InviteResponse
      return {
        url: `${INVITE_BASE_URL}/convite/${payload.convite_token}`,
        emailStatus: payload.email_status ?? null,
        emailError: payload.email_erro ?? null,
      }
    },
    onSuccess: async (result) => {
      setInviteOpen(false)
      setInviteEmail('')
      setInviteNome('')
      setLastInviteResult(result)
      await Clipboard.setStringAsync(result.url)

      if (result.emailStatus === 'enfileirado') {
        Alert.alert(
          'Convite enviado',
          'Link de convite gerado (válido 30 min) e e-mail transacional enfileirado. O link também foi copiado.'
        )
      } else if (result.emailStatus === 'falha_enqueue') {
        Alert.alert(
          'Convite gerado com ressalva',
          'O convite foi criado, mas houve falha no envio automático de e-mail. O link foi copiado para envio manual.'
        )
      } else {
        Alert.alert(
          'Convite gerado',
          'Link de convite criado (válido 30 min). O link foi copiado para envio manual, se necessário.'
        )
      }

      qc.invalidateQueries({ queryKey: ['p-convites'] })
    },
    onError: (e: unknown) => Alert.alert('Erro', getEquipeErrorMessage(e)),
  })

  const remover = useMutation({
    mutationFn: async (args: { equipe_id: string; usuario_id: string }) => {
      if (!allowed) throw new Error('Acesso restrito ao parceiro responsável.')
      const { error } = await supabase.rpc('partner_remove_membro', {
        p_equipe_id: args.equipe_id,
        p_usuario_id: args.usuario_id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['p-membros'] }),
    onError: (e: unknown) => Alert.alert('Erro', getEquipeErrorMessage(e)),
  })

  const equipes = equipesQ.data ?? []
  const membros = membrosQ.data ?? []
  const convites = convitesQ.data ?? []

  return (
    <SafeAreaView className="flex-1 bg-[#09090B]" edges={['top']}>
      <View className="border-b border-[#27272A] bg-[#09090B] px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-[#F87171]">Parceiro</Text>
            <Text className="text-lg font-bold text-white">Minha equipe</Text>
          </View>
          <Pressable
            onPress={() => {
              setSelectedEquipe(equipes[0]?.id ?? null)
              setInviteOpen(true)
            }}
            disabled={!allowed || equipes.length === 0}
            className="flex-row items-center gap-1 rounded-full bg-[#DC2626] px-3 py-2 active:opacity-80"
            style={{ opacity: equipes.length === 0 ? 0.5 : 1 }}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-xs font-bold text-white">Convidar</Text>
          </Pressable>
        </View>
      </View>

      {!allowed ? <View className="p-5"><PartnerFeedback title="Acesso restrito" text="A gestão da equipe está disponível para o parceiro responsável." /></View> : <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        {/* Criar equipe */}
        <View className="rounded-xl border border-[#2D2D32] bg-[#151518] p-4">
          <Text className="font-semibold text-white">Criar nova equipe</Text>
          <View className="mt-2 flex-row gap-2">
            <TextInput
              value={novaEquipeNome}
              onChangeText={setNovaEquipeNome}
              placeholder="Nome da equipe"
              className="flex-1 rounded-lg border border-[#414148] bg-[#202024] px-3 py-2 text-sm text-white"
            />
            <Pressable
              onPress={() => criarEquipe.mutate(novaEquipeNome)}
              disabled={novaEquipeNome.trim().length < 2 || criarEquipe.isPending}
              className="rounded-lg bg-[#DC2626] px-4 py-2 active:opacity-80"
              style={{ opacity: novaEquipeNome.trim().length < 2 ? 0.5 : 1 }}
            >
              <Text className="text-sm font-bold text-white">Criar</Text>
            </Pressable>
          </View>
        </View>

        {lastInviteResult && (
          <View className="rounded-xl border border-[#2D2D32] bg-[#151518] p-4">
            <Text className="font-semibold text-white">Último convite gerado</Text>
            <Text className="mt-2 text-xs text-[#A1A1AA]" numberOfLines={1}>
              {lastInviteResult.url}
            </Text>

            {lastInviteResult.emailStatus === 'enfileirado' && (
              <Text className="mt-2 rounded-md bg-[#153024] px-2 py-1 text-xs text-[#86EFAC]">
                E-mail transacional enfileirado automaticamente.
              </Text>
            )}

            {lastInviteResult.emailStatus === 'falha_enqueue' && (
              <Text className="mt-2 rounded-md bg-[#3A2A16] px-2 py-1 text-xs text-[#FCD34D]">
                Falha no envio automático. Use o link copiado para envio manual.
              </Text>
            )}

            {lastInviteResult.emailStatus !== 'enfileirado' && lastInviteResult.emailStatus !== 'falha_enqueue' && (
              <Text className="mt-2 rounded-md bg-[#202024] px-2 py-1 text-xs text-[#D4D4D8]">
                Convite gerado com sucesso. Envie manualmente o link quando necessário.
              </Text>
            )}

            {lastInviteResult.emailError && (
              <Text className="mt-2 text-[11px] text-[#A1A1AA]" numberOfLines={2}>
                Detalhe técnico do envio automático: {lastInviteResult.emailError}
              </Text>
            )}

            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(lastInviteResult.url)
                Alert.alert('Link copiado', 'Link de convite copiado para compartilhamento manual.')
              }}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-lg border border-[#414148] bg-[#202024] py-2 active:opacity-80"
            >
              <Copy size={14} color="#D4D4D8" />
              <Text className="text-xs font-semibold text-[#D4D4D8]">Copiar link novamente</Text>
            </Pressable>
          </View>
        )}

        {equipesQ.isError || membrosQ.isError || convitesQ.isError ? (
          <PartnerFeedback title="Não foi possível carregar a equipe" retry={() => { void equipesQ.refetch(); void membrosQ.refetch(); void convitesQ.refetch() }} />
        ) : equipesQ.isLoading || membrosQ.isLoading || convitesQ.isLoading ? (
          <ActivityIndicator color="#DC2626" />
        ) : equipes.length === 0 ? (
          <View className="rounded-xl border border-[#2D2D32] bg-[#151518] p-6">
            <Text className="text-center text-sm text-[#A1A1AA]">
              Nenhuma equipe cadastrada ainda.
            </Text>
          </View>
        ) : (
          equipes.map(eq => {
            const ms = membros.filter(m => m.equipe_id === eq.id)
            return (
              <View key={eq.id} className="rounded-xl border border-[#2D2D32] bg-[#151518] p-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="font-semibold text-white">{eq.nome}</Text>
                    <Text className="text-xs text-[#A1A1AA]">{ms.length} membro(s)</Text>
                  </View>
                  {eq.isolamento_estrito && (
                    <Text className="rounded-full bg-[#DC2626]/15 px-2 py-0.5 text-[10px] font-bold text-[#F87171]">
                      ISOLADA
                    </Text>
                  )}
                </View>
                <View className="mt-3 gap-2">
                  {ms.length === 0 ? (
                    <Text className="text-xs text-[#A1A1AA]">Sem membros.</Text>
                  ) : ms.map(m => (
                    <View key={m.id} className="flex-row items-center gap-3 rounded-lg bg-[#202024] p-2">
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#28171B]">
                        <Text className="text-sm font-bold text-white">
                          {m.nome_completo.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-white" numberOfLines={1}>
                          {m.nome_completo}
                        </Text>
                        <Text className="text-xs text-[#A1A1AA]" numberOfLines={1}>{m.email}</Text>
                      </View>
                      <Text className="rounded-full bg-[#28171B]/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {m.papel_equipe === 'admin_equipe' ? 'Admin' : 'Membro'}
                      </Text>
                      <Pressable
                        onPress={() => {
                          Alert.alert('Remover', `Remover ${m.nome_completo}?`, [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Remover',
                              style: 'destructive',
                              onPress: () => remover.mutate({ equipe_id: eq.id, usuario_id: m.usuario_id }),
                            },
                          ])
                        }}
                        className="p-1"
                      >
                        <Trash2 size={14} color="#DC2626" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )
          })
        )}

        {/* Convites pendentes */}
        <View className="rounded-xl border border-[#2D2D32] bg-[#151518] p-4">
          <Text className="font-semibold text-white">Convites pendentes</Text>
          {convites.length === 0 ? (
            <Text className="mt-2 text-xs text-[#A1A1AA]">Nenhum convite pendente.</Text>
          ) : (
            <View className="mt-3 gap-2">
              {convites.map(c => (
                <View key={c.id} className="flex-row items-center justify-between rounded-lg bg-[#202024] px-3 py-2.5">
                  <View className="flex-1 flex-row items-center gap-2">
                    <Mail size={14} color="#9CA3AF" />
                    <Text className="flex-1 text-sm text-[#E4E4E7]" numberOfLines={1}>{c.email}</Text>
                  </View>
                  <Text className="text-xs text-[#A1A1AA]">
                    {new Date(c.expires_at).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>}

      {/* Convidar modal */}
      <Modal visible={allowed && inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <View className="flex-1 justify-end bg-black/70">
          <View className="rounded-t-2xl bg-[#151518] p-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-white">Convidar membro</Text>
              <Pressable onPress={() => setInviteOpen(false)} className="p-1">
                <X size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text className="mt-3 mb-1 text-xs font-semibold text-[#A1A1AA]">Equipe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {equipes.map(eq => (
                  <Pressable
                    key={eq.id}
                    onPress={() => setSelectedEquipe(eq.id)}
                    className={`rounded-full px-3 py-1.5 ${selectedEquipe === eq.id ? 'bg-[#DC2626]' : 'bg-[#202024]'}`}
                  >
                    <Text className={selectedEquipe === eq.id ? 'text-xs font-bold text-white' : 'text-xs text-[#D4D4D8]'}>
                      {eq.nome}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Text className="mt-3 mb-1 text-xs font-semibold text-[#A1A1AA]">Nome</Text>
            <TextInput
              value={inviteNome}
              onChangeText={setInviteNome}
              placeholder="Nome do membro"
              className="rounded-lg border border-[#414148] bg-[#202024] px-3 py-2 text-sm text-white"
            />
            <Text className="mt-3 mb-1 text-xs font-semibold text-[#A1A1AA]">E-mail</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="membro@empresa.com"
              autoCapitalize="none"
              keyboardType="email-address"
              className="rounded-lg border border-[#414148] bg-[#202024] px-3 py-2 text-sm text-white"
            />
            <Pressable
              onPress={() => convidar.mutate()}
              disabled={convidar.isPending || !selectedEquipe || inviteEmail.length < 5}
              className="mt-4 items-center rounded-xl bg-[#DC2626] py-3 active:opacity-80"
              style={{ opacity: !selectedEquipe || inviteEmail.length < 5 ? 0.5 : 1 }}
            >
              {convidar.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-bold text-white">Gerar convite</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
