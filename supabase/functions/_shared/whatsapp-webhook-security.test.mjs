import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  getWhatsAppWebhookChallenge,
  validWhatsAppSignature,
} from './whatsapp-webhook-security.ts'

const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
const secret = 'local-test-secret-only'
const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

test('rejects webhook POST when the app secret is missing', async () => {
  assert.equal(await validWhatsAppSignature(body, signature, ''), false)
})

test('rejects missing, malformed, and invalid signatures', async () => {
  assert.equal(await validWhatsAppSignature(body, null, secret), false)
  assert.equal(await validWhatsAppSignature(body, 'not-a-signature', secret), false)
  assert.equal(await validWhatsAppSignature(body, `sha256=${'0'.repeat(64)}`, secret), false)
})

test('accepts a valid Meta HMAC signature and rejects a changed body', async () => {
  assert.equal(await validWhatsAppSignature(body, signature, secret), true)
  assert.equal(await validWhatsAppSignature(`${body} `, signature, secret), false)
})

test('returns the challenge only for a matching subscription verification token', () => {
  const url = new URL('https://example.test/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=challenge-123')
  assert.equal(getWhatsAppWebhookChallenge(url, 'verify-me'), 'challenge-123')
  assert.equal(getWhatsAppWebhookChallenge(url, ''), null)
  assert.equal(getWhatsAppWebhookChallenge(url, 'wrong-token'), null)
  assert.equal(getWhatsAppWebhookChallenge(new URL('https://example.test/webhook?hub.mode=other&hub.verify_token=verify-me&hub.challenge=x'), 'verify-me'), null)
})
