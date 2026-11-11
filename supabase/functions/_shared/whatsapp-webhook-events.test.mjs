import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractWhatsAppInboundMessages,
  isWhatsAppDuplicateInsert,
} from './whatsapp-webhook-events.ts'

const payload = {
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        metadata: { phone_number_id: 'business-phone-id' },
        contacts: [{ profile: { name: 'Pessoa Teste' } }],
        messages: [
          { id: 'wamid.1', from: '5547999998888', timestamp: '1793900000', type: 'text', text: { body: 'oi' } },
          { id: 'wamid.2', from: '5547999998888', timestamp: '1793900001', type: 'image', image: { id: 'media-secret' } },
        ],
      },
    }],
  }],
}

test('extracts text and media type without retaining media payload', () => {
  const rows = extractWhatsAppInboundMessages(payload)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    provider_message_id: 'wamid.1',
    phone_number_id: 'business-phone-id',
    sender_phone: '+5547999998888',
    sender_profile_name: 'Pessoa Teste',
    message_type: 'text',
    text_body: 'oi',
    body_truncated: false,
    received_at: new Date(1793900000 * 1000).toISOString(),
  })
  assert.equal(rows[1].message_type, 'image')
  assert.equal(rows[1].text_body, null)
  assert.equal(JSON.stringify(rows).includes('media-secret'), false)
})

test('rejects invalid envelope and skips messages with invalid identity or timestamp', () => {
  assert.deepEqual(extractWhatsAppInboundMessages({ object: 'unexpected', entry: [] }), [])
  const malformed = structuredClone(payload)
  malformed.entry[0].changes[0].value.messages.push(
    { id: 'bad-phone', from: 'abc', timestamp: '1793900002', type: 'text', text: { body: 'x' } },
    { id: 'bad-time', from: '5547999998888', timestamp: 'invalid', type: 'text', text: { body: 'x' } },
  )
  assert.equal(extractWhatsAppInboundMessages(malformed).length, 2)
})

test('bounds retained text and marks truncation without logging payload', () => {
  const longText = 'x'.repeat(5000)
  const longPayload = structuredClone(payload)
  longPayload.entry[0].changes[0].value.messages = [
    { id: 'wamid.long', from: '5547999998888', timestamp: '1793900000', type: 'text', text: { body: longText } },
  ]
  const [row] = extractWhatsAppInboundMessages(longPayload)
  assert.equal(row.text_body.length, 4000)
  assert.equal(row.body_truncated, true)
})

test('classifies only unique-constraint failures as duplicate deliveries', () => {
  assert.equal(isWhatsAppDuplicateInsert({ code: '23505' }), true)
  assert.equal(isWhatsAppDuplicateInsert({ code: '42501' }), false)
  assert.equal(isWhatsAppDuplicateInsert(null), false)
})

test('normalizes interactive replies and drops extra personal or internal fields', () => {
 const p = structuredClone(payload)
 p.entry[0].changes[0].value.messages = [{ id: 'wamid.flow', from: '5547999998888', timestamp: '1793900000', type: 'interactive', interactive: { nfm_reply: { response_json: JSON.stringify({ flow_token: '12345678-1234-1234-1234-123456789abc', assunto: 'credito', nome: 'Exemplo', cpf: 'not-retained', secret: 'not-retained' }) } } }]
 const [row] = extractWhatsAppInboundMessages(p)
 assert.equal(row.interacao.assunto, 'credito'); assert.equal(JSON.stringify(row).includes('not-retained'), false)
 p.entry[0].changes[0].value.messages[0].interactive.nfm_reply.response_json = '{invalid'
 assert.equal(extractWhatsAppInboundMessages(p)[0].interacao, undefined)
})
