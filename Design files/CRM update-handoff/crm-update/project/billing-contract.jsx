// billing-contract.jsx — Contract Builder: deal-structure form + live contract-text preview.
// Depends on billing-forms.jsx (F* primitives, FormHead/Foot), billing-data.js.

const DEAL_TYPES = [
  { value: 'zero-risk',  label: 'Zero-risk / Performance', sub: 'All costs on you. Paid on results only.' },
  { value: 'passthrough',label: 'Cost Passthrough',        sub: 'Client pays campaign costs.' },
  { value: 'upfront',    label: 'Fixed Upfront Fee',       sub: 'Client pays a fixed amount in advance.' },
  { value: 'deposit',    label: 'Deposit + Return',        sub: 'Deposit collected, returned on conditions.' },
  { value: 'retainer',   label: 'Monthly Retainer',        sub: 'Fixed recurring charge per month.' },
  { value: 'hybrid',     label: 'Hybrid / Mix',            sub: 'Combination of the above.' },
];
const TIMEZONES = ['Europe/Amsterdam','Europe/Lisbon','America/Sao_Paulo','America/New_York','UTC'];
const PAY_ACCOUNTS = [
  { value: 'eu-n26',  label: 'EU — N26', sub: 'EU bank account' },
  { value: 'br-380',  label: 'BR — Banco 380', sub: 'BR bank account' },
];

// ── localized contract copy ──
const C_LANG = {
  EN: {
    head: 'SERVICE AGREEMENT', intro: (d) => `This Service Agreement ("Agreement") is entered into as of ${d}, between:`,
    provider: 'Service Provider:', client: 'Client:', noClient: '[CLIENT NAME]', noSigner: '[SIGNER NAME]',
    s1: '1. SCOPE OF SERVICES', s1body: 'Lead Awaker agrees to provide the following services to the Client:',
    scope: ['Automated lead reactivation via WhatsApp, SMS, and/or Instagram, powered by Artificial Intelligence.','Configuration, monitoring, and optimization of outreach campaigns.','Weekly check-in call with the Client to review campaign performance.','Access to the Lead Awaker CRM dashboard for real-time campaign tracking.'],
    s2: '2. TERM', start: 'Start date:', end: 'End date:', tz: 'Timezone:', renew: 'This Agreement may be renewed by mutual written agreement of both parties prior to the end date.',
    s3: '3. COMMERCIAL TERMS', s4: '4. PAYMENT TERMS', cadence: 'Invoicing frequency:', due: 'Payment due:', dueVal: 'Within 7 (seven) days of invoice date', curL: 'Currency:', method: 'Payment method:',
    s5: '5. CLIENT RESPONSIBILITIES', resp: ['The origin, legality, and legitimacy of all leads provided.','Ensuring compliance with applicable data protection laws (e.g. GDPR).','The commercial content, products, and services promoted through campaigns.'],
  },
  NL: {
    head: 'DIENSTVERLENINGSOVEREENKOMST', intro: (d) => `Deze dienstverleningsovereenkomst ("Overeenkomst") wordt aangegaan op ${d}, tussen:`,
    provider: 'Dienstverlener:', client: 'Klant:', noClient: '[NAAM KLANT]', noSigner: '[NAAM ONDERTEKENAAR]',
    s1: '1. OMVANG VAN DE DIENSTEN', s1body: 'Lead Awaker levert de volgende diensten aan de Klant:',
    scope: ['Geautomatiseerde leadreactivering via WhatsApp, SMS en/of Instagram, aangedreven door AI.','Configuratie, monitoring en optimalisatie van outreach-campagnes.','Wekelijks afstemmingsgesprek om de prestaties te bespreken.','Toegang tot het Lead Awaker CRM-dashboard.'],
    s2: '2. LOOPTIJD', start: 'Startdatum:', end: 'Einddatum:', tz: 'Tijdzone:', renew: 'Deze Overeenkomst kan met wederzijdse schriftelijke instemming worden verlengd vóór de einddatum.',
    s3: '3. COMMERCIËLE VOORWAARDEN', s4: '4. BETALINGSVOORWAARDEN', cadence: 'Facturatiefrequentie:', due: 'Betaaltermijn:', dueVal: 'Binnen 7 (zeven) dagen na factuurdatum', curL: 'Valuta:', method: 'Betaalmethode:',
    s5: '5. VERANTWOORDELIJKHEDEN KLANT', resp: ['De herkomst, legaliteit en legitimiteit van alle aangeleverde leads.','Naleving van toepasselijke privacywetgeving (bijv. AVG).','De commerciële inhoud, producten en diensten in campagnes.'],
  },
  PT: {
    head: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS', intro: (d) => `Este Contrato de Prestação de Serviços ("Contrato") é celebrado em ${d}, entre:`,
    provider: 'Prestador de Serviços:', client: 'Cliente:', noClient: '[NOME DO CLIENTE]', noSigner: '[NOME DO SIGNATÁRIO]',
    s1: '1. ESCOPO DOS SERVIÇOS', s1body: 'A Lead Awaker concorda em prestar os seguintes serviços ao Cliente:',
    scope: ['Reativação automatizada de leads via WhatsApp, SMS e/ou Instagram, com Inteligência Artificial.','Configuração, monitoramento e otimização das campanhas.','Reunião semanal de acompanhamento de desempenho.','Acesso ao painel CRM da Lead Awaker em tempo real.'],
    s2: '2. PRAZO', start: 'Data de início:', end: 'Data de término:', tz: 'Fuso horário:', renew: 'Este Contrato poderá ser renovado por acordo escrito mútuo antes da data de término.',
    s3: '3. CONDIÇÕES COMERCIAIS', s4: '4. CONDIÇÕES DE PAGAMENTO', cadence: 'Frequência de faturamento:', due: 'Vencimento:', dueVal: 'Em até 7 (sete) dias da data da fatura', curL: 'Moeda:', method: 'Forma de pagamento:',
    s5: '5. RESPONSABILIDADES DO CLIENTE', resp: ['A origem, legalidade e legitimidade de todos os leads fornecidos.','Conformidade com leis de proteção de dados (ex.: LGPD/GDPR).','O conteúdo comercial, produtos e serviços promovidos.'],
  },
};
const CADENCE_LBL = { weekly: { EN: 'Weekly', NL: 'Wekelijks', PT: 'Semanal' }, biweekly: { EN: 'Bi-weekly', NL: 'Tweewekelijks', PT: 'Quinzenal' }, monthly: { EN: 'Monthly', NL: 'Maandelijks', PT: 'Mensal' } };
const DEAL_LINE = {
  'zero-risk':  { EN: 'Zero-risk / performance-based. Lead Awaker covers all campaign costs; the Client pays only on results.', NL: 'Zonder risico / op prestatiebasis. Lead Awaker draagt alle campagnekosten; de Klant betaalt alleen voor resultaten.', PT: 'Sem risco / baseado em desempenho. A Lead Awaker cobre todos os custos; o Cliente paga apenas por resultados.' },
  'passthrough':{ EN: 'Cost passthrough. The Client reimburses campaign costs incurred by Lead Awaker.', NL: 'Kostendoorbelasting. De Klant vergoedt de door Lead Awaker gemaakte campagnekosten.', PT: 'Repasse de custos. O Cliente reembolsa os custos de campanha da Lead Awaker.' },
  'upfront':    { EN: 'Fixed upfront fee, payable in advance of campaign launch.', NL: 'Vaste vergoeding vooraf, te betalen vóór de start van de campagne.', PT: 'Taxa fixa antecipada, paga antes do início da campanha.' },
  'deposit':    { EN: 'Refundable deposit collected at signing, returned per the agreed conditions.', NL: 'Restitueerbare aanbetaling bij ondertekening, terugbetaald volgens afspraak.', PT: 'Depósito reembolsável na assinatura, devolvido conforme condições.' },
  'retainer':   { EN: 'Fixed monthly retainer charged for the duration of the term.', NL: 'Vast maandelijks honorarium gedurende de looptijd.', PT: 'Retainer mensal fixo durante a vigência.' },
  'hybrid':     { EN: 'Hybrid structure combining a base fee with performance-based components.', NL: 'Hybride structuur: basisvergoeding plus prestatiecomponenten.', PT: 'Estrutura híbrida: taxa base mais componentes por desempenho.' },
};
const TRIGGER_LINE = { booked: { EN: 'Payment is triggered per qualified booking.', NL: 'Betaling wordt geactiveerd per gekwalificeerde boeking.', PT: 'O pagamento é acionado por agendamento qualificado.' }, closed: { EN: "Payment is triggered on a closed sale confirmed by the Client's team.", NL: 'Betaling wordt geactiveerd bij een gesloten verkoop bevestigd door het team van de Klant.', PT: 'O pagamento é acionado em venda fechada confirmada pela equipe do Cliente.' } };

function buildContractText(f) {
  const P = LA_BILLING.provider;
  const L = C_LANG[f.lang] || C_LANG.EN;
  const cur = f.currency === 'USD' ? '$' : f.currency === 'BRL' ? 'R$' : '€';
  const clientName = f.account ? LA_BILLING.clients[f.account].name : L.noClient;
  const dash = '─'.repeat(72);
  const lines = [];
  lines.push(L.head, '', L.intro(bDateFull(f.start)), '');
  lines.push(`  ${L.provider}`, `    ${P.name} (trading as "${P.trading}")`, `    ${P.addr}`, `    KvK: ${P.kvk} | Email: ${P.email}`, `    Phone: ${P.phone}`, '');
  lines.push(`  ${L.client}`, `    ${clientName}`, `    ${f.signer || L.noSigner}`, '');
  lines.push(dash, L.s1, dash, '', L.s1body, '', ...L.scope.map(s => `  - ${s}`), '');
  lines.push(dash, L.s2, dash, '', `  ${L.start}  ${bDateFull(f.start)}`, `  ${L.end}    ${bDateFull(f.end)}`, `  ${L.tz}   ${f.tz}`, '', L.renew, '');
  lines.push(dash, L.s3, dash, '');
  lines.push(`  ${DEAL_LINE[f.dealType][f.lang]}`);
  if (f.dealType !== 'zero-risk') {
    lines.push('', `  ${L.curL} ${f.value ? cur + (+f.value).toLocaleString('en-US', {minimumFractionDigits:2}) : '—'} ${f.dealType === 'retainer' ? '/ month' : f.dealType === 'upfront' || f.dealType === 'deposit' ? '' : '/ booking'}`);
  } else {
    lines.push('', `  ${L.curL} ${f.value ? cur + (+f.value).toLocaleString('en-US', {minimumFractionDigits:2}) + ' / booking' : '—'}`);
  }
  lines.push('', `  ${TRIGGER_LINE[f.trigger][f.lang]}`, '');
  const acct = f.payAccount === 'br-380'
    ? ['Banco 380 (PicPay) — BR', 'Agência 0001 · Conta 12345-6', `PIX: ${P.email}`]
    : ['N26 — EU', 'IBAN: DE35 1001 1001 2939 5454 81', `Account holder: ${P.name}`];
  lines.push(dash, L.s4, dash, '', `  ${L.cadence} ${CADENCE_LBL[f.cadence][f.lang]}`, `  ${L.due} ${L.dueVal}`, `  ${L.curL} ${f.currency}`, '', `  ${L.method}`, ...acct.map(a => `    ${a}`), `    ${P.addr}`, '');
  lines.push(dash, L.s5, dash, '', `${clientName} ${f.lang === 'NL' ? 'is verantwoordelijk voor:' : f.lang === 'PT' ? 'é responsável por:' : 'is solely responsible for:'}`, '', ...L.resp.map(s => `  - ${s}`), '');
  return lines.join('\n');
}

// ═══ Contract Builder ══════════════════════════════════════════════
function ContractBuilder({ onClose }) {
  const [f, setF] = React.useState({
    title: 'Service Agreement Q1 2026', account: '', signer: '', lang: 'EN', tz: 'Europe/Amsterdam',
    start: '2026-05-31', end: '2027-05-31', dealType: 'zero-risk', currency: 'EUR', value: '',
    trigger: 'booked', cadence: 'weekly', payAccount: 'eu-n26',
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const quick = (months) => { const d = new Date(f.start); d.setMonth(d.getMonth() + months); set('end', d.toISOString().slice(0, 10)); };
  const text = buildContractText(f);

  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--bg)' }}>
      {/* form column — own header + scroll + footer */}
      <div style={{ width: 'min(48%, 560px)', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', minWidth: 0 }}>
        <FormHead title="Contract Builder" subtitle="Fields auto-fill the contract on the right" onClose={onClose} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px 30px' }}>
          <FLabel>Title</FLabel><FInput value={f.title} onChange={v=>set('title',v)} />
          <div style={{ height: 16 }} />
          <FLabel>Account</FLabel><FSelect value={f.account} onChange={v=>set('account',v)} options={CLIENT_OPTS} placeholder="No account" />
          <div style={{ height: 16 }} />
          <FLabel hint="(person signing)">Signer name</FLabel><FInput value={f.signer} onChange={v=>set('signer',v)} placeholder="e.g. John Smith" />
          <div style={{ height: 16 }} />
          <FRow>
            <FCol w={150}><FLabel>Language</FLabel><FSeg size="sm" value={f.lang} onChange={v=>set('lang',v)} options={['EN','NL','PT']} /></FCol>
            <FCol><FLabel>Timezone</FLabel><FSelect value={f.tz} onChange={v=>set('tz',v)} options={TIMEZONES} /></FCol>
          </FRow>
          <div style={{ height: 16 }} />
          <FRow>
            <FCol><FLabel>Start date</FLabel><FInput type="date" value={f.start} onChange={v=>set('start',v)} /></FCol>
            <FCol><FLabel>End date</FLabel><FInput type="date" value={f.end} onChange={v=>set('end',v)} /></FCol>
          </FRow>
          <div style={{ marginTop: 10 }}><FSeg size="sm" value={null} onChange={(k)=>{ if(k==='Custom') return; quick({'1 mo':1,'3 mo':3,'6 mo':6,'1 yr':12}[k]); }} options={['1 mo','3 mo','6 mo','1 yr','Custom']} /></div>

          <div style={{ height: 24 }} />
          <FSection>Deal structure</FSection>
          <FLabel>Deal type</FLabel>
          <FCardChoice options={DEAL_TYPES} value={f.dealType} onChange={v=>set('dealType',v)} />
          <div style={{ height: 18 }} />
          <FLabel>{f.dealType === 'retainer' ? 'Monthly value' : f.dealType === 'upfront' || f.dealType === 'deposit' ? 'Amount' : 'Value per booking'}</FLabel>
          <FRow gap={10}>
            <FCol w={110}><FSelect value={f.currency} onChange={v=>set('currency',v)} options={[{value:'EUR',label:'EUR'},{value:'USD',label:'USD'},{value:'BRL',label:'BRL'}]} /></FCol>
            <FCol><FInput mono value={f.value} onChange={v=>set('value',v)} placeholder="0.00" /></FCol>
          </FRow>
          <div style={{ height: 16 }} />
          <FLabel>Payment trigger</FLabel>
          <FSeg value={f.trigger} onChange={v=>set('trigger',v)} options={[{value:'booked',label:'Booked'},{value:'closed',label:"Closed Sale (by client's team)"}]} />

          <div style={{ height: 24 }} />
          <FSection>Invoicing &amp; payment</FSection>
          <FLabel>Invoice cadence</FLabel>
          <FSeg value={f.cadence} onChange={v=>set('cadence',v)} options={[{value:'weekly',label:'Weekly'},{value:'biweekly',label:'Bi-weekly'},{value:'monthly',label:'Monthly'}]} />
          <div style={{ height: 16 }} />
          <FLabel>Payment account</FLabel>
          <FCardChoice options={PAY_ACCOUNTS} value={f.payAccount} onChange={v=>set('payAccount',v)} />
        </div>
        <FormFoot onCancel={onClose} onSubmit={onClose} submitLabel="Create contract" />
      </div>

      {/* live preview — big, tall, white panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--card)' }}>
        <div style={{ flexShrink: 0, padding: '18px 32px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 30, height: 30, borderRadius: 'var(--r-button)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BIContract size={16} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{f.title || 'Service Agreement'}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--mute-2)', marginTop: 1 }}>Live preview · {f.lang} · {text.length.toLocaleString('en-US')} chars</div>
          </div>
          <BToolBtn Ic={BIDownload} label="PDF" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '40px 56px', background: 'var(--card)' }}>
          <pre style={{ margin: 0, maxWidth: 760, fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.8, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</pre>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DEAL_TYPES, TIMEZONES, PAY_ACCOUNTS, buildContractText, ContractBuilder });
