import { supabase } from '@/lib/supabase'

export const PROPOSTA_DOCUMENTO_TTL_SECONDS = 60 * 5

type SignedUrlResult = {
  data: { signedUrl?: string } | null
  error: { message?: string } | null
}

export type PropostaDocumentoSigner = (
  bucket: 'proposta-docs',
  storagePath: string,
  expiresIn: number,
) => Promise<SignedUrlResult>

const defaultSigner: PropostaDocumentoSigner = async (bucket, storagePath, expiresIn) => (
  supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
)

export async function createPropostaDocumentoSignedUrl(
  storagePath: string,
  signer: PropostaDocumentoSigner = defaultSigner,
): Promise<string> {
  const normalizedPath = storagePath.trim()
  if (!normalizedPath || normalizedPath.startsWith('/') || normalizedPath.split('/').includes('..')) {
    throw new Error('Caminho do documento inválido.')
  }

  const { data, error } = await signer(
    'proposta-docs',
    normalizedPath,
    PROPOSTA_DOCUMENTO_TTL_SECONDS,
  )

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Não foi possível gerar o acesso seguro ao documento.')
  }

  return data.signedUrl
}

export function openPropostaDocumento(
  signedUrl: string,
  openWindow: typeof window.open = window.open.bind(window),
): void {
  const opened = openWindow(signedUrl, '_blank', 'noopener,noreferrer')
  if (opened) opened.opener = null
}
