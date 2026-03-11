import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface IconBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this button is in its selected/active toggle state (brand-indigo fill). */
  active?: boolean;
}

export const IconBtn = forwardRef<HTMLButtonElement, IconBtnProps>(
  ({ active = false, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "icon-circle-lg",
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
