import { getInitials } from "@/lib/avatarUtils";
import { cn } from "@/lib/utils";

interface EntityAvatarProps {
  /** Display name for initials fallback */
  name: string;
  /** Photo URL (avatar_url, logo_url, etc.) — photo takes priority when truthy */
  photoUrl?: string | null;
  /** Background color for initials circle */
  bgColor: string;
  /** Text color for initials */
  textColor: string;
  /** Pixel dimension (default 40 → h-10 w-10) or named size */
  size?: number | "xs";
  /** Additional className */
  className?: string;
}

const SIZE_MAP: Record<number, string> = {
  24: "h-6 w-6 text-[9px]",
  32: "h-8 w-8 text-[12px]",
  36: "h-9 w-9 text-[12px]",
  40: "h-10 w-10 text-[13px]",
  72: "h-[72px] w-[72px] text-[22px]",
};

const NAMED_SIZE_MAP: Record<string, string> = {
  xs: "h-5 w-5 text-[8px]",
};

export function EntityAvatar({
  name,
  photoUrl,
  bgColor,
  textColor,
  size = 40,
  className,
}: EntityAvatarProps) {
  const isNamed = typeof size === "string";
  const sizeClass = isNamed ? (NAMED_SIZE_MAP[size] ?? "h-10 w-10 text-[13px]") : (SIZE_MAP[size] ?? `text-[13px]`);
  const sizeStyle = isNamed ? undefined : (SIZE_MAP[size as number] ? undefined : { width: size, height: size });

  if (photoUrl) {
    return (
      <div
        className={cn("rounded-full overflow-hidden shrink-0", isNamed ? sizeClass.split(" ").slice(0, 2).join(" ") : (SIZE_MAP[size as number] ? sizeClass.split(" ").slice(0, 2).join(" ") : undefined), className)}
        style={sizeStyle}
      >
        <img
          src={photoUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-bold shrink-0 leading-none", sizeClass, className)}
      style={{ backgroundColor: bgColor, color: textColor, ...sizeStyle }}
    >
      {getInitials(name)}
    </div>
  );
}
