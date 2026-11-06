export type MerxFaqItem = {
  id: string
  question: string
  answer: string
  keywords: string[]
}

export type MerxInterest = 'atendimento' | 'home_equity' | 'construcao' | 'financiamento_imobiliario' | 'parceiro_originador'

export const MERX_INTEREST_LABELS: Record<MerxInterest, string> = {
  atendimento: 'Atendimento geral',
  home_equity: 'Home Equity',
  construcao: 'Crédito para Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
  parceiro_originador: 'Potencial parceiro originador',
}

export const DEFAULT_MERX_FAQ: MerxFaqItem[] = [
  {
    id: 'saudacao',
    question: 'Oi / olá',
    answer: 'Oi! Posso apresentar o workspace para parceiros ou orientar quem está buscando crédito. Qual caminho faz sentido para você?',
    keywords: ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem'],
  },
  {
    id: 'workspace-parceiro',
    question: 'O que é o workspace Mercúrio para parceiros?',
    answer: 'É a área de trabalho para parceiros organizarem oportunidades, criarem e acompanharem propostas e acessarem recursos de acordo com seu perfil e aprovação.',
    keywords: ['workspace', 'plataforma', 'parceiro', 'originador', 'originação', 'origination'],
  },
  {
    id: 'captacao-lead',
    question: 'Como faço para falar com a equipe?',
    answer: 'Posso encaminhar seu pedido à equipe. Você escolhe se quer compartilhar seus dados e autoriza o contato antes de enviarmos a solicitação.',
    keywords: ['falar com a equipe', 'contato', 'captar lead', 'captação de lead', 'captacao de lead', 'captar cliente', 'gerar lead'],
  },
  {
    id: 'home-equity',
    question: 'Como funciona o Home Equity?',
    answer: 'É uma operação de crédito com imóvel em garantia. O simulador público apresenta uma estimativa; as condições dependem da análise do perfil, do imóvel e da política vigente.',
    keywords: ['home equity', 'imóvel', 'garantia'],
  },
  {
    id: 'construction',
    question: 'Crédito para construção',
    answer: 'O Crédito para Construção é voltado a construtores e investidores que desenvolvem casas de alto padrão para venda. A estrutura e eventuais liberações por etapa dependem da análise do projeto, orçamento, cronograma, garantias e políticas aplicáveis.',
    keywords: ['construção', 'obra', 'construir', 'cpc'],
  },
  {
    id: 'financiamento-imobiliario',
    question: 'Financiamento imobiliário',
    answer: 'A Mercúrio também apresenta financiamento para aquisição de imóvel residencial ou comercial pronto. Para entender as possibilidades e condições do seu caso, solicite contato da equipe.',
    keywords: ['financiamento imobiliário', 'financiamento imobiliario', 'aquisição', 'aquisição de imóvel'],
  },
  {
    id: 'simulation',
    question: 'Posso fazer uma simulação?',
    answer: 'Sim. O simulador público de Home Equity permite visualizar uma estimativa. A simulação não é uma aprovação nem uma proposta final.',
    keywords: ['simular', 'simulação', 'parcela'],
  },
]

export function normalizeMerxText(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findMerxAnswer(value: string, faq: MerxFaqItem[]) {
  const normalized = normalizeMerxText(value)
  if (!normalized) return undefined

  return faq.find(item => item.keywords.some(keyword => {
    const normalizedKeyword = normalizeMerxText(keyword)
    if (!normalizedKeyword) return false
    if (normalizedKeyword.length <= 3) {
      return normalized === normalizedKeyword || normalized.startsWith(`${normalizedKeyword} `)
    }
    return normalized.includes(normalizedKeyword)
  }))?.answer
}
