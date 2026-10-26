import { useEffect, useState } from 'react'
import logoWide from '@/assets/logos/logowide.png'
import { CpcLeadForm } from '@/components/CpcLeadForm'
import './credito-para-construcao.css'

const heroImage = 'https://images.unsplash.com/photo-1760067538022-8ef8739b1b18?auto=format&fit=crop&w=2200&q=85'

const steps = [
  ['Projeto e terreno', 'Análise do ativo, da localização, da documentação e do projeto arquitetônico.'],
  ['Orçamento e cronograma', 'Avaliação do custo estimado da construção e das etapas de execução previstas.'],
  ['Crédito e garantias', 'Definição da estrutura financeira, do limite, do prazo e das garantias, conforme análise e aprovação.'],
  ['Liberação por etapas', 'Os recursos podem ser liberados conforme as condições contratuais e a evolução física da construção.'],
] as const

const criteria = [
  ['Terreno definido', 'Terreno próprio ou adquirido, com documentação regular e localização compatível com o empreendimento.'],
  ['Projeto estruturado', 'Projeto arquitetônico, orçamento e cronograma coerentes com o padrão da residência.'],
  ['Viabilidade econômica', 'Avaliação da relação entre investimento total, valor estimado de venda e margem do projeto.'],
  ['Experiência', 'Histórico de construção, gestão de obras e capacidade de execução.'],
  ['Capital próprio', 'Participação do construtor e recursos já investidos no empreendimento.'],
  ['Mercado e liquidez', 'Análise da localização, da demanda e do mercado de casas de alto padrão.'],
] as const

const questions = [
  ['O CPC é destinado a qualquer pessoa que deseja construir uma casa?', 'O produto apresentado nesta página é direcionado principalmente a construtores e investidores que desenvolvem residências de alto padrão para venda. Cada solicitação depende da avaliação do perfil e do projeto.'],
  ['É possível financiar mais de uma residência?', 'A estrutura pode considerar uma ou várias residências. Em operações com diferentes projetos, os limites e as liberações dependem da análise e das condições estabelecidas.'],
  ['Como funciona a liberação do crédito?', 'Os recursos podem ser liberados em etapas, conforme o cronograma, a evolução física da obra e as condições previstas na operação.'],
  ['O próprio imóvel pode ser utilizado como garantia?', 'A estrutura pode envolver o terreno e as acessões da construção como garantia. Garantias complementares podem ser exigidas conforme a operação.'],
  ['Quais informações são consideradas na análise?', 'Entre os fatores avaliados estão localização, documentação, projeto, orçamento, cronograma, margem estimada, capital próprio e experiência do construtor.'],
  ['Como são definidos os valores, prazos e taxas?', 'As condições são definidas caso a caso, após a análise de crédito, do projeto, das garantias e das políticas do fundo.'],
] as const

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {diagonal ? <path d="M5 19 19 5M5 5h14v14" /> : <path d="M4 12h16m-6-6 6 6-6 6" />}
    </svg>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="cpc-eyebrow"><span />{children}</p>
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="cpc-faq-list">
      {questions.map(([question, answer], index) => {
        const answerId = `cpc-answer-${index + 1}`
        const isOpen = open === index

        return (
          <div className="cpc-faq-item" key={question}>
            <h3>
              <button
                className="btn-no-liquid"
                type="button"
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span className="cpc-faq-number">{String(index + 1).padStart(2, '0')}</span>
                <span>{question}</span>
                <span className="cpc-plus" aria-hidden="true">{isOpen ? '−' : '+'}</span>
              </button>
            </h3>
            <div id={answerId} hidden={!isOpen}>
              <p>{answer}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function CreditoParaConstrucao() {
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    const originalTitle = document.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const originalDescription = description?.content
    const fontLinkId = 'cpc-heading-font'
    let addedFontLink = false

    document.title = 'Crédito para Construção de Casas de Alto Padrão | Mercúrio Capital'
    if (description) {
      description.content = 'Conheça o CPC da Mercúrio Capital: uma estrutura de crédito privado para construtores e investidores imobiliários, com análise de projeto e possibilidade de liberação por etapas.'
    }

    if (!document.getElementById(fontLinkId)) {
      const fontLink = document.createElement('link')
      fontLink.id = fontLinkId
      fontLink.rel = 'stylesheet'
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@600;700&display=swap'
      document.head.appendChild(fontLink)
      addedFontLink = true
    }

    return () => {
      document.title = originalTitle
      if (description && originalDescription !== undefined) description.content = originalDescription
      if (addedFontLink) document.getElementById(fontLinkId)?.remove()
    }
  }, [])

  return (
    <div className="cpc-page">
      <a className="cpc-skip-link" href="#cpc-conteudo">Pular para o conteúdo</a>
      <header className="cpc-header">
        <a href="/" aria-label="Mercúrio Capital, início da página">
          <img src={logoWide} alt="Mercúrio Capital" width="190" height="76" />
        </a>
        <div className="cpc-header-product">SOLUÇÕES ESTRUTURADAS <span>/</span> CRÉDITO IMOBILIÁRIO</div>
        <a className="cpc-header-cta" href="#cpc-avaliacao">Vamos conversar <Arrow diagonal /></a>
      </header>

      <main id="cpc-conteudo">
        <section className="cpc-hero" id="cpc-inicio">
          <img
            className="cpc-hero-image"
            src={heroImage}
            alt="Residência contemporânea com grandes janelas, madeira e vegetação tropical. Imagem ilustrativa."
            width="2200"
            height="1467"
          />
          <div className="cpc-hero-shade" />
          <div className="cpc-container cpc-hero-content">
            <Label>MERCÚRIO CAPITAL / CPC</Label>
            <h1>Crédito para construção de casas de alto padrão.</h1>
            <p className="cpc-hero-description">
              Uma estrutura de crédito privado para construtores e investidores imobiliários, com análise do projeto e possibilidade de liberação de recursos conforme a evolução da obra.
            </p>
            <div className="cpc-hero-actions">
              <a className="cpc-button" href="#cpc-avaliacao">Solicitar avaliação do projeto <Arrow diagonal /></a>
              <a className="cpc-text-link" href="#cpc-solucao">Entenda como funciona <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="cpc-container cpc-hero-bottom">
            <div><span className="cpc-little-line" /> TERRENO + OBRA</div>
            <div><span className="cpc-little-line" /> LIBERAÇÃO POR ETAPAS</div>
            <div><span className="cpc-little-line" /> ESTRUTURAÇÃO CONFORME O PROJETO</div>
            <span className="cpc-hero-index">CPC / 01</span>
          </div>
        </section>

        <section className="cpc-section cpc-container" id="cpc-solucao">
          <Label>01 / A SOLUÇÃO</Label>
          <div className="cpc-editorial-grid">
            <h2>Capital para executar.<br /><span className="cpc-muted">Estrutura para crescer.</span></h2>
            <div className="cpc-prose">
              <p className="cpc-lead">O CPC, Crédito para Construção, é uma operação estruturada junto a fundos de capital privado, destinada a construtores e investidores que desenvolvem casas de alto padrão para venda.</p>
              <p>A estrutura pode financiar uma ou mais residências, considerando o terreno, a obra em desenvolvimento e o valor de mercado projetado do imóvel concluído.</p>
              <p className="cpc-inset-note">A proposta é avaliar uma forma de combinar capital próprio e capital de terceiros, evitando a concentração integral dos recursos do construtor em uma única obra.</p>
            </div>
          </div>
        </section>

        <section className="cpc-section cpc-strategy">
          <div className="cpc-container">
            <Label>02 / ESTRATÉGIA DE CAPITAL</Label>
            <div className="cpc-section-heading">
              <h2>Não é apenas<br />financiar uma obra.</h2>
              <p>É avaliar como o capital pode acompanhar a execução sem concentrar todos os recursos próprios no mesmo projeto.</p>
            </div>
            <div className="cpc-comparison">
              <div>
                <p className="cpc-comparison-label">SEM UMA ESTRUTURA DE CRÉDITO</p>
                <ul>
                  <li>Capital próprio mais concentrado na execução das obras.</li>
                  <li>Maior necessidade de recursos próprios disponíveis para cada etapa.</li>
                  <li>A capacidade de desenvolver projetos simultâneos depende mais diretamente do caixa próprio.</li>
                </ul>
              </div>
              <div className="cpc-comparison-cpc">
                <p className="cpc-comparison-label"><span className="cpc-red-dot" /> COM UMA ESTRUTURA CPC</p>
                <ul>
                  <li>Possibilidade de combinar capital próprio e capital de terceiros.</li>
                  <li>Liberações relacionadas ao avanço e às necessidades da construção.</li>
                  <li>Potencial de ampliar a capacidade de execução, conforme a viabilidade e as condições aprovadas.</li>
                </ul>
              </div>
            </div>
            <p className="cpc-disclaimer">Os efeitos financeiros dependem dos custos, garantias, condições contratuais e características de cada operação.</p>
          </div>
        </section>

        <section className="cpc-section cpc-container" id="cpc-processo">
          <Label>03 / COMO FUNCIONA</Label>
          <div className="cpc-section-heading">
            <h2>Da análise do projeto à<br />liberação dos recursos.</h2>
            <p>O processo começa pela compreensão do empreendimento, de sua documentação e das condições necessárias para avaliar a estrutura de crédito.</p>
          </div>
          <ol className="cpc-steps">
            {steps.map(([title, description], index) => (
              <li key={title}>
                <div className="cpc-step-top"><span>0{index + 1}</span><span className="cpc-step-marker" /></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="cpc-section cpc-tranches">
          <div className="cpc-container">
            <Label>04 / LIBERAÇÃO EM TRANCHES</Label>
            <div className="cpc-section-heading">
              <h2>O crédito acompanha<br />o ritmo da obra.</h2>
              <p>Em estruturas com liberação por etapas, os recursos são disponibilizados conforme o cronograma e o avanço físico da construção, respeitando as condições da operação.</p>
            </div>
            <div className="cpc-construction-visual">
              <div className="cpc-architectural-lines" aria-hidden="true"><span /><span /><span /><span /><span /></div>
              <p>PLANEJAMENTO <span>→</span> EXECUÇÃO <span>→</span> CONCLUSÃO</p>
              <span className="cpc-visual-note">ESQUEMA CONCEITUAL · NÃO REPRESENTA UMA OBRA REAL</span>
            </div>
            <div className="cpc-phases">
              {[
                ['Primeira etapa', 'Mobilização, início da construção e fundações.'],
                ['Segunda etapa', 'Estrutura, alvenaria e cobertura.'],
                ['Terceira etapa', 'Instalações, esquadrias e revestimentos.'],
                ['Quarta etapa', 'Acabamentos, paisagismo e conclusão.'],
              ].map(([title, description], index) => (
                <div key={title}>
                  <span className="cpc-phase-number">0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              ))}
            </div>
            <p className="cpc-disclaimer">Etapas meramente ilustrativas. A quantidade, a sequência e as condições de liberação são definidas conforme cada projeto e contrato.</p>
          </div>
        </section>

        <section className="cpc-section cpc-container">
          <Label>05 / PERFIL DO PROJETO</Label>
          <div className="cpc-editorial-grid cpc-qualification">
            <div>
              <h2>Uma estrutura pensada para quem constrói com visão de negócio.</h2>
              <p>O CPC é especialmente direcionado a construtores e investidores que já atuam profissionalmente no desenvolvimento e na venda de residências de alto padrão.</p>
              <a className="cpc-text-link cpc-dark-link" href="#cpc-avaliacao">Converse sobre seu projeto <Arrow diagonal /></a>
            </div>
            <div>
              <div className="cpc-criteria">
                {criteria.map(([title, description], index) => (
                  <article key={title}>
                    <span className="cpc-item-number">0{index + 1}</span>
                    <div><h3>{title}</h3><p>{description}</p></div>
                  </article>
                ))}
              </div>
              <p className="cpc-disclaimer">Esses critérios são aspectos considerados na avaliação e não representam aprovação automática.</p>
            </div>
          </div>
        </section>

        <section className="cpc-section cpc-conditions">
          <div className="cpc-container">
            <Label>06 / ESTRUTURA DA OPERAÇÃO</Label>
            <div className="cpc-section-heading">
              <h2>Cada projeto exige<br />uma análise própria.</h2>
              <p>A composição das garantias, o limite de crédito, o prazo, as taxas e os custos são definidos conforme as características e os riscos da operação.</p>
            </div>
            <div className="cpc-conditions-grid">
              {[
                ['Garantias', 'A estrutura pode envolver alienação fiduciária do terreno e das acessões presentes e futuras da construção. Conforme o caso, podem ser avaliadas garantias complementares, como recebíveis, aval ou outros ativos.'],
                ['Prazo', 'O prazo é analisado considerando o cronograma de execução e a estratégia de comercialização do empreendimento.'],
                ['Valores e taxas', 'Não existe um limite ou taxa universal para todas as operações CPC. As condições são estabelecidas após a análise do projeto, das garantias, da estrutura financeira e das políticas do fundo.'],
                ['Custos', 'Podem existir despesas relacionadas à estruturação, avaliação, análise jurídica e registros, conforme as condições da operação.'],
              ].map(([title, description]) => (
                <article key={title}><h3>{title}</h3><p>{description}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="cpc-section cpc-container cpc-faq-section">
          <div>
            <Label>07 / PERGUNTAS FREQUENTES</Label>
            <h2>O que você precisa saber antes de começar.</h2>
            <p>Clareza em cada etapa.<br />Uma conversa começa com informação.</p>
          </div>
          <FAQ />
        </section>

        <section className="cpc-section cpc-conversion" id="cpc-avaliacao">
          <div className="cpc-container">
            <Label>MERCÚRIO CAPITAL / CRÉDITO PARA CONSTRUÇÃO</Label>
            <div className="cpc-conversion-grid">
              <h2>Seu próximo projeto começa com uma <span>boa estrutura.</span></h2>
              <div>
                <p>Apresente o cenário da sua obra e converse com a Mercúrio Capital sobre as possibilidades de estruturação de crédito para construção.</p>
                <button className="btn-no-liquid cpc-button" type="button" aria-expanded={formOpen} aria-controls="cpc-lead-form" onClick={() => setFormOpen(open => !open)}>
                  {formOpen ? 'Fechar formulário' : 'Solicitar análise do projeto'} <Arrow diagonal />
                </button>
                {formOpen && <div id="cpc-lead-form" className="cpc-lead-form-wrap"><CpcLeadForm /></div>}
                <p className="cpc-disclaimer">As condições e a disponibilidade de crédito dependem de análise do projeto, do perfil, das garantias e da documentação.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="cpc-footer cpc-container">
        <img src={logoWide} alt="Mercúrio Capital" width="170" height="68" />
        <p>Inteligência financeira.<br />Estruturas para o mercado imobiliário.</p>

      </footer>
    </div>
  )
}
