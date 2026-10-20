/**
 * "Add to home screen" as visual step cards: iPhone (Safari share sheet) and
 * Android (Chrome menu), ending with the app icon on the home screen.
 */

import { Compass, Globe, Share, SquarePlus, MoreVertical, Download } from "lucide-react";
import { Figure, type K } from "./parts";

const URL_TEXT = "app.leadawaker.com";

/** A tiny screen: a frame with optional highlighted pieces inside. */
function Mini({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-24 sm:w-full shrink-0 h-[72px] p-1.5 flex flex-col gap-1 overflow-hidden"
      style={{ background: "var(--surface)", border: "2px solid var(--ink-soft)", borderRadius: 12 }}
      aria-hidden
    >
      {children}
    </div>
  );
}

function UrlBar({ icon: Icon, end }: { icon: React.ElementType; end?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5 rounded-full" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
      <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: "var(--mute)" }} />
      <span className="flex-1 min-w-0 text-[7px] truncate" style={{ color: "var(--mute)" }}>{URL_TEXT}</span>
      {end}
    </div>
  );
}

/** The thing to tap, ringed in wine. */
function Hit({ children, row = false }: { children: React.ReactNode; row?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${row ? "w-full px-1 py-0.5" : "p-0.5"}`}
      style={{ borderRadius: 6, background: "var(--wine-tint)", outline: "1.5px solid var(--wine)", color: "var(--wine)" }}
    >
      {children}
    </span>
  );
}

function SheetRow({ icon: Icon, label, hit = false }: { icon: React.ElementType; label: string; hit?: boolean }) {
  const inner = (
    <>
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="text-[7px] font-semibold truncate">{label}</span>
    </>
  );
  return hit ? <Hit row>{inner}</Hit> : <span className="flex items-center gap-1 px-1" style={{ color: "var(--mute-2)" }}>{inner}</span>;
}

function Faint() {
  return <span className="block h-1.5 rounded-full" style={{ background: "var(--line-strong)", width: "70%" }} />;
}

function StepCard({ n, text, visual }: { n: number; text: string; visual: React.ReactNode }) {
  return (
    <div
      className="flex sm:flex-col gap-2.5 p-2 min-w-0"
      style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-button)" }}
    >
      {visual}
      <div className="flex gap-2 min-w-0 items-start">
        <span className="shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--wine-tint)", color: "var(--wine)" }}>
          {n}
        </span>
        <span className="text-xs min-w-0" style={{ color: "var(--ink-soft)" }} dangerouslySetInnerHTML={{ __html: text }} />
      </div>
    </div>
  );
}

function HomeIcon({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <img src="/icon-192.png" alt="" width={32} height={32} className="shrink-0 h-8 w-8" style={{ borderRadius: 9 }} />
      <span className="text-[11px]" style={{ color: "var(--mute)" }}>{label}</span>
    </div>
  );
}

export function InstallSteps({ k, platform }: { k: K; platform: "ios" | "android" }) {
  const p = (key: string) => k(`illus.install.${key}`);
  const s = (n: number) => k(`install.${platform}${n}`);

  const visuals =
    platform === "ios"
      ? [
          <Mini key="1"><UrlBar icon={Compass} /><Faint /><Faint /></Mini>,
          <Mini key="2">
            <UrlBar icon={Compass} />
            <Faint />
            <div className="mt-auto flex justify-center"><Hit><Share className="h-3 w-3" /></Hit></div>
          </Mini>,
          <Mini key="3">
            <SheetRow icon={Share} label={p("iosCopy")} />
            <SheetRow icon={SquarePlus} label={p("iosAdd")} hit />
            <SheetRow icon={Globe} label={p("iosOther")} />
          </Mini>,
        ]
      : [
          <Mini key="1"><UrlBar icon={Globe} end={<MoreVertical className="h-2.5 w-2.5" style={{ color: "var(--mute)" }} />} /><Faint /><Faint /></Mini>,
          <Mini key="2">
            <UrlBar icon={Globe} end={<Hit><MoreVertical className="h-2.5 w-2.5" /></Hit>} />
            <Faint />
            <Faint />
          </Mini>,
          <Mini key="3">
            <SheetRow icon={Share} label={p("androidShare")} />
            <SheetRow icon={Download} label={p("androidInstall")} hit />
            <SheetRow icon={Globe} label={p("androidOther")} />
          </Mini>,
        ];

  return (
    <Figure caption={p(`${platform}Caption`)} max={560}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {visuals.map((v, i) => <StepCard key={i} n={i + 1} text={s(i + 1)} visual={v} />)}
      </div>
      <HomeIcon label={p("done")} />
    </Figure>
  );
}
