// Regras puras do banner de opt-in push (issue #14): contagem de sessões,
// backoff de dismiss e persistência por usuário em localStorage.
// Extraídas do componente para ficarem testáveis e manter fast refresh limpo.

export const SESSIONS_PREFIX = 'mercurio:push_sessions_v1:'
export const PROMPT_PREFIX = 'mercurio:push_prompt_v1:'
const JANELA_SESSAO_MS = 12 * 60 * 60 * 1000 // 12h — refresh não infla contador
const REEXIBIR_APOS_MS = 14 * 24 * 60 * 60 * 1000 // 14 dias
const MAX_DISMISSES = 3

export interface PromptState { v: 1; dismisses: number; last: string | null; never: boolean }

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage indisponível — prompt simplesmente não persiste estado
  }
}

// Conta sessões com janela mínima; retorna o total atualizado.
export function contarSessao(userId: string, now = Date.now()): number {
  const key = SESSIONS_PREFIX + userId
  const prev = readJson<{ count: number; last: number }>(key) ?? { count: 0, last: 0 }
  const next = now - prev.last >= JANELA_SESSAO_MS ? { count: prev.count + 1, last: now } : prev
  writeJson(key, next)
  return next.count
}

export function deveExibirPrompt(userId: string, now = Date.now()): boolean {
  const state = readJson<PromptState>(PROMPT_PREFIX + userId)
  if (state?.never) return false
  if ((state?.dismisses ?? 0) >= MAX_DISMISSES) return false
  if (state?.last && now - Date.parse(state.last) < REEXIBIR_APOS_MS) return false
  return contarSessao(userId, now) >= 2
}

export function marcarPrompt(userId: string, patch: Partial<PromptState>): void {
  const prev = readJson<PromptState>(PROMPT_PREFIX + userId) ?? { v: 1 as const, dismisses: 0, last: null, never: false }
  writeJson(PROMPT_PREFIX + userId, { ...prev, ...patch })
}

