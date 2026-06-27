// Shared mock data for both layouts
window.LA_DATA = {
  campaigns: [
    { id: 36, name: 'Refer-a-Friend Q2', mono: 'RF', client: 'Energia Solar Catarinense', status: 'paused', section: 'active' },
    { id: 27, name: 'C1 - Reativação de Leads', mono: 'C1', client: 'Coprel Telecom', status: 'paused', section: 'active' },
    { id: 38, name: 'Indicações e Pós-Venda', mono: 'IP', client: 'Energia Solar Catarinense', status: 'paused', section: 'active' },
    { id: 37, name: 'Leads Frios — Google Ads', mono: 'LF', client: 'Energia Solar Catarinense', status: 'paused', section: 'active', active: true },
    { id: 41, name: 'Verwijzingen & Nazorg', mono: 'V&', client: 'ZonPower B.V.', status: 'paused', section: 'active' },
    { id: 40, name: 'Koude Leads — Google Ads', mono: 'KL', client: 'ZonPower B.V.', status: 'paused', section: 'active' },
    { id: 39, name: 'Heractivering Inactieve Leads', mono: 'HI', client: 'ZonPower B.V.', status: 'paused', section: 'active' },
    { id: 42, name: 'Intake - Wachtlijst', mono: 'IW', client: 'The Performance Method', status: 'inactive', section: 'inactive' },
    { id: 24, name: 'Floating to Circle', mono: 'FC', client: 'Amazon Coaching', status: 'inactive', section: 'inactive' },
  ],

  active: {
    name: 'Leads Frios — Google Ads',
    mono: 'LF',
    id: 2,
    status: 'paused',
    channel: 'WhatsApp',
    dailyLimit: '0 / 100',
    activeHours: '09:00 – 19:00',
    owner: 'Energia Solar Catarinense',
    ownerInit: 'ES',
  },

  pipeline: {
    total: 20,
    stages: [
      { key: 'new', label: 'New', count: 3, pct: 15, color: 'var(--stage-new)' },
      { key: 'contacted', label: 'Contacted', count: 4, pct: 20, color: 'var(--stage-contacted)' },
      { key: 'responded', label: 'Responded', count: 4, pct: 20, color: 'var(--stage-responded)' },
      { key: 'multi', label: 'Multiple Responses', count: 1, pct: 5, color: 'var(--stage-multi)' },
      { key: 'qualified', label: 'Qualified', count: 0, pct: 0, color: 'var(--stage-qualified)' },
      { key: 'booked', label: 'Booked', count: 7, pct: 35, color: 'var(--stage-booked)', star: true },
      { key: 'lost', label: 'Lost', count: 1, pct: 5, color: 'var(--stage-lost)' },
      { key: 'dnd', label: 'DND', count: 0, pct: 0, color: 'var(--stage-dnd)' },
    ],
  },

  metrics: {
    leadsTargeted: 310,
    messagesSent: 298,
    responsePct: 18,
    bookingPct: 0,
  },

  // Aggregate follow-up / bump cadence
  followUp: {
    queuedToday: 47,
    queuedWeek: 312,
    avgBumpDelay: '1d 14h',
    nextSendWindow: '09:00',
    cadence: [
      { label: 'Initial', day: 0, count: 12 },
      { label: 'Bump 1', day: 1, count: 18 },
      { label: 'Bump 2', day: 3, count: 9 },
      { label: 'Bump 3', day: 7, count: 5 },
      { label: 'Last attempt', day: 14, count: 3 },
    ],
  },

  // Activity — upcoming individual messages
  activity: [
    { time: '09:02', name: 'Marcia Souza', stage: 'Bump 2', preview: 'Olá Marcia, ainda interessada em uma proposta para…', channel: 'WhatsApp' },
    { time: '09:14', name: 'Renan Pereira', stage: 'Bump 1', preview: 'Renan, vi que você não respondeu, posso te ligar mais…', channel: 'WhatsApp' },
    { time: '09:30', name: 'Luísa Mendes', stage: 'Initial', preview: 'Oi Luísa! Você baixou o material sobre…', channel: 'WhatsApp' },
    { time: '10:05', name: 'João Henrique', stage: 'Bump 3', preview: 'Última tentativa — fica para depois?', channel: 'WhatsApp' },
    { time: '10:42', name: 'Patrícia Lemos', stage: 'Bump 1', preview: 'Patrícia, segue uma simulação rápida…', channel: 'WhatsApp' },
    { time: '11:18', name: 'Carlos Eduardo', stage: 'Bump 2', preview: 'E aí Carlos, fechou em outro lugar ou…', channel: 'WhatsApp' },
  ],

  // Up Next — booked calls / AI handoffs
  upNext: [
    { time: '10:30', date: 'Today', name: 'Felipe Carvalho', channel: 'Call', stage: 'Booked' },
    { time: '14:15', date: 'Today', name: 'Aline Rocha', channel: 'Call', stage: 'Booked' },
    { time: '16:00', date: 'Today', name: 'Bruno Tavares', channel: 'AI Handoff', stage: 'Qualified' },
    { time: '09:45', date: 'Tomorrow', name: 'Daniela Prado', channel: 'Call', stage: 'Booked' },
    { time: '11:00', date: 'Tomorrow', name: 'Otávio Lima', channel: 'Call', stage: 'Booked' },
    { time: '15:30', date: 'Thu 23', name: 'Camila Borba', channel: 'AI Handoff', stage: 'Responded' },
    { time: '10:15', date: 'Fri 24', name: 'Rodrigo Sant\u2019Ana', channel: 'Call', stage: 'Booked' },
  ],

  // ── "Now & Next" monitoring state ──────────────────────────────
  nowLabel: '09:00',
  nextSend: { inMin: 12, count: 8, breakdown: 'Bump 1 ×5 · Bump 2 ×3' },

  // Just-happened events (most recent first) — what the AI did / what came back
  recent: [
    { ago: '2 min ago',  name: 'Aline Rocha',     action: 'replied',        tone: 'warm', stage: 'Responded', preview: '“Pode ser amanhã de manhã?”' },
    { ago: '11 min ago', name: 'Felipe Carvalho', action: 'booked a call',  tone: 'good', stage: 'Booked',    preview: 'Call confirmed · 10:30 today' },
    { ago: '24 min ago', name: 'Marcia Souza',    action: 'AI sent Bump 2', tone: 'sent', stage: 'Contacted', preview: 'Olá Marcia, ainda interessada em uma proposta…' },
    { ago: '38 min ago', name: 'Renan Pereira',   action: 'AI sent Bump 1', tone: 'sent', stage: 'Contacted', preview: 'Renan, vi que você não respondeu, posso te ligar…' },
  ],

  // Lead Heat — the "hidden money" view across this campaign's database
  heat: {
    total: 20,
    bands: [
      { key: 'hot',       label: 'Hot',       count: 4, desc: 'engaged · ready to book', color: 'var(--wine)' },
      { key: 'warm',      label: 'Warm',      count: 6, desc: 'replying · nurturing',    color: 'var(--warn)' },
      { key: 'revivable', label: 'Revivable', count: 8, desc: 'dormant · worth a bump',  color: 'var(--stage-responded)' },
      { key: 'cold',      label: 'Cold',      count: 2, desc: 'no signal yet',           color: 'var(--mute-2)' },
    ],
  },

  aiTLDR: '7 booked this week (+40% WoW). Bump 2 is your strongest converter — schedule more leads into it. 4 leads stuck in Contacted >72h.',
  aiAnalysis: [
    { title: 'Booking momentum', body: '7 bookings this week vs. 5 last week. The 35% booked rate is well above your 22% portfolio average.' },
    { title: 'Bump cadence', body: 'Bump 2 (day 3) is converting 31% — the highest of any stage. Consider tightening Bump 3 from day 7 to day 5.' },
    { title: 'At-risk', body: '4 leads in Contacted >72h with no reply. AI suggests soft-disqualifying or a final outreach.' },
  ],
};
