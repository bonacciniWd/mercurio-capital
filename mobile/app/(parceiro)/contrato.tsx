import { useState } from 'react'
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import {
  ArrowLeft, FileText, Download, Share2,
} from 'lucide-react-native'

const HOJE = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
const ANO = new Date().getFullYear()

const CLAUSULAS = [
  { n: '1', titulo: 'DO OBJETO', texto: 'O presente Contrato tem por objeto o credenciamento da PARCEIRA junto à MERCURIO CAPITAL para a indicação e intermediação de operações de crédito imobiliário nas modalidades de Home Equity, Crédito para Construção e Financiamento Imobiliário, nos termos e condições estabelecidos neste instrumento e em seus Anexos.' },
  { n: '2', titulo: 'DAS OBRIGAÇÕES DA PARCEIRA', texto: 'São obrigações da PARCEIRA: (i) indicar clientes com perfil compatível com as linhas de crédito disponíveis; (ii) fornecer documentação completa e verossímil dos proponentes indicados; (iii) não praticar qualquer ato que configure captação irregular de recursos ou oferta pública de valores mobiliários; (iv) manter sigilo sobre informações operacionais e de pricing recebidas; (v) agir sempre em conformidade com as normas do Banco Central do Brasil, LGPD e demais regulamentações aplicáveis.' },
  { n: '3', titulo: 'DAS OBRIGAÇÕES DA MERCURIO CAPITAL', texto: 'São obrigações da MERCURIO CAPITAL: (i) disponibilizar acesso ao sistema de gestão de propostas; (ii) analisar as propostas indicadas no prazo máximo de 5 (cinco) dias úteis após o recebimento da documentação completa; (iii) remunerar a PARCEIRA conforme tabela de comissões vigente, Anexo I; (iv) manter sigilo sobre dados cadastrais dos clientes indicados; (v) comunicar à PARCEIRA qualquer alteração de produto, taxa ou política de crédito com antecedência mínima de 30 dias.' },
  { n: '4', titulo: 'DA REMUNERAÇÃO E COMISSÕES', texto: 'Pela intermediação bem-sucedida, a PARCEIRA fará jus a comissão calculada sobre o valor liberado de cada operação, conforme tabela constante do Anexo I, que integra este instrumento. O pagamento será realizado em até 5 (cinco) dias úteis após o efetivo desembolso dos recursos ao tomador final, mediante emissão de Nota Fiscal de Serviços pela PARCEIRA. Operações canceladas após liberação parcial serão apuradas proporcionalmente.' },
  { n: '5', titulo: 'DA VEDAÇÃO À CONCORRÊNCIA DESLEAL', texto: 'Durante a vigência deste Contrato e por 12 (doze) meses após seu término, a PARCEIRA compromete-se a não utilizar informações operacionais, de precificação ou de clientes obtidas por meio da plataforma MERCURIO CAPITAL para beneficiar concorrentes diretos, sob pena de rescisão imediata e indenização por perdas e danos.' },
  { n: '6', titulo: 'DA PROTEÇÃO DE DADOS (LGPD)', texto: 'As partes comprometem-se a tratar os dados pessoais dos clientes indicados em estrita conformidade com a Lei 13.709/2018 (LGPD). A PARCEIRA atuará como "operadora" nos termos do art. 5º, VII, da LGPD, sendo vedada a utilização dos dados para finalidade diversa da execução deste Contrato. O Encarregado de Dados (DPO) da MERCURIO CAPITAL é o responsável pelo canal de atendimento de titulares: dpo@mercuriocapitalsa.com.br.' },
  { n: '7', titulo: 'DA VIGÊNCIA E RESCISÃO', texto: 'O presente Contrato é firmado por prazo indeterminado, podendo qualquer das partes rescindi-lo mediante notificação escrita com antecedência mínima de 30 (trinta) dias. A rescisão imotivada não gera direito a indenizações, exceto quanto a comissões de operações já liberadas. A MERCURIO CAPITAL poderá rescindir imediatamente, sem ônus, em caso de comprovada fraude, violação de compliance ou descumprimento de cláusulas essenciais.' },
  { n: '8', titulo: 'DO FORO E LEI APLICÁVEL', texto: 'As partes elegem o Foro Central da Comarca de São Paulo/SP, com exclusão de qualquer outro, por mais privilegiado que seja, para dirimir quaisquer controvérsias oriundas do presente instrumento. Aplica-se a lei brasileira em sua integralidade.' },
]

const COMISSOES = [
  { prod: 'Home Equity', com: '1,20%', prazo: '5 dias úteis após liberação' },
  { prod: 'Crédito para Construção', com: '1,00%', prazo: '5 dias úteis após liberação' },
  { prod: 'Financiamento Imobiliário', com: '0,80%', prazo: '5 dias úteis após liberação' },
  { prod: 'Bônus por volume mensal > R$ 5M', com: '+0,20% adicional', prazo: 'Apuração mensal' },
]

function buildHtml(): string {
  const cls = CLAUSULAS.map(c => `
    <div class="clausula">
      <h3>Cláusula ${c.n}ª — ${c.titulo}</h3>
      <p>${c.texto}</p>
    </div>`).join('')
  const com = COMISSOES.map(r => `
    <tr>
      <td><strong>${r.prod}</strong></td>
      <td class="com">${r.com}</td>
      <td class="muted">${r.prazo}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 24mm 18mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; font-size: 11pt; line-height: 1.55; }
  .eyebrow { color: #DC2626; font-size: 9pt; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; }
  h1 { margin: 4px 0 2px; font-size: 18pt; color: #111; }
  .subtitle { color: #777; font-size: 10pt; margin: 0; }
  .header { border-bottom: 2px solid #DC2626; padding-bottom: 14px; margin-bottom: 20px;
    display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .header .meta { font-size: 9pt; color: #999; text-align: right; }
  .partes { background: #f7f7f7; border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; }
  .partes .label { font-size: 8.5pt; color: #888; letter-spacing: 1.5px; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; }
  .partes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .partes h4 { margin: 0 0 4px; font-size: 10.5pt; color: #111; }
  .partes p { margin: 1px 0; font-size: 10pt; color: #444; }
  .preambulo { margin-bottom: 18px; font-size: 11pt; color: #333; }
  .clausula { margin-bottom: 14px; page-break-inside: avoid; }
  .clausula h3 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.4px; color: #111; margin: 0 0 6px; }
  .clausula p { margin: 0; text-align: justify; }
  .anexo { border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px 16px; margin-top: 24px; }
  .anexo .label { font-size: 8.5pt; color: #888; letter-spacing: 1.5px; text-transform: uppercase; font-weight: bold; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th { text-align: left; font-size: 8.5pt; color: #888; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  td { padding: 7px 0; border-bottom: 1px solid #f0f0f0; }
  td.com { color: #DC2626; font-family: 'Courier New', monospace; font-weight: bold; }
  .muted { color: #777; }
  .assinaturas { margin-top: 40px; page-break-inside: avoid; }
  .assinaturas .data { text-align: center; color: #777; margin-bottom: 32px; }
  .ass-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; }
  .ass-line { border-bottom: 1px solid #888; height: 50px; margin: 0 auto 6px; }
  .ass-line.small { border-bottom: 1px solid #bbb; height: 38px; }
  .ass-box { text-align: center; }
  .ass-box .nome { font-weight: bold; color: #111; font-size: 10pt; }
  .ass-box .meta { color: #888; font-size: 9pt; }
  .rodape { margin-top: 32px; padding-top: 10px; border-top: 1px solid #eee; text-align: center; color: #bbb; font-size: 8pt; }
</style></head>
<body>
  <div class="header">
    <div>
      <p class="eyebrow">Mercurio Capital · Crédito Imobiliário</p>
      <h1>CONTRATO DE PARCERIA COMERCIAL</h1>
      <p class="subtitle">Instrumento Particular de Credenciamento e Intermediação</p>
    </div>
    <div class="meta">
      <p>Versão 2.1 · ${HOJE}</p>
      <p style="font-family:'Courier New', monospace; margin:2px 0 0;">MC-PART-${ANO}-XXXX</p>
    </div>
  </div>

  <div class="partes">
    <p class="label">Qualificação das Partes</p>
    <div class="partes-grid">
      <div>
        <h4>CONTRATANTE</h4>
        <p><strong>Mercurio Capital Ltda.</strong></p>
        <p>CNPJ: 12.345.678/0001-90</p>
        <p>Av. Paulista, 1.000, 15º andar</p>
        <p>São Paulo/SP — CEP 01310-100</p>
        <p class="muted" style="margin-top:4px; font-size:9pt;">Doravante denominada <strong>MERCURIO CAPITAL</strong></p>
      </div>
      <div>
        <h4>PARCEIRA</h4>
        <p><strong>Construtora Aurora Ltda.</strong></p>
        <p>CNPJ: 98.765.432/0001-10</p>
        <p>Rua das Palmeiras, 500</p>
        <p>São Paulo/SP — CEP 04567-000</p>
        <p class="muted" style="margin-top:4px; font-size:9pt;">Doravante denominada <strong>PARCEIRA</strong></p>
      </div>
    </div>
  </div>

  <p class="preambulo">
    As partes acima qualificadas, de comum acordo e na melhor forma de direito, têm entre si justos e
    contratados os termos e condições estabelecidos nas cláusulas abaixo, as quais aceitam e se obrigam
    a cumprir fielmente.
  </p>

  ${cls}

  <div class="anexo">
    <p class="label">Anexo I · Tabela de Comissões</p>
    <table>
      <thead>
        <tr><th>Produto</th><th>Comissão s/ valor liberado</th><th>Prazo de pagamento</th></tr>
      </thead>
      <tbody>${com}</tbody>
    </table>
  </div>

  <div class="assinaturas">
    <p class="data">São Paulo, ${HOJE}</p>
    <div class="ass-grid">
      <div class="ass-box">
        <div class="ass-line"></div>
        <p class="nome">Mercurio Capital Ltda.</p>
        <p class="meta">CNPJ 12.345.678/0001-90</p>
        <p class="meta">Representante legal</p>
      </div>
      <div class="ass-box">
        <div class="ass-line"></div>
        <p class="nome">Construtora Aurora Ltda.</p>
        <p class="meta">CNPJ 98.765.432/0001-10</p>
        <p class="meta">Representante legal</p>
      </div>
    </div>
    <div class="ass-grid" style="margin-top: 24px;">
      <div class="ass-box">
        <div class="ass-line small"></div>
        <p class="meta">Testemunha 1 · CPF</p>
      </div>
      <div class="ass-box">
        <div class="ass-line small"></div>
        <p class="meta">Testemunha 2 · CPF</p>
      </div>
    </div>
  </div>

  <div class="rodape">
    Mercurio Capital Ltda. · mercuriocapitalsa.com.br · Este documento é válido como instrumento particular
    nos termos do art. 221 do Código Civil Brasileiro.
  </div>
</body></html>`
}

export default function PartnerContrato() {
  const [gerando, setGerando] = useState(false)

  async function exportarPdf(share: boolean) {
    setGerando(true)
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml(), base64: false })
      if (share) {
        const canShare = await Sharing.isAvailableAsync()
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Contrato de Parceria Mercurio',
            UTI: 'com.adobe.pdf',
          })
        } else {
          Alert.alert('PDF gerado', `Arquivo salvo em:\n${uri}`)
        }
      } else {
        // print direto (abre painel nativo do sistema)
        await Print.printAsync({ html: buildHtml() })
      }
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao gerar PDF.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Header escuro com ações */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(parceiro)/perfil')}
          style={s.backBtn}
        >
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>PARCEIRO</Text>
          <Text style={s.headerTitle}>Contrato Comercial</Text>
        </View>
        <Pressable
          onPress={() => exportarPdf(true)}
          disabled={gerando}
          style={s.actionBtnGhost}
        >
          {gerando
            ? <ActivityIndicator size="small" color="white" />
            : <Share2 size={16} color="white" />}
        </Pressable>
        <Pressable
          onPress={() => exportarPdf(false)}
          disabled={gerando}
          style={s.actionBtnPrimary}
        >
          <Download size={14} color="white" />
          <Text style={s.actionBtnText}>PDF</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Documento (visual sóbrio fundo claro) */}
        <View style={s.doc}>
          {/* Cabeçalho */}
          <View style={s.docHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>MERCURIO CAPITAL · CRÉDITO IMOBILIÁRIO</Text>
              <Text style={s.docTitle}>CONTRATO DE PARCERIA COMERCIAL</Text>
              <Text style={s.docSubtitle}>Instrumento Particular de Credenciamento e Intermediação</Text>
            </View>
            <View>
              <Text style={s.meta}>Versão 2.1</Text>
              <Text style={s.meta}>{HOJE}</Text>
              <Text style={s.metaMono}>MC-PART-{ANO}-XXXX</Text>
            </View>
          </View>

          {/* Qualificação */}
          <View style={s.partesBox}>
            <Text style={s.miniLabel}>Qualificação das Partes</Text>
            <View style={s.partesGrid}>
              <View style={s.parteCol}>
                <Text style={s.parteHead}>CONTRATANTE</Text>
                <Text style={s.parteName}>Mercurio Capital Ltda.</Text>
                <Text style={s.parteLine}>CNPJ: 12.345.678/0001-90</Text>
                <Text style={s.parteLine}>Av. Paulista, 1.000, 15º andar</Text>
                <Text style={s.parteLine}>São Paulo/SP — CEP 01310-100</Text>
                <Text style={s.parteFoot}>Doravante denominada MERCURIO CAPITAL</Text>
              </View>
              <View style={s.parteCol}>
                <Text style={s.parteHead}>PARCEIRA</Text>
                <Text style={s.parteName}>Construtora Aurora Ltda.</Text>
                <Text style={s.parteLine}>CNPJ: 98.765.432/0001-10</Text>
                <Text style={s.parteLine}>Rua das Palmeiras, 500</Text>
                <Text style={s.parteLine}>São Paulo/SP — CEP 04567-000</Text>
                <Text style={s.parteFoot}>Doravante denominada PARCEIRA</Text>
              </View>
            </View>
          </View>

          {/* Preâmbulo */}
          <Text style={s.preambulo}>
            As partes acima qualificadas, de comum acordo e na melhor forma de direito, têm entre si
            justos e contratados os termos e condições estabelecidos nas cláusulas abaixo, as quais aceitam
            e se obrigam a cumprir fielmente.
          </Text>

          {/* Cláusulas */}
          {CLAUSULAS.map(c => (
            <View key={c.n} style={s.clausula}>
              <Text style={s.clausulaTitle}>Cláusula {c.n}ª — {c.titulo}</Text>
              <Text style={s.clausulaText}>{c.texto}</Text>
            </View>
          ))}

          {/* Anexo I */}
          <View style={s.anexoBox}>
            <Text style={s.miniLabel}>Anexo I · Tabela de Comissões</Text>
            <View style={s.tableHead}>
              <Text style={[s.thCol, { flex: 1.6 }]}>Produto</Text>
              <Text style={[s.thCol, { flex: 1.1, textAlign: 'right' }]}>Comissão</Text>
              <Text style={[s.thCol, { flex: 1.2 }]}>Prazo</Text>
            </View>
            {COMISSOES.map(r => (
              <View key={r.prod} style={s.tableRow}>
                <Text style={[s.tdCol, { flex: 1.6, fontWeight: '600', color: '#111' }]}>{r.prod}</Text>
                <Text style={[s.tdCol, { flex: 1.1, textAlign: 'right', color: '#DC2626', fontWeight: '700', fontFamily: 'Courier' }]}>
                  {r.com}
                </Text>
                <Text style={[s.tdCol, { flex: 1.2, color: '#777' }]}>{r.prazo}</Text>
              </View>
            ))}
          </View>

          {/* Assinaturas */}
          <Text style={s.dataLocal}>São Paulo, {HOJE}</Text>
          <View style={s.assGrid}>
            <View style={s.assBox}>
              <View style={s.assLine} />
              <Text style={s.assName}>Mercurio Capital Ltda.</Text>
              <Text style={s.assMeta}>CNPJ 12.345.678/0001-90</Text>
              <Text style={s.assMeta}>Representante legal</Text>
            </View>
            <View style={s.assBox}>
              <View style={s.assLine} />
              <Text style={s.assName}>Construtora Aurora Ltda.</Text>
              <Text style={s.assMeta}>CNPJ 98.765.432/0001-10</Text>
              <Text style={s.assMeta}>Representante legal</Text>
            </View>
          </View>
          <View style={[s.assGrid, { marginTop: 18 }]}>
            <View style={s.assBox}>
              <View style={s.assLineSmall} />
              <Text style={s.assMeta}>Testemunha 1 · CPF</Text>
            </View>
            <View style={s.assBox}>
              <View style={s.assLineSmall} />
              <Text style={s.assMeta}>Testemunha 2 · CPF</Text>
            </View>
          </View>

          {/* Rodapé */}
          <View style={s.rodape}>
            <FileText size={10} color="#CCCCCC" />
            <Text style={s.rodapeText}>
              Mercurio Capital Ltda. · mercuriocapitalsa.com.br · Válido como instrumento particular
              (art. 221 CC).
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1f1f1f',
  },
  backBtn: { padding: 8, marginLeft: -4 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 1 },

  actionBtnGhost: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, backgroundColor: '#1f1f1f',
  },
  actionBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: '#DC2626',
  },
  actionBtnText: { fontSize: 12, fontWeight: '800', color: 'white' },

  doc: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#e5e5e5',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  docHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
    borderBottomWidth: 2, borderBottomColor: '#DC2626', paddingBottom: 12, marginBottom: 16,
  },
  eyebrow: { fontSize: 9, letterSpacing: 1.4, color: '#DC2626', fontWeight: '800' },
  docTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginTop: 4, letterSpacing: -0.2 },
  docSubtitle: { fontSize: 11, color: '#777', marginTop: 2 },
  meta: { fontSize: 9, color: '#999', textAlign: 'right' },
  metaMono: { fontSize: 9, color: '#999', textAlign: 'right', fontFamily: 'Courier', marginTop: 2 },

  partesBox: {
    backgroundColor: '#f7f7f7', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#e5e5e5', marginBottom: 16,
  },
  miniLabel: {
    fontSize: 9, color: '#888', letterSpacing: 1.4, textTransform: 'uppercase',
    fontWeight: '700', marginBottom: 8,
  },
  partesGrid: { flexDirection: 'row', gap: 12 },
  parteCol: { flex: 1 },
  parteHead: { fontSize: 10.5, fontWeight: '700', color: '#111', marginBottom: 4 },
  parteName: { fontSize: 11, fontWeight: '700', color: '#222' },
  parteLine: { fontSize: 10.5, color: '#444', marginTop: 1 },
  parteFoot: { fontSize: 9, color: '#999', marginTop: 4 },

  preambulo: { fontSize: 12, color: '#333', lineHeight: 18, marginBottom: 18 },

  clausula: { marginBottom: 14 },
  clausulaTitle: {
    fontSize: 10.5, fontWeight: '800', color: '#111', textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 6,
  },
  clausulaText: { fontSize: 12, color: '#333', lineHeight: 18, textAlign: 'justify' },

  anexoBox: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8, padding: 14, marginTop: 18,
  },
  tableHead: {
    flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#ddd',
  },
  thCol: { fontSize: 9, color: '#888', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.4 },
  tableRow: {
    flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  tdCol: { fontSize: 11 },

  dataLocal: { fontSize: 11, color: '#777', textAlign: 'center', marginTop: 32, marginBottom: 22 },
  assGrid: { flexDirection: 'row', gap: 18 },
  assBox: { flex: 1, alignItems: 'center' },
  assLine: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#888', height: 44, marginBottom: 6 },
  assLineSmall: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#bbb', height: 32, marginBottom: 6 },
  assName: { fontSize: 11, fontWeight: '700', color: '#111' },
  assMeta: { fontSize: 9.5, color: '#888' },

  rodape: {
    marginTop: 24, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  rodapeText: { fontSize: 8.5, color: '#bbb', textAlign: 'center', flexShrink: 1 },
})

