import { useState } from 'react'
import { ScrollView, View, Text, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react-native'
import { brl } from '@/lib/utils'

const STEPS = ['Produto', 'Cliente', 'Local', 'Crédito', 'Proponentes', 'Imóvel', 'Revisão']

export default function NovaProposta() {
  const [step, setStep] = useState(0)
  const next = () => step < STEPS.length - 1 ? setStep(s => s + 1) : router.back()
  const prev = () => step > 0 ? setStep(s => s - 1) : router.back()

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header com close + progress */}
      <View className="border-b border-silver-200 bg-white px-5 py-3">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <X size={24} color="#0F0F0F" />
          </Pressable>
          <Text className="text-sm font-medium text-silver-700">Passo {step + 1} de {STEPS.length}</Text>
          <View className="w-10" />
        </View>
        {/* Progress bar */}
        <View className="mt-2 h-1 overflow-hidden rounded-full bg-silver-200">
          <View className="h-full rounded-full bg-gold" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </View>
        <Text className="mt-2 text-lg font-bold text-navy">{STEPS[step]}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
        {step === 0 && <Step0 />}
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
        {step === 5 && <Step5 />}
        {step === 6 && <Step6 />}
      </ScrollView>

      {/* Bottom nav */}
      <View className="flex-row gap-2 border-t border-silver-200 bg-white px-8 py-3">
        <Pressable onPress={prev} className="flex-row items-center gap-1 rounded-lg border border-silver-300 px-5 py-3">
          <ChevronLeft size={18} color="#0F0F0F" />
          <Text className="font-semibold text-navy">Voltar</Text>
        </Pressable>
        <Pressable onPress={next} className="flex-1 flex-row items-center justify-center gap-1 rounded-lg bg-gold py-3">
          <Text className="font-bold text-white">{step === STEPS.length - 1 ? 'Concluir' : 'Próximo'}</Text>
          {step === STEPS.length - 1 ? <Check size={18} color="#FFFFFF" /> : <ChevronRight size={18} color="#FFFFFF" />}
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function Step0() {
  return (
    <>
      <Text className="text-sm text-silver-600">Selecione o produto desejado</Text>
      {[
        ['Home Equity', 'Crédito com garantia de imóvel', 'até 60% LTV'],
        ['Construção', 'Financiamento para construir', 'até 80% obra'],
        ['Financiamento', 'Aquisição financiada', 'até 70% LTV'],
      ].map(([t, d, h]) => (
        <Pressable key={t} className="rounded-xl border-2 border-silver-200 bg-white p-4 active:border-gold">
          <Text className="font-bold text-navy">{t}</Text>
          <Text className="mt-1 text-sm text-silver-600">{d}</Text>
          <Text className="mt-2 text-xs font-medium text-gold-600">{h}</Text>
        </Pressable>
      ))}
    </>
  )
}

function Step1() {
  return (
    <>
      <Field label="CPF do cliente" placeholder="000.000.000-00" />
      <Field label="Nome completo" placeholder="João Silva" />
      <Field label="E-mail" placeholder="joao@email.com" />
      <Field label="Telefone" placeholder="(11) 9 0000-0000" />
    </>
  )
}

function Step2() {
  return (
    <>
      <Field label="CEP do imóvel" placeholder="00000-000" />
      <Field label="Cidade / UF" placeholder="São Paulo / SP" />
      <Field label="Endereço" placeholder="Av. Paulista, 1000" />
    </>
  )
}

function Step3() {
  return (
    <>
      <Field label="Valor solicitado" placeholder="R$ 350.000,00" />
      <Field label="Prazo (meses)" placeholder="180" />
      <Field label="Sistema" placeholder="Price" />
      <View className="mt-3 rounded-xl bg-silver-50 p-4">
        <Text className="text-xs uppercase text-silver-500">Simulação</Text>
        <Text className="mt-1 text-2xl font-bold text-navy">{brl(458000)}</Text>
        <Text className="text-xs text-silver-500">parcela mensal estimada</Text>
      </View>
    </>
  )
}

function Step4() {
  return (
    <>
      <View className="rounded-xl border border-warning/30 bg-warning/5 p-4">
        <Text className="text-sm font-medium text-warning">⚠️ Cliente é casado em comunhão</Text>
        <Text className="mt-1 text-xs text-silver-700">Cônjuge precisa ser proponente também.</Text>
      </View>
      <Pressable className="rounded-lg border border-dashed border-silver-300 p-4">
        <Text className="text-center text-sm font-medium text-gold-600">+ Adicionar cônjuge</Text>
      </Pressable>
    </>
  )
}

function Step5() {
  return (
    <>
      <Field label="Tipo do imóvel" placeholder="Apartamento" />
      <Field label="Área (m²)" placeholder="120" />
      <Field label="Valor de avaliação" placeholder={brl(72500000)} />
      <View className="rounded-xl bg-success/10 p-4">
        <Text className="text-sm font-medium text-success">LTV estimado: 48%</Text>
      </View>
    </>
  )
}

function Step6() {
  return (
    <>
      <Text className="text-sm text-silver-600">Confira os dados antes de enviar</Text>
      {STEPS.slice(0, -1).map((s, i) => (
        <View key={s} className="rounded-xl border border-silver-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold text-navy">{i + 1}. {s}</Text>
            <Text className="text-xs font-medium text-gold-600">Editar</Text>
          </View>
          <Text className="mt-1 text-sm text-silver-600">Resumo dos dados deste passo…</Text>
        </View>
      ))}
    </>
  )
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <View>
      <Text className="mb-1.5 text-xs font-medium text-silver-700">{label}</Text>
      <TextInput placeholder={placeholder} className="rounded-lg border border-silver-300 px-3 py-3 text-sm text-silver-900" />
    </View>
  )
}
