import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { PartnerDocsUploader, type DocSlot } from '@/components/PartnerDocsUploader'
import { supabase } from '@/lib/supabase'
import { getSenhaMinLength, validarSenha } from '@/lib/securityConfig'
import { maskCpf, isValidCpf, onlyDigits } from '@/lib/documentoBr'
import partnerRegister from '@/assets/partner-register.jpg'

type Step = 1 | 2 | 3

type FormData = {
  nome: string
  email: string
  telefone: string
  cpf: string
  password: string
  confirm: string
}

const DOC_SLOTS: DocSlot[] = [
  {
    tipo: 'contrato_social',
    label: 'Contrato social (ou requerimento de empresário)',
    required: true,
    hint: 'PDF do contrato social atualizado.',
  },
  {
    tipo: 'cnh_ou_rg',
    label: 'CNH ou RG',
    required: true,
    hint: 'Documento de identidade com foto.',
  },
  {
    tipo: 'certidao_estado_civil',
    label: 'Certidão de estado civil',
    required: false,
    hint: 'Certidão de nascimento, casamento ou equivalente.',
  },
  {
    tipo: 'comprovante_residencia',
    label: 'Comprovante de endereço',
    required: false,
    hint: 'Conta de luz, água ou telefone — últimos 90 dias.',
  },
  {
    tipo: 'dados_bancarios',
    label: 'Comprovante de dados bancários',
    required: false,
    hint: 'Extrato ou comprovante com banco, agência e conta.',
  },
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Registro() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    password: '',
    confirm: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docsOk, setDocsOk] = useState(false)

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const emailNormalizado = form.email.trim().toLowerCase()
    if (!EMAIL_REGEX.test(emailNormalizado)) {
      setError('Informe um e-mail válido.')
      return
    }
    if (!isValidCpf(form.cpf)) {
      setError('Informe um CPF válido.')
      return
    }
    if (form.password !== form.confirm) {
      setError('As senhas não conferem.')
      return
    }
    const erroSenha = validarSenha(form.password, await getSenhaMinLength())
    if (erroSenha) {
      setError(erroSenha)
      return
    }

    setLoading(true)
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: emailNormalizado,
        password: form.password,
        options: {
          data: {
            nome_completo: form.nome.trim(),
            telefone: onlyDigits(form.telefone),
            telefone_ddi: '55',
            role: 'partner',
          },
        },
      })

      if (signUpErr) throw new Error(signUpErr.message)
      if (!signUpData.session) {
        throw new Error(
          'Conta criada, mas é necessário confirmar o e-mail antes de prosseguir. Verifique sua caixa de entrada.',
        )
      }

      const cpfDigits = onlyDigits(form.cpf)
      const { data: partnerRow, error: rpcErr } = await supabase.rpc('partner_self_register', {
        p_cpf: cpfDigits || null,
        p_dados_bancarios: null,
      })

      if (rpcErr) throw new Error(rpcErr.message)
      if (!partnerRow) throw new Error('Não foi possível criar o registro de parceiro.')

      const id = (partnerRow as { id: string }).id
      setPartnerId(id)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no cadastro.')
    } finally {
      setLoading(false)
    }
  }

  function goToReview() {
    setStep(3)
  }

  function finish() {
    navigate('/acesso-pendente', { replace: true })
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-5">
      <div className="col-span-2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex justify-center">
            <Logo />
          </div>
          <div className="card p-8">
            <div className="mb-6 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-red-600">Cadastro de Parceiro</span>
              <span className="text-silver-500">Passo {step} de 3</span>
            </div>

            {step === 1 && (
              <>
                <h1 className="text-2xl font-bold text-navy">Crie sua conta</h1>
                <p className="mt-1 text-sm text-silver-600">
                  Comece informando seus dados de acesso. Você anexa os documentos no próximo passo.
                </p>

                <form onSubmit={handleSignup} className="mt-6 space-y-4">
                  <div>
                    <label className="label">Nome completo</label>
                    <input
                      className="input"
                      value={form.nome}
                      onChange={(e) => setField('nome', e.target.value)}
                      placeholder="João Silva"
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">E-mail</label>
                      <input
                        className="input"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={(e) => setField('email', e.target.value)}
                        placeholder="voce@empresa.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Telefone</label>
                      <input
                        className="input"
                        value={form.telefone}
                        onChange={(e) => setField('telefone', e.target.value)}
                        placeholder="(11) 9XXXX-XXXX"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">CPF</label>
                    <input
                      className="input"
                      value={form.cpf}
                      onChange={(e) => setField('cpf', maskCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      maxLength={14}
                      required
                    />
                    {form.cpf && !isValidCpf(form.cpf) && (
                      <p className="mt-1 text-xs text-danger">CPF inválido.</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Senha</label>
                      <input
                        className="input"
                        type="password"
                        autoComplete="new-password"
                        value={form.password}
                        onChange={(e) => setField('password', e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Confirmar senha</label>
                      <input
                        className="input"
                        type="password"
                        autoComplete="new-password"
                        value={form.confirm}
                        onChange={(e) => setField('confirm', e.target.value)}
                        placeholder="Repita a senha"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                      {error}
                    </p>
                  )}

                  <button type="submit" className="btn-gold w-full" disabled={loading}>
                    {loading ? 'Criando conta...' : 'Criar conta e prosseguir'}
                  </button>

                  <p className="text-center text-sm text-silver-600">
                    Já tem conta?{' '}
                    <Link to="/p/login" className="font-medium text-navy underline">
                      Faça login
                    </Link>
                  </p>
                </form>
              </>
            )}

            {step === 2 && partnerId && (
              <>
                <h1 className="text-2xl font-bold text-navy">Anexe seus documentos</h1>
                <p className="mt-1 text-sm text-silver-600">
                  Precisamos do contrato social e do cartão CNPJ para validar sua empresa.
                </p>

                <div className="mt-6">
                  <PartnerDocsUploader
                    partnerId={partnerId}
                    slots={DOC_SLOTS}
                    onComplete={() => setDocsOk(true)}
                  />
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={goToReview}
                    className="btn-gold w-full disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!docsOk}
                  >
                    {docsOk ? 'Enviar para análise' : 'Anexe os documentos obrigatórios'}
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h1 className="text-2xl font-bold text-navy">Cadastro enviado!</h1>
                  <p className="mt-2 text-sm text-silver-600">
                    Sua conta foi criada e os documentos estão em análise. Você receberá um e-mail assim que a
                    aprovação for concluída.
                  </p>

                  <button type="button" onClick={finish} className="btn-gold mt-6 w-full">
                    Acompanhar status
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative col-span-3 hidden lg:block">
        <img src={partnerRegister} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/70" />
        
        <div className="relative flex h-full flex-col justify-end p-16 text-white">
          <h2 className="max-w-xl text-4xl font-bold leading-tight">
            Comece a operar com a <span className="text-red-600">Mercurio Capital</span>.
          </h2>
          <p className="mt-4 max-w-lg text-white/80">
            Cadastre sua empresa, envie a documentação e ganhe acesso à esteira completa de crédito imobiliário.
          </p>
          <div className="mt-12 flex gap-6 text-sm">
            <div>
              <p className="text-3xl font-bold text-red-600">3 passos</p>
              <p className="text-white/60">para começar</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-600">24h</p>
              <p className="text-white/60">para análise</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-600">0%</p>
              <p className="text-white/60">de taxa de adesão</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
