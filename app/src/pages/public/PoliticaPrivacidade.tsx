import { Link } from 'react-router-dom'

const privacyRequestSubject = 'Solicitação sobre meus dados pessoais'
const privacyRequestBody = [
  'Olá, Mercúrio Capital.',
  '',
  'Gostaria de fazer uma solicitação relacionada aos meus dados pessoais.',
  '',
  'Nome completo:',
  'E-mail usado na interação:',
  'Telefone para contato (opcional):',
  'Descrição da solicitação:',
  '',
].join('\n')
const privacyRequestHref = `mailto:contato@mercuriocapitalsa.com?subject=${encodeURIComponent(privacyRequestSubject)}&body=${encodeURIComponent(privacyRequestBody)}`

const sections = [
  {
    title: '1. Quem somos e escopo',
    content: (
      <>
        <p>
          Esta política descreve o tratamento de dados nos formulários públicos de Crédito para Construção (CPC),
          Home Equity e Simulador de Amortização, e nas áreas autenticadas usadas para registrar e acompanhar
          propostas de crédito da Mercúrio Capital.
        </p>
        <p>
          A Mercurio Capital Ltda. está inscrita no CNPJ sob o nº <strong>64.382.034/0001-70</strong> e tem sede na{' '}
          <strong>Rua 1301, 471, Centro, Balneário Camboriú/SC, CEP 88330-795</strong>. O canal para solicitações
          relacionadas a dados pessoais é o e-mail contato@mercuriocapitalsa.com, descrito na seção de direitos.
        </p>
        <p>
          A plataforma autenticada pode ser usada por clientes, parceiros, equipes de parceiros e equipe interna,
          com acesso limitado às propostas e informações necessárias às respectivas funções.
        </p>
      </>
    ),
  },
  {
    title: '2. Quais dados são tratados',
    content: (
      <>
        <p>Os campos variam conforme o formulário escolhido:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>CPC:</strong> nome, e-mail, telefone, fase do projeto e, se informados, cidade, estado (UF) e
            resumo do projeto. O formulário não solicita valor de crédito, CPF, documentos ou endereço completo.
          </li>
          <li>
            <strong>Home Equity:</strong> nome, e-mail, telefone, CEP do imóvel, valor aproximado do imóvel,
            crédito solicitado, tipo e situação do imóvel, além de renda mensal (opcional), objetivo do crédito,
            tipo de renda, prazo de contratação e origem do contato, quando preenchidos.
          </li>
          <li>
            <strong>Amortização:</strong> nome, e-mail, telefone, CEP do imóvel e dados informados para o cálculo,
            como valor, data de início, taxa e periodicidade, sistema de amortização, quantidade de parcelas e
            eventuais planos extras; também pode incluir tipo e situação do imóvel, renda mensal (opcional),
            objetivo, tipo de renda, prazo de contratação e origem do contato.
          </li>
        </ul>
        <p>
          Os formulários públicos de simulação não pedem CPF, documentos pessoais ou dados bancários e não fazem
          consulta a bureau durante o cálculo. Não envie essas informações em campos de texto livre.
        </p>
        <p>
          Para limitar envios abusivos, os endpoints dos formulários usam o endereço IP recebido na requisição e o
          e-mail informado nos controles de envio.
        </p>
      </>
    ),
  },
  {
    title: '3. Dados tratados nas propostas e áreas autenticadas',
    content: (
      <>
        <p>
          Quando uma proposta é criada e acompanhada na plataforma, os dados podem incluir identificação e contato
          dos proponentes (como nome, CPF ou CNPJ, e-mail e telefone), informações financeiras e de renda, dados da
          operação e da garantia imobiliária, documentos enviados, pendências e o histórico das etapas da proposta.
        </p>
        <p>
          Se uma consulta externa for solicitada no contexto de uma proposta, também são tratados os dados
          necessários àquela consulta, o registro do pedido e o resultado recebido. Os campos variam conforme o
          tipo de consulta. O acesso a propostas, documentos e resultados é limitado por perfil e vínculo com a
          operação.
        </p>
      </>
    ),
  },
  {
    title: '4. Para que usamos os dados',
    content: (
      <>
        <p>Nos formulários públicos, os dados são usados para:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>calcular e apresentar uma estimativa com base nas informações preenchidas;</li>
          <li>registrar a simulação como lead e permitir que a equipe interna consulte a solicitação;</li>
          <li>enviar o resultado ao e-mail informado e gerar notificações internas para acompanhamento, conforme o fluxo disponível;</li>
          <li>responder ao contato e orientar sobre os próximos passos, quando solicitado ou autorizado no formulário.</li>
        </ul>
        <p>Nas propostas registradas na plataforma, os dados podem ser usados para:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>receber e acompanhar o pedido de crédito, organizar documentos e tratar pendências;</li>
          <li>realizar consultas externas solicitadas e vinculadas à proposta, quando o serviço correspondente estiver configurado;</li>
          <li>organizar a análise operacional e encaminhar o atendimento à equipe responsável;</li>
          <li>manter registros e auditoria das atividades relacionadas à proposta e proteger a plataforma contra uso indevido.</li>
        </ul>
        <p>
          Uma simulação é apenas estimativa: não representa aprovação, oferta ou garantia de crédito. A simulação
          pública não consulta bureaus e não decide a concessão do crédito.
        </p>
      </>
    ),
  },
  {
    title: '5. Consultas e classificação operacional',
    content: (
      <>
        <p>
          Uma consulta externa só é iniciada no fluxo de proposta quando um usuário autorizado a solicita. Conforme
          o tipo de consulta e a configuração do serviço, os dados necessários são enviados ao provedor pelo
          servidor. O registro da consulta e as informações recebidas podem ficar associados à proposta para
          acompanhamento e auditoria.
        </p>
        <p>
          A plataforma possui um classificador operacional baseado em regras do sistema. Ele analisa informações da
          garantia, renda ou faturamento, documentos aprovados e pendências da proposta para sugerir uma classe e
          apoiar o encaminhamento interno. A classificação operacional não aprova nem recusa crédito; casos de baixa
          confiança ou com sinal jurídico exigem revisão.
        </p>
      </>
    ),
  },
  {
    title: '6. Consentimento e bases legais',
    content: (
      <p>
        Os formulários públicos apresentam caixas de consentimento com a finalidade informada no próprio fluxo:
        gerar a simulação e orientar sobre o próximo passo ou receber contato sobre o projeto CPC. Esse aceite não
        é apresentado como autorização genérica para marketing futuro ou compartilhamento sem relação com a
        solicitação. Os tratamentos relacionados às propostas, consultas e operação observam as bases legais
        aplicáveis a cada finalidade.
      </p>
    ),
  },
  {
    title: '7. Com quem os dados podem ser compartilhados',
    content: (
      <>
        <p>
          Leads de formulários públicos ficam disponíveis à equipe interna autorizada. Dados de propostas podem
          ser acessados por profissionais internos e pelos parceiros ou equipes vinculados à operação, conforme
          permissões da plataforma. Quando uma consulta externa é solicitada, os dados necessários são enviados ao
          respectivo provedor para executar a consulta.
        </p>
        <p>
          Também podem participar prestadores necessários para hospedar e operar os sistemas, armazenar dados e
          entregar comunicações.
        </p>
      </>
    ),
  },
  {
    title: '8. Retenção e segurança',
    content: (
      <>
        <p>
          Os dados são mantidos pelo período necessário às finalidades informadas e às obrigações aplicáveis.
        </p>
        <p>
          A plataforma aplica controles de acesso por perfil e vínculo com a operação. Documentos de propostas são
          armazenados em área privada e disponibilizados por acesso temporário autorizado.
        </p>
      </>
    ),
  },
  {
    title: '9. Armazenamento local e tecnologias de medição',
    content: (
      <p>
        O aplicativo usa armazenamento local no navegador para manter a sessão autenticada. Recursos de diagnóstico
        e medição podem registrar informações técnicas de uso quando habilitados.
      </p>
    ),
  },
  {
    title: '10. Seus direitos e como falar conosco',
    content: (
      <>
        <p>
          Nos termos da legislação aplicável, você pode solicitar confirmação do tratamento e acesso aos dados,
          correção de informações incompletas ou desatualizadas, anonimização, bloqueio ou eliminação quando
          cabíveis, informações sobre compartilhamentos e, quando o tratamento se basear em consentimento, sua
          revogação. Você também pode solicitar informações e revisão de decisão baseada exclusivamente em
          tratamento automatizado que afete seus interesses, quando aplicável. Outros direitos legais podem se
          aplicar ao seu caso. Para falar sobre seus dados, escreva para contato@mercuriocapitalsa.com.
        </p>
        <p>
          Para enviar uma solicitação, use o botão abaixo. Ele abre o aplicativo de e-mail com o destinatário, o
          assunto e um modelo de mensagem preenchidos. Complete seus dados e o pedido, revise a mensagem e envie.
          O site não envia a solicitação automaticamente.
        </p>
        <a
          className="inline-flex min-h-11 items-center rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-700 underline underline-offset-4"
          href={privacyRequestHref}
        >
          Enviar solicitação por e-mail
        </a>
      </>
    ),
  },
]

export function PoliticaPrivacidade() {
  return (
    <main className="min-h-screen bg-silver-50 px-5 py-12 text-silver-900 sm:px-8 sm:py-16">
      <article className="mx-auto max-w-4xl">
        <header className="rounded-3xl border border-silver-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Mercúrio Capital</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Política de Privacidade</h1>
          <p className="mt-3 text-sm text-silver-500">Atualizada em 16 de outubro de 2026</p>
          <p className="mt-6 text-base leading-7 text-silver-700">
            Esta política explica como os formulários públicos e as áreas autenticadas de propostas podem tratar dados
            para simulações, análise operacional e acompanhamento de solicitações de crédito.
          </p>
        </header>

        <div className="mt-6 space-y-5">
          {sections.map(section => (
            <section key={section.title} className="rounded-2xl border border-silver-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-navy sm:text-xl">{section.title}</h2>
              <div className="policy-copy mt-4 space-y-4 text-sm leading-7 text-silver-700 sm:text-base">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-8 flex flex-col gap-4 rounded-2xl border border-silver-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-silver-600">
            Mercurio Capital Ltda. · CNPJ 64.382.034/0001-70 · Rua 1301, 471, Centro, Balneário Camboriú/SC,
            CEP 88330-795 · Solicitações sobre dados pessoais: contato@mercuriocapitalsa.com.
          </p>
          <Link className="inline-flex min-h-11 shrink-0 items-center font-semibold text-red-700 underline underline-offset-4" to="/credito-para-construcao">
            Voltar para Crédito para Construção
          </Link>
        </footer>
      </article>
    </main>
  )
}
