import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import asar from '@electron/asar'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifactRoot = process.env.DESKTOP_RUNTIME_ARTIFACT_DIR
  ? path.resolve(process.env.DESKTOP_RUNTIME_ARTIFACT_DIR)
  : path.join(appRoot, 'desktop', 'artifacts')
const appPackage = JSON.parse(await readFile(path.join(appRoot, 'package.json'), 'utf8'))
const expectedVersion = process.env.DESKTOP_RUNTIME_VERSION || appPackage.version
const { listPackage, extractFile } = asar
const targets = {
  'mac-x64': 'mac/Mercurio Capital.app/Contents/Resources/app.asar',
  'mac-arm64': 'mac-arm64/Mercurio Capital.app/Contents/Resources/app.asar',
  'win-x64': 'win-unpacked/resources/app.asar',
  'linux-x64': 'linux-unpacked/resources/app.asar',
}
const requested = (process.argv[2] || process.env.DESKTOP_RUNTIME_TARGETS || Object.keys(targets).join(',')).split(',')

function readJson(archivePath, archiveFile) {
  return JSON.parse(extractFile(archivePath, archiveFile.replace(/^\/+/, '')).toString('utf8'))
}

function resolvePackage(files, consumerDirectory, dependencyName) {
  let directory = consumerDirectory
  while (true) {
    const candidate = path.posix.join(directory, 'node_modules', dependencyName)
    const manifestPath = path.posix.join(candidate, 'package.json')
    if (files.has(manifestPath)) return { directory: candidate, manifestPath }
    const parent = path.posix.dirname(directory)
    if (parent === directory) return null
    directory = parent
  }
}

function verifyUpdaterDependencyTree(archivePath) {
  const files = new Set(listPackage(archivePath))
  const updaterPath = '/node_modules/electron-updater/package.json'
  if (!files.has(updaterPath)) throw new Error('electron-updater nao esta no ASAR')

  const pending = [{ directory: '/node_modules/electron-updater', manifestPath: updaterPath }]
  const visited = new Set()
  const checked = new Set()

  while (pending.length > 0) {
    const current = pending.pop()
    if (visited.has(current.manifestPath)) continue
    visited.add(current.manifestPath)

    const manifest = readJson(archivePath, current.manifestPath)
    const main = manifest.main || 'index.js'
    const normalizedMain = path.posix.normalize(path.posix.join(current.directory, main))
    const mainExists = [
      normalizedMain,
      `${normalizedMain}.js`,
      `${normalizedMain}.json`,
      path.posix.join(normalizedMain, 'index.js'),
    ].some((candidate) => files.has(candidate))
    if (!mainExists) {
      throw new Error(`${manifest.name}: entrypoint ausente (${normalizedMain})`)
    }

    checked.add(`${manifest.name}@${manifest.version}`)
    for (const dependencyName of Object.keys(manifest.dependencies || {})) {
      const resolved = resolvePackage(files, current.directory, dependencyName)
      if (!resolved) {
        throw new Error(`${manifest.name}: dependencia runtime ausente: ${dependencyName}`)
      }
      pending.push(resolved)
    }
  }

  return [...checked].sort()
}

for (const target of requested) {
  try {
    if (!targets[target]) throw new Error(`Alvo desconhecido: ${target}`)
    const archivePath = path.join(artifactRoot, targets[target])
    const manifest = readJson(archivePath, 'package.json')
    if (manifest.version !== expectedVersion) throw new Error(`Versao ${manifest.version}, esperada ${expectedVersion}`)
    const files = new Set(listPackage(archivePath))
    for (const required of ['/desktop/electron/main.cjs', '/desktop/electron/updater.cjs', '/desktop/electron/preload.cjs', '/dist/index.html']) {
      if (!files.has(required)) throw new Error(`Arquivo necessario ausente: ${required}`)
    }
    const dependencies = verifyUpdaterDependencyTree(archivePath)
    console.log(`${target}: runtime ${expectedVersion} aprovado; ${dependencies.length} pacotes do updater resolvidos`)
  } catch (error) {
    console.error(`${target}: ${error.message}`)
    process.exitCode = 1
  }
}
