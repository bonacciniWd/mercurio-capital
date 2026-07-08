import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('router login redirect', () => {
  it('mantem /login como alias com redirect para /p/login', () => {
    const routerSource = readFileSync(path.resolve(process.cwd(), 'src/router.tsx'), 'utf-8')

    expect(routerSource).toContain("{ path: '/login', element: <Navigate to=\"/p/login\" replace /> },")
  })
})