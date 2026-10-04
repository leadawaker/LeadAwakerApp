#!/usr/bin/env python3
"""Build the Brazilian Portuguese homepage (leadawaker.com/pt) from the English one.

    python3 script/build-site-pt.py

Reads client/public/site/index.html and writes client/public/site/pt.html. The
English page stays the single source for layout, styles and scripts; this file
only holds the Portuguese copy. The copy is adapted, not translated word for
word, so read each pair as "what a Brazilian would say here".

Every English string must be found exactly the stated number of times (once
unless said otherwise), so an edit to the English page that this file does not
know about fails loudly instead of leaving English on the Portuguese page.
When that happens, update the English side of the pair and re-run.

Not translated on purpose: the hero call (the recording, its transcript and the
business name it says, Northgate Motors). Gabriel is recording a Portuguese one.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "client/public/site/index.html"
OUT = ROOT / "client/public/site/pt.html"

# Widget_Configs row 7: same Sara and look as row 6, language pt, PT greeting.
WIDGET_KEY_EN = "wk_pNUlirtOPVBVkViwqXgsZmFq"
WIDGET_KEY_PT = "wk_VKSKYDAiDuIESZroCXxAHfvv"

ANY = 0  # count: replace every occurrence, at least one

# (english, portuguese) or (english, portuguese, count)
PAIRS = [
    # ── head ──
    ('<html lang="en">', '<html lang="pt-BR">'),
    ("Lead Awaker: the AI receptionist that picks up when you can't",
     "Lead Awaker: a recepcionista com IA que atende quando você não pode", 2),
    ("Sara answers your phone, website chat and WhatsApp day and night, and books customers straight into your calendar.",
     "A Sara atende seu telefone, o WhatsApp e o chat do site, de dia e de noite, e já marca o cliente direto na sua agenda.", 2),
    ('<link rel="canonical" href="https://www.leadawaker.com/">', '<link rel="canonical" href="https://www.leadawaker.com/pt">'),
    ('<meta property="og:url" content="https://www.leadawaker.com/">', '<meta property="og:url" content="https://www.leadawaker.com/pt">\n<meta property="og:locale" content="pt_BR">'),
    # The redirect only belongs on the English page.
    ("""<script id="lang-redirect">
/* Portuguese browsers land on the Brazilian page (/pt), the same rule the
   /reactivate page follows. Picking EN or PT in the nav is remembered. */
(function(){var p='';try{p=localStorage.getItem('la_site_lang')||''}catch(e){}
  if(p==='en')return;
  if(p==='pt'||/^pt/i.test(navigator.language||''))location.replace('/pt'+location.search+location.hash)})();
</script>
""", ""),

    # ── nav ──
    ('<a class="lang-sw" href="/pt" hreflang="pt-BR" lang="pt-BR" title="Português">PT</a>',
     '<a class="lang-sw" href="/" hreflang="en" lang="en" title="English">EN</a>'),
    ('<a class="lang-sw" href="/pt" hreflang="pt-BR" lang="pt-BR">Português</a>',
     '<a class="lang-sw" href="/" hreflang="en" lang="en">English</a>'),
    ('<nav class="nav" aria-label="Main">', '<nav class="nav" aria-label="Principal">'),
    ('<a href="#phone">Phone</a>', '<a href="#phone">Telefone</a>', 2),
    ('<a href="#website">Website</a>', '<a href="#website">Site</a>'),
    ('<a href="#calendar">Calendar</a>', '<a href="#calendar">Agenda</a>'),
    ('<a href="#how">How it works</a>', '<a href="#how">Como funciona</a>', 2),
    ('<a href="/reactivate">Old leads</a>', '<a href="/reactivate">Reativação</a>'),
    ('href="/login">Log in</a>', 'href="/login">Entrar</a>', 2),
    ('rel="noopener">Book a demo</a>', 'rel="noopener">Agendar demo</a>'),
    ('aria-label="Open menu"', 'aria-label="Abrir menu"'),
    ('<a href="#website">Website chat</a>', '<a href="#website">Chat no site</a>'),
    ('<a href="#calendar">Calendar booking</a>', '<a href="#calendar">Agendamento</a>'),
    ('<a href="#faq">Questions</a>', '<a href="#faq">Dúvidas</a>'),
    ('<a href="/reactivate">Database reactivation</a>', '<a href="/reactivate">Reativação de base</a>', 2),

    # ── hero ──
    ('<i></i>AI receptionist for busy businesses</span>', '<i></i>Recepcionista com IA para quem não para</span>'),
    ('<h1>The receptionist who picks up when <em class="w">you can’t</em></h1>',
     '<h1>A recepcionista que atende quando <em class="w">você não pode</em></h1>'),
    ('Sara is your multichannel receptionist. She answers day and night and books straight into your calendar.',
     'A Sara atende no telefone, no WhatsApp e no seu site. De dia e de noite, e já marca direto na sua agenda.'),
    ('rel="noopener">Test her out</a>', 'rel="noopener">Teste a Sara</a>'),
    ('href="#phone">See a day of calls</a>', 'href="#phone">Veja um dia de ligações</a>'),
    ('<span>1</span>Rings</li>', '<span>1</span>Toca</li>'),
    ('<span>2</span>Qualifies</li>', '<span>2</span>Qualifica</li>'),
    ('<span>3</span>Books</li>', '<span>3</span>Agenda</li>'),
    ('<span>4</span>Tells you</li>', '<span>4</span>Te avisa</li>'),
    ('id="sc-status">Incoming call</span>', 'id="sc-status">Chamada recebida</span>'),
    ('<small>Answered by Sara</small>', '<small>Atendida pela Sara</small>'),
    ('aria-label="Play the example call"', 'aria-label="Ouvir a ligação de exemplo"'),
    ('id="play-l">Play the call</span>', 'id="play-l">Ouvir a ligação</span>'),
    ('Press play to hear Sara take a call from a buyer, after the showroom has closed.',
     'Aperte o play e ouça a Sara atender um comprador depois que a loja já fechou.'),
    ('aria-label="Pause the call"', 'aria-label="Pausar a ligação"'),
    ('Live transcript <small>', 'Transcrição ao vivo <small>'),
    ('<small>New lead · phone call at 19:42</small>', '<small>Novo lead · ligação às 19:42</small>'),
    ('<span class="chip g">Booked</span>', '<span class="chip g">Agendado</span>', 2),
    ('<small>Recap from Sara</small>', '<small>Resumo da Sara</small>'),
    ('<p>Asked about the 2023 Porsche Cayenne Coupé E-Hybrid, for family trips. Saw a cheaper one elsewhere, with three times the mileage.</p>',
     '<p>Perguntou do Porsche Cayenne Coupé E-Hybrid 2023, para viajar com a família. Viu um mais barato em outra loja, com o triplo da quilometragem.</p>'),
    ('aria-label="Play the recording"', 'aria-label="Ouvir a gravação"'),
    ('<b>Tom’s calendar</b><small>Next week</small>', '<b>Agenda do Rafael</b><small>Próxima semana</small>'),
    ('<span class="d">Mon</span><span class="d">Tue</span><span class="d">Wed</span><span class="d">Thu</span><span class="d">Fri</span><span class="d sat">Sat</span>',
     '<span class="d">Seg</span><span class="d">Ter</span><span class="d">Qua</span><span class="d">Qui</span><span class="d">Sex</span><span class="d sat">Sáb</span>'),
    ('<small>Tuesday</small><b class="num">19:43</b>', '<small>Terça-feira</small><b class="num">19:43</b>'),
    ('<time>now</time>', '<time>agora</time>'),
    ('<span class="u">Booked</span> Gabriel, test drive Monday 15:00, 2023 Porsche Cayenne Coupé E-Hybrid. For family trips. Saw a cheaper one elsewhere, with three times the mileage.',
     '<span class="u">Agendado</span> Gabriel, test drive segunda às 15:00, Porsche Cayenne Coupé E-Hybrid 2023. Para viajar com a família. Viu um mais barato em outra loja, com o triplo da quilometragem.'),
    ('just now', 'agora mesmo'),
    ('<small>New lead · call at 19:42</small>', '<small>Novo lead · ligação às 19:42</small>'),
    ('<small>Mon</small><b class="num">15:00</b>', '<small>Seg</small><b class="num">15:00</b>'),
    ('<span>Added to Tom’s calendar</span>', '<span>Na agenda do Rafael</span>'),
    ('<span class="own-l">Your phone</span>', '<span class="own-l">Seu celular</span>'),
    ('id="again" type="button">Play the call again</button>', 'id="again" type="button">Ouvir de novo</button>'),

    # ── four ways to answer ──
    ('<h2>Four ways to answer the phone</h2><p>Plenty of callers don’t leave a message. They ring the next business on the list.</p>',
     '<h2>Quatro jeitos de atender o telefone</h2><p>Quase ninguém deixa recado. A pessoa simplesmente liga para o próximo da lista.</p>'),
    ('aria-label="Comparison of four ways to handle calls, with what the caller hears"',
     'aria-label="Comparação de quatro jeitos de atender ligações, com o que o cliente ouve"'),
    ('<b>You</b></span>', '<b>Você</b></span>'),
    ('<b>Voicemail</b></span>', '<b>Caixa postal</b></span>'),
    ('<b>A service</b></span>', '<b>Uma central</b></span>'),
    ('<span>Yes</span>', '<span>Sim</span>', ANY),
    ('<span>No</span>', '<span>Não</span>', ANY),
    ('<span>Sometimes</span>', '<span>Às vezes</span>', 2),
    ('<span>Message</span><small>', '<span>Recado</span><small>'),
    ('rowheader">Answers every call<', 'rowheader">Atende toda ligação<'),
    ('<small>Rings out while you work</small>', '<small>Toca enquanto você trabalha</small>'),
    ('<small>“Leave a message”</small>', '<small>“Deixe seu recado”</small>'),
    ('<small>“How can I help?”</small>', '<small>“Em que posso ajudar?”</small>'),
    ('<small>“Northgate, Sara speaking”</small>', '<small>“Northgate, aqui é a Sara”</small>'),
    ('rowheader">Knows your business<', 'rowheader">Conhece seu negócio<'),
    ('<small>You know it all</small>', '<small>Você sabe tudo</small>'),
    ('<small>Says nothing</small>', '<small>Não fala nada</small>'),
    ('<small>“I’ll pass it on”</small>', '<small>“Vou passar o recado”</small>'),
    ('<small>“The Cayenne? We’ve got one”</small>', '<small>“O Cayenne? Temos, sim”</small>'),
    ('rowheader">Books into your calendar<', 'rowheader">Marca na sua agenda<'),
    ('<small>“Let me call you back”</small>', '<small>“Te ligo depois”</small>'),
    ('<small>Nobody books</small>', '<small>Ninguém marca</small>'),
    ('<small>“Someone will call you”</small>', '<small>“Alguém vai te ligar”</small>'),
    ('<small>“Monday at 3, booked”</small>', '<small>“Segunda às 15h, marcado”</small>'),
    ('rowheader">Instant reply on chat and WhatsApp<', 'rowheader">Resposta na hora no chat e no WhatsApp<'),
    ('<small>When you see it</small>', '<small>Quando você vê</small>'),
    ('<small>Phone only</small>', '<small>Só telefone</small>', 2),
    ('<small>In seconds</small>', '<small>Em segundos</small>'),
    ('rowheader">Leaves you free to work<', 'rowheader">Deixa você livre para trabalhar<'),
    ('<small>You stop what you’re doing</small>', '<small>Você larga o que está fazendo</small>'),
    ('<small>But you lose them</small>', '<small>Mas você perde o cliente</small>'),
    ('<small>For a fee per minute</small>', '<small>Pagando por minuto</small>'),
    ('<small>You get a recap</small>', '<small>E você recebe um resumo</small>'),
    ('rowheader">Costs you<', 'rowheader">Custa<'),
    ('role="cell">Your time<', 'role="cell">Seu tempo<'),
    ('role="cell">Customers<', 'role="cell">Clientes<'),
    ('role="cell">Per minute<', 'role="cell">Por minuto<'),
    ('class="em">Fixed fee<', 'class="em">Valor fixo<'),
    ('aria-expanded="false">Show what the caller hears</button>', 'aria-expanded="false">Ver o que o cliente ouve</button>'),

    # ── busy hands ──
    ('alt="A craftsman in his workshop, checking a message on his phone"', 'alt="Um profissional na oficina, olhando uma mensagem no celular"'),
    ('<h2>Busy hands.<br><em class="w">Nothing missed.</em></h2><p>You build, fix and serve. Sara takes the calls.</p>',
     '<h2>Mão na massa.<br><em class="w">Cliente atendido.</em></h2><p>Você faz o serviço. A Sara atende o telefone.</p>'),
    ('<b>Sara · while you were in the workshop</b><span>2 quotes requested · 1 visit booked</span>',
     '<b>Sara · enquanto você estava na oficina</b><span>2 orçamentos pedidos · 1 visita marcada</span>'),

    # ── channels hub ──
    ('<h2>One receptionist, <em class="w">three front doors</em></h2>', '<h2>Uma recepcionista, <em class="w">três portas de entrada</em></h2>'),
    ('<h3>You choose where she answers</h3>', '<h3>Você escolhe onde ela atende</h3>'),
    ('id="hub-sum">Sara answers your <b>phone, WhatsApp and website chat</b></p>',
     'id="hub-sum">A Sara atende <b>o telefone, o WhatsApp e o chat do site</b></p>'),
    ('<b>Phone</b><small>Answers your calls</small>', '<b>Telefone</b><small>Atende suas ligações</small>'),
    ('<b>WhatsApp</b><small>Answers messages</small>', '<b>WhatsApp</b><small>Responde mensagens</small>'),
    ('<b>Website chat</b><small>Answers visitors</small>', '<b>Chat do site</b><small>Atende visitantes</small>'),

    # ── 01 phone ──
    ('</i>On the phone <span class="offtag">Switched off</span>', '</i>No telefone <span class="offtag">Desligado</span>'),
    ('<h3>You answer when you can. She answers when you can’t.</h3>', '<h3>Você atende quando dá. Ela atende quando não dá.</h3>'),
    ('Missed calls roll over to Sara. She books the appointment, or a callback if you prefer.',
     'A ligação que você não atende cai na Sara. Ela marca o horário, ou um retorno, se você preferir.'),
    ('aria-label="A phone lock screen running through a Tuesday from 06:00 to 23:00. While the owner is busy with test drives, customers or a closed showroom, Sara answers the calls and books test drives, viewings and valuations."',
     'aria-label="A tela de bloqueio de um celular ao longo de uma terça, das 06:00 às 23:00. Enquanto o dono está em test drive, com cliente ou com a loja fechada, a Sara atende as ligações e marca test drives, visitas e avaliações."'),
    ('<small>Tuesday</small><b class="num" id="lp-time">', '<small>Terça-feira</small><b class="num" id="lp-time">'),
    ('id="lp-st">Showroom closed</span>', 'id="lp-st">Loja fechada</span>'),
    ('<li>On a test drive</li><li>With a customer</li><li>After hours</li><li>Your recap</li>',
     '<li>Em test drive</li><li>Com cliente</li><li>Loja fechada</li><li>Seu resumo</li>'),

    # ── 02 whatsapp ──
    ('</i>On WhatsApp <span class="offtag">Switched off</span>', '</i>No WhatsApp <span class="offtag">Desligado</span>'),
    ('<h3>Immediate replies where your customers already are</h3>', '<h3>Resposta na hora, onde seu cliente já está</h3>'),
    ('Customers send a photo, a voice note or a question. Sara replies and books them in.',
     'O cliente manda foto, áudio ou uma dúvida. A Sara responde e já marca o horário.'),
    ('aria-label="Illustration: a WhatsApp chat with a plumber. A customer sends a photo of a radiator that stays cold at the top, the assistant explains it is a quick job and books a visit at the end of the day."',
     'aria-label="Ilustração: uma conversa no WhatsApp com uma empresa de climatização. A cliente manda a foto de um ar-condicionado que parou de gelar, a assistente explica que é um serviço rápido e marca uma visita no fim do dia."'),
    ('Hartley Plumbing', 'Teixeira Climatização'),
    ('<img src="/site/img/5ec2ad821c3f.webp" alt="">', '<img src="/site/img/aircon-split.webp" alt="">'),
    ('Business account', 'Conta comercial'),
    ('Hi, this radiator stays cold at the top. Not urgent, but could someone take a look?',
     'Oi! Meu ar-condicionado parou de gelar. Não é urgente, mas alguém consegue dar uma olhada?'),
    ('Thanks for the photo. It probably just needs bleeding. Mike can check it at the end of his day.',
     'Obrigada pela foto! Pelo jeito é limpeza e filtro, coisa rápida. O Diego pode passar aí no fim do dia.'),
    ('Does today at 17:30 or tomorrow at 17:00 suit you?', 'Fica melhor hoje às 17:30 ou amanhã às 17:00?'),
    ('<div class="wm me">Today works<sub>', '<div class="wm me">Hoje está ótimo<sub>'),
    ('Done. Mike will be there today at 17:30. I’ll remind you an hour before.',
     'Combinado! O Diego chega hoje às 17:30. Te aviso uma hora antes.'),
    ('</svg>Message<svg', '</svg>Mensagem<svg'),
    ('<li>Sends a photo</li><li>Gets an answer</li><li>Chooses a slot</li><li>Booked</li>',
     '<li>Manda uma foto</li><li>Recebe resposta</li><li>Escolhe o horário</li><li>Agendado</li>'),
    ('data-replay="wa">Play the chat again</button>', 'data-replay="wa">Ver a conversa de novo</button>'),

    # ── 03 website ──
    ('</i>On your website <span class="offtag">Switched off</span>', '</i>No seu site <span class="offtag">Desligado</span>'),
    ('<h3>Late-night visitors become booked appointments</h3>', '<h3>Visitante da madrugada vira horário marcado</h3>'),
    ('She answers from your site and books a free slot. Visitors can type, send a photo or leave a voice note.',
     'Ela atende direto no seu site e marca num horário livre. O visitante pode digitar, mandar foto ou áudio.'),
    ('<p><b>She wears your brand.</b> Pick her colour, her face and the button. Her chat bubbles follow.</p>',
     '<p><b>Ela veste a sua marca.</b> Escolha a cor, o rosto e o botão. Os balões do chat acompanham.</p>'),
    ('id="look-kind">Metal</span> · <span id="look-name">Silver</span>', 'id="look-kind">Metal</span> · <span id="look-name">Prata</span>'),
    ('data-name="Silver rim"', 'data-name="Aro prata"', ANY),
    ('data-name="Gold rim"', 'data-name="Aro dourado"', ANY),
    ('data-name="Silver"', 'data-name="Prata"', ANY),
    ('data-name="Gold"', 'data-name="Dourado"', ANY),
    ('data-name="Rose gold"', 'data-name="Ouro rosé"', ANY),
    ('data-name="Copper"', 'data-name="Cobre"', ANY),
    ('data-name="Cream"', 'data-name="Creme"', ANY),
    ('data-name="Sage"', 'data-name="Sálvia"', ANY),
    ('data-name="Sky"', 'data-name="Céu"', ANY),
    ('data-name="Violet"', 'data-name="Violeta"', ANY),
    ('data-name="Wine"', 'data-name="Vinho"', ANY),
    ('data-kind="Chat button"', 'data-kind="Botão do chat"', ANY),
    ('data-kind="Colour swirl"', 'data-kind="Degradê"', ANY),
    ('aria-label="Illustration: a dental practice website at 23:04 with Sara in the practice\'s blue. The chat opens, the visitor taps Book an appointment, sends a voice note saying they are a new patient, and Sara books Saturday at 10:15."',
     'aria-label="Ilustração: o site de uma clínica odontológica às 23:04, com a Sara no azul da clínica. O chat abre, a visitante toca em Marcar consulta, manda um áudio dizendo que é a primeira vez, e a Sara marca sábado às 10:15."'),
    ('brightsmiledental.com/new-patients', 'clinicasorriso.com.br/primeira-consulta'),
    ('<b>New patients welcome</b>', '<b>Aceitamos novos pacientes</b>'),
    ('Hi there! Have a question? Chat with me here.', 'Oi! Ficou com alguma dúvida? Fale comigo aqui.'),
    ('Digital assistant · Brightsmile Dental', 'Assistente digital · Clínica Sorriso'),
    ('Hi, I’m Sara from Brightsmile Dental. How can I help?', 'Oi, eu sou a Sara, da Clínica Sorriso. Como posso ajudar?'),
    ('data-k="u1">Book an appointment</div>', 'data-k="u1">Marcar consulta</div>'),
    ('Happy to help. Are you a new or an existing patient?', 'Claro! Você já é paciente ou vai ser a primeira vez?'),
    ('“New patient. I haven’t seen a dentist in a while. Anything this weekend?”',
     '“Primeira vez. Faz tempo que não vou ao dentista. Tem horário nesse fim de semana?”'),
    ('No problem at all. Your first visit is a check-up and a clean, about 45 minutes. Here are the next free times:',
     'Sem problema! A primeira consulta é avaliação e limpeza, uns 45 minutos. Os próximos horários livres são:'),
    ('<span>Fri 17:30</span><span class="pk">Sat 10:15</span><span>Sat 11:45</span>',
     '<span>Sex 17:30</span><span class="pk">Sáb 10:15</span><span>Sáb 11:45</span>'),
    ('<small>Booked</small><b>Sat 10:15 · New patient check-up</b>', '<small>Agendado</small><b>Sáb 10:15 · Primeira consulta</b>'),
    ('<span class="pk2">Book an appointment</span><span>Prices</span><span>Opening hours</span>',
     '<span class="pk2">Marcar consulta</span><span>Preços</span><span>Horários</span>'),
    ('Type your message...', 'Digite sua mensagem...'),
    ('23:04 · practice closed', '23:04 · clínica fechada'),
    ('<li>Opens the chat</li><li>Taps Book</li><li>Sends a voice note</li><li>Booked</li>',
     '<li>Abre o chat</li><li>Toca em Marcar</li><li>Manda um áudio</li><li>Agendado</li>'),
    ('data-replay="widget">Play the chat again</button>', 'data-replay="widget">Ver a conversa de novo</button>'),

    # ── her brief ──
    ('<h2>You decide what she says</h2>', '<h2>Você decide o que ela fala</h2>'),
    ('<p>She works from a detailed brief we build with you in your onboarding session.</p>',
     '<p>Ela segue um roteiro detalhado, que montamos junto com você na implantação.</p>'),
    ('aria-label="Sara shown as a speaking orb, with the points of her brief circling around her, coming towards you and moving away behind her."',
     'aria-label="A Sara como uma esfera falante, com os pontos do roteiro dela girando ao redor, vindo para a frente e passando por trás dela."'),
    ('<span class="sv-sub">Phone · Website · WhatsApp</span>', '<span class="sv-sub">Telefone · Site · WhatsApp</span>'),
    ('<h3>Nobody waits on hold</h3><p>She picks up straight away, every time.</p>',
     '<h3>Ninguém fica esperando na linha</h3><p>Ela atende na hora, sempre.</p>'),
    ('<h3>She doesn’t guess</h3><p>Not in her brief? She takes a message.</p>',
     '<h3>Ela não chuta</h3><p>Não está no roteiro? Ela anota o recado.</p>'),
    ('<h3>Unhappy callers go to you</h3><p>Complaints come straight to you.</p>',
     '<h3>Cliente insatisfeito fala com você</h3><p>Reclamação vai direto para você.</p>'),
    ('<h3>You see everything</h3><p>Every conversation is saved in your LeadAwaker dashboard, with a recap.</p>',
     '<h3>Você vê tudo</h3><p>Toda conversa fica salva no seu painel da LeadAwaker, com um resumo.</p>'),

    # ── calendar + urgent ──
    ('<h2>Then she <em class="w">books it</em></h2>', '<h2>E ela já <em class="w">marca</em></h2>'),
    ('<span class="eyebrow">Straight into your calendar</span>', '<span class="eyebrow">Direto na sua agenda</span>'),
    ('<h2>When it can’t wait, <em class="w">she rings you</em></h2>', '<h2>Se for urgente, <em class="w">ela te liga</em></h2>'),
    ('<p>A buyer ready to sign, or a client with an emergency? Sara calls your mobile, briefs you in seconds, and puts them through when you press 1.</p>',
     '<p>Cliente pronto para fechar ou uma emergência? A Sara liga no seu celular, te explica tudo em segundos e transfere a ligação quando você aperta 1.</p>'),
    ('alt="A salon receptionist smiling at a customer across the front desk"', 'alt="Uma recepcionista de salão sorrindo para uma cliente no balcão"'),
    ('aria-label="Illustration: a dental practice\'s week. Sara books six appointments into the free slots, from phone calls, website chats and WhatsApp messages."',
     'aria-label="Ilustração: a semana de uma clínica odontológica. A Sara marca seis consultas nos horários livres, vindas de ligações, do chat do site e do WhatsApp."'),
    ('<b>Brightsmile Dental · this week</b>', '<b>Clínica Sorriso · esta semana</b>'),
    ('</span> booked by Sara</small>', '</span> marcadas pela Sara</small>'),
    ('<div class="wk-head"><span></span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>',
     '<div class="wk-head"><span></span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span></div>'),
    ('<i class="kd tel"></i>Phone</span><span><i class="kd web"></i>Website</span>', '<i class="kd tel"></i>Telefone</span><span><i class="kd web"></i>Site</span>'),
    ('</i>Already booked</span>', '</i>Já ocupado</span>'),
    ('<span class="os-lbl hot">Ready to buy</span>', '<span class="os-lbl hot">Quer fechar</span>'),
    ('<small>Calling your mobile · 10:14</small>', '<small>Ligando no seu celular · 10:14</small>'),
    ('<b>1</b>Talk to Mark now</span><span class="k2"><b>2</b>Callback in 10 min</span>',
     '<b>1</b>Falar com o Marcos</span><span class="k2"><b>2</b>Retornar em 10 min</span>'),
    ('aria-label="Play what the owner hears"', 'aria-label="Ouvir o que o dono ouve"'),
    ('id="play2-l">What Tom hears</span>', 'id="play2-l">O que o Rafael ouve</span>'),
    ('<span>Works with</span><b>Google Calendar</b><b>Outlook</b><b>and more</b>',
     '<span>Funciona com</span><b>Google Agenda</b><b>Outlook</b><b>e outros</b>'),

    # ── how it works ──
    ('<span class="eyebrow">From kick-off to live</span>', '<span class="eyebrow">Do primeiro papo ao ar</span>'),
    ('Live in <em class="w">2 weeks</em>, on your own number', 'No ar em <em class="w">2 semanas</em>, no seu próprio número'),
    ('<p>What happens the moment you say yes. Nothing goes live until you have tested her yourself.</p>',
     '<p>O que acontece depois do seu sim. Nada vai ao ar antes de você mesmo testar a Sara.</p>'),
    ('<small>Day 1</small><h3>Kick-off call</h3><p>Thirty minutes. How calls come in, what a good call sounds like, your prices, your calendar.</p>',
     '<small>Dia 1</small><h3>Conversa inicial</h3><p>Meia hora. Como chegam suas ligações, o que é um bom atendimento, seus preços, sua agenda.</p>'),
    ('<small>Day 2 to 5</small><h3>We build Sara</h3><p>Her brief, what she knows from your website, your booking rules, her voice. Written with you, in your words.</p>',
     '<small>Dias 2 a 5</small><h3>Montamos a Sara</h3><p>O roteiro, o que ela aprende do seu site, suas regras de agendamento, a voz dela. Tudo escrito com você, do seu jeito.</p>'),
    ('<small>Day 6 to 9</small><h3>Quality tests</h3><p>We put her through test conversations: rushed callers, angry ones, price questions, off-topic chats. Every miss gets fixed.</p>',
     '<small>Dias 6 a 9</small><h3>Testes de qualidade</h3><p>A gente coloca a Sara à prova: cliente com pressa, cliente bravo, pergunta de preço, papo fora do assunto. Todo deslize é corrigido.</p>'),
    ('<small>Day 10 to 12</small><h3>You try to catch her out</h3><p>Ring her, message her, ask the awkward questions. She goes live only when you sign off.</p>',
     '<small>Dias 10 a 12</small><h3>Você tenta pegar ela no pulo</h3><p>Ligue, mande mensagem, faça as perguntas mais difíceis. Ela só vai ao ar com o seu ok.</p>'),
    ('<small>Day 14</small><h3>Switch on</h3><p>Forward your calls, add the chat to your site, connect WhatsApp and your calendar. Your number stays yours.</p>',
     '<small>Dia 14</small><h3>No ar</h3><p>Você desvia as ligações, coloca o chat no site, conecta o WhatsApp e a agenda. Seu número continua sendo seu.</p>'),
    ('<small>Week 3 onwards</small><h3>She keeps getting better</h3><p>We read her conversations, A/B test her openings and replies, and send you a short report. Pause her any time.</p>',
     '<small>Da 3ª semana em diante</small><h3>Ela só melhora</h3><p>A gente lê as conversas, faz teste A/B das aberturas e respostas e te manda um relatório curto. Dá para pausar quando quiser.</p>'),

    # ── about ──
    ('<span class="eyebrow">Who you’ll work with</span>', '<span class="eyebrow">Quem vai trabalhar com você</span>'),
    ('<h2><span>Systems</span><span>meet</span><em class="w">sales.</em></h2>', '<h2><span>Sistemas inteligentes</span><span>encontram</span><em class="w">vendas.</em></h2>'),
    ('<p>One of us builds the systems. The other knows how to sell.</p>', '<p>Um vem da tecnologia, o outro vem de vendas.</p>'),
    ('<div>Founder<span>Systems &amp; Automation</span></div>', '<div>Fundador<span>Sistemas &amp; Automação</span></div>'),
    ('<p>12+ years building digital systems, for small businesses and for Warner Bros. and Sega. Today he builds AI that answers, follows up and books.</p>',
     '<p>Mais de 12 anos construindo sistemas digitais para PMEs e empresas como Warner Bros. e Sega. Hoje ele projeta IA que atende, faz o acompanhamento e agenda.</p>'),
    ('<div>Partner<span>Sales &amp; Acquisition</span></div>', '<div>Sócio<span>Vendas &amp; Aquisição</span></div>'),
    ('<p>Sales strategist who has sold millions in technical projects. He shapes how Sara handles “how much?” and “can you do it sooner?”.</p>',
     '<p>Estrategista de vendas com histórico em geração de leads, fechamento e conversões de alto ticket. Já vendeu milhões em projetos técnicos, e é ele quem define como a Sara responde “quanto custa?” e “dá para ser antes?”.</p>'),

    # ── testimonials ──
    ('<span class="eyebrow">In their words</span>', '<span class="eyebrow">Quem já trabalhou com a gente</span>'),
    ('I work with sales software every day, so I don’t impress easily. What stands out with Gabriel is how he builds: he tests everything himself, rings his own receptionist until nothing sounds off, and only then lets a customer hear it.',
     'Trabalho com software de vendas todo dia, então não me impressiono fácil. O que chama atenção no Gabriel é o jeito que ele constrói: testa tudo ele mesmo, liga para a própria recepcionista até nada soar estranho, e só então deixa um cliente ouvir.'),
    ('Gabriel doesn’t hand you a tool and disappear. He asked how we actually talk to our customers, built around that, and kept adjusting the details. It felt like working with a builder who cares how every sentence sounds.',
     'O Gabriel não entrega uma ferramenta e some. Ele perguntou como a gente fala de verdade com os nossos clientes, construiu em cima disso e foi ajustando os detalhes. Parecia trabalhar com alguém que se importa com o som de cada frase.'),
    ('<small>Co-Founder, FusionCraft</small>', '<small>Cofundador, FusionCraft</small>'),

    # ── faq ──
    ('<h2>Questions before you book</h2>', '<h2>Dúvidas antes de agendar</h2>'),
    ('<summary>Does she sound like a robot?</summary><p>No. She talks naturally and lets people interrupt. On the 30-minute call you can ring her and judge for yourself.</p>',
     '<summary>Ela fala igual a um robô?</summary><p>Não. Ela fala com naturalidade e deixa a pessoa interromper. Na nossa conversa você liga para ela e tira a prova.</p>'),
    ('<summary>Do I have to change my number?</summary><p>No. You forward calls to Sara: when you don’t pick up, after hours, or always.</p>',
     '<summary>Preciso trocar de número?</summary><p>Não. Você desvia as ligações para a Sara: quando não atende, fora do horário ou sempre.</p>'),
    ('<summary>Can she book into my calendar?</summary><p>Yes, on the phone, in chat and on WhatsApp. She only offers times you’re free and books straight into Google Calendar, Outlook and other calendar tools. Prefer to ring people first? She books a callback instead.</p>',
     '<summary>Ela marca direto na minha agenda?</summary><p>Sim, no telefone, no chat e no WhatsApp. Ela só oferece horários em que você está livre e marca direto no Google Agenda, no Outlook e em outras agendas. Prefere ligar para o cliente antes? Ela agenda um retorno.</p>'),
    ('<summary>Where do I see her conversations?</summary><p>Every call and chat is saved in your LeadAwaker dashboard, with the transcript and a short recap. You also get each recap by email or WhatsApp the moment the conversation ends.</p>',
     '<summary>Onde eu vejo as conversas dela?</summary><p>Toda ligação e todo chat ficam salvos no seu painel da LeadAwaker, com a transcrição e um resumo curto. Você também recebe cada resumo por e-mail ou WhatsApp assim que a conversa termina.</p>'),
    ('<summary>What if she doesn’t know the answer?</summary><p>She takes a message and sends you the question. She never makes up prices.</p>',
     '<summary>E se ela não souber a resposta?</summary><p>Ela anota o recado e te passa a pergunta. Preço ela nunca inventa.</p>'),
    ('<summary>What about urgent calls and complaints?</summary><p>You decide what’s urgent, and she can ring your mobile for those. Complaints come straight to you.</p>',
     '<summary>E ligação urgente ou reclamação?</summary><p>Você define o que é urgente, e nesses casos ela liga no seu celular. Reclamação vai direto para você.</p>'),
    ('<summary>Which languages does she speak?</summary><p>English, Dutch and Portuguese.</p>',
     '<summary>Quais idiomas ela fala?</summary><p>Português, inglês e holandês.</p>'),
    ('<summary>What does it cost?</summary><p>One fixed monthly fee, based on your call volume. You get the price in writing on the first call.</p>',
     '<summary>Quanto custa?</summary><p>Uma mensalidade fixa, de acordo com o seu volume de ligações. Você recebe o valor por escrito já na primeira conversa.</p>'),
    ('<summary>What happens to my customers’ data?</summary><p>Conversations are stored on our servers in the Netherlands, and our AI providers work under data processing agreements. You can read or delete any conversation.</p>',
     '<summary>E os dados dos meus clientes?</summary><p>As conversas ficam nos nossos servidores na Holanda, e nossos fornecedores de IA trabalham sob contratos de tratamento de dados. Você pode ver ou apagar qualquer conversa.</p>'),

    # ── book ──
    ('<h2>Hear your receptionist before you decide</h2>', '<h2>Ouça sua recepcionista antes de decidir</h2>'),
    ('<p>20 minutes. We’ll show you Sara answering as the receptionist for your business. Add your website when you book.</p>',
     '<p>20 minutos. A gente mostra a Sara atendendo como recepcionista do seu negócio. Na hora de agendar, deixe o endereço do seu site.</p>'),
    ('rel="noopener">Pick a time in the calendar</a>', 'rel="noopener">Escolher um horário</a>'),

    # ── footer ──
    ('<span>’s-Hertogenbosch, Netherlands</span>', '<span>’s-Hertogenbosch, Holanda</span>'),
    ('<a href="/terms-of-service">Terms &amp; Conditions</a><a href="/privacy-policy">Privacy Policy</a>',
     '<a href="/terms-of-service">Termos e Condições</a><a href="/privacy-policy">Política de Privacidade</a>'),

    # ── scripts: the urgent call's briefing (text only, no recording) ──
    ('"text": "Hi Tom, it’s Sara. I’ve got Mark Jansen on the line. He test-drove the blue Kia yesterday and wants to buy it today. Press 1 to talk to him now, or press 2 and I’ll tell him you’ll call back in ten minutes."',
     '"text": "Oi Rafael, é a Sara. Estou com o Marcos Oliveira na linha. Ele fez test drive no Kia azul ontem e quer fechar hoje. Aperte 1 para falar com ele agora, ou 2 que eu aviso que você retorna em dez minutos."'),

    # ── scripts: hero player ──
    ("'Incoming call…'", "'Chamada recebida…'"),
    ("'Call ended · '", "'Chamada encerrada · '"),
    ("'Play the call with sound':'Play the call'):hero.mode==='paused'?'Paused · '",
     "'Ouvir a ligação com som':'Ouvir a ligação'):hero.mode==='paused'?'Pausado · '"),
    ("running()?'Pause the call':'Play the call'", "running()?'Pausar a ligação':'Ouvir a ligação'"),
    ("running()?'Live':hero.mode==='paused'?'Paused':''", "running()?'Ao vivo':hero.mode==='paused'?'Pausado':''"),
    ("on?'Back to your phone':'See it in the LeadAwaker platform'", "on?'Voltar para o celular':'Ver na plataforma LeadAwaker'"),
    ("'Sound could not start here'", "'O som não pôde tocar aqui'"),
    ("!R.d.mp3?'What Tom hears'", "!R.d.mp3?'O que o Rafael ouve'"),
    ("'Hear what Tom hears · '", "'Ouça o que o Rafael ouve · '"),
    ("on?'Hide what the caller hears':'Show what the caller hears'", "on?'Esconder o que o cliente ouve':'Ver o que o cliente ouve'"),

    # ── scripts: channel picker ──
    ("var NAMES={phone:'phone',website:'website chat',whatsapp:'WhatsApp'};", "var NAMES={phone:'o telefone',website:'o chat do site',whatsapp:'o WhatsApp'};"),
    ("+' and '+a[a.length-1]", "+' e '+a[a.length-1]"),
    ("'Sara answers your <b>'+list(on)+'</b>':'Sara is switched off. <b>Pick at least one.</b>'",
     "'A Sara atende <b>'+list(on)+'</b>':'A Sara está desligada. <b>Escolha pelo menos um canal.</b>'"),

    # ── scripts: the phone's day ──
    ("[[9,12.25,'On a test drive'],[13.5,17.5,'With a customer'],[18,23,'Showroom closed']]",
     "[[9,12.25,'Em test drive'],[13.5,17.5,'Com cliente'],[18,23,'Loja fechada']]"),
    ("out:'Booked a viewing · Thu 16:00'", "out:'Agendou visita · Qui 16:00'"),
    ("out:'Booked a visit · Fri 11:00'", "out:'Agendou reunião · Sex 11:00'"),
    ("out:'Booked a valuation · Sat 9:30'", "out:'Agendou avaliação · Sáb 9:30'"),
    ("out:'Booked a test drive · Mon 15:00'", "out:'Agendou test drive · Seg 15:00'"),
    ("out:'Answered: open from 9:00'", "out:'Respondeu: abrimos às 9:00'"),
    ("'<b>Booked</b> '+c.out.replace('Booked ','')", "'<b>Agendou</b> '+c.out.replace('Agendou ','')"),
    ("'Phone<time>'+c.t+'</time></div><p>You answered</p>'", "'Telefone<time>'+c.t+'</time></div><p>Você atendeu</p>'"),
    ("st.textContent=b||'Free'", "st.textContent=b||'Livre'"),
    ("{sum:'Sara today: 5 calls, 4 booked'}", "{sum:'Hoje: 5 ligações, 4 agendadas'}"),

    # ── scripts: menu, calendar week, brief orbit, login ──
    ("o?'Close menu':'Open menu'", "o?'Fechar menu':'Abrir menu'"),
    ("DAYS=['Mon','Tue','Wed','Thu','Fri']", "DAYS=['Seg','Ter','Qua','Qui','Sex']"),
    ("var NEW=[{d:1,s:14,e:15,t:'New patient check-up',w:'Anna',ch:'tel'},{d:0,s:15,e:16,t:'Cleaning',w:'Joe',ch:'wa'},{d:2,s:10,e:11,t:'Whitening consult',w:'Sam',ch:'web'},",
     "var NEW=[{d:1,s:14,e:15,t:'Primeira consulta',w:'Ana',ch:'tel'},{d:0,s:15,e:16,t:'Limpeza',w:'João',ch:'wa'},{d:2,s:10,e:11,t:'Avaliação de clareamento',w:'Camila',ch:'web'},"),
    ("{d:3,s:14,e:15,t:'Check-up',w:'Lena',ch:'wa'},{d:4,s:11.5,e:12.5,t:'New patient check-up',w:'Ravi',ch:'web'},{d:3,s:16,e:16.75,t:'Callback',w:'Maria',ch:'tel'}];",
     "{d:3,s:14,e:15,t:'Revisão',w:'Lucas',ch:'wa'},{d:4,s:11.5,e:12.5,t:'Primeira consulta',w:'Bruna',ch:'web'},{d:3,s:16,e:16.75,t:'Retorno por telefone',w:'Maria',ch:'tel'}];"),
    ("var VIA={tel:'by phone',web:'on the website',wa:'on WhatsApp'};", "var VIA={tel:'por telefone',web:'pelo site',wa:'pelo WhatsApp'};"),
    ("n.w+' booked '+DAYS[n.d]", "n.w+' marcou '+DAYS[n.d]"),
    ("var ITEMS=[['Name','Sara'],['Works at','Northgate Motors'],['Voice','Warm and calm'],['Knows','All 48 cars in stock'],['Books','Test drives'],['Answers','Opening hours'],",
     "var ITEMS=[['Nome','Sara'],['Trabalha na','Northgate Motors'],['Voz','Calma e simpática'],['Conhece','Os 48 carros do estoque'],['Agenda','Test drives'],['Responde','Horário de funcionamento'],"),
    ("['Books','Trade-in valuations'],['Answers','Financing questions'],['Rings Tom','Buyers ready to sign'],['Never','Makes up a price'],['Says','“Tom talks price in person.”'],['Sends','A recap to Tom']];",
     "['Agenda','Avaliação do seu usado'],['Responde','Dúvidas sobre financiamento'],['Liga para o Rafael','Quando o cliente quer fechar'],['Nunca','Inventa preço'],['Diz','“O preço o Rafael passa pessoalmente.”'],['Envia','Um resumo para o Rafael']];"),
    ("a.textContent='Open app'", "a.textContent='Abrir app'"),

    # ── widget: the Portuguese Sara ──
    (WIDGET_KEY_EN, WIDGET_KEY_PT),
]


def main() -> None:
    html = SRC.read_text(encoding="utf-8")
    problems = []
    for pair in PAIRS:
        en, pt = pair[0], pair[1]
        want = pair[2] if len(pair) > 2 else 1
        found = html.count(en)
        if (want == ANY and found == 0) or (want != ANY and found != want):
            problems.append(f"expected {'1+' if want == ANY else want}, found {found}: {en[:90]!r}")
            continue
        html = html.replace(en, pt)
    if problems:
        print("English page changed; update these pairs in script/build-site-pt.py:", file=sys.stderr)
        for p in problems:
            print("  - " + p, file=sys.stderr)
        sys.exit(1)
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(html):,} bytes, {len(PAIRS)} replacements)")


if __name__ == "__main__":
    main()
