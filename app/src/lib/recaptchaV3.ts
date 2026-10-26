export const PROTOCOL_RECAPTCHA_ACTION = 'consulta_protocolo'

let loading: Promise<void> | null = null

export function loadRecaptchaV3(siteKey: string): Promise<void> {
  if (!siteKey.trim()) return Promise.reject(new Error('recaptcha_site_key_missing'))
  if (window.grecaptcha?.execute) return new Promise(resolve => window.grecaptcha!.ready(resolve))
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-recaptcha-v3]')
    const script = existing ?? document.createElement('script')
    script.dataset.recaptchaV3 = 'true'
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (!window.grecaptcha) { loading = null; reject(new Error('recaptcha_unavailable')); return }
      window.grecaptcha.ready(resolve)
    }
    script.onerror = () => { loading = null; reject(new Error('recaptcha_unavailable')) }
    if (!existing) document.head.appendChild(script)
  })
  return loading
}

export async function executeRecaptchaV3(siteKey: string, action: string): Promise<string> {
  if (!window.grecaptcha?.execute) throw new Error('recaptcha_unavailable')
  const token = await window.grecaptcha.execute(siteKey, { action })
  if (!token) throw new Error('recaptcha_token_missing')
  return token
}

declare global {
  interface Window {
    grecaptcha?: {
      ready(callback: () => void): void
      execute(siteKey?: string, options?: { action: string }): Promise<string>
    }
  }
}
