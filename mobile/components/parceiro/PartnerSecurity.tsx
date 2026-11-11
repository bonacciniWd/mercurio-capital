import { useCallback, useState } from 'react'
import { Alert, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import * as Linking from 'expo-linking'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { PartnerAction, PartnerBody, PartnerCard, PartnerFeedback, PartnerTitle } from './PartnerUI'

type Factor = { id: string; friendly_name?: string; status: string; created_at: string }

export function PartnerSecurity() {
  const { session, refresh, signOut } = useAuth()
  const [removing, setRemoving] = useState<Factor | null>(null)
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const factors = useQuery({
    queryKey: ['partner-mfa-factors', session?.userId], enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw new Error('Não foi possível consultar seus autenticadores.')
      return data.all.filter((factor) => factor.factor_type === 'totp') as Factor[]
    },
  })
  const { refetch } = factors
  useFocusEffect(useCallback(() => { void refetch() }, [refetch]))
  const verified = (factors.data ?? []).filter((factor) => factor.status === 'verified')
  const verificationFactor = removing?.status === 'verified' ? removing : verified[0]
  const remove = useMutation({
    mutationFn: async () => {
      if (!removing) throw new Error('Selecione o autenticador que deseja remover.')
      if (verificationFactor) {
        if (!/^\d{6}$/.test(code)) throw new Error('Informe o código de seis dígitos do autenticador.')
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: verificationFactor.id, code })
        if (error) throw new Error('Código inválido ou expirado. Confira o autenticador e tente novamente.')
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: removing.id })
      if (error) throw new Error('Não foi possível remover o autenticador. Confirme sua sessão e tente novamente.')
    },
    onSuccess: async () => { setRemoving(null); setCode(''); await refresh(); await refetch() },
  })
  const password = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user?.email) throw new Error('Não foi possível confirmar sua conta. Entre novamente.')
      const result = await supabase.auth.resetPasswordForEmail(data.user.email, { redirectTo: Linking.createURL('/redefinir-senha') })
      if (result.error) throw new Error('Não foi possível enviar o e-mail. Aguarde um momento e tente novamente.')
    },
    onSuccess: () => setSent(true),
  })

  return <>
    <PartnerCard><PartnerTitle>Autenticação em duas etapas</PartnerTitle><PartnerBody>Use um aplicativo autenticador para confirmar o acesso à sua conta com um código temporário.</PartnerBody>
      {factors.isLoading ? <PartnerFeedback title="Consultando autenticadores…" loading /> : factors.isError ? <PartnerFeedback title="Autenticadores indisponíveis" retry={() => { void refetch() }} /> : <>
        <Text className={`text-sm font-semibold ${verified.length ? 'text-[#86EFAC]' : 'text-[#FCA5A5]'}`}>{verified.length ? '2FA ativo' : '2FA não configurado'}</Text>
        {(factors.data ?? []).map((factor) => <View key={factor.id} className="gap-3 rounded-2xl border border-[#414148] bg-[#202024] p-4">
          <Text className="text-sm font-semibold text-white">{factor.friendly_name || 'Aplicativo autenticador'}</Text>
          <Text className="text-xs text-[#B8B8C2]">{factor.status === 'verified' ? 'Verificado' : 'Cadastro pendente de confirmação'} · {new Date(factor.created_at).toLocaleDateString('pt-BR')}</Text>
          <PartnerAction danger secondary label="Remover autenticador" disabled={remove.isPending || !!removing} onPress={() => { remove.reset(); setCode(''); setRemoving(factor) }} />
        </View>)}
        {!factors.data?.length ? <PartnerBody>Nenhum autenticador cadastrado.</PartnerBody> : null}
        {!removing ? <PartnerAction label={verified.length ? 'Adicionar autenticador' : 'Configurar 2FA'} onPress={() => router.push({ pathname: '/2fa/setup', params: { retorno: 'seguranca' } })} /> : null}
      </>}
      {removing ? <View className="gap-4 rounded-2xl border border-[#713035] bg-[#28171B] p-4">
        <Text className="text-base font-semibold text-white">Confirmar remoção</Text><PartnerBody>Você está removendo {removing.friendly_name || 'este autenticador'}. Se este for o último, sua conta ficará sem um fator TOTP cadastrado.</PartnerBody>
        {verificationFactor ? <><PartnerBody>Informe o código atual de {verificationFactor.friendly_name || 'seu autenticador'}.</PartnerBody><TextInput accessibilityLabel="Código do autenticador para remover 2FA" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} placeholder="000000" placeholderTextColor="#71717A" selectionColor="#EF4444" className="min-h-14 rounded-xl border border-[#414148] bg-[#202024] px-4 text-center text-xl text-white" /></> : null}
        {remove.isError ? <Text accessibilityRole="alert" className="text-sm text-[#FCA5A5]">{remove.error.message}</Text> : null}
        <PartnerAction danger label="Confirmar remoção" busy={remove.isPending} disabled={!!verificationFactor && code.length !== 6} onPress={() => remove.mutate()} />
        <PartnerAction secondary label="Cancelar" disabled={remove.isPending} onPress={() => { setRemoving(null); setCode(''); remove.reset() }} />
      </View> : null}
    </PartnerCard>
    <PartnerCard><PartnerTitle>Acesso neste aparelho</PartnerTitle><PartnerBody>O desbloqueio do aparelho protege sua sessão salva ao abrir ou retornar ao app. Esse controle é independente do código 2FA do autenticador.</PartnerBody></PartnerCard>
    <PartnerCard><PartnerTitle>Senha da conta</PartnerTitle><PartnerBody>Enviaremos um link para o e-mail da sua conta. A alteração será concluída pelo fluxo seguro de recuperação.</PartnerBody>
      {password.isError ? <Text accessibilityRole="alert" className="text-sm text-[#FCA5A5]">{password.error.message}</Text> : null}
      {sent ? <Text accessibilityLiveRegion="polite" className="text-sm text-[#86EFAC]">Instruções enviadas para o seu e-mail.</Text> : null}
      <PartnerAction secondary label="Receber link para alterar senha" busy={password.isPending} onPress={() => { setSent(false); password.mutate() }} />
    </PartnerCard>
    <PartnerAction danger secondary label="Encerrar sessão" onPress={() => Alert.alert('Encerrar sessão', 'Deseja sair desta conta no aparelho?', [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login') } },
    ])} />
  </>
}
