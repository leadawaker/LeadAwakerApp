// Pure parts of the thumbnail creator: the prompt sent to the image model and the crop that turns
// the model's fixed sizes into the picked format. No I/O, so both are unit tested.
import { THUMB_FORMAT_SIZE, type RefKind, type ThumbFormat, type ThumbKind } from "@shared/socialThumbnails";

export interface PromptRef { kind: RefKind; label: string }

export interface ThumbnailPromptInput {
  kind: ThumbKind;
  format: ThumbFormat;
  title: string;
  /** What the user typed, or the saved style's instructions. */
  extra: string;
  /** The script body or the post caption the thumbnail is for. */
  context: string;
  /** The account's "Sobre mim": who the creator is. */
  about: string;
  /** In the order the images are attached. */
  refs: PromptRef[];
}

const CONTEXT_MAX = 1_200;
const ABOUT_MAX = 600;

const KIND_DIRECTION: Record<ThumbKind, string> = {
  auto:
    "Choose the layout that will stop the scroll for this post: a person, bold typography, a collage or a strong single image. " +
    "If photos of a person are attached, feature that person.",
  presenter:
    "Put the person from the attached person photos on the cover as the clear subject: face sharp and well lit, expressive, " +
    "looking at the camera, shown from the chest up. Keep their exact likeness (face, hair, skin tone); do not invent a different person. " +
    "Place the title in big bold text beside or above them, never over the face.",
  title:
    "A typography-led cover with no people: the title is the hero, set huge, bold and high contrast on a simple, striking background " +
    "(solid color, gradient or a subtle texture) with at most one small supporting graphic.",
  collage:
    "A dynamic collage that combines several images or visual elements about the topic (use the attached asset images when given) " +
    "with a clear focal point and the title in big bold text on a clean band or block so it stays readable.",
};

const REF_ROLE: Record<RefKind, string> = {
  person: "a photo of the person to feature",
  style: "a style example: copy its look (colors, fonts, layout, mood), not its content or text",
  asset: "an image to use in the design",
};

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** The full prompt for one thumbnail request. */
export function buildThumbnailPrompt(input: ThumbnailPromptInput): string {
  const size = THUMB_FORMAT_SIZE[input.format];
  const vertical = size.height > size.width;
  const lines: string[] = [];

  lines.push(
    input.format === "reel"
      ? "Design an Instagram Reel cover image (vertical 9:16)."
      : input.format === "landscape"
        ? "Design a video thumbnail (horizontal 16:9)."
        : input.format === "post" || input.format === "portrait"
          ? `Design an Instagram cover image (vertical ${size.ratio}) that works as a feed post, in the profile grid and as a Reel cover.`
          : `Design an Instagram post cover image (${size.ratio}).`,
  );
  lines.push(KIND_DIRECTION[input.kind]);

  const title = input.title.trim();
  if (title) {
    lines.push(`The cover shows this title, spelled exactly as written, in the same language: "${title}". No other text.`);
  } else {
    lines.push("Do not add any text.");
  }

  if (input.refs.length > 0) {
    const described = input.refs.map((r, i) => `image ${i + 1} is ${REF_ROLE[r.kind]}${r.label.trim() ? ` (${clip(r.label, 60)})` : ""}`);
    lines.push(`Attached images: ${described.join("; ")}.`);
  }

  // The presenter direction already says this; the other looks get it whenever a person photo is attached.
  if (input.kind !== "presenter" && input.refs.some((r) => r.kind === "person")) {
    lines.push("If the person from the attached person photos appears, keep their exact likeness (face, hair, skin tone); do not invent a different person.");
  }

  const context = clip(input.context, CONTEXT_MAX);
  if (context) lines.push(`The post is about: ${context}`);
  const about = clip(input.about, ABOUT_MAX);
  if (about) lines.push(`About the creator: ${about}`);
  const extra = input.extra.trim();
  if (extra) lines.push(`Extra instructions: ${extra}`);

  if (input.format === "reel") {
    lines.push(
      "Keep the title and any face inside the middle 3:4 of the frame (the profile grid crops the top and bottom), " +
      "and keep the bottom fifth free of important things (the Reels buttons and caption sit there).",
    );
  } else if (vertical) {
    lines.push("Keep the title and any face well inside the frame, away from the edges.");
  }
  lines.push("Modern, clean, high contrast, made for a phone screen. No watermarks, no Instagram interface, no borders.");
  return lines.join("\n");
}

/** What the image model is asked for, and the pixel size the result is cropped and scaled to. */
export interface GenerationPlan {
  size: "1024x1536" | "1536x1024" | "1024x1024";
  out: { width: number; height: number };
}

const MODEL_SIZE: Record<ThumbFormat, GenerationPlan["size"]> = {
  portrait: "1024x1536",
  reel: "1024x1536",
  post: "1024x1536",
  square: "1024x1024",
  landscape: "1536x1024",
};

export function generationPlan(format: ThumbFormat): GenerationPlan {
  const out = THUMB_FORMAT_SIZE[format];
  return { size: MODEL_SIZE[format], out: { width: out.width, height: out.height } };
}

/**
 * ffmpeg -vf for a plan: the largest centered area of the format's ratio, then a scale to its size.
 * Written in terms of the input size, so an image of another size than asked for still comes out right.
 */
export function cropFilter(plan: GenerationPlan): string {
  const { width: w, height: h } = plan.out;
  return `crop='min(iw,ih*${w}/${h})':'min(ih,iw*${h}/${w})',scale=${w}:${h}:flags=lanczos,setsar=1`;
}
