import logoUrl from '@/assets/logos/logo.svg'

interface BrandLoadingProps {
  message?: string
}

/** Blocking loader for operations that may wait on an external service. */
export function BrandLoading({ message }: BrandLoadingProps) {
  return (
    <div className="brand-loading" role="status" aria-live="polite" aria-label="Carregando">
      <div className="brand-loading__panel">
        <img className="brand-loading__logo" src={logoUrl} alt="" aria-hidden="true" />
        <p className="brand-loading__title">
          Carregando<span className="brand-loading__dots" aria-hidden="true">...</span>
        </p>
        {message && <p className="brand-loading__message">{message}</p>}
      </div>
    </div>
  )
}
