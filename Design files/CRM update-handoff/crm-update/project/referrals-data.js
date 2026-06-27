// referrals-data.js — mock data for the standalone Referrals page.
// Mirrors the Phase 4 backend: a referral is generated on the positive
// review branch (opt-in via Accounts.enable_referral_ask), then moves
//   asked → received → converted
// The engine owns asked→received; humans own received→converted.

(function () {

  function initials(name) {
    const p = name.trim().split(/\s+/);
    return (p.length >= 2 ? (p[0][0] + p[1][0]) : name.slice(0, 2)).toUpperCase();
  }

  // Board columns. owner = who advances a card out of this state.
  const stages = [
    { key: 'asked',     label: 'Asked',     color: 'var(--stage-contacted)', owner: 'engine', desc: 'Invite sent — waiting for a name' },
    { key: 'received',  label: 'Received',  color: 'var(--wine)',            owner: 'you',    desc: 'A name came back — your move' },
    { key: 'converted', label: 'Converted', color: 'var(--good)',            owner: 'you',    desc: 'Referred customer booked a job', star: true },
  ];

  let _id = 700;
  const R = (o) => { _id += 1; return Object.assign({ id: 'rf-' + _id, channel: 'whatsapp' }, o); };

  const referrals = [
    // ── ASKED — invite out, awaiting a reply ──
    R({ status: 'asked', referrer: 'Yusuf Kaya',     refRating: 5, refJob: 'Garden decking',       lang: 'en', askedAgo: '6h', askedDate: '23 Jun', followUp: false }),
    R({ status: 'asked', referrer: 'Olivia Brooks',  refRating: 5, refJob: 'Kitchen renovation',   lang: 'en', askedAgo: '1d', askedDate: '22 Jun', followUp: false }),
    R({ status: 'asked', referrer: 'Sander Vermeer', refRating: 5, refJob: 'Badkamer renovatie',   lang: 'nl', askedAgo: '2d', askedDate: '21 Jun', followUp: false }),
    R({ status: 'asked', referrer: 'Lotte Janssen',  refRating: 4, refJob: 'Schilderwerk',         lang: 'nl', askedAgo: '3d', askedDate: '20 Jun', followUp: true }),
    R({ status: 'asked', referrer: 'Bram Hofman',    refRating: 4, refJob: 'Dakkapel plaatsing',   lang: 'nl', askedAgo: '4d', askedDate: '19 Jun', followUp: true }),

    // ── RECEIVED — a name came back, needs a human ──
    R({ status: 'received', referrer: 'Marit de Groot', refRating: 5, refJob: 'Badkamer renovatie', lang: 'nl',
        referred: 'Marieke Visser', contact: '+31 6 4128 5530', contactType: 'phone',
        reply: 'Mijn buurvrouw Marieke wil ook haar badkamer laten doen — haar nummer staat hieronder. Top werk geleverd!',
        note: 'Neighbour, same street — wants a full bathroom.', receivedAgo: '4h', receivedDate: '23 Jun', askedAgo: '5d' }),
    R({ status: 'received', referrer: 'Olivia Brooks', refRating: 5, refJob: 'Kitchen renovation', lang: 'en',
        referred: 'Tom Hayes', contact: 'tom.hayes@gmail.com', contactType: 'email',
        reply: "Happy to! My colleague Tom is renovating soon — I've cc'd him in. You guys were great.",
        note: 'Colleague of Olivia, planning a kitchen this autumn.', receivedAgo: '1d', receivedDate: '22 Jun', askedAgo: '6d' }),
    R({ status: 'received', referrer: 'Yusuf Kaya', refRating: 5, refJob: 'Garden decking', lang: 'en',
        referred: 'Dani Roberts', contact: '+31 6 2290 1144', contactType: 'phone',
        reply: 'My sister Dani wants decking too — give her a call, she lives nearby.',
        note: 'Sister — decking, similar size to ours.', receivedAgo: '2d', receivedDate: '21 Jun', askedAgo: '8d' }),

    // ── CONVERTED — referred person became a customer (human-marked) ──
    R({ status: 'converted', referrer: 'Mariska Bos', refRating: 5, refJob: 'Keukeninstallatie', lang: 'nl',
        referred: 'Sophie de Wit', refdJob: 'Keukeninstallatie', contact: '+31 6 5510 7781', contactType: 'phone',
        convertedAgo: '3d', convertedDate: '20 Jun', receivedAgo: '12d', askedAgo: '16d' }),
    R({ status: 'converted', referrer: 'Daan Smit', refRating: 5, refJob: 'Bathroom remodel', lang: 'en',
        referred: 'James Carter', refdJob: 'Bathroom remodel', contact: 'james.carter@outlook.com', contactType: 'email',
        convertedAgo: '1w', convertedDate: '16 Jun', receivedAgo: '3w', askedAgo: '4w' }),
  ];

  referrals.forEach(r => {
    r.refIni = initials(r.referrer);
    if (r.referred) r.refdIni = initials(r.referred);
  });

  // Account config — the opt-in flag + how the ask is framed.
  const config = {
    enabled: true,
    framing: 'reward',          // 'neutral' | 'reward' | 'charity'
    reward: '€50 credit',
    channel: 'whatsapp',
    business: 'Bouwbedrijf De Vries',
  };

  // Funnel KPIs (this month) — derived so the numbers stay honest.
  const asksSent = referrals.length;
  const namesReceived = referrals.filter(r => r.status !== 'asked').length;
  const converted = referrals.filter(r => r.status === 'converted').length;
  const kpis = {
    asksSent,
    namesReceived,
    converted,
    conversionRate: Math.round((converted / asksSent) * 100),
  };

  // Notifications — the bell feed. `referral_received` is the headline event:
  // the engine fired it the moment a customer sent a name back, so a human can
  // pick it up. `refId` links each notice to a card on the board.
  const notifications = [
    { id: 'rn-1', type: 'referral_received',  refId: 'rf-706', title: 'New referral from Marit de Groot', body: 'Marieke Visser — bathroom renovation. Phone shared.', time: '4h ago', unread: true },
    { id: 'rn-2', type: 'referral_received',  refId: 'rf-707', title: 'New referral from Olivia Brooks',   body: "Tom Hayes — kitchen, planning this autumn. Cc'd by email.", time: '1d ago', unread: true },
    { id: 'rn-3', type: 'referral_received',  refId: 'rf-708', title: 'New referral from Yusuf Kaya',      body: 'Dani Roberts — decking, lives nearby. Phone shared.', time: '2d ago', unread: true },
    { id: 'rn-4', type: 'referral_converted', refId: 'rf-709', title: 'Referral converted: Sophie de Wit', body: 'Booked a kitchen install — credited Mariska Bos €50.', time: '3d ago', unread: false },
    { id: 'rn-5', type: 'referral_asked',     refId: 'rf-701', title: 'Referral ask sent to Yusuf Kaya',   body: 'Invite delivered on WhatsApp after a 5★ review.', time: '6h ago', unread: false },
    { id: 'rn-6', type: 'referral_converted', refId: 'rf-710', title: 'Referral converted: James Carter',  body: 'Booked a bathroom remodel — credited Daan Smit €50.', time: '1w ago', unread: false },
  ];

  window.REF_DATA = { stages, referrals, config, kpis, notifications, initials };
})();
