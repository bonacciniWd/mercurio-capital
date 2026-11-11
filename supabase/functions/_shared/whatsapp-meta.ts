// Compare only provider-controlled template content, ignoring examples and transport metadata.
export function templateSignature(components: unknown): string {
  if (!Array.isArray(components)) return ''
  return JSON.stringify(components.map(c => ({ type: c.type, ...(c.text ? { text: c.text } : {}), ...(Array.isArray(c.buttons) ? { buttons: c.buttons.map((b: { type: string; text?: string; url?: string }) => ({ type: b.type, text: b.text, url: b.url })) } : {}) })))
}
export function approvedMetaTemplate(local: { nome_meta: string; idioma: string; categoria: string; componentes: unknown }, remote: { name?: string; language?: string; category?: string; components?: unknown; status?: string }): boolean {
 return remote.name === local.nome_meta && remote.language === local.idioma && remote.category === local.categoria && templateSignature(local.componentes) === templateSignature(remote.components)
}

export type MetaTemplateMatch =
 | { status: 'match'; template: { id: string; name: string; language: string; category: string; components: unknown; status: string } }
 | { status: 'not_found' | 'ambiguous' | 'mismatch' }

export function matchMetaTemplate(
 local: { nome_meta: string; idioma: string; categoria: string; componentes: unknown },
 candidates: unknown,
): MetaTemplateMatch {
 if (!Array.isArray(candidates)) return { status: 'not_found' }
 const named = candidates.filter((item): item is Record<string, unknown> =>
  Boolean(item && typeof item === 'object' && !Array.isArray(item)) &&
  (item as Record<string, unknown>).name === local.nome_meta &&
  (item as Record<string, unknown>).language === local.idioma,
 )
 if (named.length === 0) return { status: 'not_found' }
 if (named.length !== 1) return { status: 'ambiguous' }
 const candidate = named[0]
 if (typeof candidate.id !== 'string' || !/^\d+$/.test(candidate.id)) return { status: 'mismatch' }
 const remote = {
  name: typeof candidate.name === 'string' ? candidate.name : undefined,
  language: typeof candidate.language === 'string' ? candidate.language : undefined,
  category: typeof candidate.category === 'string' ? candidate.category : undefined,
  components: candidate.components,
  status: typeof candidate.status === 'string' ? candidate.status : undefined,
 }
 if (!approvedMetaTemplate(local, remote) || !remote.status) return { status: 'mismatch' }
 return {
  status: 'match',
  template: {
   id: candidate.id,
   name: remote.name!,
   language: remote.language!,
   category: remote.category!,
   components: remote.components,
   status: remote.status,
  },
 }
}
