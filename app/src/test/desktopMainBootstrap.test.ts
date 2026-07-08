import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('desktop main bootstrap order', () => {
  it('aplica initialPath antes de criar o router', () => {
    const mainSource = readFileSync(path.resolve(process.cwd(), 'src/main.tsx'), 'utf-8')

    const applyInitialPathIndex = mainSource.indexOf('applyDesktopInitialPath()')
    const createRouterIndex = mainSource.indexOf('const router = createAppRouter()')

    expect(applyInitialPathIndex).toBeGreaterThanOrEqual(0)
    expect(createRouterIndex).toBeGreaterThanOrEqual(0)
    expect(applyInitialPathIndex).toBeLessThan(createRouterIndex)
  })
})