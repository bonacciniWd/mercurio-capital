import { useEffect, useState } from 'react'
import { ScrollView, View, Text, ImageBackground } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Lock, CheckCircle2, Trophy, InfoIcon } from 'lucide-react-native'
import { SvgUri } from 'react-native-svg'
import { Asset } from 'expo-asset'
import { useQuery } from '@tanstack/react-query'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MilestoneSvg({ module: mod, height, opacity }: { module: any; height: number; opacity: number }) {
  const [uri, setUri] = useState<string | null>(null)
  useEffect(() => {
    Asset.fromModule(mod)
      .downloadAsync()
      .then((a) => setUri(a.localUri ?? a.uri))
      .catch(() => {})
  }, [mod])
  if (!uri) return <View style={{ height, width: '100%' }} />
  return <SvgUri uri={uri} width="100%" height={height} style={{ opacity }} />
}

const CURRENT_CGI_FALLBACK = 0

const MILESTONES = [
  {
    target: 500_000_000,
    label: 'R$ 5 Milhões',
    prize: 'Rolex Oyster Perpetual',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    svgModule: require('../../assets/milestones/prem1.svg'),
    desc: 'Conquiste R$ 5M em liberações CGI e ganhe um Rolex.',
    color: '#DC2626',
  },
  {
    target: 5_000_000_000,
    label: 'R$ 50 Milhões',
    prize: 'BMW 330e M Sport',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    svgModule: require('../../assets/milestones/prem2.svg'),
    desc: 'Performance híbrida e luxo. Libere R$ 50M e ganhe um BMW 330e.',
    color: '#737373',
  },
  {
    target: 10_000_000_000,
    label: 'R$ 100 Milhões',
    prize: 'Corvette C8',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    svgModule: require('../../assets/milestones/prem3.svg'),
    desc: 'O ápice. Libere R$ 100M e conquiste um Corvette C8.',
    color: '#F87171',
  },
]

export default function Promocoes() {
  const cgiQ = useQuery({
    queryKey: ['p-cgi-volume'],
    queryFn: async () => {
      // Soma volume das propostas com status de liberação (centavos)
      const { data, error } = await supabase
        .from('v_partner_funil_status')
        .select('status, volume')
      if (error) throw error
      const liberados = (data ?? []).filter((r: { status: string; volume: number }) =>
        r.status === 'recurso_liberado' || r.status === 'contrato_registrado',
      )
      const totalReais = liberados.reduce((acc, r) => acc + Number(r.volume), 0)
      return Math.round(totalReais * 100) // converter para centavos
    },
  })

  const CURRENT_CGI = cgiQ.data ?? CURRENT_CGI_FALLBACK
  const overallPct = Math.min(100, (CURRENT_CGI / 10_000_000_000) * 100)
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-navy px-5 py-5">
        <View className="flex-row items-center gap-2">
          <Trophy size={20} color="#FFD700" />
          <Text className="text-xs uppercase tracking-wider text-[#FFD700]">Programa de Milestones</Text>
        </View>
        <Text className="mt-1 text-2xl font-bold text-white">Conquiste seus prêmios</Text>
        <Text className="mt-1 text-sm text-white/70">
          Quanto mais CGI você libera, maiores as recompensas.
        </Text>

        <View className="mt-4">
          <View className="mb-1.5 flex-row items-center justify-between">
            <Text className="text-xs text-white/70">Progresso geral</Text>
            <Text className="text-xs font-semibold text-gold">{overallPct.toFixed(1)}%</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-white/10">
            <View className="h-full rounded-full bg-gold" style={{ width: `${overallPct}%` }} />
          </View>
          <Text className="mt-1.5 text-[11px] text-white/50">
            {brl(CURRENT_CGI)} de {brl(10_000_000_000)} liberados
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 130 }}>
        <View className="mt-2 rounded-xl border border-silver-200 bg-white p-4">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs uppercase tracking-wider text-silver-500">Como funciona</Text>
            <InfoIcon size={14} color="#737373" />
          </View>
          <Text className="mt-2 text-sm leading-relaxed text-silver-700">
            Cada R$ 1 liberado em CGI conta para todas as metas. Os prêmios são entregues em até 90 dias após
            atingir o marco. Consulte regulamento completo com seu gerente.
          </Text>
        </View>
        {MILESTONES.map((m) => {
          const unlocked = CURRENT_CGI >= m.target
          const progress = Math.min(100, (CURRENT_CGI / m.target) * 100)
          return (
            <ImageBackground
              key={m.label}
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../assets/cardbg.jpg')}
              imageStyle={{ borderRadius: 16 }}
              className="overflow-hidden rounded-2xl border p-5"
              style={{ borderColor: m.color + '55' }}
            >
              {/* máscara escura sobre a imagem de fundo */}
              <View
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.72)',
                  borderRadius: 16,
                }}
              />
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] font-bold uppercase tracking-widest" style={{ color: m.color }}>
                  {m.label}
                </Text>
                {unlocked ? (
                  <View
                    className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
                    style={{ backgroundColor: m.color + '22', borderWidth: 1, borderColor: m.color + '55' }}
                  >
                    <CheckCircle2 size={12} color={m.color} />
                    <Text className="text-[10px] font-bold uppercase" style={{ color: m.color }}>Conquistado</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1">
                    <Lock size={12} color="rgba(255,255,255,0.4)" />
                    <Text className="text-[11px] text-white/40">Bloqueado</Text>
                  </View>
                )}
              </View>

              <View className="my-4 w-full">
                <MilestoneSvg module={m.svgModule} height={160} opacity={unlocked ? 1 : 0.6} />
              </View>

              <Text className="text-lg font-bold text-white">{m.prize}</Text>
              <Text className="mt-1 text-xs leading-relaxed text-white/50">{m.desc}</Text>

              <View className="mt-4">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-[11px] text-white/40">{brl(Math.min(CURRENT_CGI, m.target))} liberados</Text>
                  <Text className="text-[11px] font-semibold" style={{ color: m.color }}>
                    {progress >= 100 ? '100%' : `${progress.toFixed(1)}%`}
                  </Text>
                </View>
                <View className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: m.color }} />
                </View>
                <Text className="mt-1 text-right text-[10px] text-white/30">Meta: {brl(m.target)}</Text>
              </View>
            </ImageBackground>
          )
        })}

        
      </ScrollView>
    </SafeAreaView>
  )
}
