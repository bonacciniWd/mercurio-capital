import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, FileText, CheckCircle2, Camera, Upload } from 'lucide-react-native'
import { Badge } from '@/components/Badge'

const docs = [
  { name: 'RG', status: 'aprovado' },
  { name: 'CPF', status: 'aprovado' },
  { name: 'Comprovante de renda', status: 'pendente' },
  { name: 'IRPF 2024', status: 'enviado' },
  { name: 'Matrícula do imóvel', status: 'pendente' },
] as const

export default function Documentos() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-white px-5 pb-3 pt-2">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="#0F0F0F" />
          </Pressable>
          <Text className="text-lg font-bold text-navy">Documentos</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {docs.map(d => (
          <View key={d.name} className="flex-row items-center gap-3 rounded-xl border border-silver-200 bg-white p-4">
            <View className={`h-10 w-10 items-center justify-center rounded-lg ${
              d.status === 'aprovado' ? 'bg-success/15' :
              d.status === 'enviado' ? 'bg-warning/15' : 'bg-silver-100'
            }`}>
              {d.status === 'aprovado' ? <CheckCircle2 size={20} color="#16A34A" /> : <FileText size={20} color="#9CA3AF" />}
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-silver-900">{d.name}</Text>
              <Badge variant={d.status === 'aprovado' ? 'green' : d.status === 'enviado' ? 'amber' : 'gray'}>
                {d.status === 'aprovado' ? 'Aprovado' : d.status === 'enviado' ? 'Em análise' : 'Pendente'}
              </Badge>
            </View>
            {d.status === 'pendente' && (
              <Pressable
                onPress={() => router.push('/camera')}
                className="rounded-lg bg-gold px-3 py-2"
              >
                <Text className="text-xs font-bold text-white">Enviar</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom actions */}
      <View className="flex-row gap-2 border-t mb-2 border-silver-200 bg-white px-6 py-3">
        <Pressable
          onPress={() => router.push('/camera')}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-navy-700 py-3"
        >
          <Camera size={18} color="white" />
          <Text className="font-bold text-white">Câmera</Text>
        </Pressable>
        <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-silver-300 py-3">
          <Upload size={18} color="#0F0F0F" />
          <Text className="font-bold text-navy">Galeria</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
