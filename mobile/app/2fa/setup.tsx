import { useState } from 'react'
import { Alert, Linking, Text, TextInput, View } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { SvgXml } from 'react-native-svg'
import { ShieldCheck } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { PartnerAction, PartnerBody, PartnerCard, PartnerScreen, PartnerTitle } from '@/components/parceiro/PartnerUI'

type Enrollment = { factorId: string; qrCodeSvg: string; secret: string; uri: string }

export default function TwoFactorSetup() {
  const { session, signOut, refresh } = useAuth()
  const params = useLocalSearchParams<{ retorno?: string }>()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fromSettings = params.retorno === 'seguranca' && (session?.role === 'partner' || session?.role === 'team_member')

  function finish() {
    if (fromSettings) router.replace({ pathname: '/(parceiro)/configuracoes', params: { secao: 'seguranca' } })
    else if (session?.role === 'client') router.replace('/(cliente)')
    else router.replace('/(parceiro)/dashboard')
  }
  async function start() {
    setBusy(true); setError(null)
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Mercúrio Mobile ${new Date().toISOString()}` })
      if (enrollError || !data) throw new Error('Não foi possível iniciar o cadastro. Confira sua sessão e tente novamente.')
      setEnrollment({ factorId: data.id, qrCodeSvg: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar o cadastro.') }
    finally { setBusy(false) }
  }
  async function verify() {
    if (!enrollment || code.length !== 6) return
    setBusy(true); setError(null)
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code })
      if (verifyError) throw new Error('Código inválido ou expirado. Confira o aplicativo autenticador e tente novamente.')
      setSuccess(true)
      setCode('')
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar o código.') }
    finally { setBusy(false) }
  }
  async function cancel() {
    setBusy(true); setError(null)
    try {
      if (enrollment && !success) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId })
        if (removeError) throw new Error('Não foi possível cancelar este cadastro. Tente novamente.')
      }
      if (fromSettings) finish()
      else { await signOut(); router.replace('/login') }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar.') }
    finally { setBusy(false) }
  }

  if (!session) return <Redirect href="/login" />
  if (session.role === 'admin') return <Redirect href="/acesso-indisponivel" />
  return <PartnerScreen title="Configurar 2FA" subtitle="Aplicativo autenticador" back={false}>
    <PartnerCard><ShieldCheck color="#F87171" size={30} /><PartnerTitle>{success ? 'Autenticador confirmado' : 'Proteja sua conta'}</PartnerTitle>
      <PartnerBody>{success ? 'O autenticador foi vinculado à sua conta.' : 'Adicione a conta ao aplicativo autenticador e confirme o código de seis dígitos. Seus outros autenticadores serão preservados.'}</PartnerBody>
      {!enrollment ? <PartnerAction label="Gerar QR code" busy={busy} onPress={() => { void start() }} /> : !success ? <>
        <View className="items-center rounded-2xl bg-white p-5"><SvgXml xml={enrollment.qrCodeSvg} width={200} height={200} /></View>
        <PartnerAction secondary label="Abrir aplicativo autenticador" onPress={() => { void Linking.openURL(enrollment.uri).catch(() => setError('Não foi possível abrir o autenticador. Use a chave para entrada manual.')) }} />
        <View className="gap-3 rounded-2xl border border-[#414148] bg-[#202024] p-4"><Text className="text-sm text-[#D4D4D8]">Chave para entrada manual</Text><Text selectable className="font-mono text-sm text-white">{enrollment.secret}</Text>
          <PartnerAction secondary label="Copiar chave" onPress={() => { void Clipboard.setStringAsync(enrollment.secret).then(() => Alert.alert('Chave copiada', 'Cole no seu aplicativo autenticador.')).catch(() => setError('Não foi possível copiar a chave.')) }} />
        </View>
        <Text className="text-sm font-medium text-[#D4D4D8]">Código do autenticador</Text><TextInput accessibilityLabel="Código de seis dígitos do autenticador" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" placeholder="000000" placeholderTextColor="#71717A" selectionColor="#EF4444" className="min-h-14 rounded-xl border border-[#414148] bg-[#202024] px-4 text-center text-xl text-white" />
        <PartnerAction label="Confirmar autenticador" busy={busy} disabled={code.length !== 6} onPress={() => { void verify() }} />
      </> : <PartnerAction label={fromSettings ? 'Voltar para Segurança' : 'Continuar'} busy={busy} onPress={finish} />}
      {error ? <Text accessibilityRole="alert" className="text-sm text-[#FCA5A5]">{error}</Text> : null}
      {!success ? <PartnerAction secondary label={fromSettings ? 'Cancelar cadastro' : 'Cancelar e sair'} disabled={busy} onPress={() => { void cancel() }} /> : null}
    </PartnerCard>
  </PartnerScreen>
}
