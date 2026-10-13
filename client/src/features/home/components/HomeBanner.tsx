import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Trend } from "../lib/homeFormat";

export function HomeBanner({ eyebrow, value, sentence, trend, vsLabel, image, artY }: {
  eyebrow: string; value: ReactNode; sentence: string; trend: Trend; vsLabel: string; image?: string; artY?: string;
}) {
  return (
    <section className="home-banner">
      {image && <img className="home-banner__art" src={image} alt="" loading="eager" style={artY ? { objectPosition: `right ${artY}` } : undefined} />}
      <div className="home-banner__text">
        <div className="home-banner__eyebrow">{eyebrow}</div>
        <div className="home-banner__value">{value}</div>
        <div className="home-banner__sentence">{sentence}</div>
        {trend && (
          <div className="home-banner__trend">
            {trend.dir === "up" && <ArrowUp size={14} aria-hidden />}
            {trend.dir === "down" && <ArrowDown size={14} aria-hidden />}
            <span>{trend.dir === "up" ? `+${trend.pct}%` : `${trend.pct}%`}</span>
            <span>{vsLabel}</span>
          </div>
        )}
      </div>
    </section>
  );
}
