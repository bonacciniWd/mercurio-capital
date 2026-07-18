export type TemplatePreset = Record<string, string>

export const EMAIL_TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  convite_equipe_v1: {
    nome: 'Marina Souza',
    email: 'marina@empresa.com.br',
    parceiro_exibicao: 'Parceiro Mercurio',
    equipe_nome: 'Equipe Comercial',
    convite_link: 'https://mercuriocapitalsa.com.br/convite/token-exemplo',
    expires_in_min: '30',
  },
  proposta_cliente_magic_link_v1: {
    cliente_nome: 'Carlos Almeida',
    protocolo: 'MERC-2026-000123',
    produto: 'Home Equity',
    valor_solicitado: 'R$ 350.000,00',
    magic_link: 'https://mercuriocapitalsa.com.br/c/proposta/token-exemplo',
    expires_in_min: '30',
  },
  proposta_status_changed_v1: {
    cliente_nome: 'Carlos Almeida',
    protocolo: 'MERC-2026-000123',
    status_anterior: 'Pré-análise',
    status_novo: 'Análise jurídica',
  },
}

export const CRITICAL_EMAIL_TEMPLATES = new Set(Object.keys(EMAIL_TEMPLATE_PRESETS))

export function extractTemplatePlaceholders(...values: Array<string | null | undefined>): string[] {
  const placeholders = new Set<string>()
  const pattern = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g

  for (const value of values) {
    if (!value) continue
    for (const match of value.matchAll(pattern)) placeholders.add(match[1])
  }

  return [...placeholders].sort()
}

export function renderTemplatePreview(value: string, variables: TemplatePreset): string {
  return value.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, key: string) => variables[key] ?? `{{${key}}}`)
}

export function presetForTemplate(code: string, variables: string[]): TemplatePreset {
  const knownPreset = EMAIL_TEMPLATE_PRESETS[code]
  if (knownPreset) return { ...knownPreset }

  return Object.fromEntries(variables.map(variable => [variable, `Exemplo: ${variable}`]))
}
