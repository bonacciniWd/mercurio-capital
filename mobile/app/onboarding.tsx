import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, Check, ShieldCheck } from 'lucide-react-native'
import LottieView from 'lottie-react-native'
import Animated, { cancelAnimation, Easing, useAnimatedProps, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Ellipse, G } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { getSenhaMinLength, validarSenha } from '@/lib/securityConfig'
import { isValidCnpj, isValidCpf, isValidEmail, isValidPhone, onlyDigits } from '@/lib/documentoBr'
import { finishPendingPartnerOnboarding, savePendingPartnerOnboarding } from '@/lib/pendingPartnerOnboarding'

type Audience = 'partner' | 'client'
type Stage = 'welcome' | 'profile' | 'partner-intro' | 'partner-how' | 'partner-principles'
  | 'partner-data' | 'partner-activity' | 'partner-review' | 'partner-done'
  | 'client-intro' | 'client-invite' | 'client-context' | 'client-data' | 'client-company'
  | 'client-goal' | 'client-privacy' | 'client-review' | 'client-done'
type PersonType = 'PF' | 'PJ'

const PARTNER_STEPS: Stage[] = ['partner-intro', 'partner-how', 'partner-principles', 'partner-data', 'partner-activity', 'partner-review']
const CLIENT_STEPS: Stage[] = ['client-intro', 'client-invite', 'client-context', 'client-data', 'client-company', 'client-goal', 'client-privacy', 'client-review']
const ACTIVITY_OPTIONS = ['Crédito para empresas', 'Relacionamento comercial', 'Consultoria empresarial', 'Contabilidade', 'Investimentos e assessoria', 'Outra área']
const GOAL_OPTIONS = ['Capital de giro', 'Organização do fluxo financeiro', 'Investimento no negócio', 'Avaliação de uma oportunidade', 'Outro objetivo']
const REVENUE_OPTIONS = ['Prefiro informar depois', 'Até R$ 500 mil por ano', 'De R$ 500 mil a R$ 2 milhões por ano', 'De R$ 2 milhões a R$ 10 milhões por ano', 'Acima de R$ 10 milhões por ano']
const PRIVACY_URL = 'https://mercuriocapitalsa.com.br/politica-de-privacidade'

type ClientForm = {
  name: string; document: string; email: string; phone: string; company: string;
  segment: string; city: string; uf: string; revenue: string; goal: string
}
type PartnerForm = { name: string; email: string; phone: string; cpf: string; password: string; confirm: string; company: string; city: string; uf: string }
const emptyClient: ClientForm = { name: '', document: '', email: '', phone: '', company: '', segment: '', city: '', uf: '', revenue: '', goal: '' }
const emptyPartner: PartnerForm = { name: '', email: '', phone: '', cpf: '', password: '', confirm: '', company: '', city: '', uf: '' }

function Field({ label, value, onChange, placeholder, keyboardType, secure }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric'; secure?: boolean
}) {
  return <View className="mb-5">
    <Text className="mb-2 text-sm font-semibold text-[#D4D4D8]">{label}</Text>
    <TextInput
      accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder}
      placeholderTextColor="#77777F" keyboardType={keyboardType ?? 'default'}
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      secureTextEntry={secure} selectionColor="#DC2626"
      className="min-h-14 rounded-xl border border-[#323236] bg-[#151518] px-4 text-base text-white"
    />
  </View>
}

function Option({ label, selected, onPress, multiple = false }: { label: string; selected: boolean; onPress: () => void; multiple?: boolean }) {
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected }}
    onPress={onPress} className={`mb-3 min-h-16 flex-row items-center justify-between rounded-xl border px-5 ${selected ? 'border-[#DC2626] bg-[#291317]' : 'border-[#323236] bg-[#151518]'}`}>
    <Text className="flex-1 pr-4 text-base font-medium text-white">{label}</Text>
    <View className={`h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-[#DC2626] bg-[#DC2626]' : 'border-[#6B6B72]'}`}>
      {selected ? (multiple ? <Check size={13} color="white" /> : <View className="h-2 w-2 rounded-full bg-white" />) : null}
    </View>
  </Pressable>
}

function Notice({ text }: { text: string }) {
  return <View className="mt-5 flex-row rounded-xl border border-[#333337] bg-[#151518] p-4">
    <ShieldCheck size={19} color="#EF4444" />
    <Text className="ml-3 flex-1 text-sm leading-5 text-[#A3A3AA]">{text}</Text>
  </View>
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

function OrbitalArt() {
  const reduceMotion = useReducedMotion()
  const outerOrbit = useSharedValue(0)
  const middleOrbit = useSharedValue(0)
  const innerOrbit = useSharedValue(0)

  useEffect(() => {
    if (!reduceMotion) {
      outerOrbit.value = withRepeat(withTiming(2 * Math.PI, { duration: 12000, easing: Easing.linear }), -1, false)
      middleOrbit.value = withRepeat(withTiming(2 * Math.PI, { duration: 8500, easing: Easing.linear }), -1, false)
      innerOrbit.value = withRepeat(withTiming(2 * Math.PI, { duration: 6500, easing: Easing.linear }), -1, false)
    }

    return () => {
      cancelAnimation(outerOrbit)
      cancelAnimation(middleOrbit)
      cancelAnimation(innerOrbit)
    }
  }, [innerOrbit, middleOrbit, outerOrbit, reduceMotion])

  const outerPlanet = useAnimatedProps(() => ({
    cx: 151 * Math.cos(outerOrbit.value),
    cy: 82 * Math.sin(outerOrbit.value),
  }))
  const middlePlanet = useAnimatedProps(() => ({
    cx: 130 * Math.cos(middleOrbit.value),
    cy: 56 * Math.sin(middleOrbit.value),
  }))
  const innerPlanet = useAnimatedProps(() => ({
    cx: 103 * Math.cos(innerOrbit.value),
    cy: 36 * Math.sin(innerOrbit.value),
  }))

  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.orbitalStage}>
    <View style={styles.orbitalArt}>
      <LottieView source={require('../assets/coin.json')} autoPlay loop style={styles.coinAnimation} />
      <Svg width="100%" height="100%" viewBox="0 0 310 310" accessibilityLabel="Arte orbital Mercúrio">
        <G transform="translate(155 155)">
          <Circle r="61" fill="#DC2626" opacity={0.11} />
          <G rotation={-28}>
            <Ellipse rx="151" ry="82" fill="none" stroke="#49494F" strokeWidth="1.3" opacity={0.58} />
            <AnimatedCircle animatedProps={outerPlanet} r="5.5" fill="#EF3D42" />
          </G>
          <G rotation={-28}>
            <Ellipse rx="130" ry="56" fill="none" stroke="#8F252B" strokeWidth="1.3" opacity={0.68} />
            <AnimatedCircle animatedProps={middlePlanet} r="3.5" fill="#FFFFFF" />
          </G>
          <G rotation={-28}>
            <Ellipse rx="103" ry="36" fill="none" stroke="#39393F" strokeWidth="1.2" opacity={0.72} />
            <AnimatedCircle animatedProps={innerPlanet} r="4.5" fill="#F87171" />
          </G>
        </G>
      </Svg>
    </View>
  </View>
}

const styles = StyleSheet.create({
  orbitalStage: { height: 288, width: '100%', position: 'relative', overflow: 'visible', marginTop: -8, alignItems: 'center' },
  orbitalArt: { position: 'absolute', width: 310, height: 310, top: 22, right: -38, opacity: 0.95 },
  coinAnimation: { position: 'absolute', width: 68, height: 68, left: 121, top: 121 },
})

function extractToken(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    const queryToken = url.searchParams.get('token')
    if (queryToken) return queryToken
    const segments = url.pathname.split('/').filter(Boolean)
    return segments.at(-1) ?? ''
  } catch {
    return trimmed
  }
}

export default function Onboarding() {
  const params = useLocalSearchParams<{ profile?: Audience; token?: string }>()
  const { session, refresh } = useAuth()
  const [stage, setStage] = useState<Stage>(params.token ? 'client-invite' : 'welcome')
  const [history, setHistory] = useState<Stage[]>([])
  const [audience, setAudience] = useState<Audience | null>(params.token ? 'client' : params.profile === 'partner' ? 'partner' : null)
  const [invite, setInvite] = useState(params.token ?? '')
  const [inviteRecognized, setInviteRecognized] = useState(false)
  const [proposalId, setProposalId] = useState<string | null>(null)
  const [personType, setPersonType] = useState<PersonType>('PF')
  const [client, setClient] = useState<ClientForm>(emptyClient)
  const [partner, setPartner] = useState<PartnerForm>(emptyPartner)
  const [activities, setActivities] = useState<string[]>([])
  const [partnerDeclaration, setPartnerDeclaration] = useState(false)
  const [partnerNeedsConfirmation, setPartnerNeedsConfirmation] = useState(false)
  const [privacyRead, setPrivacyRead] = useState(false)
  const [dataUse, setDataUse] = useState(false)
  const [aceiteConsultas, setAceiteConsultas] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = audience === 'partner' ? PARTNER_STEPS : CLIENT_STEPS
  const index = steps.indexOf(stage)
  const title = audience === 'partner' ? 'Parceiro' : 'Cliente'
  const updateClient = (key: keyof ClientForm, value: string) => setClient((current) => ({ ...current, [key]: value }))
  const updatePartner = (key: keyof PartnerForm, value: string) => setPartner((current) => ({ ...current, [key]: value }))
  const go = (next: Stage) => { setError(null); setHistory((current) => [...current, stage]); setStage(next) }
  const back = () => { const previous = history.at(-1); if (previous) { setHistory((current) => current.slice(0, -1)); setError(null); setStage(previous) } else router.replace('/login') }

  async function authenticateInvite() {
    const token = extractToken(invite)
    if (!token) return setError('Informe o link de convite recebido.')
    setBusy(true); setError(null)
    try {
      const { data: peek, error: peekError } = await supabase.rpc('cliente_peek_proposta', { p_token: token })
      if (peekError || !peek?.proposta_id) throw new Error('Este convite já foi utilizado ou expirou. Peça ao parceiro ou à equipe Mercúrio um novo link para continuar.')
      const { data: result, error: consumeError } = await supabase.functions.invoke('magic-link-consume', { body: { token, aceite_consultas: aceiteConsultas } })
      if (consumeError || !result?.session?.hashed_token || !result?.session?.email) throw new Error('Não foi possível ativar o convite. Solicite um novo link ao parceiro.')
      const { error: otpError } = await supabase.auth.verifyOtp({ email: result.session.email, token_hash: result.session.hashed_token, type: 'magiclink' })
      if (otpError) throw new Error('Não foi possível iniciar a sessão. Entre com sua conta ou solicite um novo link.')
      await refresh()
      const id = String(result.proposta_id)
      setProposalId(id)
      const { data: proposal, error: proposalError } = await supabase.from('propostas').select('cliente_id').eq('id', id).single()
      if (proposalError || !proposal?.cliente_id) throw new Error('A proposta não está disponível para esta conta.')
      const { data: linkedClient, error: clientError } = await supabase.from('clientes')
        .select('pessoa_tipo, nome_completo, cpf, cnpj, email, telefone, razao_social, ramo_atuacao, endereco_cidade, endereco_estado')
        .eq('id', proposal.cliente_id).single()
      if (clientError || !linkedClient) throw new Error('Não foi possível carregar os dados desta proposta.')
      const type: PersonType = linkedClient.pessoa_tipo === 'PJ' ? 'PJ' : 'PF'
      setPersonType(type)
      setClient({
        ...emptyClient, name: type === 'PJ' ? linkedClient.razao_social || linkedClient.nome_completo : linkedClient.nome_completo,
        document: type === 'PJ' ? linkedClient.cnpj || '' : linkedClient.cpf || '',
        email: linkedClient.email || '', phone: linkedClient.telefone || '',
        company: type === 'PJ' ? linkedClient.razao_social || '' : '',
        segment: type === 'PJ' ? linkedClient.ramo_atuacao || '' : '',
        city: linkedClient.endereco_cidade || '', uf: linkedClient.endereco_estado || '',
      })
      setInviteRecognized(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível validar o convite.')
    } finally { setBusy(false) }
  }

  async function saveClient() {
    if (!proposalId || !session || session.role !== 'client') return setError('Entre com o convite desta proposta para continuar.')
    setBusy(true); setError(null)
    try {
      const { error: saveError } = await supabase.rpc('mobile_cliente_onboarding_salvar', {
        p_proposta_id: proposalId,
        p_resposta: {
          nome: client.name.trim(), documento: onlyDigits(client.document), email: client.email.trim().toLowerCase(),
          telefone: onlyDigits(client.phone), nome_fantasia: personType === 'PJ' ? client.company.trim() : null,
          ramo_atuacao: personType === 'PJ' ? client.segment.trim() : null,
          cidade: client.city.trim(), uf: client.uf.trim().toUpperCase(),
          faixa_faturamento: personType === 'PJ' ? client.revenue : null,
          objetivo: client.goal, avisos_versao: 'onboarding-2026-11',
          privacidade_versao: 'politica-publica-2026-11', aceitou: privacyRead && dataUse,
        },
      })
      if (saveError) throw saveError
      go('client-done')
    } catch { setError('Não foi possível salvar suas informações. Confira os dados e tente novamente.') }
    finally { setBusy(false) }
  }

  async function savePartner() {
    setBusy(true); setError(null)
    try {
      const minimum = await getSenhaMinLength()
      const passwordError = validarSenha(partner.password, minimum)
      if (passwordError) throw new Error(passwordError)
      if (partner.password !== partner.confirm) throw new Error('As senhas não conferem.')
      const email = partner.email.trim().toLowerCase()
      const { data: existing } = await supabase.auth.getUser()
      if (existing.user && existing.user.email?.toLowerCase() !== email) {
        throw new Error('Saia da conta atual antes de cadastrar outro parceiro.')
      }
      if (existing.user && session?.role !== 'partner') {
        throw new Error('Esta conta já possui outro perfil. Use um e-mail próprio para o cadastro de parceiro.')
      }
      let hasSession = Boolean(existing.user)
      if (!hasSession) {
        const { data: signup, error: signupError } = await supabase.auth.signUp({
          email, password: partner.password,
          options: { data: { nome_completo: partner.name.trim(), telefone: onlyDigits(partner.phone), telefone_ddi: '55', role: 'partner' } },
        })
        if (signupError) throw signupError
        hasSession = Boolean(signup.session)
      }
      await savePendingPartnerOnboarding({
        email, cpf: onlyDigits(partner.cpf), organizacao: partner.company.trim(),
        cidade: partner.city.trim(), uf: partner.uf.trim().toUpperCase(),
        areas: activities, declarado: partnerDeclaration,
      })
      if (!hasSession) {
        setPartnerNeedsConfirmation(true)
        go('partner-done')
        return
      }
      const completed = await finishPendingPartnerOnboarding(email)
      if (!completed) throw new Error('Não foi possível confirmar sua sessão para enviar o cadastro. Tente novamente após entrar na conta.')
      await refresh()
      go('partner-done')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível enviar os dados.') }
    finally { setBusy(false) }
  }

  const clientIdentityValid = client.name.trim().length >= 2 && (personType === 'PJ' ? isValidCnpj(client.document) : isValidCpf(client.document))
    && isValidEmail(client.email) && isValidPhone(client.phone)
  const partnerValid = partner.name.trim().length >= 2 && partner.name.trim().length <= 200
    && isValidEmail(partner.email) && partner.email.length <= 320 && isValidPhone(partner.phone)
    && isValidCpf(partner.cpf) && partner.company.trim().length >= 2 && partner.company.trim().length <= 200
    && partner.city.trim().length >= 2 && partner.city.trim().length <= 120 && /^[A-Za-z]{2}$/.test(partner.uf)
    && partnerDeclaration

  const page = useMemo(() => {
    switch (stage) {
      case 'welcome': return <>
        <OrbitalArt />
        <Text className="mt-8 text-sm font-bold tracking-[3px] text-white">CONEXÕES QUE MOVIMENTAM</Text>
        <Text className="mt-5 text-[38px] font-bold leading-[43px] text-white">Capital para conexões que <Text className="text-[#EF4444]">movimentam negócios.</Text></Text>
        <Text className="mt-5 text-base leading-7 text-[#A3A3AA]">Uma experiência digital para parceiros e clientes da Mercúrio Capital.</Text>
      </>
      case 'profile': return <>
        <Heading kicker="SEU PERFIL" title="Como você se relaciona com a Mercúrio Capital?" description="Escolha uma opção para personalizarmos as próximas etapas." />
        <View className="mt-9 gap-3">
          <ProfileCard label="Sou parceiro" description="Indico e acompanho oportunidades de negócio." selected={audience === 'partner'} onPress={() => setAudience('partner')} partner />
          <ProfileCard label="Sou cliente" description="Recebi um convite para continuar meu atendimento." selected={audience === 'client'} onPress={() => setAudience('client')} />
        </View>
        <Notice text="O acesso de clientes acontece por convite. Não oferecemos cadastro livre nesta etapa." />
      </>
      case 'partner-intro': return <>
        <View className="mb-8 h-20 w-20 items-center justify-center rounded-3xl bg-[#281315]"><BriefcaseBusiness size={34} color="#EF4444" /></View>
        <Heading kicker="BOAS-VINDAS" title="Uma parceria construída com clareza." description="Conheça como a Mercúrio Capital organiza a relação com parceiros e o encaminhamento de oportunidades." />
        <NumberList items={['Processo orientado', 'Comunicação centralizada', 'Acompanhamento das etapas disponíveis']} />
      </>
      case 'partner-how': return <>
        <Heading kicker="COMO FUNCIONA" title="Seu papel na jornada." />
        <NumberList items={['Identifique uma oportunidade', 'Compartilhe as informações iniciais', 'Acompanhe a evolução']} />
        <Notice text="O encaminhamento não representa aprovação ou garantia de contratação." />
      </>
      case 'partner-principles': return <>
        <Heading kicker="PRINCÍPIOS" title="Informação responsável em cada contato." />
        <NumberList items={['Clareza: apresente o processo sem prometer condições.', 'Privacidade: compartilhe dados somente com autorização.', 'Transparência: diferencie informações de condições sujeitas à análise.']} />
      </>
      case 'partner-data': return <>
        <Heading kicker="IDENTIFICAÇÃO" title="Vamos identificar você." description="Use seus dados profissionais para iniciar o cadastro de parceiro." />
        <View className="mt-8">
          <Field label="Nome completo" value={partner.name} onChange={(v) => updatePartner('name', v)} placeholder="Seu nome" />
          <Field label="E-mail profissional" value={partner.email} onChange={(v) => updatePartner('email', v)} keyboardType="email-address" placeholder="nome@empresa.com.br" />
          <Field label="Telefone com DDD" value={partner.phone} onChange={(v) => updatePartner('phone', v)} keyboardType="phone-pad" placeholder="(00) 00000-0000" />
          <Field label="CPF" value={partner.cpf} onChange={(v) => updatePartner('cpf', v)} keyboardType="numeric" placeholder="Digite seu CPF" />
          <Field label="Empresa ou organização" value={partner.company} onChange={(v) => updatePartner('company', v)} placeholder="Nome da organização" />
          <Field label="Cidade" value={partner.city} onChange={(v) => updatePartner('city', v)} placeholder="Cidade" />
          <Field label="Estado (UF)" value={partner.uf} onChange={(v) => updatePartner('uf', v.slice(0, 2).toUpperCase())} placeholder="SP" />
          <Field label="Senha" value={partner.password} onChange={(v) => updatePartner('password', v)} secure />
          <Field label="Confirme a senha" value={partner.confirm} onChange={(v) => updatePartner('confirm', v)} secure />
          <CheckRow label="Declaro que as informações fornecidas são minhas e estão corretas." checked={partnerDeclaration} onPress={() => setPartnerDeclaration(!partnerDeclaration)} />
        </View>
      </>
      case 'partner-activity': return <>
        <Heading kicker="SUA ATUAÇÃO" title="Conte-nos sobre sua área." description="Você pode selecionar mais de uma opção." />
        <View className="mt-8">{ACTIVITY_OPTIONS.map((item) => <Option key={item} label={item} multiple selected={activities.includes(item)} onPress={() => setActivities((current) => current.includes(item) ? current.filter((v) => v !== item) : [...current, item])} />)}</View>
        <Notice text="Essas informações contextualizam sua atuação e não representam credenciamento automático." />
      </>
      case 'partner-review': return <>
        <Heading kicker="REVISÃO" title="Revise seus dados." description="Confirme antes de enviar para análise." />
        <ReviewRow title="Dados profissionais" lines={[partner.name, partner.email, partner.phone]} onEdit={() => go('partner-data')} />
        <ReviewRow title="Organização" lines={[partner.company, [partner.city, partner.uf].filter(Boolean).join(', ')]} onEdit={() => go('partner-data')} />
        <ReviewRow title="Áreas de atuação" lines={activities} onEdit={() => go('partner-activity')} />
      </>
      case 'partner-done': return partnerNeedsConfirmation
        ? <Done title="Confirme seu e-mail." description="Criamos sua conta. Abra o e-mail de confirmação e depois faça login para concluir o envio dos dados de parceria." note="O cadastro ainda não foi enviado para análise." />
        : <Done title="Informações enviadas." description="Recebemos seus dados para continuidade do relacionamento com a Mercúrio Capital." note="O envio não representa aprovação ou credenciamento automático." />
      case 'client-intro': return <>
        <View className="mb-8 h-20 w-20 items-center justify-center rounded-3xl bg-[#281315]"><ShieldCheck size={34} color="#EF4444" /></View>
        <Heading kicker="ÁREA DO CLIENTE" title="Continue seu atendimento com segurança." description="Este acesso é destinado a clientes convidados pela Mercúrio Capital para dar continuidade a uma proposta já iniciada." />
        <Notice text="Não é possível criar um cadastro de cliente sem convite." />
      </>
      case 'client-invite': return <>
        <Heading kicker="VALIDAR CONVITE" title="Informe seu convite." description="Cole o link seguro recebido da Mercúrio Capital ou do parceiro responsável." />
        {inviteRecognized ? <View className="mt-10 items-center rounded-2xl border border-[#235239] bg-[#0F2119] p-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-[#16803D]"><Check size={28} color="white" /></View>
          <Text className="mt-5 text-xl font-semibold text-white">Convite reconhecido</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-[#A3A3AA]">Você pode continuar seu atendimento com segurança.</Text>
        </View> : <View className="mt-9">
          <Field label="Link ou token do convite" value={invite} onChange={setInvite} placeholder="Cole o link recebido" />
          <Notice text="Um número de protocolo ou e-mail isolado não substitui o link seguro." />
          <View className="mt-5 rounded-xl border border-[#7F3034] bg-[#211416] p-4">
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Instrução para consultas desta proposta, opcional"
              accessibilityState={{ checked: aceiteConsultas }}
              onPress={() => setAceiteConsultas((checked) => !checked)}
              className="flex-row items-start"
            >
              <View className={`mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-md border ${aceiteConsultas ? 'border-[#DC2626] bg-[#DC2626]' : 'border-[#6B6B72]'}`}>
                {aceiteConsultas ? <Check size={15} color="white" /> : null}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-white">Instrução para consultas desta proposta <Text className="text-xs font-medium text-[#A3A3AA]">(opcional)</Text></Text>
                <Text className="mt-2 text-sm leading-5 text-[#C4C4CA]">Confirmo que solicitei a análise desta proposta e instruo a Mercúrio Capital a encaminhar, para essa finalidade, os dados informados dos proponentes e dos imóveis vinculados a ela aos serviços de crédito, cadastro e registros imobiliários integrados e habilitados. A consulta efetiva depende da disponibilidade do serviço e das validações aplicáveis. O registro será feito em meu nome como cliente principal e não representa aceite individual dos demais proponentes. Novos provedores ou finalidades fora dessas categorias exigirão atualização das informações e do escopo.</Text>
              </View>
            </Pressable>
            {!aceiteConsultas ? <Text className="ml-9 mt-3 text-xs leading-5 text-[#A3A3AA]">Você pode continuar sem marcar. Nesse caso, consultas externas da proposta precisarão de um documento de autorização aprovado.</Text> : null}
          </View>
        </View>}
      </>
      case 'client-context': return <>
        <Heading kicker="ANTES DE CONTINUAR" title="Clareza durante todo o atendimento." description="As informações fornecidas ajudam a compreender seu contexto e conduzir a avaliação aplicável." />
        <NumberList items={['Os dados devem ser corretos e atualizados.', 'Informações adicionais podem ser solicitadas.', 'Condições dependem de análise e formalização.', 'Este onboarding não garante aprovação.']} />
      </>
      case 'client-data': return <>
        <Heading kicker="IDENTIFICAÇÃO" title="Confirme seus dados." description={personType === 'PJ' ? 'Dados da pessoa jurídica vinculada à proposta.' : 'Dados da pessoa física vinculada à proposta.'} />
        <View className="mt-8">
          <Field label={personType === 'PJ' ? 'Razão social' : 'Nome completo'} value={client.name} onChange={(v) => updateClient('name', v)} />
          <Field label={personType === 'PJ' ? 'CNPJ' : 'CPF'} value={client.document} onChange={(v) => updateClient('document', v)} keyboardType="numeric" />
          <Field label={personType === 'PJ' ? 'E-mail do responsável' : 'E-mail'} value={client.email} onChange={(v) => updateClient('email', v)} keyboardType="email-address" />
          <Field label="Telefone com DDD" value={client.phone} onChange={(v) => updateClient('phone', v)} keyboardType="phone-pad" />
        </View>
        <Notice text="Divergências nos dados já registrados serão encaminhadas para revisão; não alteram automaticamente o cadastro da proposta." />
      </>
      case 'client-company': return <>
        <Heading kicker={personType === 'PJ' ? 'SOBRE A EMPRESA' : 'SUA LOCALIZAÇÃO'}
          title={personType === 'PJ' ? 'Conte-nos sobre o negócio.' : 'Onde você está?'} />
        <View className="mt-8">
          {personType === 'PJ' ? <>
            <Field label="Nome fantasia" value={client.company} onChange={(v) => updateClient('company', v)} />
            <Field label="Segmento de atuação" value={client.segment} onChange={(v) => updateClient('segment', v)} placeholder="Ex.: indústria, varejo, serviços" />
          </> : null}
          <Field label="Cidade" value={client.city} onChange={(v) => updateClient('city', v)} />
          <Field label="Estado (UF)" value={client.uf} onChange={(v) => updateClient('uf', v.slice(0, 2).toUpperCase())} />
          {personType === 'PJ' ? <>
            <Text className="mb-3 text-sm font-semibold text-[#D4D4D8]">Faixa de faturamento anual</Text>
            {REVENUE_OPTIONS.map((option) => <Option key={option} label={option} selected={client.revenue === option} onPress={() => updateClient('revenue', option)} />)}
          </> : null}
        </View>
      </>
      case 'client-goal': return <>
        <Heading kicker="SEU OBJETIVO" title="Como podemos compreender sua necessidade?" />
        <View className="mt-9">{GOAL_OPTIONS.map((option) => <Option key={option} label={option} selected={client.goal === option} onPress={() => updateClient('goal', option)} />)}</View>
        <Notice text="Esta etapa registra seu interesse e não constitui oferta ou aprovação de crédito." />
      </>
      case 'client-privacy': return <>
        <Heading kicker="PRIVACIDADE" title="Uso responsável das informações." description="Seus dados serão usados para conduzir o atendimento e registrar as informações desta proposta." />
        <Notice text="Você pode consultar a política de privacidade e entender como as informações são utilizadas." />
        <Pressable onPress={() => { void Linking.openURL(PRIVACY_URL) }} className="mt-5 min-h-12 justify-center"><Text className="font-semibold text-[#EF4444] underline">Ler Política de Privacidade</Text></Pressable>
        <CheckRow label="Li a Política de Privacidade e os avisos desta etapa." checked={privacyRead} onPress={() => setPrivacyRead(!privacyRead)} />
        <CheckRow label="Autorizo o uso dos dados para dar continuidade a este atendimento." checked={dataUse} onPress={() => setDataUse(!dataUse)} />
        <Notice text="A autorização para consultas externas, como Serasa, é separada e não é concedida por estes controles." />
      </>
      case 'client-review': return <>
        <Heading kicker="REVISÃO" title="Revise antes de enviar." description="Confirme se os dados abaixo estão corretos." />
        <ReviewRow title="Identificação" lines={[personType, client.name, client.document, client.email, client.phone]} onEdit={() => go('client-data')} />
        <ReviewRow title={personType === 'PJ' ? 'Empresa' : 'Localização'} lines={personType === 'PJ' ? [client.company, client.segment, `${client.city}, ${client.uf}`, client.revenue] : [`${client.city}, ${client.uf}`]} onEdit={() => go('client-company')} />
        <ReviewRow title="Objetivo do contato" lines={[client.goal]} onEdit={() => go('client-goal')} />
        <ReviewRow title="Privacidade" lines={['Política lida e uso dos dados autorizado']} onEdit={() => go('client-privacy')} />
      </>
      case 'client-done': return <Done title="Informações recebidas." description="Seu atendimento foi atualizado com os dados enviados." note="O recebimento não representa aprovação, contratação ou garantia de condições financeiras." />
    }
  }, [stage, audience, invite, inviteRecognized, client, partner, personType, activities, partnerDeclaration, partnerNeedsConfirmation, privacyRead, dataUse])

  const action = (() => {
    switch (stage) {
      case 'welcome': return { label: 'Começar', onPress: () => go('profile'), disabled: false }
      case 'profile': return { label: 'Continuar', onPress: () => go(audience === 'partner' ? 'partner-intro' : 'client-intro'), disabled: !audience }
      case 'partner-intro': return { label: 'Entender como funciona', onPress: () => go('partner-how'), disabled: false }
      case 'partner-how': return { label: 'Continuar', onPress: () => go('partner-principles'), disabled: false }
      case 'partner-principles': return { label: 'Estou de acordo', onPress: () => go('partner-data'), disabled: false }
      case 'partner-data': return { label: 'Continuar', onPress: () => go('partner-activity'), disabled: !partnerValid || !partner.password || !partner.confirm }
      case 'partner-activity': return { label: 'Revisar informações', onPress: () => go('partner-review'), disabled: activities.length === 0 }
      case 'partner-review': return { label: 'Enviar informações', onPress: () => { void savePartner() }, disabled: false }
      case 'partner-done': return { label: partnerNeedsConfirmation ? 'Ir para o login' : 'Concluir', onPress: () => router.replace(partnerNeedsConfirmation ? '/login' : '/acesso-pendente'), disabled: false }
      case 'client-intro': return { label: 'Continuar com convite', onPress: () => go('client-invite'), disabled: false }
      case 'client-invite': return { label: inviteRecognized ? 'Continuar' : 'Validar convite', onPress: () => inviteRecognized ? go('client-context') : void authenticateInvite(), disabled: !invite }
      case 'client-context': return { label: 'Li e quero continuar', onPress: () => go('client-data'), disabled: false }
      case 'client-data': return { label: 'Continuar', onPress: () => go('client-company'), disabled: !clientIdentityValid }
      case 'client-company': return { label: 'Continuar', onPress: () => go('client-goal'), disabled: !client.city.trim() || client.uf.trim().length !== 2 || (personType === 'PJ' && (!client.company.trim() || !client.segment.trim() || !client.revenue)) }
      case 'client-goal': return { label: 'Continuar', onPress: () => go('client-privacy'), disabled: !client.goal }
      case 'client-privacy': return { label: 'Continuar', onPress: () => go('client-review'), disabled: !privacyRead || !dataUse }
      case 'client-review': return { label: 'Enviar informações', onPress: () => { void saveClient() }, disabled: false }
      case 'client-done': return { label: 'Concluir', onPress: () => router.replace('/(cliente)'), disabled: false }
    }
  })()

  useEffect(() => { if (params.token && !invite) setInvite(params.token) }, [params.token])

  return <SafeAreaView className="flex-1 bg-[#0B0B0D]" edges={['top', 'bottom']}>
    <StatusBar style="light" />
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="min-h-[74px] flex-row items-center justify-between px-6">
        {stage === 'welcome' ? <Image source={require('../assets/logos/logo-dark.png')} resizeMode="contain" style={{ width: 170, height: 54 }} />
          : <Pressable onPress={back} accessibilityLabel="Voltar" accessibilityRole="button" className="h-11 w-11 items-center justify-center rounded-full bg-[#1A1A1D]"><ArrowLeft size={22} color="white" /></Pressable>}
        {stage !== 'welcome' ? <Image source={require('../assets/logos/logo-square.png')} resizeMode="contain" style={{ width: 42, height: 42 }} /> : null}
      </View>
      {index >= 0 ? <View className="px-7 pt-4">
        <View className="flex-row justify-between"><Text className="text-sm font-semibold text-[#A3A3AA]">Etapa {index + 1} de {steps.length}</Text><Text className="text-sm font-semibold text-[#A3A3AA]">{title}</Text></View>
        <View className="mt-3 h-[2px] bg-[#303034]"><View className="h-[2px] bg-[#DC2626]" style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></View>
      </View> : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: stage === 'welcome' ? 24 : 46, paddingBottom: 28 }}>
        {page}
        {error ? <Text accessibilityRole="alert" className="mt-6 rounded-xl border border-[#7F1D1D] bg-[#2C1114] p-4 text-sm text-[#FCA5A5]">{error}</Text> : null}
      </ScrollView>
      <View className="border-t border-[#18181B] bg-[#0B0B0D] px-7 pb-5 pt-4">
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: action.disabled || busy }}
          onPress={action.onPress} disabled={action.disabled || busy}
          className="min-h-14 flex-row items-center justify-center rounded-xl bg-[#DC2626] disabled:opacity-40">
          {busy ? <ActivityIndicator color="white" /> : <><Text className="text-base font-bold text-white">{action.label}</Text><ArrowRight size={20} color="white" style={{ marginLeft: 12 }} /></>}
        </Pressable>
        {stage === 'welcome' ? <Pressable onPress={() => router.replace('/login')} className="mt-3 min-h-11 items-center justify-center"><Text className="text-sm font-semibold text-[#A3A3AA]">Já tenho acesso</Text></Pressable> : null}
        {stage === 'client-done' ? <Pressable onPress={() => { void Linking.openURL(PRIVACY_URL) }} className="mt-3 min-h-11 items-center justify-center"><Text className="text-sm font-semibold text-[#A3A3AA]">Política de Privacidade</Text></Pressable> : null}
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>
}

function Heading({ kicker, title, description }: { kicker: string; title: string; description?: string }) {
  return <View><Text className="mb-5 text-sm font-bold tracking-[3px] text-[#EF4444]">{kicker}</Text>
    <Text className="text-[31px] font-bold leading-[38px] text-white">{title}</Text>
    {description ? <Text className="mt-4 text-base leading-7 text-[#A3A3AA]">{description}</Text> : null}
  </View>
}

function ProfileCard({ label, description, selected, onPress, partner }: { label: string; description: string; selected: boolean; onPress: () => void; partner?: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress}
    className={`min-h-28 flex-row items-center rounded-2xl border p-5 ${selected ? 'border-[#DC2626] bg-[#251315]' : 'border-[#333337] bg-[#151518]'}`}>
    <View className="mr-4 h-14 w-14 items-center justify-center rounded-xl bg-[#2A1518]">{partner ? <BriefcaseBusiness size={24} color="#EF4444" /> : <Building2 size={24} color="#EF4444" />}</View>
    <View className="flex-1"><Text className="text-lg font-bold text-white">{label}</Text><Text className="mt-1 text-sm leading-5 text-[#A3A3AA]">{description}</Text></View>
    <View className={`h-5 w-5 rounded-full border ${selected ? 'border-[#DC2626] bg-[#DC2626]' : 'border-[#6B6B72]'}`} />
  </Pressable>
}

function NumberList({ items }: { items: string[] }) {
  return <View className="mt-9 border-t border-[#333337]">{items.map((item, index) => <View key={item} className="flex-row border-b border-[#333337] py-5"><Text className="w-12 font-bold text-[#EF4444]">0{index + 1}</Text><Text className="flex-1 text-base leading-6 text-[#C4C4CA]">{item}</Text></View>)}</View>
}

function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} className="mt-4 min-h-12 flex-row items-start py-2">
    <View className={`mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-md border ${checked ? 'border-[#DC2626] bg-[#DC2626]' : 'border-[#6B6B72]'}`}>{checked ? <Check size={15} color="white" /> : null}</View>
    <Text className="flex-1 text-sm leading-5 text-[#C4C4CA]">{label}</Text>
  </Pressable>
}

function ReviewRow({ title, lines, onEdit }: { title: string; lines: string[]; onEdit: () => void }) {
  return <View className="mt-5 rounded-xl border border-[#333337] bg-[#151518] p-5"><View className="mb-3 flex-row justify-between"><Text className="text-xs font-bold tracking-[2px] text-[#A3A3AA]">{title.toUpperCase()}</Text><Pressable accessibilityRole="button" onPress={onEdit}><Text className="text-sm font-semibold text-[#EF4444]">Editar</Text></Pressable></View>
    {lines.filter(Boolean).map((line, index) => <Text key={`${index}-${line}`} className="mt-1 text-sm leading-5 text-[#D4D4D8]">{line}</Text>)}
  </View>
}

function Done({ title, description, note }: { title: string; description: string; note: string }) {
  return <View className="flex-1 justify-center"><View className="mb-10 h-24 w-24 items-center justify-center rounded-full bg-[#DC2626]"><Check size={44} color="white" /></View>
    <Heading kicker="ENVIO CONCLUÍDO" title={title} description={description} /><Notice text={note} />
  </View>
}
