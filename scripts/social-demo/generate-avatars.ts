// scripts/social-demo/generate-avatars.ts
// Run once with: node --env-file=.env --import tsx scripts/social-demo/generate-avatars.ts
// 24 low-quality images, roughly $0.30 in total. Re-run only fills in missing files.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { generateSocialImage } from "../../server/demoSocial/image";

const OUT = path.resolve("client/public/social-demo/img");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "socavatar-"));

const FACES: Record<string, string[]> = {
  en: ["woman in her 30s, auburn hair", "man in his 40s, short beard", "man in his 50s, glasses", "woman in her 20s, curly dark hair", "man in his 30s, East Asian", "woman in her 40s, blonde", "man in his 60s, grey hair", "woman in her 30s, Black, braids"],
  nl: ["Dutch woman in her 30s, blonde", "Dutch man in his 20s", "Dutch man in his 40s, beard", "Dutch woman in her 20s, brown hair", "Dutch man in his 30s, glasses", "Dutch woman in her 40s", "Dutch man in his 50s", "Dutch woman in her 30s, ponytail"],
  pt: ["Brazilian woman in her 20s, long dark hair", "Brazilian man in his 30s", "Brazilian man in his 40s, beard", "Brazilian woman in her 30s, curly hair", "Brazilian man in his 20s", "Brazilian woman in her 40s", "Brazilian man in his 50s", "Brazilian woman in her 20s, freckles"],
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [lang, faces] of Object.entries(FACES)) {
    for (let i = 0; i < faces.length; i++) {
      const target = path.join(OUT, `av-${lang}-${i + 1}.webp`);
      if (fs.existsSync(target)) { console.log("skip", target); continue; }
      const file = await generateSocialImage(
        `Casual smartphone profile photo, head and shoulders, ${faces[i]}, friendly, natural light, plain background`,
        {
          fetch: globalThis.fetch,
          exec: async (cmd, args) => { execFileSync(cmd, args); },
          dir: TMP,
          apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY,
        },
        "low",
      );
      execFileSync("cwebp", ["-quiet", "-q", "75", "-resize", "112", "0", path.join(TMP, file), "-o", target]);
      console.log("ok", target);
    }
  }
})();
