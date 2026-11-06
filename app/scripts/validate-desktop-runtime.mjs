import { readdir, readFile } from 'node:fs/promises'
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

async function findAsars(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }

  const found = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory() && entry.name.endsWith('.app')) {
      const candidate = path.join(entryPath, 'Contents', 'Resources', 'app.asar')
      try {
        await readFile(candidate)
        found.push({ archivePath: candidate, appPath: entryPath })
      } catch {
        // Nem todo app antigo/temporário possui um ASAR completo.
      }
      continue
    }
    if (entry.isDirectory()) found.push(...(await findAsars(entryPath)))
  }
  return found
}

function readJson(archivePath, archiveFile) {
  return JSON.parse(extractFile(archivePath, archiveFile.replace(/^\/+/, '')).toString('utf8'))
}

async function readAppVersion(appPath) {
  const plist = await readFile(path.join(appPath, 'Contents', 'Info.plist'), 'utf8')
  return plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1]
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

const archives = await findAsars(artifactRoot)
const releaseArchives = []
for (const candidate of archives) {
  try {
    if (await readAppVersion(candidate.appPath) === expectedVersion) releaseArchives.push(candidate.archivePath)
  } catch {
    // ASARs fora do app Mercurio sao ignorados.
  }
}

if (releaseArchives.length === 0) {
  console.error(`Nenhum app.asar da versao ${expectedVersion} foi encontrado em ${artifactRoot}`)
  process.exitCode = 1
} else {
  if (process.env.DESKTOP_RUNTIME_SKIP_ARCH_COUNT !== '1' && releaseArchives.length !== 2) {
    console.error(`Esperados 2 apps macOS da versao ${expectedVersion} (Intel e ARM); encontrados ${releaseArchives.length}`)
    process.exitCode = 1
  }
  for (const archivePath of releaseArchives) {
    try {
      const dependencies = verifyUpdaterDependencyTree(archivePath)
      console.log(`Updater runtime validado: ${archivePath}`)
      console.log(`Pacotes resolvidos: ${dependencies.length}`)
    } catch (error) {
      console.error(`Falha no runtime do updater em ${archivePath}: ${error.message}`)
      process.exitCode = 1
    }
  }
}
