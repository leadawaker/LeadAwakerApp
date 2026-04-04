/**
 * seed-demo-br.cjs
 * Creates a Brazilian solar company demo account with 3 campaigns,
 * 60 leads (Brazilian names), and Portuguese conversations — for the onboarding video.
 *
 * Run: node script/seed-demo-br.cjs
 */

const http = require('http');

const HOST = 'localhost';
const PORT = 5000;
const API_KEY = 'DQDQPVjYyNafvgVBGimW0Caq7Wk6GcTEBihx8Vhvx8w';

function req(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const headers = {
      'Content-Type': 'application/json',
      'x-internal-key': API_KEY,
    };
    const options = { hostname: HOST, port: PORT, path, method, headers };
    const r = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (d) => (chunks += d));
      res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

// ── Brazilian names pool ────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Carlos', 'Fernanda', 'Rafael', 'Juliana', 'Marcos', 'Camila', 'Lucas',
  'Beatriz', 'Pedro', 'Larissa', 'Gabriel', 'Natalia', 'Thiago', 'Priscila',
  'Rodrigo', 'Amanda', 'Felipe', 'Aline', 'Bruno', 'Tatiane', 'Diego',
  'Vanessa', 'Eduardo', 'Gabriela', 'Gustavo', 'Patricia', 'Leandro',
  'Renata', 'Vinícius', 'Mariana', 'Anderson', 'Luciana', 'Alexandre',
  'Claudia', 'Fabrício', 'Simone', 'Henrique', 'Bianca', 'Mateus', 'Débora',
  'Renato', 'Carina', 'Sandro', 'Franciele', 'Márcio', 'Karina', 'Evandro',
  'Roberta', 'Adriano', 'Eliane', 'Fábio', 'Letícia', 'Paulo', 'Carla',
  'João', 'Ana', 'Sérgio', 'Vera', 'Antônio', 'Sandra',
];

const LAST_NAMES = [
  'Silva', 'Oliveira', 'Santos', 'Souza', 'Ferreira', 'Pereira', 'Costa',
  'Rodrigues', 'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Carvalho',
  'Martins', 'Gomes', 'Ribeiro', 'Jesus', 'Barbosa', 'Cardoso', 'Dias',
  'Teixeira', 'Nunes', 'Moreira', 'Campos', 'Correia', 'Ramos', 'Mendes',
  'Monteiro', 'Freitas', 'Macedo', 'Rocha', 'Cavalcante', 'Andrade',
  'Moraes', 'Pinto', 'Cruz', 'Castro', 'Borges', 'Lopes', 'Barros',
];

const SOURCES = ['Google Ads', 'Facebook Ads', 'Indicação', 'Instagram Ads'];

// ── Message templates ──────────────────────────────────────────────────────

const MSG = {
  out1: (name) =>
    `Oi ${name}! 😊 Aqui é a Ana, da Energia Solar Catarinense. Vi que você demonstrou interesse em energia solar — tudo bem por aí? Ainda faz sentido conversarmos sobre como reduzir sua conta de luz?`,
  in1: [
    'Oi! Sim, ainda tenho interesse. Qual seria o investimento médio?',
    'Olá! Me fala mais sobre como funciona o sistema.',
    'Boa tarde! Pode sim, ainda estou avaliando.',
    'Sim! Ainda tenho interesse. Qual o prazo de instalação?',
  ],
  out2: (name) =>
    `Que ótimo, ${name}! O investimento varia entre R$15.000 e R$28.000 dependendo do consumo. A maioria dos clientes recupera em 3 a 4 anos e economiza até 95% na conta de luz. Posso te fazer uma simulação gratuita?`,
  in2: [
    'Claro! Meu consumo médio é de R$480 por mês.',
    'Pode sim! Minha conta fica em torno de R$550 mensais.',
    'Sim! Aqui em casa a conta chega a R$620 por mês.',
    'Pode fazer! Aqui é uma empresa, o consumo é bem alto.',
  ],
  out3: (name) =>
    `Perfeito, ${name}! Com esse consumo, um sistema de 4 a 5 kWp já resolveria. Investimento em torno de R$18.000 a R$22.000, com economia anual de uns R$5.500. Quer agendar uma visita técnica gratuita?`,
  in3: [
    'Quero sim! Pode ser quinta-feira de manhã?',
    'Com certeza! Pode vir na sexta-feira à tarde?',
    'Ótimo! Agenda para a semana que vem, pode ser?',
  ],
  inLost: [
    'Não, obrigado. Já contratei com outra empresa.',
    'Obrigado, mas não tenho interesse no momento.',
    'Pode tirar meu contato, não quero mais receber mensagens.',
  ],
};

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_DIST = [
  { status: 'New', count: 3, out: 1, in: 0 },
  { status: 'Contacted', count: 4, out: 1, in: 0 },
  { status: 'Responded', count: 4, out: 1, in: 1 },
  { status: 'Multiple Responses', count: 4, out: 2, in: 2 },
  { status: 'Qualified', count: 3, out: 3, in: 2 },
  { status: 'Booked', count: 1, out: 3, in: 3 },
  { status: 'Lost', count: 1, out: 2, in: 1 },
];

const PRIORITY_MAP = {
  'Booked': 'High',
  'Qualified': 'High',
  'Multiple Responses': 'High',
  'Responded': 'Medium',
  'Contacted': 'Medium',
  'New': 'Low',
  'Lost': 'Low',
};

const SENTIMENT_MAP = {
  'Booked': 'positive',
  'Qualified': 'positive',
  'Multiple Responses': 'positive',
  'Responded': 'neutral',
  'Contacted': 'neutral',
  'New': 'neutral',
  'Lost': 'negative',
};

const NOTES_MAP = {
  'New': 'Lead adicionado à campanha. Primeira mensagem ainda não enviada.',
  'Contacted': 'Primeira mensagem enviada. Aguardando retorno.',
  'Responded': 'Lead respondeu com interesse. Aguardando próxima etapa.',
  'Multiple Responses': 'Conversa ativa. Lead demonstra forte intenção de compra.',
  'Qualified': 'Lead qualificado: consumo confirmado, budget adequado. Próximo passo: visita técnica.',
  'Booked': 'Visita técnica agendada. Lead muito engajado. Alta probabilidade de fechar.',
  'Lost': 'Lead informou que não tem interesse. Marcado como perdido.',
};

// ── Campaign data ──────────────────────────────────────────────────────────

const CAMPAIGNS = [
  {
    name: 'Reativação de Clientes Inativos',
    description: 'Leads que demonstraram interesse em energia solar mas não converteram. Reativação via WhatsApp com IA.',
    status: 'Active',
    firstMessage: 'Oi [Nome]! 😊 Aqui é a Ana da Energia Solar Catarinense. Há um tempo você demonstrou interesse em energia solar — tudo bem por aí? Ainda faz sentido conversarmos sobre economia na conta de luz?',
    aiPromptTemplate: 'Você é Ana, consultora de energia solar da Energia Solar Catarinense. Reative leads inativos com empatia e ofereça uma simulação gratuita.',
    totalLeadsTargeted: 420,
    totalMessagesSent: 387,
    totalResponsesReceived: 89,
    responseRatePercent: 23.0,
  },
  {
    name: 'Leads Frios — Google Ads',
    description: 'Contatos vindos de campanhas Google que preencheram formulário mas não responderam ao contato inicial.',
    status: 'Active',
    firstMessage: 'Olá [Nome]! Você preencheu nosso formulário sobre energia solar. Sou a Ana, da Energia Solar Catarinense. Posso te enviar uma simulação gratuita de economia?',
    aiPromptTemplate: 'Você é Ana, consultora de vendas de energia solar. O lead preencheu um formulário online. Seja direto e ofereça valor imediato com uma simulação gratuita.',
    totalLeadsTargeted: 310,
    totalMessagesSent: 298,
    totalResponsesReceived: 54,
    responseRatePercent: 18.1,
  },
  {
    name: 'Indicações e Pós-Venda',
    description: 'Clientes satisfeitos e leads indicados por eles. Abordagem mais quente e personalizada.',
    status: 'Active',
    firstMessage: 'Oi [Nome]! Tudo bem? Aqui é a Ana da Energia Solar Catarinense. Seu contato foi indicado por um de nossos clientes. Você tem interesse em saber como economizar na conta de luz?',
    aiPromptTemplate: 'Você é Ana, consultora de energia solar. Esse lead foi indicado por um cliente satisfeito. Seja calorosa, mencione a indicação e ofereça uma simulação.',
    totalLeadsTargeted: 180,
    totalMessagesSent: 176,
    totalResponsesReceived: 71,
    responseRatePercent: 40.3,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function pick(arr, i) {
  return arr[i % arr.length];
}

function msgsForLead(lead, accountId, leadId, campaignId, baseTime) {
  const name = lead.firstName;
  const interactions = [];
  const { out: outCount, in: inCount } = STATUS_DIST.find((s) => s.status === lead.conversionStatus);

  if (lead.conversionStatus === 'Lost') {
    interactions.push({ direction: 'outbound', content: MSG.out1(name) });
    interactions.push({ direction: 'inbound', content: pick(MSG.inLost, leadId) });
    interactions.push({ direction: 'outbound', content: `Entendemos, ${name}. Caso mude de ideia estamos à disposição! Tenha um ótimo dia. 😊` });
    return interactions;
  }

  if (outCount >= 1) interactions.push({ direction: 'outbound', content: MSG.out1(name) });
  if (inCount >= 1) interactions.push({ direction: 'inbound', content: pick(MSG.in1, leadId) });
  if (outCount >= 2) interactions.push({ direction: 'outbound', content: MSG.out2(name) });
  if (inCount >= 2) interactions.push({ direction: 'inbound', content: pick(MSG.in2, leadId) });
  if (outCount >= 3) interactions.push({ direction: 'outbound', content: MSG.out3(name) });
  if (inCount >= 3) interactions.push({ direction: 'inbound', content: pick(MSG.in3, leadId) });

  return interactions.map((msg) => ({
    accountsId: accountId,
    leadsId: leadId,
    campaignsId: campaignId,
    type: 'whatsapp',
    aiGenerated: msg.direction === 'outbound',
    status: 'delivered',
    ...msg,
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 LeadAwaker — Brazilian Demo Seed Script');
  console.log('==========================================\n');

  // 1. Create account
  console.log('1. Creating account: Energia Solar Catarinense...');
  const accountRes = await req('POST', '/api/accounts', {
    name: 'Energia Solar Catarinense',
    status: 'Active',
    ownerEmail: 'contato@energiasolarcatarinense.com.br',
    website: 'https://energiasolarcatarinense.com.br',
    businessNiche: 'Energia Solar',
    businessDescription: 'Empresa especializada em instalação de sistemas fotovoltaicos para residências e empresas em Santa Catarina.',
    timezone: 'America/Sao_Paulo',
  });

  if (accountRes.status !== 200 && accountRes.status !== 201) {
    console.error('Failed to create account:', accountRes.status, accountRes.body);
    process.exit(1);
  }
  const account = JSON.parse(accountRes.body);
  const accountId = account.id;
  console.log(`   ✓ Account created: #${accountId} "${account.name}"\n`);

  // 2. Create 3 campaigns
  console.log('2. Creating campaigns...');
  const campaignIds = [];
  for (const c of CAMPAIGNS) {
    const res = await req('POST', '/api/campaigns', {
      accountsId: accountId,
      name: c.name,
      description: c.description,
      status: c.status,
      channel: 'whatsapp',
      agentName: 'Ana',
      firstMessage: c.firstMessage,
      aiPromptTemplate: c.aiPromptTemplate,
      totalLeadsTargeted: c.totalLeadsTargeted,
      totalMessagesSent: c.totalMessagesSent,
      totalResponsesReceived: c.totalResponsesReceived,
      responseRatePercent: String(c.responseRatePercent),
    });
    if (res.status !== 200 && res.status !== 201) {
      console.error(`  ✗ Failed to create campaign "${c.name}":`, res.status, res.body);
      process.exit(1);
    }
    const created = JSON.parse(res.body);
    campaignIds.push(created.id);
    console.log(`   ✓ Campaign #${created.id}: "${c.name}"`);
  }
  console.log();

  // 3. Build lead list (20 per campaign)
  console.log('3. Creating 60 leads (20 per campaign)...');
  let nameIndex = 0;
  let phoneIndex = 1000;
  let totalLeads = 0;
  const allLeads = []; // { campaignId, lead data, interactions }

  for (let ci = 0; ci < campaignIds.length; ci++) {
    const campaignId = campaignIds[ci];
    const leadsForCampaign = [];

    for (const { status, count } of STATUS_DIST) {
      for (let i = 0; i < count; i++) {
        leadsForCampaign.push({
          firstName: pick(FIRST_NAMES, nameIndex),
          lastName: pick(LAST_NAMES, nameIndex + 7),
          phone: `+5599947${String(phoneIndex).padStart(5, '0')}`,
          email: null,
          accountsId: accountId,
          campaignsId: campaignId,
          conversionStatus: status,
          source: pick(SOURCES, nameIndex),
          priority: PRIORITY_MAP[status],
          language: 'pt',
          notes: NOTES_MAP[status],
          aiSentiment: SENTIMENT_MAP[status],
        });
        nameIndex++;
        phoneIndex++;
      }
    }

    for (const leadData of leadsForCampaign) {
      const res = await req('POST', '/api/leads', leadData);
      if (res.status !== 200 && res.status !== 201) {
        console.error(`  ✗ Failed to create lead ${leadData.firstName} ${leadData.lastName}:`, res.status, res.body);
        continue;
      }
      const created = JSON.parse(res.body);
      totalLeads++;
      process.stdout.write('.');
      allLeads.push({ leadId: created.id, campaignId, conversionStatus: leadData.conversionStatus, firstName: leadData.firstName });
    }
  }
  console.log(`\n   ✓ ${totalLeads} leads created\n`);

  // 4. Create interactions
  console.log('4. Creating interactions (Portuguese conversations)...');
  const baseTime = new Date();
  let totalInteractions = 0;

  for (const lead of allLeads) {
    const msgs = msgsForLead(
      { firstName: lead.firstName, conversionStatus: lead.conversionStatus },
      accountId,
      lead.leadId,
      lead.campaignId,
      baseTime,
    );
    for (const msg of msgs) {
      const res = await req('POST', '/api/interactions', msg);
      if (res.status === 200 || res.status === 201) {
        totalInteractions++;
      } else if (totalInteractions === 0 && totalInteractions < 3) {
        process.stdout.write(`[${res.status}:${res.body.slice(0,80)}]`);
      }
    }
    process.stdout.write('.');
  }

  console.log(`\n   ✓ ${totalInteractions} interactions created\n`);

  // 5. Summary
  console.log('==========================================');
  console.log('✅ Demo seed complete!\n');
  console.log(`   Account ID : ${accountId}`);
  console.log(`   Campaigns  : ${campaignIds.join(', ')}`);
  console.log(`   Leads      : ${totalLeads}`);
  console.log(`   Messages   : ${totalInteractions}`);
  console.log('\n👉 Log in as Admin and switch workspace to "Energia Solar Catarinense"');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
