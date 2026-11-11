import type { SupabaseClient } from '@supabase/supabase-js'

type Source = Pick<SupabaseClient, 'channel' | 'removeChannel'>
type Listener = () => void
type Entry = { listeners: Set<Listener>; channel: ReturnType<Source['channel']> }
const subscriptions = new WeakMap<Source, Map<string, Entry>>()
let sequence = 0

/** Share one channel across mounted inbox triggers; never reuse a channel while async removal is pending. */
export function subscribeToNotifications(client: Source, userId: string, listener: Listener): () => void {
  let users = subscriptions.get(client)
  if (!users) { users = new Map(); subscriptions.set(client, users) }
  let entry = users.get(userId)
  if (entry) entry.listeners.add(listener)
  else {
    const listeners = new Set([listener])
    const notify = () => { for (const callback of listeners) callback() }
    const channel = client.channel(`mobile-notif-${userId}-${++sequence}`)
    entry = { listeners, channel }
    users.set(userId, entry)
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${userId}` }, notify)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${userId}` }, notify)
      .subscribe((status) => { if (status === 'SUBSCRIBED') notify() })
  }
  const subscription = entry
  let active = true
  return () => {
    if (!active) return
    active = false
    subscription.listeners.delete(listener)
    if (subscription.listeners.size) return
    users.delete(userId)
    void client.removeChannel(subscription.channel).catch(() => { /* Polling remains available while offline. */ })
  }
}
