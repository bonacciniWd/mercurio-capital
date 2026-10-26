import { Search, X } from 'lucide-react'

export function NetworkSearch({ value, onChange, items, onSelect, placeholder }: {
  value: string
  onChange: (value: string) => void
  items: Array<{ id: string; label: string; detail?: string }>
  onSelect: (id: string) => void
  placeholder: string
}) {
  const matches = value.trim() ? items.filter(item => `${item.label} ${item.detail ?? ''}`.toLocaleLowerCase('pt-BR').includes(value.trim().toLocaleLowerCase('pt-BR'))) : []
  function select(id: string) { onSelect(id); onChange('') }
  return <div className="network-search">
    <label><Search size={16} /><input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && matches[0]) { event.preventDefault(); select(matches[0].id) } if (event.key === 'Escape') onChange('') }} />{value && <button className="btn-no-liquid" type="button" aria-label="Limpar busca" onClick={() => onChange('')}><X size={14} /></button>}</label>
    {value.trim() && <div className="network-search__results" aria-label="Resultados da busca">{matches.length ? matches.slice(0, 8).map(item => <button className="btn-no-liquid" type="button" key={item.id} onClick={() => select(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>) : <p>Nenhum resultado encontrado.</p>}</div>}
  </div>
}
