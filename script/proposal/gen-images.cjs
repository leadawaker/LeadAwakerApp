// Generates a proposal's illustrations with OpenAI's newest quality image model (script/lib/image-model.cjs), in the same house style as The Report.
// Shots live in proposals/<slug>/shots.json: { "style"?: "...", "shots": { "cover": "A ... ", ... } }.
// Writes proposals/<slug>/img/<name>.png and a JPG next to it (the JPG is what proposal.html uses).
// Usage: node script/proposal/gen-images.cjs <slug> [name ...]   (no names = all). About $0.25 per image.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const KEY = (env.match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const { resolveImageModel } = require('../lib/image-model.cjs');
if (!KEY) { console.error('OPENAI_API_KEY missing'); process.exit(1); }

const [slug, ...only] = process.argv.slice(2);
if (!slug) { console.error('usage: node script/proposal/gen-images.cjs <slug> [name ...]'); process.exit(1); }
const dir = path.join(ROOT, 'proposals', slug);
const { style, shots } = JSON.parse(fs.readFileSync(path.join(dir, 'shots.json'), 'utf8'));

// The Report's style: one shared string is what makes a set of images read as one series.
const STYLE = style || 'Editorial poster illustration in a mid-century screenprint style: flat vector shapes with heavy risograph grain texture. Film-noir lighting from one single hard light source, long cast shadows, venetian-blind light stripes where it fits. Strict limited palette only: deep wine red #6E2638, dark oxblood #3E1520, warm bone off-white #F7F3EC for highlights, near-black ink #1F1A14 for shadows. Minimalist composition with one clear subject and at least 55% calm empty negative space in the upper part of the frame. No text, no letters, no numbers, no logos, no detailed faces. Quiet, cinematic, premium.';

async function gen(name) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: await resolveImageModel('quality', KEY), prompt: `${shots[name]} ${STYLE}`, size: '1024x1536', quality: 'high', n: 1 }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${name}: ${res.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
  fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  const png = path.join(dir, 'img', `${name}.png`);
  fs.writeFileSync(png, Buffer.from(j.data[0].b64_json, 'base64'));
  execFileSync('python3', ['-c', 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],quality=86)', png, png.replace(/\.png$/, '.jpg')]);
  console.log('saved', png.replace(/\.png$/, '.jpg'));
}

const names = only.length ? only : Object.keys(shots);
Promise.allSettled(names.map(gen)).then(rs => rs.forEach(r => r.status === 'rejected' && console.error(r.reason.message)));
