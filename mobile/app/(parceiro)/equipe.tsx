import { useState } from 'react'
import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator, Alert, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Plus, Mail, X, Trash2 } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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

export default function Equipe() {
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selectedEquipe, setSelectedEquipe] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNome, setInviteNome] = useState('')
  const [novaEquipeNome, setNovaEquipeNome] = useState('')

  const equipesQ = useQuery({
    queryKey: ['p-equipes'],
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
    queryKey: ['p-membros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_membros_detalhe')
        .select('id, equipe_id, usuario_id, nome_completo, email, papel_equipe, aceito_em')
      if (error) throw error
      return (data ?? []) as Membro[]
    },
  })

  const convitesQ = useQuery({
    queryKey: ['p-convites'],
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
    onError: (e: Error) => Alert.alert('Erro', e.message),
  })

  const convidar = useMutation({
    mutationFn: async () => {
      if (!selectedEquipe) throw new Error('Selecione uma equipe')
      const { data, error } = await supabase.rpc('partner_invite_membro', {
        p_equipe_id: selectedEquipe,
        p_email: inviteEmail,
        p_nome: inviteNome,
        p_papel_equipe: 'membro',
        p_permissoes: {},
      })
      if (error) throw error
      return data as { convite_token: string }
    },
    onSuccess: () => {
      setInviteOpen(false)
      setInviteEmail('')
      setInviteNome('')
      Alert.alert('Convite enviado', 'Link de convite gerado (válido 30 min).')
      qc.invalidateQueries({ queryKey: ['p-convites'] })
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  })

  const remover = useMutation({
    mutationFn: async (args: { equipe_id: string; usuario_id: string }) => {
      const { error } = await supabase.rpc('partner_remove_membro', {
        p_equipe_id: args.equipe_id,
        p_usuario_id: args.usuario_id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['p-membros'] }),
  })

  const equipes = equipesQ.data ?? []
  const membros = membrosQ.data ?? []
  const convites = convitesQ.data ?? []

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-navy px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-gold">Parceiro</Text>
            <Text className="text-lg font-bold text-white">Minha equipe</Text>
          </View>
          <Pressable
            onPress={() => {
              setSelectedEquipe(equipes[0]?.id ?? null)
              setInviteOpen(true)
            }}
            disabled={equipes.length === 0}
            className="flex-row items-center gap-1 rounded-full bg-gold px-3 py-2 active:opacity-80"
            style={{ opacity: equipes.length === 0 ? 0.5 : 1 }}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-xs font-bold text-white">Convidar</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* Criar equipe */}
        <View className="rounded-xl border border-silver-200 bg-white p-4">
          <Text className="font-semibold text-navy">Criar nova equipe</Text>
          <View className="mt-2 flex-row gap-2">
            <TextInput
              value={novaEquipeNome}
              onChangeText={setNovaEquipeNome}
              placeholder="Nome da equipe"
              className="flex-1 rounded-lg border border-silver-200 bg-silver-50 px-3 py-2 text-sm"
            />
            <Pressable
              onPress={() => criarEquipe.mutate(novaEquipeNome)}
              disabled={novaEquipeNome.trim().length < 2 || criarEquipe.isPending}
              className="rounded-lg bg-gold px-4 py-2 active:opacity-80"
              style={{ opacity: novaEquipeNome.trim().length < 2 ? 0.5 : 1 }}
            >
              <Text className="text-sm font-bold text-white">Criar</Text>
            </Pressable>
          </View>
        </View>

        {equipesQ.isLoading ? (
          <ActivityIndicator color="#DC2626" />
        ) : equipes.length === 0 ? (
          <View className="rounded-xl border border-silver-200 bg-white p-6">
            <Text className="text-center text-sm text-silver-500">
              Nenhuma equipe cadastrada ainda.
            </Text>
          </View>
        ) : (
          equipes.map(eq => {
            const ms = membros.filter(m => m.equipe_id === eq.id)
            return (
              <View key={eq.id} className="rounded-xl border border-silver-200 bg-white p-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="font-semibold text-navy">{eq.nome}</Text>
                    <Text className="text-xs text-silver-500">{ms.length} membro(s)</Text>
                  </View>
                  {eq.isolamento_estrito && (
                    <Text className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold-600">
                      ISOLADA
                    </Text>
                  )}
                </View>
                <View className="mt-3 gap-2">
                  {ms.length === 0 ? (
                    <Text className="text-xs text-silver-400">Sem membros.</Text>
                  ) : ms.map(m => (
                    <View key={m.id} className="flex-row items-center gap-3 rounded-lg bg-silver-50 p-2">
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-navy">
                        <Text className="text-sm font-bold text-white">
                          {m.nome_completo.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-silver-900" numberOfLines={1}>
                          {m.nome_completo}
                        </Text>
                        <Text className="text-xs text-silver-500" numberOfLines={1}>{m.email}</Text>
                      </View>
                      <Text className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold text-navy">
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
        <View className="rounded-xl border border-silver-200 bg-white p-4">
          <Text className="font-semibold text-navy">Convites pendentes</Text>
          {convites.length === 0 ? (
            <Text className="mt-2 text-xs text-silver-500">Nenhum convite pendente.</Text>
          ) : (
            <View className="mt-3 gap-2">
              {convites.map(c => (
                <View key={c.id} className="flex-row items-center justify-between rounded-lg bg-silver-50 px-3 py-2.5">
                  <View className="flex-1 flex-row items-center gap-2">
                    <Mail size={14} color="#9CA3AF" />
                    <Text className="flex-1 text-sm text-silver-800" numberOfLines={1}>{c.email}</Text>
                  </View>
                  <Text className="text-xs text-silver-500">
                    {new Date(c.expires_at).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Convidar modal */}
      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-2xl bg-white p-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-navy">Convidar membro</Text>
              <Pressable onPress={() => setInviteOpen(false)} className="p-1">
                <X size={20} color="#0F0F0F" />
              </Pressable>
            </View>
            <Text className="mt-3 mb-1 text-xs font-semibold text-silver-500">Equipe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {equipes.map(eq => (
                  <Pressable
                    key={eq.id}
                    onPress={() => setSelectedEquipe(eq.id)}
                    className={`rounded-full px-3 py-1.5 ${selectedEquipe === eq.id ? 'bg-gold' : 'bg-silver-100'}`}
                  >
                    <Text className={selectedEquipe === eq.id ? 'text-xs font-bold text-white' : 'text-xs text-silver-700'}>
                      {eq.nome}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Text className="mt-3 mb-1 text-xs font-semibold text-silver-500">Nome</Text>
            <TextInput
              value={inviteNome}
              onChangeText={setInviteNome}
              placeholder="Nome do membro"
              className="rounded-lg border border-silver-200 bg-silver-50 px-3 py-2 text-sm"
            />
            <Text className="mt-3 mb-1 text-xs font-semibold text-silver-500">E-mail</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="membro@empresa.com"
              autoCapitalize="none"
              keyboardType="email-address"
              className="rounded-lg border border-silver-200 bg-silver-50 px-3 py-2 text-sm"
            />
            <Pressable
              onPress={() => convidar.mutate()}
              disabled={convidar.isPending || !selectedEquipe || inviteEmail.length < 5}
              className="mt-4 items-center rounded-xl bg-gold py-3 active:opacity-80"
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
