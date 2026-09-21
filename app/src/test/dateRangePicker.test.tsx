import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateRangePicker } from '@/components/ui/date-range-picker'

describe('DateRangePicker', () => {
  it('diferencia começo, meio e fim sem aplicar vermelho sólido ao intervalo inteiro', () => {
    const { container } = render(
      <DateRangePicker start="2026-09-01" end="2026-09-05" onChange={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /01 set 2026/i }))

    const start = document.querySelector('[data-day="2026-09-01"]')
    const middle = document.querySelector('[data-day="2026-09-03"]')
    const end = document.querySelector('[data-day="2026-09-05"]')

    expect(container).toBeInTheDocument()
    expect(start?.className).toContain('rdp-range_start')
    expect(middle?.className).toContain('rdp-range_middle')
    expect(end?.className).toContain('rdp-range_end')
    expect(middle?.className).not.toContain('bg-red-700')
    expect(middle?.className).toContain('text-silver-900')
  })
})
