import { ScrollView, View, Text, Pressable, ImageBackground, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { CheckCircle2, Circle, Clock, Upload, MessageCircle, AlertCircle } from 'lucide-react-native'
import { brl } from '@/lib/utils'

const steps = [
  { label: 'Proposta criada', date: '03/04', done: true },
  { label: 'Pré-análise aprovada', date: '04/04', done: true },
  { label: 'Documentos enviados', date: '06/04', done: true },
  { label: 'Análise de crédito', date: 'em andamento', done: false, current: true },
  { label: 'Comitê', date: '—', done: false },
  { label: 'Assinatura', date: '—', done: false },
  { label: 'Recurso liberado', date: '—', done: false },
]

export default function ClienteHome() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header com imagem de fundo */}
        <ImageBackground
          source={require('../../assets/general/clientcard.jpg')}
          style={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16 }}
          imageStyle={{ resizeMode: 'cover' }}
        >
          {/* overlay escuro */}
          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(10,20,40,0.0)' }} />

          <Text className="text-xs uppercase tracking-wider text-gold">Sua proposta</Text>
          <Text className="mt-1 font-mono text-xs text-white/60">MC-2024-0042</Text>
          <Text className="mt-2 text-2xl font-bold text-white">Olá, Roberto O'Lerit</Text>
          <Text className="mt-1 text-sm text-white/70">Acompanhe aqui o andamento do seu crédito.</Text>

          <Image source={require('../../assets/general/clientlogo.png')} className="absolute -top-2 -right-2" style={{ width: 180, height: 180 , opacity: 0.6 }} />
       
          <View className="mt-4 rounded-xl border-[0.5px] border-gold bg-white/10 p-4">
            <Text className="text-xs text-white/70">Valor solicitado</Text>
            <Text className="mt-1 text-3xl font-bold text-white">{brl(35000000)}</Text>
            <Text className="text-xs text-white/70">180 meses · 1,15% a.m.</Text>
          </View>
        </ImageBackground>

        {/* Pendência */}
        <View className="mx-5 mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4">
          <View className="flex-row items-center gap-2">
            <AlertCircle size={20} color="#ff0000" />
            <Text className="font-bold text-gold">1 documento pendente</Text>
          </View>
          <Text className="mt-1 text-sm text-silver-700">Comprovante de renda atualizado</Text>
          <Pressable
            onPress={() => router.push('/(cliente)/documentos')}
            className="mt-3 self-start rounded-lg bg-gold px-4 py-2"
          >
            <Text className="text-sm font-bold text-white">Enviar agora</Text>
          </Pressable>
        </View>

        {/* Timeline */}
        <View className="px-5 pt-5">
          <Text className="text-base font-bold text-navy">Andamento</Text>
          <View className="mt-3 rounded-xl border border-silver-200 bg-white p-4">
            {steps.map((s, i) => (
              <View key={s.label} className="flex-row gap-3">
                <View className="items-center">
                  {s.done ? <CheckCircle2 size={20} color="#16A34A" /> :
                   s.current ? <Clock size={20} color="#DC2626" /> :
                   <Circle size={20} color="#CED4DA" />}
                  {i < steps.length - 1 && (
                    <View className={`my-1 h-8 w-0.5 ${s.done ? 'bg-success' : 'bg-silver-200'}`} />
                  )}
                </View>
                <View className="flex-1 pb-2">
                  <Text className={`text-sm font-semibold ${s.current ? 'text-gold-600' : s.done ? 'text-silver-900' : 'text-silver-400'}`}>
                    {s.label}
                  </Text>
                  <Text className="text-xs text-silver-500">{s.date}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Ações */}
        <View className="flex-row gap-2 px-5 pt-4">
          <Pressable
            onPress={() => router.push('/(cliente)/documentos')}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-silver-300 bg-white py-3"
          >
            <Upload size={18} color="#0F0F0F" />
            <Text className="font-semibold text-navy">Documentos</Text>
          </Pressable>
          <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-success py-3">
            <MessageCircle size={18} color="white" />
            <Text className="font-semibold text-white">WhatsApp</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/(cliente)/universidade' as any)}
          className="mx-5 mt-3 flex-row items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4 active:opacity-80"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-gold/15">
            <Text className="text-base">🎓</Text>
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-navy">Universidade Mercurio</Text>
            <Text className="text-xs text-silver-600">Educação financeira premium</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
