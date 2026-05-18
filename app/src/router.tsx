import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { ClientLayout } from '@/layouts/ClientLayout'
import { PartnerLayout } from '@/layouts/PartnerLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { RequireAuth } from '@/guards/RequireAuth'
import { RequireRole } from '@/guards/RequireRole'
import { RequireApproved } from '@/guards/RequireApproved'
import { Require2FA } from '@/guards/Require2FA'
import { RedirectIfAuthenticated } from '@/guards/RedirectIfAuthenticated'

import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/public/Login'
import { Protocolo } from '@/pages/public/Protocolo'
import { MagicLink } from '@/pages/public/MagicLink'
import { TwoFactor } from '@/pages/public/TwoFactor'
import { TwoFactorSetupPage } from '@/pages/public/TwoFactorSetupPage'
import { AcessoPendente } from '@/pages/public/AcessoPendente'
import { Registro } from '@/pages/public/Registro'
import { RecuperarSenha } from '@/pages/public/RecuperarSenha'
import { RedefinirSenha } from '@/pages/public/RedefinirSenha'
import { ClienteProposta } from '@/pages/public/ClienteProposta'
import { ConviteMembro } from '@/pages/public/ConviteMembro'

import { ClientHome } from '@/pages/client/Home'
import { ClientPropostaDetalhe } from '@/pages/client/PropostaDetalhe'
import { ClientDocs } from '@/pages/client/Documentos'
import { ClientUniversidade } from '@/pages/client/Universidade'
import { UniversidadePlayer as ClientUniversidadePlayer } from '@/pages/partner/UniversidadePlayer'

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
import { PartnerComissoes } from '@/pages/partner/Comissoes'
import { UniversidadeLista } from '@/pages/partner/UniversidadeLista'
import { UniversidadePlayer } from '@/pages/partner/UniversidadePlayer'

import { AdminDashboard } from '@/pages/admin/Dashboard'
import { AdminAprovacoes } from '@/pages/admin/Aprovacoes'
import { AdminRede } from '@/pages/admin/Rede'
import { AdminKanban } from '@/pages/admin/Kanban'
import { AdminCarteiras } from '@/pages/admin/Carteiras'
import { AdminPrecos } from '@/pages/admin/Precos'
import { AdminFinanceiro } from '@/pages/admin/Financeiro'
import { AdminFluxos } from '@/pages/admin/Fluxos'
import { AdminCampanhas } from '@/pages/admin/Campanhas'
import { AdminAuditoria } from '@/pages/admin/Auditoria'
import { AdminIntegracoes } from '@/pages/admin/Integracoes'
import { AdminParceiros } from '@/pages/admin/Parceiros'
import { AdminPropostas } from '@/pages/admin/Propostas'
import { AdminPropostaDetalhe } from '@/pages/admin/PropostaDetalhe'
import { AdminRelatorios } from '@/pages/admin/Relatorios'
import { AdminConfiguracoes } from '@/pages/admin/Configuracoes'
import { AdminUniversidade } from '@/pages/admin/Universidade'

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  {
    element: <PublicLayout />,
    children: [
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: '/login', element: <Navigate to="/p/login" replace /> },
          {
            path: '/admin/login',
            element: (
              <Login
                defaultRole="admin"
                allowedRoles={['admin']}
                title="Entrar no módulo Admin"
                description="Acesso restrito à operação interna da Mercurio Capital."
              />
            ),
          },
          {
            path: '/p/login',
            element: (
              <Login
                defaultRole="partner"
                allowedRoles={['partner', 'team_member']}
                title="Entrar no módulo Parceiro"
                description="Acesse sua operação comercial e gestão de propostas."
              />
            ),
          },
          {
            path: '/c/login',
            element: (
              <Login
                defaultRole="client"
                allowedRoles={['client']}
                title="Entrar no portal do Cliente"
                description="Acompanhe propostas, pendências e documentos com segurança."
              />
            ),
          },
          { path: '/p/registro', element: <Registro /> },
          { path: '/registro', element: <Navigate to="/p/registro" replace /> },
          { path: '/recuperar-senha', element: <RecuperarSenha /> },
        ],
      },
      { path: '/protocolo', element: <Protocolo /> },
      { path: '/protocolo/:codigo', element: <Protocolo /> },
      { path: '/magic/:token', element: <MagicLink /> },
      { path: '/c/proposta/:token', element: <ClienteProposta /> },
      { path: '/convite/:token', element: <ConviteMembro /> },
      { path: '/redefinir-senha', element: <RedefinirSenha /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/2fa', element: <TwoFactor /> },
          { path: '/2fa/setup', element: <TwoFactorSetupPage /> },
          { path: '/acesso-pendente', element: <AcessoPendente /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireRole roles={['client']} />,
        children: [
          {
            path: '/c',
            element: <ClientLayout />,
            children: [
              { index: true, element: <ClientHome /> },
              { path: 'propostas/:id', element: <ClientPropostaDetalhe /> },
              { path: 'documentos', element: <ClientDocs /> },
              { path: 'universidade', element: <ClientUniversidade /> },
              { path: 'universidade/:cursoId/aula/:aulaId', element: <ClientUniversidadePlayer /> },
            ],
          },
        ],
      },
      {
        element: <RequireRole roles={['partner', 'team_member']} />,
        children: [
          {
            element: <RequireApproved />,
            children: [
              {
                element: <Require2FA />,
                children: [
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
                      { path: 'comissoes', element: <PartnerComissoes /> },
                      { path: 'universidade', element: <UniversidadeLista /> },
                      { path: 'universidade/:cursoId/aula/:aulaId', element: <UniversidadePlayer /> },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <RequireRole roles={['admin']} />,
        children: [
          {
            element: <Require2FA />,
            children: [
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
                  { path: 'propostas/:id', element: <AdminPropostaDetalhe /> },
                  { path: 'financeiro/carteiras', element: <AdminCarteiras /> },
                  { path: 'financeiro/precos', element: <AdminPrecos /> },
                  { path: 'financeiro', element: <AdminFinanceiro /> },
                  { path: 'fluxos', element: <AdminFluxos /> },
                  { path: 'campanhas', element: <AdminCampanhas /> },
                  { path: 'auditoria', element: <AdminAuditoria /> },
                  { path: 'integracoes', element: <AdminIntegracoes /> },
                  { path: 'configuracoes', element: <AdminConfiguracoes /> },
                  { path: 'relatorios', element: <AdminRelatorios /> },
                  { path: 'universidade', element: <AdminUniversidade /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
