import { supabase } from '@/lib/supabase'
export async function whatsappAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('whatsapp-admin', { body })
  if (error) {
    const response = (error as Error & { context?: Response }).context
    const detail = response ? await response.clone().json().catch(() => null) : null
    throw new Error(detail?.errors?.join('\n') || detail?.error || 'Não foi possível concluir a operação. Verifique a configuração e a migration do WhatsApp.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}
