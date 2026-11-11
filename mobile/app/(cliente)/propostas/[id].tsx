import { useState } from 'react'
import { Alert, Linking, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react-native'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ClientScreen, Card, Action, Body, Label, SectionTitle, DetailRow, Status, Feedback, LinkCard } from '@/components/cliente/ClienteUI'
import { documentRoute, useClientArchive, useClientProposals } from '@/lib/clienteData'
import { contratoDisponivel, dataBR, PRODUTO_LABEL, propostaAcionavel, valorBRL } from '@/lib/clientePresentation'

export default function ClientePropostaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuth()
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const propostas = useClientProposals()
  const acervo = useClientArchive()
  const p = propostas.data?.find(item => item.id === id)
  const imoveis = useQuery({ queryKey: ['client', session?.userId, 'properties', id], enabled: !!p, queryFn: async () => {
    const { data, error } = await supabase.from('imoveis').select('id,tipo,endereco,cidade,uf,valor_avaliacao').eq('proposta_id', id)
    if (error) throw error
    return data ?? []
  } })
  const contratos = useQuery({ queryKey: ['client', session?.userId, 'contracts', id], enabled: !!p && contratoDisponivel(p.status), queryFn: async () => {
    const [contrato, modelos] = await Promise.all([
      supabase.from('contratos').select('id,pdf_storage_path,gerado_em,assinado_em,registrado_em,versao').eq('proposta_id', id).order('versao', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('proposta_contrato_modelos').select('id,storage_path,nome_arquivo,created_at').eq('proposta_id', id).order('created_at', { ascending: false }),
    ])
    if (contrato.error) throw contrato.error
    if (modelos.error) throw modelos.error
    const assinaturas = contrato.data ? await supabase.from('assinaturas_contrato').select('id,signatario_nome,papel,status,assinado_em').eq('contrato_id', contrato.data.id).order('ordem') : { data: [], error: null }
    if (assinaturas.error) throw assinaturas.error
    return { contrato: contrato.data, modelos: modelos.data ?? [], assinaturas: assinaturas.data ?? [] }
  } })
  const responder = useMutation({ mutationFn: async (pid: string) => {
    const { error } = await supabase.rpc('cliente_responder_pendencia', { p_id: pid })
    if (error) throw error
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ['client', session?.userId] }), onError: () => Alert.alert('Resposta não registrada', 'Tente novamente em instantes.') })
  async function abrirContrato(path: string) {
    try { const { data, error } = await supabase.storage.from('contratos').createSignedUrl(path, 300); if (error || !data?.signedUrl) throw error; await Linking.openURL(data.signedUrl) }
    catch { Alert.alert('Contrato indisponível', 'Não foi possível abrir este documento. Tente novamente.') }
  }
  async function refresh() {
    setRefreshing(true)
    try { await Promise.all([propostas.refetch(), acervo.refetch(), ...(p ? [imoveis.refetch()] : []), ...(p && contratoDisponivel(p.status) ? [contratos.refetch()] : [])]) } finally { setRefreshing(false) }
  }
  const pedidos = acervo.data?.solicitacoes.filter(item => item.proposta_id === id) ?? []
  const contrato = contratos.data?.contrato
  return <ClientScreen title="Minha proposta" subtitle={p?.protocolo} refreshing={refreshing} onRefresh={refresh}>
    {propostas.isPending ? <Feedback loading title="Carregando proposta" /> : propostas.isError ? <Feedback title="Não foi possível carregar a proposta" retry={() => void propostas.refetch()} /> : !p ? <Feedback title="Proposta indisponível" text="Esta operação não está disponível para sua conta." /> : <>
      <Card accent><View className="gap-4"><Label>{p.protocolo}</Label><Text className="text-2xl font-bold text-white">{PRODUTO_LABEL[p.produto] ?? p.produto}</Text><View className="gap-2"><Label>Status atual</Label><Status value={p.status} /></View><Body>Última atualização: {dataBR(p.updated_at)}</Body></View></Card>
      <Card><SectionTitle>Resumo da operação</SectionTitle><DetailRow label="Valor solicitado" value={valorBRL(p.valor_solicitado)} /><DetailRow label="Prazo solicitado" value={p.prazo_meses ? `${p.prazo_meses} meses` : 'Não informado'} /><DetailRow label="Taxa informada" value={p.taxa_juros_mensal == null ? 'Não informada' : `${Number(p.taxa_juros_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}% a.m.`} />{p.cliente ? <DetailRow label={p.cliente.pessoa_tipo === 'PJ' ? 'Razão social' : 'Cliente'} value={p.cliente.pessoa_tipo === 'PJ' ? p.cliente.razao_social || p.cliente.nome_completo : p.cliente.nome_completo} /> : null}<View className="mt-3"><Body>As condições finais constam nos documentos formalizados da operação.</Body></View></Card>
      <LinkCard title="Documentos desta proposta" description="Consulte arquivos guardados e pedidos de atualização." icon={<FileText size={22} color="#F87171" />} onPress={() => router.push(documentRoute(id))} />
      <View className="gap-3"><SectionTitle>Solicitações da equipe</SectionTitle>{!propostaAcionavel(p.status) ? <Body>Não há ações de envio para esta operação.</Body> : acervo.isPending ? <Feedback loading title="Consultando solicitações" /> : acervo.isError ? <Feedback title="Solicitações indisponíveis" retry={() => void acervo.refetch()} /> : pedidos.length ? pedidos.map(pedido => <Card key={pedido.id}><View className="gap-3"><SectionTitle>{pedido.descricao}</SectionTitle><Body>{pedido.status === 'em_analise' ? 'Sua resposta está em análise.' : 'Aguardando sua resposta.'}{pedido.prazo ? ` Prazo: ${dataBR(pedido.prazo)}.` : ''}</Body>{pedido.status !== 'em_analise' ? pedido.documento_solicitado_tipo ? <Action label="Ver pedido de documento" onPress={() => router.push(documentRoute(id, pedido.id))} /> : <Action secondary busy={responder.isPending} label="Já respondi à equipe" onPress={() => responder.mutate(pedido.id)} /> : null}</View></Card>) : <Body>Nenhuma solicitação em aberto neste momento.</Body>}</View>
      <Card><View className="gap-3"><SectionTitle>Imóveis da operação</SectionTitle>{imoveis.isPending ? <Body>Carregando imóveis…</Body> : imoveis.isError ? <Action secondary label="Tentar carregar imóveis" onPress={() => void imoveis.refetch()} /> : imoveis.data?.length ? imoveis.data.map(im => <View key={im.id} className="gap-1 border-t border-[#2D2D32] pt-3"><Text className="text-base font-medium text-white">{im.tipo} · {[im.cidade, im.uf].filter(Boolean).join(' / ')}</Text><Body>{im.endereco || 'Endereço não informado'}</Body><Body>Avaliação: {valorBRL(im.valor_avaliacao)}</Body></View>) : <Body>Nenhum imóvel vinculado a esta operação.</Body>}</View></Card>
      <View className="gap-3"><SectionTitle>Contrato</SectionTitle>{!contratoDisponivel(p.status) ? <Card><Body>{p.status === 'cancelado' ? 'Esta proposta foi cancelada.' : 'Quando o contrato estiver disponível para esta etapa, você poderá consultá-lo aqui.'}</Body></Card> : contratos.isPending ? <Feedback loading title="Consultando contrato" /> : contratos.isError ? <Feedback title="Não foi possível carregar o contrato" retry={() => void contratos.refetch()} /> : <>
        {contratos.data?.modelos.map(m => <Card key={m.id}><View className="gap-3"><Label>Modelo de referência</Label><SectionTitle>{m.nome_arquivo}</SectionTitle><Body>{dataBR(m.created_at)}</Body><Action secondary label="Abrir modelo" onPress={() => void abrirContrato(m.storage_path)} /></View></Card>)}
        {contrato ? <Card><View className="gap-3"><SectionTitle>Contrato · versão {contrato.versao}</SectionTitle><Body>Gerado em {dataBR(contrato.gerado_em)}</Body>{contrato.assinado_em ? <Body>Assinado em {dataBR(contrato.assinado_em)}</Body> : null}{contrato.registrado_em ? <Body>Registrado em {dataBR(contrato.registrado_em)}</Body> : null}{contrato.pdf_storage_path ? <Action label="Abrir contrato" onPress={() => void abrirContrato(contrato.pdf_storage_path)} /> : <Body>O PDF ainda não está disponível.</Body>}{contratos.data?.assinaturas.map(a => <View key={a.id} className="gap-1 border-t border-[#2D2D32] pt-3"><Text className="text-sm font-medium text-white">{a.signatario_nome}</Text><Body>{a.papel} · {a.assinado_em ? `Assinado em ${dataBR(a.assinado_em)}` : 'Aguardando assinatura'}</Body></View>)}</View></Card> : <Card><Body>O contrato ainda não foi disponibilizado pela equipe.</Body></Card>}
      </>}</View>
    </>}
  </ClientScreen>
}
