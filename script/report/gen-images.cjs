// Generates the Report's editorial illustrations with OpenAI gpt-image-1.
// Usage: node script/report/gen-images.cjs [name ...]   (no args = all)
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8');
const KEY = (env.match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!KEY) { console.error('OPENAI_API_KEY missing'); process.exit(1); }

const STYLE = 'Editorial poster illustration in a mid-century screenprint style: flat vector shapes with heavy risograph grain texture. Film-noir lighting from one single hard light source, long cast shadows, venetian-blind light stripes where it fits. Strict limited palette only: deep wine red #6E2638, dark oxblood #3E1520, warm bone off-white #F7F3EC for highlights, near-black ink #1F1A14 for shadows. Minimalist composition with one clear subject and at least 55% calm empty negative space in the upper part of the frame. No text, no letters, no numbers, no logos, no detailed faces. Quiet, cinematic, premium.';

const SHOTS = {
  cover: 'A single galvanised metal bucket standing on a bare concrete floor, seen from a low angle. Four thin streams of liquid leak from four small holes in its side and pool on the floor. One hard beam of light falls on it from a high window.',
  leak1: 'A smartphone lying face-up on a wooden workbench in an empty, dark workshop at dusk, its screen glowing brightly with an incoming call. Hand tools hang on the wall in deep shadow. Nobody is there to answer.',
  leak2: 'A small stack of paper documents tied with string on the corner of an empty office desk, lit by a single desk lamp. Dust drifts in the beam of light. A closed laptop and an empty chair sit in shadow.',
  leak3: 'The silhouette of a single small house at night with one warmly lit window. Five small bright stars hang in the dark sky above it. A path leads up to the closed front door.',
  leak4: 'An empty metal mailbox on a post at the end of a long garden path, its little flag down, casting a very long shadow in low evening light. Bare trees in the distance.',
  intro: 'Very simple composition: a single old brass water tap mounted on a dark plaster wall, one large drop of water falling from it, a small puddle below catching a narrow beam of light.',
  lake: 'A perfectly still lake at night, framed on both sides by a black silhouette of a pine forest. Five bright stars hang in the dark sky above and are mirrored as five clear star reflections on the dark water. Calm, symmetrical, very simple.',
  close: 'A single small human figure seen from behind, walking down a long dark corridor toward an open doorway filled with bright light. Venetian-blind stripes of light fall across the floor.',
};

async function gen(name) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: `${SHOTS[name]} ${STYLE}`, size: '1024x1536', quality: 'high', n: 1 }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${name}: ${res.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const out = path.join(__dirname, 'img', `${name}.png`);
  fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('saved', out);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
Promise.allSettled(names.map(gen)).then(rs => rs.forEach(r => r.status === 'rejected' && console.error(r.reason.message)));
