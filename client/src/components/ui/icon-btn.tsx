import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type IconBtnSize = "lg" | "md" | "sm";

interface IconBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual size of the circle: lg=32px md=28px sm=24px. Defaults to "lg". */
  size?: IconBtnSize;
  /** Whether this button is in its selected/active toggle state (brand-blue fill). */
  active?: boolean;
}

const SIZE_MAP: Record<IconBtnSize, string> = {
  lg: "icon-circle-lg",
  md: "icon-circle-md",
  sm: "icon-circle-sm",
};

export const IconBtn = forwardRef<HTMLButtonElement, IconBtnProps>(
  ({ size = "lg", active = false, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        SIZE_MAP[size],
        "icon-circle-base",
        active && "icon-circle-selected",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

IconBtn.displayName = "IconBtn";
