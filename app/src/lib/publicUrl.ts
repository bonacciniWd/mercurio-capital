const DEFAULT_PUBLIC_APP_URL = 'https://mercuriocapitalsa.com.br'

export const PUBLIC_APP_URL = (
  import.meta.env.VITE_PUBLIC_APP_URL?.trim() || DEFAULT_PUBLIC_APP_URL
).replace(/\/+$/, '')

export function publicAppUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${PUBLIC_APP_URL}${normalizedPath}`
}
