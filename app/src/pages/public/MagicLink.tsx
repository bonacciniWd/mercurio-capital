import { Logo } from '@/components/Logo'
import { Loader2, CheckCircle2 } from 'lucide-react'

export function MagicLink() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <Logo variant="light" />
        <div>
          <h2 className="text-4xl font-bold">Sua proposta está esperando por você.</h2>
          <p className="mt-3 text-white/70">Verificando seu acesso seguro...</p>
        </div>
        <p className="text-xs text-white/40">© Mercurio Capital</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="card w-full max-w-md p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-navy">Identidade confirmada!</h1>
          <p className="mt-2 text-sm text-silver-600">Estamos redirecionando para sua proposta…</p>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-silver-200">
            <div className="h-full w-2/3 animate-pulse bg-gold" />
          </div>
          <p className="mt-6 inline-flex items-center gap-2 text-xs text-silver-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> token validado · sessão temporária criada
          </p>
        </div>
      </div>
    </div>
  )
}
