import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, AlertCircle, Info, Bell } from "lucide-react"
import { cn } from "@/lib/utils"

// The variant lives only in this chip, so every toast shares one card shape.
const variantChip = {
  default: { icon: Bell, cls: "bg-muted text-muted-foreground" },
  destructive: { icon: AlertCircle, cls: "bg-destructive/10 text-destructive" },
  success: { icon: CheckCircle2, cls: "bg-success/10 text-success" },
  info: { icon: Info, cls: "bg-primary/10 text-primary" },
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, duration, groupKey, count, ...props }) {
        const variant = (props.variant || "default") as keyof typeof variantChip
        const { icon: Icon, cls } = variantChip[variant] ?? variantChip.default

        return (
          <Toast key={id} {...props}>
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-surface)]",
                cls,
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5 pt-0.5">
              <div className="flex min-w-0 items-center gap-2">
                {title && <ToastTitle className="truncate">{title}</ToastTitle>}
                {count && count > 1 ? (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-px font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                    {count}&times;
                  </span>
                ) : null}
              </div>
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
              {action && <div className="pt-1.5">{action}</div>}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
