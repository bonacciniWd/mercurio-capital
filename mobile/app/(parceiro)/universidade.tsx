import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Award, PlayCircle, Lock } from 'lucide-react-native'
import { Badge } from '@/components/Badge'

const cursos = [
  { id: 1, titulo: 'Fundamentos do Crédito Imobiliário', cat: 'Crédito', nivel: 'Iniciante', progresso: 65, locked: false },
  { id: 2, titulo: 'Vendas Consultivas para Parceiros', cat: 'Vendas', nivel: 'Intermediário', progresso: 30, locked: false },
  { id: 3, titulo: 'Análise de Risco Avançada', cat: 'Crédito', nivel: 'Avançado', progresso: 0, locked: true },
  { id: 4, titulo: 'Documentação para Construção', cat: 'Operacional', nivel: 'Intermediário', progresso: 100, locked: false },
]

export default function Universidade() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Hero */}
        <View className="bg-navy-700 px-5 pb-6 pt-4">
          <Text className="text-xs uppercase tracking-wider text-gold">Universidade Mercurio</Text>
          <Text className="mt-1 text-2xl font-bold text-white">Aprenda no seu ritmo</Text>
          <Text className="mt-1 text-sm text-white/70">12 cursos · 3 certificados conquistados</Text>
        </View>

        {/* Stats */}
        <View className="-mt-4 flex-row gap-3 px-5">
          <View className="flex-1 rounded-xl bg-white p-3 shadow-sm">
            <Text className="text-xs text-silver-500">Em andamento</Text>
            <Text className="text-2xl font-bold text-navy">2</Text>
          </View>
          <View className="flex-1 rounded-xl bg-white p-3 shadow-sm">
            <Text className="text-xs text-silver-500">Concluídos</Text>
            <Text className="text-2xl font-bold text-success">3</Text>
          </View>
          <View className="flex-1 rounded-xl bg-gold/10 p-3">
            <Text className="text-xs text-gold-600">Certificados</Text>
            <Text className="text-2xl font-bold text-gold-600">3</Text>
          </View>
        </View>

        {/* Lista cursos */}
        <View className="px-5 pt-5">
          <Text className="text-base font-bold text-navy">Cursos disponíveis</Text>
          <View className="mt-2 gap-3">
            {cursos.map(c => (
              <Pressable key={c.id} className="overflow-hidden rounded-xl border border-silver-200 bg-white active:opacity-70">
                {/* Capa placeholder */}
                <View className="h-32 items-center justify-center bg-navy-50">
                  {c.locked
                    ? <Lock size={32} color="#9CA3AF" />
                    : <PlayCircle size={32} color="#D4AF37" />}
                </View>
                <View className="p-4">
                  <View className="flex-row items-center gap-2">
                    <Badge variant="gray">{c.cat}</Badge>
                    <Badge variant={c.nivel === 'Avançado' ? 'red' : c.nivel === 'Intermediário' ? 'amber' : 'green'}>{c.nivel}</Badge>
                  </View>
                  <Text className="mt-2 font-semibold text-navy">{c.titulo}</Text>
                  {c.progresso > 0 && (
                    <View className="mt-3">
                      <View className="h-1.5 overflow-hidden rounded-full bg-silver-200">
                        <View className="h-full rounded-full bg-gold" style={{ width: `${c.progresso}%` }} />
                      </View>
                      <Text className="mt-1 text-xs text-silver-500">{c.progresso}% concluído</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Certificados */}
        <View className="px-5 pt-5">
          <Text className="text-base font-bold text-navy">Meus certificados</Text>
          <View className="mt-2 flex-row items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4">
            <Award size={32} color="#D4AF37" />
            <View className="flex-1">
              <Text className="font-semibold text-navy">3 certificados conquistados</Text>
              <Text className="text-xs text-silver-600">Toque para baixar PDFs</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
