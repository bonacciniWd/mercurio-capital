import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2, LogOut, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { PartnerDocsUploader, type DocSlot } from '@/components/PartnerDocsUploader'

type Me = {
  id?: string
  email?: string
  nome?: string
  role?: string
  partner_id?: string | null
  partner_status?: 'pending' | 'approved' | 'rejected' | 'suspended' | null
  approved?: boolean
}

const DOC_SLOTS: DocSlot[] = [
  { tipo: 'contrato_social',        label: 'Contrato social (ou requerimento de empresário)', required: true,  hint: 'PDF do contrato social atualizado.' },
  { tipo: 'cnh_ou_rg',              label: 'CNH ou RG',                                       required: true,  hint: 'Documento de identidade com foto.' },
  { tipo: 'certidao_estado_civil',  label: 'Certidão de estado civil',                        required: false, hint: 'Certidão de nascimento, casamento ou equivalente.' },
  { tipo: 'comprovante_residencia', label: 'Comprovante de endereço',                         required: false, hint: 'Conta de luz, água ou telefone — últimos 90 dias.' },
  { tipo: 'dados_bancarios',        label: 'Comprovante de dados bancários',                  required: false, hint: 'Extrato ou comprovante com banco, agência e conta.' },
]

export function AcessoPendente() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [docsOk, setDocsOk] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [cpf, setCpf] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('me')
      if (cancelled) return
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      let m = (data ?? {}) as Me
      // Auto-cadastro: usuário fez signup mas o partners row não foi criado
      // (ex.: signUp exigiu confirmação de email e Registro.tsx interrompeu
      // antes de chamar partner_self_register). Cria agora e recarrega.
      if (m.role === 'partner' && !m.partner_id) {
        const { error: regErr } = await supabase.rpc('partner_self_register', {
          p_cpf: null,
          p_dados_bancarios: null,
        })
        if (cancelled) return
        if (regErr) {
          setError(regErr.message)
        } else {
          const { data: data2 } = await supabase.rpc('me')
          if (cancelled) return
          m = (data2 ?? {}) as Me
        }
      }
      setMe(m)
      if (m.partner_id) {
        const { data: partnerRow } = await supabase
          .from('partners')
          .select('cpf')
          .eq('id', m.partner_id)
          .maybeSingle()
        if (cancelled) return
        setCpf(partnerRow?.cpf ?? null)
      }
      if (m.approved && m.role === 'partner') navigate('/p', { replace: true })
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [navigate])

  async function handleLogout() {
    await logout()
    navigate('/p/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6">
        <Loader2 className="h-5 w-5 animate-spin text-silver-400" />
      </div>
    )
  }

  const isPartner = me?.role === 'partner'
  const partnerId = me?.partner_id ?? null
  const status = me?.partner_status ?? null

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
      <div className="card w-full p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Cadastro em análise</p>
            <h1 className="mt-2 text-2xl font-bold text-navy">
              {status === 'rejected' ? 'Cadastro recusado' : 'Acesso operacional pendente'}
            </h1>
            {me?.email && <p className="mt-1 text-xs text-silver-500">Logado como {me.email}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md border border-silver-300 px-3 py-1.5 text-xs text-silver-700 hover:bg-silver-50"
            title="Sair"
          >
            <LogOut className="mr-1 inline h-3.5 w-3.5" /> Sair
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            <AlertCircle className="mr-1 inline h-4 w-4" />
            {error}
          </p>
        )}

        {!isPartner ? (
          <p className="mt-4 text-sm text-silver-600">
            Sua conta ainda não foi associada a um parceiro. Aguarde o contato da equipe Mercurio.
          </p>
        ) : status === 'rejected' ? (
          <div className="mt-4 space-y-3 text-sm text-silver-700">
            <p>
              O seu cadastro foi recusado pela equipe Mercurio. Entre em contato pelo suporte ou reenvie seus
              documentos atualizados abaixo — vamos reavaliar.
            </p>
            {partnerId && (
              <PartnerDocsUploader partnerId={partnerId} slots={DOC_SLOTS} onComplete={() => setDocsOk(true)} />
            )}
          </div>
        ) : submitted ? (
          <div className="mt-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-navy">Documentos enviados!</h2>
            <p className="mt-2 text-sm text-silver-600">
              Sua documentação foi enviada para análise. Você receberá um e-mail assim que a aprovação for concluída.
            </p>
            <Link to="/" className="btn-outline mt-6">Voltar ao início</Link>
          </div>
        ) : !partnerId ? (
          <p className="mt-4 text-sm text-silver-600">
            Sua conta de parceiro foi criada, mas ainda não temos o registro vinculado. Aguarde alguns instantes
            e atualize a página.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-silver-600">
              Bem-vindo{me?.nome ? `, ${me.nome.split(' ')[0]}` : ''}! Para concluir seu cadastro de parceiro,
              anexe os documentos abaixo. Após o envio, nossa equipe revisará e liberará seu acesso operacional
              em até 24h úteis.
            </p>

            <PartnerDocsUploader
              partnerId={partnerId}
              slots={DOC_SLOTS}
              onComplete={() => setDocsOk(true)}
            />

            {!cpf && (
              <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
                <AlertCircle className="mr-1 inline h-4 w-4" />
                Informe seu CPF para prosseguir. Entre em contato com a equipe Mercurio para atualizar seu cadastro.
              </p>
            )}

            <button
              type="button"
              onClick={() => setSubmitted(true)}
              disabled={!docsOk || !cpf}
              className="btn-gold w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!cpf ? 'CPF obrigatório para enviar' : docsOk ? 'Enviar para análise' : 'Anexe os documentos obrigatórios'}
            </button>

            <p className="text-center text-xs text-silver-500">
              Você pode fechar esta janela e voltar mais tarde — seus uploads ficam salvos.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
