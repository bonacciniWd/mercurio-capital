import { useState } from 'react'
import { Text, View, Linking, Alert } from 'react-native'
import { router } from 'expo-router'
import { FileText, GraduationCap, MessageCircle } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ClientScreen, Card, Action, SectionTitle, Body, Label, LinkCard, Status, Feedback } from '@/components/cliente/ClienteUI'
import { documentRoute, useClientArchive, useClientProposals } from '@/lib/clienteData'
import { PRODUTO_LABEL, valorBRL } from '@/lib/clientePresentation'

export default function ClienteHome() {
  const { session, signOut } = useAuth()
  const propostas = useClientProposals()
  const acervo = useClientArchive()
  const [refreshing, setRefreshing] = useState(false)
  const contato = useQuery({
    queryKey: ['client', session?.userId, 'contact'], queryFn: async () => {
      const { data, error } = await supabase.rpc('cliente_atendimento_contato')
      if (error) throw error
      return typeof data === 'string' && /^\d{10,15}$/.test(data) ? data : null
    }, retry: false
  })
  const principal = propostas.data?.[0]
  const pedidos = acervo.data?.solicitacoes.filter(p => p.status !== 'em_analise') ?? []
  async function refresh() { setRefreshing(true); try { await Promise.all([propostas.refetch(), acervo.refetch(), contato.refetch()]) } finally { setRefreshing(false) } }
  return <ClientScreen title="Mercúrio Capital" subtitle="Seu espaço de acompanhamento" back={false} refreshing={refreshing} onRefresh={refresh}>
    <View className="gap-2"><Label>Área do cliente</Label><Text className="text-3xl font-bold text-white">{session?.nome ? `Olá, ${session.nome.split(' ')[0]}.` : 'Boas-vindas.'}</Text><Body>Suas propostas, documentos e próximos passos em um só lugar.</Body></View>
    {propostas.isPending ? <Feedback loading title="Carregando suas propostas" /> : propostas.isError ? <Feedback title="Não foi possível carregar suas propostas" retry={() => void propostas.refetch()} /> : principal ? <Card accent><View className="gap-4">
      <View className="gap-2"><Label>Proposta em destaque</Label><Text className="text-xs text-[#B8B8C2]">{principal.protocolo}</Text><SectionTitle>{PRODUTO_LABEL[principal.produto] ?? principal.produto}</SectionTitle></View>
      <View className="gap-1"><Body>Valor solicitado</Body><Text className="text-3xl font-bold text-white" adjustsFontSizeToFit numberOfLines={1}>{valorBRL(principal.valor_solicitado)}</Text><Body>{principal.prazo_meses ? `${principal.prazo_meses} meses` : 'Prazo não informado'}</Body></View>
      <View className="gap-2"><Label>Status atual</Label><Status value={principal.status} /></View>
      <Action label="Ver minha proposta" onPress={() => router.push(`/(cliente)/propostas/${principal.id}`)} />
    </View></Card> : <Feedback title="Seu espaço está pronto" text="As propostas vinculadas à sua conta aparecerão aqui. Se você recebeu um convite, abra o link para continuar." />}
    {pedidos.length > 0 ? <Card accent><View className="gap-3"><SectionTitle>Precisamos de você</SectionTitle><Body>{pedidos.length} {pedidos.length === 1 ? 'solicitação aguarda' : 'solicitações aguardam'} sua resposta.</Body>{pedidos.slice(0, 2).map(p => <View key={p.id} className="gap-3 border-t border-[#713035] pt-3"><Text className="text-xs text-[#B8B8C2]">{p.protocolo}</Text><Text className="text-base text-white">{p.descricao}</Text><Action secondary label="Ver solicitação" onPress={() => p.documento_solicitado_tipo ? router.push(documentRoute(p.proposta_id, p.id)) : router.push(`/(cliente)/propostas/${p.proposta_id}`)} /></View>)}</View></Card> : null}
    {acervo.isError ? <Feedback title="Solicitações indisponíveis no momento" text="Não foi possível conferir seus pedidos de atualização. Seus documentos continuam armazenados." retry={() => void acervo.refetch()} /> : null}
    <View className="gap-3"><SectionTitle>Acesso rápido</SectionTitle><LinkCard title="Meus documentos" description="Consulte os arquivos já enviados e as solicitações da equipe." icon={<FileText color="#F87171" size={22} />} onPress={() => router.push(documentRoute())} />
      {contato.data ? <LinkCard title="Fale com a Mercúrio" description="Converse com nossa equipe de atendimento." icon={<MessageCircle color="#F87171" size={22} />} onPress={() => void Linking.openURL(`https://wa.me/${contato.data}`).catch(() => Alert.alert('Atendimento', 'Não foi possível abrir o WhatsApp.'))} /> : <Body>Atendimento: contato temporariamente indisponível.</Body>}
      <LinkCard title="Universidade Mercúrio" description="Conhecimento para suas próximas decisões." icon={<GraduationCap color="#F87171" size={22} />} onPress={() => router.push('/(cliente)/universidade')} /></View>
    {(propostas.data?.length ?? 0) > 1 ? <View className="gap-3"><SectionTitle>Suas outras propostas</SectionTitle>{propostas.data!.slice(1).map(p => <Card key={p.id}><View className="gap-3"><Label>{p.protocolo}</Label><SectionTitle>{PRODUTO_LABEL[p.produto] ?? p.produto}</SectionTitle><Body>{valorBRL(p.valor_solicitado)}</Body><Status value={p.status} /><Action secondary label="Abrir proposta" onPress={() => router.push(`/(cliente)/propostas/${p.id}`)} /></View></Card>)}</View> : null}
    <Action secondary label="Sair da conta" onPress={() => void signOut()} />
  </ClientScreen>
}
