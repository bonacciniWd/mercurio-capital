import { useEffect, useState } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { Lock, CheckCircle2, Trophy, InfoIcon } from 'lucide-react-native'
import { SvgUri } from 'react-native-svg'
import { Asset } from 'expo-asset'
import { useQuery } from '@tanstack/react-query'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { PartnerScreen, PartnerCard, PartnerBody, PartnerFeedback } from '@/components/parceiro/PartnerUI'

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
type Milestone = { id: string; target_centavos: number; label: string; prize: string; descricao: string | null; color: string; image_url: string | null; svgModule?: number }
const FALLBACK_MILESTONES: Milestone[] = [
  {
    id: 'fallback-1', target_centavos: 500_000_000,
    label: 'R$ 5 Milhões',
    prize: 'Rolex Oyster Perpetual',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    svgModule: require('../../assets/milestones/prem1.svg'),
    descricao: 'Conquiste R$ 5M em liberações CGI e ganhe um Rolex.', image_url: null,
    color: '#DC2626',
  },
  {
    id: 'fallback-2', target_centavos: 5_000_000_000,
    label: 'R$ 50 Milhões',
    prize: 'BMW 330e M Sport',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    svgModule: require('../../assets/milestones/prem2.svg'),
    descricao: 'Performance híbrida e luxo. Libere R$ 50M e ganhe um BMW 330e.', image_url: null,
    color: '#737373',
  },
  {
    id: 'fallback-3', target_centavos: 10_000_000_000,
    label: 'R$ 100 Milhões',
    prize: 'Corvette C8',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    svgModule: require('../../assets/milestones/prem3.svg'),
    descricao: 'O ápice. Libere R$ 100M e conquiste um Corvette C8.', image_url: null,
    color: '#F87171',
  },
]

export default function Promocoes() {
  const progressQ = useQuery({
    queryKey: ['p-milestones-progress'],
    queryFn: async () => {
      const [{ data: progress, error: progressError }, { data: milestones, error: milestonesError }] = await Promise.all([
        supabase.rpc('partner_milestones_progress'),
        supabase.from('partner_milestones').select('id, target_centavos, label, prize, descricao, color, image_url').eq('ativo', true).order('order_index'),
      ])
      if (progressError) throw progressError
      if (milestonesError) throw milestonesError
      return { volume: Number((progress as { volume_solicitado?: number | string } | null)?.volume_solicitado ?? 0), milestones: (milestones ?? []) as Milestone[] }
    },
  })

  const CURRENT_CGI = progressQ.data?.volume ?? CURRENT_CGI_FALLBACK
  const milestones = progressQ.data?.milestones?.length ? progressQ.data.milestones : FALLBACK_MILESTONES
  const maxTarget = Math.max(...milestones.map(m => m.target_centavos), 1)
  const overallPct = Math.min(100, (CURRENT_CGI / maxTarget) * 100)
  return (
    <PartnerScreen title="Promoções" subtitle="Metas e reconhecimento para parceiros">
      <View className="rounded-3xl border border-[#2D2D32] bg-[#151518] p-5">
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

      {progressQ.isError ? <PartnerFeedback title="Não foi possível carregar as metas" text={(progressQ.error as Error).message} retry={() => progressQ.refetch()} /> : null}
      {!progressQ.isError ? <>
        <PartnerCard>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs uppercase tracking-wider text-silver-500">Como funciona</Text>
            <InfoIcon size={14} color="#737373" />
          </View>
          <PartnerBody>
            Cada R$ 1 liberado em CGI conta para todas as metas. Os prêmios são entregues em até 90 dias após
            atingir o marco. Consulte regulamento completo com seu gerente.
          </PartnerBody>
        </PartnerCard>
            {milestones.map((m, index) => {
          const unlocked = CURRENT_CGI >= m.target_centavos
          const progress = Math.min(100, (CURRENT_CGI / m.target_centavos) * 100)
          return (
            <View
              key={m.id}
              className="overflow-hidden rounded-2xl border p-5"
              style={{ borderColor: m.color + '55', position: 'relative' }}
            >
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require('../../assets/cardbg.jpg')}
                resizeMode="cover"
                style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                accessibilityIgnoresInvertColors
              />
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
                <MilestoneSvg module={FALLBACK_MILESTONES[index % FALLBACK_MILESTONES.length].svgModule} height={160} opacity={unlocked ? 1 : 0.6} />
              </View>

              <Text className="text-lg font-bold text-white">{m.prize}</Text>
              <Text className="mt-1 text-xs leading-relaxed text-white/50">{m.descricao ?? 'Meta configurada pela Mercúrio Capital.'}</Text>

              <View className="mt-4">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-[11px] text-white/40">{brl(Math.min(CURRENT_CGI, m.target_centavos))} liberados</Text>
                  <Text className="text-[11px] font-semibold" style={{ color: m.color }}>
                    {progress >= 100 ? '100%' : `${progress.toFixed(1)}%`}
                  </Text>
                </View>
                <View className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: m.color }} />
                </View>
                <Text className="mt-1 text-right text-[10px] text-white/30">Meta: {brl(m.target_centavos)}</Text>
              </View>
            </View>
          )
        })}

      </> : null}
    </PartnerScreen>
  )
}
