import { FileText } from 'lucide-react-native'
import { PartnerScreen, PartnerCard, PartnerTitle, PartnerBody } from '@/components/parceiro/PartnerUI'

export default function ContratoParceria() {
  return <PartnerScreen title="Contrato de parceria" subtitle="Documento oficial da sua parceria">
    <PartnerCard><FileText size={30} color="#F87171" /><PartnerTitle>Documento ainda indisponível</PartnerTitle>
      <PartnerBody>O contrato oficial da sua parceria ainda não está disponível neste app. Consulte a equipe Mercúrio pelos canais de atendimento que você já utiliza.</PartnerBody>
    </PartnerCard>
  </PartnerScreen>
}
