import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const placeholders = html => [...new Set([...html.matchAll(/{{\s*([A-Za-z0-9_.]+)\s*}}/g)].map(match => match[1]))].sort()
const imageUrls = {
  '01.png': 'https://www.mercuriocapitalsa.com.br/01.png',
  '02.png': 'https://www.mercuriocapitalsa.com.br/02.png',
  '03.png': 'https://www.mercuriocapitalsa.com.br/03.png',
}

for (const name of Object.keys(imageUrls)) {
  const asset = new URL(`../../app/public/${name}`, import.meta.url)
  assert.ok(statSync(asset).size > 0, `asset público ${name} ausente ou vazio`)
}

const authTemplates = {
  'templates/auth/confirmation.html': ['.ConfirmationURL'],
  'templates/auth/invite.html': ['.ConfirmationURL', '.Email'],
  'templates/auth/magic_link.html': ['.ConfirmationURL'],
  'templates/auth/recovery.html': ['.ConfirmationURL'],
  'templates/auth/email_change.html': ['.ConfirmationURL', '.NewEmail'],
  'templates/auth/reauthentication.html': ['.Token'],
}

for (const [path, expected] of Object.entries(authTemplates)) {
  const html = read(path)
  assert.deepEqual(placeholders(html), [...expected].sort(), `${path}: placeholders Auth incorretos`)
  const expectedImage = path.endsWith('/invite.html') ? imageUrls['01.png'] : imageUrls['02.png']
  assert.ok(html.includes(expectedImage), `${path}: imagem de cabeçalho incorreta`)
  assert.match(html, /alt="Mercúrio Capital"/, `${path}: texto alternativo da imagem ausente`)
  assert.doesNotMatch(html, /call-to-DyM9aWlp\.png/, `${path}: imagem promocional antiga ainda referenciada`)
  assert.doesNotMatch(html, /href="#"/, `${path}: link vazio`)
}

const transactionalTemplates = {
  'templates/transacional/simulacao-parcelas-resultado.html': ['contato_url', 'nome', 'parcela_estimada', 'prazo_meses', 'valor_credito'],
  'templates/transacional/simulacao-amortizacao-resultado.html': ['contato_url', 'nome', 'primeira_parcela', 'quantidade_parcelas', 'sistema_amortizacao', 'total_juros', 'valor_credito'],
}

const migration = read('migrations/20261020000001_brand_simulador_result_email_templates.sql')
const imageMigration = read('migrations/20261020000002_email_template_brand_images.sql')
for (const [path, expected] of Object.entries(transactionalTemplates)) {
  const html = read(path)
  assert.deepEqual(placeholders(html), [...expected].sort(), `${path}: placeholders transacionais incorretos`)
  assert.ok(html.includes(imageUrls['03.png']), `${path}: imagem de cabeçalho incorreta`)
  assert.doesNotMatch(html, /call-to-DyM9aWlp\.png/, `${path}: imagem promocional antiga ainda referenciada`)
  for (const variable of expected) assert.match(migration, new RegExp(`'${variable}'`), `migration: variável ${variable} ausente`)
}

for (const code of ['simulacao_publica_resultado_v1', 'simulacao_publica_amortizacao_resultado_v1']) {
  assert.ok(migration.includes(`'${code}'`), `migration: template ${code} ausente`)
}

const imageMappings = {
  simulacao_publica_resultado_v1: '03.png',
  simulacao_publica_amortizacao_resultado_v1: '03.png',
  proposta_cliente_magic_link_v1: '03.png',
  proposta_status_changed_v1: '03.png',
  simulacao_publica_novo_lead_interno_v1: '02.png',
  simulacao_publica_amortizacao_novo_lead_interno_v1: '02.png',
  convite_equipe_v1: '02.png',
}
for (const [code, image] of Object.entries(imageMappings)) {
  assert.ok(imageMigration.includes(`('${code}', '${imageUrls[image]}')`), `migration de imagens: mapeamento de ${code} incorreto`)
}

const partnerResend = readFileSync(new URL('../functions/admin-partner-invite-resend/index.ts', import.meta.url), 'utf8')
assert.ok(partnerResend.includes(imageUrls['01.png']), 'reenvio de convite de parceiro: imagem 01 ausente')
assert.match(partnerResend, /escapeHtml\(actionLink\)/, 'reenvio de convite: link precisa continuar escapado')
assert.match(partnerResend, /escapeHtml\(nome\)/, 'reenvio de convite: nome precisa continuar escapado')

const config = read('config.toml')
for (const path of Object.keys(authTemplates)) {
  assert.ok(config.includes(`./supabase/${path}`), `config.toml: content_path ${path} ausente`)
}

console.log('Templates de e-mail validados: placeholders, mapeamento de imagens, links, migrations e caminhos Auth.')
