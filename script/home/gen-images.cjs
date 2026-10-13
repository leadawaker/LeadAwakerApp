// Generates the Home dashboard banner illustrations (specs/home-dashboard) with
// OpenAI's newest quality image model (script/lib/image-model.cjs).
// Usage: node script/home/gen-images.cjs [name ...]   (no args = all)
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8');
const KEY = (env.match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const { resolveImageModel } = require('../lib/image-model.cjs');
if (!KEY) { console.error('OPENAI_API_KEY missing'); process.exit(1); }

const STYLE = 'Editorial poster illustration in a mid-century screenprint style: flat vector shapes with heavy risograph grain texture. Film-noir lighting from one single hard light source, long cast shadows, venetian-blind light stripes where it fits. Strict limited palette only: deep wine red #6E2638, dark oxblood #3E1520, warm bone off-white #F7F3EC for highlights, near-black ink #1F1A14 for shadows. Wide cinematic composition: the single subject sits in the right third of the frame, and the entire left half is calm, dark, empty negative space in near-black and oxblood with no objects and no bright areas. No text, no letters, no numbers, no logos, no people, no faces. Quiet, cinematic, premium.';

const SHOTS = {
  overview: 'A small brass reception desk bell standing on the corner of a dark wooden reception desk, lit by one hard beam of light from the upper right. A long shadow falls across the desk. Draw the bell as flat bone-white and wine shapes with no gold or yellow metal, like a screenprint, not a photo.',
  phone: 'A vintage rotary desk telephone on a dark wooden desk under a single small desk lamp. The receiver rests on its cradle. The lamp casts one warm cone of light on the phone.',
  whatsapp: 'A modern mobile phone lying face-up on a small bedside table in a dark room, its blank screen glowing softly and lighting the table edge. A plain glass of water beside it.',
  website: 'A small shop front on a dark empty street at night, seen from across the road. One large shop window glows warmly, throwing a rectangle of light onto the wet pavement.',
  reactivation: 'A tall dusty metal filing cabinet in a dark archive room. One drawer is pulled open, with paper folders visible inside, lit by a single narrow beam of light from above.',
  reputation: 'A small framed certificate hanging on a dark panelled wall above a narrow shelf. Five small brass stars stand in a row on the shelf, catching one hard beam of light from the side. Draw the stars as flat bone-white shapes with no gold or yellow metal, like a screenprint, not a photo.',
  social: 'An old twin-lens camera on a small tripod standing on a dark wooden table, its lens catching a single beam of light. A few blank square photo prints lie on the table beside it. Draw the camera as flat near-black and bone-white screenprint shapes with no grey metal sheen, not a photo.',
};

async function gen(name) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: await resolveImageModel('quality', KEY), prompt: `${SHOTS[name]} ${STYLE}`, size: '1536x1024', quality: 'high', n: 1 }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${name}: ${res.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const dir = path.join(__dirname, 'img');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${name}.png`);
  fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('saved', out);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
Promise.allSettled(names.map(gen)).then(rs => rs.forEach(r => r.status === 'rejected' && console.error(r.reason.message)));
