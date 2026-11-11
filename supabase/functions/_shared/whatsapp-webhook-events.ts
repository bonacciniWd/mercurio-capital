export interface WhatsAppInboundMessageRow {
  provider_message_id: string
  phone_number_id: string
  sender_phone: string
  sender_profile_name: string | null
  message_type: string
  text_body: string | null
  body_truncated: boolean
  received_at: string
  interacao?: { option_id?: string; flow_token?: string; nome?: string; assunto?: string }
}

const MAX_MESSAGE_ID_LENGTH = 128
const MAX_PHONE_NUMBER_ID_LENGTH = 64
const MAX_PROFILE_NAME_LENGTH = 160
const MAX_TEXT_BODY_LENGTH = 4000

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function boundedString(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null
}

function normalizeSenderPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const digits = value.replace(/\D/g, '')
  return /^\d{8,15}$/.test(digits) ? `+${digits}` : null
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{1,12}$/.test(value)) return null
  const milliseconds = Number(value) * 1000
  if (!Number.isSafeInteger(milliseconds)) return null
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function getProfileName(contacts: unknown): string | null {
  if (!Array.isArray(contacts)) return null
  for (const contactValue of contacts) {
    const contact = asRecord(contactValue)
    const profile = asRecord(contact?.profile)
    const name = boundedString(profile?.name, MAX_PROFILE_NAME_LENGTH)
    if (name) return name
  }
  return null
}

function safeMessageType(value: unknown): string {
  const type = boundedString(value, 32)?.toLowerCase()
  return type && /^[a-z_]+$/.test(type) ? type : 'unknown'
}

function textBodyFor(message: Record<string, unknown>): { body: string | null; truncated: boolean } {
  if (message.type !== 'text') return { body: null, truncated: false }
  const text = asRecord(message.text)
  if (typeof text?.body !== 'string') return { body: null, truncated: false }
  const body = text.body
  return {
    body: body.slice(0, MAX_TEXT_BODY_LENGTH),
    truncated: body.length > MAX_TEXT_BODY_LENGTH,
  }
}

export function extractWhatsAppInboundMessages(payload: unknown): WhatsAppInboundMessageRow[] {
  const root = asRecord(payload)
  if (root?.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) return []

  const rows: WhatsAppInboundMessageRow[] = []
  for (const entryValue of root.entry) {
    const entry = asRecord(entryValue)
    if (!Array.isArray(entry?.changes)) continue

    for (const changeValue of entry.changes) {
      const change = asRecord(changeValue)
      const value = asRecord(change?.value)
      const metadata = asRecord(value?.metadata)
      const phoneNumberId = boundedString(metadata?.phone_number_id, MAX_PHONE_NUMBER_ID_LENGTH)
      if (!phoneNumberId || !Array.isArray(value?.messages)) continue

      const profileName = getProfileName(value.contacts)
      for (const messageValue of value.messages) {
        const message = asRecord(messageValue)
        const id = boundedString(message?.id, MAX_MESSAGE_ID_LENGTH)
        const senderPhone = normalizeSenderPhone(message?.from)
        const receivedAt = normalizeTimestamp(message?.timestamp)
        if (!message || !id || !senderPhone || !receivedAt) continue

        const text = textBodyFor(message)
        let interacao: WhatsAppInboundMessageRow['interacao']
        if (message.type === 'interactive') {
          const interactive = asRecord(message.interactive)
          const option = asRecord(interactive?.button_reply) ?? asRecord(interactive?.list_reply)
          const optionId = boundedString(option?.id, 80)
          if (optionId && /^[\w-]+$/.test(optionId)) interacao = { option_id: optionId }
          const form = asRecord(interactive?.nfm_reply)
          if (typeof form?.response_json === 'string' && form.response_json.length <= 4000) {
            try {
              const response = asRecord(JSON.parse(form.response_json))
              const token = boundedString(response?.flow_token, 80)
              const subject = boundedString(response?.assunto, 30)
              const name = boundedString(response?.nome, 80)
              if (token && /^[0-9a-f-]{36}$/.test(token) && subject && ['cliente', 'credito', 'parceiro', 'humano'].includes(subject)) interacao = { flow_token: token, assunto: subject, ...(name ? { nome: name } : {}) }
            } catch { /* Malformed interactive content is not retained. */ }
          }
        }
        rows.push({
          provider_message_id: id,
          phone_number_id: phoneNumberId,
          sender_phone: senderPhone,
          sender_profile_name: profileName,
          message_type: safeMessageType(message.type),
          text_body: text.body,
          body_truncated: text.truncated,
          received_at: receivedAt,
          ...(interacao ? { interacao } : {}),
        })
      }
    }
  }
  return rows
}

export function isWhatsAppDuplicateInsert(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}
