import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TwoFactorManager } from '@/components/TwoFactorManager'
import { supabase } from '@/lib/supabase'
import {
  PARTNER_PROFILE_QUERY_KEY,
  usePartnerProfile,
  type PartnerProfile,
} from '@/lib/partnerProfile'

const sub = ['Perfil da empresa', 'Notificações', 'Integrações', 'Segurança'] as const

export function PartnerConfig() {
  const [active, setActive] = useState<typeof sub[number]>('Perfil da empresa')
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-navy">Configurações</h1>
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="card h-fit p-2">
          {sub.map(s => (
            <button
              key={s}
              onClick={() => setActive(s)}
              className={`btn-no-liquid block w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                active === s ? 'bg-red-600 text-white' : 'text-silver-700 hover:bg-silver-100'
              }`}
            >
              {s}
            </button>
          ))}
        </nav>

        <div className="card p-6">
          {active === 'Perfil da empresa' && <Perfil />}
          {active === 'Notificações' && <Notif />}
          {active === 'Integrações' && <p className="text-silver-500">[ APIs externas em construção ]</p>}
          {active === 'Segurança' && <TwoFactorManager />}
        </div>
      </div>
    </>
  )
}

// ============================================================
// Perfil
// ============================================================

const onlyDigits = (s: string) => s.replace(/\D+/g, '')

function formatCpfCnpj(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14)
  if (d.length <= 11) {
    // CPF — 000.000.000-00
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  // CNPJ — 00.000.000/0000-00
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatDDI(raw: string): string {
  const d = onlyDigits(raw).slice(0, 4)
  return d ? `+${d}` : ''
}

function formatDDD(raw: string): string {
  return onlyDigits(raw).slice(0, 2)
}

function formatPhone(raw: string): string {
  // formata número sem DDD: 9XXXX-XXXX (9 dígitos) ou XXXX-XXXX (8 dígitos)
  const d = onlyDigits(raw).slice(0, 9)
  if (d.length <= 4) return d
  if (d.length <= 8) return `${d.slice(0, 4)}-${d.slice(4)}`
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function formatCep(raw: string): string {
  const d = onlyDigits(raw).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

type ViaCepResponse = {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

async function lookupCep(cep: string): Promise<ViaCepResponse | null> {
  const d = onlyDigits(cep)
  if (d.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`)
    if (!res.ok) return null
    const json = (await res.json()) as ViaCepResponse
    if (json.erro) return null
    return json
  } catch {
    return null
  }
}

type PerfilForm = {
  razao_social: string
  cpf: string
  website: string
  telefone_ddi: string
  telefone_ddd: string
  telefone: string
  endereco_logradouro: string
  endereco_numero: string
  endereco_complemento: string
  endereco_bairro: string
  endereco_cidade: string
  endereco_estado: string
  endereco_cep: string
}

function emptyForm(): PerfilForm {
  return {
    razao_social: '',
    cpf: '',
    website: '',
    telefone_ddi: '55',
    telefone_ddd: '',
    telefone: '',
    endereco_logradouro: '',
    endereco_numero: '',
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_estado: '',
    endereco_cep: '',
  }
}

function fromProfile(p: PartnerProfile): PerfilForm {
  const telDigits = onlyDigits(p.telefone ?? '')
  // se vier com DDD+número, separa os 2 primeiros como DDD
  const ddd = telDigits.length >= 10 ? telDigits.slice(0, 2) : ''
  const numero = telDigits.length >= 10 ? telDigits.slice(2) : telDigits
  return {
    razao_social: p.razao_social ?? '',
    cpf: formatCpfCnpj(p.cpf ?? ''),
    website: p.website ?? '',
    telefone_ddi: p.telefone_ddi ?? '55',
    telefone_ddd: ddd,
    telefone: formatPhone(numero),
    endereco_logradouro: p.endereco_logradouro ?? '',
    endereco_numero: p.endereco_numero ?? '',
    endereco_complemento: p.endereco_complemento ?? '',
    endereco_bairro: p.endereco_bairro ?? '',
    endereco_cidade: p.endereco_cidade ?? '',
    endereco_estado: p.endereco_estado ?? '',
    endereco_cep: formatCep(p.endereco_cep ?? ''),
  }
}

function Perfil() {
  const profileQ = usePartnerProfile()
  const qc = useQueryClient()
  const [form, setForm] = useState<PerfilForm>(emptyForm)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (profileQ.data) setForm(fromProfile(profileQ.data))
  }, [profileQ.data])

  const updateMut = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const { data, error } = await supabase.rpc('partner_update_profile', { p_payload: payload })
      if (error) throw error
      return data as PartnerProfile
    },
    onSuccess: (data) => {
      qc.setQueryData(PARTNER_PROFILE_QUERY_KEY, data)
      setFeedback({ kind: 'ok', msg: 'Perfil atualizado com sucesso.' })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar.'
      setFeedback({ kind: 'err', msg })
    },
  })

  function bind<K extends keyof PerfilForm>(key: K, formatter?: (s: string) => string) {
    return {
      value: form[key],
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        const v = formatter ? formatter(e.target.value) : e.target.value
        setForm((f) => ({ ...f, [key]: v }))
      },
    }
  }

  const [cepLoading, setCepLoading] = useState(false)
  async function handleCepChange(e: ChangeEvent<HTMLInputElement>) {
    const masked = formatCep(e.target.value)
    setForm((f) => ({ ...f, endereco_cep: masked }))
    const digits = onlyDigits(masked)
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const data = await lookupCep(digits)
      if (!data) {
        setFeedback({ kind: 'err', msg: 'CEP não encontrado.' })
        return
      }
      setForm((f) => ({
        ...f,
        endereco_logradouro: data.logradouro || f.endereco_logradouro,
        endereco_bairro: data.bairro || f.endereco_bairro,
        endereco_cidade: data.localidade || f.endereco_cidade,
        endereco_estado: (data.uf || f.endereco_estado).toUpperCase().slice(0, 2),
      }))
      setFeedback(null)
    } finally {
      setCepLoading(false)
    }
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const partnerId = profileQ.data?.partner_id
    if (!partnerId) {
      setFeedback({ kind: 'err', msg: 'Parceiro ainda não foi vinculado.' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ kind: 'err', msg: 'Imagem acima de 2MB.' })
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `${partnerId}/logo-${Date.now()}.${ext}`
      const up = await supabase.storage.from('partner_branding').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/png',
      })
      if (up.error) throw up.error
      const { data: pub } = supabase.storage.from('partner_branding').getPublicUrl(path)
      const url = pub.publicUrl
      const { data, error } = await supabase.rpc('partner_update_profile', {
        p_payload: { avatar_url: url },
      })
      if (error) throw error
      qc.setQueryData(PARTNER_PROFILE_QUERY_KEY, data as PartnerProfile)
      setFeedback({ kind: 'ok', msg: 'Logo atualizado.' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar imagem.'
      setFeedback({ kind: 'err', msg })
    } finally {
      setUploading(false)
    }
  }

  const profile = profileQ.data
  const initial = (form.razao_social || profile?.nome || '?').charAt(0).toUpperCase()
  const loading = profileQ.isLoading

  return (
    <>
      <div className="flex items-center gap-4">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Logo"
            className="h-20 w-20 rounded-full object-cover ring-1 ring-silver-200"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy text-3xl font-bold text-gold">
            {initial}
          </div>
        )}
        <label className="btn-no-liquid btn-outline cursor-pointer">
          {uploading ? 'Enviando…' : 'Alterar logo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleLogoUpload}
            disabled={uploading}
          />
        </label>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setFeedback(null)
          const payload = {
            razao_social: form.razao_social,
            cpf: onlyDigits(form.cpf),
            website: form.website,
            telefone_ddi: onlyDigits(form.telefone_ddi),
            telefone: onlyDigits(form.telefone_ddd) + onlyDigits(form.telefone),
            endereco_cep: onlyDigits(form.endereco_cep),
            endereco_logradouro: form.endereco_logradouro,
            endereco_numero: form.endereco_numero,
            endereco_complemento: form.endereco_complemento,
            endereco_bairro: form.endereco_bairro,
            endereco_cidade: form.endereco_cidade,
            endereco_estado: form.endereco_estado.toUpperCase().slice(0, 2),
          }
          updateMut.mutate(payload)
        }}
      >
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Razão social" {...bind('razao_social')} disabled={loading} />
          <Field
            label="CPF / CNPJ"
            placeholder="000.000.000-00"
            {...bind('cpf', formatCpfCnpj)}
            disabled={loading}
          />
          <Field label="Website" type="url" placeholder="https://" {...bind('website')} disabled={loading} />
          <div>
            <label className="label">WhatsApp comercial</label>
            <div className="flex gap-2">
              <input
                className="input w-20"
                placeholder="+55"
                value={formatDDI(form.telefone_ddi)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, telefone_ddi: onlyDigits(e.target.value).slice(0, 4) }))
                }
                disabled={loading}
              />
              <input
                className="input w-16"
                placeholder="DDD"
                value={form.telefone_ddd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, telefone_ddd: formatDDD(e.target.value) }))
                }
                disabled={loading}
                maxLength={2}
              />
              <input
                className="input flex-1"
                placeholder="9XXXX-XXXX"
                {...bind('telefone', formatPhone)}
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="label">CEP{cepLoading ? ' (buscando…)' : ''}</label>
            <input
              className="input"
              placeholder="00000-000"
              value={form.endereco_cep}
              onChange={handleCepChange}
              disabled={loading}
              maxLength={9}
            />
          </div>
          <Field label="Logradouro" {...bind('endereco_logradouro')} disabled={loading} />
          <Field label="Número" {...bind('endereco_numero')} disabled={loading} />
          <Field label="Complemento" {...bind('endereco_complemento')} disabled={loading} />
          <Field label="Bairro" {...bind('endereco_bairro')} disabled={loading} />
          <Field label="Cidade" {...bind('endereco_cidade')} disabled={loading} />
          <Field label="Estado (UF)" maxLength={2} {...bind('endereco_estado')} disabled={loading} />
        </div>

        {feedback && (
          <p
            className={`mt-4 text-sm ${
              feedback.kind === 'ok' ? 'text-success-600' : 'text-danger-600'
            }`}
          >
            {feedback.msg}
          </p>
        )}

        <button
          type="submit"
          className="btn-no-liquid btn-gold mt-6"
          disabled={loading || updateMut.isPending}
        >
          {updateMut.isPending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </>
  )
}

// ============================================================
// Notificações
// ============================================================

const NOTIF_EVENTS: { key: string; label: string }[] = [
  { key: 'proposta_atualizada', label: 'Nova proposta atualizada' },
  { key: 'documento_status', label: 'Documento aprovado / rejeitado' },
  { key: 'saldo_baixo', label: 'Saldo de carteira baixo (< R$ 50)' },
  { key: 'convite_aceito', label: 'Convite de membro aceito' },
  { key: 'proposta_avanco', label: 'Status de proposta avançou' },
]

type NotifPrefRow = {
  partner_id: string
  evento: string
  whatsapp: boolean
  email: boolean
  push: boolean
  updated_at: string
}

type PrefState = Record<string, { whatsapp: boolean; email: boolean; push: boolean }>

function Notif() {
  const qc = useQueryClient()
  const [prefs, setPrefs] = useState<PrefState>({})
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const listQ = useQuery({
    queryKey: ['partner', 'notif-prefs'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('partner_notif_prefs_list')
      if (error) throw error
      return (data ?? []) as NotifPrefRow[]
    },
    staleTime: 60_000,
  })

  const defaults = useMemo<PrefState>(() => {
    const out: PrefState = {}
    for (const ev of NOTIF_EVENTS) {
      out[ev.key] = { whatsapp: true, email: true, push: false }
    }
    return out
  }, [])

  useEffect(() => {
    if (!listQ.data) return
    const map: PrefState = { ...defaults }
    for (const row of listQ.data) {
      map[row.evento] = { whatsapp: row.whatsapp, email: row.email, push: row.push }
    }
    setPrefs(map)
  }, [listQ.data, defaults])

  useEffect(() => {
    if (Object.keys(prefs).length === 0) setPrefs(defaults)
  }, [defaults, prefs])

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = NOTIF_EVENTS.map((ev) => ({
        evento: ev.key,
        whatsapp: prefs[ev.key]?.whatsapp ?? true,
        email: prefs[ev.key]?.email ?? true,
        push: prefs[ev.key]?.push ?? false,
      }))
      const { data, error } = await supabase.rpc('partner_notif_prefs_upsert', {
        p_payload: payload,
      })
      if (error) throw error
      return (data ?? []) as NotifPrefRow[]
    },
    onSuccess: (rows) => {
      qc.setQueryData(['partner', 'notif-prefs'], rows)
      setFeedback({ kind: 'ok', msg: 'Preferências salvas.' })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar.'
      setFeedback({ kind: 'err', msg })
    },
  })

  function toggle(eventKey: string, channel: 'whatsapp' | 'email' | 'push') {
    setPrefs((p) => ({
      ...p,
      [eventKey]: {
        ...(p[eventKey] ?? { whatsapp: true, email: true, push: false }),
        [channel]: !(p[eventKey]?.[channel] ?? false),
      },
    }))
  }

  const loading = listQ.isLoading

  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Preferências de notificação</h2>
      <div className="mt-4 overflow-hidden rounded-lg border border-silver-200">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr>
              <th className="px-4 py-3">Evento</th>
              <th className="px-4 py-3 text-center">WhatsApp</th>
              <th className="px-4 py-3 text-center">E-mail</th>
              <th className="px-4 py-3 text-center">Push</th>
            </tr>
          </thead>
          <tbody>
            {NOTIF_EVENTS.map((ev) => {
              const row = prefs[ev.key] ?? { whatsapp: true, email: true, push: false }
              return (
                <tr key={ev.key} className="border-t border-silver-100">
                  <td className="px-4 py-3 text-silver-800">{ev.label}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-gold"
                      checked={row.whatsapp}
                      disabled={loading}
                      onChange={() => toggle(ev.key, 'whatsapp')}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-gold"
                      checked={row.email}
                      disabled={loading}
                      onChange={() => toggle(ev.key, 'email')}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-gold"
                      checked={row.push}
                      disabled={loading}
                      onChange={() => toggle(ev.key, 'push')}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {feedback && (
        <p
          className={`mt-4 text-sm ${
            feedback.kind === 'ok' ? 'text-success-600' : 'text-danger-600'
          }`}
        >
          {feedback.msg}
        </p>
      )}

      <button
        className="btn-no-liquid btn-gold mt-6"
        onClick={() => {
          setFeedback(null)
          saveMut.mutate()
        }}
        disabled={loading || saveMut.isPending}
      >
        {saveMut.isPending ? 'Salvando…' : 'Salvar preferências'}
      </button>
    </>
  )
}

// ============================================================
// Helpers
// ============================================================

type FieldProps = {
  label: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  type?: string
  placeholder?: string
  maxLength?: number
}

function Field({ label, ...rest }: FieldProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" {...rest} />
    </div>
  )
}
