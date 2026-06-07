/* billing-data.js — seed data for the Billing page (Invoices · Expenses · Contracts)
   EUR primary; expenses reflect the real NL-tax (BTW) model with mixed €/$ currency.
   Clients are the agency's accounts; expenses are Lead Awaker's own running costs (admin-only). */

window.LA_BILLING = (function () {
  // ── Status / category maps ────────────────────────────────────────
  const INVOICE_STATUS = {
    paid:    { label: 'Paid',     color: 'var(--good)',       tint: 'var(--good-tint)' },
    sent:    { label: 'Sent',     color: 'var(--stage-contacted)', tint: 'rgba(84,123,176,0.13)' },
    overdue: { label: 'Overdue',  color: 'var(--stage-lost)', tint: 'rgba(162,75,63,0.13)' },
    draft:   { label: 'Draft',    color: 'var(--mute-2)',     tint: 'rgba(148,138,119,0.14)' },
  };
  const CONTRACT_STATUS = {
    active: { label: 'Active', color: 'var(--good)',       tint: 'var(--good-tint)' },
    signed: { label: 'Signed', color: 'var(--stage-closed)', tint: 'rgba(110,122,94,0.14)' },
    sent:   { label: 'Awaiting signature', short: 'Sent', color: 'var(--warn)', tint: 'var(--warn-tint)' },
    draft:  { label: 'Draft',  color: 'var(--mute-2)', tint: 'rgba(148,138,119,0.14)' },
  };

  // ── Clients (the agency's accounts) ───────────────────────────────
  const clients = {
    zonpower:   { name: 'ZonPower B.V.',               ini: 'ZP', color: '#C48A2F' },
    energia:    { name: 'Energia Solar Catarinense',   ini: 'ES', color: '#5E8E5E' },
    gourmet:    { name: 'Gourmet Kitchen Designs',     ini: 'GK', color: '#7A2E3E' },
    levenswijs: { name: 'Levenswijs Coaching',         ini: 'LC', color: '#547BB0' },
    verwijz:    { name: 'Verwijzingen & Nazorg',       ini: 'VN', color: '#3F8E8E' },
    koude:      { name: 'Koude Leads — Google Ads',    ini: 'KL', color: '#6C5A8C' },
  };

  // ── Invoices ──────────────────────────────────────────────────────
  const invoices = [
    { id: 'INV-0041', client: 'zonpower',   issued: '2026-05-02', due: '2026-05-16', sentAt: 'May 2, 2026, 9:12 AM', views: 3, amount: 2450, status: 'overdue',
      items: [['Lead Awaker — Pro plan (May)', 1, 1450], ['WhatsApp outreach — 8k conversations', 1, 640], ['Setup & onboarding', 1, 360]] },
    { id: 'INV-0042', client: 'energia',    issued: '2026-05-05', due: '2026-05-19', sentAt: 'May 5, 2026, 2:40 PM', views: 1, amount: 1890, status: 'overdue',
      items: [['Lead Awaker — Pro plan (May)', 1, 1450], ['Extra AI seats ×2', 2, 220]] },
    { id: 'INV-0043', client: 'gourmet',    issued: '2026-05-10', due: '2026-06-07', sentAt: 'May 10, 2026, 11:03 AM', views: 5, amount: 3200, status: 'sent',
      items: [['Lead Awaker — Scale plan (May)', 1, 2400], ['Custom prompt engineering', 1, 800]] },
    { id: 'INV-0044', client: 'levenswijs', issued: '2026-05-12', due: '2026-06-09', sentAt: 'May 12, 2026, 4:21 PM', views: 0, amount: 1450, status: 'sent',
      items: [['Lead Awaker — Pro plan (May)', 1, 1450]] },
    { id: 'INV-0045', client: 'verwijz',    issued: '2026-05-14', due: '2026-06-11', sentAt: 'May 14, 2026, 9:55 AM', views: 2, amount: 980,  status: 'sent',
      items: [['Lead Awaker — Starter plan (May)', 1, 780], ['SMS top-up', 1, 200]] },
    { id: 'INV-0046', client: 'koude',      issued: '2026-05-18', due: '2026-06-01', sentAt: null, views: 0, amount: 2750, status: 'draft',
      items: [['Lead Awaker — Scale plan (May)', 1, 2400], ['Reactivation campaign build', 1, 350]] },
    { id: 'INV-0038', client: 'gourmet',    issued: '2026-04-10', due: '2026-04-24', sentAt: 'Apr 10, 2026, 10:18 AM', views: 7, amount: 3200, status: 'paid',
      items: [['Lead Awaker — Scale plan (Apr)', 1, 2400], ['Custom prompt engineering', 1, 800]] },
    { id: 'INV-0037', client: 'zonpower',   issued: '2026-04-02', due: '2026-04-16', sentAt: 'Apr 2, 2026, 8:30 AM', views: 4, amount: 2450, status: 'paid',
      items: [['Lead Awaker — Pro plan (Apr)', 1, 1450], ['WhatsApp outreach — 9k conversations', 1, 700], ['Setup & onboarding', 1, 300]] },
    { id: 'INV-0036', client: 'levenswijs', issued: '2026-04-12', due: '2026-04-26', sentAt: 'Apr 12, 2026, 1:02 PM', views: 6, amount: 1450, status: 'paid',
      items: [['Lead Awaker — Pro plan (Apr)', 1, 1450]] },
  ];

  // ── Expenses (Lead Awaker's own running costs — ADMIN ONLY) ───────
  // Real NL-tax model: excl VAT, VAT %, total, NL BTW reclaimable, deductible flag, currency.
  const expenses = [
    { id: 'EXP-013', supplier: 'HubSpot',              desc: 'Sales Hub Professional (1 Sales Seat)',       date: '2026-05-08', y: 2026, q: 2, inv: '760469262',               cur: 'EUR', excl: 10.00, vat: 21, total: 12.10, btw: 2.10,  ded: true,  notes: 'US company — no EU VAT charged' },
    { id: 'EXP-012', supplier: 'OpenAI OpCo, LLC',     desc: 'OpenAI API usage credit',                     date: '2026-03-23', y: 2026, q: 1, inv: 'CRXJFWFP-0004',            cur: 'USD', excl: 5.00,  vat: 0,  total: 5.00,  btw: 0,     ded: false, notes: 'US company — no EU VAT charged' },
    { id: 'EXP-011', supplier: 'Anthropic, PBC',       desc: 'Max plan — 5x',                               date: '2026-03-23', y: 2026, q: 1, inv: 'K760GGPT-0011',            cur: 'EUR', excl: 90.00, vat: 21, total: 108.90, btw: 18.90, ded: true,  notes: 'Anthropic charges NL VAT' },
    { id: 'EXP-010', supplier: 'zai',                  desc: 'Subscription (GLM Coding Lite)',              date: '2026-02-22', y: 2026, q: 1, inv: 'INV-2690979-2026020001',  cur: 'USD', excl: 9.00,  vat: 0,  total: 9.00,  btw: 0,     ded: false, notes: 'US company — no EU VAT charged' },
    { id: 'EXP-009', supplier: 'Anthropic',            desc: 'Claude Max plan 20x Feb–Mar 2026 (upgrade from Pro)', date: '2026-02-22', y: 2026, q: 1, inv: 'K760GGPT-0007', cur: 'EUR', excl: 99.81, vat: 21, total: 120.77, btw: 20.96, ded: true,  notes: 'Anthropic charges NL VAT' },
    { id: 'EXP-008', supplier: 'Anthropic',            desc: 'Claude Max plan 5x Feb–Mar 2026 (incl. Pro credit)',  date: '2026-02-19', y: 2026, q: 1, inv: 'K760GGPT-0005', cur: 'EUR', excl: 74.09, vat: 21, total: 89.65, btw: 15.56, ded: true,  notes: 'Anthropic charges NL VAT' },
    { id: 'EXP-007', supplier: 'Skool.com / Agentic Labs', desc: 'Agentic Labs monthly membership',         date: '2026-02-18', y: 2026, q: 1, inv: '9VGNSDY8-0001',            cur: 'USD', excl: 7.00,  vat: 0,  total: 7.00,  btw: 0,     ded: false, notes: 'US company — no EU VAT charged' },
    { id: 'EXP-006', supplier: 'Anthropic',            desc: 'Claude Pro subscription Feb–Mar 2026',        date: '2026-02-16', y: 2026, q: 1, inv: 'K760GGPT-0001',            cur: 'EUR', excl: 18.00, vat: 0,  total: 18.00, btw: 0,     ded: false, notes: 'US company — no NL VAT on this charge' },
    { id: 'EXP-005', supplier: 'Amazon EU',            desc: 'Geekworm X1001 PCIe to M.2 NVMe SSD Shield',  date: '2025-12-22', y: 2025, q: 4, inv: 'DS-AEU-INV-NL-2025-17278754', cur: 'EUR', excl: 12.89, vat: 21, total: 15.60, btw: 2.71,  ded: true,  notes: 'Pre-start expense — claim input VAT' },
    { id: 'EXP-004', supplier: 'Amazon EU',            desc: 'GeeekPi Raspberry Pi 5 case with active cooler', date: '2025-12-22', y: 2025, q: 4, inv: 'DS-AEU-INV-NL-2025-17278734', cur: 'EUR', excl: 16.15, vat: 21, total: 19.54, btw: 3.39,  ded: true,  notes: 'Pre-start expense — claim input VAT' },
    { id: 'EXP-003', supplier: 'Elektronica Voor Jou', desc: 'Raspberry Pi 5 8GB RAM + 27W USB-C power supply', date: '2025-12-17', y: 2025, q: 4, inv: 'INV-2025-0073240',     cur: 'EUR', excl: 93.22, vat: 21, total: 112.80, btw: 19.58, ded: true,  notes: 'Pre-start expense — claim input VAT' },
    { id: 'EXP-002', supplier: 'Namecheap',            desc: 'Domain registration leadawaker.com (1 year)', date: '2025-12-17', y: 2025, q: 4, inv: '189804861',               cur: 'USD', excl: 6.49,  vat: 0,  total: 6.69,  btw: 0,     ded: false, notes: 'US company — no EU VAT charged' },
    { id: 'EXP-001', supplier: 'Megekko',              desc: 'PNY CS1030 250GB M.2 SSD + shipping',         date: '2025-12-17', y: 2025, q: 4, inv: 'M003075234',              cur: 'EUR', excl: 29.63, vat: 21, total: 35.85, btw: 6.22,  ded: true,  notes: 'Pre-start expense — claim input VAT' },
  ];

  // ── Contracts ─────────────────────────────────────────────────────
  // status: active (signed & in effect) | signed | sent | draft
  const contracts = [
    { id: 'CTR-021', title: 'Lead Awaker — Scale plan',       client: 'gourmet',    value: 38400, term: '12 months', status: 'active', signatory: 'M. de Vries', created: '2026-04-08', start: '2026-04-09', end: '2027-04-09', signed: '2026-04-09', sent: '2026-04-08', views: 4,
      scope: 'Automated lead reactivation via WhatsApp, SMS and Instagram, powered by AI. Configuration, monitoring and optimization of outreach campaigns. Weekly check-in call. Access to the Lead Awaker CRM dashboard.', campaign: 'Premium Kitchen — Reactivation' },
    { id: 'CTR-020', title: 'Lead Awaker — Pro plan',         client: 'zonpower',   value: 29400, term: '12 months', status: 'active', signatory: 'J. Bakker',   created: '2026-03-30', start: '2026-04-01', end: '2027-04-01', signed: '2026-04-01', sent: '2026-03-30', views: 2,
      scope: 'Automated lead reactivation via WhatsApp and SMS. Campaign configuration and optimization. Weekly performance review call. CRM dashboard access.', campaign: 'Heractivering Inactieve Leads' },
    { id: 'CTR-019', title: 'Lead Awaker — Pro plan',         client: 'energia',    value: 22680, term: '6 months',  status: 'signed', signatory: 'C. Souza',    created: '2026-02-14', start: '2026-02-16', end: '2026-08-16', signed: '2026-02-16', sent: '2026-02-14', views: 3,
      scope: 'Reativação automatizada de leads via WhatsApp e Instagram. Configuração e otimização de campanhas. Chamada semanal de acompanhamento. Acesso ao painel CRM.', campaign: 'Reativação de Clientes Inativos' },
    { id: 'CTR-022', title: 'Reactivation campaign — Q3',     client: 'koude',      value: 9600,  term: '3 months',  status: 'sent',   signatory: '—',           created: '2026-05-18', start: '2026-06-01', end: '2026-09-01', signed: null,        sent: '2026-05-18', views: 1,
      scope: 'Three-month reactivation sprint across Google Ads cold leads. WhatsApp + SMS outreach with AI qualification and booking.', campaign: 'Koude Leads — Google Ads' },
    { id: 'CTR-023', title: 'Lead Awaker — Pro plan renewal', client: 'levenswijs', value: 17400, term: '12 months', status: 'sent',   signatory: '—',           created: '2026-05-20', start: '2026-06-01', end: '2027-06-01', signed: null,        sent: '2026-05-20', views: 0,
      scope: 'Renewal of the Pro plan for a further 12 months. Continued AI outreach, optimization and weekly reviews. CRM dashboard access.', campaign: 'Levenswijs Coaching' },
    { id: 'CTR-024', title: 'Lead Awaker — Starter plan',     client: 'verwijz',    value: 9360,  term: '12 months', status: 'draft',  signatory: '—',           created: '2026-05-26', start: '2026-06-01', end: '2027-06-01', signed: null,        sent: null,          views: 0,
      scope: 'Starter plan: single-channel WhatsApp reactivation with AI qualification. Monthly performance summary. CRM dashboard access.', campaign: 'Verwijzingen & Nazorg' },
  ];

  // ── Notifications (for the bell panel) ────────────────────────────
  const notifications = [
    { id: 'n1', type: 'booking', title: 'Upcoming call: Gabriel',          body: 'Starts in 52 min (3:30 PM)',          time: '4 days ago', group: 'week',  unread: true },
    { id: 'n2', type: 'booking', title: 'Upcoming call: Miguel da Silva',  body: 'Starts in 52 min (10:30 AM)',         time: '4 days ago', group: 'week',  unread: true },
    { id: 'n3', type: 'billing', title: 'Invoice INV-0038 paid',           body: 'Gourmet Kitchen Designs · €3,200.00', time: '5 days ago', group: 'week',  unread: true },
    { id: 'n4', type: 'task',    title: 'Task due today',                   body: 'Send May statements to ZonPower B.V.', time: '6 days ago', group: 'week',  unread: false },
    { id: 'n5', type: 'booking', title: 'Upcoming call: Gabriel Barbosa',  body: 'Starts in 58 min (4:30 PM)',          time: '5/18/2026',  group: 'older', unread: true },
    { id: 'n6', type: 'system',  title: 'Message delivery failed',         body: 'Failed to deliver to Lead 367 — unsupported channel: sms', time: '5/18/2026', group: 'older', unread: true },
    { id: 'n7', type: 'billing', title: 'Contract signed',                 body: 'ZonPower B.V. signed CTR-020',         time: '5/16/2026', group: 'older', unread: false },
    { id: 'n8', type: 'booking', title: 'Upcoming call: Sara',             body: 'Starts in 60 min (10:00 AM)',         time: '5/14/2026',  group: 'older', unread: false },
    { id: 'n9', type: 'message', title: 'New reply from Stefan',           body: '“Ja zeker! Wij hebben een boerderij…”', time: '5/12/2026', group: 'older', unread: false },
    { id: 'n10', type: 'system', title: 'AI usage at 78% of plan',         body: 'OpenAI spend tracking above forecast', time: '5/10/2026', group: 'older', unread: false },
  ];

  return { INVOICE_STATUS, CONTRACT_STATUS, clients, invoices, expenses, contracts, notifications,
    today: '2026-05-31',
    provider: { name: 'Gabriel Barbosa Fronza', trading: 'Lead Awaker', addr: "Christiaan Huygensweg 32, 's-Hertogenbosch, The Netherlands", kvk: '99366738', email: 'gabriel@leadawaker.com', phone: '+55 47 97400 2162' } };
})();
