import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(appRoot, '..')

const packageJson = JSON.parse(await readFile(path.join(appRoot, 'package.json'), 'utf8'))
const packageLock = JSON.parse(await readFile(path.join(appRoot, 'package-lock.json'), 'utf8'))
const version = packageJson.version

const errors = []
const semverPattern = /^\d+\.\d+\.\d+$/

if (!semverPattern.test(version)) {
  errors.push(`app/package.json possui versao SemVer invalida: ${version}`)
}

const lockVersions = [packageLock.version, packageLock.packages?.['']?.version]
for (const lockVersion of lockVersions) {
  if (lockVersion !== version) {
    errors.push(`app/package-lock.json (${lockVersion ?? 'ausente'}) difere de app/package.json (${version})`)
  }
}

const docs = [
  'docs/operacao/change-management.md',
  'docs/operacao/release-checklist.md',
]

for (const relativePath of docs) {
  const contents = await readFile(path.join(repoRoot, relativePath), 'utf8')
  const match = contents.match(/RELEASE_CURRENT_VERSION:\s*(\d+\.\d+\.\d+)/)

  if (!match) {
    errors.push(`${relativePath} nao possui marcador RELEASE_CURRENT_VERSION`)
  } else if (match[1] !== version) {
    errors.push(`${relativePath} declara ${match[1]}, mas app/package.json declara ${version}`)
  }
}

const landingPath = 'app/src/pages/Landing.tsx'
const landingContents = await readFile(path.join(repoRoot, landingPath), 'utf8')
const landingVersionMatch = landingContents.match(
  /className="build-version"[^>]*>v(\d+\.\d+\.\d+)<\/span>/,
)

if (!landingVersionMatch) {
  errors.push(`${landingPath} nao possui versao no elemento build-version`)
} else if (landingVersionMatch[1] !== version) {
  errors.push(`${landingPath} exibe v${landingVersionMatch[1]}, mas app/package.json declara ${version}`)
}

const releaseTag = process.env.RELEASE_TAG || (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : '')
if (releaseTag && releaseTag !== `v${version}`) {
  errors.push(`tag ${releaseTag} difere da versao esperada v${version}`)
}

if (errors.length > 0) {
  console.error('Falha na consistencia de release:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`Consistencia de release validada para v${version}.`)
}
