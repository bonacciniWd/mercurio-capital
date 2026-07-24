import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { getSenhaMinLength, validarSenha } from '@/lib/securityConfig'

const SESSION_EXPIRED_MESSAGE =
  'Sessão expirada. Solicite um novo link de recuperação para continuar.'
const RECOVERY_LINK_INVALID_MESSAGE =
  'Link de recuperação inválido ou expirado. Solicite um novo link para continuar.'
const MFA_FACTOR_MISSING_MESSAGE =
  'Não encontramos um fator TOTP verificado nesta conta. Faça login novamente e conclua a configuração/validação do 2FA para redefinir a senha.'
const MFA_CODE_INVALID_MESSAGE =
  'Código 2FA inválido ou expirado. Gere um novo código no aplicativo autenticador e tente novamente.'
const MFA_STEP_UP_HINT =
  'Para concluir a redefinição, confirme seu código 2FA de 6 dígitos.'

const SESSION_MISSING_MARKERS = [
  'auth session missing',
  'session missing',
  'invalid refresh token',
  'refresh token not found',
  'refresh token is invalid',
  'jwt expired',
]

const RECOVERY_LINK_INVALID_MARKERS = [
  'invalid token',
  'token has expired',
  'otp expired',
  'otp has expired',
  'flow state not found',
]

const MFA_CODE_INVALID_MARKERS = [
  'invalid otp',
  'invalid code',
  'verification failed',
  'challenge not found',
  'expired',
]

function readErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return ''
}

function includesMarker(message: string, markers: string[]): boolean {
  const normalized = message.toLowerCase()
  return markers.some((marker) => normalized.includes(marker))
}

function isAal2RequiredForPasswordUpdate(err: unknown): boolean {
  const message = readErrorMessage(err).toLowerCase()
  return message.includes('aal2 session is required')
    && (message.includes('update email or password') || message.includes('update password'))
}

function normalizePasswordResetError(err: unknown): string {
  const message = readErrorMessage(err)
  if (!message) return 'Falha ao atualizar senha.'
  if (includesMarker(message, SESSION_MISSING_MARKERS)) return SESSION_EXPIRED_MESSAGE
  if (includesMarker(message, RECOVERY_LINK_INVALID_MARKERS)) return RECOVERY_LINK_INVALID_MESSAGE
  return message
}

function normalizeMfaStepUpError(err: unknown): string {
  const message = readErrorMessage(err)
  if (!message) return 'Não foi possível validar o código 2FA.'
  if (includesMarker(message, SESSION_MISSING_MARKERS)) return SESSION_EXPIRED_MESSAGE
  if (includesMarker(message, MFA_CODE_INVALID_MARKERS)) return MFA_CODE_INVALID_MESSAGE
  return message
}

export default function RedefinirSenha() {
  const [hasRecovery, setHasRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [needsAal2StepUp, setNeedsAal2StepUp] = useState(false)
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // O Supabase materializa a sessão automaticamente via deep link (mercurio://redefinir-senha?...)
    // e dispara PASSWORD_RECOVERY. Como o callback de onAuthStateChange tem lock interno,
    // deferimos qualquer trabalho com setTimeout(0).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTimeout(() => setHasRecovery(true), 0)
      }
    })
    // Checagem inicial: se já existe sessão ao montar, libera o form.
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setHasRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function getVerifiedTotpFactorId(): Promise<string> {
    const { data, error: listErr } = await supabase.auth.mfa.listFactors()
    if (listErr) throw new Error(normalizeMfaStepUpError(listErr))

    const factor = data?.totp?.find((f) => f.status === 'verified')
    if (!factor) throw new Error(MFA_FACTOR_MISSING_MESSAGE)
    return factor.id
  }

  async function completePasswordUpdate() {
    await supabase.auth.signOut()
    setDone(true)
    setTimeout(() => router.replace('/login'), 1500)
  }

  async function handleSubmit() {
    setError(null)
    const erroSenha = validarSenha(password, await getSenhaMinLength())
    if (erroSenha) return setError(erroSenha)
    if (password !== confirm) return setError('As senhas não conferem.')

    setLoading(true)
    try {
      if (!needsAal2StepUp) {
        const { error: err } = await supabase.auth.updateUser({ password })
        if (!err) {
          await completePasswordUpdate()
          return
        }

        if (!isAal2RequiredForPasswordUpdate(err)) {
          throw err
        }

        const factorId = await getVerifiedTotpFactorId()
        setTotpFactorId(factorId)
        setNeedsAal2StepUp(true)
        setError(MFA_STEP_UP_HINT)
        return
      }

      if (totpCode.length !== 6) {
        setError('Informe o código 2FA de 6 dígitos.')
        return
      }

      const factorId = totpFactorId ?? await getVerifiedTotpFactorId()
      if (!totpFactorId) {
        setTotpFactorId(factorId)
      }

      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeErr || !challenge) {
        throw challengeErr ?? new Error('Não foi possível iniciar o desafio 2FA.')
      }

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: totpCode,
      })
      if (verifyErr) throw verifyErr

      const { error: retryErr } = await supabase.auth.updateUser({ password })
      if (retryErr) {
        if (isAal2RequiredForPasswordUpdate(retryErr)) {
          throw new Error('Não foi possível elevar a sessão para AAL2. Tente validar o código novamente.')
        }
        throw retryErr
      }

      await completePasswordUpdate()
    } catch (err) {
      if (isAal2RequiredForPasswordUpdate(err)) {
        setNeedsAal2StepUp(true)
        setError(MFA_STEP_UP_HINT)
      } else if (needsAal2StepUp) {
        setError(normalizeMfaStepUpError(err))
      } else {
        setError(normalizePasswordResetError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 px-6 pt-8">
          <View className="items-center py-8">
            <Image
              source={require('../assets/logos/logowide.png')}
              style={{ width: 240, height: 70 }}
              resizeMode="contain"
            />
          </View>

          {done ? (
            <View className="items-center rounded-2xl border border-silver-200 bg-white p-8">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 size={26} color="#16A34A" />
              </View>
              <Text className="text-2xl font-bold text-navy">Senha atualizada!</Text>
              <Text className="mt-2 text-center text-sm text-silver-600">Redirecionando para o login…</Text>
              <ActivityIndicator color="#D4AF37" className="mt-4" />
            </View>
          ) : !hasRecovery ? (
            <View className="rounded-2xl border border-danger/30 bg-danger/5 p-6">
              <View className="mb-3 flex-row items-center gap-2">
                <AlertTriangle size={18} color="#DC2626" />
                <Text className="text-lg font-bold text-danger">Link inválido ou expirado</Text>
              </View>
              <Text className="text-sm text-silver-700">
                Solicite um novo link de recuperação.
              </Text>
              <Pressable
                onPress={() => router.replace('/recuperar-senha' as any)}
                className="mt-5 items-center rounded-lg bg-gold py-3.5 active:opacity-80"
              >
                <Text className="text-base font-bold text-white">Recuperar senha</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text className="text-2xl font-bold text-navy">Defina sua nova senha</Text>
              <Text className="mt-1 text-sm text-silver-600">Escolha uma senha forte e única para sua conta.</Text>

              <View className="mt-6 gap-4">
                <View>
                  <Text className="mb-1.5 text-xs font-medium text-silver-700">Nova senha</Text>
                  <View className="flex-row items-center rounded-lg border border-silver-300 px-3">
                    <Lock size={18} color="#9CA3AF" />
                    <TextInput
                      value={password} onChangeText={setPassword}
                      placeholder="Mínimo 8 caracteres"
                      secureTextEntry autoCapitalize="none"
                      className="ml-2 flex-1 py-3 text-sm text-silver-900"
                    />
                  </View>
                </View>

                <View>
                  <Text className="mb-1.5 text-xs font-medium text-silver-700">Confirmar nova senha</Text>
                  <View className="flex-row items-center rounded-lg border border-silver-300 px-3">
                    <Lock size={18} color="#9CA3AF" />
                    <TextInput
                      value={confirm} onChangeText={setConfirm}
                      placeholder="Repita a senha"
                      secureTextEntry autoCapitalize="none"
                      className="ml-2 flex-1 py-3 text-sm text-silver-900"
                    />
                  </View>
                </View>

                {needsAal2StepUp && (
                  <View>
                    <Text className="mb-1.5 text-xs font-medium text-silver-700">Código 2FA</Text>
                    <TextInput
                      value={totpCode}
                      onChangeText={(v) => setTotpCode(v.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      keyboardType="number-pad"
                      maxLength={6}
                      className="rounded-lg border border-silver-300 px-3 py-3 text-center text-2xl font-bold tracking-[8px] text-navy"
                    />
                    <Text className="mt-1 text-xs text-silver-600">
                      Abra seu app autenticador e informe o código atual de 6 dígitos.
                    </Text>
                  </View>
                )}

                {error && (
                  <View className="flex-row items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
                    <AlertTriangle size={14} color="#DC2626" />
                    <Text className="flex-1 text-xs text-danger">{error}</Text>
                  </View>
                )}

                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  className="items-center rounded-lg bg-gold py-3.5 active:opacity-80"
                >
                  {loading ? <ActivityIndicator color="white" /> : (
                    <Text className="text-base font-bold text-white">
                      {needsAal2StepUp ? 'Validar 2FA e atualizar senha' : 'Atualizar senha'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

