import { useState } from 'react'
import { View, Text, Image, Alert } from 'react-native'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { Bell, Users, Settings, Shield, HelpCircle, Calculator, BarChart3, GraduationCap, Coins, FileText } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { NotificationsSheet } from '@/components/NotificationsSheet'
import { PartnerScreen, PartnerCard, PartnerTitle, PartnerBody, PartnerAction, PartnerFeedback, PartnerMenuItem } from '@/components/parceiro/PartnerUI'
import { brl } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { usePartnerProfile, partnerDisplayName } from '@/lib/partner'
import { canManagePartner } from '@/lib/partnerAccess'

interface KpiRow { taxa_conversao: number; volume_total: number }
const PARTNER_STATUS: Record<string, string> = { approved: 'Parceiro aprovado', pending: 'Em análise', suspended: 'Suspenso', rejected: 'Cadastro não aprovado' }

export default function Perfil() {
  const { session, signOut } = useAuth()
  const profileQ = usePartnerProfile()
  const owner = canManagePartner(session?.role)
  const [refreshing, setRefreshing] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null)

  const kpiQ = useQuery({
    queryKey: ['p-kpis-perfil', session?.userId], enabled: owner,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_partner_dashboard_kpis').select('taxa_conversao, volume_total').maybeSingle()
      if (error) throw error
      return data as KpiRow | null
    },
  })
  const equipeQ = useQuery({
    queryKey: ['p-equipe-count', session?.userId], enabled: owner,
    queryFn: async () => {
      const { count, error } = await supabase.from('v_equipe_membros_detalhe').select('usuario_id', { count: 'exact', head: true })
      if (error) throw error
      return count ?? 0
    },
  })

  async function refresh() {
    setRefreshing(true)
    try { await Promise.allSettled([profileQ.refetch(), ...(owner ? [kpiQ.refetch(), equipeQ.refetch()] : [])]) }
    finally { setRefreshing(false) }
  }
  function handleLogout() {
    Alert.alert('Encerrar sessão', 'Deseja sair desta conta no aparelho?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => {
        setSigningOut(true)
        try { await signOut(); router.replace('/login') }
        catch { Alert.alert('Não foi possível concluir a saída', 'Tente novamente.') }
        finally { setSigningOut(false) }
      } },
    ])
  }

  const profile = profileQ.data
  const name = profile ? partnerDisplayName(profile) : session?.nome || (owner ? 'Parceiro' : 'Membro da equipe')
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const status = owner ? PARTNER_STATUS[profile?.partner_status ?? ''] ?? 'Parceiro' : 'Membro da equipe'
  const count = equipeQ.isLoading ? '…' : equipeQ.isError ? '—' : String(equipeQ.data ?? 0)
  const version = Constants.expoConfig?.version
  const build = Constants.platform?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode

  return <PartnerScreen title="Meu perfil" subtitle={owner ? 'Sua conta e operação' : 'Sua conta de equipe'} back={false} tabbed refreshing={refreshing} onRefresh={() => { void refresh() }}>
    {profileQ.isError ? <PartnerFeedback title="Perfil indisponível" text="Não foi possível carregar seus dados. Sua sessão continua ativa." retry={() => { void profileQ.refetch() }} />
      : <PartnerCard>
        <View className="flex-row items-center gap-4">
          {profile?.avatar_url && failedAvatar !== profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} onError={() => setFailedAvatar(profile.avatar_url)} style={{ width: 64, height: 64, borderRadius: 20 }} />
            : <View className="h-16 w-16 items-center justify-center rounded-2xl border border-[#713035] bg-[#28171B]"><Text className="text-2xl font-bold text-[#F87171]">{initials}</Text></View>}
          <View className="flex-1"><Text className="text-xl font-semibold text-white">{profileQ.isLoading ? 'Carregando seu perfil…' : name}</Text><Text className="mt-1 text-sm text-[#A1A1AA]">{profile?.email || session?.email || 'E-mail não informado'}</Text></View>
        </View>
        <View className="self-start rounded-full border border-[#414148] bg-[#242428] px-3 py-2"><Text className="text-xs font-medium text-[#E4E4E7]">{status}</Text></View>
      </PartnerCard>}

    {owner ? kpiQ.isError ? <PartnerFeedback title="Desempenho indisponível" text="Não foi possível carregar os indicadores. Tente atualizar." retry={() => { void kpiQ.refetch() }} />
      : <PartnerCard><PartnerTitle>Meu desempenho</PartnerTitle><Stat label="Volume solicitado · acumulado" value={kpiQ.isLoading ? '—' : brl(Number(kpiQ.data?.volume_total ?? 0) * 100)} />
        <View className="flex-row flex-wrap gap-5"><Stat label="Conversão" value={kpiQ.isLoading ? '—' : `${Number(kpiQ.data?.taxa_conversao ?? 0).toLocaleString('pt-BR')}%`} /><Stat label="Membros da equipe" value={count} /></View>
        {equipeQ.isError ? <PartnerBody>A contagem da equipe está indisponível. Atualize a página para tentar novamente.</PartnerBody> : null}
      </PartnerCard> : null}

    <PartnerCard><PartnerTitle>Operação</PartnerTitle>
      <PartnerMenuItem icon={Calculator} label="Simulações" hint="Monte uma prévia comercial" onPress={() => router.push('/(parceiro)/simulacoes' as any)} />
      {owner ? <><PartnerMenuItem icon={Coins} label="Comissões" onPress={() => router.push('/(parceiro)/comissoes')} />
        <PartnerMenuItem icon={Users} label="Equipe" badge={`${count} membros`} onPress={() => router.push('/(parceiro)/equipe')} />
        <PartnerMenuItem icon={BarChart3} label="Relatórios" onPress={() => router.push('/(parceiro)/relatorios')} /></> : null}
      <PartnerMenuItem icon={GraduationCap} label="Universidade" hint="Cursos e certificados" onPress={() => router.push('/(parceiro)/universidade')} />
      {owner ? <PartnerMenuItem icon={FileText} label="Contrato de parceria" hint="Disponibilidade do documento oficial" onPress={() => router.push('/(parceiro)/contrato')} /> : null}
    </PartnerCard>
    <PartnerCard><PartnerTitle>Conta</PartnerTitle>
      <NotificationsSheet renderTrigger={({ onPress, unreadCount }) => <PartnerMenuItem icon={Bell} label="Notificações" hint="Atualizações da sua operação" badge={unreadCount ? `${unreadCount} não lidas` : undefined} onPress={onPress} />} />
      <PartnerMenuItem icon={Shield} label="Segurança & 2FA" hint="Autenticador e acesso à conta" onPress={() => router.push({ pathname: '/(parceiro)/configuracoes', params: { secao: 'seguranca' } })} />
      {owner ? <PartnerMenuItem icon={Settings} label="Configurações" hint="Dados da empresa e preferências" onPress={() => router.push({ pathname: '/(parceiro)/configuracoes', params: { secao: 'empresa' } })} /> : null}
    </PartnerCard>
    <PartnerCard><PartnerMenuItem icon={HelpCircle} label="Central de ajuda" hint="O canal de atendimento ainda não está configurado no app." /></PartnerCard>
    <PartnerAction danger secondary label="Encerrar sessão" busy={signingOut} onPress={handleLogout} />
    <Text className="text-center text-xs text-[#A1A1AA]">Mercúrio Capital{version ? ` · v${version}` : ''}{build ? ` · Build ${build}` : ''}</Text>
  </PartnerScreen>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View className="min-w-[120px] flex-1 gap-2"><Text className="text-xs text-[#A1A1AA]">{label}</Text><Text className="text-2xl font-semibold text-white" selectable>{value}</Text></View>
}
