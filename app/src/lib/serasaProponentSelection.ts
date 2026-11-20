type ProponentSelection<T> =
  | { mode: 'none' }
  | { mode: 'automatic'; proponent: T }
  | { mode: 'choose'; proponents: T[] }

export function getSerasaProponentSelection<T>(
  tipo: 'serasa_pf' | 'serasa_pj',
  proponents: T[],
): ProponentSelection<T> {
  if (proponents.length === 0) return { mode: 'none' }
  if (tipo === 'serasa_pj' && proponents.length === 1) {
    return { mode: 'automatic', proponent: proponents[0] }
  }
  return { mode: 'choose', proponents }
}
