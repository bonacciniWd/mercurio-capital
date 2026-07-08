import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Download as DownloadIcon,
  Terminal,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Monitor,
} from 'lucide-react'
import appleLogo from '@/assets/apple-logo-svgrepo-com.svg'
import windowsLogo from '@/assets/windows-174-svgrepo-com.svg'
import iconUrl from '@/assets/logos/mercurio-icon.png'
import logoWide from '@/assets/logos/logowide.png'
import {
  buildDownloadsFromRelease,
  fetchLatestDesktopRelease,
  formatFileSize,
} from '@/lib/desktopReleaseAssets'

type OS = 'mac' | 'windows' | 'linux' | 'unknown'

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  const platform = navigator.platform?.toLowerCase() ?? ''
  if (/mac|iphone|ipad|ipod/.test(platform) || /mac os|macos/.test(ua)) return 'mac'
  if (/win/.test(platform) || /windows/.test(ua)) return 'windows'
  if (/linux|x11/.test(platform) || /linux/.test(ua)) return 'linux'
  return 'unknown'
}

const RELEASE_OWNER = import.meta.env.VITE_DESKTOP_RELEASE_OWNER ?? 'bonacciniWd'
const RELEASE_REPO = import.meta.env.VITE_DESKTOP_RELEASE_REPO ?? 'mercurio-capital'

const OS_ICONS = {
  mac:     () => <img src={appleLogo}   alt="macOS"   className="h-6 w-6 brightness-0 invert" />,
  windows: () => <img src={windowsLogo} alt="Windows" className="h-6 w-6" />,
  linux:   () => <Terminal className="h-6 w-6 text-white" />,
}

const OS_META = {
  mac:     { label: 'macOS',   accent: 'from-zinc-700 to-black' },
  windows: { label: 'Windows', accent: 'from-sky-600 to-sky-900' },
  linux:   { label: 'Linux',   accent: 'from-orange-600 to-red-700' },
} as const

export function Download() {
  const [detected, setDetected] = useState<OS>('unknown')
  const releaseQuery = useQuery({
    queryKey: ['desktop-release-latest', RELEASE_OWNER, RELEASE_REPO],
    queryFn: () => fetchLatestDesktopRelease(RELEASE_OWNER, RELEASE_REPO),
    staleTime: 5 * 60_000,
  })

  useEffect(() => { setDetected(detectOS()) }, [])

  const downloads = useMemo(
    () => buildDownloadsFromRelease(releaseQuery.data),
    [releaseQuery.data],
  )

  const totalVariants = Object.values(downloads).reduce((total, list) => total + list.length, 0)
  const availableVariants = Object.values(downloads).reduce(
    (total, list) => total + list.filter(item => item.available).length,
    0,
  )
  const isPartial = availableVariants > 0 && availableVariants < totalVariants
  const hasNoAssets = availableVariants === 0

  const publishedAtLabel = useMemo(() => {
    if (!releaseQuery.data?.published_at) return null
    return new Date(releaseQuery.data.published_at).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }, [releaseQuery.data?.published_at])

  const ordered: Array<keyof typeof OS_META> =
    detected !== 'unknown' && detected in OS_META
      ? [detected as keyof typeof OS_META, ...(Object.keys(OS_META) as Array<keyof typeof OS_META>).filter(k => k !== detected)]
      : ['mac', 'windows', 'linux']

  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* Blurs decorativos — mesmo estilo do hero */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-red-600/30 blur-[120px]" />
        <div className="absolute -bottom-40 -left-32 h-[420px] w-[420px] rounded-full bg-red-800/20 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoWide} alt="Mercurio Capital" className="h-12 w-auto brightness-0 invert" />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-10 text-center">
        <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10">
          <img src={iconUrl} alt="Mercurio Capital" className="h-full w-full rounded-3xl" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-500">App desktop</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Baixe o APP da <span className="text-red-500">Mercúrio</span> para seu computador
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-white/70">
          Versão desktop nativa com notificações, modo offline parcial, atalhos e experiência otimizada para parceiros e equipes.
        </p>
        {detected !== 'unknown' && (
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/80">
            <CheckCircle2 className="h-3.5 w-3.5 text-red-500" />
            Sistema detectado: <strong className="font-semibold text-white">{OS_META[detected as keyof typeof OS_META]?.label}</strong>
          </p>
        )}
      </section>

      {/* Cards por OS */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-5 md:grid-cols-3">
          {ordered.map((os, idx) => {
            const meta = OS_META[os]
            const variants = downloads[os]
            const isPrimary = idx === 0 && detected === os
            return (
              <div
                key={os}
                className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 transition ${
                  isPrimary
                    ? 'border-red-500/40 from-red-950/40 to-black shadow-[0_0_40px_-15px_rgba(239,68,68,0.5)]'
                    : 'border-white/10 from-zinc-900/60 to-black/60 hover:border-white/20'
                }`}
              >
                {isPrimary && (
                  <span className="absolute right-4 top-4 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Recomendado
                  </span>
                )}
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${meta.accent}`}>
                  {OS_ICONS[os]()}
                </div>
                <h2 className="mt-4 text-xl font-semibold">{meta.label}</h2>

                <div className="mt-5 space-y-2">
                  {variants.map(v => {
                    const disabled = !v.available
                    return (
                      <a
                        key={v.label + v.arch}
                        href={disabled ? '#indisponivel' : v.url}
                        onClick={e => disabled && e.preventDefault()}
                        className={`group flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm transition ${
                          disabled
                            ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/40'
                            : 'border-white/10 bg-white/5 text-white hover:border-red-500/40 hover:bg-red-600/10'
                        }`}
                        aria-disabled={disabled}
                        target={disabled ? undefined : '_blank'}
                        rel={disabled ? undefined : 'noreferrer'}
                      >
                        <span className="flex flex-col text-left">
                          <span className="font-medium">{v.label}</span>
                          <span className="text-[11px] text-white/40">
                            {v.ext}
                            {v.arch ? ` · ${v.arch}` : ''}
                            {disabled ? ' · indisponível nesta release' : ''}
                            {!disabled && v.size ? ` · ${formatFileSize(v.size)}` : ''}
                          </span>
                          {!disabled && v.fileName ? (
                            <span className="mt-1 truncate text-[10px] text-white/35">{v.fileName}</span>
                          ) : null}
                        </span>
                        <DownloadIcon className={`h-4 w-4 ${disabled ? '' : 'transition group-hover:text-red-500'}`} />
                      </a>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">
          {releaseQuery.isLoading ? (
            <p>
              Carregando links oficiais da última release pública...
            </p>
          ) : null}

          {releaseQuery.isError ? (
            <p className="text-amber-200/90">
              Não foi possível buscar os assets no momento. A interface continua disponível e exibe fallback seguro sem quebrar navegação.
            </p>
          ) : null}

          {!releaseQuery.isLoading && !releaseQuery.isError && releaseQuery.data ? (
            <p>
              Release carregada: <strong className="text-white">{releaseQuery.data.name}</strong>
              {' '}({releaseQuery.data.tag_name})
              {publishedAtLabel ? ` · publicada em ${publishedAtLabel}` : ''}.
            </p>
          ) : null}

          {!releaseQuery.isLoading && hasNoAssets ? (
            <p className="mt-2 text-amber-200/90">
              Nenhum asset compatível foi encontrado na última release. Enquanto isso, acesse a plataforma pelo navegador em{' '}
              <Link to="/login" className="underline hover:text-amber-100">login</Link>.
            </p>
          ) : null}

          {!releaseQuery.isLoading && isPartial ? (
            <p className="mt-2 text-amber-200/90">
              Alguns instaladores não estão presentes na release atual ({availableVariants}/{totalVariants} disponíveis). Os itens ausentes ficam desabilitados automaticamente.
            </p>
          ) : null}

          {!releaseQuery.isLoading && !releaseQuery.isError && availableVariants === totalVariants ? (
            <p className="mt-2 text-emerald-300/90">
              Todos os instaladores esperados foram encontrados para macOS, Windows e Linux.
            </p>
          ) : null}
        </div>
      </section>

      {/* Especificações */}
      <section className="relative z-10 border-t border-white/5 bg-black/20">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 sm:grid-cols-3">
          <Spec Icon={ShieldCheck} title="Seguro" desc="Assinado digitalmente e auto-atualizável." />
          <Spec Icon={Cpu}         title="Leve"   desc="Otimizado para Apple Silicon, Intel e ARM." />
          <Spec Icon={Monitor}     title="Nativo" desc="Atalhos do sistema, badges e notificações." />
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 bg-black/20 py-8 text-center text-xs text-white/40">
        © 2026 Mercurio Capital — Todos os direitos reservados
      </footer>
    </div>
  )
}

function Spec({ Icon, title, desc }: { Icon: typeof ShieldCheck; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600/10 text-red-500 ring-1 ring-red-500/20">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-sm text-white/60">{desc}</p>
      </div>
    </div>
  )
}
