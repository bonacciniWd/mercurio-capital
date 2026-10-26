import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import buildingImage from '@/assets/construcao.jpg'
import './landing-construction-section.css'

export function LandingConstructionSection() {
  return (
    <section id="credito-construcao" className="landing-construction" aria-labelledby="landing-construction-title">
      <div className="landing-construction__inner">
        <div className="landing-construction__copy">
          <p className="landing-construction__eyebrow"><span aria-hidden="true" />Crédito para construção</p>
          <h2 id="landing-construction-title">Capital para construir.<br /><em>Estrutura para ir além.</em></h2>
          <p className="landing-construction__intro">
            Crédito estruturado para construtores e investidores que desenvolvem casas de alto padrão, com análise do projeto e possibilidade de liberação por etapas.
          </p>
          <Link className="landing-construction__button" to="/credito-para-construcao">
            <span>Conhecer crédito para construção</span><ArrowRight aria-hidden="true" />
          </Link>
          <ul className="landing-construction__trust" aria-label="Sobre o crédito para construção">
            <li>Construtores e investidores</li>
            <li>Casas de alto padrão</li>
            <li>Análise do projeto</li>
          </ul>
        </div>
        <div className="landing-construction__visual">
          <div className="landing-construction__image-wrap">
            <img src={buildingImage} alt="Residência contemporânea de alto padrão em construção, com concreto aparente, pedra natural e andaimes" loading="lazy" decoding="async" width="896" height="1200" />
          </div>
          <div className="landing-construction__card">
            <span>Crédito estruturado</span>
            <strong>Do projeto<br />à obra.</strong>
            <p>Condições definidas por operação</p>
          </div>
          <span className="landing-construction__vertical" aria-hidden="true">Mercúrio Capital · Crédito para construção</span>
        </div>
      </div>
    </section>
  )
}
