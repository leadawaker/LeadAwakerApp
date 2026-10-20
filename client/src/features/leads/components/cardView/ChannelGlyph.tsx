// Small channel icon for a lead's last contact (website chat, WhatsApp, phone).
import { Globe, MessageCircle, Phone, Mail, MessageSquare, type LucideIcon } from "lucide-react";
import type { ContactChannel } from "../../lib/leadDisplay";

const ICONS: Record<ContactChannel, LucideIcon> = {
  website: Globe,
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
  sms: MessageSquare,
};

export function ChannelGlyph({ channel, size = 12 }: { channel: ContactChannel; size?: number }) {
  const Icon = ICONS[channel];
  return <Icon style={{ width: size, height: size, flexShrink: 0, color: "var(--mute)" }} aria-hidden />;
}
