import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateSocialImage, ensureSocialImage, type ImageDeps } from "./image";

function deps(over: Partial<ImageDeps> = {}): ImageDeps & { calls: number } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "socimg-"));
  const d = {
    calls: 0,
    dir,
    apiKey: "sk-test",
    fetch: (async () => {
      d.calls++;
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("png-bytes").toString("base64") }] }), { status: 200 });
    }) as unknown as typeof fetch,
    exec: async (_cmd: string, args: string[]) => {
      fs.writeFileSync(args[args.indexOf("-o") + 1], "webp-bytes");
    },
    ...over,
  };
  return d;
}

test("returns a 16-hex webp filename in the target dir", async () => {
  const d = deps();
  const file = await generateSocialImage("a roofer", d);
  assert.match(file, /^[a-f0-9]{16}\.webp$/);
  assert.ok(fs.existsSync(path.join(d.dir, file)));
});

test("throws without an API key", async () => {
  await assert.rejects(generateSocialImage("x", deps({ apiKey: undefined })), /OPENAI_API_KEY/);
});

test("throws on an API error", async () => {
  const d = deps({ fetch: (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch });
  await assert.rejects(generateSocialImage("x", d), /500/);
});

test("ensureSocialImage dedups concurrent calls for one key and never throws", async () => {
  const d = deps();
  const done: string[] = [];
  await Promise.all([
    ensureSocialImage("client-a", "p", async (f) => { done.push(f); }, d),
    ensureSocialImage("client-a", "p", async (f) => { done.push(f); }, d),
  ]);
  assert.equal(d.calls, 1);
  assert.equal(done.length, 1);
  const bad = deps({ fetch: (async () => { throw new Error("net"); }) as unknown as typeof fetch });
  await ensureSocialImage("client-b", "p", async () => { throw new Error("should not run"); }, bad);
});
