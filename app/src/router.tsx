import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { ClientLayout } from '@/layouts/ClientLayout'
import { PartnerLayout } from '@/layouts/PartnerLayout'
import { AdminLayout } from '@/layouts/AdminLayout'

import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/public/Login'
import { Protocolo } from '@/pages/public/Protocolo'
import { MagicLink } from '@/pages/public/MagicLink'

import { ClientHome } from '@/pages/client/Home'
import { ClientDocs } from '@/pages/client/Documentos'
import { ClientUniversidade } from '@/pages/client/Universidade'

import { PartnerDashboard } from '@/pages/partner/Dashboard'
import { PartnerSimulacoes } from '@/pages/partner/Simulacoes'
import { PartnerWizard } from '@/pages/partner/Wizard'
import { PartnerPropostas } from '@/pages/partner/Propostas'
import { PartnerPropostaDetalhe } from '@/pages/partner/PropostaDetalhe'
import { PartnerCarteira } from '@/pages/partner/Carteira'
import { PartnerEquipe } from '@/pages/partner/Equipe'
import { PartnerRelatorios } from '@/pages/partner/Relatorios'
import { PartnerConfig } from '@/pages/partner/Configuracoes'
import { PartnerMilestones } from '@/pages/partner/Milestones'
import { PartnerContrato } from '@/pages/partner/Contrato'
import { UniversidadeLista } from '@/pages/partner/UniversidadeLista'
import { UniversidadePlayer } from '@/pages/partner/UniversidadePlayer'

import { AdminDashboard } from '@/pages/admin/Dashboard'
import { AdminAprovacoes } from '@/pages/admin/Aprovacoes'
import { AdminRede } from '@/pages/admin/Rede'
import { AdminKanban } from '@/pages/admin/Kanban'
import { AdminCarteiras } from '@/pages/admin/Carteiras'
import { AdminPrecos } from '@/pages/admin/Precos'
import { AdminFluxos } from '@/pages/admin/Fluxos'
import { AdminCampanhas } from '@/pages/admin/Campanhas'
import { AdminAuditoria } from '@/pages/admin/Auditoria'
import { AdminIntegracoes } from '@/pages/admin/Integracoes'
import { AdminParceiros } from '@/pages/admin/Parceiros'
import { AdminPropostas } from '@/pages/admin/Propostas'
import { AdminRelatorios } from '@/pages/admin/Relatorios'
import { AdminConfiguracoes } from '@/pages/admin/Configuracoes'
import { AdminUniversidade } from '@/pages/admin/Universidade'

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  {
    element: <PublicLayout />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/protocolo', element: <Protocolo /> },
      { path: '/magic/:token', element: <MagicLink /> },
    ],
  },
  {
    path: '/c',
    element: <ClientLayout />,
    children: [
      { index: true, element: <ClientHome /> },
      { path: 'documentos', element: <ClientDocs /> },
      { path: 'universidade', element: <ClientUniversidade /> },
    ],
  },
  {
    path: '/p',
    element: <PartnerLayout />,
    children: [
      { index: true, element: <PartnerDashboard /> },
      { path: 'simulacoes', element: <PartnerSimulacoes /> },
      { path: 'propostas', element: <PartnerPropostas /> },
      { path: 'propostas/nova', element: <PartnerWizard /> },
      { path: 'propostas/:id', element: <PartnerPropostaDetalhe /> },
      { path: 'carteira', element: <PartnerCarteira /> },
      { path: 'carteira/recarga', element: <PartnerCarteira /> },
      { path: 'equipe', element: <PartnerEquipe /> },
      { path: 'relatorios', element: <PartnerRelatorios /> },
      { path: 'configuracoes', element: <PartnerConfig /> },
      { path: 'milestones', element: <PartnerMilestones /> },
      { path: 'contrato', element: <PartnerContrato /> },
      { path: 'universidade', element: <UniversidadeLista /> },
      { path: 'universidade/:cursoId/aula/:aulaId', element: <UniversidadePlayer /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'aprovacoes', element: <AdminAprovacoes /> },
      { path: 'parceiros', element: <AdminParceiros /> },
      { path: 'rede', element: <AdminRede /> },
      { path: 'kanban', element: <AdminKanban /> },
      { path: 'propostas', element: <AdminPropostas /> },
      { path: 'financeiro/carteiras', element: <AdminCarteiras /> },
      { path: 'financeiro/precos', element: <AdminPrecos /> },
      { path: 'fluxos', element: <AdminFluxos /> },
      { path: 'campanhas', element: <AdminCampanhas /> },
      { path: 'auditoria', element: <AdminAuditoria /> },
      { path: 'integracoes', element: <AdminIntegracoes /> },
      { path: 'configuracoes', element: <AdminConfiguracoes /> },
      { path: 'relatorios', element: <AdminRelatorios /> },
      { path: 'universidade', element: <AdminUniversidade /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
