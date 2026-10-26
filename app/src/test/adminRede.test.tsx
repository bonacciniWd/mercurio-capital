import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganogramaInterno } from '@/components/rede/OrganogramaInterno'
import { supabase } from '@/lib/supabase'
import type { InternalEmployee } from '@/lib/internalOrg'

const state = vi.hoisted(() => ({
  level: 'full', people: [] as InternalEmployee[], error: '',
  catalogs: { cargos: [{ id: 'cargo-a', nome: 'Analista', ativo: true }], departamentos: [{ id: 'dept-a', nome: 'Operações', ativo: true }] },
}))
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ session: { role: 'admin', adminNivel: state.level } }) }))
vi.mock('@/components/rede/NetworkCanvas', () => ({
  NetworkCanvas: ({ nodes, onSelect, onConnect }: { nodes: Array<{ id: string; data: { label: string } }>; onSelect: (id: string) => void; onConnect?: (connection: object) => void }) => <div aria-label="Canvas do organograma">{nodes.map(node => <button type="button" key={node.id} onClick={() => onSelect(node.id)}>Abrir pessoa {node.data.label}</button>)}{onConnect && <button type="button" onClick={() => onConnect({ source: 'other', target: 'child', sourceHandle: null, targetHandle: null })}>Propor novo gestor</button>}</div>,
}))
vi.mock('@/lib/supabase', () => ({ supabase: {
  rpc: vi.fn(async (name: string, args?: Record<string, unknown>) => {
    if (name === 'admin_internal_team_list' || name === 'admin_internal_team_graph') return { data: structuredClone(state.people), error: null }
    if (name === 'admin_internal_team_catalogs') return { data: structuredClone(state.catalogs), error: null }
    if (name === 'admin_internal_team_catalog_upsert') {
      const item = { id: 'new-catalog', nome: String(args?.p_nome), ativo: true }
      state.catalogs[args?.p_tipo === 'cargo' ? 'cargos' : 'departamentos'].push(item)
      return { data: item.id, error: null }
    }
    if (name === 'admin_internal_team_update') {
      if (state.error) return { data: null, error: { message: state.error } }
      state.people = state.people.map(person => person.usuario_id === args?.p_usuario_id ? { ...person,
        cargo_id: args.p_cargo_id as string | null, cargo: state.catalogs.cargos.find(item => item.id === args.p_cargo_id)?.nome ?? null,
        departamento_id: args.p_departamento_id as string | null, gestor_usuario_id: args.p_gestor_usuario_id as string | null,
        foto_path: args.p_foto_path as string | null, data_inicio: args.p_data_inicio as string | null,
      } : person)
      return { data: null, error: null }
    }
    return { data: null, error: null }
  }),
  storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://example.invalid/avatar' }, error: null })) })) },
} }))

function person(id: string, manager: string | null = null): InternalEmployee {
  return { usuario_id: id, nome_completo: `Pessoa ${id}`, cargo_id: 'cargo-a', cargo: 'Analista', departamento_id: 'dept-a', departamento: 'Operações', gestor_usuario_id: manager, foto_path: null, data_inicio: '2026-01-01', ativo: true }
}
beforeEach(() => {
  vi.clearAllMocks(); state.level = 'full'; state.error = ''
  state.people = [person('root'), { ...person('child', 'root'), foto_path: 'child/original.jpg' }, person('descendant', 'child'), person('other')]
  state.catalogs = { cargos: [{ id: 'cargo-a', nome: 'Analista', ativo: true }], departamentos: [{ id: 'dept-a', nome: 'Operações', ativo: true }] }
})
afterEach(cleanup)
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><OrganogramaInterno /></QueryClientProvider>)
}

describe('edição direta do organograma', () => {
  it('confirma a troca do gestor e preserva foto/data atualizadas durante a edição', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir pessoa Pessoa child' }))
    const manager = screen.getByLabelText('Gestor direto')
    expect(within(manager).queryByRole('option', { name: 'Pessoa child' })).not.toBeInTheDocument()
    expect(within(manager).queryByRole('option', { name: 'Pessoa descendant' })).not.toBeInTheDocument()
    fireEvent.change(manager, { target: { value: 'other' } })
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()
    expect(supabase.rpc).not.toHaveBeenCalledWith('admin_internal_team_update', expect.anything())
    state.people = state.people.map(entry => entry.usuario_id === 'child' ? { ...entry, foto_path: 'child/recent.jpg', data_inicio: '2026-02-01' } : entry)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Confirmo a alteração do gestor direto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('admin_internal_team_update', { p_usuario_id: 'child', p_gestor_usuario_id: 'other', p_cargo_id: 'cargo-a', p_departamento_id: 'dept-a', p_foto_path: 'child/recent.jpg', p_data_inicio: '2026-02-01' }))
    expect(await screen.findByRole('status')).toHaveTextContent('atualizados')
    expect(screen.queryByRole('complementary', { name: 'Perfil de Pessoa child' })).not.toBeInTheDocument()
  })

  it('uma conexão propõe o gestor sem gravar e mantém o erro do backend no editor', async () => {
    state.error = 'ciclo_hierarquia_invalido'
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Propor novo gestor' }))
    expect(screen.getByLabelText('Gestor direto')).toHaveValue('other')
    expect(supabase.rpc).not.toHaveBeenCalledWith('admin_internal_team_update', expect.anything())
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ciclo')
    expect(screen.getByLabelText('Gestor direto')).toHaveValue('other')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['limitado', 'juridico'])('mantém perfil %s em leitura sem buscar catálogos ou cadastro completo', async level => {
    state.level = level
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir pessoa Pessoa child' }))
    expect(screen.getByText('Seu perfil possui acesso de leitura.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Propor novo gestor' })).not.toBeInTheDocument()
    expect(supabase.rpc).toHaveBeenCalledWith('admin_internal_team_graph')
    expect(supabase.rpc).not.toHaveBeenCalledWith('admin_internal_team_list')
    expect(supabase.rpc).not.toHaveBeenCalledWith('admin_internal_team_catalogs')
  })

  it('cria um cargo no painel e só atribui ao colaborador quando o operador salva', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir pessoa Pessoa child' }))
    fireEvent.click(screen.getByRole('button', { name: 'Novo cargo' }))
    fireEvent.change(screen.getByLabelText('Nome do novo cargo'), { target: { value: 'Analista Sênior' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
    await waitFor(() => expect(screen.getByLabelText('Cargo')).toHaveValue('new-catalog'))
    expect(supabase.rpc).not.toHaveBeenCalledWith('admin_internal_team_update', expect.anything())
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('admin_internal_team_update', expect.objectContaining({ p_cargo_id: 'new-catalog', p_foto_path: 'child/original.jpg' })))
  })

  it('mostra busca sem resultados e não perde o mapa nem executa gravação', async () => {
    mount()
    await screen.findByRole('button', { name: 'Abrir pessoa Pessoa child' })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'não existente' } })
    expect(screen.getByText('Nenhum resultado encontrado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir pessoa Pessoa child' })).toBeInTheDocument()
    expect(supabase.rpc).not.toHaveBeenCalledWith('admin_internal_team_update', expect.anything())
  })
})
