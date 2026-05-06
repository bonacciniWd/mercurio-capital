import { ScrollView, View, Text, Pressable, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Award, PlayCircle, Lock } from 'lucide-react-native'
import { Badge } from '@/components/Badge'

const cursos = [
  {
    id: 1,
    titulo: 'Fundamentos do Crédito Imobiliário',
    cat: 'Crédito',
    nivel: 'Iniciante',
    progresso: 65,
    locked: false,
    cover: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80',
  },
  {
    id: 2,
    titulo: 'Vendas Consultivas para Parceiros',
    cat: 'Vendas',
    nivel: 'Intermediário',
    progresso: 30,
    locked: false,
    cover: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&q=80',
  },
  {
    id: 3,
    titulo: 'Análise de Risco Avançada',
    cat: 'Crédito',
    nivel: 'Avançado',
    progresso: 0,
    locked: true,
    cover: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80',
  },
  {
    id: 4,
    titulo: 'Documentação para Construção',
    cat: 'Operacional',
    nivel: 'Intermediário',
    progresso: 100,
    locked: false,
    cover: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80',
  },
]

export default function Universidade() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Hero */}
        <View className="bg-navy-700 px-5 pb-6 pt-4">
          <Text className="text-xs uppercase tracking-wider text-gold">Universidade Mercurio</Text>
          <Text className="mt-1 text-2xl font-bold text-white">Aprenda no seu ritmo</Text>
          <Image source={require('../../assets/general/university.png')} className=" absolute right-5 -top-2 h-36 w-36 flex-1 rounded-lg" resizeMode="cover" />
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
          <View className="flex-1 rounded-xl bg-gold p-3">
            <Text className="text-xs text-white">Certificados</Text>
            <Text className="text-2xl font-bold text-white">3</Text>
          </View>
        </View>

        {/* Lista cursos */}
        <View className="px-5 pt-5">
          <Text className="text-base font-bold text-navy">Cursos disponíveis</Text>
          <View className="mt-2 gap-3">
            {cursos.map(c => (
              <Pressable
                key={c.id}
                onPress={() => !c.locked && router.push(`/(parceiro)/aula/${c.id}` as any)}
                className="overflow-hidden rounded-xl border border-silver-200 bg-white active:opacity-70"
              >
                {/* Capa */}
                <View className="h-52 overflow-hidden">
                  <Image
                    source={{ uri: c.cover }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  {/* overlay escuro + ícone */}
                  <View
                    className="absolute inset-0 items-center justify-center"
                    style={{ backgroundColor: c.locked ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)' }}
                  >
                    {c.locked
                      ? <Lock size={32} color="white" />
                      : <View className="h-12 w-12 items-center justify-center rounded-full bg-gold/90">
                          <PlayCircle size={28} color="white" />
                        </View>
                    }
                  </View>
                  {c.progresso === 100 && (
                    <View className="absolute right-3 top-3 rounded-full bg-success px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-white">CONCLUÍDO</Text>
                    </View>
                  )}
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
            <Award size={32} color="#DC2626" />
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
