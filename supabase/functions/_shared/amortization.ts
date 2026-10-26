export type PublicExtraPlan = {
  valor_extra: number
  objetivo: 'prazo' | 'parcela'
  frequencia: 'unica' | 'mensal'
  apos_parcela: number
}

type Input = {
  valor: number
  prazo: number
  taxaMensal: number
  sistema: 'price' | 'sac'
  dataInicio: string
  planos: PublicExtraPlan[]
}

function pricePayment(balance: number, rate: number, months: number): number {
  if (months <= 0) return 0
  return rate === 0 ? balance / months : balance * rate / (1 - Math.pow(1 + rate, -months))
}

function addMonths(value: string, months: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1, 1, 12))
  target.setUTCMonth(target.getUTCMonth() + months)
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate()
  target.setUTCDate(Math.min(day, last))
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`
}

function run(input: Input, plans: PublicExtraPlan[]) {
  let balance = input.valor
  let price = pricePayment(input.valor, input.taxaMensal, input.prazo)
  let sacAmort = input.valor / input.prazo
  let totalPaid = 0
  let interestTotal = 0
  let extraTotal = 0
  let first = 0
  let last = 0
  let count = 0

  for (let month = 1; month <= input.prazo && balance > 0.000001; month += 1) {
    const interest = balance * input.taxaMensal
    const amortization = Math.min(balance, input.sistema === 'price' ? Math.max(0, price - interest) : sacAmort)
    const payment = interest + amortization
    balance = Math.max(0, balance - amortization)
    const activePlans = plans.filter(plan => month >= plan.apos_parcela && (plan.frequencia === 'mensal' || month === plan.apos_parcela))
    const extra = Math.min(balance, activePlans.reduce((sum, plan) => sum + plan.valor_extra, 0))
    balance = Math.max(0, balance - extra)

    if (month === 1) first = payment
    last = payment
    count = month
    totalPaid += payment + extra
    interestTotal += interest
    extraTotal += extra

    if (balance <= 0.000001) {
      balance = 0
      break
    }

    if (activePlans.some(plan => plan.objetivo === 'parcela')) {
      const remaining = input.prazo - month
      if (remaining > 0) {
        if (input.sistema === 'price') price = pricePayment(balance, input.taxaMensal, remaining)
        else sacAmort = balance / remaining
      }
    }
  }

  return {
    total_pago: totalPaid,
    total_juros: interestTotal,
    total_amortizado_extra: extraTotal,
    quantidade_parcelas: count,
    primeira_parcela: first,
    ultima_parcela: last,
    data_quitacao: addMonths(input.dataInicio, count),
  }
}

export function calculatePublicAmortization(input: Input) {
  const base = run(input, [])
  const withExtra = run(input, input.planos)
  return {
    sem_antecipacao: {
      total_pago: base.total_pago,
      total_juros: base.total_juros,
      quantidade_parcelas: base.quantidade_parcelas,
      primeira_parcela: base.primeira_parcela,
      ultima_parcela: base.ultima_parcela,
      data_quitacao: base.data_quitacao,
    },
    com_antecipacao: withExtra,
    economia_juros: base.total_juros - withExtra.total_juros,
    parcelas_reduzidas: Math.max(0, base.quantidade_parcelas - withExtra.quantidade_parcelas),
  }
}
