import { useState } from 'react'
import { Alert, Linking, Pressable, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { File } from 'expo-file-system'
import { FileText, ShieldCheck } from 'lucide-react-native'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { TIPO_LABEL, DOC_STATUS_LABEL, type DocCategoria, type DocumentoTipo } from '@/lib/documentos'
import { useClientArchive, useClientProposals, useClientRequirements, uniqueFiles, type ClientFile } from '@/lib/clienteData'
import { dataBR, propostaAcionavel, statusLabel } from '@/lib/clientePresentation'
import { Action, Body, Card, ClientScreen, Feedback, Label, SectionTitle } from '@/components/cliente/ClienteUI'

type UploadInput = { tipo: DocumentoTipo; categoria: DocCategoria; pedido?: string; proposta: string }
export default function Documentos() {
  const params = useLocalSearchParams<{ proposta?: string; pedido?: string }>()
  const { session } = useAuth()
  const qc = useQueryClient()
  const propostas = useClientProposals()
  const acervo = useClientArchive()
  const requisitos = useClientRequirements()
  const identity = useQuery({ queryKey: ['client', session?.userId, 'identities'], enabled: !!session?.userId, queryFn: async () => {
    const { data, error } = await supabase.from('clientes').select('id,pessoa_tipo').eq('usuario_id', session!.userId)
    if (error) throw error
    return data ?? []
  } })
  const [selected, setSelected] = useState<string | undefined>()
  const [aba, setAba] = useState<'arquivos' | 'pedidos'>(params.pedido ? 'pedidos' : 'arquivos')
  const [refreshing, setRefreshing] = useState(false)
  const chosen = selected ?? params.proposta
  const proposta = chosen ? propostas.data?.find(p => p.id === chosen) : propostas.data?.find(p => propostaAcionavel(p.status))
  const titular = identity.data?.find(c => c.id === proposta?.cliente_id) ?? (identity.data?.length === 1 ? identity.data[0] : null)
  const categoria: DocCategoria = titular?.pessoa_tipo === 'PJ' ? 'pessoa_juridica' : 'pessoa_fisica'
  const files = uniqueFiles(acervo.data?.arquivos ?? [])
  const pedidos = (acervo.data?.solicitacoes ?? []).filter(p => !chosen || p.proposta_id === chosen)
  async function refresh() { setRefreshing(true); try { await Promise.all([propostas.refetch(), acervo.refetch(), requisitos.refetch(), identity.refetch()]) } finally { setRefreshing(false) } }
  const upload = useMutation({ mutationFn: async ({ input, camera }: { input: UploadInput; camera: boolean }) => {
    let asset: { uri: string; name: string; mimeType: string }
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) throw new Error('Permita o acesso à câmera nos ajustes do aparelho.')
      const result = await ImagePicker.launchCameraAsync({ quality: 0.85, mediaTypes: ['images'] })
      if (result.canceled) return
      const a = result.assets[0]
      asset = { uri: a.uri, name: a.fileName ?? 'documento.jpg', mimeType: a.mimeType ?? 'image/jpeg' }
    } else {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true })
      if (result.canceled) return
      const a = result.assets[0]
      asset = { uri: a.uri, name: a.name, mimeType: a.mimeType ?? '' }
    }
    const bytes = await new File(asset.uri).bytes()
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(asset.mimeType) || bytes.length === 0 || bytes.length > 20 * 1024 * 1024) throw new Error('Selecione um PDF, JPG ou PNG de até 20 MB.')
    const { data: ticket, error: prepareError } = await supabase.rpc('cliente_documento_preparar', {
      p_proposta_id: input.proposta, p_tipo: input.tipo, p_categoria: input.categoria, p_nome: asset.name, p_mime: asset.mimeType, p_tamanho: bytes.length,
      p_requisicao: `${Date.now()}-${Math.random().toString(36).slice(2)}`, p_pendencia_id: input.pedido ?? null,
    })
    if (prepareError) throw prepareError
    if (ticket.estado !== 'recebido') {
      const { error } = await supabase.storage.from(ticket.bucket).upload(ticket.storage_path, bytes, { contentType: asset.mimeType, upsert: false })
      if (error && String((error as { statusCode?: string }).statusCode) !== '409') throw error
      const { error: completeError } = await supabase.rpc('cliente_documento_finalizar', { p_versao_id: ticket.id })
      if (completeError) throw completeError
    }
    return true
  }, onSuccess: async (sent) => { if (sent) { await qc.invalidateQueries({ queryKey: ['client', session?.userId] }); Alert.alert('Documento recebido', 'O arquivo foi guardado e está disponível para revisão da equipe.') } },
  onError: () => Alert.alert('Não foi possível concluir o envio', 'Tente selecionar o mesmo arquivo para retomar. Se já houver um documento guardado, use-o ou confira a solicitação de atualização.') })
  const reuse = useMutation({ mutationFn: async (file: ClientFile) => {
    if (!proposta) throw new Error('Selecione uma proposta.')
    const { error } = await supabase.rpc('cliente_documento_reutilizar', { p_documento_origem: file.id, p_proposta_id: proposta.id })
    if (error) throw error
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ['client', session?.userId] }), onError: () => Alert.alert('Documento não vinculado', 'Confira se há uma solicitação de atualização para esta proposta e tente novamente.') })
  function pick(input: UploadInput) { Alert.alert('Enviar documento', 'Envie todas as páginas do documento em um PDF, ou fotografe o documento completo.', [
    { text: 'Selecionar arquivo', onPress: () => upload.mutate({ input, camera: false }) }, { text: 'Câmera', onPress: () => upload.mutate({ input, camera: true }) }, { text: 'Cancelar', style: 'cancel' },
  ]) }
  async function open(file: ClientFile) {
    try { const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.storage_path, 300); if (error || !data?.signedUrl) throw error; await Linking.openURL(data.signedUrl) }
    catch { Alert.alert('Documento indisponível', 'Não foi possível abrir este arquivo. Tente novamente.') }
  }
  const ready = !propostas.isPending && !acervo.isPending && !identity.isPending
  return <ClientScreen title="Meus documentos" subtitle="Seus arquivos, sempre com você" refreshing={refreshing} onRefresh={refresh}>
    <Card><View className="gap-3"><ShieldCheck size={25} color="#F87171" /><SectionTitle>Envie uma vez. Acompanhe por aqui.</SectionTitle><Body>Os arquivos recebidos ficam guardados no sistema. Se precisarmos de uma atualização, você verá o pedido da equipe nesta tela.</Body></View></Card>
    <View className="flex-row gap-3">{(['arquivos', 'pedidos'] as const).map(tab => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: aba === tab }} onPress={() => setAba(tab)} className={`min-h-12 flex-1 items-center justify-center rounded-2xl border px-3 py-3 ${aba === tab ? 'border-[#DC2626] bg-[#30191D]' : 'border-[#414148] bg-[#18181B]'}`}><Text className="text-sm font-semibold text-white">{tab === 'arquivos' ? 'Arquivos guardados' : 'Solicitações'}</Text></Pressable>)}</View>
    {!ready && !acervo.isError ? <Feedback loading title="Carregando documentos" /> : acervo.isError || propostas.isError || identity.isError ? <Feedback title="Documentos indisponíveis no momento" text="Não foi possível consultar seu acervo. Os arquivos já enviados continuam guardados. Tente novamente em instantes." retry={() => void refresh()} /> : <>
      {aba === 'arquivos' ? <View className="gap-3">{files.length ? files.map(file => <Card key={`${file.bucket}:${file.storage_path}`}><View className="gap-3"><FileText size={22} color="#F87171" /><SectionTitle>{TIPO_LABEL[file.tipo] ?? file.tipo}</SectionTitle><Body>{file.nome}</Body><Label>{DOC_STATUS_LABEL[file.status as keyof typeof DOC_STATUS_LABEL] ?? 'Recebido'} · versão {file.versao}</Label><Body>{dataBR(file.created_at)}{file.categoria === 'imovel' ? ' · Documento da operação' : ''}</Body><Action secondary label="Abrir documento" onPress={() => void open(file)} /></View></Card>) : <Feedback title="Seu acervo começa aqui" text="Após o primeiro envio, você poderá consultar seus documentos nesta área." />}</View> : <View className="gap-3">{pedidos.length ? pedidos.map(p => {
        const req = requisitos.data?.find(r => r.tipo === p.documento_solicitado_tipo && (r.categoria === categoria || r.categoria === 'imovel'))
        return <Card key={p.id} accent={p.id === params.pedido}><View className="gap-3"><Label>{p.protocolo}</Label><SectionTitle>{p.descricao}</SectionTitle><Body>{p.status === 'em_analise' ? 'Recebido pela equipe. Aguarde a revisão.' : 'Aguardando sua resposta.'}{p.prazo ? ` Prazo: ${dataBR(p.prazo)}.` : ''}</Body>{p.status !== 'em_analise' && p.documento_solicitado_tipo && req ? <Action busy={upload.isPending} label="Enviar atualização" onPress={() => pick({ proposta: p.proposta_id, pedido: p.id, tipo: p.documento_solicitado_tipo!, categoria: req.categoria })} /> : p.documento_solicitado_tipo ? null : <Action secondary label="Ver proposta" onPress={() => router.push(`/(cliente)/propostas/${p.proposta_id}`)} />}</View></Card>
      }) : <Feedback title="Nenhuma solicitação em aberto" text="Quando a equipe precisar de uma atualização, o pedido aparecerá aqui." />}</View>}
      <View className="gap-3"><SectionTitle>Documentos da proposta</SectionTitle><Body>Escolha uma operação para consultar os documentos necessários e aproveitar os que já estão guardados.</Body>{propostas.data?.map(p => <Pressable key={p.id} onPress={() => setSelected(p.id)} accessibilityRole="radio" accessibilityState={{ checked: proposta?.id === p.id }} className={`min-h-12 rounded-2xl border p-4 ${proposta?.id === p.id ? 'border-[#DC2626] bg-[#30191D]' : 'border-[#414148] bg-[#18181B]'}`}><Text className="text-sm text-white">{p.protocolo} · {statusLabel(p.status)}</Text></Pressable>)}</View>
      {chosen && !proposta ? <Feedback title="Proposta indisponível" text="Selecione uma das operações vinculadas à sua conta." /> : proposta && !propostaAcionavel(proposta.status) ? <Feedback title="Nenhum envio necessário nesta operação" text="Você pode continuar consultando os arquivos já guardados." /> : proposta && titular ? requisitos.isError ? <Feedback title="Requisitos indisponíveis" retry={() => void requisitos.refetch()} /> : requisitos.isPending ? <Feedback loading title="Conferindo requisitos" /> : <View className="gap-3">{requisitos.data?.filter(r => r.obrigatorio && (r.categoria === categoria || r.categoria === 'imovel')).map(req => {
        const saved = files.find(f => f.tipo === req.tipo && f.categoria === req.categoria && (req.categoria === 'imovel' ? f.proposta_id === proposta.id : f.cliente_id === titular.id))
        const linked = acervo.data!.arquivos.some(f => f.proposta_id === proposta.id && f.tipo === req.tipo && f.categoria === req.categoria && (req.categoria === 'imovel' || f.cliente_id === titular.id))
        const requested = acervo.data!.solicitacoes.some(p => p.proposta_id === proposta.id && p.documento_solicitado_tipo === req.tipo)
        return <Card key={`${req.categoria}:${req.tipo}`}><View className="gap-3"><SectionTitle>{TIPO_LABEL[req.tipo]}</SectionTitle><Body>{requested ? 'Há uma solicitação da equipe para este documento.' : linked ? 'Documento já recebido nesta operação.' : saved ? 'Você já possui este documento no acervo.' : 'Primeiro envio necessário para esta operação.'}</Body>{requested ? <Action secondary label="Ver solicitações" onPress={() => setAba('pedidos')} /> : linked ? null : saved ? saved.status === 'rejeitado' ? <Body>Aguarde a solicitação da equipe para enviar a atualização.</Body> : <Action secondary busy={reuse.isPending} label="Usar documento guardado" onPress={() => reuse.mutate(saved)} /> : <Action busy={upload.isPending} label="Enviar documento" onPress={() => pick({ proposta: proposta.id, tipo: req.tipo, categoria: req.categoria })} />}</View></Card>
      })}</View> : null}
    </>}
  </ClientScreen>
}
