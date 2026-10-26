import { calcularSimulacao, type SimuladorCreditoValues } from '@/components/SimuladorCredito'
import { brl } from '@/lib/utils'
import logoWide from '@/assets/logos/logowide.png'
import { createPortal } from 'react-dom'

const AMORTIZACAO_LABEL = { price: 'PRICE', sac: 'SAC' } as const
const CORRECAO_LABEL = { pos_fixado: 'Pós-fixado (IPCA)', pre_fixado: 'Pré-fixado' } as const

export function SimulacaoCreditoPdf({
  values,
  produto,
  pessoaTipo,
}: {
  values: SimuladorCreditoValues
  produto: string
  pessoaTipo?: string
}) {
  const { calculo, ltv } = calcularSimulacao(values)
  const date = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const schedulePages = [
    calculo.parcelas.slice(0, 20),
    ...Array.from({ length: Math.ceil(Math.max(0, calculo.parcelas.length - 20) / 50) }, (_, index) =>
      calculo.parcelas.slice(20 + index * 50, 20 + (index + 1) * 50)),
  ]

  return createPortal(
    <article className="simulation-print-document" aria-label="Documento de prévia da simulação">
      <header className="simulation-print-header">
        <img src={logoWide} alt="Mercúrio Capital" />
        <div>
          <h1>Prévia da simulação de crédito</h1>
          <p>{produto}{pessoaTipo ? ` · ${pessoaTipo}` : ''} · {date}</p>
        </div>
      </header>

      <div className="simulation-print-warning">
        PRÉVIA INFORMATIVA — encargos pendentes de validação financeira
      </div>
      <p className="simulation-print-notice">
        Esta estimativa ainda não inclui IOF, tarifa de registro, TAC, seguros MIP/DFI ou outras despesas.
        Esses itens podem alterar o valor financiado, as parcelas e o total. Na modalidade pós-fixada, a variação futura do IPCA também não está projetada. Não representa aprovação de crédito nem condição final.
      </p>

      <section className="simulation-print-hero" aria-label="Resultado principal">
        <span>Primeira parcela estimada</span>
        <strong>{brl(calculo.primeiraParcela * 100)}</strong>
        <small>Estimativa mensal sem encargos financeiros</small>
      </section>

      <section className="simulation-print-summary">
        <h2>Condições simuladas</h2>
        <dl>
          <PrintRow label="Crédito solicitado" value={brl(values.valor_solicitado * 100)} strong />
          <PrintRow label="Valor da garantia" value={brl(values.valor_garantia * 100)} />
          <PrintRow label="LTV estimado" value={`${(ltv * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`} />
          <PrintRow label="Taxa" value={`${values.taxa_juros_mensal.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% a.m.`} />
          <PrintRow label="Sistema" value={`${AMORTIZACAO_LABEL[values.amortizacao]} · ${CORRECAO_LABEL[values.correcao]}`} />
          <PrintRow label="Prazo" value={`${values.prazo_meses} meses · carência ${values.carencia_meses} meses`} />
          <PrintRow label="1ª parcela estimada" value={brl(calculo.primeiraParcela * 100)} strong />
          <PrintRow label="Última parcela estimada" value={brl(calculo.ultimaParcela * 100)} strong />
          <PrintRow label="Total estimado sem encargos" value={brl(calculo.totalPago * 100)} strong />
        </dl>
        <p className="simulation-print-fees">IOF, TAC, registro e seguros: não calculados — aguardando validação financeira.</p>
      </section>

      {schedulePages.map((rows, pageIndex) => <section className={`simulation-print-schedule ${pageIndex > 0 ? 'simulation-print-schedule--next' : ''}`} key={pageIndex}>
        <h2>Cronograma estimado sem encargos{pageIndex > 0 ? ' · continuação' : ''}</h2>
        <table>
          <thead><tr><th>Parcela</th><th>Saldo devedor</th><th>Juros</th><th>Amortização</th><th>Parcela</th></tr></thead>
          <tbody>{rows.map(row => (
            <tr key={row.mes}>
              <td>{row.mes}</td>
              <td>{brl(row.saldo * 100)}</td>
              <td>{brl(row.juros * 100)}</td>
              <td>{brl(row.amortizacao * 100)}</td>
              <td>{brl(row.parcela * 100)}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>)}

      <footer className="simulation-print-footer">
        Valores preliminares para fins informativos. Sujeitos à validação de premissas financeiras, análise de crédito,
        avaliação da garantia e condições vigentes. Mercúrio Capital · mercuriocapitalsa.com.br
      </footer>
      <style>{`
        @media screen { .simulation-print-document { display: none; } }
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body > *:not(.simulation-print-document) { display: none !important; }
          body > .simulation-print-document { display: block !important; }
          .simulation-print-document { position: static !important; width: 182mm !important; max-width: 100% !important; box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; background: #fff; color: #202223; font: 9pt Arial, sans-serif; }
          .simulation-print-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e4e4e3; padding-bottom: 14px; }
          .simulation-print-header img { max-width: 155px; max-height: 48px; object-fit: contain; }
          .simulation-print-header > div { text-align: right; }
          .simulation-print-header h1 { margin: 0; font-size: 17pt; color: #202223; }
          .simulation-print-header p { margin: 4px 0 0; color: #676a6d; }
          .simulation-print-warning { margin: 14px 0 8px; padding: 9px 11px; border: 1px solid #edd7d2; border-radius: 6px; background: #fffaf8; color: #ad2b2d; font-weight: 700; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .simulation-print-notice, .simulation-print-footer { color: #676a6d; line-height: 1.45; }
          .simulation-print-hero { display: flex; flex-direction: column; gap: 3px; margin-top: 14px; padding: 14px 17px; border-left: 4px solid #cf2f31; border-radius: 5px; background: #fafafa; break-inside: avoid; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .simulation-print-hero span { color: #cf2f31; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
          .simulation-print-hero strong { color: #151515; font-size: 23pt; line-height: 1.1; }
          .simulation-print-hero small { color: #8b8b8b; }
          .simulation-print-summary { margin-top: 16px; break-inside: avoid; }
          .simulation-print-summary h2, .simulation-print-schedule h2 { margin: 0 0 8px; font-size: 12pt; color: #202223; }
          .simulation-print-summary dl { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; margin: 0; border: 1px solid #e4e4e3; border-radius: 6px; padding: 4px 12px; }
          .simulation-print-row { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid #ededed; padding: 7px 0; }
          .simulation-print-row dt { color: #676a6d; }
          .simulation-print-row dd { margin: 0; text-align: right; }
          .simulation-print-fees { margin: 8px 0 0; color: #ad2b2d; font-weight: 700; }
          .simulation-print-schedule { margin-top: 18px; }
          .simulation-print-schedule--next { break-before: page; page-break-before: always; margin-top: 0; }
          .simulation-print-schedule table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 7.5pt; }
          .simulation-print-schedule thead { display: table-header-group; }
          .simulation-print-schedule tr { break-inside: avoid; page-break-inside: avoid; }
          .simulation-print-schedule th, .simulation-print-schedule td { padding: 3px 5px; border: 1px solid #e4e4e3; text-align: right; }
          .simulation-print-schedule th:first-child, .simulation-print-schedule td:first-child { text-align: center; }
          .simulation-print-schedule th { background: #f7f7f7 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .simulation-print-footer { margin-top: 18px; border-top: 1px solid #e4e4e3; padding-top: 8px; font-size: 8pt; }
        }
      `}</style>
    </article>
  , document.body)
}

function PrintRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="simulation-print-row"><dt>{label}</dt><dd style={strong ? { fontWeight: 700 } : undefined}>{value}</dd></div>
}
