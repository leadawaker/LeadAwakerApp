// prompt-data.js — Prompt Library for Lead Awaker.
// Prompts are grouped by campaign. Each prompt has raw content with {variables}
// and {{#if x}}…{{/if}} conditionals; a resolution map turns those into live
// values for the Preview pane.

(function () {
  // Variable resolution for the currently-selected campaign context.
  const VARS = {
    agent_name: 'Sofia',
    ai_role: 'sales representative',
    company_name: 'Gourmet Kitchen Designs',
    niche: 'premium kitchen',
    business_description: 'Gourmet Kitchen Designs specializes in creating custom, high-end kitchens tailored to the unique needs of discerning homeowners. We serve clients looking to elevate their cooking and dining experience through exquisite design and superior craftsmanship.',
    service_name: 'kitchen renovation consultation',
    ai_style: 'Casual, smooth and pro',
    language: 'en',
    booking_mode: 'call',
    calendar_link: 'calendly.com/gourmet-kitchen/intro',
    first_name: 'Michael',
  };

  const P = (o) => o;

  const prompts = [
    // ── No Campaign ──
    P({ id: 61, name: 'Prospect Enricher',        group: 'No Campaign', model: 'claude-sonnet-4.5', updated: '1mo ago', icon: 'bot', tokens: 1240 }),
    P({ id: 48, name: 'Lead Awaker Support Bot',  group: 'No Campaign', model: 'gpt-5.1',           updated: '1mo ago', icon: 'bot', tokens: 980 }),
    P({ id: 44, name: 'N8N Demo',                 group: 'No Campaign', model: 'gpt-5.4-mini',      updated: '1mo ago', icon: 'bot', tokens: 640 }),
    P({ id: 39, name: 'Lead Summary — booking',   group: 'No Campaign', model: 'gpt-5.1',           updated: '2mo ago', icon: 'bot', tokens: 1120 }),
    P({ id: 36, name: 'AI Bump Generator',        group: 'No Campaign', model: 'gpt-5.1',           updated: '2mo ago', icon: 'bot', tokens: 720 }),
    P({ id: 33, name: 'Buying Signal Classifier', group: 'No Campaign', model: 'gpt-5.1',           updated: '2mo ago', icon: 'bot', tokens: 540 }),
    P({ id: 30, name: 'Admin Nightly Summary',    group: 'No Campaign', model: 'gpt-5.1',           updated: '2mo ago', icon: 'bot', tokens: 860 }),
    P({ id: 28, name: 'Client Nightly Summary',   group: 'No Campaign', model: 'gpt-5.1',           updated: '2mo ago', icon: 'bot', tokens: 800 }),

    // ── Premium kitchen Demo ──
    P({ id: 65, name: 'Demo Prompt', group: 'Premium kitchen Demo', model: 'gpt-4.1', updated: '3d ago', icon: 'bot', tokens: 2301, active: true,
       temperature: 0.7, maxTokens: 250, version: 'v1.0',
       content: `# AI

## Tone & Identity

- You are {agent_name}, a {ai_role} at {company_name} with niche: {niche}.
- Description: {business_description}.
- You are trying to get leads to buy {service_name} and your {{#if booking_mode == "call"}}goal is to book a discovery call, so the lead will call a human advisor/specialist{{/if}}{{#if booking_mode == "direct"}}goal is to close the sale in conversation to be booked with the calendar link{{/if}}
- Conversation Style: {ai_style}
- Language: always respond in {language}
- You are not a coach or a therapist, talk in business language

## Formatting

- Keep responses short, concise, mobile-friendly
- Strictly evaluate ongoing context before adding any acknowledgements or transitional phrases.
- Check conversation history. Use a different phrase or structure from previous messages.
- Transform state instructions into ONE natural question. Don't repeat the instruction style. If already answered, ask something different.
- One question per reply maximum.
- Always stay on topic.
- First name once per conversation max.

## Booking

{{#if booking_mode == "call"}}- When the lead is ready, collect their preferred time and confirm the discovery call.{{/if}}
- Share the calendar link only when intent is clear: {calendar_link}` }),
    P({ id: 63, name: 'Default — New Campaign', group: 'Premium kitchen Demo', model: 'llama-3.3-70b-versatile', updated: '1mo ago', icon: 'bot', tokens: 1850 }),

    // ── Universal Demo Campaign ──
    P({ id: 22, name: 'Demo Recap Summary Generator', group: 'Universal Demo Campaign', model: 'gpt-5.1', updated: '3w ago', icon: 'bot', tokens: 1340 }),
    P({ id: 19, name: 'Cadence Optimizer',            group: 'Universal Demo Campaign', model: 'gpt-5.1', updated: '3w ago', icon: 'bot', tokens: 910 }),
    P({ id: 17, name: 'Objection Handler',            group: 'Universal Demo Campaign', model: 'claude-sonnet-4.5', updated: '1mo ago', icon: 'bot', tokens: 1080 }),
  ];

  // Give every prompt without explicit content a believable body.
  prompts.forEach(p => {
    if (!p.content) {
      p.content = `# ${p.name}\n\n## Role\n\n- You are {agent_name}, a {ai_role} at {company_name}.\n- Focus niche: {niche}.\n\n## Task\n\n- ${p.name} for incoming leads.\n- Respond in {language}, keep it {ai_style}.\n\n## Output\n\n- Keep responses short and mobile-friendly.\n- One clear next step per message.`;
    }
    if (p.temperature == null) p.temperature = 0.7;
    if (p.maxTokens == null) p.maxTokens = 250;
    if (!p.version) p.version = 'v1.0';
  });

  // ── Version history ───────────────────────────────────────────────
  // The Demo Prompt gets a rich, real-diff history; others get a seed entry.
  const demo = prompts.find(p => p.id === 65);
  demo.version = 'v1.2';
  const demoV11 = demo.content
    .replace('- Conversation Style: {ai_style}', '- Conversation Style: {ai_style}, never pushy')
    .replace(/\n## Booking[\s\S]*$/, '\n');
  const demoV10 = demoV11
    .replace('- You are {agent_name}, a {ai_role} at {company_name} with niche: {niche}.', '- You are {agent_name} at {company_name}.')
    .replace('- One question per reply maximum.\n', '');
  demo.history = [
    { ver: 'v1.2', date: 'Mar 24, 2026 · 14:02', author: 'Gabriel', ini: 'GF', note: 'Added Booking section + calendar-link rule', content: demo.content },
    { ver: 'v1.1', date: 'Mar 18, 2026 · 09:30', author: 'Finn',    ini: 'FZ', note: 'Tightened style guidance, one-question rule', content: demoV11 },
    { ver: 'v1.0', date: 'Mar 02, 2026 · 16:45', author: 'Gabriel', ini: 'GF', note: 'Initial draft', content: demoV10 },
  ];

  prompts.forEach(p => {
    if (!p.history) {
      p.history = [{ ver: p.version, date: p.updated, author: 'Gabriel', ini: 'GF', note: 'Current version', content: p.content }];
    }
  });

  // Tag each prompt as a backend/system prompt or a campaign prompt so the
  // library can split them under top-level tabs instead of one mixed list.
  prompts.forEach(p => { p.kind = p.group === 'No Campaign' ? 'system' : 'campaign'; });

  window.LA_PROMPTS = {
    prompts,
    vars: VARS,
    groups: ['No Campaign', 'Premium kitchen Demo', 'Universal Demo Campaign'],
    systemGroups: ['No Campaign'],
    campaignGroups: ['Premium kitchen Demo', 'Universal Demo Campaign'],
    activeId: 65,
  };
})();
