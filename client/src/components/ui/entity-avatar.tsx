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
  /** Pixel dimension (default 40 → h-10 w-10) */
  size?: number;
  /** Additional className */
  className?: string;
}

const SIZE_MAP: Record<number, string> = {
  36: "h-9 w-9 text-[12px]",
  40: "h-10 w-10 text-[13px]",
  72: "h-[72px] w-[72px] text-[22px]",
};

export function EntityAvatar({
  name,
  photoUrl,
  bgColor,
  textColor,
  size = 40,
  className,
}: EntityAvatarProps) {
  const sizeClass = SIZE_MAP[size] ?? `text-[13px]`;
  const sizeStyle = SIZE_MAP[size] ? undefined : { width: size, height: size };

  if (photoUrl) {
    return (
      <div
        className={cn("rounded-full overflow-hidden shrink-0", SIZE_MAP[size] ? sizeClass.split(" ").slice(0, 2).join(" ") : undefined, className)}
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
      className={cn("rounded-full flex items-center justify-center font-bold shrink-0", sizeClass, className)}
      style={{ backgroundColor: bgColor, color: textColor, ...sizeStyle }}
    >
      {getInitials(name)}
    </div>
  );
}
