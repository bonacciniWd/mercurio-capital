import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { SvgXml } from 'react-native-svg'
import {
  ShieldCheck, Copy, CheckCircle2, AlertTriangle, ExternalLink,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Enrollment = {
  factorId: string
  qrCodeSvg: string
  secret: string
  uri: string
}

/**
 * Cadastra um fator TOTP no app autenticador do usuário.
 * Equivalente a TwoFactorSetupPage do web.
 */
export default function TwoFactorSetup() {
  const { signOut, refresh } = useAuth()
  const [loading, setLoading] = useState(true)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        // Remove fatores não verificados anteriores (evita "factor already exists")
        const { data: existing, error: listErr } = await supabase.auth.mfa.listFactors()
        if (listErr) throw new Error(listErr.message)
        const unverified = existing?.totp?.filter(f => f.status !== 'verified') ?? []
        for (const f of unverified) {
          await supabase.auth.mfa.unenroll({ factorId: f.id })
        }

        const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
          factorType: 'totp', friendlyName: 'Mercurio Mobile',
        })
        if (enrollErr || !data) throw new Error(enrollErr?.message ?? 'Falha ao iniciar cadastro 2FA.')

        if (!cancelled) {
          setEnrollment({
            factorId: data.id,
            qrCodeSvg: data.totp.qr_code,
            secret: data.totp.secret,
            uri: data.totp.uri,
          })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro inesperado.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void start()
    return () => { cancelled = true }
  }, [])

  async function copySecret() {
    if (!enrollment) return
    await Clipboard.setStringAsync(enrollment.secret)
    Alert.alert('Copiado', 'Chave secreta copiada para a área de transferência.')
  }

  async function handleVerify() {
    if (!enrollment) return
    setError(null)
    if (code.length !== 6) return setError('Informe o código de 6 dígitos.')
    setVerifying(true)
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId })
      if (chErr || !ch) throw new Error(chErr?.message ?? 'Falha ao iniciar desafio.')

      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId, challengeId: ch.id, code,
      })
      if (verErr) throw new Error(verErr.message)

      setSuccess(true)
      await refresh()

      setTimeout(async () => {
        const { data: u } = await supabase.auth.getUser()
        const userId = u.user?.id
        if (!userId) return router.replace('/login')
        const { data: prof } = await supabase.from('usuarios').select('role').eq('id', userId).maybeSingle()
        const role = prof?.role as string | undefined
        if (role === 'admin') router.replace('/(admin)' as any)
        else if (role === 'client') router.replace('/(cliente)' as any)
        else router.replace('/(parceiro)/dashboard')
      }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código inválido.')
    } finally {
      setVerifying(false)
    }
  }

  async function handleCancel() {
    await signOut()
    router.replace('/login')
  }

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <View className="rounded-2xl border border-silver-200 bg-white p-6">
            <View className="flex-row items-center gap-2">
              <ShieldCheck size={18} color="#B45309" />
              <Text className="text-xs font-semibold uppercase tracking-wider text-gold-600">
                Primeiro acesso seguro
              </Text>
            </View>
            <Text className="mt-1 text-2xl font-bold text-navy">Configurar 2FA</Text>
            <Text className="mt-2 text-sm text-silver-600">
              Sua conta exige autenticação em duas etapas. Escaneie o QR code com seu autenticador (Google
              Authenticator, 1Password, Authy etc.) e digite o código gerado.
            </Text>

            {loading ? (
              <View className="mt-8 items-center">
                <ActivityIndicator color="#D4AF37" />
                <Text className="mt-2 text-xs text-silver-500">Gerando QR code…</Text>
              </View>
            ) : enrollment && !success ? (
              <>
                {/* QR Code */}
                <View className="mt-6 items-center rounded-xl border border-silver-200 bg-white p-4">
                  <SvgXml xml={enrollment.qrCodeSvg} width={200} height={200} />
                </View>

                {/* Chave manual */}
                <View className="mt-4 rounded-xl bg-silver-100 p-3">
                  <Text className="text-xs font-semibold text-silver-700">Chave secreta (entrada manual)</Text>
                  <View className="mt-2 flex-row items-center gap-2">
                    <Text className="flex-1 font-mono text-xs text-navy" selectable>
                      {enrollment.secret}
                    </Text>
                    <Pressable
                      onPress={copySecret}
                      className="flex-row items-center gap-1 rounded-md bg-white px-3 py-1.5 active:bg-silver-50"
                    >
                      <Copy size={12} color="#0F0F0F" />
                      <Text className="text-xs font-semibold text-navy">Copiar</Text>
                    </Pressable>
                  </View>
                  <View className="mt-2 flex-row items-center gap-1">
                    <ExternalLink size={11} color="#737373" />
                    <Text className="text-[11px] text-silver-600">
                      Cole esta chave no app autenticador caso o QR não funcione.
                    </Text>
                  </View>
                </View>

                {/* Código */}
                <View className="mt-4">
                  <Text className="mb-1.5 text-xs font-medium text-silver-700">Código de 6 dígitos</Text>
                  <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    keyboardType="number-pad"
                    maxLength={6}
                    className="rounded-lg border border-silver-300 px-3 py-3 text-center text-2xl font-bold tracking-[8px] text-navy"
                  />
                </View>

                {error && (
                  <View className="mt-3 flex-row items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
                    <AlertTriangle size={14} color="#DC2626" />
                    <Text className="flex-1 text-xs text-danger">{error}</Text>
                  </View>
                )}

                <Pressable
                  onPress={handleVerify}
                  disabled={verifying || code.length !== 6}
                  className={`mt-4 items-center rounded-lg py-3.5 ${verifying || code.length !== 6 ? 'bg-silver-200' : 'bg-gold active:opacity-80'}`}
                >
                  {verifying
                    ? <ActivityIndicator color="white" />
                    : <Text className={`text-base font-bold ${code.length === 6 ? 'text-white' : 'text-silver-500'}`}>
                        Ativar 2FA
                      </Text>}
                </Pressable>
              </>
            ) : success ? (
              <View className="mt-6 items-center">
                <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 size={28} color="#16A34A" />
                </View>
                <Text className="text-lg font-bold text-navy">2FA ativado!</Text>
                <Text className="mt-2 text-center text-sm text-silver-600">Redirecionando…</Text>
              </View>
            ) : (
              <View className="mt-6">
                {error && (
                  <View className="flex-row items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
                    <AlertTriangle size={14} color="#DC2626" />
                    <Text className="flex-1 text-xs text-danger">{error}</Text>
                  </View>
                )}
              </View>
            )}

            <View className="mt-6">
              <Pressable
                onPress={handleCancel}
                className="items-center rounded-lg border border-silver-300 py-3 active:bg-silver-50"
              >
                <Text className="text-sm font-semibold text-silver-700">Cancelar e sair</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

