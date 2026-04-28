import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Building2 } from 'lucide-react'

const logoSquare = new URL('../../assets/logos/logowide.png', import.meta.url).href

const loginVideo = new URL('../../assets/videos/video-login-optimized.mp4', import.meta.url).href

export function Login() {
  return (
    <div className="grid min-h-screen lg:grid-cols-5">
      <div className="col-span-2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
           {/* Logo */}
        <div className="flex h-auto items-center px-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <img src={logoSquare} alt="Mercurio Capital" className="h-full w-auto" />
        </div>
          <div className="card p-8">
            <div className="mb-6 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-gold-600">Cadastro de Parceiro</span>
              <span className="text-silver-500">Passo 1 de 3</span>
            </div>
            <h1 className="text-2xl font-bold text-navy">Crie sua conta</h1>
            <p className="mt-1 text-sm text-silver-600">Envie seus dados para análise da nossa equipe.</p>

            <form className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Nome completo</label>
                  <input className="input" placeholder="João Silva" />
                </div>
                <div>
                  <label className="label">E-mail</label>
                  <input className="input" type="email" placeholder="joao@empresa.com" />
                </div>
                <div>
                  <label className="label">Telefone</label>
                  <input className="input" placeholder="+55 (11) 9XXXX-XXXX" />
                </div>
                <div>
                  <label className="label">CNPJ</label>
                  <input className="input" placeholder="00.000.000/0001-00" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Razão social</label>
                  <input className="input" placeholder="Construtora Aurora LTDA" />
                </div>
              </div>

              <div>
                <label className="label">Documentos da empresa</label>
                <div className="rounded-lg border-2 border-dashed border-silver-300 bg-silver-50 p-6 text-center">
                  <Building2 className="mx-auto h-7 w-7 text-silver-400" />
                  <p className="mt-2 text-sm text-silver-700">Arraste os arquivos ou <span className="font-medium text-gold-600 underline">selecione</span></p>
                  <p className="mt-1 text-xs text-silver-500">Cartão CNPJ + contrato social · PDF, JPG, PNG até 10MB</p>
                </div>
              </div>

              <button type="button" className="btn-gold w-full">Enviar para análise</button>
              <p className="text-center text-sm text-silver-600">
                Já tem conta? <Link to="/p" className="font-medium text-navy underline">Faça login</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
      <div className="relative col-span-3 hidden overflow-hidden bg-navy lg:block">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src={loginVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,16,30,0.24)_0%,rgba(7,16,30,0.64)_52%,rgba(7,16,30,0.88)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.22),transparent_58%)]" />
        <div className="relative flex h-full flex-col justify-end p-16 text-white">
          <h2 className="max-w-xl text-4xl font-bold leading-tight">
            Crédito Imobiliário <span className="text-gold">para parceiros</span> estratégicos.
          </h2>
          <p className="mt-4 max-w-lg text-white/80">
            Home Equity, Construção e Financiamento — esteira completa, do funil ao registro.
          </p>
          <div className="mt-12 flex gap-6 text-sm">
            <div><p className="text-3xl font-bold text-gold">R$ 4,2B</p><p className="text-white/60">volume operado</p></div>
            <div><p className="text-3xl font-bold text-gold">+ 1.200</p><p className="text-white/60">parceiros</p></div>
            <div><p className="text-3xl font-bold text-gold">98%</p><p className="text-white/60">satisfação</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}
