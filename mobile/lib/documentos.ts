export type DocumentoTipo =
  | 'rg' | 'cpf' | 'cnh'
  | 'contrato_social'
  | 'comprovante_residencia'
  | 'comprovante_renda'
  | 'matricula_imovel' | 'iptu'
  | 'certidao_casamento' | 'certidao_nascimento'
  | 'irpf_declaracao' | 'irpf_recibo'
  | 'extrato_bancario' | 'demonstrativo_contabil'
  | 'ficha_cadastral_imovel' | 'fotos_imovel' | 'contrato_compra_venda'
  | 'outros'

export type DocCategoria = 'pessoa_fisica' | 'pessoa_juridica' | 'imovel'

export type DocStatus = 'pendente' | 'enviado' | 'aprovado' | 'rejeitado'

export const TIPO_LABEL: Record<DocumentoTipo, string> = {
  rg: 'RG',
  cpf: 'CPF',
  cnh: 'CNH',
  contrato_social: 'Contrato Social',
  comprovante_residencia: 'Comprovante de Residência',
  comprovante_renda: 'Comprovante de Renda',
  matricula_imovel: 'Matrícula do Imóvel',
  iptu: 'IPTU',
  certidao_casamento: 'Certidão de Casamento',
  certidao_nascimento: 'Certidão de Nascimento',
  irpf_declaracao: 'IRPF — Declaração',
  irpf_recibo: 'IRPF — Recibo',
  extrato_bancario: 'Extrato Bancário',
  demonstrativo_contabil: 'Demonstrativo Contábil',
  ficha_cadastral_imovel: 'Ficha Cadastral do Imóvel',
  fotos_imovel: 'Fotos do Imóvel',
  contrato_compra_venda: 'Contrato de Compra e Venda',
  outros: 'Outros',
}

export const CATEGORIA_LABEL: Record<DocCategoria, string> = {
  pessoa_fisica: 'Pessoa Física',
  pessoa_juridica: 'Pessoa Jurídica',
  imovel: 'Imóvel',
}

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
}

const IMOVEL_TIPOS: DocumentoTipo[] = [
  'matricula_imovel', 'iptu', 'ficha_cadastral_imovel', 'fotos_imovel', 'contrato_compra_venda',
]
const PJ_TIPOS: DocumentoTipo[] = ['contrato_social', 'demonstrativo_contabil']

/** Categoria default de armazenamento para um tipo (usada no path do bucket). */
export function categoriaForTipo(tipo: DocumentoTipo): DocCategoria {
  if (IMOVEL_TIPOS.includes(tipo)) return 'imovel'
  if (PJ_TIPOS.includes(tipo)) return 'pessoa_juridica'
  return 'pessoa_fisica'
}

export interface DocRowLite {
  proposta_id?: string
  categoria: DocCategoria
  tipo: DocumentoTipo
  storage_path: string | null
  status: DocStatus | null
  validado: boolean | null
}

export interface RequisitoRow {
  categoria: DocCategoria
  tipo: DocumentoTipo
  obrigatorio: boolean
  ordem: number
}

export interface ChecklistItem {
  propostaId: string
  categoria: DocCategoria
  tipo: DocumentoTipo
  obrigatorio: boolean
  ordem: number
  status: DocStatus
}

/**
 * Consolida placeholders + documentos reais em itens de checklist por
 * (proposta, categoria, tipo). O status considera o documento real quando existe.
 */
export function buildChecklist(docs: DocRowLite[], requisitos: RequisitoRow[]): ChecklistItem[] {
  const reqMap = new Map<string, RequisitoRow>()
  for (const r of requisitos) reqMap.set(`${r.categoria}:${r.tipo}`, r)

  const groups = new Map<string, DocRowLite[]>()
  for (const d of docs) {
    const key = `${d.proposta_id ?? ''}:${d.categoria}:${d.tipo}`
    const list = groups.get(key) ?? (groups.set(key, []), groups.get(key)!)
    list.push(d)
  }

  const items: ChecklistItem[] = []
  for (const [key, list] of groups) {
    const [propostaId, categoria, tipo] = key.split(':') as [string, DocCategoria, DocumentoTipo]
    const reais = list.filter((d) => d.storage_path)
    let status: DocStatus
    if (reais.some((d) => d.validado || d.status === 'aprovado')) status = 'aprovado'
    else if (reais.some((d) => d.status === 'rejeitado')) status = 'rejeitado'
    else if (reais.length > 0) status = 'enviado'
    else status = 'pendente'

    const req = reqMap.get(`${categoria}:${tipo}`)
    items.push({
      propostaId,
      categoria,
      tipo,
      obrigatorio: req?.obrigatorio ?? false,
      ordem: req?.ordem ?? 999,
      status,
    })
  }

  return items.sort((a, b) => a.ordem - b.ordem || a.tipo.localeCompare(b.tipo))
}

/** Conta requisitos obrigatórios ainda pendentes (ou rejeitados). */
export function countObrigatoriosPendentes(items: ChecklistItem[]): number {
  return items.filter((i) => i.obrigatorio && (i.status === 'pendente' || i.status === 'rejeitado')).length
}
