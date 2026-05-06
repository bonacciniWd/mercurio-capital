import { ScrollView, View, Text, Pressable, TextInput, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Search, AlertCircle, Upload } from 'lucide-react-native'
import { useState } from 'react'
import { StatusBadge } from '@/components/Badge'

export default function Protocolo() {
  const [code, setCode] = useState('MC-2024-0042')
  const [searched, setSearched] = useState(false)
  const steps = ['Recebida', 'Pré-análise', 'Análise', 'Comitê', 'Contrato', 'Liberado']
  const current = 2

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-navy px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <Text className="text-lg font-bold text-white">Acompanhar proposta</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <View className="items-center py-3">
          <Image source={require('../assets/general/proposal.jpg')} style={{ width: '100%', height: 220, borderRadius: 12 }} resizeMode="cover" />
        </View>

        <View className="rounded-2xl border border-silver-200 bg-white p-5">
          <Text className="text-xl font-bold text-navy">Acompanhe sua proposta</Text>
          <Text className="mt-1 text-sm text-silver-600">
            Sem necessidade de cadastro. Informe o número do protocolo.
          </Text>

          <View className="mt-5">
            <Text className="mb-1 text-xs font-medium text-silver-600">Número do protocolo</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="MC-2024-XXXXXX"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              className="rounded-lg border border-silver-200 bg-white px-3 py-2.5 font-mono text-sm text-silver-900"
            />
          </View>

          <View className="mt-3 rounded-lg border border-silver-200 bg-silver-50 p-3">
            <Text className="text-center text-xs text-silver-500">[ Verificação de segurança ]</Text>
          </View>

          <Pressable
            onPress={() => setSearched(true)}
            className="mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-gold py-3 active:opacity-80"
          >
            <Search size={16} color="#FFF" />
            <Text className="text-sm font-bold text-white">Consultar</Text>
          </Pressable>

          {searched && (
            <View className="mt-6 border-t border-silver-200 pt-5">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-[11px] text-silver-500">Protocolo</Text>
                  <Text className="font-mono font-semibold text-navy">{code}</Text>
                </View>
                <StatusBadge status="Análise de Crédito" />
              </View>

              <Text className="mt-5 text-sm font-medium text-silver-700">Andamento</Text>
              <View className="mt-2 flex-row gap-1.5">
                {steps.map((s, i) => (
                  <View key={s} className="flex-1">
                    <View className={`h-1.5 rounded-full ${i < current ? 'bg-success' : i === current ? 'bg-gold' : 'bg-silver-200'}`} />
                    <Text className={`mt-1.5 text-[10px] ${i <= current ? 'text-silver-900' : 'text-silver-400'}`} numberOfLines={1}>{s}</Text>
                  </View>
                ))}
              </View>

              <View className="mt-5 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <View className="flex-row gap-2">
                  <AlertCircle size={18} color="#F59E0B" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-silver-900">2 documentos solicitados</Text>
                    <View className="mt-3 gap-2">
                      <DocItem name="Comprovante de renda — últimos 3 meses" />
                      <DocItem name="Certidão de matrícula atualizada do imóvel" />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        <Text className="mt-2 text-center text-xs text-silver-500">
          Dúvidas? Entre em contato com seu parceiro.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function DocItem({ name }: { name: string }) {
  return (
    <View className="flex-row items-center justify-between rounded-md border border-silver-200 bg-white p-2.5">
      <Text className="flex-1 text-sm text-silver-800">{name}</Text>
      <Pressable className="flex-row items-center gap-1 rounded-md border border-silver-300 px-2.5 py-1.5 active:bg-silver-100">
        <Upload size={12} color="#0F0F0F" />
        <Text className="text-[11px] font-bold text-navy">Enviar</Text>
      </Pressable>
    </View>
  )
}
