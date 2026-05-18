import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'

interface Notif {
  id: string
  titulo: string
  mensagem: string
  link: string | null
  lida_em: string | null
  created_at: string
  metadata: Record<string, unknown>
}

export function NotificationBell() {
  const { session } = useAuth()
  const userId = session?.id
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const { data: notifs, isLoading } = useQuery({
    queryKey: ['notificacoes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('id, titulo, mensagem, link, lida_em, created_at, metadata')
        .eq('canal', 'in_app')
        .order('lida_em', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as Notif[]
    },
  })

  const naoLidas = (notifs ?? []).filter((n) => n.lida_em == null).length

  // Realtime
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${userId}` },
        () => { qc.invalidateQueries({ queryKey: ['notificacoes', userId] }) },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId, qc])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('notificacao_marcar_lida', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes', userId] }),
  })

  const marcarTodas = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('notificacao_marcar_todas_lidas')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes', userId] }),
  })

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        className="relative rounded-full p-2 hover:bg-silver-100"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5 text-silver-600" />
        {naoLidas > 0 && (
          <span className="absolute right-0 top-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-96 overflow-hidden rounded-lg border border-silver-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-silver-200 px-4 py-3">
            <p className="text-sm font-semibold text-silver-900">Notificações</p>
            {naoLidas > 0 && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-navy hover:underline disabled:opacity-50"
                onClick={() => marcarTodas.mutate()}
                disabled={marcarTodas.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="h-4 w-4 animate-spin text-silver-400" />
              </div>
            ) : (notifs ?? []).length === 0 ? (
              <p className="p-6 text-center text-xs text-silver-500">Nenhuma notificação.</p>
            ) : (
              <ul className="divide-y divide-silver-100">
                {(notifs ?? []).map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 ${n.lida_em == null ? 'bg-navy/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-silver-900">{n.titulo}</p>
                        <p className="mt-0.5 line-clamp-3 text-xs text-silver-600">{n.mensagem}</p>
                        <p className="mt-1 text-[10px] text-silver-400">
                          {new Date(n.created_at).toLocaleString('pt-BR')}
                        </p>
                        {n.link && (
                          <Link
                            to={n.link}
                            onClick={() => { setOpen(false); if (n.lida_em == null) marcarLida.mutate(n.id) }}
                            className="mt-1 inline-block text-xs font-medium text-navy hover:underline"
                          >
                            Ver detalhes →
                          </Link>
                        )}
                      </div>
                      {n.lida_em == null && (
                        <button
                          type="button"
                          className="shrink-0 rounded-full p-1 text-silver-400 hover:bg-silver-100 hover:text-silver-700"
                          onClick={() => marcarLida.mutate(n.id)}
                          title="Marcar como lida"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
