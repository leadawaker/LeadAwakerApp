// leads-data.js — mock data for Leads Page (list / table / kanban + detail)

(function () {

  // Pipeline stages — colors come straight from the design-system tokens
  // so the Leads page reads identically to the Campaigns page.
  const pipeline = [
    { key: 'new',       label: 'New',            color: 'var(--stage-new)' },
    { key: 'contacted', label: 'Contacted',      color: 'var(--stage-contacted)' },
    { key: 'responded', label: 'Responded',      color: 'var(--stage-responded)' },
    { key: 'multi',     label: 'Multi-Response',  color: 'var(--stage-multi)' },
    { key: 'qualified', label: 'Qualified',      color: 'var(--stage-qualified)' },
    { key: 'booked',    label: 'Booked',         color: 'var(--stage-booked)', star: true },
    { key: 'lost',      label: 'Lost',           color: 'var(--stage-lost)' },
    { key: 'dnd',       label: 'DND',            color: 'var(--stage-dnd)' },
  ];

  // 2-letter initials from a name
  function initials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.trim().slice(0, 2).toUpperCase();
  }

  // Compact lead factory
  let _id = 300;
  function L(name, stage, score, temp, ago, grp, extra) {
    _id += 1;
    return Object.assign({
      id: _id, name, ini: initials(name), stage, score, temp, ago, grp,
      phone: '+316' + (10000000 + Math.floor(Math.random() * 8999999)),
      email: name.toLowerCase().replace(/\s+/g, '.') + '@example.nl',
      account: 'Next Level',
      campaign: '',
      note: '',
      demo: false,
    }, extra || {});
  }

  const leads = [
    // ── This week ──
    L('Stefan Vermeer', 'multi', 42, 'Lukewarm', '5d', 'week', { id: 379, demo: true, campaign: 'Universal Demo', account: 'Lead Awaker', phone: '+31628702297', note: 'Reflecting on a personal matter; open to a coaching call.' }),
    L('Cas van der Linden', 'new', 10, 'Cold', '1d', 'week', { campaign: 'Huddle Reactivation' }),
    L('Femke Vos', 'qualified', 59, 'Hot', '2d', 'week', { campaign: 'The Full Circle', note: 'Wants VIP pricing.' }),
    L('Thijs Peters', 'booked', 57, 'Hot', '3d', 'week', { campaign: 'Huddle Reactivation', booking: { iso: '2026-06-01', day: 'Mon', d: 1, mon: 'Jun', start: '10:00 AM', end: '11:00 AM', dur: '60m', via: 'Google Meet', likelihood: 82, conf: 'High', type: 'Intro call' } }),
    L('Sophie Meijer', 'responded', 24, 'Warm', '4d', 'week', { campaign: 'The Full Circle' }),

    // ── This month ──
    L('Gabriel Barbosa', 'multi', 49, 'Hot', '1w', 'month', { demo: true, campaign: 'Keukens' }),
    L('Johan de Vries', 'multi', 35, 'Cold', '2w', 'month', { campaign: 'Keukens' }),
    L('Sara Postma', 'booked', 57, 'Hot', '2w', 'month', { campaign: 'SaaS Trial', booking: { iso: '2026-06-02', day: 'Tue', d: 2, mon: 'Jun', start: '02:00 PM', end: '03:00 PM', dur: '60m', via: 'Google Meet', likelihood: 78, conf: 'High', type: 'Demo call' } }),
    L('Michael Stalone', 'booked', 57, 'Hot', '3w', 'month', { campaign: 'Dental Care', note: 'Former member, strong interest.', booking: { iso: '2026-06-03', day: 'Wed', d: 3, mon: 'Jun', start: '11:00 AM', end: '12:00 PM', dur: '60m', via: 'Google Meet', likelihood: 75, conf: 'High', type: 'Consultation' } }),
    L('Danique Smit', 'multi', 47, 'Warm', '3w', 'month', { campaign: 'Real Estate' }),
    L('Lotte Koster', 'qualified', 45, 'Warm', '3w', 'month', { campaign: 'The Full Circle' }),
    L('Niels van Leeuwen', 'booked', 55, 'Hot', '3w', 'month', { campaign: 'SaaS Trial', booking: { iso: '2026-06-04', day: 'Thu', d: 4, mon: 'Jun', start: '09:00 AM', end: '09:30 AM', dur: '30m', via: 'Phone', likelihood: 60, conf: 'Medium', type: 'Discovery call' } }),
    L('Roos Dijkstra', 'booked', 57, 'Hot', '3w', 'month', { campaign: 'Dental Care', booking: { iso: '2026-06-05', day: 'Fri', d: 5, mon: 'Jun', start: '03:00 PM', end: '04:00 PM', dur: '60m', via: 'Google Meet', likelihood: 68, conf: 'Medium', type: 'Proposal review' } }),
    L('Eva Willems', 'responded', 20, 'Warm', '3w', 'month', { campaign: 'Keukens' }),
    L('Bram de Groot', 'contacted', 15, 'Cold', '3w', 'month', { campaign: 'The Full Circle' }),
    L('Lisa van den Berg', 'qualified', 45, 'Warm', '4w', 'month', { campaign: 'The Full Circle', note: 'Rejoined Circle, happy with new offer.' }),
    L('Fleur Dekker', 'qualified', 45, 'Hot', '4w', 'month', { campaign: 'The Full Circle', note: 'Already €5K/mo on Amazon.' }),
    L('Tom Hendriks', 'contacted', 15, 'Cold', '4w', 'month', { campaign: 'The Full Circle' }),
    L('Anouk Bos', 'lost', 0, null, '4w', 'month', { campaign: 'The Full Circle', note: 'Switched to dropshipping.' }),
    L('Maria Jansen', 'qualified', 59, 'Hot', '4w', 'month', { demo: true, campaign: 'Dentistry' }),
    L('Pieter Bakker', 'new', 10, 'Cold', '4w', 'month', { campaign: 'Huddle Reactivation' }),
    L('Emma de Boer', 'booked', 57, 'Hot', '4w', 'month', { campaign: 'Dental Care', booking: { iso: '2026-06-01', day: 'Mon', d: 1, mon: 'Jun', start: '02:00 PM', end: '03:00 PM', dur: '60m', via: 'Google Meet', likelihood: 88, conf: 'High', type: 'Treatment plan' } }),
    L('Ken Petit', 'qualified', 47, 'Warm', '4w', 'month', { campaign: 'Campaign 24' }),
    L('Marta Coelho', 'lost', 0, null, '4w', 'month', { campaign: 'Campaign 30' }),
    L('Sander Prins', 'responded', 22, 'Warm', '4w', 'month', { campaign: 'Keukens' }),
    L('Iris Brouwer', 'dnd', 14, 'Cold', '4w', 'month', { campaign: 'Huddle Reactivation', note: 'Asked not to be contacted again.' }),
  ];

  // Last-message peek — lets a rep triage the latest exchange without opening
  // the full thread (this is what replaces a separate Chats inbox). Text is
  // stage-derived so it reads believably per lead; `dir` is who spoke last.
  const stageLastMsg = {
    new:       { dir: 'out', time: '2d', text: 'Hoi {first}, ik kom even terug op je eerdere aanvraag — is dit nog actueel?' },
    contacted: { dir: 'out', time: '1d', text: 'Even een korte follow-up — staat dit nog op je radar?' },
    responded: { dir: 'in',  time: '4h', text: 'Ja, ik ben nog steeds geïnteresseerd. Vertel me wat meer.' },
    multi:     { dir: 'in',  time: '3h', text: 'Klinkt goed. Wat zijn de kosten ongeveer?' },
    qualified: { dir: 'in',  time: '2h', text: 'Dat past bij wat ik zoek. Wanneer kunnen we even bellen?' },
    booked:    { dir: 'in',  time: '1d', text: 'Perfect, de afspraak staat genoteerd. Tot dan!' },
    lost:      { dir: 'in',  time: '1w', text: 'Bedankt, maar ik ga voor een andere oplossing.' },
    dnd:       { dir: 'in',  time: '4w', text: 'Graag geen contact meer opnemen.' },
  };
  leads.forEach(l => {
    const base = stageLastMsg[l.stage] || stageLastMsg.contacted;
    l.lastMsg = { dir: base.dir, time: base.time, text: base.text.replace('{first}', l.name.split(/\s+/)[0]) };
  });

  // Shared rich conversation + scoring used by the detail panel.
  const detailExtras = {
    messages: [
      { id: 1, dir: 'out', text: 'Strategieën te krijgen om deze uitdagingen aan te pakken.', time: '9:54 PM' },
      { id: 2, dir: 'out', text: 'Laten we een gesprek inplannen met een specialist die je verder kan helpen. Zullen we een call inplannen?', time: '9:54 PM' },
      { id: 3, dir: 'div', text: 'May 23' },
      { id: 4, dir: 'in',  text: 'Hoe zit het met die gesprekken met onze coaches? Je had het over relatieproblemen en wilde helderheid krijgen over de situatie met je vrouw.', time: '9:55 PM' },
      { id: 5, dir: 'out', text: 'Hoe staat het met de inzichten over je situatie met je vrouw? Heb je nog vragen of wil je graag nader met een van onze coaches praten?', time: '10:00 PM' },
      { id: 6, dir: 'out', text: 'Helderheid in je situatie met je vrouw kan echt helpen bij het nemen van betere beslissingen. Wil je nog even nader overleggen met een van onze coaches over dit?', time: '10:05 PM' },
      { id: 7, dir: 'out', text: 'Hoe gaat het met je reflectie over de situatie met je vrouw? Wil je nog even nader overleggen met een van onze coaches over wat je hebt doorgemaakt?', time: '10:10 PM' },
    ],
    scoreBreakdown: [
      { label: 'Engagement', value: 5,  max: 30, note: 'Replied 5d ago · Negative', color: 'var(--stage-contacted)' },
      { label: 'Activity',   value: 12, max: 20, note: '5 replies · 63% rate',       color: 'var(--stage-multi)' },
      { label: 'Funnel',     value: 25, max: 50, note: 'Ready to qualify',            color: 'var(--warn)' },
    ],
    scoreHistory: [22, 28, 30, 35, 33, 38, 40, 38, 42, 44, 43, 45, 44, 42, 41, 40, 42, 43, 44, 42],
    summary: {
      ready: true,
      finishedAgo: '2h ago',
      outcome: 'Nurturing',
      headline: 'Stefan is reflecting on a personal matter and is open to a coaching call, but hasn’t committed to a time yet.',
      sentiment: 'Lukewarm — warming',
      points: [
        { tone: 'good',    text: 'Engaged across 5 replies over 3 days; tone shifted from negative toward neutral.' },
        { tone: 'neutral', text: 'Main interest is gaining clarity on his situation; receptive to speaking with a coach.' },
        { tone: 'warn',    text: 'No call booked yet — hesitation around timing rather than intent.' },
      ],
      nextStep: 'Offer a specific morning call slot, kept low-pressure. Best window: 09:00–11:00.',
      topics: ['Relationship clarity', 'Coaching fit', 'Scheduling'],
    },
  };

  // Build a full detail object for a given lead id (merges list fields + rich demo content)
  function getDetail(id) {
    const lead = leads.find(l => l.id === id) || leads[0];
    const stageIdx = Math.max(0, pipeline.findIndex(s => s.key === lead.stage));
    return Object.assign({}, lead, {
      stageIdx,
      lastActivity: lead.ago + ' ago',
      contact: {
        firstName: lead.name.split(' ')[0],
        phone: lead.phone,
        email: lead.email,
        created: lead.ago + ' ago',
        source: 'WhatsApp Demo',
      },
    }, detailExtras);
  }

  window.LEADS_DATA = {
    pipeline,
    leads,
    initials,
    getDetail,
    activeLeadId: 379,
  };

})();
