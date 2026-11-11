const encoder = new TextEncoder()

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

function decodeHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
}

export async function validWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!appSecret || !signatureHeader) return false

  const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader.trim())
  if (!match) return false

  const provided = decodeHex(match[1])
  if (!provided) return false

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)))
  return constantTimeEqual(expected, provided)
}

export function getWhatsAppWebhookChallenge(
  url: URL,
  verifyToken: string,
): string | null {
  if (!verifyToken) return null

  const mode = url.searchParams.get('hub.mode')
  const receivedToken = url.searchParams.get('hub.verify_token') ?? ''
  const challenge = url.searchParams.get('hub.challenge')
  if (mode !== 'subscribe' || challenge === null) return null

  return receivedToken === verifyToken ? challenge : null
}
