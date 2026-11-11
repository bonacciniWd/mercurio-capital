import test from 'node:test'
import assert from 'node:assert/strict'
import { canManagePartner, partnerSection, isPartnerPrimaryRoute } from '../lib/partnerAccess.ts'
import { queryClient, setQueryIdentity } from '../lib/queryClient.ts'

test('ações de gestão pertencem somente ao parceiro', () => {
  assert.equal(canManagePartner('partner'), true)
  for (const role of ['team_member', 'client', 'admin', null, undefined]) assert.equal(canManagePartner(role), false)
})

test('atalho de segurança abre a seção correta e parâmetros inválidos não ampliam acesso', () => {
  assert.equal(partnerSection('seguranca', 'partner'), 'seguranca')
  assert.equal(partnerSection('notificacoes', 'partner'), 'notificacoes')
  assert.equal(partnerSection(['integracoes'], 'partner'), 'integracoes')
  assert.equal(partnerSection('/admin', 'partner'), 'empresa')
  assert.equal(partnerSection(undefined, 'partner'), 'empresa')
  for (const section of ['empresa', 'notificacoes', 'integracoes', 'seguranca']) assert.equal(partnerSection(section, 'team_member'), 'seguranca')
})

test('barra/FAB se limitam às rotas principais e não cobrem detalhe ou telas secundárias', () => {
  for (const name of ['dashboard', 'propostas', 'promocoes', 'carteira', 'perfil']) assert.equal(isPartnerPrimaryRoute(['(parceiro)', name]), true)
  for (const route of [['(parceiro)', 'propostas', '[id]'], ['(parceiro)', 'aula', '[id]'], ['(parceiro)', 'configuracoes'], ['(parceiro)', 'equipe'], ['(cliente)', 'perfil'], ['propostas', 'nova']]) assert.equal(isPartnerPrimaryRoute(route), false)
})

test('renovação de token da mesma conta preserva o cache; troca de conta apaga dados e mutações', () => {
  setQueryIdentity('account-a')
  queryClient.setQueryData(['saldo-antigo-sem-escopo'], 123)
  queryClient.getMutationCache().build(queryClient, { mutationKey: ['preferencias'], mutationFn: async () => undefined })
  assert.equal(setQueryIdentity('account-a'), false)
  assert.equal(queryClient.getQueryData(['saldo-antigo-sem-escopo']), 123)
  assert.equal(setQueryIdentity('account-b'), true)
  assert.equal(queryClient.getQueryData(['saldo-antigo-sem-escopo']), undefined)
  assert.equal(queryClient.getMutationCache().getAll().length, 0)
})

test('resposta atrasada da conta antiga não repopula o cache depois da troca', async () => {
  setQueryIdentity('old-account')
  let resolveOld
  const pending = queryClient.fetchQuery({ queryKey: ['perfil-legado'], queryFn: () => new Promise((resolve) => { resolveOld = resolve }) })
  const observed = pending.catch((error) => error)
  setQueryIdentity('new-account')
  resolveOld({ name: 'synthetic old account' })
  await observed
  assert.equal(queryClient.getQueryData(['perfil-legado']), undefined)
  assert.equal(queryClient.getQueryCache().getAll().length, 0)
})

test('logout elimina dados privados antes do login seguinte', () => {
  setQueryIdentity('signed-in')
  queryClient.setQueryData(['propostas'], ['synthetic-proposal'])
  setQueryIdentity(null)
  assert.equal(queryClient.getQueryData(['propostas']), undefined)
  setQueryIdentity('next-account')
  assert.equal(queryClient.getQueryCache().getAll().length, 0)
})
