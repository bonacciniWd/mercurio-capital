import type { SimuladorCreditoValues } from '@/components/SimuladorCredito'

export const SIMULACAO_DRAFT_KEY = 'mercurio.simulacaoDraft'

export interface SimulacaoDraft extends SimuladorCreditoValues {
  produto: 'home_equity' | 'credito_construcao' | 'financiamento_imobiliario'
  pessoa_tipo: 'PF' | 'PJ'
}

export function saveSimulacaoDraft(draft: SimulacaoDraft) {
  sessionStorage.setItem(SIMULACAO_DRAFT_KEY, JSON.stringify(draft))
}

export function consumeSimulacaoDraft(): SimulacaoDraft | null {
  try {
    const raw = sessionStorage.getItem(SIMULACAO_DRAFT_KEY)
    if (!raw) return null
    sessionStorage.removeItem(SIMULACAO_DRAFT_KEY)
    return JSON.parse(raw) as SimulacaoDraft
  } catch {
    sessionStorage.removeItem(SIMULACAO_DRAFT_KEY)
    return null
  }
}