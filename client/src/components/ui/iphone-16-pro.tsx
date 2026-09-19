import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * An iPhone 16 Pro frame with live content on its screen.
 *
 * Ported from the 21st.dev `iphone-16-pro` component, which is one SVG that
 * can only show a static image. Here the frame is split into two layers so
 * any element (a WebGL canvas, text) sits on the screen, with the Dynamic
 * Island drawn over it as on a real phone:
 *
 *   SVG body + black screen  ->  children  ->  SVG Dynamic Island
 *
 * The artwork is a fixed 200x400 drawing, so the box keeps a 1:2 ratio and is
 * sized from outside (give it a height or a width).
 */

/** The screen rect in the 200x400 drawing, as percentages of the box. */
const SCREEN = {
  left: `${(14.08 / 200) * 100}%`,
  top: `${(12.81 / 400) * 100}%`,
  width: `${(171.98 / 200) * 100}%`,
  height: `${(374.37 / 400) * 100}%`,
  // Elliptical, because one rx of 24.62 is a different share of each side.
  borderRadius: `${(24.62 / 171.98) * 100}% / ${(24.62 / 374.37) * 100}%`,
};

export function Iphone16Pro({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("relative aspect-[1/2]", className)}>
      <svg viewBox="0 0 200 400" fill="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <path
          fill="#303333"
          d="M196.11,128.09c0-.25-.2-.45-.45-.45-.11.04-.37.03-.69,0V36.69c0-17.84-14.46-32.31-32.31-32.31H37.48C19.63,4.39,5.17,18.85,5.17,36.69v48.99c-.3.02-.55.03-.66-.02-.25,0-.45.2-.45.45,0,0,0,17.29,0,17.29-.03.41.5.49,1.11.48v13.63c-.61,0-1.14.08-1.11.48,0,0,0,28.54,0,28.54-.03.42.5.49,1.11.48v7.95c-.61,0-1.14.08-1.11.48,0,0,0,28.54,0,28.54-.03.42.5.49,1.11.48v178.86c0,17.84,14.46,32.31,32.31,32.31h125.2c17.84,0,32.31-14.46,32.31-32.31v-188.87c.32-.02.58-.03.69.04,1.26.1.03-45.94.45-46.38ZM186.07,362.63c0,13.56-10.99,24.56-24.56,24.56H38.64c-13.56,0-24.56-10.99-24.56-24.56V37.37c0-13.56,10.99-24.56,24.56-24.56h122.87c13.56,0,24.56,10.99,24.56,24.56v325.26Z"
        />
        <path
          fill="#000000"
          d="M161.38,7.29H38.78c-16.54,0-29.95,13.41-29.95,29.95v325.52c0,16.54,13.41,29.95,29.95,29.95h122.6c16.54,0,29.95-13.41,29.95-29.95V37.24c0-16.54-13.41-29.95-29.95-29.95ZM186.07,362.57c0,13.6-11.02,24.62-24.62,24.62H38.7c-13.6,0-24.62-11.02-24.62-24.62V37.43c0-13.6,11.02-24.62,24.62-24.62h122.75c13.6,0,24.62,11.02,24.62,24.62v325.14Z"
        />
        <rect fill="#000000" x="14.08" y="12.81" width="171.98" height="374.37" rx="24.62" ry="24.62" />
      </svg>

      <div className="absolute overflow-hidden bg-black" style={SCREEN}>
        {children}
      </div>

      <svg viewBox="0 0 200 400" fill="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <path
          fill="#000000"
          d="M119.61,33.86h-38.93c-10.48-.18-10.5-15.78,0-15.96,0,0,38.93,0,38.93,0,4.41,0,7.98,3.57,7.98,7.98,0,4.41-3.57,7.98-7.98,7.98Z"
        />
        <path fill="#080d4c" d="M118.78,29.21c-4.32.06-4.32-6.73,0-6.66,4.32-.06,4.32,6.73,0,6.66Z" />
      </svg>
    </div>
  );
}
