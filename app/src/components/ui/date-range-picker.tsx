import { useEffect, useState, type CSSProperties } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react'
import { DayPicker, getDefaultClassNames, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { localDateISO } from '@/lib/financeiro'
import { cn } from '@/lib/utils'

const defaultClassNames = getDefaultClassNames()

export function DateRangePicker({
  start,
  end,
  onChange,
}: {
  start: string
  end: string
  onChange: (start: string, end: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>({ from: parseISO(start), to: parseISO(end) })
  const label = `${format(parseISO(start), 'dd MMM yyyy', { locale: ptBR })} — ${format(parseISO(end), 'dd MMM yyyy', { locale: ptBR })}`

  useEffect(() => {
    setDraft({ from: parseISO(start), to: parseISO(end) })
  }, [start, end])

  function apply() {
    if (!draft?.from || !draft.to) return
    onChange(localDateISO(draft.from), localDateISO(draft.to))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-[250px] justify-start font-normal">
          <CalendarDays className="h-4 w-4 text-silver-500" />
          <span className="capitalize">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-auto" align="end">
        <DayPicker
          mode="range"
          locale={ptBR}
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={2}
          defaultMonth={draft?.from ?? new Date()}
          disabled={{ after: addDays(new Date(), 365) }}
          style={{
            '--rdp-accent-color': '#B91C1C',
            '--rdp-accent-background-color': '#FEF2F2',
            '--rdp-range_middle-background-color': '#FEF2F2',
            '--rdp-range_middle-color': '#343A40',
            '--rdp-range_start-date-background-color': '#B91C1C',
            '--rdp-range_end-date-background-color': '#B91C1C',
            '--rdp-today-color': '#B91C1C',
          } as CSSProperties}
          classNames={{
            months: cn(defaultClassNames.months, 'flex flex-col gap-4 sm:flex-row'),
            month_caption: cn(defaultClassNames.month_caption, 'mb-3 flex h-8 items-center justify-center font-semibold text-silver-900'),
            nav: cn(defaultClassNames.nav, 'absolute inset-x-3 top-3 flex justify-between'),
            button_previous: cn(defaultClassNames.button_previous, 'btn-no-liquid rounded-md p-1.5 text-silver-500 hover:bg-silver-100'),
            button_next: cn(defaultClassNames.button_next, 'btn-no-liquid rounded-md p-1.5 text-silver-500 hover:bg-silver-100'),
            month_grid: cn(defaultClassNames.month_grid, 'border-collapse text-sm'),
            weekdays: cn(defaultClassNames.weekdays, 'text-silver-500'),
            weekday: cn(defaultClassNames.weekday, 'w-9 pb-2 text-center text-xs font-normal'),
            day: cn(defaultClassNames.day, 'h-9 w-9 p-0 text-center'),
            day_button: cn(defaultClassNames.day_button, 'btn-no-liquid h-9 w-9 rounded-md text-sm font-normal hover:bg-red-50'),
            selected: cn(defaultClassNames.selected, 'font-semibold'),
            range_start: cn(defaultClassNames.range_start, 'text-white'),
            range_middle: cn(defaultClassNames.range_middle, 'text-silver-900'),
            range_end: cn(defaultClassNames.range_end, 'text-white'),
            today: cn(defaultClassNames.today, 'font-bold text-red-700'),
            outside: cn(defaultClassNames.outside, 'text-silver-300'),
            disabled: cn(defaultClassNames.disabled, 'text-silver-300 opacity-50'),
          }}
        />
        <div className="mt-3 flex items-center justify-between border-t border-silver-100 pt-3">
          <p className="text-xs text-silver-500">Selecione a data inicial e final.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" variant="primary" disabled={!draft?.from || !draft.to} onClick={apply}>Aplicar período</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
