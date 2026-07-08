import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('desktop main entry route', () => {
  it('mantem DESKTOP_INITIAL_PATH em /p/login para dev e app empacotado', () => {
    const mainSource = readFileSync(path.resolve(process.cwd(), 'desktop/electron/main.cjs'), 'utf-8')

    expect(mainSource).toContain("const DESKTOP_INITIAL_PATH = '/p/login';")
    expect(mainSource).toContain('win.loadURL(new URL(DESKTOP_INITIAL_PATH, `${DEV_SERVER_URL}/`).toString());')
    expect(mainSource).toContain('initialPath: DESKTOP_INITIAL_PATH,')
  })
})