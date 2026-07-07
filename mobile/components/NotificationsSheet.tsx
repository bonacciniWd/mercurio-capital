import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Bell, Check, CheckCheck, X } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { resolveNotificationLinkToRoute } from '@/lib/notificationLinks'

interface Notificacao {
  id: string
  titulo: string
  mensagem: string
  link: string | null
  lida_em: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

interface NotificationsSheetProps {
  variant?: 'dark' | 'light'
  iconSize?: number
  onOpenLink?: (route: string, originalLink: string) => void
}

const PAGE_SIZE = 40

function queryKey(userId?: string) {
  return ['mobile-notificacoes', userId] as const
}

function formatDateTime(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''

  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')

  return `${dd}/${mm} ${hh}:${min}`
}

export function NotificationsSheet({
  variant = 'dark',
  iconSize = 22,
  onOpenLink,
}: NotificationsSheetProps) {
  const insets = useSafeAreaInsets()
  const { session } = useAuth()
  const userId = session?.userId
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const notifsQ = useQuery({
    queryKey: queryKey(userId),
    enabled: !!userId,
    refetchInterval: userId ? 60_000 : false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!userId) return []

      const { data, error } = await supabase
        .from('notificacoes')
        .select('id, titulo, mensagem, link, lida_em, created_at, metadata')
        .eq('usuario_id', userId)
        .eq('canal', 'in_app')
        .order('lida_em', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (error) throw error
      return (data ?? []) as Notificacao[]
    },
  })

  const notificacoes = notifsQ.data ?? []
  const unreadCount = useMemo(
    () => notificacoes.reduce((acc, n) => acc + (n.lida_em == null ? 1 : 0), 0),
    [notificacoes],
  )

  useEffect(() => {
    if (!userId) return

    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: queryKey(userId) })
    }

    const channel = supabase
      .channel(`mobile-notif-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${userId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${userId}` },
        invalidate,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') invalidate()
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc, userId])

  const markOne = useMutation<
    void,
    Error,
    string,
    { previous: Notificacao[] }
  >({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('notificacao_marcar_lida', { p_id: id })
      if (error) throw error
    },
    onMutate: async (id: string) => {
      if (!userId) return { previous: [] }

      await qc.cancelQueries({ queryKey: queryKey(userId) })
      const previous = qc.getQueryData<Notificacao[]>(queryKey(userId)) ?? []

      qc.setQueryData<Notificacao[]>(
        queryKey(userId),
        previous.map((n) => (n.id === id && n.lida_em == null
          ? { ...n, lida_em: new Date().toISOString() }
          : n)),
      )

      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (!userId || !ctx) return
      qc.setQueryData(queryKey(userId), ctx.previous)
    },
    onSettled: () => {
      if (!userId) return
      void qc.invalidateQueries({ queryKey: queryKey(userId) })
    },
  })

  const markAll = useMutation<
    void,
    Error,
    void,
    { previous: Notificacao[] }
  >({
    mutationFn: async () => {
      const { error } = await supabase.rpc('notificacao_marcar_todas_lidas')
      if (error) throw error
    },
    onMutate: async () => {
      if (!userId) return { previous: [] }

      await qc.cancelQueries({ queryKey: queryKey(userId) })
      const previous = qc.getQueryData<Notificacao[]>(queryKey(userId)) ?? []
      const now = new Date().toISOString()

      qc.setQueryData<Notificacao[]>(
        queryKey(userId),
        previous.map((n) => (n.lida_em == null ? { ...n, lida_em: now } : n)),
      )

      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (!userId || !ctx) return
      qc.setQueryData(queryKey(userId), ctx.previous)
    },
    onSettled: () => {
      if (!userId) return
      void qc.invalidateQueries({ queryKey: queryKey(userId) })
    },
  })

  const triggerIsDark = variant === 'dark'

  function handleOpenLink(id: string, originalLink: string, unread: boolean) {
    if (unread) markOne.mutate(id)

    const route = resolveNotificationLinkToRoute(originalLink, session?.role)

    if (onOpenLink) onOpenLink(route, originalLink)
    else router.push(route as any)

    setOpen(false)
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[s.trigger, triggerIsDark ? s.triggerDark : s.triggerLight]}
        accessibilityRole="button"
        accessibilityLabel="Notificacoes"
      >
        <Bell size={iconSize} color={triggerIsDark ? '#FFFFFF' : '#334155'} />
        {unreadCount > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.modalRoot}>
          <Pressable style={s.backdrop} onPress={() => setOpen(false)} />

          <View
            style={[
              s.sheet,
              triggerIsDark ? s.sheetDark : s.sheetLight,
              { paddingBottom: Math.max(insets.bottom + 8, 16) },
            ]}
          >
            <View style={s.handle} />

            <View style={s.header}>
              <View>
                <Text style={s.title}>Notificacoes</Text>
                <Text style={s.subtitle}>{unreadCount} nao lida(s)</Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                style={s.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Fechar notificacoes"
              >
                <X size={16} color="#94A3B8" />
              </Pressable>
            </View>

            {unreadCount > 0 ? (
              <Pressable
                onPress={() => markAll.mutate()}
                style={[s.markAllBtn, markAll.isPending && s.disabled]}
                disabled={markAll.isPending}
              >
                {markAll.isPending ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <CheckCheck size={14} color="#DC2626" />
                    <Text style={s.markAllText}>Marcar todas como lidas</Text>
                  </>
                )}
              </Pressable>
            ) : null}

            {notifsQ.isLoading ? (
              <View style={s.loadingWrap}>
                <ActivityIndicator color="#DC2626" />
              </View>
            ) : notificacoes.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyTitle}>Sem notificacoes</Text>
                <Text style={s.emptySub}>As novas atualizacoes in-app aparecerao aqui.</Text>
              </View>
            ) : (
              <FlatList
                data={notificacoes}
                keyExtractor={(item) => item.id}
                style={s.list}
                contentContainerStyle={s.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const unread = item.lida_em == null

                  return (
                    <View style={[s.item, unread && s.itemUnread]}>
                      <View style={s.itemBody}>
                        <Text style={s.itemTitle} numberOfLines={1}>{item.titulo}</Text>
                        <Text style={s.itemMessage} numberOfLines={3}>{item.mensagem}</Text>
                        <Text style={s.itemTime}>{formatDateTime(item.created_at)}</Text>

                        {item.link ? (
                          <Pressable
                            onPress={() => {
                              handleOpenLink(item.id, item.link as string, unread)
                            }}
                            style={s.openLinkBtn}
                          >
                            <Text style={s.openLinkText}>Abrir detalhe</Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {unread ? (
                        <Pressable
                          onPress={() => markOne.mutate(item.id)}
                          style={[s.markOneBtn, markOne.isPending && s.disabled]}
                          disabled={markOne.isPending}
                          accessibilityRole="button"
                          accessibilityLabel="Marcar como lida"
                        >
                          <Check size={14} color="#475569" />
                        </Pressable>
                      ) : (
                        <View style={s.readPill}>
                          <Text style={s.readPillText}>Lida</Text>
                        </View>
                      )}
                    </View>
                  )
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  triggerLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.58)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  sheetDark: {
    backgroundColor: '#0F172A',
    borderTopColor: '#334155',
  },
  sheetLight: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#64748B',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B1220',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DC262650',
    backgroundColor: '#DC262615',
    paddingVertical: 10,
    marginBottom: 10,
  },
  markAllText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#263244',
    backgroundColor: '#111B2D',
    padding: 12,
    marginBottom: 8,
  },
  itemUnread: {
    borderColor: '#DC26266E',
    backgroundColor: '#3A1219',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  itemMessage: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  itemTime: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 6,
  },
  openLinkBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  openLinkText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  markOneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B1220',
  },
  readPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1220',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  readPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  emptyWrap: {
    paddingVertical: 28,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
})
