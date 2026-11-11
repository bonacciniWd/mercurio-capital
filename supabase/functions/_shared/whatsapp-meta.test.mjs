import test from 'node:test'
import assert from 'node:assert/strict'
import { approvedMetaTemplate, matchMetaTemplate } from './whatsapp-meta.ts'
const local = { nome_meta: 'status_v1', idioma: 'pt_BR', categoria: 'UTILITY', componentes: [{ type: 'BODY', text: 'Olá {{1}}', example: { body_text: [['Teste']] } }] }
const remote = { name: 'status_v1', language: 'pt_BR', category: 'UTILITY', components: [{ type: 'BODY', text: 'Olá {{1}}' }] }
test('ignores synthetic examples while verifying provider content', () => assert.equal(approvedMetaTemplate(local, remote), true))
test('rejects remotely edited content and category reclassification', () => { assert.equal(approvedMetaTemplate(local, { ...remote, category: 'MARKETING' }), false); assert.equal(approvedMetaTemplate(local, { ...remote, components: [{ type: 'BODY', text: 'other' }] }), false) })
test('matches exactly one Meta template by name, language, category and components', () => {
 const result = matchMetaTemplate(local, [{ id: '1234567890', ...remote, status: 'PENDING' }])
 assert.equal(result.status, 'match')
 if (result.status === 'match') assert.equal(result.template.id, '1234567890')
})
test('does not reconcile a missing, duplicated or mismatched Meta template', () => {
 assert.deepEqual(matchMetaTemplate(local, []), { status: 'not_found' })
 assert.deepEqual(matchMetaTemplate(local, [{ id: '1', ...remote, status: 'PENDING' }, { id: '2', ...remote, status: 'PENDING' }]), { status: 'ambiguous' })
 assert.deepEqual(matchMetaTemplate(local, [{ id: '3', ...remote, category: 'MARKETING', status: 'PENDING' }]), { status: 'mismatch' })
 assert.deepEqual(matchMetaTemplate(local, [{ id: 'not-numeric', ...remote, status: 'PENDING' }]), { status: 'mismatch' })
})
