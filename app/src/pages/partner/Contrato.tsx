import { useRef } from 'react'
import { FileText, Download, Printer } from 'lucide-react'

const HOJE = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

const CLAUSULAS = [
  {
    n: '1',
    titulo: 'DO OBJETO',
    texto: `O presente Contrato tem por objeto o credenciamento da PARCEIRA junto à MERCURIO CAPITAL para a indicação e intermediação de operações de crédito imobiliário nas modalidades de Home Equity, Crédito para Construção e Financiamento Imobiliário, nos termos e condições estabelecidos neste instrumento e em seus Anexos.`,
  },
  {
    n: '2',
    titulo: 'DAS OBRIGAÇÕES DA PARCEIRA',
    texto: `São obrigações da PARCEIRA: (i) indicar clientes com perfil compatível com as linhas de crédito disponíveis; (ii) fornecer documentação completa e verossímil dos proponentes indicados; (iii) não praticar qualquer ato que configure captação irregular de recursos ou oferta pública de valores mobiliários; (iv) manter sigilo sobre informações operacionais e de pricing recebidas; (v) agir sempre em conformidade com as normas do Banco Central do Brasil, LGPD e demais regulamentações aplicáveis.`,
  },
  {
    n: '3',
    titulo: 'DAS OBRIGAÇÕES DA MERCURIO CAPITAL',
    texto: `São obrigações da MERCURIO CAPITAL: (i) disponibilizar acesso ao sistema de gestão de propostas; (ii) analisar as propostas indicadas no prazo máximo de 5 (cinco) dias úteis após o recebimento da documentação completa; (iii) remunerar a PARCEIRA conforme tabela de comissões vigente, Anexo I; (iv) manter sigilo sobre dados cadastrais dos clientes indicados; (v) comunicar à PARCEIRA qualquer alteração de produto, taxa ou política de crédito com antecedência mínima de 30 dias.`,
  },
  {
    n: '4',
    titulo: 'DA REMUNERAÇÃO E COMISSÕES',
    texto: `Pela intermediação bem-sucedida, a PARCEIRA fará jus a comissão calculada sobre o valor liberado de cada operação, conforme tabela constante do Anexo I, que integra este instrumento. O pagamento será realizado em até 5 (cinco) dias úteis após o efetivo desembolso dos recursos ao tomador final, mediante emissão de Nota Fiscal de Serviços pela PARCEIRA. Operações canceladas após liberação parcial serão apuradas proporcionalmente.`,
  },
  {
    n: '5',
    titulo: 'DA VEDAÇÃO À CONCORRÊNCIA DESLEAL',
    texto: `Durante a vigência deste Contrato e por 12 (doze) meses após seu término, a PARCEIRA compromete-se a não utilizar informações operacionais, de precificação ou de clientes obtidas por meio da plataforma MERCURIO CAPITAL para beneficiar concorrentes diretos, sob pena de rescisão imediata e indenização por perdas e danos.`,
  },
  {
    n: '6',
    titulo: 'DA PROTEÇÃO DE DADOS (LGPD)',
    texto: `As partes comprometem-se a tratar os dados pessoais dos clientes indicados em estrita conformidade com a Lei 13.709/2018 (LGPD). A PARCEIRA atuará como "operadora" nos termos do art. 5º, VII, da LGPD, sendo vedada a utilização dos dados para finalidade diversa da execução deste Contrato. O Encarregado de Dados (DPO) da MERCURIO CAPITAL é o responsável pelo canal de atendimento de titulares: dpo@mercuriocapitalsa.com.br.`,
  },
  {
    n: '7',
    titulo: 'DA VIGÊNCIA E RESCISÃO',
    texto: `O presente Contrato é firmado por prazo indeterminado, podendo qualquer das partes rescindi-lo mediante notificação escrita com antecedência mínima de 30 (trinta) dias. A rescisão imotivada não gera direito a indenizações, exceto quanto a comissões de operações já liberadas. A MERCURIO CAPITAL poderá rescindir imediatamente, sem ônus, em caso de comprovada fraude, violação de compliance ou descumprimento de cláusulas essenciais.`,
  },
  {
    n: '8',
    titulo: 'DO FORO E LEI APLICÁVEL',
    texto: `As partes elegem o Foro Central da Comarca de São Paulo/SP, com exclusão de qualquer outro, por mais privilegiado que seja, para dirimir quaisquer controvérsias oriundas do presente instrumento. Aplica-se a lei brasileira em sua integralidade.`,
  },
]

export function PartnerContrato() {
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    window.print()
  }

  return (
    <div>
      {/* Barra de ações — oculta na impressão */}
      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: '#DC2626' }} />
            <h1 className="text-xl font-bold text-silver-900">Contrato Comercial de Parceria</h1>
          </div>
          <p className="mt-0.5 text-sm text-silver-500">Leia com atenção antes de assinar.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg border border-silver-300 px-4 py-2 text-sm font-medium text-silver-700 transition hover:bg-silver-50"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: '#DC2626' }}
          >
            <Download className="h-4 w-4" />
            Baixar PDF
          </button>
        </div>
      </div>

      {/* Documento */}
      <div
        ref={printRef}
        className="contract-doc mx-auto max-w-3xl rounded-xl border border-silver-200 bg-white p-12 shadow-sm"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {/* Cabeçalho */}
        <div className="mb-8 border-b-2 pb-6" style={{ borderBottomColor: '#DC2626' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#DC2626' }}>Mercurio Capital · Crédito Imobiliário</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">CONTRATO DE PARCERIA COMERCIAL</h2>
              <p className="mt-0.5 text-sm text-gray-500">Instrumento Particular de Credenciamento e Intermediação</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>Versão 2.1 · {HOJE}</p>
              <p className="mt-0.5 font-mono">MC-PART-{new Date().getFullYear()}-XXXX</p>
            </div>
          </div>
        </div>

        {/* Qualificação das partes */}
        <div className="mb-8 rounded-lg p-5" style={{ backgroundColor: '#f8f8f8', border: '1px solid #e5e5e5' }}>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">Qualificação das Partes</p>
          <div className="grid gap-4 sm:grid-cols-2 text-sm text-gray-700">
            <div>
              <p className="font-bold text-gray-900">CONTRATANTE</p>
              <p className="mt-1"><span className="font-semibold">Mercurio Capital Ltda.</span></p>
              <p>CNPJ: 12.345.678/0001-90</p>
              <p>Av. Paulista, 1.000, 15º andar</p>
              <p>São Paulo/SP — CEP 01310-100</p>
              <p className="mt-1 text-xs text-gray-400">Doravante denominada <strong>MERCURIO CAPITAL</strong></p>
            </div>
            <div>
              <p className="font-bold text-gray-900">PARCEIRA</p>
              <p className="mt-1"><span className="font-semibold">Construtora Aurora Ltda.</span></p>
              <p>CNPJ: 98.765.432/0001-10</p>
              <p>Rua das Palmeiras, 500</p>
              <p>São Paulo/SP — CEP 04567-000</p>
              <p className="mt-1 text-xs text-gray-400">Doravante denominada <strong>PARCEIRA</strong></p>
            </div>
          </div>
        </div>

        {/* Preâmbulo */}
        <p className="mb-8 text-sm leading-relaxed text-gray-700">
          As partes acima qualificadas, de comum acordo e na melhor forma de direito, têm entre si justos e contratados os termos e condições estabelecidos nas cláusulas abaixo, as quais aceitam e se obrigam a cumprir fielmente.
        </p>

        {/* Cláusulas */}
        <div className="space-y-6">
          {CLAUSULAS.map(c => (
            <div key={c.n}>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-900">
                Cláusula {c.n}ª — {c.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-gray-700">{c.texto}</p>
            </div>
          ))}
        </div>

        {/* Anexo I — Tabela de comissões */}
        <div className="mt-10 rounded-lg border border-gray-200 p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">Anexo I · Tabela de Comissões</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="pb-2 pr-4">Produto</th>
                <th className="pb-2 pr-4">Comissão s/ valor liberado</th>
                <th className="pb-2">Prazo de pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {[
                { prod: 'Home Equity', com: '1,20%', prazo: '5 dias úteis após liberação' },
                { prod: 'Crédito para Construção', com: '1,00%', prazo: '5 dias úteis após liberação' },
                { prod: 'Financiamento Imobiliário', com: '0,80%', prazo: '5 dias úteis após liberação' },
                { prod: 'Bônus por volume mensal > R$ 5M', com: '+0,20% adicional', prazo: 'Apuração mensal' },
              ].map(r => (
                <tr key={r.prod}>
                  <td className="py-2 pr-4 font-medium text-gray-900">{r.prod}</td>
                  <td className="py-2 pr-4 font-mono font-semibold" style={{ color: '#DC2626' }}>{r.com}</td>
                  <td className="py-2 text-gray-500">{r.prazo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Assinaturas */}
        <div className="mt-12">
          <p className="mb-8 text-center text-sm text-gray-500">
            São Paulo, {HOJE}
          </p>
          <div className="grid grid-cols-2 gap-12">
            <div className="text-center">
              <div className="mx-auto mb-2 h-16 border-b border-gray-400" />
              <p className="text-sm font-semibold text-gray-900">Mercurio Capital Ltda.</p>
              <p className="text-xs text-gray-500">CNPJ 12.345.678/0001-90</p>
              <p className="mt-1 text-xs text-gray-400">Representante legal</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-2 h-16 border-b border-gray-400" />
              <p className="text-sm font-semibold text-gray-900">Construtora Aurora Ltda.</p>
              <p className="text-xs text-gray-500">CNPJ 98.765.432/0001-10</p>
              <p className="mt-1 text-xs text-gray-400">Representante legal</p>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-12">
            <div className="text-center">
              <div className="mx-auto mb-2 h-12 border-b border-gray-300" />
              <p className="text-xs text-gray-400">Testemunha 1 · CPF</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-2 h-12 border-b border-gray-300" />
              <p className="text-xs text-gray-400">Testemunha 2 · CPF</p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-10 border-t border-gray-100 pt-4 text-center text-[10px] text-gray-300">
          Mercurio Capital Ltda. · mercuriocapitalsa.com.br · Este documento é válido como instrumento particular nos termos do art. 221 do Código Civil Brasileiro.
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .contract-doc {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 32px !important;
          }
        }
      `}</style>
    </div>
  )
}
