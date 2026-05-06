import { useState } from 'react'
import { ScrollView, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Building2, CheckCircle2, Upload, X } from 'lucide-react-native'

type Form = {
  nome: string
  email: string
  telefone: string
  cnpj: string
  razao: string
}

const STEPS = ['Dados', 'Documentos', 'Revisão'] as const

export default function Cadastro() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>({ nome: '', email: '', telefone: '', cnpj: '', razao: '' })
  const [docs, setDocs] = useState<string[]>([])
  const [done, setDone] = useState(false)

  function update<K extends keyof Form>(k: K, v: Form[K]) { setForm(s => ({ ...s, [k]: v })) }
  function mockUpload() {
    setDocs(d => [...d, `documento-${d.length + 1}.pdf`])
  }
  function removeDoc(i: number) { setDocs(d => d.filter((_, idx) => idx !== i)) }

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 size={48} color="#16A34A" />
          </View>
          <Text className="mt-6 text-2xl font-bold text-navy">Cadastro enviado</Text>
          <Text className="mt-2 text-center text-sm text-silver-600">
            Recebemos seus dados. Nossa equipe analisará sua proposta de parceria
            em até <Text className="font-semibold text-navy">2 dias úteis</Text> e
            você será avisado por e-mail e WhatsApp.
          </Text>
          <Pressable
            onPress={() => router.replace('/login')}
            className="mt-8 w-full items-center rounded-lg bg-gold py-3.5"
          >
            <Text className="text-base font-bold text-white">Voltar ao login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">

        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 py-3 border-b border-silver-100">
          <Pressable onPress={() => (step === 0 ? router.back() : setStep(s => s - 1))} className="-ml-2 p-2">
            <ArrowLeft size={22} color="#0F0F0F" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[10px] uppercase tracking-wider text-gold-600 font-bold">Cadastro de Parceiro</Text>
            <Text className="text-base font-bold text-navy">Passo {step + 1} de {STEPS.length}</Text>
          </View>
        </View>

        {/* Stepper */}
        <View className="flex-row gap-1.5 px-5 pt-4">
          {STEPS.map((_, i) => (
            <View key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-gold' : 'bg-silver-200'}`} />
          ))}
        </View>
        <View className="flex-row justify-between px-5 pt-1.5 pb-3">
          {STEPS.map((s, i) => (
            <Text key={s} className={`text-[10px] font-semibold ${i <= step ? 'text-navy' : 'text-silver-400'}`}>{s}</Text>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">

          {/* STEP 0 — Dados */}
          {step === 0 && (
            <View>
              <Text className="text-2xl font-bold text-navy">Crie sua conta</Text>
              <Text className="mt-1 text-sm text-silver-600">Envie seus dados para análise da nossa equipe.</Text>

              <View className="mt-6 gap-4">
                <Field label="Nome completo" value={form.nome} onChangeText={v => update('nome', v)} placeholder="João Silva" />
                <Field label="E-mail" value={form.email} onChangeText={v => update('email', v)} placeholder="joao@empresa.com" keyboardType="email-address" autoCapitalize="none" />
                <Field label="Telefone" value={form.telefone} onChangeText={v => update('telefone', v)} placeholder="+55 (11) 9XXXX-XXXX" keyboardType="phone-pad" />
                <Field label="CNPJ" value={form.cnpj} onChangeText={v => update('cnpj', v)} placeholder="00.000.000/0001-00" keyboardType="numeric" />
                <Field label="Razão social" value={form.razao} onChangeText={v => update('razao', v)} placeholder="Construtora Aurora LTDA" />
              </View>

              <Pressable
                onPress={() => setStep(1)}
                className="mt-8 items-center rounded-lg bg-gold py-3.5 active:opacity-80"
              >
                <Text className="text-base font-bold text-white">Continuar</Text>
              </Pressable>

              <Pressable onPress={() => router.replace('/login')} className="mt-4 items-center">
                <Text className="text-sm text-silver-600">
                  Já tem conta? <Text className="font-semibold text-navy underline">Faça login</Text>
                </Text>
              </Pressable>
            </View>
          )}

          {/* STEP 1 — Documentos */}
          {step === 1 && (
            <View>
              <Text className="text-2xl font-bold text-navy">Documentos da empresa</Text>
              <Text className="mt-1 text-sm text-silver-600">Cartão CNPJ e contrato social. PDF, JPG ou PNG até 10MB.</Text>

              <Pressable
                onPress={mockUpload}
                className="mt-6 items-center rounded-lg border-2 border-dashed border-silver-300 bg-silver-50 px-6 py-10 active:bg-silver-100"
              >
                <Building2 size={32} color="#9CA3AF" />
                <Text className="mt-3 text-sm text-silver-700">
                  Toque para <Text className="font-semibold text-gold-600 underline">selecionar arquivos</Text>
                </Text>
                <Text className="mt-1 text-xs text-silver-500">ou arraste pra cá no desktop</Text>
              </Pressable>

              {docs.length > 0 && (
                <View className="mt-4 gap-2">
                  {docs.map((d, i) => (
                    <View key={i} className="flex-row items-center rounded-lg border border-silver-200 bg-white px-3 py-2.5">
                      <Upload size={16} color="#16A34A" />
                      <Text className="ml-2 flex-1 text-sm text-silver-800">{d}</Text>
                      <Pressable onPress={() => removeDoc(i)} className="p-1">
                        <X size={16} color="#9CA3AF" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                onPress={() => setStep(2)}
                disabled={docs.length === 0}
                className={`mt-8 items-center rounded-lg py-3.5 ${docs.length === 0 ? 'bg-silver-200' : 'bg-gold active:opacity-80'}`}
              >
                <Text className={`text-base font-bold ${docs.length === 0 ? 'text-silver-500' : 'text-white'}`}>Continuar</Text>
              </Pressable>
            </View>
          )}

          {/* STEP 2 — Revisão */}
          {step === 2 && (
            <View>
              <Text className="text-2xl font-bold text-navy">Confirme seus dados</Text>
              <Text className="mt-1 text-sm text-silver-600">Revise antes de enviar para análise.</Text>

              <View className="mt-6 rounded-xl border border-silver-200 bg-white">
                <Row label="Nome" value={form.nome || '—'} />
                <Row label="E-mail" value={form.email || '—'} />
                <Row label="Telefone" value={form.telefone || '—'} />
                <Row label="CNPJ" value={form.cnpj || '—'} />
                <Row label="Razão social" value={form.razao || '—'} />
                <Row label="Documentos" value={`${docs.length} arquivo${docs.length === 1 ? '' : 's'}`} last />
              </View>

              <View className="mt-5 rounded-lg border border-gold-200 bg-gold/10 p-3">
                <Text className="text-xs text-silver-700">
                  Ao enviar, você concorda com os termos de parceria e com o tratamento dos seus dados
                  conforme nossa política de privacidade. A análise leva até 2 dias úteis.
                </Text>
              </View>

              <Pressable
                onPress={() => setDone(true)}
                className="mt-6 items-center rounded-lg bg-gold py-3.5 active:opacity-80"
              >
                <Text className="text-base font-bold text-white">Enviar para análise</Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Field({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
}) {
  return (
    <View>
      <Text className="mb-1.5 text-xs font-medium text-silver-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        className="rounded-lg border border-silver-300 px-3 py-3 text-sm text-silver-900"
      />
    </View>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between px-4 py-3 ${last ? '' : 'border-b border-silver-100'}`}>
      <Text className="text-xs uppercase tracking-wider text-silver-500">{label}</Text>
      <Text className="ml-3 flex-1 text-right text-sm font-semibold text-silver-900" numberOfLines={1}>{value}</Text>
    </View>
  )
}
