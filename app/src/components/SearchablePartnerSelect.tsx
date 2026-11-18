import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

export type PartnerSelectOption = {
  partner_id: string
  nome: string | null
  email: string | null
  status: string
}

const STATUS_LABEL: Record<string, string> = {
  approved: 'Aprovado',
  pending: 'Pendente',
}

export function SearchablePartnerSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione um parceiro',
  disabled = false,
  id,
}: {
  options: PartnerSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listId = `${inputId}-listbox`
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const selected = options.find(option => option.partner_id === value)
  const displayName = selected?.nome || selected?.email || ''

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    if (!term) return options
    return options.filter(option => `${option.nome ?? ''} ${option.email ?? ''} ${STATUS_LABEL[option.status] ?? option.status}`
      .toLocaleLowerCase('pt-BR').includes(term))
  }, [options, query])

  function choose(option: PartnerSelectOption) {
    onChange(option.partner_id)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex(index => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && open && filtered[activeIndex]) {
      event.preventDefault()
      choose(filtered[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">Buscar parceiro por nome ou e-mail</label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          className="input w-full pl-9 pr-9"
          value={open ? query : displayName}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => { setOpen(true); setQuery(''); setActiveIndex(0) }}
          onChange={event => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); onChange('') }}
          onKeyDown={onKeyDown}
          onBlur={() => window.setTimeout(() => { setOpen(false); setQuery('') }, 100)}
        />
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label="Parceiros" className="absolute z-[80] mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-silver-200 bg-white p-1 shadow-xl">
          {filtered.length ? filtered.map((option, index) => (
            <li
              id={`${listId}-${index}`}
              key={option.partner_id}
              role="option"
              aria-selected={option.partner_id === value}
              className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left ${index === activeIndex ? 'bg-silver-100' : 'hover:bg-silver-50'}`}
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-silver-900">{option.nome || option.email || option.partner_id}</span>
                {option.email && <span className="block truncate text-xs text-silver-500">{option.email}</span>}
              </span>
              <span className="ml-3 flex shrink-0 items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-silver-500">{STATUS_LABEL[option.status] ?? option.status}</span>
                {option.partner_id === value && <Check aria-hidden="true" className="h-4 w-4 text-red-600" />}
              </span>
            </li>
          )) : (
            <li className="px-3 py-4 text-center text-sm text-silver-500" role="status">Nenhum parceiro corresponde à busca.</li>
          )}
        </ul>
      )}
    </div>
  )
}
